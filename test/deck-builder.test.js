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
assert.ok(catalog.length >= 20, "A coleção deve oferecer escolhas para o deck.");

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
    (entry) =>
      entry.quantidade <= limits.get(`${entry.tipo}:${entry.nome}`),
  ),
  "O deck aleatório deve respeitar o limite de cópias.",
);

const card = catalog.find((entry) => entry.limite === 3);
let deck = builder.changeQuantity([], card, 1);
assert.equal(builder.quantity(deck, card), 1);
deck = builder.changeQuantity(deck, card, 99);
assert.equal(builder.quantity(deck, card), 3, "O controle + respeita cópias máximas.");
deck = builder.changeQuantity(deck, card, -99);
assert.equal(builder.quantity(deck, card), 0, "O controle − nunca gera quantidade negativa.");

let fullDeck = [];
for (const catalogCard of catalog)
  fullDeck = builder.changeQuantity(fullDeck, catalogCard, 99);
assert.equal(builder.total(fullDeck), 20, "A interface deve bloquear a 21ª carta.");

const effects = builder.filterCatalog({ filter: "efeito" });
assert.ok(effects.length > 0);
assert.ok(effects.every((entry) => entry.tipo === "efeito"));
assert.ok(
  builder
    .filterCatalog({ query: card.nome.toLocaleUpperCase("pt-BR") })
    .some((entry) => entry.key === card.key),
  "A busca deve ignorar diferenças entre maiúsculas e minúsculas.",
);
assert.equal(
  builder.filterCatalog({ query: "registro inexistente 2067" }).length,
  0,
);

const ui = new CyberduelDeckBuilderUI({
  scene: {
    textures: {
      get: () => ({ getSourceImage: () => ({ src: "/arte-teste.png" }) }),
    },
  },
  builder,
  onExit() {},
});
assert.equal(ui.imageSource(card), "/arte-teste.png");
assert.equal(ui.levelLabel({ nivel: "lendaria" }), "LENDÁRIA");
assert.equal(ui.typeLabel("terreno"), "DOMÍNIO");
assert.equal(ui.pluralLevel("media", 2), "médias");
const mobileSummary = ui.mobileSummary(builder.status(starter));
assert.equal(mobileSummary.count, "20/20");
assert.equal(mobileSummary.progress, "100%");
assert.equal(mobileSummary.ready, true);
assert.deepEqual(
  Array.from(mobileSummary.requirements, (requirement) => Array.from(requirement)),
  [
    ["B", starterStatus.composition.baixa, 6],
    ["M", starterStatus.composition.media, 4],
    ["A", starterStatus.composition.alta, 2],
  ],
);

const index = fs.readFileSync("index.html", "utf8");
assert.ok(
  index.indexOf("js/deck-builder.js") < index.indexOf("js/deck-builder-ui.js") &&
    index.indexOf("js/deck-builder-ui.js") < index.indexOf("js/cenas/deck-builder.js"),
  "A lógica, a interface e a cena devem carregar nessa ordem.",
);

const css = fs.readFileSync("css/style.css", "utf8");
assert.match(css, /width:\s*min\(100vw, 50vh\)/);
assert.match(css, /height:\s*min\(100vh, 200vw\)/);
assert.match(css, /container:\s*forge \/ inline-size/);
assert.match(css, /data-mobile-view="collection"/);
assert.match(css, /env\(safe-area-inset-bottom\)/);

console.log("Deck Forge, regras, filtros e limites validados.");
