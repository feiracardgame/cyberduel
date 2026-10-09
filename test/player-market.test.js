const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-market-'));
const users = require('./account-fixture')(directory, ['Seller', 'Buyer', 'Other', 'Starter']);
const file = path.join(directory, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
const key = 'monstro:O Rato';
for (const user of users) Object.assign(store.accounts[user.accountKey], {
  faction: 'echossystem', currency: 500, collection: { [key]: 10 },
  deck: [{ tipo: 'monstro', nome: 'O Rato', quantidade: 2 }],
});
fs.writeFileSync(file, JSON.stringify(store));
// Conta antiga que já havia colocado parte do kit inicial à venda.
store.accounts[users[2].accountKey].deck = null;
store.accounts[users[2].accountKey].collection[key] = 1;
store.marketListings = [{ id: 'legacy-starter', seller: users[2].accountKey, tipo: 'monstro', nome: 'O Rato', quantidade: 1, preco: 70 }];
store.accounts[users[0].accountKey].collection['monstro:O Cão'] = 2;
store.accounts[users[0].accountKey].collection['monstro:HAL 9001'] = 1;
Object.assign(store.accounts[users[3].accountKey], { faction: null, collection: {}, deck: null });
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:32120';
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: '32120', DATA_DIR: directory, GOOGLE_CLIENT_ID: '', CYBERDUEL_LOCAL_LOGIN: '0', ADMIN_USERNAMES: 'Seller' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (data.toString().includes('ouvindo na porta')) { clearTimeout(timeout); resolve(); } });
    server.once('exit', code => { clearTimeout(timeout); reject(Error(`Servidor encerrou: ${code}`)); });
  });
}
async function stop() { const child = server; server = null; child.kill(); await once(child, 'exit'); }
async function api(route, user, body) {
  const response = await fetch(`${base}/api/${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
const [seller, buyer, other] = users;
const offer = (quantidade = 1, preco = 70) => ({ tipo: 'monstro', nome: 'O Rato', quantidade, preco });
const account = async user => (await api('auth/session', user)).body;
const stats = async user => (await api('admin/accounts', seller)).body.accounts.find(account => account.username === user.username);
(async () => {
  await start();
  assert.equal((await api('market/listings')).status, 401);
  const starter = await api('account/faction', users[3], { faction: 'echossystem' });
  assert.equal(starter.status, 200); assert.equal(starter.body.starterCollection[key], 2);
  assert.equal((await api('market/listings', users[3], offer())).status, 409, 'Novo kit inicial não pode ser anunciado.');
  assert.equal((await api('market/listings', other)).body.listings.length, 0, 'Anúncio antigo do kit inicial é cancelado.');
  assert.equal((await account(other)).collection[key], 2, 'Cópia inicial reservada é devolvida.');
  assert.equal((await account(other)).starterCollection[key], 2, 'Proteção migra para contas antigas.');
  assert.equal((await api('market/listings', other, offer())).status, 409, 'Kit inicial protegido mesmo fora do deck.');
  assert.equal((await api('market/listings', seller, { ...offer(), nome: 'O Cão' })).status, 409);
  for (const body of [null, [], offer(0), offer(1, 0), offer(1, 1.5), offer(1, '50'), offer(2, Number.MAX_SAFE_INTEGER), { ...offer(), nome: 'Não existe' }])
    assert.equal((await api('market/listings', seller, body)).status, 400);
  assert.equal((await api('market/listings', seller, offer(9))).status, 409, 'Cópias do deck ficam protegidas.');
  const unlocked = (await stats(seller)).unlockedCards;
  const escrow = await api('market/listings', seller, { tipo: 'monstro', nome: 'HAL 9001', quantidade: 1, preco: 70 });
  assert.equal(escrow.status, 201);
  assert.equal((await stats(seller)).unlockedCards, unlocked, 'Carta anunciada continua contando na coleção.');
  assert.equal((await api('market/cancel', seller, { id: escrow.body.listingId })).status, 200);
  assert.equal((await stats(seller)).marketSales, 0, 'Cancelar anúncio não conta como venda.');
  let created = await api('market/listings', seller, offer(2));
  assert.equal(created.status, 201);
  const id = created.body.listingId;
  assert.equal(created.body.collection[key], 8);
  const listing = (await api('market/listings', buyer)).body.listings[0];
  assert.equal(listing.preco, 70); assert.equal(listing.seller, seller.username); assert.equal(listing.mine, false);
  assert.equal((await api('market/listings', seller)).body.listings[0].mine, true);
  assert.equal((await api('market/buy', seller, { id })).status, 403);
  assert.equal((await api('market/cancel', buyer, { id })).status, 403);
  await stop(); await start();
  assert.equal((await api('market/listings', buyer)).body.listings[0].id, id, 'Anúncio persiste no reinício.');
  const bought = await api('market/buy', buyer, { id, preco: 1, quantidade: 99 });
  assert.equal(bought.status, 200); assert.equal(bought.body.currency, 360); assert.equal(bought.body.collection[key], 12);
  assert.equal((await account(seller)).currency, 612, 'Vendedor recebe 80% de 140.');
  assert.equal((await stats(buyer)).currencySpent, 140);
  assert.equal((await stats(seller)).marketSales, 1);
  assert.equal((await api('market/buy', buyer, { id })).status, 409, 'Repetição não cobra duas vezes.');
  assert.equal((await stats(buyer)).currencySpent, 140);
  assert.equal((await stats(seller)).marketSales, 1);
  created = await api('market/listings', seller, offer(1, 900));
  assert.equal((await api('market/buy', buyer, { id: created.body.listingId })).status, 409);
  const canceled = await api('market/cancel', seller, { id: created.body.listingId });
  assert.equal(canceled.status, 200); assert.equal(canceled.body.collection[key], 8);
  created = await api('market/listings', seller, offer());
  const attempts = await Promise.all([buyer, other].map(user => api('market/buy', user, { id: created.body.listingId })));
  assert.deepEqual(attempts.map(a => a.status).sort(), [200, 409], 'Somente um comprador recebe a carta.');
  assert.equal((await account(seller)).currency, 668);
  assert.equal((await account(seller)).collection[key], 7);
  for (const price of [7, 1]) {
    created = await api('market/listings', seller, offer(1, price));
    assert.equal((await api('market/buy', buyer, { id: created.body.listingId })).status, 200);
  }
  assert.equal((await account(seller)).currency, 673, '80% são arredondados para baixo, inclusive em preços baixos.');
  created = await api('market/listings', seller, offer(2, 7));
  assert.equal((await api('market/buy', buyer, { id: created.body.listingId })).status, 200);
  assert.equal((await account(seller)).currency, 684, 'Arredondamento ocorre sobre o total do lote.');
  created = await api('market/listings', seller, offer());
  const beforeBuyer = await account(buyer), beforeSeller = await account(seller);
  const beforeBuyerStats = await stats(buyer), beforeSellerStats = await stats(seller);
  const temporary = `${file}.${server.pid}.tmp`;
  fs.mkdirSync(temporary); // Força falha de gravação antes de confirmar o negócio.
  try { assert.equal((await api('market/buy', buyer, { id: created.body.listingId })).status, 500); }
  finally { fs.rmdirSync(temporary); }
  assert.equal((await account(buyer)).currency, beforeBuyer.currency);
  assert.deepEqual((await account(buyer)).collection, beforeBuyer.collection);
  assert.equal((await account(seller)).currency, beforeSeller.currency);
  assert.deepEqual(await stats(buyer), beforeBuyerStats, 'Falha de gravação não registra gasto.');
  assert.deepEqual(await stats(seller), beforeSellerStats, 'Falha de gravação não registra venda.');
  assert.equal((await api('market/listings', buyer)).body.listings.length, 1, 'Falha mantém a carta reservada no anúncio.');
  assert.equal((await api('market/cancel', seller, { id: created.body.listingId })).status, 200);
  await stop(); await start();
  assert.equal((await api('market/listings', buyer)).body.listings.length, 0);
  assert.equal((await account(seller)).currency, 684);
  assert.equal((await stats(seller)).marketSales, 5);
  assert.equal((await stats(buyer)).currencySpent, beforeBuyerStats.currencySpent);
  console.log('Mercado: preços, reserva, deck, compra/cancelamento, permissões, concorrência, rollback e persistência aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (server) await stop(); });
