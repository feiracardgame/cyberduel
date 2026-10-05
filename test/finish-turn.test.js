const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
for (const file of ['js/multiplayer.js', 'js/cenas/jogo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Game = vm.runInContext('CenaJogo', context);
const client = context.window.cyberduelMultiplayer;
let response, passes = 0, resets = 0;
Object.assign(client, {
  player: 1, activePlayer: 1,
  canonicalSnapshot: () => ({}), status() {},
  socket: { timeout() { return this; }, emit(event, payload, callback) { passes++; response = callback; } },
});
const effects = { executando: false, fila: [] };
const game = Object.assign(Object.create(Game.prototype), {
  multiplayer: client, multiplayerAtivo: true, ehMeuTurno: true, travado: false,
  partida: {}, scene: { manager: { keys: { CenaEfeitos: effects } } },
  encerrarSelecoesDaFase() {}, reiniciarTimerOponente() {},
  reiniciarTimerTurno() { resets++; },
});
client.scene = game;
// Efeitos locais e a espera pelo outro cliente impedem envio prematuro.
effects.executando = true;
effects.eventoAtual = { lado: 'jogador' };
game.aoClicarPassarTurno();
effects.executando = false;
client.effectsPaused = true;
game.aoClicarPassarTurno();
assert.equal(passes, 0);
assert.equal(game.travado, false);
client.effectsPaused = false;
game.aoClicarPassarTurno();
assert.equal(passes, 1);
assert.equal(game.travado, true);
assert.equal(game.ehMeuTurno, true, 'A vez só muda quando o servidor confirma.');
game.aoClicarPassarTurno();
assert.equal(passes, 1, 'Não duplicar envio enquanto aguarda resposta.');
game.timerTurnoExpirado = true;
response(null, { ok: false });
assert.equal(game.travado, false);
assert.equal(game.timerTurnoExpirado, false);
assert.equal(game.ehMeuTurno, true);
assert.equal(resets, 1);
game.aoClicarPassarTurno();
assert.equal(passes, 2, 'Recusa permite nova tentativa.');
client.step++;
response(null, { ok: false });
assert.equal(game.travado, true, 'Resposta antiga não destrava outra fase.');
assert.equal(resets, 1);
console.log('Passagem de turno: efeitos, recusa, nova tentativa e resposta antiga validados.');

client.step--;
response(new Error('timeout'));
assert.equal(game.travado, false);
assert.equal(game.finalizandoJogada, false);
assert.equal(game.ehMeuTurno, true);
client.round = 2; client.step = 1; client.initialized = true;
client.applyPhase({ round: 1, step: 3, activePlayer: 2 });
assert.equal(client.activePlayer, 1, 'ACK antigo não regride a fase.');
let ready;
client.effectsPaused = true; client.effectsSequence = 10;
client.socket.emit = (event, payload, callback) => { ready = callback; };
client.effectsReady(10);
assert.ok(client.effectsAck);
ready(new Error('timeout'));
assert.equal(client.effectsAck, null);
client.effectsReady(10);
ready(null, { ok: true, round: 2, step: 1, effectsPaused: false });
assert.equal(client.effectsPaused, false);
console.log('Timeout, recuperação e confirmação dos efeitos validados.');

// Os controles somem durante o efeito; a mão continua visível.
const transitions = [];
game.tweens = {
  killTweensOf() {},
  add(config) {
    const tween = { ...config, stopped: false, stop() { this.stopped = true; } };
    transitions.push(tween); return tween;
  },
};
const finish = tween => {
  if (tween.stopped) return;
  Object.assign(tween.targets, { y: tween.y, alpha: tween.alpha });
  tween.onComplete();
};
const hand = { dadosCarta: {}, posOriginal: { y: 1900 }, y: 1900, alpha: 1, visible: true,
  setAlpha(value) { this.alpha = value; return this; },
  setVisible(value) { this.visible = value; return this; } };
const controls = { ...hand, y: 1850 }; delete controls.dadosCarta;
game.rodaBotoesContainer = controls;
game.children = { list: [hand, controls] }; game.input = { enabled: true };
effects.executando = true;
game.atualizarInteracaoDuranteEfeitos();
assert.equal(game.input.enabled, false);
assert.equal(hand.visible, true, 'A mão permanece visível durante o efeito.');
assert.equal(transitions[0].targets, controls);
assert.equal(transitions[0].y, 1878);
assert.equal(transitions[0].alpha, 0);
assert.equal(game.podeConsultarCartas(), false);
finish(transitions[0]);
assert.equal(controls.visible, false);
assert.equal(hand.visible, true);
effects.executando = false;
game.atualizarInteracaoDuranteEfeitos();
assert.equal(hand.visible, true);
assert.equal(controls.alpha, 0, 'O retorno dos controles começa transparente.');
assert.equal(hand.alpha, 1);
assert.equal(game.input.enabled, false, 'Só libera input após o retorno.');
// Outro efeito interrompe o retorno sem perder a posição original.
effects.executando = true;
game.atualizarInteracaoDuranteEfeitos();
assert.equal(transitions[1].stopped, true);
finish(transitions[2]);
effects.executando = false;
game.atualizarInteracaoDuranteEfeitos();
finish(transitions[3]);
game.atualizarInteracaoDuranteEfeitos();
assert.equal(game.input.enabled, true);
assert.equal(hand.y, 1900);
assert.equal(hand.alpha, 1);
assert.equal(hand.visible, true);
assert.equal(transitions.length, 4, 'Não reinicia o retorno a cada frame.');
game.children.list = [hand]; game.rodaBotoesContainer = null;

// A mão fica visível durante efeitos do adversário e durante a Sugestão Algorítmica.
effects.executando = true;
effects.eventoAtual = { lado: 'inimigo', fonte: { nome: 'Outro efeito' } };
game.ehMeuTurno = false;
game.atualizarInteracaoDuranteEfeitos();
assert.equal(hand.visible, true);
effects.eventoAtual = { lado: 'jogador', fonte: { nome: 'Sugestão Algorítmica' } };
game.ehMeuTurno = true;
game.atualizarInteracaoDuranteEfeitos();
assert.equal(hand.visible, true);
effects.eventoAtual = { lado: 'jogador', momento: 'invocacao', fonte: { nome: 'Uma carta' } };
game.atualizarInteracaoDuranteEfeitos();
assert.equal(hand.visible, true);
assert.equal(game.input.enabled, true, 'A interface continua interativa durante a invocação.');
assert.equal(game.efeitosBloqueiamInteracao(), false);
effects.executando = false;
effects.eventoAtual = null;

// O ACK carrega a fase completa se a notificação não tiver chegado.
client.step = 0; client.round = 3; client.activePlayer = 1;
game.travado = false; game.finalizandoJogada = false;
client.socket.emit = (event, payload, callback) => { response = callback; };
let updates = 0;
client.receiveUpdate = update => { updates++; game.finalizandoJogada = false; client.applyPhase(update); };
game.aoClicarPassarTurno();
response(null, { ok: true, update: { step: 1, round: 3, activePlayer: 2, phaseChanged: true } });
assert.equal(updates, 1);
// Se o broadcast já chegou, o ACK não reaplica a mesma transição.
client.step = 2; client.activePlayer = 1; game.travado = false;
game.aoClicarPassarTurno();
game.finalizandoJogada = false;
client.step = 3; client.activePlayer = 2;
response(null, { ok: true, update: { step: 3, round: 3, activePlayer: 2, phaseChanged: true } });
assert.equal(updates, 1);
console.log('Bloqueio visual e fallback da fase completa sem duplicar transição validados.');
