const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-broadcast-'));
const users = require('../test/account-fixture')(dataDir, ['GestorQA', 'DuelistaQA']);
const file = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const user of users) store.accounts[user.accountKey].tutorial = { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: [] };
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:31980';
const output = path.resolve('output/sindicato/broadcast'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: '31980', DATA_DIR: dataDir, ADMIN_USERNAMES: 'GestorQA' }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const errors = [], checks = [];
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined });
  const clients = [];
  for (const [index, route] of ['/', '/', '/leaderboard', '/'].entries()) {
    const context = await browser.newContext({ viewport: { width: index === 1 ? 390 : 1366, height: index === 1 ? 844 : 768 } });
    if (index < 2) await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), users[index].token);
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    if (index !== 2) await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'), null, { timeout: 120000 });
    clients.push({ context, page });
  }
  const admin = clients[0].page, target = clients[1].page;
  await admin.waitForFunction(() => window.cyberduelAccount.isAdmin);
  await target.waitForFunction(() => window.cyberduelAccount.user);
  await target.evaluate(async () => {
    await window.cyberduelAccount.chooseFaction('echossystem');
    window.cyberduelSettings.set('skipBattleAnnouncements', 1);
    game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true });
  });
  await target.waitForFunction(() => game.scene.isActive('CenaJogo'));
  for (const [token, status] of [[null, 401], [users[1].token, 403]]) {
    const response = await clients[0].context.request.post(base + '/api/admin/broadcast', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}, data: { message: 'Não autorizado' },
    });
    assert.equal(response.status(), status);
  }
  for (const message of ['', 'x'.repeat(1001), '\u0000']) {
    const response = await clients[0].context.request.post(base + '/api/admin/broadcast', {
      headers: { Authorization: `Bearer ${users[0].token}` }, data: { message },
    });
    assert.equal(response.status(), 400);
  }
  assert.equal(await target.locator('.server-notice').count(), 0);
  checks.push('server-authorization-and-validation');
  const message = 'Manutenção em 10 minutos.\n<img src=x onerror="window.injetado=true">';
  assert.match(await admin.evaluate(message => enviarAvisoGeral(message), message), /Aviso enviado para 4 conexão/);
  for (const [index, { page }] of clients.entries()) {
    await page.getByRole('status', { name: 'Aviso da administração' }).waitFor();
    assert.equal(await page.locator('.server-notice p').textContent(), message);
    assert.equal(await page.locator('.server-notice img').count(), 0);
    assert.equal(await page.evaluate(() => window.injetado === true), false);
    const bounds = await page.locator('.server-notice').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width + 1);
    await page.screenshot({ path: path.join(output, `notice-${index}.png`) });
  }
  assert.equal(await target.evaluate(() => game.input.enabled && game.scene.isActive('CenaJogo')), true, 'Aviso não pausa nem bloqueia o duelo.');
  checks.push('desktop-mobile-duel-ranking-anonymous-and-safe-text');
  await admin.evaluate(() => enviarAvisoGeral('Segundo aviso'));
  for (const { page } of clients) {
    assert.equal(await page.locator('.server-notice p').textContent(), message, 'Novo aviso aguarda na fila.');
    await page.getByRole('button', { name: 'Fechar aviso da administração' }).click();
    await page.getByText('Segundo aviso', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fechar aviso da administração' }).click();
    assert.equal(await page.locator('.server-notice').count(), 0);
  }
  checks.push('queued-notices-and-dismissal');
  const lateContext = await browser.newContext();
  const late = await lateContext.newPage();
  await late.goto(base + '/leaderboard', { waitUntil: 'networkidle' });
  assert.equal(await late.locator('.server-notice').count(), 0, 'Quem entra depois não recebe avisos antigos.');
  checks.push('no-offline-history');
  assert.deepEqual(errors, []);
  console.log('Avisos gerais: autorização, validação, quatro clientes, duelo, celular, ranking, HTML literal, fila e ausência de histórico aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close(); server.kill();
});
