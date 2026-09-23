const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ window: { location: { search: '' } }, URLSearchParams,
  Phaser: { Scene: class {} }, LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220 });
vm.runInContext(fs.readFileSync('js/cenas/preload.js', 'utf8'), context);
const Scene = vm.runInContext('CenaPreload', context);
const objects = [];
function object(text) {
  const o = Object.assign(new EventEmitter(), { active: true, text,
    setOrigin() { return this; }, setStrokeStyle() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setDisplaySize(w, h) { this.width = w; this.height = h; return this; },
    setText(value) { this.text = value; return this; }, setColor() { return this; },
    loadURL(url, noAudio) { this.url = url; this.noAudio = noAudio; },
    setMute(value) { this.muted = value; }, play(loop) { this.loop = loop; },
    stop() { this.stopped = true; },
  });
  objects.push(o); return o;
}
let destination, loads = 0;
const timers = [];
const scene = Object.assign(Object.create(Scene.prototype), {
  cameras: { main: { setBackgroundColor() {} } },
  add: { video: () => object(), rectangle: () => object(), text: (x,y,text) => object(text) },
  events: new EventEmitter(), load: new EventEmitter(),
  time: { now: 0, delayedCall(delay, fn) {
    const timer = { delay, fn, remove() { this.removed = true; } };
    timers.push(timer); return timer;
  } }, scene: { start(name) { destination = name; } },
  carregarAssets() { loads++; },
});
scene.load.start = () => {};
scene.criarBarraDeCarregamento();
const video = objects[0];
assert.ok(fs.existsSync(video.url.split('?')[0]));
assert.equal(video.noAudio, true);
assert.equal(video.muted, true);
assert.equal(video.loop, true);
assert.equal(video.visible, false);
scene.create();
assert.equal(loads, 0, 'Assets aguardam o primeiro frame do vídeo.');
assert.equal(destination, undefined);
video.emit('created', video, 1080, 1920);
assert.equal(loads, 1);
assert.equal(timers[0].removed, true);
assert.equal(video.visible, true);
assert.ok(video.width >= 1080 && video.height >= 2220);
assert.equal(video.width / video.height, 1080 / 1920);
scene.load.emit('progress', 0.5);
assert.ok(objects.some(o => o.text === '50%'));
video.emit('error');
assert.equal(video.visible, false);
scene.load.emit('complete');
assert.ok(objects.some(o => o.text === 'SIMULAÇÃO PRONTA'));
assert.equal(destination, undefined, 'Cache quente não pula a abertura.');
assert.equal(timers.at(-1).delay, 1000);
timers.at(-1).fn();
assert.equal(destination, 'CenaTitulo');
assert.equal(loads, 1, 'Erro posterior não reinicia o carregamento.');
scene.events.emit('shutdown');
assert.equal(video.stopped, true);
context.window.location.search = '?deck=1';
scene.create(); // Vídeo já falhou: libera os assets imediatamente.
assert.equal(loads, 2);
scene.load.emit('complete');
timers.at(-1).fn();
assert.equal(destination, 'CenaDeckBuilder');
scene.videoFalhou = false;
scene.create();
assert.equal(loads, 2);
timers.at(-1).fn(); // Vídeo que não inicia: timeout libera a aplicação.
assert.equal(loads, 3);
console.log('Carregamento: vídeo antes dos assets, cache quente, loop, proporção, progresso, erro, timeout e saída validados.');
