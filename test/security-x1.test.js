const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const context = vm.createContext({ console: { log() {} }, window: {}, Phaser: { Scene: class {} } });
for (const file of ['js/cartas.js', 'js/main.js', 'js/multiplayer.js', 'js/cenas/jogo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
const { Carta, Jogador, Partida, Scene, bases } = vm.runInContext(
  '({ Carta, Jogador, Partida, Scene: CenaJogo, bases: [...POOL_CARTAS_MONSTRO, ...POOL_CARTAS_TERRENO] })', context);
let nextId = 91000;
const card = name => {
  const base = bases.find(card => card.nome === name);
  return new Carta(nextId++, base.poder || 0, base.efeitoContinuo ? 'terreno' : 'monstro', JSON.parse(JSON.stringify(base)));
};
function setup(owner = 1) {
  const match = Object.assign(Object.create(Partida.prototype), { jogador: new Jogador(), inimigo: new Jogador(),
    historico: [], turno: 1, maxTurnos: 7, rodadasParaVencer: 4, rodadasJogador: 0, rodadasInimigo: 0, fase: 'colocar' });
  const dragon = card('Dragão das Comunicações Móveis');
  const player = owner === 1 ? match.jogador : match.inimigo, foe = owner === 1 ? match.inimigo : match.jogador;
  player.mao.adicionarCarta(dragon);
  ['O Porco', 'HumbaBrain', 'Saloon', 'Refrigeradores de DataCenter', 'O Tigre'].forEach((name, index) => foe.campo.adicionarCarta(card(name), index));
  foe.campo.cartas[4].protegidaPA = true;
  return { match, dragon, player, foe };
}
for (const side of [1, 2]) {
  const { match, dragon, player, foe } = setup(side);
  assert.equal(match.executarSegurancaX1(dragon, player), null, 'Carta ainda na mão não dispara.');
  player.jogarCarta(dragon, 5);
  const result = match.executarSegurancaX1(dragon, player);
  assert.equal(result.resultado, side === 1 ? 'jogador' : 'inimigo');
  assert.equal(result.cartaDestaque, dragon); assert.equal(match.partidaEncerrada, true);
  assert.ok(foe.campo.cartas.every(card => card === null)); assert.equal(foe.descarte.length, 5);
  const event = match.eventosEfeito.at(-1);
  assert.equal(event.momento, 'seguranca_x1'); assert.equal(event.alvos.filter(target => target.removida).length, 5);
  assert.equal(match.executarSegurancaX1(dragon, player), null, 'Final não repete o efeito.');
  const inverted = context.window.cyberduelMultiplayer.swapSnapshot(context.window.cyberduelMultiplayer.serializeMatch(match));
  assert.equal(inverted.eventosEfeito.at(-1).lado, side === 1 ? 'inimigo' : 'jogador');
}
for (const [isAdmin, enabled, tutorial] of [[false, true, false], [true, false, false], [true, true, true]]) {
  const { match, dragon, player } = setup(); player.jogarCarta(dragon, 5);
  context.window.cyberduelAccount = { isAdmin, segurancaX1: enabled };
  const scene = Object.assign(Object.create(Scene.prototype), { partida: match, tutorial });
  assert.equal(scene.ativarSegurancaX1(dragon), false);
  assert.equal(match.partidaEncerrada, undefined);
}
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-security-x1-'));
const [admin, user] = require('./account-fixture')(dataDir, ['DragonAdmin', 'RegularPlayer']);
const server = spawn(process.execPath, ['server/server.js'], { windowsHide: true,
  env: { ...process.env, PORT: '31975', DATA_DIR: dataDir, ADMIN_USERNAMES: admin.username }, stdio: ['ignore', 'pipe', 'inherit'] });
const sockets = [];
async function api(route, token = admin.token, body) {
  const response = await fetch(`http://127.0.0.1:31975/api/${route}`, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
const ack = (socket, event, payload) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result)));
async function connect() { const socket = io('http://127.0.0.1:31975', { transports: ['websocket'], forceNew: true }); sockets.push(socket); await once(socket, 'connect'); return socket; }
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  assert.equal((await api('auth/session')).body.segurancaX1, false);
  assert.equal((await api('admin/seguranca-x1', null, { enabled: true })).status, 401);
  assert.equal((await api('admin/seguranca-x1', user.token, { enabled: true })).status, 403);
  assert.equal((await api('admin/seguranca-x1', admin.token, { enabled: 'sim' })).status, 400);
  assert.equal((await api('admin/seguranca-x1', admin.token, { enabled: true })).body.segurancaX1, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'))).accounts[admin.accountKey].segurancaX1, true);
  for (const actor of [admin, user]) {
    const first = await connect(), second = await connect();
    const room = await ack(first, 'create-room', { accountToken: actor.token });
    await ack(second, 'join-room', { code: room.room.code, accountToken: actor === admin ? user.token : admin.token });
    const { match, dragon } = setup(1);
    const codec = context.window.cyberduelMultiplayer;
    const initialBroadcast = once(first, 'state-update');
    await ack(first, 'initial-state', { state: codec.serializeMatch(match) });
    const [initial] = await initialBroadcast;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, initial.announcementAt - Date.now()) + 30));
    assert.equal((await ack(initial.activePlayer === 1 ? first : second, 'skip-battle-announcement', { step: initial.step, round: initial.round })).ok, true);
    if (initial.activePlayer !== 1) {
      const turn = once(first, 'state-update');
      assert.equal((await ack(second, 'finish-turn', { state: codec.serializeMatch(match), step: 0, round: 1 })).ok, true);
      const [update] = await turn;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, update.announcementAt - Date.now()) + 30));
      await ack(first, 'skip-battle-announcement', { step: update.step, round: update.round });
    }
    const phase = initial.activePlayer === 1 ? 0 : 1;
    match.jogarCartaDoJogador(dragon, 5);
    const observed = once(second, 'state-update');
    assert.equal((await ack(first, 'live-state', { state: codec.serializeMatch(match), step: phase, round: 1 })).ok, true);
    const [update] = await observed;
    assert.equal(update.segurancaX1 === true, actor === admin);
    assert.equal(Boolean(update.state.partidaEncerrada), actor === admin);
    if (actor === admin) {
      assert.equal(update.result.resultadoCombate.resultado, 'jogador');
      assert.ok(update.state.inimigo.field.every(card => card === null));
      assert.equal(update.state.eventosEfeito.at(-1).momento, 'seguranca_x1');
      assert.equal((await api('auth/session')).body.gamesPlayed, 0, 'Modo admin preserva estatísticas reais.');
    }
    first.disconnect(); second.disconnect();
  }
  await api('admin/seguranca-x1', admin.token, { enabled: false });
  assert.equal((await api('auth/session')).body.segurancaX1, false);
  console.log('Segurança X1: toggle autenticado/persistente, proteções, terrenos, vitória única, modo desligado, tutorial e transmissão online aprovados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { sockets.forEach(socket => socket.disconnect()); server.kill(); });
