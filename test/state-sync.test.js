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
    Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) },
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
  "globalThis.testExports = { Partida, Carta, CenaJogo, CenaDeckBuilder, CyberduelDeckBuilderUI, TIPOS_EFEITO, multiplayer: window.cyberduelMultiplayer, deckBuilder: window.cyberduelDeckBuilder }",
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
  TIPOS_EFEITO,
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
assert.equal(deckBuilder.saveDeck(starterDeck), true);

const regras = new Partida();
regras.jogador.campo.cartas.fill(null);
regras.inimigo.campo.cartas.fill(null);
const cartaAtiva = (id, poder, tipo, efeito) =>
  new Carta(id, poder, "monstro", {
    nome: tipo,
    habilidadeAtiva: true,
    efeito: { tipo, ...efeito },
  });

const gestor = cartaAtiva(8001, 5, TIPOS_EFEITO.REDISTRIBUIR_PODER, {
  perda: 2,
  ganho: 3,
});
const doador = new Carta(8002, 1, "monstro", { nome: "Doador" });
const receptor = new Carta(8003, 4, "monstro", { nome: "Receptor" });
regras.jogador.campo.cartas.splice(0, 3, gestor, doador, receptor);
assert.deepEqual(
  Array.from(
    regras.alvosParaHabilidadeEmCampo(
      gestor,
      regras.jogador,
      regras.inimigo,
    ),
  ),
  [0, 2],
  "O Gestor não deve oferecer uma carta com menos de 2 PA como doadora.",
);
assert.equal(
  regras.ativarHabilidade(gestor, regras.jogador, regras.inimigo, 1, 2).sucesso,
  false,
);
assert.equal(receptor.poder, 4);
doador.poder = 2;
assert.equal(
  regras.ativarHabilidade(gestor, regras.jogador, regras.inimigo, 1, 2).sucesso,
  true,
);
assert.equal(doador.poder, 0);
assert.equal(receptor.poder, 7);

const cobra = cartaAtiva(8010, 5, TIPOS_EFEITO.ENVENENAR, {
  valor: 1,
  rangeH: 5,
  rangeV: 5,
});
const alvoVeneno = new Carta(8011, 8, "monstro", { nome: "Alvo Cobra" });
regras.jogador.campo.cartas.fill(null);
regras.inimigo.campo.cartas.fill(null);
regras.jogador.campo.cartas[0] = cobra;
regras.inimigo.campo.cartas[0] = alvoVeneno;
regras.ativarHabilidade(cobra, regras.jogador, regras.inimigo, 0);
cobra.usadaEsteTurno = false;
regras.ativarHabilidade(cobra, regras.jogador, regras.inimigo, 0);
assert.equal(alvoVeneno.envenenada.valor, 2, "Veneno da Cobra deve acumular.");
assert.equal(alvoVeneno.envenenada.stacks, 2);

const aranha = cartaAtiva(8020, 5, TIPOS_EFEITO.OVERRIDE, {});
const alvoAranha1 = new Carta(8021, 2, "monstro", { nome: "Alvo 1" });
const alvoAranha2 = new Carta(8022, 3, "monstro", { nome: "Alvo 2" });
regras.jogador.campo.cartas.fill(null);
regras.inimigo.campo.cartas.fill(null);
regras.jogador.campo.cartas[0] = aranha;
regras.inimigo.campo.cartas[0] = alvoAranha1;
regras.inimigo.campo.cartas[1] = alvoAranha2;
assert.equal(
  regras.ativarHabilidade(aranha, regras.jogador, regras.inimigo, 0).sucesso,
  true,
);
aranha.usadaEsteTurno = false;
assert.equal(
  regras.ativarHabilidade(aranha, regras.jogador, regras.inimigo, 1).sucesso,
  true,
);
assert.equal(alvoAranha1.capturadaPorAranha, null);
assert.equal(alvoAranha2.capturadaPorAranha, aranha);

