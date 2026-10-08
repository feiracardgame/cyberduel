const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const stop = new Error('camera');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} },
  configurarCameraLogica() { throw stop; } });
for (const file of ['js/cenas/jogo.js', 'js/title-ui.js', 'js/tutorial.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Scene = vm.runInContext('CenaJogo', context);
const UI = vm.runInContext('CyberduelTitleUI', context);
const Training = vm.runInContext('CyberduelTraining', context);
const scene = Object.assign(Object.create(Scene.prototype), {
  sys: { settings: { data: { tutorial: true } } }, events: { once() {} },
});
assert.throws(() => scene.create(scene.sys.settings.data), error => error === stop);
assert.equal(scene.tutorial, true);
assert.throws(() => scene.create(scene.sys.settings.data), error => error === stop);
assert.equal(scene.tutorial, false, 'A próxima partida não herda tutorial nem debug.');

const training = Object.assign(Object.create(Training.prototype), { scene, step: 'talk' });
scene.training = training;
scene.ehMeuTurno = true; scene.faseAtual = 'colocar';
assert.equal(scene.podeJogarCartasAgora(), false);
assert.equal(scene.podeConsultarCartas(), false);
training.step = 'intern';
assert.equal(scene.podeJogarCartasAgora(), true);
training.step = 'tiger-pass';
assert.equal(scene.podeJogarCartasAgora(), false);
assert.equal(scene.podeConsultarCartas(), false);
// Nenhuma dependência de UI: os handlers saem antes de abrir desistência/menu/gestos.
scene.aoClicarDesistir(); scene.abrirOpcoesDaRoda(); scene.configurarGestosMao();
const wrong = { nome: 'Estagiário de Machine Learning' };
scene.mostrarDetalheCarta(wrong);
training.step = 'tiger-ability'; scene.faseAtual = 'habilidades';
assert.equal(scene.podeUsarHabilidadesAgora(), true);
const hand = { input: {}, dadosCarta: wrong };
const tiger = { input: {}, dadosCartaCampo: { nome: 'O Tigre' } };
const intern = { input: {}, dadosCartaCampo: wrong };
scene.children = { list: [hand, tiger, intern] };
scene.botaoPassarTutorial = { input: {} };
training.highlight = { active: true };
training.update();
assert.equal(hand.input.enabled, false);
assert.equal(tiger.input.enabled, true);
assert.equal(intern.input.enabled, false);
assert.equal(scene.botaoPassarTutorial.input.enabled, false);
training.step = 'tiger-pass'; training.update();
assert.equal(scene.botaoPassarTutorial.input.enabled, true);

// Na etapa de ataque, a orientação muda de lado ao abrir e fechar a ficha.
const guideClasses = new Set();
training.guide = { classList: { toggle(name, enabled) {
  if (enabled) guideClasses.add(name); else guideClasses.delete(name);
} } };
for (const step of ['tiger-ability', 'dipsp-ability']) {
  training.step = step;
  scene.modalAberto = false; training.update();
  assert.equal(guideClasses.has('elenai-guide--bottom'), true);
  scene.modalAberto = true; training.update();
  assert.equal(guideClasses.has('elenai-guide--bottom'), false);
  scene.modalAberto = false; training.update();
  assert.equal(guideClasses.has('elenai-guide--bottom'), true);
}
training.step = 'dipsp-pass'; training.update();
assert.equal(guideClasses.has('elenai-guide--bottom'), false);
delete training.guide;

// O destaque acompanha o botão atual, inclusive após redesenhos da interface.
{
  const circles = [];
  const shape = (x, y, radius) => ({ active: true, x, y, radius,
    setStrokeStyle() { return this; }, setDepth() { return this; },
    destroy() { this.active = false; } });
  const guidedScene = { children: { list: [] }, partida: {},
    layout: vm.runInContext('LAYOUT_CAMPO_NORMAL', context),
    add: { circle(x, y, radius) { const circle = shape(x, y, radius); circles.push(circle); return circle; },
      rectangle: shape }, tweens: { add() {} }, desenharInterface() {},
  };
  const guide = Object.assign(Object.create(Training.prototype), { scene: guidedScene, hint: {} });
  for (const [index, name] of ['O Tigre', 'Agente da DIPSP'].entries()) {
    guidedScene.botaoPassarTutorial = { active: true, input: {}, x: 975 - index * 50, y: 1638 + index * 100, width: 158 };
    const button = guidedScene.botaoPassarTutorial;
    guide.placed({ nome: name }); guide.update();
    assert.match(guide.hint.textContent, /botão >> à direita/);
    assert.equal(button.input.enabled, true);
    assert.equal(guide.highlight.x, button.x);
    assert.equal(guide.highlight.y, button.y);
    assert.ok(guide.highlight.radius > button.width / 2);
    const previous = guide.highlight;
    previous.destroy(); button.y += 35;
    guide.update();
    assert.notEqual(guide.highlight, previous);
    assert.equal(guide.highlight.y, button.y);
    guide.pass(); guide.update();
    assert.equal(guidedScene.faseAtual, 'habilidades');
    assert.equal(guide.step, index === 0 ? 'tiger-ability' : 'dipsp-ability');
    assert.equal(button.input.enabled, false);
  }
  assert.equal(circles.length, 4);
}

let starts = 0;
const ui = new UI({ callbacks: { onTutorial() { starts++; } } });
ui.menuCategories = [{ id: 'tutorial' }];
ui.cardMenuState = { mode: 'categories', items: ui.menuCategories };
ui.menuCategory = 'tutorial';
ui.playMenuClick = () => {};
ui.closeModal = () => {};
ui.transitionCardMenu = change => change();
let rules = 0;
ui.openRules = () => { rules++; };
ui.handleCardClick({ dataset: { position: 'center', itemIndex: '0' } });
assert.equal(ui.cardMenuState.mode, 'options', 'Tutorial abre submenu de regras e treino.');
ui.handleCardMenuAction();
assert.equal(rules, 1);
ui.cardMenuState.optionIndex = 1;
ui.handleCardMenuAction();
ui.handleCardClick({ dataset: { position: 'center', itemIndex: '1' } });
assert.equal(starts, 2, 'Repetir tutorial abre o treino sem facção/deck.');
ui.closeCategoryOptions();
assert.equal(ui.cardMenuState.mode, 'categories');
assert.ok(fs.existsSync('assets/menus/repetir_tutorial.png'));

// Redesenhos de invocações preservam os mesmos objetos, zoom e posição de leitura.
const panel = { active: true, destroy() { this.active = false; } };
const overlay = { destroy() {} };
Object.assign(scene, { training: null, painelDetalheAtual: panel, overlayDetalheAtual: overlay,
  modalAberto: true, ehMeuTurno: false, limparEventosDescricao() {}, limparMascaraRender() {},
  limparCamadaModalCarta() {}, tweens: {} });
scene.desenharInterface(); scene.desenharInterface();
scene.encerrarSelecoesDaFase();
assert.equal(scene.painelDetalheAtual, panel);
assert.equal(scene.modalAberto, true);
assert.equal(scene.redesenhoAposLeitura, true);
let redraws = 0;
scene.desenharInterface = () => { redraws++; };
scene.fecharDetalheCarta(true);
assert.equal(scene.modalAberto, false);
assert.equal(panel.active, false);
assert.equal(redraws, 1, 'Fechar a leitura apresenta o estado acumulado do campo.');
console.log('Tutorial: isolamento de cenas, restrições, retomada pelo menu e leitura preservada.');
