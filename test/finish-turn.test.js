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
  socket: { emit(event, payload, callback) { passes++; response = callback; } },
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
game.aoClicarPassarTurno();
assert.equal(passes, 1, 'Não duplicar envio enquanto aguarda resposta.');
game.timerTurnoExpirado = true;
response({ ok: false });
assert.equal(game.travado, false);
assert.equal(game.timerTurnoExpirado, false);
assert.equal(game.ehMeuTurno, true);
assert.equal(resets, 1);
game.aoClicarPassarTurno();
assert.equal(passes, 2, 'Recusa permite nova tentativa.');
client.step++;
response({ ok: false });
assert.equal(game.travado, true, 'Resposta antiga não destrava outra fase.');
assert.equal(resets, 1);
console.log('Passagem de turno: efeitos, recusa, nova tentativa e resposta antiga validados.');
