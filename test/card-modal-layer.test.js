const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const object = depth => ({ active: true, depth,
  setDepth(value) { this.depth = value; return this; },
});
let onTop = false;
const removed = [];
const game = Object.assign(Object.create(Scene.prototype), {
  scene: { bringToTop() { onTop = true; }, sendToBack() { onTop = false; } },
  limparMascaraRender(mask) { if (mask) removed.push(mask); },
});
const overlay = object(4000), card = object(4001);
game.elevarModalCarta(overlay, card);
assert.equal(onTop, true, 'Cena da ficha acima da cena de efeitos.');
assert.ok(overlay.depth > 5000 && card.depth > overlay.depth);
const zoomOverlay = object(4500), zoom = object(4501);
game.elevarModalCarta(zoomOverlay, zoom);
assert.ok(zoomOverlay.depth > card.depth && zoom.depth > zoomOverlay.depth);
const mask = {};
game.mascaraDescricaoAtual = mask;
game.limparCamadaModalCarta();
assert.equal(onTop, false, 'Efeitos voltam ao topo após fechar a leitura.');
assert.equal(game.mascaraDescricaoAtual, null);
assert.deepEqual(removed, [mask]);
game.limparCamadaModalCarta();
assert.deepEqual(removed, [mask], 'Limpeza repetida não destrói a máscara duas vezes.');
game.elevarModalCarta(object(4000), object(4001));
assert.equal(onTop, true, 'Reabrir eleva novamente a cena.');
console.log('Ficha: cena acima dos efeitos, zoom, máscara, limpeza e reabertura validadas.');

// A ação visual nova preserva o fechamento antes da seleção e desativa cartas já usadas.
{
  const { EventEmitter } = require('node:events');
  const item = () => Object.assign(new EventEmitter(), {
    setOrigin() { return this; }, setSize() { return this; }, setScale() { return this; },
    setName(name) { this.name = name; return this; }, setAlpha() { return this; },
    setInteractive() { this.interactive = true; return this; },
    lineStyle() { return this; }, lineBetween() {},
  });
  const calls = [], card = { nome: 'A Aranha' };
  const scene = Object.assign(Object.create(Scene.prototype), {
    criarPlacaDuelo: item, criarTextoUI: item,
    add: { container: item, graphics: item }, tweens: { add() {} },
    fecharDetalheCarta() { calls.push('fechar'); },
    iniciarAtivacaoHabilidade(value) { calls.push(value); },
    time: { delayedCall(ms, done) { assert.equal(ms, 180); done(); } },
  });
  const active = scene.criarBotaoHabilidadeDetalhe(card, 0, 600, 784, false);
  assert.equal(active.interactive, true);
  active.emit('pointerup');
  assert.deepEqual(calls, ['fechar', card]);
  const used = scene.criarBotaoHabilidadeDetalhe(card, 0, 600, 784, true);
  assert.equal(used.interactive, undefined);
  used.emit('pointerup');
  assert.equal(calls.length, 2);
  scene.criarBotaoFecharDetalhe(360, -680).emit('pointerup');
  assert.equal(calls.at(-1), 'fechar');
}