const neo = new Carta(8030, 4, "monstro", {
  nome: "NeoAnalista",
  efeito: {
    tipo: TIPOS_EFEITO.REDUZIR_TEMPO_OPONENTE,
    valor: 10,
    minimo: 20,
  },
});
regras.jogador.campo.cartas.fill(null);
regras.inimigo.campo.cartas.fill(null);
regras.inimigo.campo.cartas[0] = neo;
const cenaTimer = Object.assign(Object.create(CenaJogo.prototype), {
  partida: regras,
});
assert.equal(cenaTimer.duracaoPermitidaPara(regras.jogador), 50_000);
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
  /this\.load\.video\(\s*"efeitoRaspClayVertical",\s*"assets\/efeitos\/efeito-raspclay-vertical-alpha\.webm"/s,
  "A versão vertical transparente do clipe do RaspClay deve ser carregada.",
);
assert.equal(
  fs.existsSync("assets/efeitos/efeito-raspclay-vertical-alpha.webm"),
  true,
  "O clipe vertical transparente do RaspClay deve existir.",
);
assert.ok(
  (jogoSource.match(/reproduzirEfeitoInvocacao\(/g) || []).length >= 3,
  "O efeito deve estar conectado às invocações local e adversária.",
);

const efeitoSolto = new Carta(9901, 0, "efeito", {
  nome: "Efeito em qualquer lugar",
  efeito: { tipo: TIPOS_EFEITO.BUFF_DOIS_ALIADOS, valores: [2, 1] },
});
let dropEfeitoProcessado = false;
const cenaDrop = Object.assign(Object.create(CenaJogo.prototype), {
  partida: { jogador: { mao: { cartas: [efeitoSolto] } } },
  tratarSoltarCartaEfeito(_objeto, carta) {
    dropEfeitoProcessado = carta === efeitoSolto;
  },
});
cenaDrop.tratarSoltarCarta({ dadosCarta: efeitoSolto, destroy() {} });
assert.equal(
  dropEfeitoProcessado,
  true,
  "Carta de efeito deve ser aceita antes de qualquer teste de slot do campo.",
);
assert.match(
  jogoSource,
  /animarCompraCarta[\s\S]*?containerCarta\.setScale\(1\)[\s\S]*?onUpdate:[\s\S]*?containerCarta\.setScale\(1\)/,
  "A compra deve manter escala fixa durante todo o voo.",
);

const invocationScene = Object.create(CenaJogo.prototype);
const videoEvents = new Map();
let videoKey = null;
let videoSize = null;
let videoDepth = null;
let videoLoop = null;
let videoDestroyed = false;
let videoVisible = null;
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
  setVisible(visible) {
    videoVisible = visible;
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
assert.equal(videoKey, "efeitoRaspClayVertical");
assert.equal(videoSize, null, "O tamanho deve aguardar a textura real do vídeo.");
assert.equal(videoVisible, false);
videoEvents.get("created")();
assert.deepEqual(videoSize, [1080, 1636]);
assert.equal(videoVisible, true);
assert.equal(
  videoSize[0] <= 1080 && videoSize[1] <= 2160,
  true,
  "O efeito deve permanecer dentro dos limites da arena.",
);
assert.equal(videoDepth, 5000);
assert.equal(videoLoop, false, "O vídeo de invocação deve tocar apenas uma vez.");
videoEvents.get("complete")();
assert.equal(videoDestroyed, true);
assert.equal(invocationCompleted, 1);
fallback();
assert.equal(invocationCompleted, 1, "A conclusão do efeito deve ocorrer uma vez.");

const timerScene = Object.create(CenaJogo.prototype);
timerScene.partida = { partidaEncerrada: false };
timerScene.tempoRestanteTurno = 60_000;
timerScene.tempoRestanteOponente = 60_000;
timerScene.timerOponenteRodando = true;
timerScene.timerTurnoExpirado = false;
timerScene.ehMeuTurno = true;
timerScene.multiplayerAtivo = false;
timerScene.travado = false;
timerScene.animacaoRemotaEmCurso = false;
timerScene.atualizarVisualTimerTurno = () => {};
let encerramentosPorTempo = 0;
let callbackExpiracao = null;
timerScene.aoClicarPassarTurno = () => encerramentosPorTempo++;
timerScene.time = {
  delayedCall(delay, handler) {
    assert.equal(delay, 0);
    callbackExpiracao = handler;
  },
};

timerScene.update(0, 1_000);
assert.equal(timerScene.tempoRestanteTurno, 59_000);
timerScene.travado = true;
timerScene.update(0, 5_000);
assert.equal(
  timerScene.tempoRestanteTurno,
  59_000,
  "O timer deve pausar enquanto a interação estiver travada.",
);
timerScene.travado = false;
timerScene.ehMeuTurno = false;
timerScene.update(0, 5_000);
assert.equal(
  timerScene.tempoRestanteTurno,
  59_000,
  "O timer deve pausar durante o turno do oponente.",
);
timerScene.multiplayerAtivo = true;
timerScene.update(0, 5_000);
assert.equal(
  timerScene.tempoRestanteOponente,
  55_000,
  "No multiplayer, o relógio deve exibir a contagem do oponente.",
);
assert.equal(
  timerScene.tempoRestanteTurno,
  59_000,
  "A contagem visual adversária não pode consumir o tempo do jogador.",
);
timerScene.animacaoRemotaEmCurso = true;
timerScene.update(0, 5_000);
assert.equal(
  timerScene.tempoRestanteOponente,
  55_000,
  "A contagem adversária deve pausar durante animações remotas.",
);
timerScene.animacaoRemotaEmCurso = false;
timerScene.receberTempoOponente(41_250, false);
assert.equal(timerScene.tempoRestanteOponente, 41_250);
assert.equal(timerScene.timerOponenteRodando, false);
timerScene.ehMeuTurno = true;
timerScene.update(0, 59_000);
assert.equal(timerScene.tempoRestanteTurno, 0);
assert.equal(timerScene.timerTurnoExpirado, true);
callbackExpiracao();
assert.equal(
  encerramentosPorTempo,
  1,
  "O limite de um minuto deve encerrar o turno automaticamente uma vez.",
);
timerScene.reiniciarTimerTurno();
assert.equal(timerScene.tempoRestanteTurno, 60_000);
assert.equal(timerScene.timerTurnoExpirado, false);
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
