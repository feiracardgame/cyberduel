const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.events = {}; this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, handler) { this.events[event] = handler; }
  focus() {}
  click() { if (!this.disabled) return this.events.click?.(); }
}
const storage = new Map();
const context = vm.createContext({
  crypto: webcrypto, console, requestAnimationFrame: callback => callback(), setTimeout: callback => callback(),
  document: { createElement: tag => new Element(tag), body: new Element("body") }, window: {},
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
});
vm.runInContext(fs.readFileSync("js/account.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/title-ui.js", "utf8") + "\nglobalThis.UI = CyberduelTitleUI;", context);
const account = context.window.cyberduelAccount;
const find = (node, cls) => node.className?.split(" ").includes(cls) ? node : node.children.map(child => find(child, cls)).find(Boolean);
const tick = () => new Promise(setImmediate);
const key = "cyberduel.feira.admin.v1:GestorQA";

(async () => {
  account.applyAuth({ username: "DuelistaQA", token: "normal-session", authProvider: "google", currency: 123 });
  account.request = () => { assert.fail("Conta comum não envia pedidos pelo botão."); };
  await assert.rejects(account.grantFeiraCredit(), /administradora/);
  await assert.rejects(account.resetPendingTransfers(), /administradora/);
  const ui = new context.UI({ account, callbacks: {}, deckBuilder: { getCatalog: () => [] } });
  ui.root = new Element("main");
  ui.openAdminGrantDialog();
  assert.equal(ui.modal, null, "Conta comum não abre o painel.");

  account.applyAuth({ username: "GestorQA", token: "admin-session", isAdmin: true, authProvider: "google", currency: 123 });
  let posts = 0, pendingId = null, needsGoogleLogin = false, fail = true, release;
  const ids = [];
  account.request = async (route, options) => {
    if (route === "/api/admin/accounts") return { accounts: [] };
    assert.equal(route, "/api/admin/feira/credit");
    if (!options) return { needsGoogleLogin, pendingGrant: pendingId ? { id: pendingId } : null };
    assert.deepEqual(Object.keys(options.body), ["purchaseId"], "Valor, destino e JWT não são escolhidos pelo navegador.");
    posts++; ids.push(options.body.purchaseId); pendingId = options.body.purchaseId;
    if (fail) throw Object.assign(Error("Confirmação pendente"), { code: "PAYMENT_PENDING" });
    return new Promise(resolve => { release = () => { pendingId = null; resolve({ tijolinhos: 500, receiptId: "9001" }); }; });
  };
  ui.openAdminGrantDialog(); await tick();
  let section = find(ui.modal, "title-admin-feira"), button = find(section, "title-admin-feira-credit");
  assert.equal(section.hidden, false); assert.equal(button.disabled, false);
  await button.click();
  assert.equal(posts, 1);
  assert.match(button.textContent, /VERIFICAR CRÉDITO PENDENTE/);
  assert.equal(storage.get(key), ids[0]);

  storage.delete(key); ui.modal = null;
  ui.openAdminGrantDialog(); await tick();
  section = find(ui.modal, "title-admin-feira"); button = find(section, "title-admin-feira-credit");
  assert.equal(storage.get(key), ids[0], "Painel recupera do servidor a tentativa após perder o armazenamento local.");
  assert.match(button.textContent, /VERIFICAR CRÉDITO PENDENTE/);
  fail = false;
  const first = button.click();
  await button.click();
  assert.equal(posts, 2, "Clique duplo não duplica a chamada.");
  assert.equal(ids[1], ids[0]);
  release(); await first;
  assert.equal(storage.has(key), false);
  assert.equal(account.currency, 123, "Crédito no banco não mexe nas Cybercoins.");
  assert.match(find(section, "title-admin-note").textContent, /500 tijolinhos creditados.*9001.*Nenhuma Cybercoin/);

  needsGoogleLogin = true; ui.modal = null;
  let mounts = 0, renew;
  account.mountGoogleButton = (container, onError, onSuccess) => { mounts++; renew = onSuccess; };
  ui.openAdminGrantDialog(); await tick();
  const renewalModal = ui.modal;
  section = find(ui.modal, "title-admin-feira"); button = find(section, "title-admin-feira-credit");
  assert.equal(button.disabled, true); assert.equal(mounts, 1);
  needsGoogleLogin = false; await renew();
  assert.equal(ui.modal, renewalModal, "Renovação do Google preserva o painel.");
  assert.equal(button.disabled, false);
  account.request = async (route, options) => {
    assert.equal(route, "/api/admin/feira/credit"); posts++;
    return { tijolinhos: 100, requestedTijolinhos: 500, receiptId: "9002" };
  };
  await button.click();
  assert.match(find(section, "title-admin-note").textContent, /apenas 100 dos 500.*9002.*produto 86/);
  assert.equal(posts, 3, "Crédito menor não dispara pagamentos para completar a diferença.");

  let resetPosts = 0, resetRelease;
  const transferKey = "cyberduel.cybercoins.purchase.v1:GestorQA";
  storage.set(key, "stale-admin-0000001"); storage.set(transferKey, "stale-transfer");
  account.request = async (route, options) => {
    if (route === "/api/admin/feira/credit") return { needsGoogleLogin: false, pendingGrant: null };
    assert.equal(route, "/api/admin/feira/reset-pending");
    assert.equal(options.method, "POST"); assert.equal(options.body.confirm, true); resetPosts++;
    return new Promise(resolve => { resetRelease = () => resolve({ count: 4 }); });
  };
  const resetButton = find(renewalModal, "title-admin-transfers-reset");
  const resetConfirm = find(renewalModal, "title-admin-transfers-confirm");
  assert.equal(resetButton.disabled, true, "Reset global exige confirmação explícita.");
  resetConfirm.checked = true; resetConfirm.events.change();
  const resetting = resetButton.click();
  await resetButton.click();
  assert.equal(resetPosts, 1, "Clique duplo não repete o reset.");
  assert.equal(resetConfirm.disabled, true);
  resetRelease(); await resetting;
  assert.equal(storage.has(key), false); assert.equal(storage.has(transferKey), false);
  assert.equal(resetButton.disabled, true); assert.equal(resetConfirm.checked, false);
  assert.equal(account.currency, 123);
  assert.match(find(renewalModal, "title-admin-transfers-status").textContent, /4 pendências encerradas/);
  assert.equal(find(renewalModal, "title-admin-feira-credit").textContent, "RECEBER 500 TIJOLINHOS · GRÁTIS");

  storage.set(key, "keep-after-failure");
  account.request = async () => { throw Error("Falha ao salvar reset"); };
  resetConfirm.checked = true; resetConfirm.events.change();
  await resetButton.click();
  assert.equal(storage.get(key), "keep-after-failure", "Falha mantém a tentativa local para conferência.");
  assert.match(find(renewalModal, "title-admin-transfers-status").textContent, /Falha ao salvar/);

  ui.modal = null;
  account.authProvider = "local";
  account.request = () => { assert.fail("Admin local não consulta o banco."); };
  account.listAdminAccounts = async () => [];
  ui.openAdminGrantDialog(); await tick();
  assert.equal(find(ui.modal, "title-admin-feira").hidden, true);
  await assert.rejects(account.grantFeiraCredit(), /administradora/);
  console.log("Painel da feira: botão exclusivo de admin Google, recuperação de pendência, clique duplo, renovação e valor efetivo sem gastar Cybercoins validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
