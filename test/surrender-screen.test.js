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
  const texts = [], timers = [], sounds = [];
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
    sound: { play(key) { sounds.push(key); } },
    cameras: { main: { flash() {} } }, somBuff: { play() {} },
    time: { delayedCall(delay, callback) { timers.push({ delay, callback }); return {}; } },
    tweens: { add() {} },
    limparCamadaModalCarta() { throw Error('Redesenho apagaria a tela final.'); },
  });
  // A desistência local exibe a derrota antes da resposta do servidor.
  game.mostrarTelaFimDeJogo(result.resultadoCombate);
  assert.ok(texts.includes('DERROTA'));
  assert.deepEqual(sounds, ['somDerrota']);
  // O resultado confirmado pelo servidor não pode apagar nem duplicar essa tela.
  game.finalizarRecebimentoMultiplayer(result, { activePlayer: player, phase: 'colocar' }, false);
  game.desenharInterface(); // Também preserva o final em outros redesenhos tardios.
  assert.equal(texts.filter(text => text === 'DERROTA').length, 1);
  assert.equal(timers.filter(timer => timer.delay === 10000).length, 1);
  assert.equal(game.travado, true);
  assert.deepEqual(sounds, ['somDerrota'], 'Não repete o áudio após confirmar resultado.');
}
console.log('Desistência: derrota dos dois jogadores preservada após confirmação e redesenhos tardios.');

for (const mode of ['jogador', 'espectador', 'apresentacao']) for (const winner of ['jogador', 'inimigo', 'empate']) {
  const spectator = mode !== 'jogador', presentation = mode === 'apresentacao';
  const texts = [], sounds = [], buttons = [];
  const object = () => ({ setDepth() { return this; }, setOrigin() { return this; }, setScale() { return this; }, setAlpha() { return this; }, setAngle(value) { this.angle = value; return this; } });
  const game = Object.assign(Object.create(Game.prototype), {
    multiplayer: { spectator, presentation, localNickname: 'Primeiro', opponentNickname: 'Segundo' },
    partida: { partidaEncerrada: true }, layout: { yJogadorFrente: 1200, yInimigoTras: 560, slotH: 270 },
    criarTextoUI(x, y, text, style) { const node = Object.assign(object(), { x, y, text, style }); texts.push(node); return node; },
    criarBotaoConfirmacao(x, y) { buttons.push({ x, y }); return object(); },
    add: { rectangle: object, container: object }, cameras: { main: { flash() {} } },
    sound: { play(key) { sounds.push(key); } }, somBuff: { play() {} },
    time: { delayedCall() { return {}; } }, tweens: { add() {} },
  });
  game.mostrarTelaFimDeJogo({ resultado: winner, poderJogador: 0, poderInimigo: 0, cartaDestaque: presentation ? { nome: 'Destaque' } : null });
  if (presentation) {
    const labels = texts.filter(item => ['VENCEU', 'PERDEU', 'EMPATE'].includes(item.text));
    assert.deepEqual(labels.map(item => ({ text: item.text, x: item.x, y: item.y, angle: item.angle })), [
      { text: winner === 'empate' ? 'EMPATE' : winner === 'inimigo' ? 'VENCEU' : 'PERDEU', x: 540, y: 555, angle: 180 },
      { text: winner === 'empate' ? 'EMPATE' : winner === 'jogador' ? 'VENCEU' : 'PERDEU', x: 540, y: 1665, angle: 0 },
    ]);
    for (const label of labels)
      assert.equal(label.style.color, label.text === 'EMPATE' ? '#eeeeee' : label.text === 'VENCEU' ? '#afe5ce' : '#ffc0ca');
    assert.ok(!texts.some(item => /VITÓRIA|DERROTA|Você:/.test(item.text)), 'A apresentação mostra um resultado para cada lado.');
    assert.deepEqual(buttons, [{ x: 540, y: 1270 }], 'Voltar fica no centro, sem cobrir o resultado inferior mesmo com carta de destaque.');
  }
  if (winner === 'empate') assert.deepEqual(sounds, []);
  else {
    assert.deepEqual(sounds, [spectator || winner === 'jogador' ? 'somVitoria' : 'somDerrota']);
    if (presentation) continue;
    if (!spectator) {
      assert.ok(texts.some(item => item.text === (winner === 'jogador' ? 'VITÓRIA' : 'DERROTA')));
      continue;
    }
    assert.ok(texts.some(item => item.text === 'VITÓRIA'), 'Título do espectador não repete o apelido.');
    const label = texts.find(item => item.text.startsWith('VITÓRIA —'));
    assert.ok(label.text.includes(winner === 'jogador' ? 'VITÓRIA — Primeiro' : 'VITÓRIA — Segundo'));
    assert.equal(label.y, (winner === 'jogador' ? 1200 : 560) - 135 - 80);
  }
}
console.log('Espectador: resultados sobre o campo vencedor, áudio de vitória e empate sem voz aprovados.');
console.log('Apresentação: VENCEU/PERDEU no próprio lado, orientação dos dois jogadores e empate aprovados.');
