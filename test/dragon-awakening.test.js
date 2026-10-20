const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const context = vm.createContext({ console, window: {}, Phaser: {
  Scene: class {}, BlendModes: { ADD: 1, SCREEN: 3 },
}, LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220, Y_MAO_INIMIGO: 230, Y_MAO_JOGADOR: 1900,
TIPOS_EFEITO: { ARMADILHA_ESPACO: 'armadilha_espaco', VINCULO_ALIADO: 'vinculo_aliado' } });
vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), context);
const Scene = context.window.CenaEfeitos;
const dragonName = 'Dragão das Comunicações Móveis';

function fixture({ side = 'jogador', spectator = false, presentation = false, audio = true, reduced = false,
  duration = 2, missing = [] } = {}) {
  let now = 0;
  const tasks = [], objects = [], sounds = [], shakes = [];
  const events = new EventEmitter();
  const schedule = (delay, callback, target = null) => {
    const task = { at: now + delay, callback, target, cancelled: false,
      remove() { this.cancelled = true; } };
    tasks.push(task); return task;
  };
  const object = (type, x = 0, y = 0, value) => {
    const o = Object.assign(new EventEmitter(), { type, x, y, value, active: true, visible: true,
      width: 1024, height: 1536, alpha: 1, angle: 0, scaleX: 1, scaleY: 1,
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setDisplaySize(w, h) { this.width = w; this.height = h; return this; },
      setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; },
      setAlpha(v) { this.alpha = v; return this; }, setVisible(v) { this.visible = v; return this; },
      setName(v) { this.name = v; return this; }, setDepth(v) { this.depth = v; return this; },
      setAngle(v) { this.angle = v; return this; }, setRotation(v) { this.rotation = v; return this; },
      setText(v) { this.value = v; return this; }, setTint(v) { this.tint = v; return this; },
      clearTint() { delete this.tint; return this; },
      setStrokeStyle(...args) { this.stroke = args; return this; },
      setBlendMode(v) { this.blendMode = v; return this; },
      setOrigin() { return this; }, setScrollFactor() { return this; }, setCrop() { return this; },
      setInteractive() { return this; },
      setFillStyle() { return this; },
      setMask() { return this; }, createGeometryMask() { return { destroy() {} }; },
      add(children) { (this.children ||= []).push(...children); return this; },
      destroy() {
        if (!this.active) return;
        this.active = false; this.emit('destroy');
        this.children?.forEach(child => child.destroy());
      },
    });
    for (const method of ['clear', 'fillStyle', 'fillRect', 'fillCircle', 'fillEllipse', 'lineStyle',
      'beginPath', 'closePath', 'moveTo', 'lineTo', 'strokePath', 'fillPath', 'strokeCircle',
      'strokeEllipse', 'lineBetween', 'arc', 'strokeRect', 'fillTriangle']) o[method] = () => o;
    Object.defineProperties(o, {
      displayWidth: { get() { return this.width * this.scaleX; } },
      displayHeight: { get() { return this.height * this.scaleY; } },
    });
    objects.push(o); return o;
  };
  const camera = () => ({ shakeEffect: { isRunning: false,
    reset() { this.isRunning = false; } },
    shake(...args) { this.shakeEffect.isRunning = true; shakes.push({ at: now, args }); return this; },
    flash() { return this; }, resetFX() { this.shakeEffect.reset(); return this; },
  });
  const addSound = (key, config) => {
    const sound = { key, config, active: true, isPlaying: false,
      play() { this.isPlaying = true; sounds.push({ key, config, at: now, sound: this }); return this; },
      stop() { this.isPlaying = false; return this; },
      destroy() { this.stop(); this.active = false; } };
    return sound;
  };
  const scene = Object.assign(Object.create(Scene.prototype), {
    fila: [], ultimoEvento: 0, exibidos: [], executando: false, events,
    jogo: { children: { list: [] }, multiplayer: { spectator, presentation }, cameras: { main: camera() },
      layout: { slotW: 195, slotH: 270, x: [110, 325, 540, 755, 970], yInimigo: [560, 842], yJogador: [1436, 1154] },
      partida: { jogador: { campo: { cartas: [] } }, inimigo: { campo: { cartas: [] } } } },
    cameras: { main: camera() }, textures: { exists: key => !missing.includes(key) },
    cache: { audio: { exists: () => audio, get: () => ({ duration }) }, video: { exists: () => false } },
    add: Object.fromEntries(['image', 'sprite', 'rectangle', 'text', 'circle', 'ellipse', 'triangle', 'container', 'graphics']
      .map(type => [type, (...args) => object(type, ...args)])),
    sound: { add: addSound, play(key, config) { addSound(key, config).play(); return true; },
      getAll: key => sounds.filter(sound => sound.key === key).map(sound => sound.sound) },
    time: { delayedCall: schedule },
    tweens: {
      add(config) {
        const targets = Array.isArray(config.targets) ? config.targets : [config.targets];
        const delay = Number(config.delay) || 0;
        schedule(delay, () => config.onStart?.(), targets);
        const repeat = config.repeat < 0 ? 1000 : Number(config.repeat) || 0;
        return schedule(delay + (config.duration || 0) * (config.yoyo ? 2 : 1) * (repeat + 1), () => {
          for (const target of targets) for (const key of ['x', 'y', 'alpha', 'scale', 'scaleX', 'scaleY', 'angle', 'rotation', 'progresso', 'fillAlpha']) {
            if (typeof config[key] === 'number') target[key] = config[key];
          }
          config.onUpdate?.(); config.onComplete?.();
        }, targets);
      },
      killTweensOf(target) { tasks.filter(task => task.target?.includes(target)).forEach(task => task.remove()); },
    },
  });
  context.window.cyberduelSettings = { effects: volume => volume * .4 };
  context.window.matchMedia = () => ({ matches: reduced });
  const f = { scene, objects, sounds, shakes, events,
    advance(until) {
      let steps = 0;
      for (;;) {
        tasks.sort((a, b) => a.at - b.at);
        const index = tasks.findIndex(task => !task.cancelled && task.at <= until);
        if (index < 0) break;
        const [task] = tasks.splice(index, 1); now = task.at; task.callback();
        assert.ok(++steps < 10000, 'A animação deve terminar sem um ciclo de timers.');
      }
      now = until;
    },
    event(id = 1, extra = {}) { return { id, lado: side, momento: 'despertar',
      fonte: { id: 80, nome: dragonName, imagem: 'o_dragao', indice: 2 }, alvos: [], ...extra }; },
    named(name) { return objects.find(object => object.name === name); },
  };
  return f;
}

