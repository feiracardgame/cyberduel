const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { io } = require('socket.io-client');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-bans-'));
const [admin, target, opponent, queued, offline] = require('./account-fixture')(directory,
  ['GestorQA', 'DuelistaQA', 'OponenteQA', 'FilaQA', 'OfflineQA']);
const file = path.join(directory, 'accounts.json');
const seeded = JSON.parse(fs.readFileSync(file));
for (const account of Object.values(seeded.accounts)) Object.assign(account, {
  currency: 765, collection: { 'monstro:O Rato': 3 }, rating: 1320,
  rankedGames: 5, rankedWins: 3, rankedLosses: 2, humanGames: 5, humanWins: 3,
});
fs.writeFileSync(file, JSON.stringify(seeded));
const base = 'http://127.0.0.1:32126';
const sockets = [];
let server;
async function start() {
  server = spawn(process.execPath, ['scripts/dev-server.js'], {
    windowsHide: true,
    env: { ...process.env, PORT: '32126', DATA_DIR: directory, ADMIN_USERNAMES: admin.username },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timeout); resolve(); } });
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timeout); reject(Error(`Servidor encerrou: ${code}`)); });
  });
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, 'exit'); server.kill(); await exited;
}
async function api(route, user, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + '/api/' + route, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Evento ausente: ${name}`)), 5000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
});
const emit = (socket, name, payload = {}) => new Promise((resolve, reject) =>
  socket.timeout(4000).emit(name, payload, (error, response) => error ? reject(error) : resolve(response)));
async function connect() {
  const socket = io(base, { transports: ['websocket'], reconnection: false }); sockets.push(socket);
  await event(socket, 'connect'); return socket;
}
const ban = (user, reason = '') => api('admin/accounts/ban', admin, { username: user.username, reason });
const unban = user => api('admin/accounts/unban', admin, { username: user.username });
const saved = user => JSON.parse(fs.readFileSync(file)).accounts[user.accountKey];

(async () => {
  await start();
  for (const action of ['ban', 'unban']) {
    const route = 'admin/accounts/' + action;
    assert.equal((await api(route, null, { username: target.username })).status, 401);
    assert.equal((await api(route, target, { username: admin.username })).status, 403);
    for (const username of ['', null, {}, 10]) assert.equal((await api(route, admin, { username })).status, 400);
    assert.equal((await api(route, admin, { username: 'NaoExisteQA' })).status, 404);
  }
  for (const reason of [null, {}, 12, 'x'.repeat(301)]) assert.equal((await ban(target, reason)).status, 400);
  assert.equal((await ban(admin)).status, 409, 'Evita auto-banimento acidental.');
  const before = (await api('auth/session', offline)).body;
  assert.equal((await api('admin/accounts/ban', admin, { username: '  OFFLINEQA  ', reason: '<b>Teste</b>' })).status, 200);
  assert.equal(saved(offline).banned, true);
  assert.equal(saved(offline).bannedBy, admin.username);
  const bannedAt = saved(offline).bannedAt;
  assert.equal((await ban(offline)).status, 200);
  assert.equal(saved(offline).bannedAt, bannedAt, 'Repetição não apaga motivo nem data.');
  assert.equal(saved(offline).banReason, '<b>Teste</b>');
  for (const [route, body, method] of [
    ['auth/session'], ['account/profile', { nickname: 'OutroNome' }, 'PUT'],
    ['account/match-start', { mode: 'solo' }], ['admin/accounts/unban', { username: offline.username }],
  ]) {
    const result = await api(route, offline, body, method);
    assert.equal(result.status, 403, route); assert.equal(result.body.code, 'ACCOUNT_BANNED');
  }
  assert.ok(!(await api('leaderboard')).body.entries.some(entry => entry.username === offline.username));
  assert.equal((await api('admin/accounts', admin)).body.accounts.find(a => a.username === offline.username).banned, true);
  const rejectedSocket = await connect();
  for (const name of ['create-room', 'join-matchmaking', 'resume-match']) {
    const result = await emit(rejectedSocket, name, { accountToken: offline.token });
    assert.equal(result.code, 'ACCOUNT_BANNED', name);
  }
  await stop(); await start();
  assert.equal((await api('auth/session', offline)).body.code, 'ACCOUNT_BANNED', 'Banimento persiste após reiniciar.');
  assert.equal((await unban(offline)).status, 200);
  const after = (await api('auth/session', offline)).body;
  for (const key of ['currency', 'collection', 'deck', 'rating', 'rankedGames', 'rankedWins', 'rankedLosses'])
    assert.deepEqual(after[key], before[key], `Banir/desbanir preserva ${key}.`);
  assert.equal(saved(offline).unbannedBy, admin.username);
  assert.equal((await unban(offline)).status, 200);
  assert.ok((await api('leaderboard')).body.entries.some(entry => entry.username === offline.username));

  // Falha de gravação não deixa um banimento apenas na memória.
  fs.renameSync(file, file + '.backup'); fs.mkdirSync(file);
  try { assert.equal((await ban(offline)).status, 500); }
  finally { fs.rmdirSync(file); fs.renameSync(file + '.backup', file); }
  assert.equal((await api('auth/session', offline)).status, 200);
  // Uma edição já iniciada não pode passar após o banimento.
  const slow = http.request(base + '/api/account/profile', { method: 'PUT',
    headers: { Authorization: `Bearer ${offline.token}`, 'Content-Type': 'application/json', Expect: '100-continue' } });
  const slowResult = new Promise((resolve, reject) => {
    slow.on('response', response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    slow.on('error', reject);
  });
  const accepted = once(slow, 'continue'); slow.flushHeaders(); await accepted;
  slow.write('{"nickname":"MudancaTardia"');
  await ban(offline); slow.end('}');
  assert.equal(await slowResult, 403);
  await unban(offline);
  assert.equal((await api('auth/session', offline)).body.nickname, before.nickname);

  // Login local também é bloqueado, sem criar outra conta nem perder progresso.
  const local = (await api('auth/local', null, { username: 'LocalQA' })).body;
  assert.equal((await ban({ username: local.username })).status, 200);
  assert.equal((await api('auth/local', null, { username: 'LocalQA' })).body.code, 'ACCOUNT_BANNED');
  await unban({ username: local.username });
  assert.equal((await api('auth/local', null, { username: 'LocalQA' })).status, 200);

  for (const user of [target, opponent, queued])
    assert.equal((await api('account/faction', user, { faction: 'echossystem' })).status, 200);
  const queueSocket = await connect();
  assert.equal((await emit(queueSocket, 'join-matchmaking', { accountToken: queued.token })).ok, true);
  const stopped = event(queueSocket, 'matchmaking-stopped');
  assert.equal((await ban(queued)).status, 200);
  assert.equal((await stopped).code, 'ACCOUNT_BANNED');
  await unban(queued);
  const screen = await connect(), reserved = await connect();
  assert.equal((await emit(screen, 'create-presentation', { table: 1 })).ok, true);
  assert.equal((await emit(reserved, 'reserve-club-seat', { table: 1, seat: 1, accountToken: queued.token })).ok, true);
  await ban(queued);
  assert.deepEqual((await emit(screen, 'watch-club-tables')).tables[0].reservations, []);
  await unban(queued);

  // Um banimento conclui duelos por desistência, inclusive com o jogador desconectado.
  const one = await connect(), two = await connect(), extraTab = await connect();
  await emit(extraTab, 'find-active-match', { accountToken: target.token });
  const room = await emit(one, 'create-room', { accountToken: target.token });
  assert.equal((await emit(two, 'join-room', { code: room.room.code, accountToken: opponent.token })).ok, true);
  const player = () => ({ deck: [], hand: [], field: Array(10).fill(null), discard: [], traps: [], recentlyDrawn: [], victories: 0 });
  const state = { jogador: player(), inimigo: player(), turno: 1, maxTurnos: 7, rodadasParaVencer: 4,
    rodadasJogador: 0, rodadasInimigo: 0, partidaEncerrada: false, historico: [], eventosEfeito: [] };
  assert.equal((await emit(one, 'initial-state', { state })).ok, true);
  one.disconnect();
  const warning = event(extraTab, 'account-banned'), finished = event(two, 'state-update');
  assert.equal((await ban(target, 'Moderação QA')).status, 200);
  assert.equal((await warning).reason, 'Moderação QA');
  const ending = await finished;
  assert.equal(ending.state.partidaEncerrada, true);
  assert.equal(ending.result.resultadoCombate.resultado, 'inimigo');
  const fresh = await connect();
  assert.equal((await emit(fresh, 'resume-match', { resumeToken: room.resumeToken })).ok, false, 'Token de retorno invalidado.');
  assert.equal((await emit(fresh, 'create-room', { accountToken: target.token })).code, 'ACCOUNT_BANNED');
  await unban(target);
  assert.equal((await emit(fresh, 'create-room', { accountToken: target.token })).ok, true);
  fresh.emit('leave-room');
  await emit(fresh, 'find-active-match', { accountToken: target.token });
  const lobby = await emit(fresh, 'create-room', { accountToken: target.token });
  const lobbyWarning = event(fresh, 'account-banned');
  await ban(target); await lobbyWarning;
  const visitor = await connect();
  assert.equal((await emit(visitor, 'join-room', { code: lobby.room.code })).ok, false, 'Sala em espera foi liberada.');
  await unban(target);
  await stop(); await start();
  assert.equal((await api('auth/session', target)).status, 200, 'Desbanimento persiste após reiniciar.');
  console.log('Banimentos: autorização, validação, persistência, login local, API, sockets, fila, mesas, duelo, retorno e falha de gravação aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const socket of sockets) socket.close();
  await stop();
});
