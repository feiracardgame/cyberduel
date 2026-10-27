const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map(), actions = [];
const context = vm.createContext({
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  window: { cyberduelServerUrl: () => 'http://localhost',
    cyberduelNameGuard: { sync() {}, close() {}, showBan(reason) { actions.push(['warning', reason]); } },
    cyberduelMultiplayer: { leaveRoom(notify) { assert.equal(notify, false); actions.push(['leave']); },
      socket: { emit(...args) { actions.push(args); } } },
  },
  game: { scene: { isActive: key => key === 'CenaJogo', getScenes: () => [{ scene: { key: 'CenaJogo' } }, { scene: { key: 'CenaEfeitos' } }],
    stop(key) { actions.push(['stop', key]); }, start(key) { actions.push(['start', key]); } } },
});
vm.runInContext(fs.readFileSync('js/account.js', 'utf8'), context);
const account = context.window.cyberduelAccount;
(async () => {
  account.applyAuth({ username: 'GestorQA', token: 'token', isAdmin: true });
  assert.equal(actions[0][0], 'identify-account');
  actions.length = 0;
  account.applyAuth({ username: 'GestorQA', isAdmin: true }, false);
  assert.equal(actions.length, 0, 'Poll da sessão não envia identificação repetida.');
  account.applyAuth({ username: 'GestorQA', token: 'token', isAdmin: true });
  assert.equal(actions[0][0], 'identify-account', 'Novo login atualiza a identidade mesmo com o mesmo username.');
  actions.length = 0;
  context.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost/api/admin/accounts/ban');
    assert.deepEqual(JSON.parse(options.body), { username: 'DuelistaQA', reason: 'Teste' });
    assert.equal(options.headers.Authorization, 'Bearer token');
    return { ok: true, json: async () => ({ username: 'DuelistaQA', banned: true }) };
  };
  assert.equal((await account.banAccount('DuelistaQA', 'Teste')).banned, true);
  context.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost/api/admin/accounts/unban');
    assert.deepEqual(JSON.parse(options.body), { username: 'DuelistaQA' });
    return { ok: true, json: async () => ({ username: 'DuelistaQA', banned: false }) };
  };
  assert.equal((await account.unbanAccount('DuelistaQA')).banned, false);
  context.fetch = async () => ({ ok: false, json: async () => ({ code: 'ACCOUNT_BANNED', error: 'Esta conta está banida.', reason: '<b>Teste</b>' }) });
  await assert.rejects(account.request('/api/auth/session'), error => error.code === 'ACCOUNT_BANNED');
  assert.equal(account.user, null); assert.equal(account.token, null);
  assert.equal(storage.has(account.storageKey), false);
  assert.deepEqual(actions, [['leave'], ['stop', 'CenaJogo'], ['stop', 'CenaEfeitos'], ['start', 'CenaTitulo'], ['warning', '<b>Teste</b>']]);
  console.log('Cliente: comandos autenticados, identificação sem repetição, saída silenciosa, encerramento do duelo e aviso de banimento validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
