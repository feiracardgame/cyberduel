const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({
  window: {}, Phaser: { Scene: class {} }, LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220,
});
for (const file of ['js/multiplayer.js', 'js/cenas/jogo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Game = vm.runInContext('CenaJogo', context);
const client = context.window.cyberduelMultiplayer;

for (const player of [1, 2]) {
  const texts = [], timers = [];
  const object = () => ({
    setDepth() { return this; }, setOrigin() { return this; },
    setScale() { return this; }, setAlpha() { return this; },
  });
  client.player = player;
  const result = client.localResult({ fimDeJogo: true, resultadoCombate: {
    resultado: player === 1 ? 'inimigo' : 'jogador',
    poderJogador: 0, poderInimigo: 0, cartaDestaque: null,
  } });
  const game = Object.assign(Object.create(Game.prototype), {
    multiplayer: client, partida: { partidaEncerrada: true },
    ehMeuTurno: true, partidaRegistradaNaConta: true,
    criarTextoUI(x, y, text) { texts.push(text); return object(); },
    criarBotaoConfirmacao: object,
    add: { rectangle: object, container: object },
    cameras: { main: { flash() {} } }, somBuff: { play() {} },
    time: { delayedCall(delay, callback) { timers.push({ delay, callback }); return {}; } },
    tweens: { add() {} },
    limparCamadaModalCarta() { throw Error('Redesenho apagaria a tela final.'); },
  });
  // A desistência local exibe a derrota antes da resposta do servidor.
  game.mostrarTelaFimDeJogo(result.resultadoCombate);
  assert.ok(texts.includes('VOCÊ PERDEU'));
  // O resultado confirmado pelo servidor não pode apagar nem duplicar essa tela.
  game.finalizarRecebimentoMultiplayer(result, { activePlayer: player, phase: 'colocar' }, false);
  game.desenharInterface(); // Também preserva o final em outros redesenhos tardios.
  assert.equal(texts.filter(text => text === 'VOCÊ PERDEU').length, 1);
  assert.equal(timers.filter(timer => timer.delay === 10000).length, 1);
  assert.equal(game.travado, true);
}
console.log('Desistência: derrota dos dois jogadores preservada após confirmação e redesenhos tardios.');
