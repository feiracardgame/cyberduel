const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-rating-'));
const users = require('../test/account-fixture')(dataDir, ['GestorQA', 'DuelistaQA', 'OfflineQA']);
const file = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const [index, user] of users.entries()) Object.assign(store.accounts[user.accountKey], {
  rating: 1800 - index * 200, humanGames: 5, humanWins: 3, rankedGames: 5, rankedWins: 3, rankedLosses: 2,
  tutorial: { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: [] },
});
fs.writeFileSync(file, JSON.stringify(store));
const port = '31981';
const base = `http://127.0.0.1:${port}`;
const output = path.resolve('output/sindicato/rating');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: port, DATA_DIR: dataDir, ADMIN_USERNAMES: 'GestorQA' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
const errors = [], checks = [];
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => {
      if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); }
    });
    server.once('error', reject);
  });
  browser = await chromium.launch();
  const pages = [];
  for (const user of users.slice(0, 2)) {
    const context = await browser.newContext();
    await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), user.token);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.cyberduelAccount?.user && typeof window.diminuirPontos === 'function');
    pages.push(page);
  }
  const [admin, target] = pages;
  await admin.waitForFunction(() => window.cyberduelAccount.isAdmin);
  const board = await browser.newPage({ reducedMotion: 'reduce' });
  board.on('pageerror', error => errors.push(error.message));
  await board.goto(base + '/leaderboard');
  const score = username => board.locator(`[data-username="${username}"] .influence-value`);
  await score('DuelistaQA').waitFor();
  const before = JSON.parse(fs.readFileSync(file)).accounts;

  for (const route of ['remove-rating', 'reset-rating']) {
    for (const [token, status] of [[null, 401], [users[1].token, 403]]) {
      const response = await admin.request.post(`${base}/api/admin/accounts/${route}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, data: { username: 'DuelistaQA', amount: 200 },
      });
      assert.equal(response.status(), status);
    }
  }
  assert.match(await target.evaluate(() => diminuirPontos('GestorQA', 200).catch(error => error.message)), /administradora/);
  assert.match(await target.evaluate(() => resetarPontosLeaderboard().catch(error => error.message)), /administradora/);
  for (const amount of [0, -1, 1.5, '200', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(await admin.evaluate(amount => diminuirPontos('DuelistaQA', amount).catch(error => error.message), amount), /quantidadeInteiraPositiva/);
    const response = await admin.request.post(base + '/api/admin/accounts/remove-rating', {
      headers: { Authorization: `Bearer ${users[0].token}` }, data: { username: 'DuelistaQA', amount },
    });
    assert.equal(response.status(), 400);
  }
  assert.match(await admin.evaluate(() => diminuirPontos('', 200).catch(error => error.message)), /quantidadeInteiraPositiva/);
  assert.match(await admin.evaluate(() => diminuirPontos('InexistenteQA', 200).catch(error => error.message)), /Conta não encontrada/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).accounts, before, 'Recusas não alteram os dados.');
  checks.push('Permissões no navegador e servidor; argumentos inválidos e conta inexistente.');

  assert.match(await admin.evaluate(() => diminuirPontos(' duelistaqa ', 200)), /-200 pontos de influência para DuelistaQA. Total: 1400/);
  await board.waitForFunction(() => document.querySelector('[data-username="DuelistaQA"] .influence-value')?.textContent === '1.400');
  await board.screenshot({ path: path.join(output, 'depois-desconto.png') });
  assert.match(await admin.evaluate(() => diminuirPontos('DuelistaQA', 9999)), /-1400 pontos.*Total: 0/);
  assert.match(await admin.evaluate(() => diminuirPontos('DuelistaQA', 1)), /-0 pontos.*Total: 0/);
  assert.match(await admin.evaluate(() => diminuirPontos('OfflineQA', 100)), /Total: 1300/);
  assert.match(await admin.evaluate(() => diminuirPontos('GestorQA', 100)), /Total: 1700/);
  const discounted = JSON.parse(fs.readFileSync(file)).accounts;
  assert.equal(discounted[users[0].accountKey].rating, 1700);
  assert.equal(discounted[users[1].accountKey].rating, 0);
  assert.equal(discounted[users[2].accountKey].rating, 1300);
  await target.reload({ waitUntil: 'domcontentloaded' });
  await target.waitForFunction(() => window.cyberduelAccount?.user);
  assert.equal(await target.evaluate(async () => (await cyberduelAccount.request('/api/auth/session')).rating), 0);
  checks.push('Desconto persistido, limite zero, conta própria e offline, painel atualizado e recarga.');

  assert.match(await admin.evaluate(() => resetarPontosLeaderboard()), /3 conta\(s\) resetados para 1000 pontos de influência/);
  await board.waitForFunction(() => {
    const scores = [...document.querySelectorAll('[data-username] .influence-value')];
    return scores.length === 3 && scores.every(node => node.textContent === '1.000');
  });
  await board.screenshot({ path: path.join(output, 'depois-reset.png') });
  assert.match(await admin.evaluate(() => resetarPontosLeaderboard()), /3 conta/);
  const after = JSON.parse(fs.readFileSync(file)).accounts;
  for (const user of users) {
    assert.deepEqual(after[user.accountKey], {
      ...before[user.accountKey], rating: 1000, updatedAt: after[user.accountKey].updatedAt,
    }, 'Preserva os demais dados de todas as contas.');
  }
  checks.push('Reset global para 1000, repetição, painel e preservação dos demais dados.');
  assert.deepEqual(errors, []);
  console.log('Playwright local: desconto e reset aprovados. Evidências: ' + output);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const stopped = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill();
  await stopped;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
