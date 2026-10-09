const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: { setTimeout() {}, clearTimeout() {} }, Phaser: { Scene: class {} } });
for (const file of ['js/cartas.js', 'js/cenas/jogo.js', 'js/cenas/efeitos.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const { CenaEfeitos, layouts, width, height } = vm.runInContext(
  '({ CenaEfeitos, layouts: [LAYOUT_CAMPO_NORMAL, LAYOUT_CAMPO_AMPLIADO], width: LARGURA_LAYOUT, height: ALTURA_LAYOUT })', context);

function renderer(layout, presentation = false) {
  const objects = [], tweens = [];
  const object = (type, x, y, key) => {
    const result = { type, x, y, key, width: 800, height: 600, active: true, events: {},
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setScale(scale) { this.displayWidth = this.width * scale; this.displayHeight = this.height * scale; return this; },
      once(name, callback) { this.events[name] = callback; return this; },
      play() { this.events.created?.(); return this; },
    };
    for (const method of ['setDepth', 'setVisible', 'setDisplaySize', 'setStrokeStyle', 'setOrigin', 'setAngle', 'setMute', 'add', 'destroy'])
      result[method] = () => result;
    objects.push(result);
    return result;
  };
  const scene = Object.assign(Object.create(CenaEfeitos.prototype), {
    jogo: { layout, multiplayer: { presentation }, children: { list: [] },
      partida: { jogador: { campo: { cartas: [] } }, inimigo: { campo: { cartas: [] } } } },
    textures: { exists: () => true },
    cache: { audio: { exists: () => false }, video: { exists: () => true } },
    add: Object.fromEntries(['image', 'rectangle', 'container', 'text', 'video'].map(type => [type, (x, y, key) => object(type, x, y, key)])),
    tweens: { add: tween => tweens.push(tween) }, time: { delayedCall: () => ({ remove() {} }) },
    fila: [], exibidos: [],
  });
  return { scene, objects, tweens };
}

for (const layout of layouts) for (const presentation of [false, true]) for (const lado of ['jogador', 'inimigo']) for (const indice of [0, 4, 5, 9]) {
  const { scene, tweens } = renderer(layout, presentation);
  const point = scene.ponto(lado, indice);
  scene.jogo.multiplayer.spectator = true;
  const source = { nome: 'Carta', imagem: 'carta', indice };
  scene.animarFonte({ id: 1, lado, momento: 'invocacao', fonte: source }, source, item => item, () => {});
  assert.equal(tweens[0].x, point.x, 'Invocação chega ao centro da carta do canto.');
  assert.equal(tweens[0].y, point.y);
  scene.animarFonte({ id: 2, lado, momento: 'habilidade', fonte: source }, source, item => item, () => {});
  assert.equal(tweens[1].x, point.x, 'A carta não é empurrada para dentro da tela ao ativar habilidade.');

  for (const name of ['NeoAnalista de Suporte Nível Alpha', 'UCC "Juggernaut"', 'Advogado Corporativo', 'RaspClay MonteCorp']) {
    const { scene: effect, objects } = renderer(layout, presentation);
    effect.animarFonte = (_event, _source, _keep, apply) => apply();
    effect.fila.push({ id: 3, lado: lado === 'jogador' ? 'inimigo' : 'jogador',
      momento: name === 'NeoAnalista de Suporte Nível Alpha' || name === 'RaspClay MonteCorp' ? 'invocacao' : 'habilidade',
      fonte: { nome: name, indice }, alvos: [{ lado, indice, delta: -1, removida: true, id: 4, imagem: 'carta' }] });
    effect.proximo();
    const visual = objects.find(item => item.type === (name === 'Advogado Corporativo' ? 'image' : 'video') &&
      (name !== 'Advogado Corporativo' || item.key === 'efeitoAdvogado'));
    assert.ok(visual, name);
    const center = name === 'RaspClay MonteCorp' ? { x: width / 2, y: height / 2 } :
      name === 'NeoAnalista de Suporte Nível Alpha' ? effect.ponto(effect.eventoAtual.lado, indice) : point;
    assert.equal(visual.x, center.x, `${name}: efeito centralizado horizontalmente.`);
    assert.equal(visual.y, center.y, `${name}: efeito centralizado verticalmente.`);
  }
}
console.log('Efeitos: cantos dos dois campos, layouts, apresentação, invocação, habilidade, vídeos e Advogado centralizados.');
