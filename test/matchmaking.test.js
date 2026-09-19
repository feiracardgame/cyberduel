const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { chooseOpponent, applyResult } = require('../server/ranking');

const entry = { username: 'one', rating: 1000, since: 1000 };
const nearby = { username: 'two', rating: 1150, since: 1000 };
const far = { username: 'three', rating: 1500, since: 1000 };
assert.equal(chooseOpponent(entry, [entry, far], 1000), null);
assert.equal(chooseOpponent(entry, [entry, nearby, far], 1000, () => 0), nearby);
assert.equal(chooseOpponent(entry, [entry, nearby, far], 46000, length => length - 1), far);
assert.equal(chooseOpponent(entry, [{ ...entry }], 999999), null);
const stats = () => ({ rating: 1000, rankedGames: 0, rankedWins: 0, rankedLosses: 0 });
const a = stats(), b = stats(); applyResult(a, b, 'jogador');
assert.equal(a.rating, 1016); assert.equal(b.rating, 984);
const c = stats(), d = stats(); applyResult(c, d, 'empate');
assert.equal(c.rating, 1000); assert.equal(c.rankedGames, 1); assert.equal(c.rankedLosses, 0);

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-ranked-'));
const url = 'http://127.0.0.1:31993';
let server;
const sockets = [];
function start() {
  server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: '31993', DATA_DIR: dataDir, CYBERDUEL_DEBUG: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
}
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Evento ausente: ${name}`)), 6000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
});
const ack = (socket, name, payload = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload, (err, value) => err ? reject(err) : resolve(value)));
async function connect() { const socket = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(socket); await event(socket, 'connect'); return socket; }
async function api(route, token, body, method = 'POST') {
  const response = await fetch(url + '/api/' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `${route}: ${response.status}`); return response.json();
}
async function run() {
  await start();
  const one = await connect(), two = await connect(), duplicate = await connect();
  assert.equal((await ack(one, 'join-matchmaking')).ok, false);
  const users = [];
  for (const username of ['RankOne', 'RankTwo']) {
    const account = await api('auth/register', null, { username, password: 'senha-ranking-123' });
    assert.equal(account.rating, 1000);
    assert.equal((await ack(one, 'join-matchmaking', { accountToken: account.token })).ok, false);
    await api('account/faction', account.token, { faction: 'echossystem' });
    await api('account/profile', account.token, { nickname: 'Mesmo Apelido', avatar: '' }, 'PUT');
    users.push(account);
  }
  const [first, second] = users;
  assert.deepEqual((await api('leaderboard', null, null, 'GET')).entries, []);
  assert.equal((await ack(one, 'join-matchmaking', { accountToken: first.token })).ok, true);
  assert.equal((await ack(duplicate, 'join-matchmaking', { accountToken: first.token })).ok, false);
  assert.equal((await ack(one, 'cancel-matchmaking')).ok, true);
  assert.equal((await ack(duplicate, 'join-matchmaking', { accountToken: first.token })).ok, true);
  duplicate.disconnect();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal((await ack(one, 'join-matchmaking', { accountToken: first.token, rating: 99999, deck: [] })).ok, true);
  const readyOne = event(one, 'match-ready'), readyTwo = event(two, 'match-ready');
  assert.equal((await ack(two, 'join-matchmaking', { accountToken: second.token })).ok, true);
  const [matchOne, matchTwo] = await Promise.all([readyOne, readyTwo]);
  assert.equal(matchOne.room, matchTwo.room); assert.equal(matchOne.ranked, true);
  assert.notEqual(matchOne.player, matchTwo.player); assert.notEqual(matchOne.resumeToken, matchTwo.resumeToken);
  assert.equal(matchOne.profiles[1].nickname, 'Mesmo Apelido'); assert.equal(matchOne.profiles[2].rating, 1000);
  assert.equal(matchOne.profiles[1].rank, 'Bronze'); assert.equal(matchOne.profiles[1].username, undefined);
  assert.equal(matchOne.decks[1].reduce((sum, card) => sum + card.quantidade, 0), 20);
  assert.ok(matchOne.update.state.jogador.hand.length > 0);
  assert.ok(matchOne.update.deadline - matchOne.update.serverNow > 40000, 'Apresentação não consome o tempo da fase.');
  assert.equal((await ack(one, 'join-matchmaking', { accountToken: first.token })).ok, false);
  assert.equal((await ack(one, 'create-room', { accountToken: first.token })).ok, false);
  assert.equal((await ack(one, 'cancel-matchmaking')).ok, false);
  assert.equal((await ack(one, 'debug-finish-match', { resultado: 'vitoria' })).ok, false);
  const found = await ack(one, 'find-active-match', { accountToken: first.token });
  assert.equal(found.room, matchOne.room);
  const final = event(two, 'state-update');
  assert.equal((await ack(one, 'decline-match', { room: matchOne.room, accountToken: first.token })).ok, true);
  assert.equal((await final).state.partidaEncerrada, true);
  let board = (await api('leaderboard', null, null, 'GET')).entries;
  assert.equal(board.length, 2); assert.equal(board[0].rating, 1016); assert.equal(board[0].wins, 1);
  assert.equal(board[1].rating, 984); assert.equal(board[1].losses, 1);
  assert.equal(board[0].username, undefined); assert.equal(board[0].passwordHash, undefined);
  one.emit('surrender'); two.emit('surrender');
  assert.equal((await ack(one, 'decline-match', { room: matchOne.room, accountToken: first.token })).ok, false);
  assert.deepEqual((await api('leaderboard', null, null, 'GET')).entries, board, 'Resultado contabilizado uma única vez.');
  await ack(one, 'resume-match', { resumeToken: matchOne.resumeToken });
  one.emit('leave-room'); two.emit('leave-room');
  // Novo duelo termina pelas regras de combate, sem resultado final informado pelo cliente.
  const nextOne = event(one, 'match-ready'), nextTwo = event(two, 'match-ready');
  await ack(one, 'join-matchmaking', { accountToken: first.token });
  await ack(two, 'join-matchmaking', { accountToken: second.token });
  const next = await nextOne; await nextTwo;
  const players = { [next.player]: one, [3 - next.player]: two };
  await new Promise(resolve => setTimeout(resolve, 4050));
  let update = next.update;
  for (let step = 0; step < 28 && !update.state.partidaEncerrada; step++) {
    const incoming = structuredClone(update.state);
    incoming.rodadasJogador = 999; incoming.partidaEncerrada = true;
    const received = event(players[3 - update.activePlayer], 'state-update');
    const result = await ack(players[update.activePlayer], 'finish-turn', { state: incoming, step: update.step, round: update.round });
    assert.equal(result.ok, true); update = await received;
    assert.notEqual(update.state.rodadasJogador, 999);
  }
  assert.equal(update.state.partidaEncerrada, true);
  board = (await api('leaderboard', null, null, 'GET')).entries;
  assert.ok(board.every(row => row.games === 2));
  sockets.forEach(socket => socket.disconnect());
  await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  await start();
  assert.deepEqual((await api('leaderboard', null, null, 'GET')).entries, board, 'Leaderboard persiste após reinício.');
  console.log('Matchmaking: faixa de rank, sorteio, cancelamento, sessão, duplicação, apresentação, desistência, combate e persistência validados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  sockets.forEach(socket => socket.disconnect()); server?.kill(); fs.rmSync(dataDir, { recursive: true, force: true });
});
