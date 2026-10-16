const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-name-enforcement-'));
const users = require('./account-fixture')(directory, ['Epstein123', 'NomeLimpo', 'P_Diddy', 'OutroDuelista', 'local_EpsteinQA', 'GestorQA']);
const file = path.join(directory, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
store.accounts[users[0].accountKey].nickname = 'Apelido Limpo';
store.accounts[users[1].accountKey].nickname = 'εpstein';
Object.assign(store.accounts[users[2].accountKey], {
  nickname: 'Jeffrey Epstein', currency: 765, rating: 1320,
  collection: { 'monstro:O Rato': 3 }, tutorial: { introSeen: true, named: true },
});
delete store.accounts[users[4].accountKey].googleSub;
Object.assign(store.accounts[users[4].accountKey], { localAccount: true, nickname: 'P. Diddy', currency: 934 });
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:32046';
const server = spawn(process.execPath, ['scripts/dev-server.js'], {
  windowsHide: true, env: { ...process.env, PORT: '32046', DATA_DIR: directory, ADMIN_USERNAMES: 'GestorQA' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const sockets = [];
async function api(route, user, body, method = body ? 'PUT' : 'GET') {
  const response = await fetch(base + '/api/' + route, {
    method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
async function socketFor() {
  const socket = io(base, { transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
const emit = (socket, event, payload) => new Promise((resolve, reject) => socket.timeout(3000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result)));
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  const expected = [{ username: true, nickname: false }, { username: false, nickname: true }, { username: true, nickname: true }];
  for (const [index, user] of users.slice(0, 3).entries()) {
    assert.deepEqual((await api('auth/session', user)).body.nameRestriction, expected[index]);
    const blocked = await api('account/match-start', user, { mode: 'solo' }, 'POST');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'NAME_NOT_ALLOWED');
    const socket = await socketFor();
    const announced = new Promise(resolve => socket.once('name-restricted', resolve));
    assert.equal((await emit(socket, 'create-room', { accountToken: user.token })).code, 'NAME_NOT_ALLOWED');
    assert.deepEqual((await announced).nameRestriction, expected[index]);
  }
  const badAgain = await api('account/profile', users[2], { username: 'PuffDaddy', nickname: 'Sean Combs' });
  assert.equal(badAgain.status, 400);
  assert.equal(badAgain.body.code, 'NAME_NOT_ALLOWED');
  for (const nickname of ['εpstein', 'ɛpstein', 'ᴇᴘꜱᴛᴇɪɴ', '𝖊𝖕𝖘𝖙𝖊𝖎𝖓',
    '🅴🅿🆂🆃🅴🅸🅽', 'zzɛpsteinyy', 'ᴅɪᴅᴅʏ']) {
    const rejected = await api('account/profile', users[3], { nickname });
    assert.equal(rejected.status, 400, nickname);
    assert.equal(rejected.body.code, 'NAME_NOT_ALLOWED');
    assert.deepEqual(rejected.body.nameRestriction, { username: false, nickname: true });
  }
  assert.equal((await api('auth/session', users[3])).body.nickname, users[3].username, 'Fontes proibidas não são persistidas.');
  assert.equal((await api('account/profile', users[2], { username: 'OutroDuelista', nickname: 'Novo Apelido' })).status, 409);
  assert.equal((await api('account/profile', users[2], { nickname: 'Novo Apelido' })).status, 400, 'Não corrige apenas metade.');
  assert.equal((await api('account/profile', users[0], { username: 'NickCorrigido' })).status, 200);
  assert.equal((await api('account/profile', users[1], { nickname: 'Apelido Corrigido' })).status, 200);
  const fixed = await api('account/profile', users[2], { username: 'DuelistaCorrigido', nickname: 'Nome Novo' });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.nameRestriction, null);
  assert.equal(fixed.body.currency, 765);
  assert.equal(fixed.body.rating, 1320);
  assert.equal(fixed.body.collection['monstro:O Rato'], 3);
  assert.equal(fixed.body.tutorial.introSeen, true);
  assert.equal((await api('auth/session', users[2])).body.username, 'DuelistaCorrigido', 'Token antigo preservado.');
  assert.equal((await api('account/profile', users[2], { username: 'OutraTroca', nickname: 'Nome Novo' })).body.username, 'DuelistaCorrigido', 'Nick válido não pode ser renomeado livremente.');
  assert.equal((await api('account/faction', users[2], { faction: 'echossystem' }, 'POST')).status, 200);
  const room = await emit(sockets[2], 'create-room', { accountToken: users[2].token });
  assert.equal(room.ok, true, 'Multiplayer liberado após a correção.');
  const saved = JSON.parse(fs.readFileSync(file));
  assert.equal(saved.accounts[users[2].accountKey].username, 'DuelistaCorrigido', 'Chave estável da conta.');
  const oldLocal = await api('auth/local', users[4], { username: 'EpsteinQA' }, 'POST');
  assert.equal(oldLocal.status, 200, 'Conta local existente entra para corrigir, sem perder progresso.');
  assert.deepEqual(oldLocal.body.nameRestriction, { username: true, nickname: true });
  const localFixed = await api('account/profile', users[4], { username: 'LocalCorrigido', nickname: 'Novo Local' });
  assert.equal(localFixed.body.username, 'local_LocalCorrigido');
  const localAgain = await api('auth/local', users[4], { username: 'LocalCorrigido' }, 'POST');
  assert.equal(localAgain.status, 200);
  assert.equal(localAgain.body.currency, 934, 'Novo login mantém a mesma conta local após renomear.');
  const target = users[3], admin = users[5];
  const route = 'admin/accounts/require-name-change';
  assert.equal((await api(route, { token: '' }, { username: target.username }, 'POST')).status, 401);
  assert.equal((await api(route, target, { username: users[0].username }, 'POST')).status, 403, 'Usuário comum não exige troca de terceiros.');
  assert.equal((await api(route, admin, { username: '' }, 'POST')).status, 400);
  assert.equal((await api(route, admin, { username: 'ContaInexistente' }, 'POST')).status, 404);
  const targetSocket = await socketFor();
  await emit(targetSocket, 'find-active-match', { accountToken: target.token });
  const warning = new Promise(resolve => targetSocket.once('name-restricted', resolve));
  assert.equal((await api(route, admin, { username: '  outroduelista  ' }, 'POST')).status, 200);
  assert.deepEqual((await warning).nameRestriction, { username: false, nickname: true }, 'Aviso direcionado ao socket da conta.');
  assert.equal(JSON.parse(fs.readFileSync(file)).accounts[target.accountKey].nameChangeRequired, true, 'Moderação persistida para contas offline.');
  assert.equal((await api('auth/session', target)).body.nameRestriction.nickname, true);
  assert.equal((await api('auth/session', users[0])).body.nameRestriction, null, 'Outras contas preservadas.');
  assert.equal((await api('account/match-start', target, { mode: 'solo' }, 'POST')).status, 403);
  assert.equal((await api('account/profile', target, { nickname: target.username })).status, 400, 'O mesmo nome não remove a exigência.');
  assert.equal((await api('account/profile', target, { nickname: 'PuffDaddy' })).status, 400);
  const moderated = await api('account/profile', target, { nickname: 'Apelido Regularizado' });
  assert.equal(moderated.status, 200);
  assert.equal(moderated.body.nameRestriction, null);
  assert.equal(JSON.parse(fs.readFileSync(file)).accounts[target.accountKey].nameChangeRequired, undefined);
  assert.equal((await emit(targetSocket, 'create-room', { accountToken: target.token })).ok, true);
  console.log('Nomes censurados: contas antigas, API, sockets, correção, colisão, persistência e progresso preservado aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  for (const socket of sockets) socket.close();
  server.kill();
});
