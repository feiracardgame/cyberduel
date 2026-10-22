const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
for (const file of ['js/cartas.js', 'js/cenas/jogo.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const { Scene, Carta, cards } = vm.runInContext('({ Scene: CenaJogo, Carta, cards: POOL_CARTAS_MONSTRO })', context);
for (const model of cards) {
  const card = new Carta(1, model.poder, 'monstro', model);
  const parts = card.partesDescricao();
  const flavor = parts.findIndex(part => part.tipo === 'flavor');
  assert.ok(flavor === -1 || parts.slice(flavor).every(part => part.tipo !== 'efeito'), model.nome);
  if (card.descricaoFlavor) assert.ok(parts.some(part => part.texto === card.descricaoFlavor));
}
const input = new EventEmitter(), events = new EventEmitter(), canvas = new EventTarget();
const timers = [];
const text = { visible: true, active: true, setVisible(value) { this.visible = value; } };
const hidden = { ...text, visible: false };
const scene = Object.assign(Object.create(Scene.prototype), {
  input, game: { events, canvas }, modalAberto: true,
  pontoDoPonteiro: pointer => pointer,
  time: { delayedCall(delay, callback) {
    assert.equal(delay, 320);
    const timer = { callback, removed: false, remove() { this.removed = true; } };
    timers.push(timer); return timer;
  } },
});
const pointer = { id: 1, x: 20, y: 30 };
const begin = () => input.emit('pointerdown', pointer, []);
const fire = () => { for (const timer of timers.splice(0)) if (!timer.removed) timer.callback(); };
const area = { width: 100, height: 100, getWorldTransformMatrix: () => ({ applyInverse: (x, y) => ({ x: x - 50, y: y - 50 }) }) };
scene.habilitarInspecaoArte(area, [text, hidden]);
input.emit('pointerdown', { ...pointer, x: 200 }, []); fire();
assert.equal(text.visible, true, 'Fora da arte não inicia a inspeção.');
input.emit('pointerdown', pointer, [{ name: 'ativar-habilidade' }]); fire();
assert.equal(text.visible, true, 'Botões continuam com sua ação normal.');
begin(); input.emit('pointerup', pointer); fire();
assert.equal(text.visible, true, 'Toque curto preserva texto e zoom.');
begin(); input.emit('pointermove', { ...pointer, y: 50 }); fire();
assert.equal(text.visible, true, 'Arrastar a descrição cancela a espera.');
begin(); fire();
assert.equal(text.visible, false, 'Segurar oculta o texto.');
assert.equal(scene.arteSemTextoAtiva, true);
input.emit('pointerup', { id: 2 });
assert.equal(text.visible, false, 'Outro dedo não encerra a inspeção.');
input.emit('pointerupoutside', pointer);
assert.equal(text.visible, true, 'Soltar fora também restaura.');
assert.equal(hidden.visible, false, 'Não torna visível o que já estava oculto.');
for (const cancel of [() => events.emit('blur'), () => input.emit('gameout'), () => canvas.dispatchEvent(new Event('pointercancel'))]) {
  begin(); fire(); assert.equal(text.visible, false);
  cancel(); assert.equal(text.visible, true);
}
begin(); fire(); scene.limparEventosDescricao();
assert.equal(text.visible, true, 'Fechar a ficha restaura o estado.');
assert.equal(input.eventNames().length, 0, 'Nenhum listener de inspeção fica preso na cena.');
assert.equal(events.listenerCount('blur'), 0);
scene.habilitarInspecaoArte(area, [text]);
begin(); scene.limparEventosDescricao(); fire();
assert.equal(text.visible, true, 'Fechar durante a espera cancela o temporizador.');
console.log('Ficha: efeito antes da descrição, toque curto, arraste, segurar, múltiplos dedos, cancelamento e limpeza aprovados.');
