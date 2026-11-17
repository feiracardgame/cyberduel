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
  document: { createElement: tag => new Element(tag) }, window: {},
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
  ui.openCybercoinShop(); await tick();
  const unavailable = ui.modal;
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
  const recovered = { id: "bank-pending-000001", bundleId: "cybercoins-50", direction: "withdraw" };
  let googleMounts = 0;
  account.mountGoogleButton = async () => { googleMounts++; };
  account.request = async () => ({ ...packages, withdrawAvailable: true, needsGoogleLogin: true, pendingPurchase: recovered });
  ui.openCybercoinShop(); await tick();
  assert.equal(account.getCybercoinPurchase().id, recovered.id, "Pendência é recuperada do servidor após perder o armazenamento local.");
  assert.equal(find(ui.modal, "cybercoin-shop__buy").disabled, true);
  assert.equal(googleMounts, 1, "JWT expirado pede autorização pelo botão oficial do Google.");
  assert.equal(find(ui.modal, "cybercoin-shop__directions").children[0].disabled, true);
  storage.delete(key);

  account.request = async () => { account.clear(); return { username: "Buyer", currency: 100, purchase: { cybercoins: 50 } }; };
  account.token = "session";
  await account.buyCybercoins("cybercoins-50");
  assert.equal(account.user, null, "Resposta atrasada não restaura a conta após sair.");
  assert.equal(account.currency, 0);
  console.log("Cybercoins no cliente: loja desativada, pacotes, seleção, confirmação, token temporário, repetição e isolamento de contas validados.");
})().catch(error => { console.error(error); process.exitCode = 1; });
