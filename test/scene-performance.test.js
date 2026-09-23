const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
for (const file of ['js/cenas/jogo.js', 'js/cenas/efeitos.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const layouts = vm.runInContext('[LAYOUT_CAMPO_NORMAL, LAYOUT_CAMPO_AMPLIADO]', context);

// Reutiliza os vinte fundos; só recria ao mudar o layout.
{
  let created = 0, attached = 0;
  const scene = Object.assign(Object.create(Scene.prototype), {
    layout: layouts[0],
    add: { container() { return { active: true, list: [],
      setDepth(depth) { this.depth = depth; return this; },
      add(object) { this.list.push(object); },
      destroy() { this.active = false; this.list.forEach(o => o.active = false); },
    }; } },
    children: { add() { attached++; } },
    criarSuperficieVidro(x, y, width, height, style) {
      created++; return { active: true, x, y, width, height, style };
    },
  });
  scene.desenharBaseCampo();
  const initial = scene.baseCampo;
  assert.equal(created, 20);
  assert.equal(initial.depth, -1);
  for (let i = 0; i < 50; i++) scene.desenharBaseCampo();
  assert.equal(created, 20, 'Redesenhos não recriam os fundos.');
  assert.equal(attached, 50);
  assert.equal(scene.baseCampo, initial);
  scene.layout = layouts[1]; scene.desenharBaseCampo();
  assert.equal(created, 40);
  assert.equal(initial.active, false);
  assert.ok(initial.list.every(o => !o.active));
  assert.equal(scene.baseCampo.list[0].width, layouts[1].slotW);
  scene.layout = layouts[0]; scene.desenharBaseCampo();
  assert.equal(created, 60);
  assert.equal(scene.baseCampo.list[0].height, layouts[0].slotH);
}

// Não reenvia o histórico sem eventos novos; aceita snapshots e reinício dos efeitos.
{
  let received = 0;
  const effects = { ultimoEvento: 0, receber(events) { received++; this.ultimoEvento = events.at(-1).id; } };
  const events = [{ id: 1 }, { id: 2 }];
  const scene = Object.assign(Object.create(Scene.prototype), {
    partida: { eventosEfeito: events }, scene: { manager: { keys: { CenaEfeitos: effects } } },
  });
  for (let i = 0; i < 120; i++) scene.apresentarEventosEfeito();
  assert.equal(received, 1);
  scene.apresentarEventosEfeito([{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.equal(received, 2);
  scene.apresentarEventosEfeito(); assert.equal(received, 2);
  effects.ultimoEvento = 0;
  scene.apresentarEventosEfeito(); assert.equal(received, 3);
}

// Não percorre o campo ocioso, mas restaura as cartas ao concluir uma invocação.
{
  const Effects = context.window.CenaEfeitos;
  let scans = 0;
  const card = { visible: false, ocultaPorInvocacao: true, setVisible(v) { this.visible = v; } };
  const scene = Object.assign(Object.create(Effects.prototype), {
    invocacoesPendentes: new Map(), jogo: { children: { get list() { scans++; return [card]; } } },
  });
  for (let i = 0; i < 120; i++) scene.update();
  assert.equal(scans, 0);
  scene.haCartasOcultas = true; scene.update();
  assert.equal(card.visible, true);
  assert.equal(scans, 1);
  scene.update(); assert.equal(scans, 1);
}

// Limpa apenas os listeners da descrição; repetir a limpeza é seguro.
{
  const input = new EventEmitter(), handler = () => {}, other = () => {};
  const scene = Object.assign(Object.create(Scene.prototype), { input,
    handlersScrollDescAtual: { handlerMove: handler, handlerUp: handler, handlerWheel: handler },
  });
  for (const event of ['pointermove', 'pointerup', 'pointerupoutside', 'wheel']) input.on(event, handler);
  input.on('pointerup', other);
  scene.limparEventosDescricao(); scene.limparEventosDescricao();
  assert.deepEqual(input.eventNames(), ['pointerup']);
  assert.deepEqual(input.listeners('pointerup'), [other]);
}
console.log('Cena: reutilização do campo, eventos incrementais, ociosidade e limpeza de listeners validados.');

// Desligar libera o vídeo; redesenhar não o recria até reativar.
{
  let enabled = 1, created = 0, destroyed = 0;
  context.window.cyberduelSettings = {
    get: () => enabled, set: (key, value) => { enabled = Number(value); },
  };
  const scene = Object.assign(Object.create(Scene.prototype), {
    cameras: { main: { setBackgroundColor(color) { assert.equal(color, '#07111f'); } } },
    children: { addAt() {} },
    add: { video() {
      created++;
      return { active: true, setOrigin() {}, setVisible() {}, setMute() {}, once() {},
        play(loop) { assert.equal(loop, true); }, setDepth() {}, destroy() { destroyed++; this.active = false; } };
    } },
  });
  scene.desenharFundoJogo(); assert.equal(created, 1);
  scene.definirFundoAnimado(false); assert.equal(destroyed, 1); assert.equal(scene.videoFundo, null);
  scene.desenharFundoJogo(); assert.equal(created, 1); assert.equal(destroyed, 1);
  scene.definirFundoAnimado(true); assert.equal(created, 2);
  delete context.window.cyberduelSettings;
}

// O placar fica abaixo da última fileira nos dois layouts.
for (const [index, layout] of layouts.entries()) {
  let panel;
  const scene = Object.assign(Object.create(Scene.prototype), {
    layout, maoEscondida: index === 1,
    partida: { turno: 1, maxTurnos: 7, rodadasJogador: 0, rodadasInimigo: 0 },
    criarPainelTatico(x, y, width, height) { panel = { x, y, width, height, add() {} }; return panel; },
    criarTextoUI() { return { setOrigin() { return this; } }; },
  });
  scene.desenharStatus();
  assert.ok(panel.y - panel.height / 2 >= layout.yJogadorTras + layout.slotH / 2 + 50);
}
console.log('Fundo opcional e placar sem sobreposição com o campo validados.');
