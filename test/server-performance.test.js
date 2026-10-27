const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('server/server.js', 'utf8');
const sent = [];
const context = vm.createContext({
  io: { to(id) { return { emit(event, payload) { sent.push({ id, event, payload }); } }; } },
  settleMatch() {}, phaseInfo: () => ({ step: 0 }),
});
function loadFunction(name, next) {
  vm.runInContext(source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`)), context);
}
loadFunction('spectatorState', 'presentationState');
loadFunction('presentationState', 'presentationInfo');
loadFunction('broadcastState', 'phaseDuration');
const spectatorState = context.spectatorState;
let copies = 0;
context.spectatorState = snapshot => { copies++; return spectatorState(snapshot); };
const player = () => ({ deck: [{ nome: 'Deck secreto' }], hand: [{ id: 3, nome: 'Mão secreta' }],
  field: [{ id: 4, nome: 'Oculto', ocultadaPelaToca: true }, { id: 5, nome: 'Visível', revelada: true }],
  traps: [4], contribuicoesEfeito: { segredo: 2 }, recentlyDrawn: [3] });
const state = { jogador: player(), inimigo: player(), eventosEfeito: [{ id: 1,
  fonte: { id: 7, nome: 'Fonte secreta', oculto: true }, alvos: [{ id: 8, nome: 'Alvo secreto', oculto: true, delta: 3 }] }] };
const before = JSON.stringify(state);
const room = { players: new Map([[1, 'one'], [2, 'two']]), spectators: new Set(), state };
context.broadcastState(room);
assert.equal(copies, 0, 'Sem espectadores não cria cópia pública.');
sent.length = 0;
room.spectators = new Set(Array.from({ length: 50 }, (_, i) => `viewer-${i}`));
context.broadcastState(room, { live: true }, 'one');
assert.equal(copies, 1, '50 espectadores precisam de uma única cópia pública por envio.');
assert.equal(sent.length, 51);
assert.equal(sent[0].id, 'two'); assert.equal(sent[0].payload.state, state);
const publicState = sent[1].payload.state;
assert.ok(sent.slice(1).every(item => item.payload.state === publicState));
assert.equal(publicState.jogador.hand[0].nome, 'Carta oculta');
assert.equal(publicState.inimigo.deck[0].nome, 'Carta oculta');
assert.equal(publicState.jogador.field[0].nome, 'Carta oculta');
assert.equal(publicState.jogador.field[1].nome, 'Visível');
assert.equal(publicState.jogador.traps.length, 0);
assert.equal(publicState.eventosEfeito[0].fonte.nome, 'Carta oculta');
assert.equal(publicState.eventosEfeito[0].alvos[0].delta, undefined);
assert.equal(JSON.stringify(state), before, 'Filtragem não altera a partida original.');
sent.length = 0; copies = 0; room.presentationHost = 'screen';
context.broadcastState(room);
assert.equal(copies, 2, 'Apresentação recebe sua própria versão.');
assert.equal(sent.at(-1).payload.state.jogador.hand[0].nome, 'Mão secreta');
assert.equal(sent.at(-1).payload.state.jogador.deck.length, 0);
console.log('Servidor: 50 cópias públicas reduzidas a 1 por envio, preservando jogadores, apresentação e cartas ocultas.');
