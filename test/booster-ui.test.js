const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag, cls = '', text = '') {
    this.tag = tag; this.children = []; this.textContent = text; this.dataset = {};
    this.attributes = {}; this.events = {};
    const properties = new Map();
    this.style = { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key), getPropertyValue: key => properties.get(key) || '' };
    this.clientWidth = 200;
    const classes = new Set(cls.split(' '));
    this.classList = { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x) };
  }
  append(...xs) { xs.forEach(x => { x.parent = this; this.children.push(x); }); }
  prepend(x) { x.parent = this; this.children.unshift(x); }
  replaceChildren(...xs) { this.children = []; this.append(...xs); }
  setAttribute(k, v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(k, f) { this.events[k] = f; }
  setPointerCapture(id) { this.pointerId = id; }
  hasPointerCapture(id) { return this.pointerId === id; }
  releasePointerCapture() { this.pointerId = null; this.events.lostpointercapture?.(); }
  querySelector(selector) { return this.children.find(x => selector.startsWith('.') ? x.classList.contains(selector.slice(1)) : x.tag === selector); }
  remove() { this.parent.children = this.parent.children.filter(x => x !== this); }
  click() { if (!this.disabled) return this.handler?.(); }
}
const context = vm.createContext({ document: { body: new Element("body") }, window: { matchMedia: () => ({ matches: true }) }, console, setTimeout: f => { f(); }, requestAnimationFrame: f => { f(); return null; }, cancelAnimationFrame() {} });
vm.runInContext(fs.readFileSync('js/title-ui.js', 'utf8') + '\nglobalThis.UI = CyberduelTitleUI;', context);
const ui = Object.create(context.UI.prototype);
assert.equal(ui.boosterFactions().find(faction => faction[0] === 'raspcorp')[3], '#4da6ff');
ui.element = (tag, cls, text) => new Element(tag, cls, text);
ui.button = (cls, text, handler) => { const el = ui.element('button', cls, text); el.handler = handler; return el; };
ui.createModal = () => ui.modal = new Element('div');
ui.closeModal = () => { ui.modal = null; };
ui.deckBuilder = { getCatalog: () => [], getCatalogByKey: () => new Map() };
context.window.CYBERDUEL_IMAGE_ASSETS = { testArt: 'assets/cartas/original.png' };
context.window.CYBERDUEL_GAME_IMAGE_ASSETS = { testArt: 'assets/cartas/game/otimizada.webp' };
ui.deckBuilder.getCatalogByKey = () => new Map([['monstro:Ilustrada', { imagem: 'testArt', nivel: 'baixa' }]]);
const illustrated = ui.createBoosterResult({ tipo: 'monstro', nivel: 'baixa', nome: 'Ilustrada' });
assert.equal(illustrated.children[0].src, undefined, 'Cartas viradas não carregam a ilustração.');
assert.equal(illustrated.children[0].dataset.src, 'assets/cartas/game/otimizada.webp');
const optimizedAssets = context.window.CYBERDUEL_GAME_IMAGE_ASSETS;
context.window.CYBERDUEL_GAME_IMAGE_ASSETS = undefined;
assert.equal(ui.createBoosterResult({ tipo: 'monstro', nivel: 'baixa', nome: 'Ilustrada' }).children[0].dataset.src, 'assets/cartas/original.png', 'Mantém fallback quando o catálogo otimizado não está disponível.');
context.window.CYBERDUEL_GAME_IMAGE_ASSETS = optimizedAssets;
ui.deckBuilder.getCatalogByKey = () => new Map();
let purchases = 0;
let openings = 0;
ui.account = { user: {}, currency: 500, boosterPrice: 100, notify() {}, boosters: [], async buyBooster() {
  purchases++; this.currency -= 100;
  this.boosters = [{ id: "owned-pack", faction: "raspcorp" }];
}, async openBooster(id) {
  assert.equal(id, "owned-pack");
  openings++;
  this.boosters = [];
  return [{ nome: 'Lenda', nivel: 'lendaria', tipo: 'monstro' }, { nome: 'Comum', nivel: 'baixa', tipo: 'monstro', quantidade: 2 }];
} };
const mixed = [
  { tipo: 'efeito', nivel: 'utilidade' },
  { tipo: 'monstro', nivel: 'lendaria' },
  { tipo: 'terreno', nivel: 'utilidade' },
  { tipo: 'monstro', nivel: 'baixa' },
  { tipo: 'monstro', nivel: 'alta' },
  { tipo: 'monstro', nivel: 'media' },
].sort((a, b) => ui.boosterRevealOrder(a) - ui.boosterRevealOrder(b));
assert.deepEqual(mixed.map(card => card.tipo === 'monstro' ? card.nivel : card.tipo),
  ['baixa', 'media', 'alta', 'lendaria', 'terreno', 'efeito']);
