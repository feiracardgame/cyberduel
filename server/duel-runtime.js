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
vm.runInContext(fs.readFileSync(path.join(root, 'js/multiplayer.js'), 'utf8'), context);
const codec = context.window.cyberduelMultiplayer;
exports.closeRound = (snapshot) => {
  const match = codec.hydrateMatch(snapshot);
  const result = match.fimTurno({ semIA: true });
  return JSON.parse(JSON.stringify({ state: codec.serializeMatch(match), result }));
};
