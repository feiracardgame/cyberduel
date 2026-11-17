const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { Readable } = require("node:stream");
const feira = require("../server/feira-payments");
const { catalog, purchase } = require("../server/cybercoins");
const token = "feira.test.jwt";
const body = (id = "purchase-test-0001", bundleId = "cybercoins-50") => ({ purchaseId: id, bundleId, feiraToken: token });
const store = () => ({ accounts: { player: { currency: 0 }, other: { currency: 0 } } });
const paid = async order => ({ id: `receipt-${order.purchaseId}`, purchaseId: order.purchaseId, tijolinhos: order.tijolinhos });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

async function unit() {
  assert.equal(catalog().available, false);
  assert.deepEqual(catalog().bundles.map(bundle => [bundle.tijolinhos, bundle.cybercoins]), [[10, 20], [25, 50], [50, 100], [100, 200], [250, 500]]);
  for (const bundle of catalog().bundles) assert.equal(bundle.cybercoins, bundle.tijolinhos * 2);
  await rejects(purchase(store(), "player", body(), () => {}), "FEIRA_UNAVAILABLE");
  let calls = 0;
  feira.available = true;
  feira.debit = async order => { calls++; assert.equal(order.token, token); return paid(order); };
  await rejects(purchase(store(), "player", { ...body(), bundleId: "forged", cybercoins: 99999 }, () => {}), "INVALID_PURCHASE");
  await rejects(purchase(store(), "player", { ...body(), purchaseId: "bad" }, () => {}), "INVALID_PURCHASE");
  await rejects(purchase(store(), "player", { ...body(), feiraToken: "not-a-jwt" }, () => {}), "INVALID_FEIRA_TOKEN");
  const s = store();
  const order = await purchase(s, "player", { ...body(), cybercoins: 99999, tijolinhos: 0, status: "completed" }, () => {});
  assert.equal(order.cybercoins, 50); assert.equal(order.tijolinhos, 25);
  assert.equal(s.accounts.player.currency, 50); assert.equal(calls, 1);
  assert.ok(!JSON.stringify(s).includes(token), "JWT nunca é salvo no registro da compra.");
  feira.available = false;
  await purchase(s, "player", body(), () => {});
  assert.equal(s.accounts.player.currency, 50); assert.equal(calls, 1);
  await rejects(purchase(s, "other", body(), () => {}), "PURCHASE_CONFLICT");
  await rejects(purchase(s, "player", body(undefined, "cybercoins-100"), () => {}), "PURCHASE_CONFLICT");
  feira.available = true;

  let release;
  feira.debit = order => { calls++; return new Promise(resolve => { release = () => resolve(paid(order)); }); };
  const concurrent = store(), first = purchase(concurrent, "player", body(), () => {});
  await rejects(purchase(concurrent, "player", body(), () => {}), "PAYMENT_PENDING");
  await rejects(purchase(concurrent, "player", body("purchase-test-0002"), () => {}), "PAYMENT_PENDING");
  release(); await first;
  assert.equal(concurrent.accounts.player.currency, 50); assert.equal(calls, 2);

  feira.debit = async () => { throw Object.assign(Error("recusado"), { code: "FEIRA_DECLINED" }); };
  const declined = store();
  await rejects(purchase(declined, "player", body(), () => {}), "FEIRA_DECLINED");
  assert.equal(declined.cybercoinPurchases[body().purchaseId].status, "declined");
  feira.debit = () => { throw Error("Não deveria cobrar de novo"); };
  await rejects(purchase(declined, "player", body(), () => {}), "FEIRA_DECLINED");
  assert.equal(declined.accounts.player.currency, 0);

  const unknown = store(); let timeouts = 0;
  feira.debit = async () => { timeouts++; throw Error("timeout após enviar"); };
  await rejects(purchase(unknown, "player", body(), () => {}), "PAYMENT_PENDING");
  await rejects(purchase(JSON.parse(JSON.stringify(unknown)), "player", body(), () => {}), "PAYMENT_PENDING");
  await rejects(purchase(unknown, "player", body("purchase-test-0002"), () => {}), "PAYMENT_PENDING");
  assert.equal(timeouts, 1); assert.equal(unknown.accounts.player.currency, 0);

  for (const receipt of [null, {}, { id: "abc", purchaseId: "wrong", tijolinhos: 25 },
    { id: "abc", purchaseId: body().purchaseId, tijolinhos: 24 }]) {
    const invalid = store(); feira.debit = async () => receipt;
    await rejects(purchase(invalid, "player", body(), () => {}), "PAYMENT_PENDING");
    assert.equal(invalid.accounts.player.currency, 0);
  }
  const duplicate = store();
  feira.debit = async order => ({ ...await paid(order), id: "same-receipt" });
  await purchase(duplicate, "player", body(), () => {});
  await rejects(purchase(duplicate, "other", body("purchase-test-0002"), () => {}), "PAYMENT_PENDING");
  assert.equal(duplicate.accounts.other.currency, 0);

  let debits = 0;
  feira.debit = async order => { debits++; return paid(order); };
  await rejects(purchase(store(), "player", body(), () => { throw Error("disk"); }), "PAYMENT_STORAGE");
  assert.equal(debits, 0, "Falha antes de registrar impede o débito.");
  for (const failAt of [2, 3]) {
    let saves = 0, durable;
    const broken = store();
    const save = () => { if (++saves === failAt) throw Error("disk"); durable = JSON.stringify(broken); };
    await rejects(purchase(broken, "player", body(), save), "PAYMENT_STORAGE");
    assert.equal(broken.accounts.player.currency, 0);
    const recovered = failAt === 3 ? JSON.parse(durable) : broken;
    await purchase(recovered, "player", body(), () => {});
    assert.equal(recovered.accounts.player.currency, 50);
    assert.equal(debits, failAt - 1, "Retentar crédito confirmado não cobra novamente.");
  }
  const overflow = store(); overflow.accounts.player.currency = Number.MAX_SAFE_INTEGER;
  await rejects(purchase(overflow, "player", body(), () => {}), "BALANCE_LIMIT");
  assert.equal(debits, 2, "Limite do saldo é verificado antes da cobrança.");
  feira.debit = async order => { overflow.accounts.player.currency = Number.MAX_SAFE_INTEGER; return paid(order); };
  overflow.accounts.player.currency = 0;
  await rejects(purchase(overflow, "player", body(), () => {}), "BALANCE_LIMIT");
  assert.equal(overflow.cybercoinPurchases[body().purchaseId].status, "confirmed");
  overflow.accounts.player.currency = 0;
  await purchase(overflow, "player", body(), () => {});
  assert.equal(overflow.accounts.player.currency, 50);
}

