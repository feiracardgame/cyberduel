const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const CenaJogo = vm.runInContext('CenaJogo', context);

function selection(effect = { total: 6 }) {
  const objects = [];
  function object(type, x, y, text) {
    const o = { type, x, y, text, handlers: {}, active: true,
      setDepth(v) { this.depth = v; return this; },
      setStrokeStyle() { return this; }, setOrigin() { return this; },
      setDisplaySize() { return this; }, setInteractive() { return this; },
      setAlpha() { return this; }, setText(v) { this.text = v; return this; },
      on(event, callback) { this.handlers[event] = callback; return this; },
      destroy() { this.active = false; },
    };
    objects.push(o); return o;
  }
  const scene = Object.assign(Object.create(CenaJogo.prototype), {
    layout: { x: [100, 300], yInimigo: [600], slotW: 170, slotH: 230 },
    partida: { inimigo: { campo: { cartas: [{ poder: 2 }, { poder: 9 }] } } },
    add: Object.fromEntries(['rectangle', 'text', 'image'].map(type => [type, (...args) => object(type, ...args)])),
    textures: { exists: () => true },
    criarBotaoConfirmacao(x, y, text, color, callback) {
      this.confirm = callback;
      return { list: [], setAlpha() {}, destroy() {} };
    },
    cancelarSelecaoDeAlvo() { this.cancelled = true; },
    executarHabilidade(card, targets) { this.targets = Array.from(targets); },
  });
  scene.iniciarDistribuicaoDeDano({ efeito: effect }, [0, 1]);
  return { scene, objects, zones: objects.filter(o => o.depth === 3803), overlay: objects[0] };
}
{
  const { scene, objects, zones, overlay } = selection();
  scene.confirm(); assert.equal(scene.targets, undefined);
  zones[0].handlers.pointerup(); zones[0].handlers.pointerup(); zones[0].handlers.pointerup();
  assert.equal(objects.filter(o => o.type === 'image').length, 2, 'Não alocar mais dano que o PA do alvo.');
  overlay.handlers.pointerup();
  assert.equal(scene.cancelled, undefined, 'Uma seleção já feita não pode ser desfeita pelo fundo.');
  for (let i = 0; i < 5; i++) zones[1].handlers.pointerup();
  assert.equal(objects.filter(o => o.type === 'image').length, 6);
  assert.ok(!objects.some(o => o.type === 'text' && ['+', '−'].includes(o.text)));
  scene.confirm();
  assert.deepEqual(scene.targets, [0, 0, 1, 1, 1, 1]);
  assert.equal(scene.objetosSelecaoAlvo, null);
  assert.ok(objects.every(o => !o.active));
}
{
  const { scene, zones } = selection({ total: 6, alvosUnicos: true });
  zones[0].handlers.pointerup(); zones[0].handlers.pointerup();
  scene.confirm(); assert.deepEqual(scene.targets, [0], 'Preservar alvos únicos e confirmação parcial.');
}
{
  const { scene, overlay } = selection();
  overlay.handlers.pointerup(); assert.equal(scene.cancelled, true);
}
// A transição precisa redesenhar mesmo quando uma animação já desenhou o campo.
{
  let redraws = 0;
  const scene = Object.assign(Object.create(CenaJogo.prototype), {
    multiplayer: { player: 1, phase: 'colocar' }, partida: {}, ehMeuTurno: true,
    desenharInterface() { redraws++; }, iniciarNovoTurnoDoJogador() {},
    reiniciarTimerOponente() {}, atualizarVisualTimerTurno() {}, mostrarEsperaMultiplayer() {},
    rodaBotoesContainer: {},
  });
  scene.finalizarRecebimentoMultiplayer(null, { activePlayer: 2, phase: 'colocar', phaseChanged: true }, true);
  assert.equal(redraws, 1);
  assert.equal(scene.podeUsarHabilidadesAgora(), false);
  scene.finalizarRecebimentoMultiplayer(null, { activePlayer: 1, phase: 'habilidades', phaseChanged: true }, true);
  assert.equal(redraws, 2);
  assert.equal(scene.podeUsarHabilidadesAgora(), true);
}
console.log('Seleção cumulativa de caveiras e transições de fase validadas.');