for (const tipo of ['terreno', 'efeito']) {
  const card = ui.createBoosterResult({ tipo, nivel: 'utilidade', nome: tipo });
  assert.equal(card.children[0].textContent, `${tipo.toUpperCase()} · x1`);
}
(async () => {
  ui.openBoosterShop();
  const shop = ui.modal.children[0];
  await shop.children.find(x => x.classList.contains('booster-buy')).click();
  assert.equal(purchases, 1);
  assert.equal(openings, 0);
  assert.equal(ui.account.boosters.length, 1);
  assert.equal(shop.children.find(x => x.classList.contains('title-booster-results')).hidden, true);
  ui.modal = null;
  ui.account.currency = 0; // Abrir um pacote já pago não exige saldo.
  ui.openBoosterOpening(ui.account.boosters[0]);
  assert.ok(ui.modal.classList.contains('booster-fullscreen'));
  const dialog = ui.modal.children[0];
  const find = cls => dialog.children.find(x => x.classList.contains(cls));
  const buy = find('booster-buy');
  await buy.click();
  const results = find('title-booster-results');
  assert.equal(results.children.length, 3);
  assert.equal(results.children[0].children.at(-1).textContent, 'Comum');
  assert.ok(results.children[0].classList.contains('is-front'));
  assert.equal(results.children[2].attributes['aria-hidden'], 'true');
  const front = results.children[0];
  results.events.pointerdown({ pointerId: 4, clientX: 100, clientY: 200 });
  results.events.pointermove({ pointerId: 4, clientX: 140, clientY: 150 });
  assert.ok(front.classList.contains('is-dragging'));
  assert.equal(front.style.getPropertyValue('--drag-x'), '40px');
  assert.equal(front.style.getPropertyValue('--drag-y'), '-50px', 'Carta acompanha o movimento antes de soltar.');
  results.events.pointercancel();
  assert.equal(front.classList.contains('is-dragging'), false);
  assert.equal(front.style.getPropertyValue('--drag-y'), '');
  assert.equal(results.children.length, 3, 'Gesto cancelado não descarta uma carta.');
  results.events.pointerdown({ pointerId: 5, clientX: 100, clientY: 200 });
  results.events.pointermove({ pointerId: 5, clientX: 120, clientY: 80 });
  await results.events.pointerup({ pointerId: 5, clientX: 120, clientY: 80 });
  assert.equal(results.children.length, 2);
  const next = buy.click();
  assert.equal(buy.disabled, true);
  await next;
  assert.equal(results.children[0].children.at(-1).textContent, 'Lenda');
  assert.equal(find('booster-cutin').children[0].textContent, 'LENDÁRIA!');
  assert.equal(find('booster-cutin').hidden, true);
  assert.equal(purchases, 1);
  await buy.click();
  assert.equal(ui.modal.children[0].attributes['aria-label'], 'Inventário de boosters');
  assert.equal(purchases, 1);
  assert.equal(openings, 1);
  ui.modal = null;
  ui.openBoosterOpening({ id: "owned-pack", faction: "raspcorp" });
  ui.account.openBooster = async () => { throw new Error('Sem conexão'); };
  const failedDialog = ui.modal.children[0];
  const retry = failedDialog.children.find(x => x.classList.contains('booster-buy'));
  await retry.click();
  assert.equal(failedDialog.children.find(x => x.classList.contains('title-dialog__error')).textContent, 'Sem conexão');
  assert.equal(retry.disabled, false);
  ui.modal = null;
  context.window.CYBERDUEL_DEMO_MODE = true;
  ui.openBoosterShop();
  const demoDialog = ui.modal.children[0];
  const demoTabs = demoDialog.children.find(node => node.classList.contains('booster-factions')).children;
  assert.equal(demoTabs.length, 5, 'Todos os boosters continuam visíveis.');
  assert.equal(demoTabs.filter(button => !button.disabled).length, 2);
  for (const button of demoTabs.filter(button => button.disabled)) {
    assert.equal(button.children[0].textContent, 'Disponível apenas na feira de jogos.');
    button.click();
  }
  assert.equal(purchases, 1, 'Booster bloqueado não pode ser comprado.');
  ui.modal = null;
  context.window.CYBERDUEL_DEMO_MODE = false;
  ui.openBoosterShop();
  assert.ok(ui.modal.children[0].children.find(node => node.classList.contains('booster-factions')).children.every(button => !button.disabled));
  console.log('Booster: ordem, duplicatas, revelação individual, lendária, compra única, reinício e falha validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
