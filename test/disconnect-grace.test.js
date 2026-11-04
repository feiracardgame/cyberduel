const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-disconnect-'));
const users = require('./account-fixture')(dataDir, ['ReconnectOne', 'ReconnectTwo']);
const base = 'http://127.0.0.1:32149';
const sockets = [];
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '32149', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'],
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ack = (socket, event, payload = {}) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result));
});
function event(socket, name, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(Error(`Evento ausente: ${name}`)); }, timeout);
    const listener = value => {
      if (!predicate(value)) return;
      clearTimeout(timer); socket.off(name, listener); resolve(value);
    };
    socket.on(name, listener);
  });
}
async function connect() {
  const socket = io(base, { transports: ['websocket'], forceNew: true });
  sockets.push(socket); await event(socket, 'connect'); return socket;
}
async function profile(user, faction = false) {
  const response = await fetch(base + (faction ? '/api/account/faction' : '/api/auth/session'), {
    method: faction ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    ...(faction ? { body: JSON.stringify({ faction: 'echossystem' }) } : {}),
  });
  assert.equal(response.status, 200); return response.json();
}

(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  for (const user of users) await profile(user, true);
  let one = await connect(), two = await connect();
  const firstReady = event(one, 'match-ready'), secondReady = event(two, 'match-ready');
  for (const [socket, user] of [[one, users[0]], [two, users[1]]])
    assert.equal((await ack(socket, 'join-matchmaking', { accountToken: user.token })).ok, true);
  const [first, second] = await Promise.all([firstReady, secondReady]);

  let offline = event(two, 'opponent-offline');
  one.disconnect();
  assert.equal((await offline).remainingMs, 40000);
  await sleep(1200);
  one = await connect();
  const resumed = await ack(one, 'resume-match', { accountToken: users[0].token });
  assert.equal(resumed.ok, true);
  assert.ok(resumed.reconnectRemainingMs <= 38800 && resumed.reconnectRemainingMs > 37000);

  offline = event(one, 'opponent-offline');
  two.disconnect();
  assert.equal((await offline).remainingMs, 40000, 'O saldo do outro jogador é independente.');
  await sleep(300);
  two = await connect();
  const resumedTwo = await ack(two, 'resume-match', { resumeToken: second.resumeToken });
  assert.ok(resumedTwo.reconnectRemainingMs < 40000);
  await sleep(600);

  offline = event(two, 'opponent-offline');
  one.disconnect();
  assert.equal((await offline).remainingMs, resumed.reconnectRemainingMs, 'Tempo conectado não consome nem renova o saldo.');
  await sleep(1200);
  one = await connect();
  const again = await ack(one, 'resume-match', { resumeToken: first.resumeToken });
  assert.equal(again.ok, true);
  assert.ok(again.reconnectRemainingMs < resumed.reconnectRemainingMs - 1100);

  offline = event(two, 'opponent-offline');
  const ended = event(two, 'state-update', update => update.state.partidaEncerrada, 45000);
  one.disconnect();
  const remaining = (await offline).remainingMs;
  const started = Date.now();
  const result = await ended;
  assert.ok(Date.now() - started >= remaining - 150, 'Não encerra antes de gastar os 40 segundos acumulados.');
  assert.ok(Date.now() - started < remaining + 1500, 'Reconectar não reinicia os 40 segundos.');
  assert.equal(result.result.resultadoCombate.resultado, first.player === 1 ? 'inimigo' : 'jogador');
  assert.equal(result.deadline, null);
  one = await connect();
  assert.equal((await ack(one, 'resume-match', { resumeToken: first.resumeToken })).ok, false);
  assert.equal((await ack(one, 'find-active-match', { accountToken: users[0].token })).room, null);
  const loser = await profile(users[0]), winner = await profile(users[1]);
  assert.equal(loser.rankedLosses, 1); assert.equal(winner.rankedWins, 1);
  assert.equal(loser.rating, 984); assert.equal(winner.rating, 1016);
  assert.equal(loser.currency, 510); assert.equal(winner.currency, 520);
  two.emit('surrender');
  await ack(two, 'find-active-match', { accountToken: users[1].token });
  assert.equal((await profile(users[1])).currency, winner.currency, 'Resultado e recompensa são aplicados só uma vez.');
  console.log('Reconexão: 40 segundos acumulados, saldo individual, retorno por conta/token, derrota e recompensa validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  sockets.forEach(socket => socket.disconnect());
  const ended = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await ended;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
