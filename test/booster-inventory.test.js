const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booster-inventory-'));
const port = 31990;
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, CYBERDUEL_DEBUG: '1', BOOSTER_WEIGHT_LENDARIA: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
}
async function stop() { const exited = once(server, 'exit'); server.kill(); await exited; server = null; }
let token;
async function api(route, body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
(async () => {
  await start();
  const credentials = { username: 'Inventario', password: 'teste-inventario-123' };
  token = (await api('auth/register', credentials)).body.token;
  const initial = (await api('account/faction', { faction: 'raspcorp' })).body;
  assert.deepEqual(initial.boosters, []);
  const purchase = { faction: 'raspcorp', purchaseId: 'purchase-inventory-0001' };
  const responses = await Promise.all([api('boosters/buy', purchase), api('boosters/buy', purchase)]);
  for (const { status, body } of responses) {
    assert.equal(status, 200);
    assert.equal(body.currency, 400);
    assert.equal(body.boosters.length, 1);
    assert.equal(body.boosters[0].cards, undefined);
    assert.equal(body.cards, undefined);
    assert.deepEqual(body.collection, initial.collection);
  }
  await stop();
  await start();
  const restored = await api('auth/login', credentials);
  token = restored.body.token;
  assert.equal(restored.body.boosters.length, 1);
  assert.deepEqual(restored.body.collection, initial.collection);
  // Outro usuário não pode consumir o pacote.
  const ownerToken = token;
  token = (await api('auth/register', { username: 'OutroInventario', password: 'teste-inventario-123' })).body.token;
  await api('account/faction', { faction: 'raspcorp' });
  assert.equal((await api('boosters/open', { packId: purchase.purchaseId })).status, 404);
  token = ownerToken;
  const opened = await Promise.all([api('boosters/open', { packId: purchase.purchaseId, debugLegendary: true }), api('boosters/open', { packId: purchase.purchaseId, debugLegendary: true })]);
  assert.deepEqual(opened[0], opened[1]);
  const result = opened[0].body;
  assert.equal(result.currency, 400);
  assert.equal(result.boosters.length, 0);
  assert.equal(result.cards.length, 5);
  assert.ok(result.cards.some(card => card.nivel === 'lendaria'));
  const count = collection => Object.values(collection).reduce((a, b) => a + b, 0);
  assert.equal(count(result.collection), count(initial.collection) + 5);
  const duplicatePurchase = await api('boosters/buy', purchase);
  assert.equal(duplicatePurchase.body.currency, 400);
  assert.equal(duplicatePurchase.body.boosters.length, 0);
  const ordinary = await api('boosters/buy', { faction: 'raspcorp', purchaseId: 'purchase-inventory-0002' });
  const normal = await api('boosters/open', { packId: ordinary.body.boosters[0].id });
  assert.ok(normal.body.cards.every(card => card.nivel !== 'lendaria'));
  await stop();
  // Contas antigas continuam válidas sem campo boosters; saldo e coleção preservados.
  const file = path.join(dir, 'accounts.json');
  const stored = JSON.parse(fs.readFileSync(file));
  for (const account of Object.values(stored.accounts)) delete account.boosters;
  fs.writeFileSync(file, JSON.stringify(stored));
  await start();
  const migrated = await api('auth/login', credentials);
  assert.deepEqual(migrated.body.boosters, []);
  assert.equal(migrated.body.currency, normal.body.currency);
  assert.deepEqual(migrated.body.collection, normal.body.collection);
  console.log('Inventário: compra sem cartas, persistência, isolamento, retries concorrentes, abertura única, lendária e contas antigas validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
