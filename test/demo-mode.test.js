const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-demo-'));
const [admin, player] = require('./account-fixture')(directory, ['DemoAdmin', 'DemoPlayer']);
const base = 'http://127.0.0.1:32044';
const sockets = [];
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: '32044', DATA_DIR: directory, ADMIN_USERNAMES: admin.username },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
}
async function stop() { const exited = once(server, 'exit'); server.kill(); await exited; server = null; }
async function api(route, body, token = admin.token, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + '/api/' + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
const ack = (socket, name, data = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(name, data, (error, result) => error ? reject(error) : resolve(result)));
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Evento ausente: ${name}`)), 5000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
});
async function connect() {
  const socket = io(base, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  await event(socket, 'connect');
  return socket;
}
(async () => {
  await start();
  assert.equal((await api('config')).body.demoMode, false);
  const allowed = (await api('account/faction', { faction: 'echossystem' }, player.token)).body.deck;
  const forbidden = allowed.map(card => card.nome === 'O Boi' ? { ...card, nome: 'HumbaBrain' } : card);
  await api('admin/accounts/grant-cards', { username: player.username, allAvailable: true });
  assert.equal((await api('deck', { deck: forbidden }, player.token, 'PUT')).status, 200);
  const goodPack = 'demo-pack-allowed-0001', badPack = 'demo-pack-forbidden-0001';
  for (const [faction, purchaseId] of [['echossystem', goodPack], ['humbanet', badPack]])
    assert.equal((await api('boosters/buy', { faction, purchaseId }, player.token)).status, 200);
  for (const [token, expected] of [[null, 401], [player.token, 403]])
    assert.equal((await api('admin/demo-mode', { enabled: true }, token)).status, expected);
  for (const enabled of ['true', 1, null])
    assert.equal((await api('admin/demo-mode', { enabled })).status, 400);

  const one = await connect(), two = await connect(), display = await connect();
  assert.equal((await ack(one, 'create-room', { deck: forbidden, accountToken: player.token })).ok, true);
  assert.equal((await api('admin/demo-mode', { enabled: true })).status, 409, 'Não interrompe salas incompatíveis.');
  one.emit('leave-room');
  await ack(one, 'find-active-match');
  assert.equal((await ack(one, 'join-matchmaking', { accountToken: player.token })).ok, true);
  const stopped = event(one, 'matchmaking-stopped'), changed = event(two, 'game-config');
  assert.equal((await api('admin/demo-mode', { enabled: true })).body.demoMode, true);
  assert.match((await stopped).error, /Modo demo/);
  assert.equal((await changed).demoMode, true);
  const before = (await api('auth/session', null, player.token)).body;
  for (const faction of ['humbanet', 'remanescentes', 'sindicato']) {
    assert.equal((await api('boosters/buy', { faction, purchaseId: `demo-${faction}-blocked-0001` }, player.token)).status, 403);
    assert.equal((await api('boosters/open', { faction }, player.token)).status, 403, 'Também bloqueia a abertura do cliente antigo.');
  }
  assert.equal((await api('boosters/open', { packId: badPack }, player.token)).status, 403);
  assert.equal((await api('deck', { deck: forbidden }, player.token, 'PUT')).status, 403);
  assert.equal((await api('account/match-start', { mode: 'solo' }, player.token)).status, 403);
  assert.equal((await ack(one, 'join-matchmaking', { accountToken: player.token })).ok, false);
  assert.equal((await ack(one, 'create-room', { deck: forbidden })).ok, false);
  const table = await ack(display, 'create-presentation', { table: 1 });
  await api('admin/accounts/unlock-leaderboard', { username: player.username });
  assert.equal((await ack(one, 'join-room', { table: 1, code: table.room.code, seat: 1, accountToken: player.token })).ok, false);
  const room = await ack(two, 'create-room', { deck: allowed });
  assert.equal((await ack(one, 'join-room', { code: room.room.code, deck: forbidden })).ok, false);
  assert.equal((await ack(one, 'join-room', { code: room.room.code, deck: allowed })).ok, true);
  const state = require('../server/duel-runtime').createMatch(allowed, allowed);
  const invalid = JSON.parse(JSON.stringify(state));
  Object.assign(invalid.jogador.hand[0], { nome: 'HumbaBrain', tipo: 'monstro', booster: 'raspcorp' });
  assert.equal((await ack(two, 'initial-state', { state: invalid })).ok, false, 'Não confia no booster declarado pelo cliente.');
  for (const malformed of [
    { ...state, jogador: { ...state.jogador, discard: 'inválido' } },
    { ...state, jogador: { ...state.jogador, hand: [{ nome: { toString: '' }, tipo: 'monstro' }] } },
  ]) assert.equal((await ack(two, 'initial-state', { state: malformed })).ok, false, 'Recusa dados malformados sem derrubar o servidor.');
  assert.equal((await ack(two, 'initial-state', { state })).ok, true);
  const after = (await api('auth/session', null, player.token)).body;
  for (const key of ['currency', 'currencySpent', 'collection', 'boosters', 'deck'])
    assert.deepEqual(after[key], before[key], 'Recusas preservam saldo, coleção, pacotes e deck.');

  sockets.forEach(socket => socket.disconnect());
  await stop(); await start();
  assert.equal((await api('config')).body.demoMode, true, 'Modo global persiste após reinício.');
  assert.equal((await api('auth/session', null, player.token)).body.demoMode, true);
  assert.equal((await api('deck', { deck: allowed }, player.token, 'PUT')).status, 200);
  assert.equal((await api('account/match-start', { mode: 'solo' }, player.token)).status, 200);
  assert.equal((await api('boosters/open', { packId: goodPack }, player.token)).status, 200);
  assert.equal((await api('boosters/open', { faction: 'raspcorp' }, player.token)).status, 200);
  assert.equal((await api('admin/demo-mode', { enabled: false })).body.demoMode, false);
  assert.equal((await api('deck', { deck: forbidden }, player.token, 'PUT')).status, 200);
  assert.equal((await api('boosters/open', { packId: badPack }, player.token)).status, 200, 'Pacote guardado volta a abrir ao desativar.');
  console.log('Modo demo: admin, persistência, fila, salas, mesa, solo, estado forjado, decks, boosters e preservação dos dados validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  sockets.forEach(socket => socket.disconnect());
  if (server) await stop();
  fs.rmSync(directory, { recursive: true, force: true });
});
