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
  account.request = async () => packages;
  const balanceButton = find(ui.createTopbar(), "title-balance");
  assert.equal(balanceButton.hidden, false, "O saldo de Cybercoins aparece no menu da conta conectada.");
  assert.match(balanceButton.textContent, /CYBERCOINS/);
  balanceButton.click(); await tick();
  const unavailable = ui.modal;
  assert.ok(context.document.body.children.includes(unavailable), "Loja usa a tela inteira, fora do menu estreito.");
  const bundles = find(unavailable, "cybercoin-shop__packages"), buy = find(unavailable, "cybercoin-shop__buy");
  assert.equal(bundles.children.length, 5);
  assert.ok(fs.existsSync("assets/sprites/cybercoin.png"));
  for (const bundle of bundles.children) assert.equal(find(bundle, "cybercoin-shop__symbol").src, "assets/sprites/cybercoin.png");
  assert.equal(buy.disabled, true); assert.equal(buy.textContent, "DISPONÍVEL EM BREVE");
  assert.equal(find(unavailable, "cybercoin-shop__token"), undefined, "Nenhum token precisa ser copiado pelo jogador.");
  bundles.children[4].click();
  assert.match(find(unavailable, "cybercoin-shop__summary").textContent, /250 tijolinhos.*500 Cybercoins/);
  assert.equal(bundles.children[4].attributes["aria-pressed"], "true");
  assert.equal(await buy.click(), undefined, "Botão indisponível não envia pagamento.");

  ui.modal = null;
  account.request = async (route, options) => {
    if (route.endsWith("packages")) return { ...packages, available: true };
    assert.equal(route, "/api/cybercoins/buy");
    assert.equal(options.body.bundleId, "cybercoins-50");
    assert.equal(options.body.feiraToken, undefined, "O JWT vem da sessão validada no servidor.");
    return { username: "Buyer", currency: 50, purchase: { cybercoins: 50, status: "completed" } };
  };
  ui.openCybercoinShop(); await tick();
  const enabled = ui.modal, confirm = find(enabled, "cybercoin-shop__buy");
  await confirm.click();
  assert.equal(account.currency, 50); assert.equal(storage.has(key), false);
  assert.match(find(enabled, "cybercoin-shop__balance").textContent, /50 Cybercoins/);
  assert.match(find(enabled, "profile-note").textContent, /Compra confirmada/);
  assert.equal(ui.modalRequired, false);

  ui.modal = null;
  let returned = 0, notified = 0;
  const unsubscribe = account.onChange(() => notified++);
  ui.openCybercoinShop(() => returned++); await tick();
  ui.modalAfterClose();
  assert.equal(returned, 1);
  assert.equal(notified, 0, "Retorno à loja mantém a interface montada até fechar a loja de origem.");
  unsubscribe();

  ui.modal = null;
  account.currency = 100;
  account.request = async (route, options) => {
    if (route.endsWith("packages")) return { ...packages, withdrawAvailable: true, needsGoogleLogin: false };
    assert.equal(route, "/api/cybercoins/withdraw");
    assert.equal(options.body.bundleId, "cybercoins-50");
    return { username: "Buyer", currency: 50, purchase: { cybercoins: 50, tijolinhos: 25, direction: "withdraw" } };
  };
  ui.openCybercoinShop(); await tick();
  find(ui.modal, "cybercoin-shop__directions").children[1].click();
  assert.match(find(ui.modal, "cybercoin-shop__summary").textContent, /50 Cybercoins.*25 tijolinhos/);
  await find(ui.modal, "cybercoin-shop__buy").click();
  assert.equal(account.currency, 50);
  assert.match(find(ui.modal, "profile-note").textContent, /25 tijolinhos enviados/);

  ui.modal = null;
  const recovered = { id: "bank-pending-000001", bundleId: "cybercoins-500", direction: "withdraw" };
  let googleMounts = 0, renewGoogle, needsGoogleLogin = true, retried = 0;
  account.mountGoogleButton = async (container, onError, onSuccess) => { googleMounts++; renewGoogle = onSuccess; };
  account.request = async (route, options) => {
    if (route.endsWith("packages")) return { ...packages, withdrawAvailable: true, needsGoogleLogin, pendingPurchase: recovered };
    assert.equal(route, "/api/cybercoins/resume");
    assert.equal(options.body.bundleId, "cybercoins-500", "A consulta retoma o valor original, sem usar o pacote que está sendo comparado.");
    assert.equal(options.body.purchaseId, recovered.id);
    retried++;
    if (retried === 1) throw Object.assign(Error("A feira recusou o acesso ao extrato."), {
      code: "FEIRA_STATEMENT_UNAUTHORIZED", payload: { username: "Buyer", currency: 0 },
    });
    return { username: "Buyer", currency: 300, purchase: { cybercoins: 500, tijolinhos: 250, direction: "withdraw",
      settledTijolinhos: 100, spentCybercoins: 200, refundedCybercoins: 300 } };
  };
  ui.openCybercoinShop(); await tick();
  assert.equal(account.getCybercoinPurchase().id, recovered.id, "Pendência é recuperada do servidor após perder o armazenamento local.");
  assert.equal(find(ui.modal, "cybercoin-shop__buy").disabled, true);
  assert.equal(googleMounts, 1, "JWT expirado pede autorização pelo botão oficial do Google.");
  const pendingModal = ui.modal;
  const pendingPackages = find(pendingModal, "cybercoin-shop__packages");
  pendingPackages.children[0].click();
  assert.equal(pendingPackages.children[0].attributes["aria-pressed"], "true", "Pendência de 500 não impede selecionar 20 Cybercoins.");
  const directionButtons = find(pendingModal, "cybercoin-shop__directions").children;
  assert.equal(directionButtons[0].disabled, false);
  directionButtons[0].click();
  assert.match(find(pendingModal, "cybercoin-shop__summary").textContent, /10 tijolinhos.*20 Cybercoins/);
  directionButtons[1].click();
  assert.match(find(pendingModal, "cybercoin-shop__summary").textContent, /20 Cybercoins.*10 tijolinhos/);
  assert.match(find(pendingModal, "cybercoin-shop__summary").textContent, /Se a feira creditar menos, a diferença de Cybercoins será devolvida/);
  assert.match(find(pendingModal, "cybercoin-shop__pending").textContent, /500 Cybercoins.*250 tijolinhos/);
  assert.equal(retried, 0, "Comparar valores e trocar abas não transfere dinheiro.");
  needsGoogleLogin = false;
  await renewGoogle();
  assert.equal(find(pendingModal, "cybercoin-shop__packages").children[0].attributes["aria-pressed"], "true", "Renovar o Google preserva o pacote escolhido.");
  assert.equal(googleMounts, 1);
  assert.equal(find(pendingModal, "cybercoin-shop__buy").disabled, true, "Uma pendência continua impedindo outra transferência.");
  await find(pendingModal, "cybercoin-shop__retry").click();
  assert.equal(retried, 1);
  assert.equal(account.currency, 0, "Saldo reservado no servidor é sincronizado mesmo quando o banco retorna erro.");
  assert.match(find(pendingModal, "cybercoin-shop__balance").textContent, /0 Cybercoins/);
  assert.match(find(pendingModal, "title-dialog__error").textContent, /recusou o acesso ao extrato/);
  assert.match(find(pendingModal, "profile-note").textContent, /continua pendente/);
  assert.equal(storage.has(key), true);
  assert.equal(googleMounts, 1, "Recusa do extrato não pede login repetidamente.");
  await find(pendingModal, "cybercoin-shop__retry").click();
  assert.equal(retried, 2);
  assert.equal(account.currency, 300);
  assert.match(find(pendingModal, "cybercoin-shop__balance").textContent, /300 Cybercoins/);
  assert.match(find(pendingModal, "profile-note").textContent, /100 tijolinhos enviados.*Custo: 200 Cybercoins.*300 Cybercoins devolvidas/);
  assert.equal(storage.has(key), false);
  assert.equal(find(pendingModal, "cybercoin-shop__retry").hidden, true);
  assert.equal(find(pendingModal, "cybercoin-shop__buy").disabled, false);

  account.request = async () => { account.clear(); return { username: "Buyer", currency: 100, purchase: { cybercoins: 50 } }; };
  account.token = "session";
  await account.buyCybercoins("cybercoins-50");
  assert.equal(account.user, null, "Resposta atrasada não restaura a conta após sair.");
  assert.equal(account.currency, 0);
  console.log("Cybercoins no cliente: loja desativada, pacotes, seleção, confirmação, token temporário, repetição e isolamento de contas validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