// O despertar público ocupa a fila uma vez em qualquer perspectiva, com o rugido na revelação.
for (const side of ['jogador', 'inimigo']) for (const spectator of [false, true]) {
  const f = fixture({ side, spectator, presentation: true });
  const event = f.event();
  f.scene.receber([event]); f.scene.receber([event]);
  assert.equal(f.scene.despertarDragaoEmCurso.fase, 'pressagio');
  assert.equal(f.scene.executando, true);
  assert.deepEqual(Array.from(f.scene.exibidos), [1]);
  assert.ok(f.named('despertar-dragao-arte'));
  assert.equal(f.named('despertar-dragao-arte').value, 'despertarDragaoArte');
  assert.equal(f.sounds.filter(sound => sound.key === 'somDragao').length, 0);

  // Um próximo evento real espera toda a revelação e o retorno ao campo.
  const next = f.event(2, { momento: 'continuo', fonte: { id: 81, nome: 'Teste', indice: 2 } });
  f.scene.receber([event, next]);
  for (const [at, phase] of [[1450, 'ruptura'], [2300, 'despertar'], [4300, 'memorias'], [6500, 'retorno']]) {
    f.advance(at);
    assert.equal(f.scene.despertarDragaoEmCurso.fase, phase);
    assert.equal(f.scene.eventoAtual.id, 1, 'Eventos seguintes aguardam a cena terminar.');
  }
  assert.equal(f.sounds.filter(sound => sound.key === 'somDragao').length, 1);
  assert.equal(f.sounds.find(sound => sound.key === 'somDragao').at, 2300);
  assert.ok(f.sounds.every(sound => sound.config.volume > 0 && sound.config.volume <= .4), 'Sons respeitam o volume de efeitos.');
  assert.ok(f.shakes.length, 'A revelação tem impacto no campo.');
  f.advance(7600);
  assert.equal(f.scene.despertarDragaoEmCurso, null);
  assert.deepEqual(Array.from(f.scene.exibidos), [1, 2]);
  assert.ok(f.objects.filter(object => object.name?.startsWith('despertar-dragao-')).every(object => !object.active));
  f.advance(15000);
  assert.equal(f.scene.executando, false);
  assert.equal(f.events.listenerCount('shutdown'), 0);
  assert.ok(f.sounds.every(sound => sound.sound.active === false || sound.key !== 'somDragao'));
}

