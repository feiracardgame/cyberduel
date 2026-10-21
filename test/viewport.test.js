const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const properties = {}, listeners = {}, viewportListeners = {}, documentListeners = {}, insets = {};
let pending, refreshes = 0;
const window = {
  innerWidth: 390, innerHeight: 844,
  visualViewport: { width: 390, height: 700, offsetLeft: 0, offsetTop: 0,
    addEventListener: (key, callback) => viewportListeners[key] = callback },
  addEventListener: (key, callback) => listeners[key] = callback,
  removeEventListener: (key, callback) => { if (listeners[key] === callback) delete listeners[key]; },
  getComputedStyle: () => ({ getPropertyValue: key => insets[key] || '0px' }),
  requestAnimationFrame: callback => { pending = callback; return 1; },
};
const document = { documentElement: { style: { setProperty: (k,v) => properties[k] = parseFloat(v) } },
  addEventListener: (key, callback) => documentListeners[key] = callback };
vm.runInNewContext(fs.readFileSync('js/viewport.js', 'utf8'), { window, document });
const api = window.cyberduelViewport;
api.configure(720,1480);
api.attach({ isBooted: true, scale: { setParentSize: (width, height) => {
  assert.equal(width, properties["--viewport-width"]);
  assert.equal(height, properties["--viewport-height"]);
  refreshes++;
} } });
assert.equal(properties['--viewport-height'],700);
assert.equal(properties['--game-display-height'],700);
assert.ok(properties['--game-display-width']<=390);
window.visualViewport.height=410;
viewportListeners.resize(); viewportListeners.scroll(); pending();
assert.equal(properties['--game-display-height'],410);
window.innerWidth=844;window.innerHeight=390;
window.visualViewport.width=844;window.visualViewport.height=320;
listeners.orientationchange();pending();
assert.equal(properties['--game-display-height'],320);
assert.ok(properties['--game-display-width']<=844);
window.visualViewport.offsetTop=24;window.visualViewport.offsetLeft=10;
viewportListeners.scroll();pending();
assert.equal(properties['--viewport-top'],24);assert.equal(properties['--viewport-left'],10);
window.visualViewport=null;listeners.resize();pending();
assert.equal(properties['--viewport-height'],390);
assert.equal(properties['--viewport-top'],0);
assert.ok(refreshes>=5);
console.log('Viewport: barras móveis, teclado, orientação, deslocamento e fallback sem VisualViewport validados.');

window.innerWidth = 390; window.innerHeight = 844;
Object.assign(insets, { '--safe-area-top': '47px', '--safe-area-bottom': '34px' });
api.update();
assert.equal(properties['--viewport-top'], 47);
assert.equal(properties['--viewport-height'], 763, 'O jogo respeita notch e área do gesto inferior.');
window.innerWidth = 844; window.innerHeight = 390;
Object.assign(insets, { '--safe-area-top': '0px', '--safe-area-bottom': '21px', '--safe-area-left': '47px', '--safe-area-right': '47px' });
api.update();
assert.equal(properties['--viewport-left'], 47);
assert.equal(properties['--viewport-width'], 750);
assert.equal(properties['--viewport-height'], 369);
for (const key of Object.keys(insets)) delete insets[key];

window.innerWidth = 390; window.innerHeight = 844;
window.visualViewport = { width: 390, height: 410, offsetTop: 30, offsetLeft: 0 };
let scrolls = 0;
const input = { tagName: 'INPUT', type: 'text',
  scrollIntoView(options) { assert.equal(options.block, 'nearest'); assert.equal(options.behavior, 'instant'); scrolls++; } };
