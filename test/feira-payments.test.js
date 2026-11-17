const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const feira = require("../server/feira-payments");
const { withdraw, purchase } = require("../server/cybercoins");
const body = (id = "bank-exchange-00001") => ({ bundleId: "cybercoins-50", purchaseId: id, feiraToken: "google.test.jwt" });
const store = () => ({ accounts: { player: { currency: 100 }, other: { currency: 100 } } });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

async function adapter() {
  let response, call;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync("server/feira-payments.js", "utf8"), {
    module, AbortSignal, fetch: async (url, options) => { call = { url, ...options }; return response; },
  });
  const api = module.exports;
  assert.equal(api.productId, 86);
  assert.equal(api.available, false, "A API atual não aceita débito de jogos.");
  const reply = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  response = reply(201, { operation: 123 });
  assert.equal(await api.credit({ tijolinhos: 25, token: "google.test.jwt" }), "123");
  assert.equal(call.url, "https://feira-de-jogos.dev.br/api/v2/credit");
  assert.equal(call.headers.Authorization, "Bearer google.test.jwt");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { product: 86, value: 25 });
  assert.equal(call.redirect, "error");
  assert.ok(call.signal);
  response = reply(200, [{ operation: 123, value: "25", completed: true }]);
  assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), true);
  assert.equal(call.method, "GET");
  assert.match(call.url, /\/statement$/);
  for (const statement of [[], [{ operation: 124, value: 25, completed: true }],
    [{ operation: 123, value: 100, completed: true }], [{ operation: 123, value: 25, completed: false }]]) {
    response = reply(200, statement);
    assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), false);
  }
  for (const status of [400, 401, 402, 403, 429]) {
    response = reply(status, {});
    await rejects(api.credit({ tijolinhos: 25, token: "google.test.jwt" }), "FEIRA_DECLINED");
  }
  response = reply(500, {});
  await assert.rejects(api.credit({ tijolinhos: 25, token: "google.test.jwt" }), error => !error.code);
  for (const [status, value] of [[200, { operation: 123 }], [201, {}], [201, { operation: -1 }]]) {
    response = reply(status, value);
    await assert.rejects(api.credit({ tijolinhos: 25, token: "google.test.jwt" }));
  }
}

async function exchange() {
  let calls = 0, serial = 0;
  const credit = async () => { calls++; return String(++serial); };
  feira.credit = credit;
  feira.confirmCredit = async () => true;
  await rejects(withdraw(store(), "player", { ...body(), bundleId: "fake" }, () => {}), "INVALID_PURCHASE");
  await rejects(withdraw(store(), "player", { ...body(), feiraToken: "forged" }, () => {}), "FEIRA_LOGIN_REQUIRED");
  const insufficient = store(); insufficient.accounts.player.currency = 49;
  await rejects(withdraw(insufficient, "player", body(), () => {}), "INSUFFICIENT_CYBERCOINS");
  await rejects(withdraw(store(), "player", body(), () => { throw Error("disk"); }), "PAYMENT_STORAGE");
  assert.equal(calls, 0);
  const s = store();
  await withdraw(s, "player", { ...body(), cybercoins: 1, tijolinhos: 999 }, () => {});
  assert.equal(s.accounts.player.currency, 50);
  assert.equal(s.cybercoinPurchases[body().purchaseId].tijolinhos, 25);
  assert.ok(!JSON.stringify(s).includes(body().feiraToken));
  await withdraw(JSON.parse(JSON.stringify(s)), "player", body(), () => {});
  assert.equal(calls, 1, "Repetir após reinício não envia outro crédito.");
  await rejects(withdraw(s, "other", body(), () => {}), "PURCHASE_CONFLICT");
  await rejects(purchase(s, "player", body(), () => {}), "PURCHASE_CONFLICT");

  let release;
  feira.credit = () => { calls++; return new Promise(resolve => { release = () => resolve(String(++serial)); }); };
  const concurrent = store(), first = withdraw(concurrent, "player", body(), () => {});
  assert.equal(concurrent.accounts.player.currency, 50, "Reserva impede gastar Cybercoins durante a transferência.");
  await rejects(withdraw(concurrent, "player", body(), () => {}), "PAYMENT_PENDING");
  await rejects(withdraw(concurrent, "player", body("bank-exchange-00002"), () => {}), "PAYMENT_PENDING");
  release(); await first;

  feira.credit = async () => { throw Object.assign(Error("Recusado"), { code: "FEIRA_DECLINED" }); };
  const declined = store();
  await rejects(withdraw(declined, "player", body(), () => {}), "FEIRA_DECLINED");
  assert.equal(declined.accounts.player.currency, 100, "Recusa definitiva devolve toda a reserva.");
  await rejects(withdraw(declined, "player", body(), () => {}), "FEIRA_DECLINED");
  assert.equal(declined.accounts.player.currency, 100);
  let saves = 0;
  const refundFailure = store();
  await rejects(withdraw(refundFailure, "player", body(), () => { if (++saves === 2) throw Error("disk"); }), "PAYMENT_STORAGE");
  assert.equal(refundFailure.accounts.player.currency, 50);
  assert.equal(refundFailure.cybercoinPurchases[body().purchaseId].status, "pending");

  const unknown = store(); let timeouts = 0;
  feira.credit = async () => { timeouts++; throw Error("timeout"); };
  await rejects(withdraw(unknown, "player", body(), () => {}), "PAYMENT_PENDING");
  await rejects(withdraw(JSON.parse(JSON.stringify(unknown)), "player", body(), () => {}), "PAYMENT_PENDING");
  assert.equal(timeouts, 1);
  assert.equal(unknown.accounts.player.currency, 50);

  feira.credit = credit;
  const waiting = store();
  feira.confirmCredit = async () => false;
  await rejects(withdraw(waiting, "player", body(), () => {}), "PAYMENT_PENDING");
  const before = calls;
  const restarted = JSON.parse(JSON.stringify(waiting));
  feira.confirmCredit = async () => true;
  await withdraw(restarted, "player", body(), () => {});
  assert.equal(calls, before, "Com recibo salvo, retomar faz somente consulta ao extrato.");
  assert.equal(restarted.accounts.player.currency, 50);
  for (const failAt of [2, 3]) {
    saves = 0;
    const broken = store();
    await rejects(withdraw(broken, "player", body(), () => { if (++saves === failAt) throw Error("disk"); }), "PAYMENT_STORAGE");
    const count = calls;
    await withdraw(broken, "player", body(), () => {});
    assert.equal(calls, count);
    assert.equal(broken.accounts.player.currency, 50);
  }
  const duplicate = store(); feira.credit = async () => "999";
  await withdraw(duplicate, "player", body(), () => {});
  await rejects(withdraw(duplicate, "other", body("bank-exchange-00002"), () => {}), "PAYMENT_PENDING");
}

(async () => {
  await adapter(); await exchange();
  console.log("Feira: GSI, produto 86, câmbio 2:1, reserva, extrato, recusas, concorrência, falhas e recuperação sem duplicar crédito validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
