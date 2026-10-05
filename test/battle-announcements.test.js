const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let now = 100000;
const context = vm.createContext({ window: {}, Date: { now: () => now }, Phaser: { Scene: class {} } });
for (const file of ['js/battle-announcements.js', 'js/multiplayer.js', 'js/cenas/jogo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const Game = vm.runInContext('CenaJogo', context);
const client = context.window.cyberduelMultiplayer;
for (const aviso of Object.values(context.window.cyberduelBattleAnnouncements))
  assert.ok(fs.statSync(`assets/sons/${aviso.arquivo}`).size > 0);
assert.match(fs.readFileSync('docker/Dockerfile.server', 'utf8'), /COPY .*js\/battle-announcements.js/);

const texts = [], sounds = [];
const object = () => ({ active: true, setOrigin() { return this; }, setDepth() { return this; }, destroy() { this.active = false; } });
const game = Object.assign(Object.create(Game.prototype), {
  multiplayer: client, partida: {}, faseAtual: 'colocar', ehMeuTurno: true,
  avisoInicialPendente: true, avisoSequencia: 0, avisosBatalhaTocados: new Set(),
  add: { text(x, y, text, style) { texts.push({ text, style }); return object(); } },
  sound: { add(key) { return { play() { sounds.push(key); }, destroy() {} }; } },
});
game.configurarAvisoLocal(40000);
assert.equal(game.prazoFaseLocal, now + 6200 + 40000);
game.atualizarAvisoBatalha();
assert.equal(texts.at(-1).text, 'Hora do Cyberduelo');
assert.match(texts.at(-1).style.fontFamily, /Rushblade/);
assert.equal(game.podeJogarCartasAgora(), false);
now += 2900;
game.atualizarAvisoBatalha();
assert.equal(texts.at(-1).text, 'Turno de posicionamento');
game.atualizarAvisoBatalha();
assert.equal(sounds.length, 2, 'Não repetir áudio a cada frame.');
now += 3300;
game.atualizarAvisoBatalha();
assert.equal(game.avisoBatalhaTexto, null);
assert.equal(game.podeJogarCartasAgora(), true);
assert.equal(game.prazoFaseLocal - now, 40000);
game.faseAtual = 'habilidades';
game.configurarAvisoLocal(20000);
game.atualizarAvisoBatalha();
assert.equal(sounds.at(-1), 'somTurnoHabilidade');
assert.equal(game.podeUsarHabilidadesAgora(), false);
now += 2400;
assert.equal(game.podeUsarHabilidadesAgora(), true);
// Relógio online fica cheio durante a voz, inclusive com redução de tempo.
game.multiplayerAtivo = true;
client.applyPhase({ announcementAt: now, introUntil: now + 2900, phaseStartsAt: now + 6200,
  deadline: now + 26200, serverNow: now, round: 1, step: 0 });
assert.equal(client.remainingMs(), 20000);
client.spectator = true;
game.atualizarAvisoBatalha();
assert.equal(texts.at(-1).text, 'Hora do Cyberduelo');
now += 2900;
const count = sounds.length;
game.atualizarAvisoBatalha();
assert.equal(game.avisoBatalhaTexto, null, 'Espectador não vê anúncio de turno.');
assert.equal(sounds.length, count, 'Espectador não ouve anúncio de turno.');
assert.equal(client.remainingMs(), 20000);
client.spectator = false; game.ehMeuTurno = false;
game.atualizarAvisoBatalha();
assert.equal(sounds.length, count, 'Oponente não ouve anúncio do jogador ativo.');
now += 3301;
assert.equal(client.remainingMs(), 19999);
// O servidor reserva a mesma janela e mantém o prazo em atualizações de cartas.
const server = fs.readFileSync('server/server.js', 'utf8');
const clockContext = vm.createContext({ Date: { now: () => now }, battleAnnouncements: context.window.cyberduelBattleAnnouncements,
  clearTimeout() {}, setTimeout() { return { unref() {} }; }, advancePhase() {} });
vm.runInContext(server.slice(server.indexOf('function phaseDuration('), server.indexOf('// A pausa pertence')), clockContext);
clockContext.room = { step: 0, turn: 1, state: { jogador: { field: [] }, inimigo: { field: [] } } };
vm.runInContext('armPhaseClock(room, true, true)', clockContext);
assert.equal(clockContext.room.phaseStartedAt, now + 6200);
assert.equal(clockContext.room.deadline, now + 46200);
now += 1000;
vm.runInContext('armPhaseClock(room, false)', clockContext);
assert.equal(clockContext.room.deadline, now - 1000 + 46200);
clockContext.room.step = 2;
vm.runInContext('armPhaseClock(room)', clockContext);
assert.equal(clockContext.room.phaseStartedAt, now + 2400);
console.log('Avisos: abertura, fases, fonte, áudio único, privacidade e relógios solo/online aprovados.');

context.window.cyberduelSettings = { get: () => 1 };
game.multiplayerAtivo = false;
game.ehMeuTurno = true;
game.avisoInicialPendente = true;
game.configurarAvisoLocal(40000);
assert.equal(game.avisoLocal.phaseStartsAt, now);
assert.equal(game.prazoFaseLocal, now + 40000);
const beforeSkip = sounds.length;
game.atualizarAvisoBatalha();
assert.equal(game.avisoBatalhaTexto, null);
assert.equal(sounds.length, beforeSkip);
assert.equal(game.podeUsarHabilidadesAgora(), true);

// Mão continua visível tanto no aviso como nos efeitos; comandos continuam bloqueados.
for (const effects of [false, true]) {
  const hand = { dadosCarta: {}, posOriginal: {}, y: 10, alpha: 1, visible: true };
  const scene = Object.assign(Object.create(Game.prototype), {
    children: { list: [hand] }, input: { enabled: true },
    efeitosBloqueiamInteracao: () => effects, avisoBatalhaPendente: () => !effects,
  });
  scene.atualizarInteracaoDuranteEfeitos();
  assert.equal(hand.visible, true);
  assert.equal(hand.alpha, 1);
  assert.equal(hand.estadoAntesDosEfeitos, undefined);
  assert.equal(scene.input.enabled, false);
}
// Nova carta remove o título antes de iniciar a animação.
game.scene = { manager: { keys: { CenaEfeitos: { ultimoEvento: 0, receber() {
  assert.equal(game.avisoBatalhaTexto, null);
} } } } };
const title = object(); game.avisoBatalhaTexto = title;
game.apresentarEventosEfeito([{ id: 1, momento: 'invocacao' }]);
assert.equal(title.active, false);
context.window.cyberduelSettings.get = () => 0;
game.avisoLocal.phaseStartsAt = now + 3300;
game.avisoLocal.introUntil = now;
game.atualizarAvisoBatalha();
assert.equal(game.avisoBatalhaTexto, null, 'Redesenhar não faz o título voltar depois da jogada.');

client.socket = { emit(event, payload, callback) {
  assert.equal(event, 'skip-battle-announcement');
  assert.equal(payload.step, client.step);
  callback({ ok: true, phaseStartsAt: now, deadline: now + 40000 });
} };
client.activePlayer = client.player = 1; client.spectator = false;
client.announcementAt = now; client.phaseStartsAt = now + 3300;
client.skipAnnouncement();
assert.equal(client.announcementPending(), false);
assert.equal(client.remainingMs(), 40000);
console.log('Skip solo/online, mão visível com interação bloqueada e remoção do título ao jogar validados.');
