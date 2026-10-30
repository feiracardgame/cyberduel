const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const media = [], listeners = new Map();
let blocked = true;
const window = {
  document: {
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
  },
  Audio: class {
    constructor(src) { this.src = src; this.volume = 1; media.push(this); }
    play() {
      if (blocked) return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
      this.paused = false; return Promise.resolve();
    }
    pause() { this.paused = true; }
    removeAttribute(name) { assert.equal(name, 'src'); this.src = ''; }
    load() { this.released = true; }
  },
};
const context = vm.createContext({ window, setTimeout });
vm.runInContext(fs.readFileSync('js/settings.js', 'utf8'), context);
const settings = window.cyberduelSettings;
const nodes = [];
const node = () => {
  const value = { gain: { value: 1 }, connect() {}, disconnect() { this.disconnected = true; } };
  nodes.push(value); return value;
};
const scene = { events: new EventEmitter(), sound: { context: {
  createMediaElementSource: node, createGain: node, resume: () => Promise.resolve(), destination: {},
} } };
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  settings.playMusic(scene, 'musicaMenu');
  await flush();
  assert.equal(media.length, 1);
  assert.equal(media[0].preload, 'none');
  assert.equal(media[0].loop, true);
  assert.ok(listeners.has('pointerdown'));
  assert.ok(listeners.has('keydown'));
  blocked = false;
  listeners.get('pointerdown')();
  await flush();
  assert.equal(media[0].paused, false);
  assert.equal(listeners.size, 0, 'Retira os listeners após desbloquear.');
  settings.set('musicVolume', .5);
  assert.equal(nodes[1].gain.value, settings.musicForTrack('musicaMenu'), 'Ganho funciona mesmo com o volume fixo do iOS.');
  assert.equal(media[0].volume, 1);
  settings.playMusic(scene, 'musicaMenu');
  assert.equal(media.length, 1, 'Não duplica a trilha atual.');
  settings.playMusic(scene, 'musicaIA');
  await flush();
  assert.equal(media[0].paused, true);
  assert.equal(media[0].src, '');
  assert.equal(media[0].released, true);
  assert.ok(nodes.slice(0, 2).every(node => node.disconnected));
  scene.events.emit('shutdown');
  assert.equal(media[1].paused, true);
  assert.equal(scene.cyberMusic, null);
  assert.equal(settings.musicScene, null);
  assert.ok(nodes.every(node => node.disconnected));
  blocked = true;
  settings.playMusic(scene, 'musicaDeck');
  await flush();
  scene.events.emit('shutdown');
  assert.equal(listeners.size, 0, 'Não deixa listeners de uma cena encerrada.');
  window.Audio.prototype.play = () => Promise.reject(new Error('network failure'));
  settings.playMusic(scene, 'musicaMenu');
  await flush();
  assert.equal(listeners.size, 0, 'Uma falha de mídia não trava a cena nem repete a reprodução.');
  scene.events.emit('shutdown');
  console.log('Streaming: memória, autoplay, volume iOS, troca de trilha, falha de rede e limpeza validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
