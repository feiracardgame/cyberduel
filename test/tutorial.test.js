const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const ranking = require('../server/ranking');

const context = vm.createContext({ console: { log() {} }, window: {}, URLSearchParams, location: { search: '' },
  Phaser: { Utils: { Array: { Shuffle: x => x } } } });
for (const file of ['js/cartas.js', 'js/main.js', 'js/tutorial.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
vm.runInContext('globalThis.exportsTutorial = { ELENAI_DIALOGUES, pendingElenAI, CyberduelTraining, CyberduelStory, Partida }', context);
const { ELENAI_DIALOGUES: lines, pendingElenAI, CyberduelTraining, CyberduelStory, Partida } = context.exportsTutorial;
assert.equal(lines.intro[0].sprite, 0); assert.equal(lines.declined[0].sprite, 17);
assert.equal(lines.training.length, 14); assert.equal(lines.council.length, 13);
assert.equal(lines.ten.no[5].text, 'sozinha'); assert.equal(lines.ten.yes[7].text, 'Eu te considero meu amigo!');
for (let n = 1; n <= 17; n++) assert.ok(fs.existsSync(`assets/sprites/elenai-${String(n).padStart(2, '0')}.webp`));
const profile = { gamesPlayed: 10, humanGames: 5, humanWins: 3, councilReached: true, tutorial: { seen: [] } };
assert.deepEqual(Array.from(pendingElenAI(profile)), ['three', 'club', 'council', 'ten']);
assert.deepEqual(Array.from(pendingElenAI({ ...profile, tutorial: { seen: ['three', 'club', 'council', 'ten'] } })), []);
assert.deepEqual(Array.from(pendingElenAI({ ...profile, humanGames: 0, humanWins: 0 })), ['three', 'ten']);
assert.equal(ranking.eligible({ humanGames: 4, humanWins: 3 }), false);
assert.equal(ranking.eligible({ humanGames: 5, humanWins: 2 }), false);
assert.equal(ranking.eligible({ humanGames: 5, humanWins: 3 }), true);

const scene = { partida: new Partida(null, true), events: { once() {} } };
const training = new CyberduelTraining(scene);
assert.equal(scene.partida.jogador.mao.cartas.length, 1);
assert.equal(scene.partida.jogador.mao.cartas[0].nome, 'Estagiário de Machine Learning');
assert.equal(scene.partida.jogador.deck.cartas.length, 0);
training.step = 'tiger';
assert.equal(training.canPlace(training.card('O Tigre'), 7), true);
assert.equal(training.canPlace(training.card('O Tigre'), 2), false);
const tiger = training.card('O Tigre'), dipsp = training.card('Agente da DIPSP');
scene.partida.jogador.campo.adicionarCarta(tiger, 7);
scene.partida.jogador.campo.adicionarCarta(dipsp, 8);
scene.partida.inimigo.campo.adicionarCarta(training.card('CyberVendedor da RaspCorp'), 7);
scene.partida.inimigo.campo.adicionarCarta(training.card('O Rato'), 2);
assert.deepEqual(Array.from(scene.partida.alvosParaHabilidadeEmCampo(tiger, scene.partida.jogador, scene.partida.inimigo)), [7]);
scene.partida.fase = 'habilidades'; training.step = 'tiger-ability';
assert.equal(training.canUse(tiger, 2), false); assert.equal(training.canUse(tiger, 7), true);
assert.equal(scene.partida.ativarHabilidade(tiger, scene.partida.jogador, scene.partida.inimigo, 7).sucesso, true);
assert.equal(scene.partida.inimigo.campo.cartas[7], null);
assert.equal(scene.partida.inimigo.campo.cartas[2].nome, 'O Rato');
assert.ok(scene.partida.alvosParaHabilidadeEmCampo(dipsp, scene.partida.jogador, scene.partida.inimigo).includes(2));
assert.equal(scene.partida.ativarHabilidade(dipsp, scene.partida.jogador, scene.partida.inimigo, 2).sucesso, true);
assert.equal(scene.partida.inimigo.campo.cartas[2], null);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-tutorial-'));
const fixtures = require('./account-fixture')(dir, ['NewPlayer', 'BotPlayer', ...Array.from({ length: 11 }, (_, i) => `Member${i}`)]);
const saved = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json')));
for (const [i, fixture] of fixtures.entries()) {
  const account = saved.accounts[fixture.accountKey];
  if (i === 1) { account.gamesPlayed = 20; account.rating = 3000; }
  if (i >= 2) Object.assign(account, { faction: 'raspcorp', rankedGames: 5, rankedWins: 3, gamesPlayed: 10, rating: 2000 - i });
}
fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify(saved));
const url = 'http://127.0.0.1:32008';
let server; const sockets = [];
async function start() {
  server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: '32008', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timeout); resolve(); } });
  });
}
async function stop() { if (!server) return; const exited = once(server, 'exit'); server.kill(); await exited; server = null; }
async function api(route, body, fixture = fixtures[0], method = body ? 'PUT' : 'GET') {
  const response = await fetch(url + '/api/' + route, { method,
    headers: { 'Content-Type': 'application/json', ...(fixture ? { Authorization: `Bearer ${fixture.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const ack = (socket, event, payload) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, payload, (error, value) => error ? reject(error) : resolve(value)));
async function connect() { const s = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(s); await once(s, 'connect'); return s; }
(async () => {
  // O login vem antes da história, cujo progresso pertence à conta, não ao navegador.
  let logins = 0, introductions = 0;
  const storyScene = { scene: { isActive: () => true }, multiplayer: {}, account: { user: null },
    titleUI: { openAuthDialog() { logins++; }, openFactionDialog() {}, destroy() {} },
    montarInterfaceTitulo() {}, atualizarStatus(message) { throw Error(message); } };
  const story = new CyberduelStory(storyScene);
  story.say = async dialogue => { if (dialogue[0].text === lines.intro[0].text) introductions++; };
  await story.menu();
  assert.equal(logins, 1); assert.equal(introductions, 0);
  const newAccount = () => ({ user: 'new', faction: null, tutorial: { introSeen: false, named: true, wantsTutorial: false },
    async saveTutorial(progress) { Object.assign(this.tutorial, progress); } });
  storyScene.account = newAccount(); await story.menu();
  assert.equal(introductions, 1); assert.equal(storyScene.account.tutorial.introSeen, true);
  await story.menu(); assert.equal(introductions, 1, 'A mesma conta não repete a introdução.');
  storyScene.account = newAccount(); await story.menu();
  assert.equal(introductions, 2, 'Outra conta nova no mesmo navegador recebe sua introdução.');
  storyScene.account = { user: 'old', faction: 'raspcorp', tutorial: { introSeen: true, named: true,
    wantsTutorial: false, completed: true, farewellSeen: true, seen: [] }, gamesPlayed: 0, humanWins: 0 };
  await story.menu(); assert.equal(introductions, 2, 'Contas antigas entram no menu.');

  await start();
  assert.equal((await api('account/tutorial', { wantsTutorial: true }, null)).status, 401);
  const fresh = (await api('auth/session')).body;
  assert.equal(fresh.tutorial.wantsTutorial, null); assert.equal(fresh.tutorial.introSeen, false);
  assert.equal(fresh.clubUnlocked, false);
  for (const body of [{ wantsTutorial: 'sim' }, { seen: 'club' }, { seen: 'council' }, { seen: ['ten'] }, { seen: '__proto__' }, { seen: 'constructor' }, { humanWins: 99 }, {}, []])
    assert.equal((await api('account/tutorial', body)).status, 400);
  assert.equal((await api('account/tutorial', { introSeen: true, named: true, wantsTutorial: false })).status, 200);
  assert.equal((await api('account/tutorial', { wantsTutorial: true })).status, 409);
  assert.equal((await api('account/tutorial', { introSeen: false })).body.tutorial.introSeen, true);
  const bot = (await api('auth/session', undefined, fixtures[1])).body;
  assert.equal(bot.humanGames, 0); assert.equal(bot.clubUnlocked, false); assert.equal(bot.councilReached, false);
  const board = (await api('leaderboard')).body.entries;
  assert.equal(board.length, 11); assert.equal(board[0].nickname, 'Member0');
  assert.equal(board[0].username, undefined); assert.equal(board[0].passwordHash, undefined);
  const member = (await api('auth/session', undefined, fixtures[2])).body;
  assert.equal(member.councilReached, true); assert.equal(member.clubUnlocked, true);
  assert.equal((await api('auth/session', undefined, fixtures[12])).body.councilReached, false);
  for (const event of ['three', 'club', 'council', 'ten']) {
    assert.equal((await api('account/tutorial', { seen: event }, fixtures[2])).status, 200);
    assert.equal((await api('account/tutorial', { seen: event }, fixtures[2])).status, 200);
  }
  assert.equal((await api('auth/session', undefined, fixtures[2])).body.tutorial.seen.length, 4);
  const host = await connect(), guest = await connect();
  const forgedClub = await ack(host, 'create-room', { club: true, accountToken: fixtures[1].token });
  assert.equal(forgedClub.ok, true);
  assert.equal(forgedClub.room.club, false, 'O cliente não pode marcar uma sala comum como Clube.');
  const room = await ack(host, 'create-room', { club: true, accountToken: fixtures[2].token, deck: member.deck });
  assert.equal(room.ok, true);
  assert.equal(room.room.club, false);
  assert.equal((await ack(guest, 'join-room', { code: room.room.code, accountToken: fixtures[3].token, deck: member.deck })).ok, true);
  vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8'), context);
  assert.equal((await ack(host, 'initial-state', { state: context.window.cyberduelMultiplayer.serializeMatch(scene.partida) })).ok, true);
  assert.equal((await ack(host, 'decline-match', { room: room.room.code, accountToken: fixtures[2].token })).ok, true);
  const friendly = (await api('auth/session', undefined, fixtures[2])).body;
  assert.equal(friendly.humanGames, member.humanGames + 1);
  assert.equal(friendly.clubGames, 0); assert.equal(friendly.clubWins, 0);
  sockets.forEach(s => s.disconnect()); await stop(); await start();
  const restored = (await api('auth/session')).body;
  assert.equal(restored.tutorial.wantsTutorial, false); assert.equal(restored.tutorial.introSeen, true);
  assert.deepEqual((await api('auth/session', undefined, fixtures[2])).body.tutorial.seen, ['three', 'club', 'council', 'ten']);
  console.log('Tutorial: falas, poses, alcance real, filas, escolha persistente, ranking, Conselho e Clube validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { sockets.forEach(s => s.disconnect()); await stop(); });
