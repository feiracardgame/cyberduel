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
  location: { hostname: "localhost", port: "80" },
  CenaPreload: class {},
  CenaTitulo: class {},
  CenaTransicao: class {},
  Phaser: {
    AUTO: 0,
    Scene: class {},
    Scale: { FIT: 0, CENTER_BOTH: 0 },
    Game: class {},
    Utils: { Array: { Shuffle: (cards) => cards.reverse() } },
  },
});

for (const file of [
  "js/cartas.js",
  "js/deck-builder.js",
  "js/deck-builder-ui.js",
  "js/multiplayer.js",
  "js/cenas/jogo.js",
  "js/cenas/deck-builder.js",
  "js/main.js",
]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
vm.runInContext(
  "globalThis.testExports = { Partida, Carta, CenaJogo, CenaDeckBuilder, CyberduelDeckBuilderUI, multiplayer: window.cyberduelMultiplayer, deckBuilder: window.cyberduelDeckBuilder }",
  context,
);

const {
  Partida,
  Carta,
  CenaJogo,
  CenaDeckBuilder,
  CyberduelDeckBuilderUI,
  multiplayer,
  deckBuilder,
} = context.testExports;
assert.deepEqual(
  Array.from(deckBuilder.getDeckForMatch()),
  [],
  "Um jogador novo deve começar sem cartas geradas automaticamente.",
);
const starterDeck = deckBuilder.getStarterDeck();
assert.equal(
  deckBuilder.getCatalog().every(
    (card) =>
      card.descricao && card.nivel && Array.isArray(card.partesDescricao),
  ),
  true,
);
assert.equal(deckBuilder.total(starterDeck), 20);
assert.equal(deckBuilder.isValid(starterDeck), true);
const starterComposition = deckBuilder.composition(starterDeck);
assert.ok(starterComposition.baixa >= 6);
assert.ok(starterComposition.media >= 4);
assert.ok(starterComposition.alta >= 2);
assert.equal(deckBuilder.saveDeck(starterDeck), true);
assert.equal(deckBuilder.total(deckBuilder.getSavedDeck()), 20);

const initialStatus = deckBuilder.status([]);
assert.equal(initialStatus.total, 0);
assert.equal(initialStatus.slotsRemaining, 20);
assert.deepEqual(
  { ...initialStatus.remaining },
  { baixa: 6, media: 4, alta: 2 },
);

const firstCatalogCard = deckBuilder.getCatalog()[0];
let editableDeck = deckBuilder.changeQuantity([], firstCatalogCard, 1);
assert.equal(deckBuilder.quantity(editableDeck, firstCatalogCard), 1);
editableDeck = deckBuilder.changeQuantity(editableDeck, firstCatalogCard, 99);
assert.equal(
  deckBuilder.quantity(editableDeck, firstCatalogCard),
  firstCatalogCard.limite,
  "A interface nunca deve ultrapassar o limite de cópias da carta.",
);
editableDeck = deckBuilder.changeQuantity(editableDeck, firstCatalogCard, -99);
assert.equal(deckBuilder.quantity(editableDeck, firstCatalogCard), 0);

const onlyEffects = deckBuilder.filterCatalog({ filter: "efeito" });
assert.ok(onlyEffects.length > 0);
assert.ok(onlyEffects.every((card) => card.tipo === "efeito"));
const searchedCard = deckBuilder.filterCatalog({ query: firstCatalogCard.nome });
assert.ok(searchedCard.some((card) => card.key === firstCatalogCard.key));
assert.deepEqual(
  Array.from(
    deckBuilder.filterCatalog({ query: "sinal que não existe no catálogo" }),
  ),
  [],
);
let cappedDeck = [];
for (const card of deckBuilder.getCatalog())
  cappedDeck = deckBuilder.changeQuantity(cappedDeck, card, 99);
assert.equal(deckBuilder.total(cappedDeck), 20);
assert.equal(
  new CyberduelDeckBuilderUI({
    scene: {},
    builder: deckBuilder,
    onExit() {},
  }).pluralLevel("media", 2),
  "médias",
);

const deckScene = Object.create(CenaDeckBuilder.prototype);
deckScene.ordemNivel = "crescente";
let catalogoOrdenado = deckScene.ordenarCatalogo(deckBuilder.getCatalog());
const tiposOrdenados = catalogoOrdenado.map((card) => card.tipo);
assert.ok(tiposOrdenados.lastIndexOf("monstro") < tiposOrdenados.indexOf("efeito"));
assert.ok(tiposOrdenados.lastIndexOf("efeito") < tiposOrdenados.indexOf("terreno"));
const pesosNivel = { baixa: 0, media: 1, alta: 2, lendaria: 3 };
const niveisCrescentes = catalogoOrdenado
  .filter((card) => card.tipo === "monstro")
  .map((card) => pesosNivel[card.nivel]);
assert.deepEqual(
  Array.from(niveisCrescentes),
  Array.from(niveisCrescentes).sort((a, b) => a - b),
);

deckScene.ordemNivel = "decrescente";
catalogoOrdenado = deckScene.ordenarCatalogo(deckBuilder.getCatalog());
const niveisDecrescentes = catalogoOrdenado
  .filter((card) => card.tipo === "monstro")
  .map((card) => pesosNivel[card.nivel]);
assert.deepEqual(
  Array.from(niveisDecrescentes),
  Array.from(niveisDecrescentes).sort((a, b) => b - a),
);

const original = new Partida();
assert.equal(original.jogador.deck.cartas.length, 17);
assert.equal(
  [...original.jogador.deck.cartas, ...original.jogador.mao.cartas].every(
    (card) => !card.nome.startsWith("Unidade "),
  ),
  true,
);
original.jogador.campo.adicionarCarta(original.jogador.mao.cartas[0], 0);
original.jogador.mao.cartas.splice(0, 1);
original.jogador.campo.armadilhas.add(7);
original.rodadasJogador = 2;

multiplayer.player = 1;
const snapshot = multiplayer.canonicalSnapshot(original);
const restored = multiplayer.hydrateMatch(multiplayer.localSnapshot(snapshot));

assert.equal(restored.rodadasJogador, 2);
assert.equal(restored.jogador.campo.armadilhas.has(7), true);
assert.equal(restored.jogador.campo.cartas[0] instanceof Carta, true);
assert.equal(typeof restored.jogador.campo.cartas[0].buff, "function");
restored.jogador.campo.cartas[0].buff(2);

multiplayer.player = 2;
const player2View = multiplayer.localSnapshot(snapshot);
assert.equal(player2View.jogador.hand.length, snapshot.inimigo.hand.length);
assert.equal(player2View.rodadasInimigo, 2);

const visualScene = Object.create(CenaJogo.prototype);
const stateBeforeDraw = multiplayer.hydrateMatch(snapshot);
const stateAfterDraw = multiplayer.hydrateMatch(snapshot);
const drawn = stateAfterDraw.inimigo.deck.cartas.pop();
stateAfterDraw.inimigo.mao.cartas.push(drawn);
let visualEvents = visualScene.detectarEventosVisuaisMultiplayer(
  stateBeforeDraw,
  stateAfterDraw,
);
assert.equal(visualEvents.compras, 1);

const stateAfterPlay = multiplayer.hydrateMatch(snapshot);
const played = stateAfterPlay.inimigo.mao.cartas.shift();
stateAfterPlay.inimigo.campo.cartas[3] = played;
visualEvents = visualScene.detectarEventosVisuaisMultiplayer(
  stateBeforeDraw,
  stateAfterPlay,
);
assert.equal(visualEvents.jogadasCampo.length, 1);

const stateAfterDamage = multiplayer.hydrateMatch(snapshot);
const target = stateAfterDamage.jogador.campo.cartas[0];
target.poder -= 2;
visualEvents = visualScene.detectarEventosVisuaisMultiplayer(
  stateBeforeDraw,
  stateAfterDamage,
);
assert.equal(visualEvents.afetadas[0].delta, -2);

const jogoSource = fs.readFileSync("js/cenas/jogo.js", "utf8");
const preloadSource = fs.readFileSync("js/cenas/preload.js", "utf8");
assert.match(
  preloadSource,
  /this\.load\.video\(\s*"efeitoRaspClay",\s*"assets\/efeitos\/efeito-raspclay-sem-fundo\.webm"/s,
  "A versão transparente do clipe do RaspClay deve ser carregada.",
);
assert.equal(
  fs.existsSync("assets/efeitos/efeito-raspclay-sem-fundo.webm"),
  true,
  "O clipe transparente do RaspClay deve existir.",
);
assert.ok(
  (jogoSource.match(/reproduzirEfeitoInvocacao\(/g) || []).length >= 3,
  "O efeito deve estar conectado às invocações local e adversária.",
);

const invocationScene = Object.create(CenaJogo.prototype);
const videoEvents = new Map();
let videoKey = null;
let videoSize = null;
let videoDepth = null;
let videoLoop = null;
let videoDestroyed = false;
let fallback = null;
const fakeVideo = {
  active: true,
  setOrigin() { return this; },
  setDisplaySize(width, height) {
    videoSize = [width, height];
    return this;
  },
  setDepth(depth) {
    videoDepth = depth;
    return this;
  },
  setInteractive() { return this; },
  once(event, handler) {
    videoEvents.set(event, handler);
    return this;
  },
  play(loop) {
    videoLoop = loop;
    return this;
  },
  destroy() {
    this.active = false;
    videoDestroyed = true;
  },
};
invocationScene.add = {
  video(_x, _y, key) {
    videoKey = key;
    return fakeVideo;
  },
};
invocationScene.time = {
  delayedCall(delay, handler) {
    assert.equal(delay, 1700);
    fallback = handler;
  },
};
let invocationCompleted = 0;
assert.equal(
  invocationScene.reproduzirEfeitoInvocacao(
    { nome: "RaspClay MonteCorp" },
    () => invocationCompleted++,
  ),
  true,
);
assert.equal(videoKey, "efeitoRaspClay");
assert.deepEqual(videoSize, [1080, 540]);
assert.equal(
  videoSize[0] / videoSize[1],
  2,
  "O efeito deve ocupar a largura da tela sem perder a proporção 2:1.",
);
assert.equal(videoDepth, 5000);
assert.equal(videoLoop, false, "O vídeo de invocação deve tocar apenas uma vez.");
videoEvents.get("complete")();
assert.equal(videoDestroyed, true);
assert.equal(invocationCompleted, 1);
fallback();
assert.equal(invocationCompleted, 1, "A conclusão do efeito deve ocorrer uma vez.");
assert.equal(
  invocationScene.reproduzirEfeitoInvocacao(
    { nome: "Outra Carta" },
    () => invocationCompleted++,
  ),
  false,
  "Outras cartas não devem tocar o clipe do RaspClay.",
);
assert.equal(invocationCompleted, 1);

console.log("Serialização e inversão de perspectiva validadas.");
