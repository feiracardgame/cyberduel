const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-profile-'));
const port = 31992;
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
}
async function stop() { const ended = once(server, 'exit'); server.kill(); await ended; server = null; }
let token;
async function api(route, body, method = 'POST') {
  const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
const avatar = 'assets/fotosdeperfil/advogado_icon.png';
(async () => {
  await start();
  assert.equal((await api('account/profile', { nickname: 'Teste', avatar: '' }, 'PUT')).status, 401);
  const credentials = { username: 'PerfilUnico', password: 'senha-perfil-123' };
  const registered = await api('auth/register', credentials);
  token = registered.body.token;
  assert.equal(registered.body.nickname, credentials.username);
  assert.equal(registered.body.avatar, '');
  assert.deepEqual(registered.body.profilePhotos, fs.readdirSync('assets/fotosdeperfil')
    .filter(name => name.endsWith('_icon.png')).map(name => `assets/fotosdeperfil/${name}`).sort());
  for (const photo of registered.body.profilePhotos) {
    assert.equal((await api('account/profile', { nickname: 'Teste', avatar: photo }, 'PUT')).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/${photo}`)).status, 200);
  }
  const saved = await api('account/profile', { nickname: '  Six Seven  ', avatar, username: 'nao-mudar' }, 'PUT');
  assert.equal(saved.status, 200);
  assert.equal(saved.body.nickname, 'Six Seven');
  assert.equal(saved.body.username, 'PerfilUnico');
  assert.equal(saved.body.avatar, avatar);
  assert.equal(saved.body.currency, registered.body.currency);
  for (const body of [
    { nickname: '', avatar: '' }, { nickname: 'x'.repeat(33), avatar: '' },
    { nickname: 'A\nB', avatar: '' }, { nickname: 'Teste', avatar: 'https://example.com/a.jpg' },
    { nickname: 'Teste', avatar: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { nickname: 'Teste', avatar: 'data:image/jpeg;base64,/9j/2Q==' },
    { nickname: 'Teste', avatar: 'assets/fotosdeperfil/inexistente_icon.png' },
    { nickname: 'Teste', avatar: 'assets/fotosdeperfil/../cartas/Anarcoboi.png' },
    { nickname: 'Teste', avatar: null },
    { nickname: 'Teste', avatar: 'x'.repeat(48001) },
  ]) assert.equal((await api('account/profile', body, 'PUT')).status, 400);
  const firstToken = token;
  token = (await api('auth/register', { username: 'PerfilOutro', password: credentials.password })).body.token;
  assert.equal((await api('account/profile', { nickname: 'Six Seven', avatar: '' }, 'PUT')).status, 200, 'Apelidos podem repetir');
  assert.equal((await api('account/faction', { faction: 'echossystem' })).body.avatar, 'assets/fotosdeperfil/boi_icon.png');
  token = firstToken;
  assert.equal((await api('auth/session', undefined, 'GET')).body.avatar, avatar);
  await stop(); await start();
  const login = await api('auth/login', credentials);
  token = login.body.token;
  assert.equal(login.body.nickname, 'Six Seven');
  assert.equal(login.body.avatar, avatar);
  assert.equal((await api('account/profile', { nickname: 'Six Seven', avatar: '' }, 'PUT')).body.avatar, '');
  assert.equal((await api('account/faction', { faction: 'raspcorp' })).body.avatar, 'assets/fotosdeperfil/raspclay_icon.png');
  assert.equal((await api('account/profile', { nickname: 'Six Seven', avatar }, 'PUT')).body.avatar, avatar);
  assert.equal((await api('account/faction', { faction: 'echossystem' })).status, 409);
  assert.equal((await api('auth/session', undefined, 'GET')).body.avatar, avatar);
  await stop();
  const file = path.join(dir, 'accounts.json');
  const store = JSON.parse(fs.readFileSync(file));
  for (const account of Object.values(store.accounts)) { delete account.nickname; account.avatar = 'data:image/jpeg;base64,/9j/2Q=='; }
  fs.writeFileSync(file, JSON.stringify(store));
  await start();
  const legacy = await api('auth/login', credentials);
  assert.equal(legacy.body.nickname, credentials.username);
  assert.equal(legacy.body.avatar, 'assets/fotosdeperfil/raspclay_icon.png');
  assert.equal((await api('auth/login', { username: 'PerfilOutro', password: credentials.password })).body.avatar, 'assets/fotosdeperfil/boi_icon.png');
  const context = vm.createContext({ window: {}, localStorage: { getItem: () => null, removeItem() {} } });
  vm.runInContext(fs.readFileSync('js/account.js', 'utf8'), context);
  const account = context.window.cyberduelAccount;
  account.request = async (route, options) => {
    assert.equal(route, '/api/account/profile');
    assert.equal(options.method, 'PUT');
    return saved.body;
  };
  await account.updateProfile('Six Seven', avatar);
  assert.equal(account.user, 'PerfilUnico');
  assert.equal(account.snapshot().nickname, 'Six Seven');
  assert.equal(account.profilePhotos.length, registered.body.profilePhotos.length);
  account.clear();
  assert.equal(account.nickname, ''); assert.equal(account.avatar, '');
  console.log('Perfil: autenticação, apelido independente, foto, validações, persistência, remoção, contas antigas e cliente validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await stop(); fs.rmSync(dir, { recursive: true, force: true });
});
