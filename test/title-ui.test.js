const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let matrixTick, clearedTimer;
const storage = new Map();
const context = vm.createContext({
  console,
  setInterval(fn, delay) { assert.equal(delay, 180); matrixTick = fn; return 7; },
  clearInterval(id) { clearedTimer = id; }, clearTimeout() {},
  document: { hidden: false, removeEventListener() {}, body: { classList: { remove() {} } } },
  window: {},
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
});

for (const file of ["js/cartas.js", "js/deck-builder.js", "js/title-ui.js"])
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });

vm.runInContext(
  "globalThis.titleExports = { builder: window.cyberduelDeckBuilder, CyberduelTitleUI }",
  context,
);
const { builder, CyberduelTitleUI } = context.titleExports;
const ui = new CyberduelTitleUI({ deckBuilder: builder, callbacks: {} });

const emptySummary = ui.deckSummary();
assert.equal(emptySummary.deckReady, false);
assert.equal(emptySummary.total, 0);
assert.equal(emptySummary.valid, false);

assert.equal(ui.sanitizeRoomCode(" sala 12a34-5678 "), "123456");
assert.equal(ui.sanitizeRoomCode(null), "");
assert.equal(ui.sanitizeRoomCode("abc"), "");

const starter = builder.getStarterDeck();
assert.equal(builder.saveDeck(starter), true);
const readySummary = ui.deckSummary();
assert.equal(readySummary.deckReady, true);
assert.equal(readySummary.total, 20);
assert.equal(readySummary.valid, true);
assert.ok(readySummary.composition.baixa >= 6);
assert.ok(readySummary.composition.media >= 4);
assert.ok(readySummary.composition.alta >= 2);

const index = fs.readFileSync("index.html", "utf8");
assert.ok(
  index.indexOf("js/settings.js") < index.indexOf("js/title-ui.js") &&
    index.indexOf("js/multiplayer.js") < index.indexOf("js/title-ui.js") &&
    index.indexOf("js/title-ui.js") < index.indexOf("js/cenas/titulo.js"),
  "As dependências da tela inicial devem carregar antes da cena.",
);

const css = fs.readFileSync("css/style.css", "utf8");
assert.match(css, /\.title-terminal\s*\{/);
assert.match(css, /width:\s*min\(100vw, var\(--game-width-vh, [\d.]+vh\)\)/);
assert.match(css, /height:\s*min\(100vh, var\(--game-height-vw, [\d.]+vw\)\)/);
assert.match(css, /\.title-room-input\s*\{/);
assert.match(css, /\.title-action--solo\s*\{/);

console.log("Tela inicial, estado do deck e código de sala validados.");

const version = require('../package.json').version;
assert.ok(fs.readFileSync('js/title-ui.js', 'utf8').includes(`"title-system-id__mark", "v${version}"`), 'A versão do menu acompanha o projeto.');

// O efeito pertence ao menu DOM e não captura os cliques dos modos.
{
  const matrixUI = Object.create(CyberduelTitleUI.prototype);
  matrixUI.element = (tag, className, textContent) => ({
    tag, className, textContent, style: {}, children: [], attributes: {},
    append(...items) { this.children.push(...items); },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const rain = matrixUI.createMatrixRain();
  assert.equal(rain.attributes['aria-hidden'], 'true');
  assert.equal(rain.children.length, 24);
  for (const stream of rain.children) {
    assert.ok(parseFloat(stream.style.left) > 0 && parseFloat(stream.style.left) < 100);
    assert.ok(parseFloat(stream.style.animationDuration) >= 10);
    assert.ok(parseFloat(stream.style.animationDuration) < 22);
    assert.equal(stream.children.length, 2);
    assert.ok(stream.children[0].textContent.includes('\n'));
  }
  const before = rain.children.map(stream => stream.children[0].textContent);
  matrixTick();
  rain.children.forEach((stream, i) => {
    assert.notEqual(stream.children[0].textContent, before[i]);
    assert.equal(stream.children[0].textContent.length, before[i].length);
  });
  context.document.hidden = true;
  const hiddenText = rain.children[0].children[0].textContent;
  matrixTick();
  assert.equal(rain.children[0].children[0].textContent, hiddenText);
  matrixUI.destroy();
  assert.equal(clearedTimer, 7);
  assert.equal(matrixUI.matrixTimer, null);
  assert.ok(!fs.readFileSync('js/cenas/jogo.js', 'utf8').includes('chuvaMatrix'));
}
console.log('Matrix no menu: colunas, velocidades, acessibilidade e ausência na partida validadas.');

{
  let plays = 0, pauses = 0, volume = 0.3;
  context.Audio = class {
    constructor(src) { assert.equal(src, 'assets/sons/clique-menu.mp3'); }
    play() { plays++; return Promise.resolve(); }
    pause() { pauses++; }
  };
  const menu = Object.create(CyberduelTitleUI.prototype);
  menu.settings = { effects: () => volume };
  menu.menuCategories = [{ id: 'a' }, { id: 'b' }];
  menu.cardMenuState = { mode: 'categories', categoryIndex: 0, items: menu.menuCategories };
  menu.renderCardMenu = () => {};
  menu.selectCategory(0); assert.equal(plays, 0);
  menu.selectCategory(1); assert.equal(plays, 1);
  assert.equal(menu.menuClickAudio.volume, 0.3);
  menu.navigateCardMenu(1); assert.equal(plays, 1);
  menu.handleCardClick({ dataset: { position: "right" } }); assert.equal(plays, 2);
  volume = 0;
  menu.navigateCardMenu(1); assert.equal(plays, 2);
  menu.cardMenuState = { mode: 'options', optionIndex: 0, items: [{}, {}] };
  volume = 0.3;
  assert.equal(menu.commitRingDrag(-1), false); assert.equal(plays, 2);
  menu.cardMenuRing = [];
  menu.cardMenuEls = {};
  menu.updateCaption = () => {};
  menu.commitRingDrag(1); assert.equal(plays, 2);
  menu.triggerOptionAction = () => {};
  menu.handleCardClick({ dataset: { position: "center", itemIndex: "1" } });
  assert.equal(plays, 3);
  menu.handleCardMenuAction(); assert.equal(plays, 4);
  menu.cardMenuDragged = true;
  menu.handleCardClick({ dataset: { position: "right" } }); assert.equal(plays, 4);
  menu.destroy(); assert.equal(pauses, 1);
  assert.ok(fs.existsSync('assets/sons/clique-menu.mp3'));
}
console.log('Som do menu: clique nas cartas e ação, arraste silencioso, volume e limpeza validados.');
