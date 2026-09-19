// Reutiliza as regras de jogo no servidor para fechar rodadas por passagem ou timeout.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console: { log() {} }, window: {},
  Phaser: { Utils: { Array: { Shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  } } } },
});
vm.runInContext(fs.readFileSync(path.join(root, 'js/cartas.js'), 'utf8'), context);
const model = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8').split('const usarCanvasParaDiagnostico =')[0];
vm.runInContext(model, context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/deck-builder.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/multiplayer.js'), 'utf8'), context);
const codec = context.window.cyberduelMultiplayer;
exports.closeRound = (snapshot) => {
  const match = codec.hydrateMatch(snapshot);
  const result = match.fimTurno({ semIA: true });
  return JSON.parse(JSON.stringify({ state: codec.serializeMatch(match), result }));
};

exports.finishForDebug = (snapshot, winner) => {
  const match = codec.hydrateMatch(snapshot);
  const resultadoCombate = match.finalizarParaTeste(winner);
  return JSON.parse(JSON.stringify({ state: codec.serializeMatch(match),
    result: { fimDeJogo: true, resultadoCombate, resultadoRodada: null } }));
};

exports.finishBySurrender = (snapshot, player) => {
  const match = codec.hydrateMatch(snapshot);
  const winner = player === 1 ? "inimigo" : "jogador";
  match.partidaEncerrada = true;
  const resultadoCombate = {
    resultado: winner,
    poderJogador: match.calcularPoderTotal(match.jogador),
    poderInimigo: match.calcularPoderTotal(match.inimigo),
    cartaDestaque: match.obterCartaComMaiorPoder(match[winner].campo),
    rodadasJogador: match.rodadasJogador,
    rodadasInimigo: match.rodadasInimigo,
  };
  return JSON.parse(JSON.stringify({ state: codec.serializeMatch(match),
    result: { fimDeJogo: true, resultadoCombate, resultadoRodada: null } }));
};

exports.createMatch = (firstDeck, secondDeck) => {
  codec.active = true;
  codec.opponentDeck = secondDeck;
  context.initialDeck = firstDeck;
  try {
    return JSON.parse(JSON.stringify(vm.runInContext('window.cyberduelMultiplayer.serializeMatch(new Partida(initialDeck))', context)));
  } finally {
    delete context.initialDeck;
    codec.active = false;
    codec.opponentDeck = [];
  }
};

exports.validDeck = (deck) => {
  const builder = context.window.cyberduelDeckBuilder;
  const normalized = builder.normalize(deck);
  const totals = new Map();
  for (const card of normalized || []) {
    const key = `${card.tipo}:${card.nome}`;
    totals.set(key, (totals.get(key) || 0) + card.quantidade);
  }
  return builder.isValid(normalized) && [...totals].every(([key, count]) => count <= builder.getCatalogByKey().get(key).limite);
};
