const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
class Circle {
  constructor(x, y, radius) { Object.assign(this, { x, y, radius }); }
  static Contains(circle, x, y) { return Math.hypot(x - circle.x, y - circle.y) <= circle.radius; }
}
const context = vm.createContext({ window: {}, Phaser: { Scene: class {},
  Math: { DegToRad: degrees => degrees * Math.PI / 180 }, Geom: { Circle } } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const layout = vm.runInContext('LAYOUT_CAMPO_NORMAL', context);
const object = () => Object.assign(new EventEmitter(), {
  active: true, input: {}, list: [], width: 0,
  add(items) { this.list.push(...(Array.isArray(items) ? items : [items])); return this; },
  setOrigin() { return this; }, setStrokeStyle() { return this; }, setAngle() { return this; },
  setScale() { return this; },
  setDepth() { return this; }, setName(name) { this.name = name; return this; },
  setSize(width, height) { Object.assign(this, { width, height }); return this; },
  setInteractive(area, contains) { Object.assign(this.input, { area, contains }); return this; },
  lineStyle() { return this; }, strokePoints() {},
});
const labels = [];
let passed = 0;
const scene = Object.assign(Object.create(Scene.prototype), {
  layout, ehMeuTurno: true, travado: false, multiplayerAtivo: true,
  multiplayer: { localNickname: 'Ana', opponentNickname: 'Bruno', finishTurn() { passed++; } },
  partida: { jogador: { power: 123 }, inimigo: { power: 45 }, calcularPoderTotal: side => side.power },
  textures: { exists: () => false },
  criarPlacaDuelo: object,
  criarTextoUI(x, y, text) { labels.push(text); return object(); },
  add: { circle: object, rectangle: object, graphics: object,
    container(x, y, items) { return Object.assign(object().add(items), { x, y }); } },
  tweens: { add() {} },
  avisoBatalhaPendente: () => false, efeitosVisuaisPendentes: () => false,
});
scene.desenharIndicadoresPoder();
assert.deepEqual(labels, ['BRUNO', '45', 'PA', 'ANA', '123', 'PA']);
labels.length = 0;
scene.partida.jogador.power = 207;
scene.desenharIndicadoresPoder();
assert.ok(labels.includes('207'), 'PA acompanha o poder calculado da partida.');
const arrow = scene.criarSetaPassarTurno(975, 1638);
assert.equal(arrow.name, 'passar-turno');
assert.equal(arrow.input.contains(arrow.input.area, 79, 79), true);
assert.equal(arrow.input.contains(arrow.input.area, 0, 0), false);
scene.multiplayer.spectator = true; arrow.emit('pointerup');
scene.multiplayer.spectator = false; scene.multiplayer.effectsPaused = true; arrow.emit('pointerup');
scene.multiplayer.effectsPaused = false; scene.ehMeuTurno = false; arrow.emit('pointerup');
assert.equal(passed, 0, 'Espectador, efeitos e turno adversário bloqueiam a seta.');
scene.ehMeuTurno = true;
arrow.emit('pointerup'); arrow.emit('pointerup');
assert.equal(passed, 1, 'A seta envia a jogada uma vez e espera a confirmação.');
assert.equal(scene.travado, true);
assert.equal(labels.some(text => /auto/i.test(text)), false);
console.log('GUI: PA calculado, seta circular, bloqueios e envio único da jogada validados.');
