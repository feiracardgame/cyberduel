const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booster-inventory-'));
const [owner, other] = require('./account-fixture')(dir, ['Inventario', 'OutroInventario']);
const accountFile = path.join(dir, 'accounts.json');
const fixtures = JSON.parse(fs.readFileSync(accountFile));
fixtures.accounts[other.accountKey].currency = 0;
fs.writeFileSync(accountFile, JSON.stringify(fixtures));
const port = 31990;
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, CYBERDUEL_DEBUG: '1', ADMIN_USERNAMES: 'Inventario', BOOSTER_WEIGHT_LENDARIA: '0' }, stdio: ['ignore', 'pipe', 'inherit'] });
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
  token = owner.token;
  const initial = (await api('account/faction', { faction: 'raspcorp' })).body;
  assert.deepEqual(initial.boosters, []);
  const purchase = { faction: 'raspcorp', purchaseId: 'purchase-inventory-0001' };
  const responses = await Promise.all([api('boosters/buy', purchase), api('boosters/buy', purchase)]);
  for (const { status, body } of responses) {
    assert.equal(status, 200);
    assert.equal(body.currency, 450);
    assert.equal(body.boosters.length, 1);
    assert.equal(body.boosters[0].cards, undefined);
    assert.equal(body.cards, undefined);
    assert.deepEqual(body.collection, initial.collection);
  }
  const stats = async () => (await api('admin/accounts')).body.accounts.find(account => account.username === owner.username);
  assert.equal((await stats()).currencySpent, 50, 'Compra repetida só registra um gasto.');
  await stop();
  await start();
  const restored = await api('auth/session');
  assert.equal(restored.body.boosters.length, 1);
  assert.deepEqual(restored.body.collection, initial.collection);
  assert.equal((await stats()).currencySpent, 50, 'Gasto persiste no reinício.');
  // Outro usuário não pode consumir o pacote.
  const ownerToken = token;
  token = other.token;
  await api('account/faction', { faction: 'raspcorp' });
  assert.equal((await api('boosters/open', { packId: purchase.purchaseId })).status, 404);
  token = ownerToken;
  const opened = await Promise.all([api('boosters/open', { packId: purchase.purchaseId, debugLegendary: true }), api('boosters/open', { packId: purchase.purchaseId, debugLegendary: true })]);
  assert.deepEqual(opened[0], opened[1]);
  const result = opened[0].body;
  assert.equal(result.currency, 450);
  assert.equal(result.boosters.length, 0);
  assert.equal(result.cards.length, 5);
  assert.ok(result.cards.some(card => card.nivel === 'lendaria'));
  const count = collection => Object.values(collection).reduce((a, b) => a + b, 0);
  assert.equal(count(result.collection), count(initial.collection) + 5);
  const duplicatePurchase = await api('boosters/buy', purchase);
  assert.equal(duplicatePurchase.body.currency, 450);
  assert.equal(duplicatePurchase.body.boosters.length, 0);
  assert.equal((await stats()).currencySpent, 50, 'Abrir ou repetir a compra não registra gasto extra.');
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
  const migrated = await api('auth/session');
  assert.deepEqual(migrated.body.boosters, []);
  assert.equal(migrated.body.currency, normal.body.currency);
  assert.deepEqual(migrated.body.collection, normal.body.collection);
  assert.equal(migrated.body.boosterPrice, 50);
  const tutorial = { faction: 'echossystem', purchaseId: 'tutorial-opposite-booster-v1' };
  assert.equal((await api('boosters/buy', { ...tutorial, faction: 'raspcorp' })).status, 400);
  const lessons = await Promise.all([api('boosters/buy', tutorial), api('boosters/buy', tutorial)]);
  for (const lesson of lessons) {
    assert.equal(lesson.status, 200);
    assert.equal(lesson.body.currency, migrated.body.currency, 'O primeiro booster do tutorial é totalmente gratuito.');
    assert.equal(lesson.body.tutorial.boosterTutorialPurchased, true);
    assert.equal(lesson.body.boosters.find(pack => pack.id === tutorial.purchaseId).faction, 'echossystem');
  }
  assert.equal((await stats()).currencySpent, 100, 'O resgate gratuito não entra nos gastos.');
  await stop(); await start();
  assert.equal((await api('auth/session')).body.tutorial.boosterTutorialPurchased, true);
  const openings = await Promise.all([api('boosters/open', { packId: tutorial.purchaseId }), api('boosters/open', { packId: tutorial.purchaseId })]);
  assert.deepEqual(openings[0], openings[1]);
  const taught = openings[0];
  assert.equal(taught.body.cards.length, 5);
  assert.equal(count(taught.body.collection), count(migrated.body.collection) + 5, 'Aberturas simultâneas concedem só cinco cartas.');
  assert.equal(taught.body.tutorial.boosterTutorialOpened, true);
  assert.equal(taught.body.currency, migrated.body.currency);
  const retryLesson = await api('boosters/buy', tutorial);
  assert.equal(retryLesson.body.currency, taught.body.currency, 'Retomar o tutorial depois de abrir não cobra outro pacote.');
  assert.equal(retryLesson.body.boosters.length, 0);
  assert.deepEqual(retryLesson.body.collection, taught.body.collection);
  const reopen = await api('boosters/open', { packId: tutorial.purchaseId });
  assert.deepEqual(reopen.body.collection, taught.body.collection, 'Reabrir não concede mais cinco cartas.');
  for (const seen of [true, false]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/account/tutorial`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ boosterTutorialSeen: seen }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).tutorial.boosterTutorialSeen, seen, 'Permite retomar o tutorial após pular.');
  }
  const forged = await fetch(`http://127.0.0.1:${port}/api/account/tutorial`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ boosterTutorialPurchased: false, boosterTutorialOpened: false }),
  });
  assert.equal(forged.status, 400, 'Compra e abertura só são confirmadas pelo servidor.');
  token = other.token;
  const withoutBalance = await api('boosters/buy', tutorial);
  assert.equal(withoutBalance.status, 200, 'O resgate funciona com saldo zero.');
  assert.equal(withoutBalance.body.currency, 0);
  const noBalanceCards = await api('boosters/open', { packId: tutorial.purchaseId });
  assert.equal(count(noBalanceCards.body.collection), count(withoutBalance.body.collection) + 5);
  assert.equal((await api('boosters/buy', { ...tutorial, purchaseId: 'tutorial-opposite-booster-v2' })).status, 400,
    'Trocar o identificador não consegue outro booster gratuito.');
  await stop();
  const afterTutorial = JSON.parse(fs.readFileSync(accountFile));
  afterTutorial.accounts[owner.accountKey].boosters = [];
  fs.writeFileSync(accountFile, JSON.stringify(afterTutorial));
  await start(); token = owner.token;
  assert.equal((await api('boosters/buy', tutorial)).status, 409,
    'O resgate único persiste mesmo se o histórico de pacotes for removido.');
  token = other.token;
  assert.equal((await api('boosters/buy', tutorial)).body.boosters.length, 0);
  assert.deepEqual((await api('boosters/open', { packId: tutorial.purchaseId })).body.collection, noBalanceCards.body.collection);
  console.log('Inventário: compras, gastos, persistência, isolamento, abertura única e booster gratuito único por conta, mesmo sem saldo, validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await stop();
  fs.rmSync(dir, { recursive: true, force: true });
});
