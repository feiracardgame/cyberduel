const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calls = [];
let active = 'CenaTitulo', popstate;
const history = {
  state: { existing: true },
  pushState(state) { this.state = state; calls.push('push'); },
  back() { calls.push('leave'); },
};
const scenes = {};
const context = vm.createContext({
  window: { history, addEventListener(name, handler) { assert.equal(name, 'popstate'); popstate = handler; } },
  game: { scene: { isActive: name => name === active, getScene: name => scenes[name] } },
});
for (const file of ['js/title-ui.js', 'js/deck-builder-ui.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const title = vm.runInContext('Object.create(CyberduelTitleUI.prototype)', context);
const deck = vm.runInContext('Object.create(CyberduelDeckBuilderUI.prototype)', context);
scenes.CenaTitulo = { titleUI: title };
scenes.CenaDeckBuilder = { deckBuilderUI: deck };
const source = fs.readFileSync('js/main.js', 'utf8');
vm.runInContext(source.slice(source.indexOf('function voltarMenuJogo()')), context);
assert.equal(history.state.existing, true, 'Mantém o estado anterior do navegador.');

title.cardMenuState = { mode: 'options' };
title.modal = {};
title.closeModal = () => { calls.push('modal'); title.modal = null; };
title.closeCategoryOptions = () => { calls.push('category'); title.cardMenuState.mode = 'categories'; };
popstate();
assert.deepEqual(calls.splice(0), ['push', 'modal', 'push']);
popstate();
assert.deepEqual(calls.splice(0), ['category', 'push']);
popstate();
assert.deepEqual(calls.splice(0), ['leave'], 'Na raiz, permite sair pelo histórico normal.');

active = 'CenaDeckBuilder';
deck.mobileView = 'deck';
deck.showMobileView = view => { calls.push(view); deck.mobileView = view; };
deck.dirty = true;
deck.openConfirm = () => { calls.push('confirm'); deck.modal = {}; };
deck.closeModal = () => { calls.push('cancel'); deck.modal = null; };
deck.onExit = () => calls.push('exit');
popstate(); popstate(); popstate();
assert.deepEqual(calls.splice(0), ['collection', 'push', 'confirm', 'push', 'cancel', 'push']);
deck.dirty = false;
popstate();
assert.deepEqual(calls.splice(0), ['exit', 'push']);

active = 'CenaJogo';
const scene = scenes.CenaJogo = {};
for (const [flag, method] of [
  ['zoomAberto', 'fecharZoomCarta'], ['painelDetalheAtual', 'fecharDetalheCarta'],
  ['historicoAberto', 'fecharHistorico'], ['rodaOpcoesContainer', 'fecharOpcoesDaRoda'],
]) {
  scene[flag] = true;
  scene[method] = () => { calls.push(method); scene[flag] = false; };
}
for (let i = 0; i < 5; i++) popstate();
assert.deepEqual(calls, ['fecharZoomCarta', 'push', 'fecharDetalheCarta', 'push',
  'fecharHistorico', 'push', 'fecharOpcoesDaRoda', 'push', 'push']);
console.log('Voltar: submenus, janelas, deck sem salvar e camadas do duelo validados.');
