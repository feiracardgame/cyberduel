const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} }, configurarCameraLogica() {},
  LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220 });
for (const file of ['js/cenas/transicao.js', 'js/cenas/titulo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Transition = vm.runInContext('CenaTransicao', context);
const Title = vm.runInContext('CenaTitulo', context);

for (const table of [null, 1, 5]) for (const field of [1, 2, 4]) {
  const timers = [];
  let videoKey, music, destination;
  const video = Object.assign(new EventEmitter(), {
    active: true, setOrigin() {}, setMute(value) { this.muted = value; }, setVisible() {},
    play() {}, isPlaying: () => true, stop() {}, destroy() {},
  });
  context.window.cyberduelMultiplayer = { active: true, initialized: true, table, ranked: true,
    phaseStartsAt: Date.now() + 5000, clockOffset: 0, announcementPending: () => true };
  context.window.cyberduelSettings = { get: () => field, playMusic(scene, key) { music = key; } };
  const scene = Object.assign(Object.create(Transition.prototype), {
    cameras: { main: { setBackgroundColor() {} } },
    registry: { get: () => 'carregamento_echorasp.mp4' },
    add: { video(x, y, key) { videoKey = key; return video; } },
    time: { delayedCall(delay, callback) { timers.push({ delay, callback }); } },
    events: new EventEmitter(), criarSkip() {}, scene: { start(key) { destination = key; } },
  });
  scene.create();
  assert.equal(video.muted, true);
  if (table === 5) {
    assert.equal(videoKey, 'videoAberturaHumbaNet');
    assert.equal(music, 'musicaHumbaNet');
    assert.equal(scene.fundoTransicao, 'videoHumbaNet');
    const start = timers.find(timer => timer.delay <= 5000);
    assert.ok(start, 'A abertura não consome o tempo da primeira fase.');
    start.callback();
    assert.equal(destination, 'CenaJogo');
  } else {
    assert.notEqual(videoKey, 'videoHumbaNet');
    assert.notEqual(music, 'musicaHumbaNet');
  }
  const title = Object.assign(Object.create(Title.prototype), {
    multiplayer: context.window.cyberduelMultiplayer,
    scene: { start(key) { destination = key; } },
  });
  title.iniciarPartida(true);
  assert.equal(destination, table === 5 ? 'CenaTransicao' : 'CenaJogo');
  title.multiplayer.announcementPending = () => false;
  title.iniciarPartida(true);
  assert.equal(destination, 'CenaJogo', 'Reconexão durante a partida não repete a abertura.');
}
assert.ok(fs.statSync('assets/videos/background_humbanet.mp4').size > 1000);
console.log('Conselho: vídeo e música exclusivos, preferências, abertura sincronizada e reconexão validados.');
