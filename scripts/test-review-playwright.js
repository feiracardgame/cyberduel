const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-review-'));
const users = require(path.join(root, 'test/account-fixture'))(dir, ['BotReview', 'BotReviewGuide']);
const file = path.join(dir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const [index, user] of users.entries()) store.accounts[user.accountKey].tutorial = {
  introSeen: true, named: true, wantsTutorial: index === 1, completed: true, farewellSeen: true,
  menuTourSeen: true, boosterTutorialStarted: index === 1, boosterTutorialSeen: false, seen: [],
};
fs.writeFileSync(file, JSON.stringify(store));
const port = process.env.REVIEW_TEST_PORT || '32152';
const base = `http://127.0.0.1:${port}`;
let server, browser;
(async () => {
  server = spawn(process.execPath, ['server/server.js'], { cwd: root,
    env: { ...process.env, PORT: port, DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server timeout')), 5000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch();
  for (const [index, user] of users.entries()) {
    const faction = await fetch(base + '/api/account/faction', { method: 'POST',
      headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ faction: 'raspcorp' }) });
    assert.equal(faction.status, 200);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(token => {
      localStorage.setItem('cyberduel.account.token.v1', token);
      localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ lowPowerMode: 1, masterVolume: 0, animatedBackground: 0, skipBattleAnnouncements: 1 }));
    }, user.token);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', message.text()); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
      !game.scene.getScene('CenaTitulo').restaurandoConta && !game.scene.getScene('CenaTitulo').story.busy, null, { timeout: 120000 });
    for (let match = 1; match <= 2; match++) {
      await page.evaluate(() => game.scene.getScene('CenaTitulo').iniciarPartida(false));
      await page.waitForFunction(() => game.scene.isActive('CenaJogo') && !!game.scene.getScene('CenaJogo').soloMatchStart);
      const startup = await page.evaluate(() => game.scene.getScene('CenaJogo').soloMatchStart);
      assert.ok(startup.matchId, JSON.stringify(startup));
      // Avança à última rodada; o motor e o registro da derrota continuam sendo os reais.
      await page.evaluate(() => {
        const s = game.scene.getScene('CenaJogo');
        s.time.removeAllEvents();
        s.partida.jogador.campo.cartas.fill(null);
        s.partida.inimigo.campo.cartas.fill(null);
        s.partida.rodadasJogador = 0; s.partida.rodadasInimigo = 3;
        s.partida.turno = s.partida.maxTurnos;
        s.soloStep = 3;
        s.avancarFaseSolo();
      });
      await page.waitForFunction(games => cyberduelAccount.gamesPlayed === games, match);
      await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
      const count = await page.evaluate(() => ({ games: cyberduelAccount.gamesPlayed, review: cyberduelAccount.review }));
      assert.equal(count.games, match);
      assert.equal(count.review.due, match === 2);
      await page.evaluate(() => {
        const s = game.scene.getScene('CenaJogo');
        const button = s.children.list.find(o => o.list?.some(child => child.text === 'Voltar ao menu'));
        if (!button) throw Error('Return button missing');
        button.emit('pointerup');
      });
      await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
      await page.waitForTimeout(500);
      if (match === 2) await page.locator('[data-kind="review"]').waitFor({ state: 'visible', timeout: 5000 });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Duas derrotas pelo fluxo real do bot exibem o convite nos dois perfis.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  fs.rmSync(dir, { recursive: true, force: true });
});
