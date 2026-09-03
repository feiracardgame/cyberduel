const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const context = vm.createContext({
  console,
  window: {},
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
});

for (const file of [
  "js/cartas.js",
  "js/deck-builder.js",
  "js/deck-builder-ui.js",
]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
vm.runInContext(
  "globalThis.exportsForTest = { builder: window.cyberduelDeckBuilder, CyberduelDeckBuilderUI }",
  context,
);

const { builder, CyberduelDeckBuilderUI } = context.exportsForTest;
const catalog = builder.getCatalog();
assert.ok(
  catalog.length >= 20,
  "A coleção deve oferecer escolhas para o deck.",
);
assert.equal(
  builder.getCatalog(),
  catalog,
  "O catálogo deve ser reutilizado entre renderizações.",
);

const starter = builder.getStarterDeck();
const starterStatus = builder.status(starter);
assert.equal(starterStatus.total, 20);
assert.equal(starterStatus.valid, true);
assert.equal(starterStatus.slotsRemaining, 0);
assert.ok(starterStatus.composition.baixa >= 6);
assert.ok(starterStatus.composition.media >= 4);
assert.ok(starterStatus.composition.alta >= 2);

function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const randomDeckA = builder.getRandomDeck(seededRandom(2067));
const randomDeckB = builder.getRandomDeck(seededRandom(42));
assert.equal(builder.isValid(randomDeckA), true);
assert.equal(builder.isValid(randomDeckB), true);
assert.equal(builder.total(randomDeckA), 20);
assert.notEqual(
  JSON.stringify(randomDeckA),
  JSON.stringify(randomDeckB),
  "Sementes diferentes devem produzir decks diferentes.",
);
const limits = new Map(catalog.map((entry) => [entry.key, entry.limite]));
assert.ok(
  randomDeckA.every(
    (entry) => entry.quantidade <= limits.get(`${entry.tipo}:${entry.nome}`),
  ),
  "O deck aleatório deve respeitar o limite de cópias.",
);

const card = catalog.find((entry) => entry.limite === 3);
let deck = builder.changeQuantity([], card, 1);
assert.equal(builder.quantity(deck, card), 1);
deck = builder.changeQuantity(deck, card, 99);
assert.equal(
  builder.quantity(deck, card),
  3,
  "O controle + respeita cópias máximas.",
);
deck = builder.changeQuantity(deck, card, -99);
assert.equal(
  builder.quantity(deck, card),
  0,
  "O controle − nunca gera quantidade negativa.",
);

builder.setAccountSession("colecionador", null, { [card.key]: 1 });
const ownedDeck = builder.changeQuantity([], card, 99);
assert.equal(
  builder.quantity(ownedDeck, card),
  1,
  "A conta nunca pode colocar no deck mais cópias do que possui.",
);
builder.setAccountSession(null, null, null);

let fullDeck = [];
for (const catalogCard of catalog)
  fullDeck = builder.changeQuantity(fullDeck, catalogCard, 99);
assert.equal(
  builder.total(fullDeck),
  20,
  "A interface deve bloquear a 21ª carta.",
);

const effects = builder.filterCatalog({ filter: "efeito" });
assert.ok(effects.length > 0);
assert.ok(effects.every((entry) => entry.tipo === "efeito"));
const byFaction = builder.filterCatalog({ order: "faccao" });
for (let index = 1; index < byFaction.length; index++) {
  const previous = String(byFaction[index - 1].booster || "");
  const current = String(byFaction[index].booster || "");
  assert.ok(
    previous.localeCompare(current, "pt-BR") <= 0,
    "A ordenação por facção deve ser alfabética.",
  );
}
assert.ok(
  builder
    .filterCatalog({ query: card.nome.toLocaleUpperCase("pt-BR") })
    .some((entry) => entry.key === card.key),
  "A busca deve ignorar diferenças entre maiúsculas e minúsculas.",
);
assert.ok(
  builder
    .filterCatalog({ query: "estagiario" })
    .some((entry) => entry.nome.includes("Estagiário")),
  "A busca deve ignorar acentos para responder melhor no celular.",
);
assert.equal(
  builder.filterCatalog({ query: "registro inexistente 2067" }).length,
  0,
);

let textureReads = 0;
const ui = new CyberduelDeckBuilderUI({
  scene: {
    textures: {
      get: () => {
        textureReads++;
        return { getSourceImage: () => ({ src: "/arte-teste.png" }) };
      },
    },
  },
  builder,
  onExit() {},
});
assert.equal(ui.imageSource(card), "/arte-teste.png");
assert.equal(ui.imageSource(card), "/arte-teste.png");
assert.equal(
  textureReads,
  1,
  "A URL da textura deve ser consultada apenas uma vez.",
);

// Chrome pode entregar um ImageBitmap sem src para a textura Phaser. O DOM
// deve preferir o manifesto HTTP e nem consultar essa fonte interna.
context.URL = URL;
context.document = { baseURI: "http://duelo.test/" };
context.window.CYBERDUEL_IMAGE_ASSETS = {
  [card.imagem]: "assets/cartas/arte-com-acento-á.png",
};
let bitmapReads = 0;
const chromeUi = new CyberduelDeckBuilderUI({
  scene: {
    textures: {
      get: () => {
        bitmapReads++;
        return { getSourceImage: () => ({ width: 856, height: 1200 }) };
      },
    },
  },
  builder,
  onExit() {},
});
assert.equal(
  chromeUi.imageSource(card),
  "http://duelo.test/assets/cartas/arte-com-acento-%C3%A1.png",
);
assert.equal(bitmapReads, 0, "A arte HTML não deve depender do ImageBitmap.");
assert.equal(ui.levelLabel({ nivel: "lendaria" }), "LENDÁRIA");
assert.equal(ui.typeLabel("efeito"), "EFEITO");
assert.equal(ui.typeLabel("terreno"), "TERRENO");
assert.equal(ui.pluralLevel("media", 2), "médias");
assert.equal(ui.orderLabel("crescente"), "Nível ↑");
assert.equal(ui.orderLabel("decrescente"), "Nível ↓");
assert.equal(ui.orderLabel("faccao"), "Facção A-Z");
assert.equal(ui.nextOrder("crescente"), "decrescente");
assert.equal(ui.nextOrder("decrescente"), "faccao");
assert.equal(ui.nextOrder("faccao"), "crescente");
const mobileSummary = ui.mobileSummary(builder.status(starter));
assert.equal(mobileSummary.count, "20/20");
assert.equal(mobileSummary.progress, "100%");
assert.equal(mobileSummary.ready, true);
assert.deepEqual(
  Array.from(mobileSummary.requirements, (requirement) =>
    Array.from(requirement),
  ),
  [
    ["B", starterStatus.composition.baixa, 6],
    ["M", starterStatus.composition.media, 4],
    ["A", starterStatus.composition.alta, 2],
  ],
);

const railListeners = new Map();
const railClasses = new Set();
const filterRail = {
  scrollLeft: 40,
  addEventListener(type, listener) {
    railListeners.set(type, listener);
  },
  classList: {
    add: (className) => railClasses.add(className),
    remove: (className) => railClasses.delete(className),
  },
  setPointerCapture() {},
};
ui.enableHorizontalDrag(filterRail);
railListeners.get("pointerdown")({
  pointerType: "mouse",
  button: 0,
  clientX: 100,
  pointerId: 1,
});
railListeners.get("pointermove")({ clientX: 70 });
assert.equal(
  filterRail.scrollLeft,
  70,
  "Arrastar deve mover a faixa de filtros.",
);
assert.equal(railClasses.has("is-dragging"), true);
railListeners.get("pointerup")();
assert.equal(railClasses.has("is-dragging"), false);
let clickBlocked = false;
railListeners.get("click")({
  preventDefault() {
    clickBlocked = true;
  },
  stopPropagation() {},
});
assert.equal(
  clickBlocked,
  true,
  "Arrastar não deve selecionar um filtro sem querer.",
);
let wheelBlocked = false;
railListeners.get("wheel")({
  deltaX: 0,
  deltaY: 25,
  preventDefault() {
    wheelBlocked = true;
  },
});
assert.equal(
  filterRail.scrollLeft,
  95,
  "A rodinha deve rolar os filtros para o lado.",
);
assert.equal(wheelBlocked, true);

const index = fs.readFileSync("index.html", "utf8");
assert.ok(
  index.indexOf("js/deck-builder.js") <
    index.indexOf("js/deck-builder-ui.js") &&
    index.indexOf("js/deck-builder-ui.js") <
      index.indexOf("js/cenas/deck-builder.js"),
  "A lógica, a interface e a cena devem carregar nessa ordem.",
);

const deckBuilderUiSource = fs.readFileSync("js/deck-builder-ui.js", "utf8");
assert.doesNotMatch(deckBuilderUiSource, /PROTOCOLO|DOMÍNIO/);
assert.match(deckBuilderUiSource, /Todos os requisitos atendidos/);

const css = fs.readFileSync("css/style.css", "utf8");
assert.match(css, /width:\s*min\(100vw, 50vh\)/);
assert.match(css, /height:\s*min\(100vh, 200vw\)/);
assert.match(css, /container:\s*forge \/ inline-size/);
assert.match(css, /data-mobile-view="collection"/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /\.forge-filters\s*\{[^}]*overflow:\s*auto hidden/s);
assert.match(css, /\.forge-filters\s*\{[^}]*touch-action:\s*pan-x/s);
assert.match(css, /\.forge-filters\s*\{[^}]*scroll-snap-type:\s*x proximity/s);
assert.match(deckBuilderUiSource, /ARRASTE PARA VER MAIS/);

console.log("Deck Forge, regras, filtros e limites validados.");
