const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const feira = require("../server/feira-payments");
const { withdraw, purchase, resume } = require("../server/cybercoins");
const body = (id = "bank-exchange-00001") => ({ bundleId: "cybercoins-50", purchaseId: id, feiraToken: "google.test.jwt" });
const store = () => ({ accounts: { player: { currency: 100 }, other: { currency: 100 } } });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

async function adapter() {
  let response, statementResponse, call;
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync("server/feira-payments.js", "utf8"), {
    module, AbortSignal, fetch: async (url, options) => {
      call = { url, ...options }; calls.push(call);
      return url.endsWith("/statement") ? statementResponse : response;
    },
  });
  const api = module.exports;
  assert.equal(api.productId, 86);
  assert.equal(api.available, false, "A API atual não aceita débito de jogos.");
  const reply = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
  statementResponse = reply(200, []);
  response = reply(201, { operation: 123 });
  assert.equal(await api.credit({ tijolinhos: 25, token: "google.test.jwt" }), "123");
  assert.equal(call.url, "https://feira-de-jogos.dev.br/api/v2/credit");
  assert.equal(call.headers.Authorization, "Bearer google.test.jwt");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { product: 86, value: 25 });
  assert.equal(call.redirect, "error");
  assert.ok(call.signal);
  assert.match(calls[0].url, /\/statement$/, "Verifica acesso ao extrato antes de enviar dinheiro.");
  statementResponse = reply(200, [{ operation: 123, value: "25", completed: true }]);
  assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), 25);
  assert.equal(call.method, "GET");
  assert.match(call.url, /\/statement$/);
  for (const statement of [[], [{ operation: 124, value: 25, completed: true }]]) {
    statementResponse = reply(200, statement);
    await rejects(api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), "FEIRA_RECEIPT_NOT_FOUND");
  }
  statementResponse = reply(200, [{ operation: 123, value: 100, completed: true }]);
  await rejects(api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), "FEIRA_AMOUNT_MISMATCH");
  assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 250, token: "google.test.jwt" }), 100, "Usa o valor efetivamente confirmado, mesmo com preço fixo menor.");
  for (const value of [0, -1, 1.5, null, true, {}, "invalid", Number.MAX_SAFE_INTEGER + 1]) {
    statementResponse = reply(200, [{ operation: 123, value, completed: true }]);
    await rejects(api.confirmCredit({ receiptId: "123", tijolinhos: 250, token: "google.test.jwt" }), "FEIRA_AMOUNT_MISMATCH");
  }
  statementResponse = reply(200, [{ operation: 123, value: 25, completed: false }]);
  assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), null);
  statementResponse = reply(200, [{ operation: 123, value: 100, completed: false }]);
  assert.equal(await api.confirmCredit({ receiptId: "123", tijolinhos: 250, token: "google.test.jwt" }), null, "Crédito parcial ainda incompleto não libera a reserva.");
  statementResponse = reply(401, {});
  await rejects(api.confirmCredit({ receiptId: "123", tijolinhos: 25, token: "google.test.jwt" }), "FEIRA_STATEMENT_UNAUTHORIZED");
  const sent = calls.filter(call => call.method === "POST").length;
  await rejects(api.credit({ tijolinhos: 25, token: "google.test.jwt" }), "FEIRA_DECLINED");
  assert.equal(calls.filter(call => call.method === "POST").length, sent, "Sem acesso ao extrato, nenhum crédito é enviado.");
  statementResponse = reply(200, []);
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
  feira.confirmCredit = async ({ tijolinhos }) => tijolinhos;
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
  await rejects(withdraw(JSON.parse(JSON.stringify(unknown)), "player", body(), () => {}), "PAYMENT_REVIEW_REQUIRED");
  await rejects(resume(unknown, "player", body(), () => {}), "PAYMENT_REVIEW_REQUIRED");
  assert.equal(timeouts, 1);
  assert.equal(unknown.accounts.player.currency, 50);

  feira.credit = credit;
  const waiting = store();
  feira.confirmCredit = async () => null;
  await rejects(withdraw(waiting, "player", body(), () => {}), "PAYMENT_PENDING");
  const before = calls;
  const restarted = JSON.parse(JSON.stringify(waiting));
  feira.confirmCredit = async () => { throw Object.assign(Error("Extrato não autorizado"), { code: "FEIRA_STATEMENT_UNAUTHORIZED" }); };
  await assert.rejects(resume(restarted, "player", body(), () => {}), error => error.code === "FEIRA_STATEMENT_UNAUTHORIZED" && error.message === "Extrato não autorizado");
  assert.equal(restarted.accounts.player.currency, 50, "Falha no extrato não devolve uma reserva que já pode ter sido creditada no banco.");
  feira.confirmCredit = async ({ tijolinhos }) => tijolinhos;
  await resume(restarted, "player", { ...body(), bundleId: "fake", tijolinhos: 999 }, () => {});
  assert.equal(calls, before, "Com recibo salvo, retomar faz somente consulta ao extrato.");
  assert.equal(restarted.accounts.player.currency, 50);
  await rejects(resume(restarted, "other", body(), () => {}), "PURCHASE_NOT_FOUND");
  await rejects(resume(store(), "player", body(), () => {}), "PURCHASE_NOT_FOUND");
  assert.equal(calls, before, "Consultar tentativa inexistente nunca cria um crédito.");
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

