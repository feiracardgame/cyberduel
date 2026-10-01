const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const url = 'http://127.0.0.1:31997';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-presentation-'));
const sockets = [];
const fixtures = require('./account-fixture')(dataDir, ['ArenaOne', 'ArenaTwo']);
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: '31997', DATA_DIR: dataDir, PUBLIC_URL: 'https://duelo.example/' }, stdio: ['ignore', 'pipe', 'inherit'] });
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Evento ausente: ${name}`)), 6000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
});
const ack = (socket, name, payload = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload, (error, response) => error ? reject(error) : resolve(response)));
async function connect() { const socket = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(socket); await event(socket, 'connect'); return socket; }
async function api(route, token, body) {
  const response = await fetch(url + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  assert.ok(response.ok, `${route}: ${response.status}`); return response.json();
}
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  const page = await fetch(url + '/apresentacao', { headers: { 'X-Forwarded-For': '198.51.100.5' } });
  assert.equal(page.status, 200, 'Página funciona também atrás do servidor público.');
  for (const route of ['/apresentação', '/apresentação/', '/apresentacao/']) {
    const redirect = await fetch(url + route, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/apresentacao');
  }
  assert.match(await page.text(), /window.CYBERDUEL_PRESENTATION=true/);
  assert.doesNotMatch(await (await fetch(url + '/')).text(), /window.CYBERDUEL_PRESENTATION=true/);
  const screen = await connect(), one = await connect(), two = await connect(), outsider = await connect();
  const room = await ack(screen, 'create-presentation');
  assert.equal(room.ok, true); assert.equal(room.room.players, 0);
  assert.equal(room.invitations.length, 2);
  const invitations = room.invitations.map(invite => {
    assert.match(invite.qrCode, /^data:image\/png;base64,/);
    const link = new URL(invite.url); assert.equal(link.origin, 'https://duelo.example');
    return { code: link.searchParams.get('room'), seat: link.searchParams.get('seat'), ticket: link.searchParams.get('ticket') };
  });
  assert.notEqual(invitations[0].ticket, invitations[1].ticket);
  assert.equal((await ack(outsider, 'create-presentation', { code: room.room.code })).ok, false);
  assert.equal((await ack(one, 'join-room', { code: room.room.code })).ok, false);
  const accounts = [];
  for (const account of fixtures) {
    await api('account/faction', account.token, { faction: 'echossystem' });
    accounts.push(account);
  }
  let ready = false; one.on('match-ready', () => { ready = true; });
  assert.equal((await ack(two, 'join-room', { ...invitations[1], accountToken: accounts[1].token })).waiting, true);
  assert.equal(ready, false, 'Não inicia antes dos dois jogadores.');
  assert.equal((await ack(outsider, 'join-room', { ...invitations[1], accountToken: accounts[0].token })).ok, false);
  const readyOne = event(one, 'match-ready'), readyTwo = event(two, 'match-ready'), display = event(screen, 'presentation-room');
  const joined = await ack(one, 'join-room', { ...invitations[0], accountToken: accounts[0].token });
  assert.equal(joined.ok, true);
  const [first, second, shown] = await Promise.all([readyOne, readyTwo, display]);
  assert.equal(first.player, 1); assert.equal(second.player, 2);
  for (const side of ['jogador', 'inimigo']) {
    assert.ok(first.update.state[side].hand.length > 0);
    assert.deepEqual(shown.update.state[side].hand, []);
    assert.deepEqual(shown.update.state[side].deck, []);
    assert.equal(shown.update.state[side].field.length, 10);
  }
  assert.equal(shown.decks, undefined);
  assert.equal((await ack(screen, 'finish-turn', { state: first.update.state, step: 0, round: 1 })).ok, false);
  const spectator = await ack(outsider, 'spectate-room', { code: room.room.code });
  assert.equal(spectator.ok, true);
  assert.ok(spectator.update.state.jogador.hand.length > 0);
  assert.ok(spectator.update.state.jogador.hand.every(card => card.nome === 'Carta oculta'));
  const reconnect = await connect();
  screen.disconnect(); await new Promise(resolve => setTimeout(resolve, 70));
  const resumed = await ack(reconnect, 'create-presentation', { code: room.room.code, displayKey: room.displayKey });
  assert.equal(resumed.ok, true); assert.deepEqual(resumed.update.state.jogador.hand, []);
  // Um estado novo mantém o campo e os efeitos, sem transmitir as mãos à apresentação.
  const card = first.update.state.jogador.hand.shift();
  first.update.state.jogador.field[0] = card;
  first.update.state.eventosEfeito = [{ id: 1, lado: 'jogador', momento: 'invocacao', fonte: { id: card.id, nome: card.nome, indice: 0 }, alvos: [] }];
  const actor = first.activePlayer === 1 ? one : two;
  const update = event(reconnect, 'state-update');
  assert.equal((await ack(actor, 'finish-turn', { state: first.update.state, step: first.step, round: first.round })).ok, false, 'Contagem de início ainda bloqueia jogadas.');
  await new Promise(resolve => setTimeout(resolve, 4050));
  assert.equal((await ack(actor, 'finish-turn', { state: first.update.state, step: first.step, round: first.round })).ok, true);
  const next = await update;
  assert.deepEqual(next.state.jogador.hand, []); assert.deepEqual(next.state.inimigo.hand, []);
  assert.equal(next.state.jogador.field[0].nome, card.nome);
  assert.equal(next.state.eventosEfeito[0].fonte.nome, card.nome);
  const left = event(one, 'opponent-left');
  reconnect.emit('leave-room'); await left;
  console.log('Apresentação: página separada, dois QR codes, lugares exclusivos, início, privacidade, espectador comum, reconexão e encerramento validados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  sockets.forEach(socket => socket.disconnect()); server.kill(); fs.rmSync(dataDir, { recursive: true, force: true });
});