document.activeElement = input;
for (const type of ['text', 'search', 'email', 'password', 'tel', 'url', 'number']) {
  input.type = type;
  const before = scrolls;
  documentListeners.focusin(); pending();
  assert.equal(scrolls, before + 1, `${type}: foco mantém o campo acima do teclado.`);
}
api.update();
assert.equal(scrolls, 8, 'Confere também campos dentro de painéis com rolagem própria.');
viewportListeners.scroll(); pending();
assert.equal(scrolls, 9, 'Recalcula após o deslocamento vertical do viewport.');
for (const type of ['range', 'checkbox', 'radio', 'file', 'button', 'submit']) {
  input.type = type; api.update();
}
assert.equal(scrolls, 9, 'Sliders e botões não acionam rolagem de texto.');
input.type = 'text'; input.readOnly = true; api.update();
input.readOnly = false; input.disabled = true; api.update();
assert.equal(scrolls, 9, 'Ignora campos bloqueados.');
input.disabled = false; input.tagName = 'TEXTAREA'; api.update();
input.tagName = 'DIV'; input.isContentEditable = true; api.update();
assert.equal(scrolls, 11, 'Textareas e conteúdo editável também ficam visíveis.');
window.innerHeight = 410; api.update();
assert.equal(scrolls, 12, 'Funciona quando o teclado redimensiona também a janela.');
delete document.activeElement;
window.visualViewport = null;
console.log('Teclado: foco global, campos de texto, área visível, deslocamento, textarea, edição e controles ignorados validados.');

(async () => {
  const touch = listeners.pointerup, root = document.documentElement;
  let requests = 0;
  window.matchMedia = query => ({ matches: query === '(pointer: coarse)' });
  root.requestFullscreen = function (options) {
    assert.equal(this, root); assert.equal(options.navigationUI, 'hide');
    requests++; return Promise.resolve();
  };
  const event = { target: { closest: () => false } };
  await touch({ target: { closest: () => true } });
  assert.equal(requests, 0, 'Editar texto ou usar login não ativa fullscreen.');
  window.matchMedia = () => ({ matches: false });
  await touch(event);
  assert.equal(requests, 0, 'Desktop não entra automaticamente em fullscreen.');
  window.matchMedia = () => ({ matches: true });
  await touch(event);
  assert.equal(requests, 0, 'App instalado não precisa de uma nova solicitação.');
  window.matchMedia = query => ({ matches: query === '(pointer: coarse)' });
  document.fullscreenElement = root;
  await touch(event);
  assert.equal(requests, 0, 'Não solicita novamente quando já está em fullscreen.');
  document.fullscreenElement = null;
  window.navigator = { standalone: true };
  await touch(event);
  assert.equal(requests, 0);
  window.navigator.standalone = false;
  const request = root.requestFullscreen;
  delete root.requestFullscreen;
  await touch(event);
  assert.equal(requests, 0, 'Navegador sem API continua funcionando.');
  let legacyRequests = 0;
  root.webkitRequestFullscreen = function () { assert.equal(this, root); legacyRequests++; throw Error('Bloqueado'); };
  await touch(event);
  assert.equal(legacyRequests, 1, 'Fallback WebKit é chamado com o elemento correto.');
  delete root.webkitRequestFullscreen;
  root.requestFullscreen = () => Promise.reject(Error('Bloqueado'));
  await touch(event);
  assert.equal(listeners.pointerup, touch, 'Bloqueio permite tentar no próximo toque.');
  root.requestFullscreen = request;
  await touch(event);
  assert.equal(requests, 1);
  assert.equal(listeners.pointerup, undefined, 'Depois de entrar, remove o listener de toque.');
  await touch(event);
  assert.equal(requests, 1, 'Sair do fullscreen não força uma nova entrada.');
  window.innerHeight = 900;
  documentListeners.fullscreenchange(); pending();
  assert.equal(properties['--viewport-height'], 900);
  window.innerHeight = 700;
  documentListeners.webkitfullscreenchange(); pending();
  assert.equal(properties['--viewport-height'], 700);
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.equal(manifest.display, 'fullscreen');
  assert.equal(manifest.start_url, './');
  assert.ok(fs.existsSync(manifest.icons[0].src));
  console.log('Fullscreen móvel: toque único, desktop, edição, app instalado, WebKit, falhas, saída, recálculo e áreas seguras validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