// Som ausente não impede o retorno; um arquivo longo tem limite para não prender a partida.
for (const options of [{ audio: false }, { duration: 30 }]) {
  const f = fixture(options); f.scene.receber([f.event()]);
  f.advance(11000);
  assert.equal(f.scene.executando, false);
  assert.equal(f.scene.despertarDragaoEmCurso, null);
  if (options.audio === false) assert.equal(f.sounds.length, 0);
}

// A textura das cartas mantém a sequência disponível se a arte original não carregar.
{
  const f = fixture({ missing: ['despertarDragaoArte'] }); f.scene.receber([f.event()]);
  assert.equal(f.named('despertar-dragao-arte').value, 'o_dragao');
  f.advance(11000);
  assert.equal(f.scene.executando, false);
}

// Se a arte ainda não carregou, o evento usa o fallback normal e libera a partida.
{
  const f = fixture({ missing: ['o_dragao'] }); f.scene.receber([f.event()]);
  assert.equal(f.scene.despertarDragaoEmCurso, undefined);
  f.advance(15000);
  assert.equal(f.scene.executando, false);
  assert.ok(!f.objects.some(object => object.name?.startsWith('despertar-dragao-')));
}

// Ao sair da partida, timers não criam novos objetos ou sons e a fila não continua em outra cena.
for (const leaveAt of [600, 3000]) {
  const f = fixture(); f.scene.receber([f.event(), f.event(2)]); f.advance(leaveAt);
  f.events.emit('shutdown');
  const objectCount = f.objects.length, soundCount = f.sounds.length;
  assert.equal(f.scene.despertarDragaoEmCurso, null);
  assert.ok(f.objects.every(object => !object.active));
  assert.ok(f.sounds.every(sound => !sound.sound.active));
  assert.equal(f.scene.jogo.cameras.main.shakeEffect.isRunning, false);
  f.advance(20000);
  assert.equal(f.objects.length, objectCount);
  assert.equal(f.sounds.length, soundCount);
  assert.deepEqual(Array.from(f.scene.exibidos), [1]);
  assert.equal(f.events.listenerCount('shutdown'), 0);
}

// A cena do jogo pode destruir sua câmera antes de encerrar a cena de efeitos.
for (const cameras of [{ main: undefined }, undefined]) {
  const f = fixture(); f.scene.receber([f.event()]); f.advance(3000);
  f.scene.jogo.cameras = cameras;
  assert.doesNotThrow(() => f.events.emit('shutdown'));
  assert.equal(f.scene.despertarDragaoEmCurso, null);
  assert.ok(f.objects.every(object => !object.active));
  assert.ok(f.sounds.every(sound => !sound.sound.active));
  const count = [f.objects.length, f.sounds.length];
  f.advance(20000);
  assert.deepEqual([f.objects.length, f.sounds.length], count);
}

