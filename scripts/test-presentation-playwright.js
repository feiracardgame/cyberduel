const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-presentation-browser-'));
const users = require('../test/account-fixture')(dataDir, ['ArenaUm', 'ArenaDois']);
const accountsFile = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(accountsFile));
for (const user of users) Object.assign(store.accounts[user.accountKey], {
  humanGames: 3, humanWins: 3,
  tutorial: { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: [] },
});
fs.writeFileSync(accountsFile, JSON.stringify(store));
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
  await page.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /^CÓDIGO \d{6}$/.test(document.querySelector('.presentation-center .presentation-code')?.textContent));
  const code = await page.evaluate(() => window.cyberduelMultiplayer.room);
  const codeLabel = page.getByText(`CÓDIGO ${code}`, { exact: true });
  assert.equal(await codeLabel.isVisible(), true, 'Código visível sem solicitar a mesa.');
  await page.screenshot({ path: path.join(output, 'espera-desktop.png') });
  await page.setViewportSize({ width: 720, height: 1480 });
  await page.screenshot({ path: path.join(output, 'espera-retrato.png') });
  const waitingStyle = await page.locator('.presentation-seats section[data-player="1"]').evaluate(node => ({
    border: getComputedStyle(node).borderTopColor, radius: getComputedStyle(node).borderRadius,
  }));
  assert.equal(waitingStyle.border, 'rgb(84, 221, 255)');
  assert.equal(waitingStyle.radius, '0px');
  await page.setViewportSize({ width: 1366, height: 768 });
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
    assert.equal((await ack(socket, 'join-room', {
      code, table: 1, seat: index + 1, accountToken: user.token,
    })).ok, true);
    assert.equal(await codeLabel.isVisible(), true, 'Código continua visível quando um jogador entra.');
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
  assert.equal(await codeLabel.isVisible(), true);
  const badge = await codeLabel.evaluate(node => ({
    width: node.getBoundingClientRect().width, font: getComputedStyle(node).font,
    parent: node.parentElement.className, viewport: innerWidth,
  }));
  assert.ok(badge.width < 250, 'Código compacto preserva o espaço dos indicadores de PA em desktop: ' + JSON.stringify(badge));
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
  assert.equal(await codeLabel.isVisible(), true, 'Atualizar a arena preserva o código.');
  assert.deepEqual(updated.hands[active - 1], state[side].hand.map(card => card.nome));
  assert.ok(updated.labels.includes(String(played.poder)), 'PA dedicado acompanha a carta colocada.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaJogo') &&
    game.scene.getScene('CenaJogo').children.list.some(node => node.name === 'personagem-inimigo'));
  assert.deepEqual((await inspect()).hands, updated.hands);
  assert.equal(await codeLabel.isVisible(), true, 'Código restaurado ao recarregar.');
  checks.push('Atualização real da mão e PA pelo servidor; recarga restaura cartas e personagens.');
  await page.setViewportSize({ width: 720, height: 1480 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, 'arena-retrato.png') });
  checks.push('Espera com assets de NeoFloripa, molduras ciano/rosa do duelo e código no estilo do HUD.');
  assert.equal((await ack(sockets[0], 'decline-match', { room: code, accountToken: users[0].token })).ok, true);
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
  assert.equal(await codeLabel.isVisible(), true, 'Código permanece visível sobre o resultado.');
  await page.screenshot({ path: path.join(output, 'codigo-resultado.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'));
  assert.equal(await page.locator('.presentation-code--duel').count(), 0, 'Retornar à espera remove o indicador do duelo anterior.');
  checks.push('Código sempre visível: mesa vazia, entrada, duelo, atualização, recarga e resultado.');
  const normal = await browser.newPage({ viewport: { width: 720, height: 1480 } });
  await normal.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    window.CYBERDUEL_PRESENTATION = true;
  }, users[0].token);
  normal.on('pageerror', error => errors.push(error.message));
  await normal.goto(base, { waitUntil: 'domcontentloaded' });
  await normal.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'));
  await normal.evaluate(async () => {
    await window.cyberduelAccount.restore();
    const account = window.cyberduelAccount;
    window.cyberduelDeckBuilder.setAccountSession(account.user, account.deck, account.collection);
    window.CYBERDUEL_PRESENTATION = false;
    game.scene.stop('CenaTitulo');
    game.scene.start('CenaJogo', { debug: true, deckDebug: account.deck });
  });
  await normal.waitForFunction(() => game.scene.isActive('CenaJogo') &&
    game.scene.getScene('CenaJogo').children.list.some(node => node.name === 'personagem-jogador') &&
    game.scene.getScene('CenaJogo').cameras.main.alpha === 1);
  assert.equal(await normal.locator('.elenai-dialogue').count(), 0);
  assert.equal(await normal.locator('.presentation-screen').count(), 0);
  await normal.screenshot({ path: path.join(output, 'duelo-normal-referencia.png') });
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
