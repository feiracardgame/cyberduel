const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-presentation-browser-'));
const users = require('../test/account-fixture')(dataDir, ['ArenaUm', 'ArenaDois']);
const base = 'http://127.0.0.1:31982';
const output = path.resolve('output/sindicato/presentation');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '31982', DATA_DIR: dataDir, PUBLIC_URL: base },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const sockets = [], errors = [], checks = [];
let browser;
const ack = (socket, name, payload) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(name, payload, (error, response) => error ? reject(error) : resolve(response));
});
const event = (socket, name) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error(`Evento ausente: ${name}`)), 10000);
  socket.once(name, value => { clearTimeout(timer); resolve(value); });
});
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => {
      if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); }
    });
    server.once('error', reject);
  });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/apresentacao', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'ABRIR ARENA' }).click();
  await page.locator('.presentation-seats a').first().waitFor();
  const links = await page.locator('.presentation-seats a').evaluateAll(nodes => nodes.map(node => node.href));
  const avatars = ['raspclay', 'cobra'];
  const ready = [];
  for (const [index, user] of users.entries()) {
    for (const [route, method, body] of [
      ['/api/account/faction', 'POST', { faction: 'echossystem' }],
      ['/api/account/profile', 'PUT', { nickname: user.username, avatar: `assets/fotosdeperfil/${avatars[index]}_icon.png` }],
    ]) {
      const response = await page.request.fetch(base + route, {
        method, headers: { Authorization: `Bearer ${user.token}` }, data: body,
      });
      assert.equal(response.status(), 200);
    }
    const socket = io(base, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await event(socket, 'connect');
    ready.push(event(socket, 'match-ready'));
    const url = new URL(links[index]);
    assert.equal((await ack(socket, 'join-room', {
      code: url.searchParams.get('room'), seat: url.searchParams.get('seat'),
      ticket: url.searchParams.get('ticket'), accountToken: user.token,
    })).ok, true);
  }
  const matches = await Promise.all(ready);
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaJogo'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(output, 'arena-desktop.png') });
  async function inspect() {
    return page.evaluate(() => {
      const scene = game.scene.getScene('CenaJogo');
      const children = scene.children.list;
      return {
        hands: [scene.partida.jogador, scene.partida.inimigo].map(player => player.mao.cartas.map(card => card.nome)),
        faces: children.filter(node => node.dadosCarta).map(node => node.dadosCarta.nome),
        characters: ['jogador', 'inimigo'].map(side => children.find(node => node.name === `personagem-${side}`)?.texture.key),
        labels: children.flatMap(node => node.list || []).filter(node => node.text).map(node => node.text),
        controls: children.filter(node => node.dadosCarta && node.input?.enabled).length,
        canPlay: scene.podeJogarCartasAgora(), canUseAbility: scene.podeUsarHabilidadesAgora(),
        passButton: children.some(node => node.name === 'passar-turno'),
        activePlayer: scene.multiplayer.activePlayer,
      };
    });
  }
  await page.waitForFunction(() => {
    const scene = game.scene.getScene('CenaJogo');
    return scene.children.list.some(node => node.name === 'personagem-jogador');
  });
  const initial = await inspect();
  for (const [index, side] of ['jogador', 'inimigo'].entries()) {
    assert.deepEqual(initial.hands[index], matches[0].update.state[side].hand.map(card => card.nome));
    assert.ok(initial.characters[index]?.includes(index === 0 ? 'raspclay' : 'cobra'));
  }
  assert.deepEqual(initial.faces, initial.hands[0]);
  assert.equal(initial.labels.filter(text => text === 'PA:').length, 2);
  assert.equal(initial.controls, 0);
  assert.equal(initial.canPlay, false); assert.equal(initial.canUseAbility, false);
  assert.equal(initial.passButton, false);
  checks.push('Mãos reais, PA dedicado, personagens corretos e apresentação sem comandos de jogada.');

  const active = matches[0].activePlayer;
  await page.waitForTimeout(Math.max(0, matches[0].phaseStartsAt - Date.now()) + 50);
  const state = matches[0].update.state;
  const side = active === 1 ? 'jogador' : 'inimigo';
  const cardIndex = state[side].hand.findIndex(card => card.tipo === 'monstro');
  const [played] = state[side].hand.splice(cardIndex, 1);
  state[side].field[0] = played;
  assert.equal((await ack(sockets[active - 1], 'finish-turn', {
    state, step: matches[0].step, round: matches[0].round,
  })).ok, true);
  await page.waitForFunction(({ side, count }) => game.scene.getScene('CenaJogo').partida[side].mao.cartas.length === count,
    { side, count: state[side].hand.length });
  const updated = await inspect();
  assert.deepEqual(updated.hands[active - 1], state[side].hand.map(card => card.nome));
  assert.ok(updated.labels.includes(String(played.poder)), 'PA dedicado acompanha a carta colocada.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaJogo') &&
    game.scene.getScene('CenaJogo').children.list.some(node => node.name === 'personagem-inimigo'));
  assert.deepEqual((await inspect()).hands, updated.hands);
  checks.push('Atualização real da mão e PA pelo servidor; recarga restaura cartas e personagens.');
  await page.setViewportSize({ width: 720, height: 1480 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, 'arena-retrato.png') });
  assert.deepEqual(errors, []);
  console.log('Apresentação no Playwright aprovada. Evidências: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  sockets.forEach(socket => socket.disconnect());
  const stopped = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await stopped;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
