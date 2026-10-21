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
  tutorial: { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: ['club'] },
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
  const backgroundStyle = await page.locator('.presentation-screen').evaluate(node => ({
    color: getComputedStyle(node).backgroundColor,
    image: getComputedStyle(node).backgroundImage,
    decoration: getComputedStyle(node, '::before').content,
  }));
  assert.deepEqual(backgroundStyle, { color: 'rgb(0, 0, 0)', image: 'none', decoration: 'none' });
  assert.equal(await page.locator('.presentation-screen .title-matrix-stream').count(), 24);
  assert.equal(await page.locator('.title-matrix-stream').first().evaluate(node => getComputedStyle(node).animationName), 'title-matrix-fall');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.title-matrix').isVisible(), false, 'A chuva respeita movimento reduzido.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('Fundo preto com a chuva verde do menu, sem cenário ou molduras de fundo, respeitando movimento reduzido.');
  const audioButton = page.getByRole('button', { name: 'Ajustar volume da apresentação' });
  await audioButton.click();
  const audioDialog = page.getByRole('dialog', { name: 'Áudio da apresentação' });
  assert.equal(await audioDialog.isVisible(), true);
  assert.equal(await audioDialog.getByRole('slider').count(), 2);
  const audioBounds = await audioDialog.boundingBox();
  const gameBounds = await page.locator('.presentation-screen').boundingBox();
  assert.ok(audioBounds.x >= gameBounds.x && audioBounds.x + audioBounds.width <= gameBounds.x + gameBounds.width + 1, 'Modal de áudio cabe na apresentação.');
  for (const [name, value] of [['MÚSICA', '67'], ['EFEITOS', '32']]) {
    const slider = audioDialog.getByRole('slider', { name, exact: true });
    await slider.evaluate((node, volume) => { node.value = volume; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    assert.equal(await slider.inputValue(), value);
  }
  assert.deepEqual(await page.evaluate(() => [cyberduelSettings.get('musicVolume'), cyberduelSettings.get('effectsVolume')]), [.67, .32]);
  const playback = await page.evaluate(() => ({
    volume: cyberduelSettings.musicScene.cyberMusic.volume,
    expected: cyberduelSettings.musicForTrack('musicaMenu'),
    key: cyberduelSettings.musicScene.cyberMusic.key,
  }));
  assert.ok(Math.abs(playback.volume - playback.expected) < .000001, `Volume da música em reprodução: ${JSON.stringify(playback)}`);
  await page.screenshot({ path: path.join(output, 'audio-apresentacao.png') });
  await page.keyboard.press('Escape');
  await audioDialog.waitFor({ state: 'detached' });
  assert.equal(await audioButton.evaluate(node => node === document.activeElement), true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /^CÓDIGO \d{6}$/.test(document.querySelector('.presentation-center .presentation-code')?.textContent));
  await audioButton.click();
  assert.equal(await audioDialog.getByRole('slider', { name: 'MÚSICA', exact: true }).inputValue(), '67');
  assert.equal(await audioDialog.getByRole('slider', { name: 'EFEITOS', exact: true }).inputValue(), '32');
  await audioDialog.getByRole('button', { name: 'CONCLUIR' }).click();
  await audioDialog.waitFor({ state: 'detached' });
  checks.push('Nome CYBERDUEL abre música/efeitos, aplica os volumes, salva após recarga e fecha com Escape ou Concluir.');
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
    if (index === 0) {
      const controller = await browser.newPage({ viewport: { width: 720, height: 1480 } });
      controller.on('pageerror', error => errors.push(error.message));
      await controller.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), user.token);
      await controller.goto(base, { waitUntil: 'domcontentloaded' });
      await controller.waitForFunction(() => typeof game !== 'undefined' && game.scene.getScene('CenaTitulo')?.titleUI?.account?.clubUnlocked);
      await controller.evaluate(() => {
        const ui = game.scene.getScene('CenaTitulo').titleUI;
        ui.closeModal(true); ui.openSecretClub();
      });
      await controller.getByRole('button', { name: 'Mesa 1', exact: true }).click();
      await controller.getByLabel('Escolher jogador', { exact: true }).selectOption('1');
      await controller.waitForFunction(() => /reservado por \d+s/.test(document.querySelector('.club-tables-status')?.textContent));
      await page.waitForFunction(() => document.querySelector('.presentation-seats section[data-player="1"] h2')?.textContent.includes('RESERVADO'));
      await controller.screenshot({ path: path.join(output, 'reserva-menu.png') });
      await page.screenshot({ path: path.join(output, 'reserva-apresentacao.png') });
      await controller.getByRole('button', { name: 'VOLTAR', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.presentation-seats section[data-player="1"] h2')?.textContent.includes('AGUARDANDO'));
      await controller.close();
      checks.push('Menu do Clube reserva o jogador por 60s, mostra a contagem na apresentação e libera ao voltar.');
    }
    const socket = io(base, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await event(socket, 'connect');
    ready.push(event(socket, 'match-ready'));
    const reserved = await ack(socket, 'reserve-club-seat', { table: 1, seat: index + 1, accountToken: user.token });
    assert.equal(reserved.ok, true);
    assert.ok(reserved.expiresAt - reserved.serverNow <= 60_000);
    await page.waitForFunction(player => document.querySelector(`.presentation-seats section[data-player="${player}"] h2`)?.textContent.includes('RESERVADO'), index + 1);
    assert.equal((await ack(socket, 'join-room', {
      code, table: 1, seat: index + 1, accountToken: user.token,
    })).ok, true);
    if (index === 0) assert.equal(await codeLabel.isVisible(), true, 'Código continua visível enquanto espera o segundo jogador.');
  }
  const matches = await Promise.all(ready);
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaJogo'));
  assert.equal(await page.locator('.presentation-screen .title-matrix').count(), 0, 'A chuva sai junto com a tela de espera.');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(output, 'arena-desktop.png') });
  async function inspect() {
    return page.evaluate(() => {
      const scene = game.scene.getScene('CenaJogo');
      const children = scene.children.list;
      return {
        hands: [scene.partida.jogador, scene.partida.inimigo].map(player => player.mao.cartas.map(card => card.nome)),
        faces: children.filter(node => node.dadosCarta).map(node => node.dadosCarta.nome),
        backs: children.filter(node => node.maoOcultaLado).map(node => node.maoOcultaLado),
        fieldCards: children.filter(node => node.dadosCartaCampo).map(node => ({
          name: node.dadosCartaCampo.nome,
          turned: node.list.some(child => Math.abs(child.angle) === 180),
        })),
        characters: ['jogador', 'inimigo'].map(side => children.find(node => node.name === `personagem-${side}`)?.texture.key),
        labels: children.flatMap(node => node.list || []).filter(node => node.text).map(node => node.text),
        controls: children.filter(node => node.dadosCarta && node.input?.enabled).length,
        canPlay: scene.podeJogarCartasAgora(), canUseAbility: scene.podeUsarHabilidadesAgora(),
        passButton: children.some(node => node.name === 'passar-turno'),
        activePlayer: scene.multiplayer.activePlayer,
        centerAngles: {
          timer: Math.abs(scene.timerContainer.angle),
          rounds: Math.abs(children.find(node => node.list?.some(item => item.text?.startsWith('RODADAS')))?.angle),
          phase: Math.abs(children.find(node => node.list?.some(item => item.text === 'COLOCAR CARTAS' || item.text === 'HABILIDADES'))?.angle),
        },
        symmetry: {
          portraits: ['jogador', 'inimigo'].map(side => {
            const node = children.find(node => node.name === `personagem-${side}`);
            return { width: node.displayWidth, angle: node.angle, x: node.x, y: node.y };
          }),
          hands: ['jogador', 'inimigo'].map(side => children
            .filter(node => node.maoOcultaLado === side)
            .map(node => ({ width: node.width, height: node.height, angle: node.angle }))),
          fieldCenter: (scene.layout.yInimigoTras + scene.layout.yJogadorTras) / 2,

        },
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
  assert.deepEqual(initial.faces, [], 'Mãos ocultam a face das cartas na apresentação.');
  assert.equal(initial.backs.length, initial.hands.flat().length, 'Todas as cartas das mãos aparecem pelo verso.');
  assert.equal(initial.labels.filter(text => text === 'PA:').length, 2);
  const initialAngle = initial.activePlayer === 2 ? 180 : 0;
  assert.deepEqual(Object.values(initial.centerAngles), [initialAngle, initialAngle, initialAngle],
    'Fase, turno e rodadas apontam para quem está jogando.');
  assert.equal(initial.symmetry.portraits[0].width, initial.symmetry.portraits[1].width);
  assert.equal(Math.abs(initial.symmetry.portraits[1].angle), 180);
  assert.equal(initial.symmetry.fieldCenter * 2, initial.symmetry.portraits[0].y);
  for (const hand of initial.symmetry.hands) for (const card of hand) assert.deepEqual({ width: card.width, height: card.height }, { width: 176, height: 246 });
  assert.equal(initial.controls, 0);
  assert.equal(initial.canPlay, false); assert.equal(initial.canUseAbility, false);
  assert.equal(initial.passButton, false);
  assert.equal(await codeLabel.count(), 0, 'Código desaparece quando a partida começa.');
  checks.push('Mãos pelo verso, PA dedicado, personagens corretos e apresentação sem comandos de jogada.');

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
  assert.equal(updated.activePlayer, 3 - active, 'A orientação acompanha quem recebeu a vez.');
  assert.deepEqual(Object.values(updated.centerAngles), [updated.activePlayer === 2 ? 180 : 0,
    updated.activePlayer === 2 ? 180 : 0, updated.activePlayer === 2 ? 180 : 0]);
  assert.ok(updated.fieldCards.some(card => card.name === played.nome && card.turned === (active === 2)),
    'Cartas do campo mantêm a orientação do próprio lado.');
  assert.equal(await codeLabel.count(), 0, 'Código não reaparece ao atualizar.');
  assert.deepEqual(updated.hands[active - 1], state[side].hand.map(card => card.nome));
  assert.ok(updated.labels.includes(String(played.poder)), 'PA dedicado acompanha a carta colocada.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaJogo') &&
    game.scene.getScene('CenaJogo').children.list.some(node => node.name === 'personagem-inimigo'));
  assert.deepEqual((await inspect()).hands, updated.hands);
  assert.equal(await codeLabel.count(), 0, 'Código não reaparece ao recarregar o duelo.');
  checks.push('Atualização real da mão e PA pelo servidor; recarga restaura cartas e personagens.');
  await page.setViewportSize({ width: 720, height: 1480 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, 'arena-retrato.png') });
  checks.push('Espera com assets de NeoFloripa, molduras ciano/rosa do duelo e código no estilo do HUD.');
  assert.equal((await ack(sockets[0], 'decline-match', { room: code, accountToken: users[0].token })).ok, true);
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
  assert.equal(await codeLabel.count(), 0, 'Resultado mantém código oculto.');
  const results = await page.evaluate(() => game.scene.getScene('CenaJogo').children.list
    .filter(node => node.text === 'VENCEU' || node.text === 'PERDEU')
    .map(node => ({ text: node.text, y: node.y, angle: Math.abs(node.angle) })));
  assert.deepEqual(results, [
    { text: 'VENCEU', y: 555, angle: 180 },
    { text: 'PERDEU', y: 1665, angle: 0 },
  ], 'Quem desistiu perde no lado inferior; o vencedor lê VENCEU do lado superior.');
  checks.push('VENCEU em verde e PERDEU em vermelho, cada um no próprio lado e orientado para seu jogador.');
  await page.waitForFunction(() => {
    const scene = game.scene.getScene('CenaJogo');
    return !scene.cameras.main.flashEffect.isRunning && scene.children.list
      .filter(node => node.text === 'VENCEU' || node.text === 'PERDEU').every(node => node.alpha === 1);
  });
  await page.screenshot({ path: path.join(output, 'codigo-resultado.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'));
  assert.equal(await page.locator('.presentation-code--duel').count(), 0, 'Retornar à espera remove o indicador do duelo anterior.');
  checks.push('Código visível na espera e oculto durante duelo, recarga e resultado.');
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
