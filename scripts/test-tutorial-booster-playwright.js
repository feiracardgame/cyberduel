const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-tutorial-booster-'));
const users = require('../test/account-fixture')(directory, ['TutorialRasp', 'TutorialEcho']);
const store = JSON.parse(fs.readFileSync(path.join(directory, 'accounts.json')));
for (const user of users) store.accounts[user.accountKey].tutorial = {
  introSeen: true, named: true, wantsTutorial: true, completed: true, farewellSeen: true,
  menuTourSeen: true, boosterTutorialStarted: true, seen: [],
};
store.accounts[users[0].accountKey].currency = 50;
fs.writeFileSync(path.join(directory, 'accounts.json'), JSON.stringify(store));
const base = 'http://127.0.0.1:31968';
const output = path.resolve('output/sindicato/tutorial-boosters');
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env,
  PORT: '31968', DATA_DIR: directory, PUBLIC_URL: base }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser, page;
const errors = [], checks = [];
const purchaseId = 'tutorial-opposite-booster-v1';

async function api(user, route, body) {
  const response = await fetch(base + '/api/' + route, { method: body ? 'POST' : 'GET', headers: {
    Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json',
  }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
async function clickTarget() {
  await page.waitForFunction(() => document.querySelector('.tutorial-target') &&
    !document.querySelector('.tutorial-target').disabled &&
    !game.scene.getScene('CenaTitulo').titleUI.cardMenuTransitioning);
  await page.locator('.tutorial-target').click();
  await page.waitForTimeout(150);
}
async function navigateToBoosters() {
  for (let i = 0; i < 7; i++) {
    if (await page.locator('[data-kind="boosters"], [data-kind="booster-inventory"]').count()) return;
    await clickTarget();
  }
  throw Error('O guia não chegou ao menu de boosters.');
}
async function runViewport(viewport, user, faction) {
  assert.equal((await api(user, 'account/faction', { faction })).status, 200);
  const opposite = faction === 'raspcorp' ? 'echossystem' : 'raspcorp';
  // Um pacote anterior não pode ser confundido com o comprado no tutorial.
  await api(user, 'boosters/buy', { faction: opposite, purchaseId: 'ordinary-before-tutorial' });
  const before = (await api(user, 'auth/session')).body;
  assert.equal((await api(user, 'boosters/buy', { faction, purchaseId })).status, 400);
  const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ animatedBackground: 0, masterVolume: 0 }));
  }, user.token);
  page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  const purchases = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/boosters/buy')) purchases.push(request.postDataJSON());
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.elenai-guide--menu').waitFor();
  await navigateToBoosters();
  await page.waitForFunction(faction => document.querySelector('.tutorial-target')?.dataset.faction === faction, opposite);
  await clickTarget();
  await page.waitForFunction(() => document.querySelector('.tutorial-target')?.textContent === 'RESGATAR BOOSTER GRÁTIS');
  assert.equal(await page.locator('.tutorial-target').isEnabled(), true, 'Grátis mesmo com saldo zero.');
  await page.screenshot({ path: path.join(output, `comprar-${viewport.width}.png`) });
  await clickTarget();
  await page.waitForFunction(() => cyberduelAccount.tutorial.boosterTutorialPurchased);
  assert.equal(await page.evaluate(() => cyberduelAccount.currency), before.currency);
  assert.deepEqual(purchases, [{ faction: opposite, purchaseId }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.elenai-guide--menu').waitFor();
  await navigateToBoosters();
  await page.waitForFunction(() => document.querySelector('.tutorial-target')?.textContent === 'ABRIR BOOSTER');
  await clickTarget();
  await page.waitForFunction(id => game.scene.getScene('CenaTitulo').titleUI.modal?.dataset.packId === id, purchaseId);
  await page.locator('.booster-scratch').waitFor();
  await page.screenshot({ path: path.join(output, `abrir-${viewport.width}.png`) });
  if (viewport.width < 600) {
    const bounds = await page.locator('.booster-scratch').boundingBox();
    await page.mouse.move(bounds.x + 5, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + bounds.height / 2, { steps: 10 });
    await page.mouse.up();
  } else await page.getByRole('button', { name: 'ABRIR PACOTE', exact: true }).click();
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').titleUI.modal?.dataset.revealed === '1');
  for (let i = 1; i < 5; i++) await page.getByRole('button', { name: 'PRÓXIMA CARTA ↑', exact: true }).click();
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').titleUI.modal?.dataset.revealed === '5');
  await page.screenshot({ path: path.join(output, `cinco-cartas-${viewport.width}.png`) });
  await page.getByRole('button', { name: 'VOLTAR AO INVENTÁRIO', exact: true }).click();
  await page.locator('.elenai-guide--menu').waitFor({ state: 'detached' });
  const after = (await api(user, 'auth/session')).body;
  const quantity = collection => Object.values(collection).reduce((sum, value) => sum + value, 0);
  assert.equal(after.currency, before.currency);
  assert.equal(quantity(after.collection), quantity(before.collection) + 5);
  assert.equal(after.boosters.length, 1, 'Preserva o pacote que já existia.');
  assert.equal(after.boosters[0].id, 'ordinary-before-tutorial');
  assert.equal(after.tutorial.boosterTutorialOpened, true);
  assert.equal(after.tutorial.boosterTutorialSeen, true);
  assert.deepEqual(purchases, [{ faction: opposite, purchaseId }], 'Retomar o guia não faz uma segunda compra.');
  const replay = await api(user, 'boosters/buy', { faction: opposite, purchaseId });
  assert.equal(replay.body.currency, after.currency); assert.equal(replay.body.boosters.length, 1);
  const reopen = await api(user, 'boosters/open', { packId: purchaseId });
  assert.deepEqual(reopen.body.collection, after.collection, 'Repetir o resgate e a abertura não concede mais cartas.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  assert.equal(await page.locator('.elenai-guide--menu').count(), 0, 'O guia concluído não reinicia ao recarregar.');
  await page.evaluate(async () => {
    await cyberduelAccount.saveTutorial({ boosterTutorialStarted: true, boosterTutorialSeen: false });
    const ui = game.scene.getScene('CenaTitulo').titleUI;
    new CyberduelBoosterTraining(ui);
  });
  await page.waitForFunction(() => cyberduelAccount.tutorial.boosterTutorialSeen &&
    !game.scene.getScene('CenaTitulo').titleUI.boosterTraining);
  assert.deepEqual(purchases, [{ faction: opposite, purchaseId }], 'Repetir o tutorial não emite outro resgate.');
  assert.deepEqual((await api(user, 'auth/session')).body.collection, after.collection);
  checks.push(`${viewport.width}x${viewport.height}: ${faction} resgata ${opposite} grátis (saldo ${before.currency}), retoma, recebe 5 cartas e repete sem novo brinde.`);
  console.log(checks.at(-1));
  await context.close(); page = null;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch();
  for (const [i, viewport] of [{ width: 390, height: 844 }, { width: 1366, height: 768 }].entries())
    await runViewport(viewport, users[i], i === 0 ? 'raspcorp' : 'echossystem');
  assert.deepEqual(errors, []);
})().catch(async error => {
  console.error(error); console.error(errors); process.exitCode = 1;
  if (page && !page.isClosed()) {
    console.error(await page.locator('.elenai-guide--menu').textContent().catch(() => 'Sem guia'));
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
}).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const ended = once(server, 'exit'); server.kill(); await ended;
  fs.rmSync(directory, { recursive: true, force: true });
});
