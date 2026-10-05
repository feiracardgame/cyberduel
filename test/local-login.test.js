const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-local-login-'));
const [google] = require('./account-fixture')(directory, ['local_reserved']);
const base = 'http://127.0.0.1:32043';
let server;
async function start(mode) {
  server = spawn(process.execPath, [mode === 'dev' ? 'scripts/dev-server.js' : 'server/server.js'], {
    env: { ...process.env, PORT: '32043', DATA_DIR: directory, GOOGLE_CLIENT_ID: '',
      CYBERDUEL_LOCAL_LOGIN: mode === 'flag-only' ? '1' : '0', CYBERDUEL_DEBUG: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('ouvindo')) { clearTimeout(timeout); resolve(); } });
  });
}
async function stop() { const ended = once(server, 'exit'); server.kill(); await ended; server = null; }
async function api(route, body, token, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = require('node:http').request(base + '/api/' + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
    });
    request.on('error', reject);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
(async () => {
  for (const mode of ['normal', 'flag-only']) {
    await start(mode);
    assert.equal((await api('auth/options')).body.localLogin, false);
    assert.equal((await api('auth/local', { username: 'dev' })).status, 403);
    await stop();
  }
  await start('dev');
  assert.equal((await api('auth/options')).body.localLogin, true);
  assert.equal((await api('auth/local', { username: 'dev' }, null, { Origin: 'https://external.example' })).status, 403);
  assert.equal((await api('auth/local', { username: 'dev' }, null, { Host: 'external.example' })).status, 403);
  assert.equal((await api('auth/local', { username: 'dev' }, null, { Origin: 'ftp://localhost' })).status, 403);
  for (const username of ['', 'a', '<script>', 'x'.repeat(19)])
    assert.equal((await api('auth/local', { username })).status, 400);
  assert.equal((await api('auth/local', { username: 'reserved' })).status, 409, 'Não vincular nem sobrescrever conta Google.');
  const login = await api('auth/local', { username: 'Dante' });
  assert.equal(login.status, 200);
  assert.equal(login.body.authProvider, 'local');
  assert.equal(login.body.isAdmin, true);
  assert.equal(login.body.username, 'local_Dante');
  assert.equal(login.body.needsRegistration, false);
  const token = login.body.token;
  assert.equal((await api('auth/session', undefined, token)).body.authProvider, 'local');
  const faction = await api('account/faction', { faction: 'echossystem' }, token);
  assert.equal(faction.status, 200); assert.ok(faction.body.deck.length);
  const again = await api('auth/local', { username: 'dante' });
  assert.equal(again.body.username, login.body.username);
  assert.equal(again.body.faction, 'echossystem');
  await stop();
  await start('dev');
  assert.equal((await api('auth/session', undefined, token)).status, 200, 'Sessão local persiste no desenvolvimento.');
  await stop();
  await start('normal');
  assert.equal((await api('auth/session', undefined, token)).status, 401, 'Sessão local é recusada fora do modo dev.');
  assert.equal((await api('auth/session', undefined, google.token)).status, 200, 'Conta Google preservada.');
  assert.equal((await api('auth/local', { username: 'Dante' })).status, 403);
  console.log('Acesso local: opt-in dev, origem/host, validação, colisão Google, admin, deck, persistência e bloqueio em produção aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (server) await stop(); });
