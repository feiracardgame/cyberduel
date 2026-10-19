const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-demo-browser-'));
const users = require('../test/account-fixture')(dataDir, ['DemoAdmin', 'DemoPlayer']);
const file = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const user of users) Object.assign(store.accounts[user.accountKey], {
  humanGames: 5, humanWins: 3, gamesPlayed: 5,
  tutorial: { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: ['three', 'club', 'council', 'ten'] },
});
store.accounts[users[1].accountKey].nickname = 'DuelistaComNomeMuitoLongoPraTela';
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:31984';
const output = path.resolve('output/sindicato/demo'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '31984', DATA_DIR: dataDir, ADMIN_USERNAMES: users[0].username },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
const checks = [], errors = [];
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch();
  const api = async (route, body, token = users[0].token, method = 'POST') => {
    const response = await fetch(base + '/api/' + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, route);
    return response.json();
  };
  for (const user of users) await api('account/faction', { faction: 'echossystem' }, user.token);
  await api('admin/accounts/grant-cards', { username: users[1].username, allAvailable: true });
  const starter = (await (await fetch(base + '/api/auth/session', { headers: { Authorization: `Bearer ${users[1].token}` } })).json()).deck;
  const forbidden = starter.map(card => card.nome === 'O Boi' ? { ...card, nome: 'HumbaBrain' } : card);
  await api('deck', { deck: forbidden }, users[1].token, 'PUT');
  await api('boosters/buy', { faction: 'humbanet', purchaseId: 'demo-browser-pack-0001' }, users[1].token);
  const pages = [];
  for (const user of users) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), user.token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && window.cyberduelAccount?.user);
    pages.push(page);
  }
  const [admin, player] = pages;
  await admin.waitForFunction(() => window.cyberduelAccount.isAdmin);
  assert.equal(await player.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.boosterFactions().length), 5);
  assert.match(await player.evaluate(() => modoDemo().catch(error => error.message)), /administradora/);
  assert.match(await admin.evaluate(() => modoDemo(true)), /ativado para todos/);
  await player.waitForFunction(() => window.cyberduelAccount.demoMode);
  const restricted = await player.evaluate(() => ({
    saved: window.cyberduelDeckBuilder.getSavedDeck(),
    boosters: game.scene.getScene('CenaTitulo').titleUI.boosterFactions().map(faction => faction[0]),
    cards: [...new Set(window.cyberduelDeckBuilder.getCatalog().map(card => card.booster))].sort(),
  }));
  assert.equal(restricted.saved, null, 'Deck incompatível fica bloqueado sem apagar as cartas.');
  assert.deepEqual(restricted.boosters.sort(), ['echossystem', 'raspcorp']);
  assert.deepEqual(restricted.cards, ['echossystem', 'raspcorp']);
  await player.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openBoosterShop());
  assert.equal(await player.locator('.booster-factions button').count(), 2);
  await player.waitForFunction(() => [...document.querySelectorAll('.title-modal')].some(node => getComputedStyle(node).opacity === '1'));
  await player.screenshot({ path: path.join(output, 'demo-loja.png') });
  await player.evaluate(() => {
    const title = game.scene.getScene('CenaTitulo');
    title.titleUI.closeModal(true);
    title.scene.start('CenaDeckBuilder');
  });
  await player.waitForFunction(() => game.scene.isActive('CenaDeckBuilder'));
  assert.equal(await player.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.catalog.every(card => ['echossystem', 'raspcorp'].includes(card.booster))), true);
  await player.screenshot({ path: path.join(output, 'demo-deck.png') });
  checks.push('Comando exclusivo de admin; dois boosters na loja e apenas cartas permitidas no editor; deck antigo preservado e bloqueado.');

  assert.match(await admin.evaluate(() => modoDemo(false)), /desativado para todos/);
  await player.waitForFunction(() => !window.cyberduelAccount.demoMode && game.scene.getScene('CenaDeckBuilder').deckBuilderUI.catalog.some(card => card.booster === 'humbanet'));
  assert.equal(await player.evaluate(() => window.cyberduelDeckBuilder.getSavedDeck() !== null), true);
  assert.equal((await player.evaluate(() => window.cyberduelAccount.openBooster('demo-browser-pack-0001'))).length, 5);
  await admin.evaluate(() => modoDemo(true));
  await player.reload({ waitUntil: 'domcontentloaded' });
  await player.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && window.cyberduelAccount?.demoMode);
  assert.equal(await player.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.boosterFactions().length), 2);
  checks.push('Desativação ao vivo restaura editor e pacote guardado; modo demo permanece ao recarregar.');

  const board = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  board.on('pageerror', error => errors.push(error.message));
  await board.goto(base + '/leaderboard', { waitUntil: 'domcontentloaded' });
  const longName = board.locator('[data-username="DemoPlayer"] .player-name');
  await longName.locator('.player-name-text').waitFor();
  await board.waitForFunction(() => {
    const node = document.querySelector('[data-username="DemoPlayer"] .player-name-text');
    return node && new DOMMatrixReadOnly(getComputedStyle(node).transform).m41 < -1;
  });
  assert.match(await longName.getAttribute('class'), /is-scrolling/);
  assert.equal(await board.locator('[data-username="DemoAdmin"] .is-scrolling').count(), 0);
  await board.screenshot({ path: path.join(output, 'leaderboard-nome-longo.png') });
  await board.setViewportSize({ width: 390, height: 844 });
  await board.waitForFunction(() => document.querySelector('[data-username="DemoPlayer"] .player-name')?.classList.contains('is-scrolling'));
  assert.equal(await board.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  checks.push('Nome longo desliza automaticamente; nome curto permanece parado; redimensionamento sem rolagem horizontal.');
  assert.deepEqual(errors, []);
  console.log('Playwright local: modo demo e nomes longos aprovados. Evidências: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const exited = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await exited;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
