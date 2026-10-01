const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
async function serverProof(debug, admin = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legendary-debug-'));
  const [{ token }] = require('./account-fixture')(dir, ['TesteLenda']);
  const port = 31989;
  const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, CYBERDUEL_DEBUG: debug ? '1' : '0', ADMIN_USERNAMES: admin ? 'TesteLenda' : '', BOOSTER_WEIGHT_LENDARIA: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 5000);
      server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    });
    const post = async (route, body) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      return { status: res.status, body: await res.json() };
    };
    await post('account/faction', { faction: 'raspcorp' });
    const pack = await post('boosters/open', { faction: 'raspcorp', debugLegendary: true });
    assert.equal(pack.status, debug && admin ? 200 : 403);
    if (debug && admin) {
      assert.equal(pack.body.cards.length, 5);
      assert.ok(pack.body.cards.some(c => c.nivel === 'lendaria'));
      assert.equal(pack.body.currency, 400);
      assert.equal(pack.body.gamesPlayed, 0);
    }
    const normal = await post('boosters/open', { faction: 'raspcorp' });
    assert.equal(normal.status, 200);
    assert.ok(normal.body.cards.every(c => c.nivel !== 'lendaria'));
    assert.equal(normal.body.currency, debug && admin ? 300 : 400);
    const purchase = await post('boosters/buy', { faction: 'raspcorp', purchaseId: 'debug-existing-pack-0001' });
    const packId = purchase.body.boosters[0].id;
    const stored = await post('boosters/open', { packId, debugLegendary: true });
    assert.equal(stored.status, debug && admin ? 200 : 403);
    const replay = await post('boosters/open', { packId });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.currency, debug && admin ? 200 : 300);
    assert.equal(replay.body.cards.some(c => c.nivel === 'lendaria'), debug && admin);
    if (debug && admin) assert.deepEqual(replay.body.cards, stored.body.cards);

  } finally {
    const exited = once(server, 'exit'); server.kill(); await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
(async () => {
  const context = vm.createContext({ crypto: require("node:crypto").webcrypto, window: {}, localStorage: { getItem: () => null } });
  for (const file of ['js/account.js', 'js/debug.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const account = context.window.cyberduelAccount;
  assert.throws(() => context.window.garantelendaria(), /Entre/);
  account.user = 'Teste';
  assert.throws(() => context.window.garantelendaria(), /administradora/);
  account.isAdmin = true;
  context.window.garantelendaria();
  account.request = async (route, options) => {
    assert.equal(route, '/api/boosters/buy');
    assert.equal(options.body.debugLegendary, undefined);
    return { username: 'Teste', boosters: [{ id: 'pacote-guardado', faction: 'raspcorp' }] };
  };
  await account.buyBooster('raspcorp');
  assert.equal(account.debugLegendaryUser, 'Teste', 'Comprar não consome a garantia de abertura.');

  account.request = async () => { throw new Error('Falha'); };
  await assert.rejects(account.openBooster('pacote-guardado'), /Falha/);
  assert.equal(account.debugLegendaryUser, 'Teste');
  let expected = true;
  account.request = async (_, options) => {
    assert.equal(options.body.debugLegendary, expected);
    return { username: 'Teste', cards: [] };
  };
  await account.openBooster('pacote-guardado');
  expected = undefined;
  await account.openBooster('pacote-guardado');
  await serverProof(false);
  await serverProof(true);
  await serverProof(true, false);
  console.log('Garantia lendária: login, falha, uso único, servidor protegido, cinco cartas, cobrança e sorteio normal validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
