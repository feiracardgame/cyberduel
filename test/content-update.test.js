const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ console: { log() {} }, window: {}, setTimeout,
  Phaser: { Scene: class {}, Utils: { Array: { Shuffle: cards => cards } } } });
for (const file of ['js/cartas.js', 'js/main.js', 'js/cenas/jogo.js', 'js/settings.js', 'js/factions.js', 'js/multiplayer.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
const { Carta, Jogador, Partida, Scene, alvosEmRange, pools } = vm.runInContext(
  '({ Carta, Jogador, Partida, Scene: CenaJogo, alvosEmRange, pools: [POOL_CARTAS_MONSTRO, POOL_CARTAS_TERRENO, POOL_CARTAS_EFEITO] })', context);
const normalize = text => text.toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]/gu, '');
const markdown = fs.readFileSync('markdown/Cartas e boosters.md', 'utf8');
const official = new Map();
for (const section of markdown.split(/^#{3,4} /m).slice(1)) {
  const title = section.split('\n')[0];
  if (title.includes('Assets')) continue;
  const name = title.split(/ -> | - |  - /).at(-1).trim();
  const description = section.match(/(?:\*\s*)?Descrição:\s*(.*)/)?.[1] || section.match(/^\* (?!PA:|Efeito:)(.+)/m)?.[1];
  const effect = section.match(/\*\s*Efeito:\s*([\s\S]*?)(?=\n\s*\*\s*(?:Arte|Visual)|\n\s*#{3,4}|$)/)?.[1];
  if (!description || !effect) continue;
  official.set(normalize(name), {
    description: description.trim().replace(/^(?:Descrição:|:)\s*/, ''),
    effect: effect.trim().replace(/^\*\s*/, '').split(/\*\s*(?:<img|EFeito Secreto)/)[0].replace(/\s+PA:\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim(),
    pa: section.match(/(?:\*\s*)?PA:\s*(\d+)/)?.[1],
  });
}
for (const base of pools.flat()) {
  const expected = official.get(normalize(base.nome));
  assert.ok(expected, `Markdown encontrado: ${base.nome}`);
  assert.equal(base.descricao, expected.description, `Ambientação: ${base.nome}`);
  const effect = base.efeito || base.efeitoTurno || base.efeitoContinuo;
  assert.equal(effect.texto, expected.effect, `Regra exibida: ${base.nome}`);
  if (expected.pa) assert.equal(base.poder, Number(expected.pa), `PA: ${base.nome}`);
  const range = expected.effect.match(/H(\d+)\/?V(\d+)/);
  if (range) {
    assert.equal(effect.rangeH, Number(range[1]), `Alcance H: ${base.nome}`);
    assert.equal(effect.rangeV, Number(range[2]), `Alcance V: ${base.nome}`);
  }
}
const secretText = markdown.match(/\* EFeito Secreto \(aparece na carta apenas quando ativado\): ([^\r\n]+)/)[1];
assert.equal(pools[0].find(base => base.nome === 'Dragão das Comunicações Móveis').efeitoSecreto.texto, secretText);
let id = 95000;
function card(name) {
  const pool = pools.find(pool => pool.some(base => base.nome === name));
  const base = pool.find(base => base.nome === name);
  return new Carta(++id, base.poder || 0, pool === pools[0] ? 'monstro' : pool === pools[1] ? 'terreno' : 'efeito', JSON.parse(JSON.stringify(base)));
}
function match() { return Object.assign(Object.create(Partida.prototype), { jogador: new Jogador(), inimigo: new Jogador(), turno: 1, historico: [] }); }
function put(p, name, index, enemy = false) { const c = card(name); p[enemy ? 'inimigo' : 'jogador'].campo.adicionarCarta(c, index); return c; }
function use(p, c, a, b) { return p.ativarHabilidade(c, p.jogador, p.inimigo, a, b); }
{
  const p = match();
  for (let i = 0; i < 10; i++) put(p, 'O Tigre', i, true);
  for (const [position, h, v, expected] of [
    [7, 1, 1, [7]], [7, 1, 2, [2, 7]],
    [7, 3, 1, [6, 7, 8]], [7, 3, 2, [1, 2, 3, 6, 7, 8]],
    [7, 5, 1, [5, 6, 7, 8, 9]], [7, 5, 2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    [5, 3, 1, [5, 6]], [9, 3, 1, [8, 9]], [5, 5, 1, [5, 6, 7]],
    [2, 1, 1, []], [2, 1, 2, [7]], [2, 1, 3, [2, 7]],
    [2, 3, 2, [6, 7, 8]], [2, 3, 3, [1, 2, 3, 6, 7, 8]],
  ]) assert.deepEqual(Array.from(alvosEmRange(position, h, v, p.inimigo.campo)), expected,
    `Largura H${h}/V${v} centrada na posição ${position}.`);
}
{
  const p = match(), rat = put(p, 'O Rato', 5);
  const near = put(p, 'O Tigre', 6, true); put(p, 'O Tigre', 7, true); put(p, 'O Tigre', 0, true);
  assert.deepEqual(Array.from(p.alvosParaHabilidadeEmCampo(rat, p.jogador, p.inimigo)), [6]);
  assert.equal(use(p, rat, 7).sucesso, false); assert.equal(rat.usadaEsteTurno, false);
  assert.equal(use(p, rat, 6).sucesso, true); assert.equal(near.poder, 7); assert.equal(rat.poder, 4);
}
{
  const p = match(), goat = put(p, 'A Cabra', 0), ally = put(p, 'O Tigre', 7);
  assert.equal(use(p, goat, 7).sucesso, true); assert.equal(goat.poder, 4);
  assert.equal(p.jogador.campo.cartas[0], ally); assert.equal(p.jogador.campo.cartas[7], goat);
  goat.usadaEsteTurno = false; assert.equal(use(p, goat, 10).sucesso, false);
}
{
  const p = match(), spider = put(p, 'A Aranha', 0), equal = put(p, 'HAL 9001', 0, true);
  assert.equal(use(p, spider, 0).sucesso, true); p.atualizarOverrides();
  assert.equal(equal.capturadaPor, p.jogador);
  assert.equal(p.ativarHabilidade(equal, p.inimigo, p.jogador, 0).sucesso, false);
  assert.match(equal.descricaoCompleta(), /HABILIDADE BLOQUEADA/);
  const codec = context.window.cyberduelMultiplayer;
  const restored = codec.hydrateMatch(codec.swapSnapshot(codec.serializeMatch(p)));
  restored.atualizarOverrides(); assert.equal(restored.jogador.campo.cartas[0].capturadaPor, restored.inimigo);
}
{
  const p = match(), dragon = put(p, 'Dragão das Comunicações Móveis', 0);
  put(p, 'O Rato', 1); put(p, 'A Ferreira', 2); put(p, 'HAL 9001', 3);
  const clay = put(p, 'RaspClay MonteCorp', 4);
  assert.doesNotMatch(dragon.descricaoCompleta(), /Memórias/);
  p.aplicarEfeitoInvocacao(clay, p.jogador, p.inimigo, 4, [1, 2, 3]);
  assert.equal(clay.poder, 29, '10 + 2 + 5 + 5 PA absorvidos + 1 + 3 + 3 por nível.');
  assert.equal(dragon.dragaoDesperto, true); assert.match(dragon.descricaoCompleta(), /Memórias/);
  assert.equal(dragon.efeitoTurno.texto, secretText);
  assert.equal(p.eventosEfeito.filter(event => event.momento === 'despertar').length, 1);
  p.resolverEfeitosInicioRodada(); assert.equal(dragon.poder, 17);
}
for (const targets of [[1, 2], [1, 2, 2]]) {
  const p = match(), dragon = put(p, 'Dragão das Comunicações Móveis', 0);
  put(p, 'O Rato', 1); put(p, 'HAL 9001', 2);
  const clay = put(p, 'RaspClay MonteCorp', 4);
  p.aplicarEfeitoInvocacao(clay, p.jogador, p.inimigo, 4, targets);
  assert.equal(dragon.dragaoDesperto, undefined, 'Dois sacrifícios ou índices repetidos não despertam o Dragão.');
  assert.doesNotMatch(dragon.descricaoCompleta(), /Memórias/);
}
{
  const p = match(), bomber = put(p, 'O Bom', 0);
  put(p, 'O Tigre', 1, true); put(p, 'O Tigre', 2, true);
  assert.deepEqual(Array.from(p.alvosParaHabilidadeEmCampo(bomber, p.jogador, p.inimigo)), [1]);
  assert.equal(use(p, bomber, [2]).sucesso, false);
  assert.deepEqual(Array.from(p.montarDistribuicaoDanoIA(bomber, p.inimigo)), [1]);
  assert.equal(use(p, bomber, [1]).sucesso, true);
}
{
  const p = match(), bad = put(p, "Sen'Tenzhah, O Mau", 7);
  const target = put(p, 'O Rato', 9, true);
  assert.equal(use(p, bad, 9).sucesso, true); assert.equal(bad.poder, 8);
  assert.equal(p.inimigo.campo.cartas[9], null); assert.equal(target.poder, 0);
}
const serverCode = fs.readFileSync('server/server.js', 'utf8');
vm.runInContext(serverCode.slice(serverCode.indexOf('function phaseDuration('), serverCode.indexOf('function armPhaseClock(')), context);
const phaseDuration = vm.runInContext('phaseDuration', context);
{
  const p = match(), scene = Object.assign(Object.create(Scene.prototype), { partida: p });
  const duration = expected => {
    assert.equal(scene.duracaoPermitidaPara(p.jogador), expected);
    assert.equal(phaseDuration({ turn: 1, state: { jogador: { field: p.jogador.campo.cartas }, inimigo: { field: p.inimigo.campo.cartas } } }), expected);
  };
  duration(40000); put(p, 'H.A.R.V.I.S', 0); duration(50000);
  put(p, 'H.A.R.V.I.S', 1); put(p, 'H.A.R.V.I.S', 2); duration(60000);
  put(p, 'NeoAnalista de Suporte Nível Alpha', 0, true); duration(45000);
  put(p, 'NeoAnalista de Suporte Nível Alpha', 1, true); duration(30000);
  put(p, 'NeoAnalista de Suporte Nível Alpha', 2, true); duration(15000);
}
{
  const settings = context.window.cyberduelSettings, events = new EventEmitter(), sounds = [];
  const scene = { events, sound: { add(key, options) {
    const sound = { key, ...options, destroyed: 0, play() { this.playing = true; },
      setVolume(value) { this.volume = value; }, destroy() { this.destroyed++; } };
    sounds.push(sound); return sound;
  } } };
  settings.playMusic(scene, 'musicaMenu'); settings.playMusic(scene, 'musicaMenu'); assert.equal(sounds.length, 1);
  settings.playMusic(scene, 'musicaIA'); assert.equal(sounds[0].destroyed, 1);
  settings.set('musicVolume', 0); assert.equal(sounds[1].volume, 0);
  settings.playMusic(scene, 'musicaMenu'); events.emit('shutdown');
  assert.equal(sounds[2].destroyed, 1); assert.equal(scene.cyberMusic, null);
  for (const [field, expected] of [[1, 'musicaPadrao'], [2, 'musicaFundo'], [4, 'musicaRemanescentes']]) {
    settings.set('battlefield', field);
    const game = Object.create(Scene.prototype); game.escolherFundoBatalha();
    assert.equal(game.chaveMusicaBatalha(), expected);
    game.tutorial = true; assert.equal(game.chaveMusicaBatalha(), 'musicaIA');
  }
  settings.set('battlefield', 3);
  assert.equal(settings.get('battlefield'), 0, 'A antiga preferência HumbaNet passa a alternar cenários comuns.');
  for (const field of [0, 1, 2, 4]) {
    settings.set('battlefield', field);
    const game = Object.assign(Object.create(Scene.prototype), { conselho: true, fundoBatalha: 'videoDeserto' });
    game.escolherFundoBatalha();
    assert.equal(game.fundoBatalha, 'videoHumbaNet', 'O Conselho prevalece sobre preferências e dados de cenas anteriores.');
    assert.equal(game.chaveMusicaBatalha(), 'musicaHumbaNet');
    const normal = Object.create(Scene.prototype); normal.escolherFundoBatalha();
    assert.notEqual(normal.fundoBatalha, 'videoHumbaNet');
    assert.notEqual(normal.chaveMusicaBatalha(), 'musicaHumbaNet');
  }
}
assert.equal(Object.keys(context.window.CYBERDUEL_FACTIONS).length, 5);
for (const faction of Object.values(context.window.CYBERDUEL_FACTIONS)) assert.ok(faction.text.length > 1500);
for (const file of ['jogo-musica', 'jogo-padrao', 'jogo-humbanet', 'jogo-remanescentes', 'jogo-deck', 'jogo-menu', 'jogo-IA', 'abrir_booster'])
  assert.ok(fs.statSync(`assets/sons/${file}.mp3`).size > 1000);
console.log('54 cartas conferidas com o markdown; alcance, bônus, Override, despertar, tempos online/solo, músicas e cinco análises aprovados.');
