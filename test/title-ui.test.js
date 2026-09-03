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
assert.match(css, /width:\s*min\(100vw, 50vh\)/);
assert.match(css, /height:\s*min\(100vh, 200vw\)/);
assert.match(css, /\.title-room-input\s*\{/);
assert.match(css, /\.title-action--solo\s*\{/);

console.log("Tela inicial, estado do deck e código de sala validados.");
