const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag, cls = '', text = '') {
    this.tag = tag; this.children = []; this.textContent = text; this.dataset = {};
    this.attributes = {}; this.events = {}; this.style = { setProperty() {}, removeProperty() {} };
    const classes = new Set(cls.split(' '));
    this.classList = { add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x) };
  }
  append(...xs) { xs.forEach(x => { x.parent = this; this.children.push(x); }); }
  prepend(x) { x.parent = this; this.children.unshift(x); }
  replaceChildren(...xs) { this.children = []; this.append(...xs); }
  setAttribute(k, v) { this.attributes[k] = v; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(k, f) { this.events[k] = f; }
  querySelector(selector) { return this.children.find(x => x.classList.contains(selector.slice(1))); }
  remove() { this.parent.children = this.parent.children.filter(x => x !== this); }
  click() { if (!this.disabled) return this.handler?.(); }
}
const context = vm.createContext({ window: { matchMedia: () => ({ matches: true }) }, console, setTimeout: f => { f(); }, requestAnimationFrame: f => f() });
vm.runInContext(fs.readFileSync('js/title-ui.js', 'utf8') + '\nglobalThis.UI = CyberduelTitleUI;', context);
const ui = Object.create(context.UI.prototype);
ui.element = (tag, cls, text) => new Element(tag, cls, text);
ui.button = (cls, text, handler) => { const el = ui.element('button', cls, text); el.handler = handler; return el; };
ui.createModal = () => ui.modal = new Element('div');
ui.deckBuilder = { getCatalog: () => [], getCatalogByKey: () => new Map() };
let purchases = 0;
ui.account = { user: {}, currency: 500, boosterPrice: 100, notify() {}, async openBooster() {
  purchases++; this.currency -= 100;
  return [{ nome: 'Lenda', nivel: 'lendaria', tipo: 'monstro' }, { nome: 'Comum', nivel: 'baixa', tipo: 'monstro', quantidade: 2 }];
} };
(async () => {
  ui.openBoosterShop();
  const dialog = ui.modal.children[0];
  const find = cls => dialog.children.find(x => x.classList.contains(cls));
  const buy = find('booster-buy');
  await buy.click();
  const results = find('title-booster-results');
  assert.equal(results.children.length, 3);
  assert.equal(results.children[0].children.at(-1).textContent, 'Comum');
  assert.ok(results.children[0].classList.contains('is-front'));
  assert.equal(results.children[2].attributes['aria-hidden'], 'true');
  await buy.click();
  assert.equal(results.children.length, 2);
  const next = buy.click();
  assert.equal(buy.disabled, true);
  await next;
  assert.equal(results.children[0].children.at(-1).textContent, 'Lenda');
  assert.equal(find('booster-cutin').children[0].textContent, 'LENDÁRIA!');
  assert.equal(find('booster-cutin').hidden, true);
  assert.equal(purchases, 1);
  await buy.click();
  assert.equal(results.hidden, true);
  assert.equal(purchases, 1);
  ui.account.openBooster = async () => { throw new Error('Sem conexão'); };
  await buy.click();
  assert.equal(find('title-dialog__error').textContent, 'Sem conexão');
  assert.equal(buy.disabled, false);
  console.log('Booster: ordem, duplicatas, revelação individual, lendária, compra única, reinício e falha validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
