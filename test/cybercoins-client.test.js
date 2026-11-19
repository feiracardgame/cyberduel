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
  crypto: webcrypto, console, requestAnimationFrame: callback => callback(),
  document: { createElement: tag => new Element(tag), body: new Element("body") }, window: {},
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
});
vm.runInContext(fs.readFileSync("js/account.js", "utf8") + "\nglobalThis.Account = CyberduelAccount;", context);
vm.runInContext(fs.readFileSync("js/title-ui.js", "utf8") + "\nglobalThis.UI = CyberduelTitleUI;", context);
const account = context.window.cyberduelAccount;
const key = "cyberduel.cybercoins.purchase.v1:Buyer";
const packages = require("../server/cybercoins").catalog();
const tick = () => new Promise(setImmediate);

(async () => {
  account.applyAuth({ username: "Buyer", token: "session", currency: 0 });
  const requests = [];
  account.request = async (route, options) => {
    requests.push({ route, ...options });
    throw Object.assign(Error("Confirmação pendente"), { code: "PAYMENT_PENDING" });
  };
  await assert.rejects(account.buyCybercoins("cybercoins-50"));
  const pending = account.getCybercoinPurchase();
  assert.equal(pending.bundleId, "cybercoins-50");
  assert.ok(!storage.get(key).includes("secret"));
  await assert.rejects(account.buyCybercoins("cybercoins-100"));
  assert.equal(requests.length, 1, "Uma tentativa pendente impede outro pacote.");
  const reloaded = new context.Account(); reloaded.user = "Buyer"; reloaded.token = "session";
  reloaded.request = account.request;
  await assert.rejects(reloaded.buyCybercoins("cybercoins-50"));
  assert.equal(requests[1].body.purchaseId, pending.id, "Recarregar mantém o ID, sem criar outra compra.");
  reloaded.user = "Other";
  assert.equal(reloaded.getCybercoinPurchase(), null, "Pendências ficam separadas por conta.");
  account.request = async () => { throw Object.assign(Error("Recusado"), { code: "FEIRA_DECLINED" }); };
  await assert.rejects(account.buyCybercoins("cybercoins-50"));
  assert.equal(storage.has(key), false);

  const ui = new context.UI({ account, callbacks: {} });
  ui.root = new Element("main");
  const find = (node, cls) => node.className?.split(" ").includes(cls) ? node : node.children.map(child => find(child, cls)).find(Boolean);
  const node = cls => find(ui.modal, cls);
  const enterAmount = value => { node("cybercoin-shop__amount").value = value; node("cybercoin-shop__amount").events.input(); };
  account.request = async () => packages;
  const balanceButton = find(ui.createTopbar(), "title-balance");
  assert.equal(balanceButton.hidden, false);
  balanceButton.click(); await tick();
  assert.ok(context.document.body.children.includes(ui.modal), "Loja fica fora do menu estreito.");
  assert.equal(node("cybercoin-shop__packages").children.length, 5, "Mantém todos os valores prontos.");
  for (const bundle of node("cybercoin-shop__packages").children)
    assert.equal(find(bundle, "cybercoin-shop__symbol").src, "assets/sprites/cybercoin.png");
  let opened = 0;
  context.window.open = (url, target, features) => {
    assert.equal(url, "https://feira-de-jogos.dev.br/");
    assert.equal(target, "_blank"); assert.equal(features, "noopener,noreferrer"); opened++;
  };
  node("cybercoin-shop__directions").children[1].click();
  assert.equal(node("cybercoin-shop__withdraw").hidden, true);
  assert.equal(node("cybercoin-shop__buy").textContent, "ACESSAR LOJA DA FEIRA");
  await node("cybercoin-shop__buy").click();
  assert.equal(opened, 1);
  // Mesmo se o backend habilitar compra direta, esta tela continua abrindo somente a loja.
  ui.modal = null;
  account.request = async route => {
    assert.equal(route, "/api/cybercoins/packages");
    return { ...packages, available: true };
  };
  ui.openCybercoinShop(); await tick();
  node("cybercoin-shop__directions").children[1].click();
  await node("cybercoin-shop__buy").click();
  assert.equal(opened, 2);

  ui.modal = null;
  account.currency = 100;
  let withdrawals = 0, expectedAmount = 37;
  account.request = async (route, options) => {
    if (route.endsWith("packages")) return { ...packages, withdrawAvailable: true, needsGoogleLogin: false };
    assert.equal(route, "/api/cybercoins/withdraw");
    assert.equal(options.body.bundleId, `cybercoins-${expectedAmount}`);
    assert.equal(options.body.feiraToken, undefined);
    withdrawals++;
    return { username: "Buyer", currency: account.currency - expectedAmount,
      purchase: { cybercoins: expectedAmount, tijolinhos: expectedAmount, direction: "withdraw" } };
  };
  ui.openCybercoinShop(); await tick();
  assert.equal(node("cybercoin-shop__withdraw").hidden, false);
  for (const invalid of ["", "0", "-1", "1.5", "1,5", "1e2", "Infinity", "9007199254740992", "abc"]) {
    enterAmount(invalid);
    assert.equal(node("cybercoin-shop__buy").disabled, true, `Rejeita ${invalid}`);
  }
  enterAmount("101");
  assert.equal(node("cybercoin-shop__buy").disabled, true);
  assert.match(node("profile-note").textContent, /insuficiente/);
  enterAmount("37");
  assert.equal(node("cybercoin-shop__buy").disabled, false);
  assert.match(node("cybercoin-shop__summary").textContent, /37 tijolinhos.*37 Cybercoins/);
  await node("cybercoin-shop__buy").click();
  assert.equal(account.currency, 63);
  assert.equal(withdrawals, 1);
  assert.equal(storage.has(key), false);
  assert.match(node("profile-note").textContent, /Resgate concluído.*37 tijolinhos/);
  assert.equal(ui.modalRequired, false);
  expectedAmount = 25;
  node("cybercoin-shop__packages").children[1].click();
  assert.equal(node("cybercoin-shop__amount").value, "");
  await node("cybercoin-shop__buy").click();
  assert.equal(account.currency, 38, "Os valores prontos continuam funcionando.");

  ui.modal = null;
  let returned = 0, notified = 0;
  const unsubscribe = account.onChange(() => notified++);
  ui.openCybercoinShop(() => returned++); await tick();
  ui.modalAfterClose();
  assert.equal(returned, 1); assert.equal(notified, 0);
  unsubscribe();

  ui.modal = null;
  const recovered = { id: "bank-pending-000001", bundleId: "cybercoins-37", direction: "withdraw", cybercoins: 37, tijolinhos: 37 };
  let googleMounts = 0, renewGoogle, needsGoogleLogin = true, retried = 0;
  account.mountGoogleButton = async (container, onError, onSuccess) => { googleMounts++; renewGoogle = onSuccess; };
  account.request = async (route, options) => {
    if (route.endsWith("packages")) return { ...packages, withdrawAvailable: true, needsGoogleLogin, pendingPurchase: recovered };
    assert.equal(route, "/api/cybercoins/resume");
    assert.equal(options.body.bundleId, recovered.bundleId);
    assert.equal(options.body.purchaseId, recovered.id);
    retried++;
    if (retried === 1) throw Object.assign(Error("Detalhe técnico do banco"), {
      code: "FEIRA_STATEMENT_UNAUTHORIZED", payload: { username: "Buyer", currency: 0 },
    });
    return { username: "Buyer", currency: 27, purchase: { cybercoins: 37, tijolinhos: 37, direction: "withdraw",
      settledTijolinhos: 10, spentCybercoins: 10, refundedCybercoins: 27 } };
  };
  ui.openCybercoinShop(); await tick();
  assert.equal(account.getCybercoinPurchase().id, recovered.id);
  assert.equal(googleMounts, 1);
  assert.equal(ui.modalRequired, true);
  assert.equal(ui.root.inert, true, "O menu ao fundo não oferece outras ações durante o login.");
  assert.equal(node("cybercoin-shop__content").hidden, true);
  assert.equal(node("booster-close").hidden, true, "A única ação visível é o login.");
  assert.equal(node("cybercoin-shop__auth").hidden, false);
  const authModal = ui.modal;
  ui.closeModal();
  assert.equal(ui.modal, authModal, "Escape e fechamento comum não ignoram o login.");
  needsGoogleLogin = false;
  await renewGoogle();
  assert.equal(ui.modalRequired, false);
  assert.equal(ui.root.inert, false);
  assert.equal(node("cybercoin-shop__content").hidden, false);
  assert.equal(node("cybercoin-shop__auth").hidden, true);
  enterAmount("17");
  assert.equal(node("cybercoin-shop__buy").disabled, true, "Pendência impede outro resgate.");
  await node("cybercoin-shop__retry").click();
  assert.equal(retried, 1);
  assert.equal(account.currency, 0);
  assert.doesNotMatch(node("title-dialog__error").textContent, /Detalhe técnico/);
  assert.equal(storage.has(key), true);
  assert.equal(googleMounts, 1, "Erro de permissão não cria um ciclo de login.");
  await node("cybercoin-shop__retry").click();
  assert.equal(retried, 2);
  assert.equal(account.currency, 27);
  assert.match(node("profile-note").textContent, /10 tijolinhos.*27 Cybercoins devolvidas/);
  assert.equal(storage.has(key), false);
  assert.equal(node("cybercoin-shop__retry").hidden, true);

  // Expiração entre abrir a tela e confirmar leva diretamente ao login, sem reenviar.
  account.request = async route => {
    if (route.endsWith("packages")) return { ...packages, withdrawAvailable: true, needsGoogleLogin };
    throw Object.assign(Error("JWT expirado"), { code: "FEIRA_LOGIN_REQUIRED" });
  };
  enterAmount("17");
  await node("cybercoin-shop__buy").click();
  assert.equal(ui.modalRequired, true);
  assert.equal(node("cybercoin-shop__content").hidden, true);
  assert.equal(googleMounts, 2);
  await renewGoogle();
  assert.equal(ui.modalRequired, false);
  assert.equal(node("cybercoin-shop__amount").value, "17", "Login preserva o valor digitado.");
  assert.match(node("cybercoin-shop__summary").textContent, /17 tijolinhos.*17 Cybercoins/);

  account.request = async () => { account.clear(); return { username: "Buyer", currency: 100, purchase: { cybercoins: 50 } }; };
  account.token = "session";
  await account.buyCybercoins("cybercoins-50");
  assert.equal(account.user, null, "Resposta atrasada não restaura a conta após sair.");
  assert.equal(account.currency, 0);
  account.applyAuth({ username: "Buyer", token: "session", currency: 123 });
  storage.set(key, JSON.stringify({ id: "cancelled-transfer-001", bundleId: "cybercoins-50", direction: "withdraw" }));
  account.request = async () => { throw Object.assign(Error("Encerrada pelo administrador"), { code: "PAYMENT_CANCELLED" }); };
  await assert.rejects(account.buyCybercoins("cybercoins-50", "withdraw", true), error => error.code === "PAYMENT_CANCELLED");
  assert.equal(storage.has(key), false, "Consulta cancelada libera a pendência local, sem recriar a transferência.");
  storage.set(key, JSON.stringify({ id: "cancelled-offline-001", bundleId: "cybercoins-50", direction: "withdraw" }));
  ui.modal = null;
  account.request = async () => ({ ...packages, pendingPurchase: null });
  ui.openCybercoinShop(); await tick();
  assert.equal(storage.has(key), false, "Reabrir a loja limpa uma pendência cancelada por outro administrador enquanto a aba estava offline.");
  assert.equal(find(ui.modal, "cybercoin-shop__retry").hidden, true);
  console.log("Cybercoins no cliente: loja externa da feira, saldo ao vivo, câmbio 1:1, reset de pendências, repetição e isolamento de contas validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
