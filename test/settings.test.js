const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const saved = new Map();
const localStorage = {
  getItem: (key) => saved.get(key) || null,
  setItem: (key, value) => saved.set(key, value),
};
const context = vm.createContext({ console, window: {}, localStorage, setTimeout });
vm.runInContext(fs.readFileSync("js/settings.js", "utf8"), context, {
  filename: "js/settings.js",
});

const settings = context.window.cyberduelSettings;
assert.equal(settings.get("textScale"), 1.12, "O texto deve nascer maior no celular.");
assert.equal(settings.phaserTextStyle({ fontSize: "20px" }).fontSize, "22.4px");
assert.equal(settings.effects(1), 0.85 * 0.9);

settings.set("textScale", 1.25);
settings.set("masterVolume", 0.5);
assert.equal(settings.get("textScale"), 1.25);
assert.equal(settings.music(1), 0.5 * 0.75);
assert.match(saved.get("cyberduel.settings.v1"), /"textScale":1.25/);

settings.set("textScale", 9);
assert.equal(settings.get("textScale"), 1.35, "A escala deve ser limitada para não quebrar a UI.");

console.log("Volume e escala de texto persistentes validados.");

assert.equal(settings.get('animatedBackground'), 1);
settings.set('animatedBackground', false);
assert.equal(settings.get('animatedBackground'), 0);
assert.equal(new context.window.CyberduelSettings(localStorage).get('animatedBackground'), 0);
settings.set('animatedBackground', true);
assert.equal(settings.get('animatedBackground'), 1);
settings.set('animatedBackground', false);
settings.reset();
assert.equal(settings.get('animatedBackground'), 1);
console.log('Fundo animado: padrão, persistência, reativação e restauração validados.');
assert.equal(settings.get('skipBattleAnnouncements'), 0);
settings.set('skipBattleAnnouncements', true);
assert.equal(new context.window.CyberduelSettings(localStorage).get('skipBattleAnnouncements'), 1);
settings.reset();
assert.equal(settings.get('skipBattleAnnouncements'), 0);
console.log('Pular avisos: padrão desativado, persistência e restauração validados.');
vm.runInContext(fs.readFileSync('js/audio-levels.js', 'utf8'), context);
const gains = context.window.CYBERDUEL_AUDIO_GAINS;
assert.equal(settings.musicForTrack('musicaRemanescentes'), settings.music(.3 * gains.musicaRemanescentes));
assert.equal(settings.effects(.3, 'somTiro'), settings.effects(.3 * gains.somTiro));
assert.equal(settings.effects(1, 'somCobra'), settings.effects(1), 'Ganho final não excede o limite.');
assert.ok(Object.keys(gains).length >= 75);
for (const gain of Object.values(gains)) assert.ok(Number.isFinite(gain) && gain > 0 && gain <= 4);
settings.set('masterVolume', 0);
assert.equal(settings.musicForTrack('musicaMenu'), 0);
assert.equal(settings.effects(.3, 'somHumba'), 0);
settings.reset();

const limits = [];
context.window.cyberduelGame = { loop: { setFPSLimit: fps => limits.push(fps) } };
assert.equal(settings.get('lowPowerMode'), 0, 'O modo normal mantém os efeitos por padrão.');
settings.set('lowPowerMode', true);
assert.equal(limits.at(-1), 30);
assert.equal(new context.window.CyberduelSettings(localStorage).get('lowPowerMode'), 1);
assert.equal(settings.get('animatedBackground'), 1, 'Modo leve preserva a preferência de fundo normal.');
settings.reset();
assert.equal(settings.get('lowPowerMode'), 0);
assert.equal(limits.at(-1), 0, 'Restaurar libera a cadência nativa da tela.');

vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), vm.createContext({
  window: context.window, Phaser: { Scene: class {} },
}));
const effects = new context.window.CenaEfeitos();
effects.fila = [];
effects.ultimoEvento = 0;
effects.atualizarVisibilidadeInvocacoes = () => {};
effects.proximo = () => {};
settings.set('lowPowerMode', true);
effects.receber([{ id: 1 }, { id: 2 }]);
assert.equal(effects.ultimoEvento, 2, 'Modo leve avança a sequência usada na sincronização.');
assert.equal(effects.fila.length, 0, 'Modo leve não cria efeitos nem acessa fontes ocultas.');
settings.set('lowPowerMode', false);
assert.equal(limits.at(-1), 0, 'Desativar o modo leve libera a cadência nativa da tela.');
effects.receber([{ id: 2 }, { id: 3, momento: 'habilidade', fonte: {} }]);
assert.equal(effects.fila.length, 1, 'Modo normal volta a enfileirar efeitos sem repetir eventos.');
assert.equal(effects.fila[0].id, 3);
console.log('Modo leve: persistência, FPS, restauração e sequência dos efeitos validados.');

const sceneContext = vm.createContext({ window: context.window, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), sceneContext);
const Game = vm.runInContext('CenaJogo', sceneContext);
const gameScene = new Game();
settings.set('lowPowerMode', true);
assert.equal(gameScene.fundoAnimadoAtivo(), false);
assert.equal(gameScene.reproduzirEfeitoInvocacao({ nome: 'HumbaBrain' }), false);
let destroyed = 0, completed = 0;
gameScene.animarMorteCarta({ destroy() { destroyed++; } }, () => completed++);
assert.equal(destroyed, 1);
assert.equal(completed, 1, 'Pular a morte conclui a ação para não travar o combate.');
gameScene.animarEfeitoAdvogado(0, () => completed++);
assert.equal(completed, 2, 'Pular a animação do Advogado preserva sua ação.');
gameScene.animarDanoCarta({ active: true }, -1);
gameScene.animarBuffCarta({ active: true }, 1);
settings.set('lowPowerMode', false);
assert.equal(gameScene.fundoAnimadoAtivo(), true, 'O fundo normal volta sem perder a preferência.');
let marks = 0, visibility = 0;
effects.atualizarVisibilidadeInvocacoes = () => visibility++;
effects.atualizarMarcasSindicato = () => marks++;
for (const time of [0, 16, 33, 50, 66, 83, 100]) effects.update(time);
assert.equal(marks, 2, 'As marcas de estado são recalculadas a cada 100 ms.');
assert.equal(visibility, 7, 'A visibilidade de cartas continua sincronizada em cada quadro.');
console.log('Modo leve: ações, fundo, callbacks de combate e atualização das marcas validados.');