console.log('Despertar do Dragão: fases, rugido único, fila, perspectivas, áudio ausente/longa duração e limpeza ao sair validados.');

// O golpe admin preserva a fila até o veredito e destrói as cartas em qualquer perspectiva.
function securityEvent(f) {
  return f.event(1, { momento: 'seguranca_x1', alvos: Array.from({ length: 10 }, (_, indice) => ({
    lado: 'inimigo', indice, imagem: 'rato', removida: true,
    oculto: indice === 0,
  })) });
}
for (const reduced of [false, true]) for (const side of ['jogador', 'inimigo']) for (const spectator of [false, true]) {
  const f = fixture({ side, reduced, spectator, presentation: true });
  const event = securityEvent(f);
  event.alvos.forEach(target => { target.lado = side === 'jogador' ? 'inimigo' : 'jogador'; });
  f.scene.receber([event, event]);
  assert.equal(f.scene.segurancaX1EmCurso.fase, 'protocolo');
  assert.equal(f.named('seguranca-x1-dragao').value, 'segurancaX1Arte');
  if (side === 'jogador' || spectator) assert.equal(f.named('seguranca-x1-alvo').value, 'fundoCarta', 'Não revela a arte de cartas ocultas.');
  for (const [at, phase] of [[850, 'despertar'], [2300, 'sobrecarga'], [3450, 'disparo'], [5000, 'disparo'], [6000, 'retorno'], [7100, 'veredito']]) {
    f.advance(at);
    assert.equal(f.scene.segurancaX1EmCurso.fase, phase);
    assert.equal(f.scene.executando, true, 'A tela final aguarda toda a sequência.');
    if (at === 3450 || at === 5000) assert.equal(f.named('seguranca-x1-dragao').visible, false, 'Dragão some por completo durante a destruição.');
    if (at === 6000) assert.equal(f.named('seguranca-x1-dragao').visible, true, 'Dragão reaparece na ruptura final.');
  }
  assert.equal(f.scene.segurancaX1EmCurso.destruidas, 10);
  assert.ok(f.sounds.some(sound => sound.key === 'somDragao'));
  assert.ok(f.sounds.some(sound => sound.key === 'somExplosao'));
  assert.ok(f.sounds.every(sound => sound.config.volume <= .4));
  assert.equal(f.shakes.length > 0, !reduced, 'Movimento reduzido suprime os tremores.');
  assert.equal(f.objects.some(object => object.name === 'seguranca-x1-fragmento'), !reduced);
  f.advance(11000);
  assert.equal(f.scene.executando, false);
  assert.equal(f.scene.segurancaX1EmCurso, null);
  assert.ok(f.objects.every(object => !object.active));
  assert.ok(f.sounds.every(sound => !sound.sound.active));
  assert.equal(f.events.listenerCount('shutdown'), 0);
}
for (const leaveAt of [600, 2600, 4200]) {
  const f = fixture(); f.scene.receber([securityEvent(f)]); f.advance(leaveAt);
  f.scene.jogo.cameras = undefined;
  f.events.emit('shutdown');
  const count = [f.objects.length, f.sounds.length];
  f.advance(20000);
  assert.equal(f.scene.segurancaX1EmCurso, null);
  assert.ok(f.objects.every(object => !object.active));
  assert.ok(f.sounds.every(sound => !sound.sound.active));
  assert.deepEqual([f.objects.length, f.sounds.length], count, 'Sair cancela os efeitos ainda agendados.');
}
{
  const f = fixture({ audio: false, missing: ['segurancaX1Arte'] });
  f.scene.receber([securityEvent(f)]);
  assert.equal(f.named('seguranca-x1-dragao').value, 'despertarDragaoArte');
  f.advance(11000);
  assert.equal(f.scene.executando, false);
}
console.log('Segurança X1 cinematográfico: fases, dez alvos, ambos os lados, movimento reduzido, áudio, fallback e limpeza validados.');
