const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

class Circle {
  constructor(x, y, radius) { Object.assign(this, { x, y, radius }); }
  static Contains(circle, x, y) { return Math.hypot(x - circle.x, y - circle.y) <= circle.radius; }
}
const context = vm.createContext({ window: {}, TIPOS_EFEITO: { REDISTRIBUIR_PODER: 'redistribuir' },
  Phaser: { Scene: class {}, Geom: { Circle } } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const layoutWidth = vm.runInContext('LARGURA_LAYOUT', context);
const pointer = id => ({ id, distance: 0, wasTouch: true, getDistance() { return this.distance; } });

function inspection() {
  const input = Object.assign(new EventEmitter(), { dragDistanceThreshold: 8 });
  const events = new EventEmitter(), gameEvents = new EventEmitter(), timers = [], opened = [];
  const canvas = new class extends EventTarget {
    addEventListener(name, handler) { super.addEventListener(name, handler); this.handler = handler; }
    removeEventListener(name, handler) { super.removeEventListener(name, handler); this.handler = null; }
  }();
  const scene = Object.assign(Object.create(Scene.prototype), {
    input, events, game: { events: gameEvents, canvas }, canConsult: true, gestoMaoAtivo: true,
    podeConsultarCartas() { return this.canConsult; },
    voltarMaoParaPosicao() { this.handRestored = true; },
    mostrarDetalheCarta(card) { opened.push(card); this.modalAberto = true; },
    time: { delayedCall(delay, callback) {
      assert.equal(delay, 450);
      const timer = { callback, removed: false, remove() { this.removed = true; } };
      timers.push(timer); return timer;
    } },
  });
  scene.configurarInspecaoCartas();
  const card = { nome: 'Carta de teste' };
  const container = { active: true, visible: true, cartaInspecionavel: card };
  const first = pointer(1), second = pointer(2);
  return { scene, input, events, gameEvents, canvas, opened, card, container, first, second,
    begin(p = first, objects = [container]) { input.emit('pointerdown', p, objects); },
    fire() { for (const timer of timers.splice(0)) if (!timer.removed) timer.callback(); },
  };
}

{
  const f = inspection();
  f.begin(); assert.equal(f.scene.deveIgnorarCliqueCarta(f.first), false);
  f.input.emit('pointerup', f.first); f.fire();
  assert.equal(f.opened.length, 0, 'Clique curto não abre a ficha.');
  f.begin(); f.fire();
  assert.deepEqual(f.opened, [f.card]);
  assert.equal(f.scene.gestoMaoAtivo, false);
  assert.equal(f.scene.handRestored, true);
  assert.equal(f.scene.inspecaoCartaPressionada, f.first.id);
  assert.equal(f.scene.deveIgnorarCliqueCarta(f.first), true, 'O release do hold não seleciona nem joga outra carta.');
  f.input.emit('pointerup', f.first);
  assert.equal(f.scene.inspecaoCartaPressionada, null);
  assert.equal(f.scene.modalAberto, true, 'Soltar preserva a ficha aberta.');
  f.events.emit('shutdown');
}

{
  const f = inspection();
  f.begin(); f.first.distance = 12; f.input.emit('pointermove', f.first);
  f.first.distance = 0; f.input.emit('pointermove', f.first); f.fire();
  assert.equal(f.opened.length, 0);
  assert.equal(f.scene.deveIgnorarCliqueCarta(f.first), true, 'Arrastar e voltar à origem continua cancelando o clique.');
  f.input.emit('pointerup', f.first);
  f.begin(); f.scene.cancelarInspecaoCarta(); f.fire();
  assert.equal(f.opened.length, 0, 'Dragstart/redesenho também cancelam o timer.');
  f.events.emit('shutdown');
}

{
  const f = inspection();
  f.begin(); f.begin(f.second); f.second.distance = 20;
  f.input.emit('pointermove', f.second); f.input.emit('pointerup', f.second); f.fire();
  assert.equal(f.opened.length, 1, 'Outro dedo não substitui nem cancela a inspeção.');
  assert.equal(f.scene.inspecaoCartaPressionada, 1);
  f.input.emit('pointerupoutside', f.first);
  assert.equal(f.scene.inspecaoCartaPressionada, null);
  f.events.emit('shutdown');
}

{
  const f = inspection();
  f.first.isDown = true; f.begin();
  f.first.isDown = false; f.scene.cancelarInspecaoCarta();
  // O input estava bloqueado quando o ponteiro soltou; nenhum pointerup foi entregue.
  f.first.isDown = true; f.begin(); f.fire();
  assert.deepEqual(f.opened, [f.card], 'Um novo down recupera a inspeção após perder o release anterior.');
  f.events.emit('shutdown');
}

for (const cancel of [f => f.gameEvents.emit('blur'), f => f.input.emit('gameout'),
  f => f.canvas.dispatchEvent(new Event('pointercancel')), f => f.events.emit('shutdown')]) {
  const f = inspection();
  f.begin(); cancel(f); f.fire();
  assert.equal(f.opened.length, 0, 'Interromper o gesto não deixa inspeção pendente.');
  assert.equal(f.scene.gestoInspecaoCarta, null);
  f.events.emit('shutdown');
  assert.equal(f.input.eventNames().length, 0);
  assert.equal(f.gameEvents.listenerCount('blur'), 0);
  assert.equal(f.canvas.handler, null);
}

for (const alter of [f => { f.container.active = false; }, f => { f.container.visible = false; },
  f => { f.scene.canConsult = false; }, f => { f.container.input = { enabled: false }; },
  f => { f.first.isDown = false; }]) {
  const f = inspection(); f.begin(); alter(f); f.fire();
  assert.equal(f.opened.length, 0, 'A carta e a permissão são verificadas outra vez ao terminar a espera.');
  f.events.emit('shutdown');
}
{
  const f = inspection();
  f.begin(f.first, [{ active: true, visible: true }]); f.fire();
  assert.equal(f.opened.length, 0, 'Cartas ocultas sem cartaInspecionavel não revelam dados.');
  f.container.animandoCompra = true; f.begin(); f.fire();
  assert.equal(f.opened.length, 0);
  f.events.emit('shutdown');
}

function visual(x = 0, y = 0) {
  return Object.assign(new EventEmitter(), {
    x, y, angle: 0, scaleX: 1, scaleY: 1, depth: 7, active: true, visible: true, list: [],
    setDepth(value) { this.depth = value; return this; },
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setScale(value) { this.scaleX = this.scaleY = value; return this; },
    setSize(width, height) { Object.assign(this, { width, height }); return this; },
    setName(value) { this.name = value; return this; },
    setVisible(value) { this.visible = value; return this; },
    setInteractive(area, contains) { this.input = { area, contains }; return this; },
    setStrokeStyle() { return this; }, setOrigin() { return this; },
    clear() { return this; }, fillGradientStyle(...args) { this.gradientAlphas = args.slice(4); return this; },
    fillRect() { return this; }, fillPoints() { return this; },
    add(items) { this.list.push(...(Array.isArray(items) ? items : [items])); return this; },
    addAt(items, index) { this.list.splice(index, 0, ...(Array.isArray(items) ? items : [items])); return this; },
    destroy() { this.active = false; },
  });
}
function field() {
  const activated = [], voiced = [], cards = [];
  const scene = Object.assign(Object.create(Scene.prototype), {
    input: Object.assign(new EventEmitter(), { dragDistanceThreshold: 8 }), canConsult: true, canUse: true, ehMeuTurno: true,
    children: { list: [] }, partida: { jogador: { campo: { cartas: cards } }, inimigo: { campo: { cartas: [] } },
      alvosParaHabilidadeEmCampo: () => [0] },
    podeConsultarCartas() { return this.canConsult; }, podeUsarHabilidadesAgora() { return this.canUse; },
    baixarOutrasCartasDaMao() {}, tocarVozAtivacaoHabilidade(card) { voiced.push(card); },
    pontoDoPonteiro: point => point,
    iniciarAtivacaoHabilidade(card) { activated.push(card); },
    tweens: { killTweensOf() {}, add({ targets, x, y, angle, scaleX, scaleY }) {
      Object.assign(targets, Object.fromEntries(Object.entries({ x, y, angle, scaleX, scaleY }).filter(([, value]) => value !== undefined)));
    } },
    add: { circle: visual, container: visual, rectangle: visual, graphics: visual }, criarTextoUI: visual,
  });
  const makeCard = (x, own = true, active = true) => {
    const container = visual(x, 900); container.width = 180; container.height = 246;
    container.dadosCartaCampo = { habilidadeAtiva: active };
    container.sombraCartaCampo = visual(6, 8).setAlpha(0.35);
    if (own) cards.push(container.dadosCartaCampo);
    scene.children.list.push(container); return container;
  };
  return { scene, activated, voiced, makeCard };
}
{
  const { scene, activated, voiced, makeCard } = field();
  const card = makeCard(100), other = makeCard(400);
  scene.selecionarCartaDoCampo(card);
  const button = scene.botaoHabilidadeCampo;
  assert.equal(scene.cartaCampoSelecionada, card);
  assert.equal(card.y, 874); assert.ok(card.scaleY > card.scaleX && card.angle < 0);
  assert.equal(button.name, 'ativar-habilidade-campo'); assert.equal(button.visible, true);
  assert.ok(button.x > card.x && button.input.area.radius >= 44);
  assert.equal(button.input.contains(button.input.area, button.width / 2, button.height / 2), true,
    'O centro visual continua clicável após o Phaser normalizar a origem do container.');
  scene.selecionarCartaDoCampo(card);
  assert.equal(scene.botaoHabilidadeCampo, button, 'Repetir clique não acumula botões ou elevação.');
  scene.selecionarCartaDoCampo(other);
  assert.equal(button.active, false);
  assert.equal(card.y, 900); assert.equal(card.scaleY, 1); assert.equal(card.depth, 7);
  assert.equal(card.sombraCartaCampo.y, 8); assert.equal(card.sombraCartaCampo.alpha, 0.35);
  scene.botaoHabilidadeCampo.emit('pointerup', pointer(1));
  assert.deepEqual(activated, [other.dadosCartaCampo]); assert.deepEqual(voiced, activated);
  assert.equal(scene.botaoHabilidadeCampo, null); assert.equal(scene.cartaCampoSelecionada, null);
}
{
  const { scene, activated, makeCard } = field();
  const card = makeCard(layoutWidth - 100);
  scene.selecionarCartaDoCampo(card);
  const button = scene.botaoHabilidadeCampo;
  assert.ok(button.x < card.x && button.x - 52 > 0 && button.x + 52 < layoutWidth,
    'A carta da última coluna mostra a bolinha à esquerda, dentro da tela.');
  card.dadosCartaCampo.usadaEsteTurno = true;
  button.emit('pointerup', pointer(1));
  assert.equal(activated.length, 0, 'Habilidade usada depois da seleção não dispara por botão obsoleto.');
  scene.atualizarAurasHabilidade(); assert.equal(button.visible, false);
  card.dadosCartaCampo.usadaEsteTurno = false;
  scene.atualizarAurasHabilidade(); assert.equal(button.visible, true);
  scene.canUse = false; scene.atualizarAurasHabilidade(); assert.equal(button.visible, false);
  scene.canConsult = false; scene.atualizarAurasHabilidade();
  assert.equal(scene.cartaCampoSelecionada, null); assert.equal(button.active, false);
}
{
  const { scene, activated, makeCard } = field();
  const timers = [], opened = [];
  scene.input = Object.assign(new EventEmitter(), { dragDistanceThreshold: 8 });
  scene.events = new EventEmitter();
  scene.game = { events: new EventEmitter(), canvas: new EventTarget() };
  scene.time = { delayedCall(delay, callback) {
    const timer = { callback, removed: false, remove() { this.removed = true; } };
    timers.push(timer); return timer;
  } };
  scene.mostrarDetalheCarta = card => opened.push(card);
  scene.configurarInspecaoCartas();
  const card = makeCard(100); card.cartaInspecionavel = card.dadosCartaCampo;
  scene.selecionarCartaDoCampo(card);
  const button = scene.botaoHabilidadeCampo, p = pointer(1);
  scene.input.emit('pointerdown', p, [card]);
  p.distance = 15; scene.input.emit('pointermove', p);
  p.distance = 0;
  const event = { stopPropagation() { this.stopped = true; } };
  button.emit('pointerup', p, 0, 0, event);
  assert.equal(event.stopped, undefined, 'A bolinha permite o pointerup global limpar o gesto de inspeção.');
  assert.equal(activated.length, 0, 'Arrastar da carta à bolinha não ativa a habilidade.');
  scene.input.emit('pointerup', p, [button]);
  assert.equal(scene.gestoInspecaoCarta, null);
  scene.input.emit('pointerdown', p, [card]);
  for (const timer of timers.splice(0)) if (!timer.removed) timer.callback();
  assert.deepEqual(opened, [card.dadosCartaCampo], 'Um novo hold funciona depois de soltar sobre a bolinha.');
  scene.input.emit('pointerup', p, [card]); scene.events.emit('shutdown');
}
{
  const { scene, makeCard } = field();
  for (const card of [makeCard(100, false), makeCard(400, true, false)]) {
    scene.selecionarCartaDoCampo(card);
    assert.equal(scene.botaoHabilidadeCampo, null, 'Carta inimiga/passiva pode ser selecionada sem botão de habilidade.');
  }
  scene.limparSelecaoCartaCampo(); scene.limparSelecaoCartaCampo();
}
{
  const { scene, makeCard } = field();
  const card = makeCard(400), other = makeCard(700);
  scene.selecionarCartaDoCampo(card);
  const effects = scene.visualSelecaoCarta.objetos;
  assert.equal(card.sombraCartaCampo.visible, false, 'A sombra original dá lugar à sombra presa ao campo.');
  scene.input.emit('pointermove', { wasTouch: false, x: 520, y: 870 });
  assert.ok(card.angle > 0, 'A inclinação acompanha o mouse suavemente.');
  assert.ok(Math.abs(card.x - card.posCampoOriginal.x) <= 4);
  scene.input.emit('gameout');
  assert.equal(card.angle, -2.2, 'Sair do canvas recentraliza a carta.');
  scene.input.emit('pointermove', { wasTouch: false, x: 280, y: 1010 });
  assert.ok(effects.find(object => object.name === 'reflexo-selecao-carta').gradientAlphas
    .every(alpha => alpha >= 0 && alpha < 0.2), 'A luz permanece sutil em todos os cantos.');
  scene.selecionarCartaDoCampo(other);
  assert.ok(effects.every(object => !object.active), 'Trocar carta remove luzes e sombra antigas.');
  assert.equal(scene.input.listenerCount('pointermove'), 1, 'Só a carta selecionada acompanha o ponteiro.');
  scene.selecionarCartaDoCampo(card);
  assert.equal(card.posCampoOriginal.y, 900, 'Resselecionar não acumula a elevação anterior.');
  scene.limparSelecaoCartaCampo(true);
  assert.equal(scene.input.listenerCount('pointermove'), 0);
  assert.equal(scene.input.listenerCount('gameout'), 0);
  assert.equal(card.sombraCartaCampo.visible, true);
}
{
  context.window.matchMedia = () => ({ matches: true });
  const { scene, makeCard } = field();
  const card = makeCard(400);
  scene.selecionarCartaDoCampo(card);
  assert.equal(card.angle, 0, 'Movimento reduzido mantém uma seleção estável.');
  scene.input.emit('pointermove', { wasTouch: false, x: 520, y: 870 });
  assert.equal(card.angle, 0);
  scene.limparSelecaoCartaCampo(true);
  delete context.window.matchMedia;
}
console.log('Cartas: clique, hold, arraste, múltiplos dedos, limpeza, elevação e habilidade direta validados.');
