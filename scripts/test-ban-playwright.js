const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-ban-browser-'));
const [admin, target] = require('../test/account-fixture')(directory, ['GestorQA', 'DuelistaQA']);
const file = path.join(directory, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const account of Object.values(store.accounts)) account.tutorial = {
  introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: [],
};
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:32127';
const output = path.resolve('output/sindicato/banimentos');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  windowsHide: true,
  env: { ...process.env, PORT: '32127', DATA_DIR: directory, ADMIN_USERNAMES: admin.username },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
const errors = [], checks = [];
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);
  browser = await chromium.launch({ channel });
  const adminContext = await browser.newContext();
  await adminContext.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), admin.token);
  const adminPage = await adminContext.newPage();
  adminPage.on('pageerror', error => errors.push(error.message));
  await adminPage.goto(base);
  await adminPage.waitForFunction(() => window.cyberduelAccount?.isAdmin && typeof banirConta === 'function');
  for (const [label, viewport] of [['desktop', { width: 1366, height: 768 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: label === 'mobile', hasTouch: label === 'mobile' });
    await context.addInitScript(token => {
      if (!sessionStorage.getItem('ban-fixture-loaded')) {
        localStorage.setItem('cyberduel.account.token.v1', token);
        sessionStorage.setItem('ban-fixture-loaded', '1');
      }
    }, target.token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => window.cyberduelAccount?.user === 'DuelistaQA' && window.cyberduelMultiplayer?.socket?.connected);
    if (label === 'mobile') {
      await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'));
      await page.evaluate(async () => {
        await window.cyberduelAccount.chooseFaction('echossystem');
        game.scene.stop('CenaTitulo');
        game.scene.start('CenaJogo', { debug: true, deckDebug: window.cyberduelDeckBuilder.getStarterDeck() });
      });
      await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.getScene('CenaJogo').partida);
    }
    assert.match(await page.evaluate(() => banirConta('GestorQA').catch(error => error.message)), /administradora/);
    const reason = '<img src=x onerror=alert(1)> Motivo de teste';
    assert.match(await adminPage.evaluate(reason => banirConta(' DuelistaQA ', reason), reason), /DuelistaQA banida/);
    const dialog = page.locator('dialog.name-guard');
    await dialog.waitFor();
    assert.equal(await dialog.locator('h1').textContent(), 'CONTA BANIDA');
    assert.equal(await dialog.locator('#name-guard-warning').textContent(), `Motivo: ${reason}`);
    assert.equal(await dialog.locator('input, img, .name-guard__submit').count(), 0);
    assert.equal(await page.evaluate(() => window.cyberduelAccount.token), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('cyberduel.account.token.v1')), null);
    if (label === 'mobile')
      await page.waitForFunction(() => !game.scene.isActive('CenaJogo') && !game.scene.isActive('CenaEfeitos') && game.scene.isActive('CenaTitulo'));
    await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
    const bounds = await dialog.locator('.name-guard__exit').boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height,
      'Botão para voltar ao login precisa ficar acessível.');
    await page.screenshot({ path: path.join(output, `${label}.png`) });
    assert.match(await adminPage.evaluate(() => desbanirConta('DuelistaQA')), /desbanida/);
    const session = await page.request.get(base + '/api/auth/session', { headers: { Authorization: `Bearer ${target.token}` } });
    assert.equal(session.status(), 200);
    await dialog.locator('.name-guard__exit').click();
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && window.cyberduelAccount?.user === null && !document.querySelector('dialog.name-guard'));
    // Tenta restaurar uma sessão banida sem socket: o poll/HTTP também abre o aviso.
    await adminPage.evaluate(() => banirConta('DuelistaQA'));
    await page.evaluate(token => { window.cyberduelAccount.token = token; return window.cyberduelAccount.restore(); }, target.token);
    await dialog.waitFor();
    assert.equal(await dialog.locator('h1').textContent(), 'CONTA BANIDA');
    await adminPage.evaluate(() => desbanirConta('DuelistaQA'));
    checks.push(`${label}: comandos, aviso imediato, texto seguro, foco, saída, HTTP e desbanimento.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Playwright: banimentos em desktop/celular aprovados. Evidências: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const exited = server.exitCode === null ? once(server, 'exit') : Promise.resolve(); server.kill(); await exited;
});
