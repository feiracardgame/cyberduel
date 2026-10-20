const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag, cls = '', text = '') {
    this.tag = tag; this.children = []; this.textContent = text; this.dataset = {};
    this.attributes = {}; this.events = {};
    if (tag === 'img') { this.naturalWidth = 720; this.naturalHeight = 1009; }
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
  querySelector(selector) {
    return this.children.find(x => selector.startsWith('.') ? x.classList.contains(selector.slice(1)) : x.tag === selector)
      || this.children.map(child => child.querySelector(selector)).find(Boolean);
  }
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
assert.equal(illustrated.querySelector('img').src, undefined, 'Cartas viradas não carregam a ilustração.');
assert.equal(illustrated.querySelector('img').dataset.src, 'assets/cartas/game/otimizada.webp');
const optimizedAssets = context.window.CYBERDUEL_GAME_IMAGE_ASSETS;
context.window.CYBERDUEL_GAME_IMAGE_ASSETS = undefined;
assert.equal(ui.createBoosterResult({ tipo: 'monstro', nivel: 'baixa', nome: 'Ilustrada' }).querySelector('img').dataset.src, 'assets/cartas/original.png', 'Mantém fallback quando o catálogo otimizado não está disponível.');
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
  assert.equal(card.querySelector('small').textContent, `${tipo.toUpperCase()} · x1`);
  assert.ok(card.querySelector('.booster-card-art'), 'Cartas sem imagem mantêm a área da moldura.');
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
  const frames = new Map(), writes = [];
  let frameId = 0;
  const immediateFrame = context.requestAnimationFrame;
  context.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  context.cancelAnimationFrame = id => frames.delete(id);
  const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
  const scratch = dialog.querySelector('.booster-scratch'), pack = dialog.querySelector('.booster-pack');
  let widthReads = 0;
  Object.defineProperty(scratch, 'clientWidth', { get() { widthReads++; return 200; } });
  const scratchWrites = [];
  for (const node of [scratch, pack]) {
    const setProperty = node.style.setProperty;
    node.style.setProperty = (key, value) => { scratchWrites.push(key); return setProperty(key, value); };
  }
  scratch.events.pointerdown({ pointerId: 1, clientX: 100, button: 2 });
  assert.equal(widthReads, 0, 'Botão secundário não inicia o gesto.');
  scratch.events.pointerdown({ pointerId: 1, clientX: 100 });
  scratch.events.pointermove({ pointerId: 2, clientX: 200 });
  assert.equal(frames.size, 0, 'Outro dedo não altera o lacre.');
  scratch.events.pointermove({ pointerId: 1, clientX: 120 });
  scratch.events.pointermove({ pointerId: 1, clientX: 140 });
  assert.equal(frames.size, 1, 'O lacre agrupa movimentos no mesmo quadro.');
  assert.equal(scratchWrites.length, 0);
  flushFrame();
  assert.equal(scratchWrites.length, 3);
  assert.equal(scratch.style.getPropertyValue('--scratch'), .2, 'O quadro usa a coordenada mais recente.');
  assert.equal(widthReads, 1, 'A largura é medida uma vez antes das alterações de estilo.');
  scratch.events.pointermove({ pointerId: 1, clientX: 140 });
  assert.equal(frames.size, 0, 'Coordenadas repetidas não agendam trabalho.');
  scratch.events.pointermove({ pointerId: 1, clientX: 150 });
  scratch.events.pointercancel();
  assert.equal(frames.size, 0, 'Cancelar o lacre descarta o quadro pendente.');
  assert.equal(pack.classList.contains('is-tearing'), false);
  assert.equal(scratch.style.getPropertyValue('--scratch'), '');
  assert.equal(scratch.hasPointerCapture(1), false);
  let sealOpenings = 0;
  const buyHandler = buy.handler;
  buy.handler = () => sealOpenings++;
  scratch.events.pointerdown({ pointerId: 3, clientX: 100 });
  scratch.events.pointermove({ pointerId: 3, clientX: 120 });
  scratch.events.pointermove({ pointerId: 3, clientX: 220 });
  scratch.events.pointermove({ pointerId: 3, clientX: 240 });
  assert.equal(sealOpenings, 1, 'Cruzar o limite abre uma única vez, sem aguardar o quadro.');
  assert.equal(frames.size, 0);
  assert.equal(pack.classList.contains('is-tearing'), false);
  buy.handler = buyHandler;
  await buy.click();
  const results = find('title-booster-results');
  assert.equal(results.children.length, 3);
  assert.equal(results.children[0].children.at(-1).textContent, 'Comum');
  assert.ok(results.children[0].classList.contains('is-front'));
  assert.equal(results.style.getPropertyValue('--reveal-duration'), '160ms');
  assert.equal(results.children[2].attributes['aria-hidden'], 'true');
  const front = results.children[0];
  for (const node of [front, results]) {
    const setProperty = node.style.setProperty;
    node.style.setProperty = (key, value) => { writes.push(key); return setProperty(key, value); };
  }
  results.events.pointerdown({ pointerId: 4, clientX: 100, clientY: 200 });
  results.events.pointermove({ pointerId: 4, clientX: 120, clientY: 180 });
  results.events.pointermove({ pointerId: 4, clientX: 140, clientY: 150 });
  assert.equal(frames.size, 1, 'Eventos no mesmo quadro são agrupados.');
  assert.equal(writes.length, 0, 'Pointermove não altera estilos antes do quadro.');
  flushFrame();
  assert.equal(writes.length, 5);
  assert.ok(front.classList.contains('is-dragging'));
  assert.equal(front.style.getPropertyValue('--drag-x'), '40px');
  assert.equal(front.style.getPropertyValue('--drag-y'), '-50px', 'Carta acompanha o movimento antes de soltar.');
  results.events.pointermove({ pointerId: 4, clientX: 140, clientY: 150 });
  assert.equal(frames.size, 0, 'Coordenadas repetidas não agendam trabalho.');
  results.events.pointermove({ pointerId: 4, clientX: 140, clientY: -200 });
  flushFrame();
  assert.deepEqual(writes.slice(5), ['--drag-y', '--swipe-progress'], 'Movimento vertical não reescreve inclinação e brilho.');
  results.events.pointermove({ pointerId: 4, clientX: 140, clientY: -300 });
  flushFrame();
  assert.equal(writes.length, 7, 'Movimento além do limite não reescreve estilos.');
  results.events.pointermove({ pointerId: 4, clientX: 120, clientY: 160 });
  results.events.pointercancel();
  assert.equal(frames.size, 0, 'Cancelamento descarta o quadro pendente.');
  assert.equal(front.classList.contains('is-dragging'), false);
  assert.equal(front.style.getPropertyValue('--drag-y'), '');
  assert.equal(results.children.length, 3, 'Gesto cancelado não descarta uma carta.');
  results.events.pointerdown({ pointerId: 5, clientX: 100, clientY: 200 });
  results.events.pointermove({ pointerId: 5, clientX: 120, clientY: 80 });
  await results.events.pointerup({ pointerId: 5, clientX: 120, clientY: 80 });
  assert.equal(frames.size, 0, 'Soltar a carta não deixa quadros na próxima revelação.');
  context.requestAnimationFrame = immediateFrame;
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
  ui.openBoosterOpening({ id: 'cleanup', faction: 'raspcorp' });
  const cleanupScratch = ui.modal.querySelector('.booster-scratch');
  context.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  cleanupScratch.events.pointerdown({ pointerId: 6, clientX: 100 });
  cleanupScratch.events.pointermove({ pointerId: 6, clientX: 120 });
  ui.modalAfterClose();
  assert.equal(frames.size, 0, 'Fechar a abertura cancela o quadro pendente.');
  assert.equal(cleanupScratch.hasPointerCapture(6), false);
  context.requestAnimationFrame = immediateFrame;
  ui.modal = null;
  context.window.matchMedia = () => ({ matches: false });
  let matrixTick;
  context.setInterval = callback => { matrixTick = callback; return 1; };
  context.clearInterval = () => {};
  const matrixUI = Object.create(context.UI.prototype);
  matrixUI.element = ui.element;
  const rain = matrixUI.createMatrixRain();
  const coveredText = rain.children.map(stream => stream.children[0].textContent);
  matrixUI.modal = new Element('div', 'booster-fullscreen');
  matrixTick();
  assert.deepEqual(rain.children.map(stream => stream.children[0].textContent), coveredText, 'A abertura suspende as atualizações do menu encoberto.');
  matrixUI.modal = null;
  matrixTick();
  rain.children.forEach((stream, index) => assert.notEqual(stream.children[0].textContent, coveredText[index], 'O menu volta a atualizar depois da abertura.'));
  const waits = [];
  context.setTimeout = (callback, ms) => { waits.push(ms); callback(); };
  ui.deckBuilder.getCatalogByKey = () => new Map([['monstro:lendaria', { imagem: 'testArt' }]]);
  ui.account.openBooster = async () => ['baixa', 'media', 'alta', 'lendaria'].map(nivel => ({ tipo: 'monstro', nome: nivel, nivel }));
  ui.openBoosterOpening({ id: 'rarities', faction: 'raspcorp' });
  const rarityDialog = ui.modal.children[0];
  const rarityButton = rarityDialog.children.find(node => node.classList.contains('booster-buy'));
  const rarityResults = rarityDialog.children.find(node => node.classList.contains('title-booster-results'));
  for (const [rarity, duration] of [['baixa', 160], ['media', 380], ['alta', 700], ['lendaria', 1150]]) {
    waits.length = 0;
    await rarityButton.click();
    assert.equal(rarityResults.dataset.rarity, rarity);
    assert.equal(rarityResults.style.getPropertyValue('--reveal-duration'), `${duration}ms`);
    assert.equal(waits.at(-1), duration, 'O botão só libera após o efeito da raridade.');
    assert.equal(rarityResults.classList.contains('is-revealing'), false);
    assert.equal(rarityButton.disabled, false);
    if (rarity === 'lendaria') {
      const legendary = rarityDialog.children.find(node => node.classList.contains('booster-cutin'));
      assert.ok(waits.includes(1800));
      assert.equal(legendary.querySelector('img'), undefined, 'A apresentação lendária contém apenas efeitos.');
      assert.equal(rarityResults.children[0].style.getPropertyValue('--card-ratio'), 720 / 1009, 'A moldura segue a proporção da imagem decodificada.');
      assert.equal(legendary.querySelector('.booster-cutin-sparks').children.length, 10);
      assert.equal(legendary.hidden, true);
    }
  }
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
  console.log('Booster: raridades e tempos, lacre e cartas agrupados por quadro, largura em cache, cancelamento, compra única, reinício e falha validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
