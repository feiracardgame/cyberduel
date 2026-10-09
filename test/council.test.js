const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');
const council = require('../server/council');

const presentationLocation = fs.readFileSync('nginx.conf', 'utf8').match(/location ~ (\^\/apresenta\S+) \{/);
assert.ok(presentationLocation, 'Nginx encaminha as apresentações numeradas ao backend.');
const presentationRoute = new RegExp(presentationLocation[1]);
for (const route of ['/apresentacao5', '/apresentacao5/', '/apresentação5', '/apresentação5/'])
  assert.ok(presentationRoute.test(route), `Nginx precisa encaminhar ${route}.`);
assert.equal(presentationRoute.test('/apresentacao6'), false);

const room = { presentationHost: 'screen', players: new Map() };
assert.equal(council.reserve(room, 'one', 3, 0), null);
assert.equal(council.reserve(room, 'one', 1, 0).expiresAt, 60_000);
assert.equal(council.reserve(room, 'one', 1, 1000).expiresAt, 60_000, 'Repetir não prolonga a reserva.');
assert.equal(council.reserve(room, 'two', 1, 59_999), null);
assert.equal(council.expire(room, 59_999), false);
assert.equal(council.expire(room, 60_000), true);
assert.ok(council.reserve(room, 'two', 1, 60_000));
assert.ok(council.reserve(room, 'two', 2, 60_001));
assert.equal(room.reservations.has(1), false, 'Uma conta reserva um único canto.');
room.players.set(1, 'player');
assert.equal(council.reserve(room, 'one', 1, 60_001), null);
room.state = {};
assert.equal(council.reserve(room, 'one', 2, 120_001), null);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-council-'));
const fixtures = require('./account-fixture')(directory, Array.from({ length: 12 }, (_, i) => `Council${String(i).padStart(2, '0')}`));
const file = path.join(directory, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const [i, fixture] of fixtures.entries()) Object.assign(store.accounts[fixture.accountKey], {
  rating: 2000 - i * 10, humanGames: 5, humanWins: 3, rankedGames: 5, rankedWins: 3, councilReached: true,
});
fs.writeFileSync(file, JSON.stringify(store));
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '31983', DATA_DIR: directory }, stdio: ['ignore', 'pipe', 'inherit'],
});
const url = 'http://127.0.0.1:31983', sockets = [];
const ack = (socket, event, payload = {}) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result));
});
async function connect() {
  const socket = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
async function run() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('ouvindo')) { clearTimeout(timeout); resolve(); } });
  });
  assert.equal((await fetch(url + '/apresentacao5')).status, 200);
  for (const fixture of [fixtures[0], fixtures[1], fixtures[10]]) {
    const headers = { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' };
    const response = await fetch(url + '/api/account/faction', { method: 'POST', headers, body: JSON.stringify({ faction: 'echossystem' }) });
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.councilMember, fixture !== fixtures[10]);
    assert.equal(profile.councilReached, true, 'Histórico não concede acesso fora do top 10.');
  }
  const [screen, one, two, outsider, otherTab] = await Promise.all(Array.from({ length: 5 }, connect));
  const presentation = await ack(screen, 'create-presentation', { table: 5 });
  assert.equal(presentation.ok, true);
  const code = presentation.room.code;
  const first = { accountToken: fixtures[0].token, seat: 1 };
  const second = { accountToken: fixtures[1].token, seat: 2 };
  assert.equal((await ack(outsider, 'reserve-council-seat', { accountToken: fixtures[10].token, seat: 1 })).ok, false);
  assert.equal((await ack(one, 'join-room', { ...first, code, table: 5 })).ok, false, 'Exige reserva mesmo com o código correto.');
  const reserved = await ack(one, 'reserve-council-seat', first);
  assert.equal(reserved.ok, true);
  assert.ok(reserved.expiresAt - reserved.serverNow <= 60_000);
  assert.equal((await ack(otherTab, 'reserve-council-seat', first)).expiresAt, reserved.expiresAt);
  assert.equal((await ack(two, 'reserve-council-seat', { ...second, seat: 1 })).ok, false);
  const state = await ack(two, 'watch-club-tables');
  assert.equal(state.tables.length, 4);
  assert.equal(state.council.reservations[0].seat, 1);
  assert.equal(state.council.reservations[0].owner, undefined);
  assert.equal((await ack(two, 'join-room', { ...second, code, table: 5, seat: 1 })).ok, false);
  assert.equal((await ack(one, 'join-room', { ...first, code, table: 5 })).waiting, true);
  assert.equal((await ack(two, 'reserve-council-seat', second)).ok, true);
  assert.equal((await ack(two, 'join-room', { ...second, code, table: 5 })).ok, true);
  assert.equal((await ack(outsider, 'watch-club-tables')).council.locked, true);
  assert.equal((await ack(otherTab, 'reserve-council-seat', first)).ok, false);
  console.log('Conselho: top 10 atual, reserva exclusiva, prazo de 60s e partida validados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  sockets.forEach(socket => socket.disconnect()); server.kill();
  server.once('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
});