async function partialSettlement() {
  const id = "bank-exchange-08041";
  const pending = () => ({ accounts: { player: { currency: 50 } }, cybercoinPurchases: {
    [id]: { id, accountKey: "player", bundleId: "cybercoins-500", direction: "withdraw",
      cybercoins: 500, tijolinhos: 250, receiptId: "8041", status: "pending" },
  } });
  feira.credit = async () => { assert.fail("Conciliação nunca reenvia crédito ao banco."); };
  feira.confirmCredit = async ({ receiptId, tijolinhos }) => {
    assert.equal(receiptId, "8041"); assert.equal(tijolinhos, 250); return 100;
  };
  const s = pending();
  let persisted;
  const save = () => { persisted = JSON.parse(JSON.stringify(s)); };
  const result = await resume(s, "player", { ...body(id), tijolinhos: 999, settledTijolinhos: 1 }, save);
  assert.equal(result.status, "completed");
  assert.equal(result.tijolinhos, 250, "Valor solicitado é preservado para auditoria.");
  assert.equal(result.cybercoins, 500);
  assert.equal(result.settledTijolinhos, 100);
  assert.equal(result.spentCybercoins, 200);
  assert.equal(result.refundedCybercoins, 300);
  assert.equal(s.accounts.player.currency, 350, "Somente os 100 tijolinhos confirmados são cobrados, a 2:1.");
  assert.equal(persisted.accounts.player.currency, 350, "Conclusão e devolução são salvas juntas.");
  await resume(persisted, "player", body(id), () => { assert.fail("Conclusão já salva não é repetida."); });
  assert.equal(persisted.accounts.player.currency, 350, "Reiniciar e repetir não duplica a devolução.");

  const broken = pending();
  await rejects(resume(broken, "player", body(id), () => { throw Error("disk"); }), "PAYMENT_STORAGE");
  assert.equal(broken.accounts.player.currency, 50);
  assert.deepEqual(broken.cybercoinPurchases[id], pending().cybercoinPurchases[id], "Falha ao salvar desfaz devolução e conclusão.");
  await resume(broken, "player", body(id), () => {});
  assert.equal(broken.accounts.player.currency, 350);

  let release;
  feira.confirmCredit = () => new Promise(resolve => { release = () => resolve(100); });
  const concurrent = pending(), first = resume(concurrent, "player", body(id), () => {});
  await rejects(resume(concurrent, "player", body(id), () => {}), "PAYMENT_PENDING");
  release(); await first;
  assert.equal(concurrent.accounts.player.currency, 350);

  for (const amount of [0, -1, 1.5, true, undefined, 251]) {
    feira.confirmCredit = async () => amount;
    const invalid = pending();
    await rejects(resume(invalid, "player", body(id), () => {}), "FEIRA_AMOUNT_MISMATCH");
    assert.equal(invalid.accounts.player.currency, 50);
    assert.equal(invalid.cybercoinPurchases[id].status, "pending");
  }
  feira.confirmCredit = async () => 100;
  const overflow = pending(); overflow.accounts.player.currency = Number.MAX_SAFE_INTEGER;
  await rejects(resume(overflow, "player", body(id), () => {}), "BALANCE_LIMIT");
  assert.equal(overflow.accounts.player.currency, Number.MAX_SAFE_INTEGER);
  assert.equal(overflow.cybercoinPurchases[id].status, "pending");
}

(async () => {
  await adapter(); await exchange(); await partialSettlement();
  console.log("Feira: GSI, produto 86, câmbio 2:1, reserva, extrato, recusas, concorrência, falhas e recuperação sem duplicar crédito validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
