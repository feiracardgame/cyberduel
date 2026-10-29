const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const vm = require('node:vm');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-room-recovery-'));
const [admin, user, opponent] = require('./account-fixture')(directory, ['RoomAdmin', 'RoomUser', 'RoomOpponent']);
const url = 'http://127.0.0.1:31969';
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env,
  PORT: '31969', DATA_DIR: directory, ADMIN_USERNAMES: admin.username, PUBLIC_URL: 'https://duelo.example' },
  stdio: ['ignore', 'pipe', 'inherit'] });
const sockets = [];
const ack = (socket, name, payload = {}) => new Promise((resolve, reject) =>
  socket.timeout(5000).emit(name, payload, (error, result) => error ? reject(error) : resolve(result)));
async function connect() {
  const socket = io(url, { forceNew: true, transports: ['websocket'] });
  sockets.push(socket); await once(socket, 'connect'); return socket;
}
async function api(route, body, token = admin.token) {
  const response = await fetch(url + '/api/' + route, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  for (const account of [user, opponent]) assert.equal((await api('account/faction', { faction: 'raspcorp' }, account.token)).status, 200);
  const one = await connect(), two = await connect(), display = await connect();
  const payload = { accountToken: user.token };
  const first = await ack(one, 'create-room', payload);
  assert.equal((await api('admin/rooms/clear', { code: first.room.code }, null)).status, 401);
  assert.equal((await api('admin/rooms/clear', { code: first.room.code }, user.token)).status, 403);
  for (const body of [null, {}, { code: 123456 }, { code: '123' }])
    assert.equal((await api('admin/rooms/clear', body)).status, 400);
  const cleared = once(one, 'room-cleared');
  assert.equal((await api('admin/rooms/clear', { code: first.room.code })).status, 200);
  assert.equal((await cleared)[0].code, first.room.code);
  assert.equal((await ack(one, 'join-matchmaking', payload)).ok, true, 'Limpeza libera também socket.data.room.');
  await ack(one, 'cancel-matchmaking');
  assert.equal((await api('admin/rooms/clear', { code: first.room.code })).status, 404);
  await ack(one, 'create-room', payload); await ack(two, 'create-room', payload);
  const all = await api('admin/accounts/clear-matches', { username: ' roomuser ' });
  assert.equal(all.status, 200); assert.equal(all.body.count, 2, 'Remove a conta de todas as salas, inclusive de outra aba.');
  assert.equal((await api('admin/accounts/clear-matches', { username: user.username })).body.count, 0);
  assert.equal((await api('admin/accounts/clear-matches', null)).status, 400);
  assert.equal((await api('admin/accounts/clear-matches', { username: 'ausente' })).status, 404);
  assert.equal((await api('admin/accounts/clear-matches', { username: user.username }, user.token)).status, 403);
  await ack(one, 'create-room', payload);
  one.disconnect();
  // A próxima conexão só é aberta depois do fechamento do transporte anterior.
  await new Promise(resolve => setTimeout(resolve, 60));
  const returning = await connect();
  assert.equal((await ack(returning, 'join-matchmaking', payload)).ok, true, 'Desconectar uma sala sem partida libera a conta.');
  await api('admin/accounts/clear-matches', { username: user.username });
  assert.equal((await ack(returning, 'join-matchmaking', payload)).ok, true, 'Limpeza também remove a busca anterior.');
  await ack(two, 'join-matchmaking', { accountToken: opponent.token });
  assert.ok((await ack(returning, 'find-active-match', payload)).room);
  returning.disconnect();
  assert.equal((await api('admin/accounts/clear-matches', { username: user.username })).body.count, 1, 'Libera também jogador desconectado de duelo ativo.');
  const session = await fetch(url + '/api/auth/session', { headers: { Authorization: `Bearer ${user.token}` } });
  const account = await session.json();
  assert.equal(account.currency, 500); assert.equal(account.rankedGames, 0, 'Recuperação não registra derrota nem recompensa.');
  assert.equal((await ack(two, 'join-matchmaking', { accountToken: opponent.token })).ok, true);
  await ack(two, 'cancel-matchmaking');
  const arena = await ack(display, 'create-presentation', { table: 1 });
  assert.equal(arena.ok, true);
  assert.equal((await ack(two, 'clear-presentation', { displayKey: arena.displayKey })).ok, false);
  assert.equal((await ack(display, 'clear-presentation', { displayKey: 'wrong' })).ok, false);
  assert.equal((await ack(display, 'clear-presentation', { displayKey: arena.displayKey })).ok, true);
  assert.equal((await ack(display, 'create-presentation', { table: 1 })).ok, true, 'A mesa pode abrir de novo após ser limpa.');
  const context = vm.createContext({ window: { cyberduelAccount: {
    user: admin.username, isAdmin: true,
    async request(route, options) {
      const result = await api(route.replace('/api/', ''), options.body);
      if (!result.body.ok) throw Error(result.body.error);
      return result.body;
    },
  } } });
  vm.runInContext(fs.readFileSync('js/debug.js', 'utf8'), context);
  const commands = context.window;
  await assert.rejects(commands.limparSala('123'), /123456/);
  await assert.rejects(commands.removerContaDasPartidas(''), /username/);
  const consoleRoom = await ack(two, 'create-room', { accountToken: user.token });
  assert.match(await commands.limparSala(consoleRoom.room.code), /liberada/);
  await ack(two, 'create-room', { accountToken: user.token });
  assert.match(await commands.removerContaDasPartidas(user.username), /1 sala/);
  commands.cyberduelAccount.isAdmin = false;
  await assert.rejects(commands.limparSala('123456'), /administradora/);
  console.log('Recuperação: autorização, salas múltiplas, desconexão, fila, duelo ativo, estatísticas e controle da apresentação validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  sockets.forEach(socket => socket.disconnect());
  const ended = once(server, 'exit'); server.kill(); await ended;
  fs.rmSync(directory, { recursive: true, force: true });
});
