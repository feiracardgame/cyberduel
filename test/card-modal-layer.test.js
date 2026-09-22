const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const object = depth => ({ active: true, depth,
  setDepth(value) { this.depth = value; return this; },
  destroy() { this.active = false; },
});
const flight = object(30);
const video = object(5000);
const effects = { sys: { isActive: () => true }, children: [flight, video], add: {
  layer() {
    const layer = Object.assign(object(0), {
      list: [], add(objects) { this.list.push(...objects); },
      destroy() { this.list.forEach(o => o.destroy()); this.active = false; },
    });
    effects.children.push(layer);
    return layer;
  },
} };
const game = Object.assign(Object.create(Scene.prototype), {
  scene: { manager: { keys: { CenaEfeitos: effects } } },
});
const overlay = object(4000), card = object(4001);
game.elevarModalCarta(overlay, card);
const layer = game.camadaModalCarta;
assert.ok(layer.depth > flight.depth && layer.depth > video.depth,
  'Ficha e escurecimento devem aparecer acima de voo e vídeo da cena independente.');
assert.deepEqual(layer.list, [overlay, card]);
const zoomOverlay = object(4500), zoom = object(4501);
game.elevarModalCarta(zoomOverlay, zoom);
assert.equal(game.camadaModalCarta, layer);
assert.ok(zoom.depth > card.depth && zoomOverlay.depth > card.depth);
game.limparCamadaModalCarta();
assert.ok([layer, overlay, card, zoomOverlay, zoom].every(o => !o.active));
assert.ok(flight.active && video.active, 'Fechar a ficha não cancela os efeitos.');
assert.equal(game.camadaModalCarta, null);
game.limparCamadaModalCarta();
game.elevarModalCarta(object(4000), object(4001));
assert.notEqual(game.camadaModalCarta, layer, 'Reabrir cria uma camada válida.');
game.limparCamadaModalCarta();
for (const effectScene of [undefined, { sys: { isActive: () => false } }]) {
  game.scene.manager.keys.CenaEfeitos = effectScene;
  const localOverlay = object(4000), localCard = object(4001), localZoom = object(4501);
  game.elevarModalCarta(localOverlay, localCard, localZoom);
  assert.ok(localOverlay.depth > 5000 && localCard.depth > localOverlay.depth);
  assert.ok(localZoom.depth > localCard.depth, 'Fallback preserva ordem de ficha e zoom.');
}
console.log('Ficha: camada acima dos efeitos, zoom, limpeza, reabertura e fallback validados.');