async function apiTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-cybercoins-"));
  const [player, seller, treasury] = require("./account-fixture")(dir, ["CoinBuyer", "CoinSeller", "dante"]);
  const file = path.join(dir, "accounts.json"), data = JSON.parse(fs.readFileSync(file));
  for (const fixture of [player, seller, treasury]) Object.assign(data.accounts[fixture.accountKey], {
    faction: "echossystem", currency: 0, starterCollection: {}, collection: { "monstro:O Rato": 3 },
  });
  fs.writeFileSync(file, JSON.stringify(data));
  let handleApi, confirmedAmount, receipt = 123456;
  async function start(mock, credentials = true) {
    const realRequire = createRequire(path.resolve("server/server.js"));
    const adapter = { available: mock, creditAvailable: true, debit: paid,
      credit: async order => { assert.equal(order.token, token, "JWT usado é o da sessão Google."); return String(++receipt); },
      confirmCredit: async ({ tijolinhos }) => confirmedAmount ?? tijolinhos };
    const coinModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync("server/cybercoins.js", "utf8"), {
      require: name => name === "./feira-payments" ? adapter : realRequire(name), module: coinModule,
    });
    const context = vm.createContext({
      require: name => name === "./cybercoins" ? coinModule.exports : name === "http" ? { createServer: () => ({ listen() {} }) }
        : name === "socket.io" ? { Server: class { on() {} } } : realRequire(name),
      __dirname: path.resolve("server"), process: { env: { ...process.env, DATA_DIR: dir }, pid: process.pid },
      console, Buffer, URL, URLSearchParams, setTimeout, clearTimeout,
      setInterval: () => ({ unref() {} }),
    });
    vm.runInContext(fs.readFileSync("server/server.js", "utf8") + `
      globalThis.handleApi = handleApi;
      if (${credentials}) for (const token of ${JSON.stringify([player.token, seller.token, treasury.token])}) {
        const session = sessions.get(sessionKey(token));
        sealGoogleCredential(session, token, { token: "feira.test.jwt", expiresAt: Date.now() + 60000 });
        if (sessionGoogleCredential(session, token) !== "feira.test.jwt") throw Error("JWT cifrado não recuperado");
        if (sessionGoogleCredential(session, "wrong-session-token")) throw Error("JWT acessível com outra sessão");
        const damaged = { ...session, googleCredential: session.googleCredential.slice(0, -8) + "AAAAAAAA" };
        if (sessionGoogleCredential(damaged, token)) throw Error("JWT alterado aceito");
      }
    `, context);
    handleApi = context.handleApi;
  }
  async function stop() { handleApi = null; }
  async function api(route, body, auth = player.token) {
    const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    request.url = `/api/${route}`; request.method = body ? "POST" : "GET";
    request.headers = { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) };
    let result;
    const response = { writeHead(status) { this.status = status; }, end(value) { result = { status: this.status, body: JSON.parse(value) }; } };
    await handleApi(request, response, request.url);
    return result;
  }
  try {
    await start(false, false);
    assert.equal((await api("cybercoins/packages", null, null)).status, 401);
    assert.equal((await api("cybercoins/buy", body(), null)).status, 401);
    assert.equal((await api("cybercoins/packages")).body.available, false);
    assert.equal((await api("cybercoins/packages")).body.needsGoogleLogin, true);
    assert.equal((await api("cybercoins/withdraw", body(), null)).status, 401);
    assert.equal((await api("cybercoins/resume", body(), null)).status, 401);
    assert.equal((await api("cybercoins/resume", body())).status, 404, "Consulta não cria uma compra quando o ID não existe.");
    assert.equal((await api("cybercoins/withdraw", body())).status, 401, "Token enviado no corpo não substitui o JWT validado no login.");
    assert.equal((await api("cybercoins/buy", body())).status, 503);
    assert.equal((await api("auth/session")).body.currency, 0);
    await stop(); await start(true);
    assert.equal((await api("cybercoins/packages")).body.available, true);
    const bought = await api("cybercoins/buy", { ...body(undefined, "cybercoins-100"), cybercoins: 99999, tijolinhos: 0 });
    assert.equal(bought.status, 200); assert.equal(bought.body.currency, 100);
    assert.equal(bought.body.purchase.cybercoins, 100);
    assert.equal(bought.body.purchase.tijolinhos, 50);
    assert.equal((await api("cybercoins/buy", body(undefined, "cybercoins-100"), seller.token)).status, 409);
    const pack = await api("boosters/buy", { faction: "echossystem", purchaseId: "paid-with-cybercoins" });
    assert.equal(pack.status, 200); assert.equal(pack.body.currency, 50); assert.equal(pack.body.boosters.length, 1);
    const listing = await api("market/listings", { tipo: "monstro", nome: "O Rato", quantidade: 1, preco: 50 }, seller.token);
    assert.equal(listing.status, 201);
    const listings = (await api("market/listings")).body.listings;
    const trade = await api("market/buy", { id: listings[0].id });
    assert.equal(trade.status, 200); assert.equal(trade.body.currency, 0);
    assert.equal((await api("auth/session", null, seller.token)).body.currency, 40);
    assert.equal((await api("auth/session", null, treasury.token)).body.currency, 10);
    const cashout = await api("cybercoins/withdraw", body("bank-withdraw-00001", "cybercoins-20"), seller.token);
    assert.equal(cashout.status, 200);
    assert.equal(cashout.body.currency, 20);
    assert.equal(cashout.body.purchase.tijolinhos, 10);
    assert.equal(cashout.body.purchase.direction, "withdraw");
    const resumed = await api("cybercoins/resume", { purchaseId: "bank-withdraw-00001", bundleId: "forged" }, seller.token);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.currency, 20, "Retomar câmbio concluído não altera novamente o saldo.");
    const missing = await api("cybercoins/resume", { purchaseId: "bank-missing-000001" }, seller.token);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.currency, 20, "Mesmo a recusa de consulta atualiza a carteira do cliente.");
    await api("cybercoins/buy", body("buy-for-partial-0001", "cybercoins-500"));
    confirmedAmount = 100;
    const partial = await api("cybercoins/withdraw", body("partial-bank-08041", "cybercoins-500"));
    assert.equal(partial.status, 200);
    assert.equal(partial.body.currency, 300);
    assert.equal(partial.body.purchase.tijolinhos, 250);
    assert.equal(partial.body.purchase.settledTijolinhos, 100);
    assert.equal(partial.body.purchase.spentCybercoins, 200);
    assert.equal(partial.body.purchase.refundedCybercoins, 300);
    await stop(); await start(false);
    const settledAgain = await api("cybercoins/resume", { purchaseId: "partial-bank-08041" });
    assert.equal(settledAgain.status, 200);
    assert.equal(settledAgain.body.currency, 300);
    assert.equal(settledAgain.body.purchase.refundedCybercoins, 300);
    const replay = await api("cybercoins/buy", body(undefined, "cybercoins-100"));
    assert.equal(replay.status, 200); assert.equal(replay.body.currency, 300, "Reiniciar/repetir não credita a compra novamente.");
    assert.ok(!fs.readFileSync(file, "utf8").includes(token));
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  await unit(); await apiTest();
  console.log("Cybercoins: proporção 1:2, pacotes fixos, autenticação, crédito confirmado, repetição, concorrência, falhas, persistência, booster e mercado validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
