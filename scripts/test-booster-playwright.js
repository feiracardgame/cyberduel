const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-booster-visual-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['BoosterVisual']);
const file = path.join(dataDir, 'accounts.json');
const stored = JSON.parse(fs.readFileSync(file));
const cards = [
  ['O Rato', 'baixa'], ['A Cobra', 'media'], ['O Boi', 'alta'], ['A Aranha', 'lendaria'], ['O Cão', 'baixa'],
].map(([nome, nivel]) => ({ nome, nivel, tipo: 'monstro', quantidade: 1 }));
const raspCards = [
  ['CyberVendedor da RaspCorp', 'baixa'], ['Agente da DIPSP', 'media'], ['Advogado Corporativo', 'media'],
  ['UCC "Juggernaut"', 'alta'], ['RaspClay MonteCorp', 'lendaria'],
].map(([nome, nivel]) => ({ nome, nivel, tipo: 'monstro', quantidade: 1 }));
Object.assign(stored.accounts[fixture.accountKey], {
  tutorial: { introSeen: true, named: true, wantsTutorial: false, completed: true, farewellSeen: true, seen: [] },
  boosters: [1, 2].map(id => ({ id: `visual-pack-${id}`, faction: id === 1 ? 'echossystem' : 'raspcorp', cards: id === 1 ? cards : raspCards, purchasedAt: new Date().toISOString() })),
});
fs.writeFileSync(file, JSON.stringify(stored));
const output = path.resolve('output/sindicato/booster-visual'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '31962', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser, page, touch, opened = 0, recordingStartedAt, animationStartedAt;
const errors = [], checks = [];
const frontReady = () => page.waitForFunction(() => document.querySelector('.title-booster-card.is-front.is-settled') && !document.querySelector('.booster-buy').disabled && [...document.querySelectorAll('.title-booster-card.is-front img')].every(img => img.complete && img.naturalWidth > 0));
const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function startTouch(x, y) {
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
}
async function moveTouch(x, y) {
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  await frame();
}
async function endTouch(cancel = false) {
  await touch.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
}
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  const response = await fetch('http://127.0.0.1:31962/api/account/faction', { method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ faction: 'echossystem' }) });
  assert.equal(response.status, 200);
  const before = await response.json();
  const total = collection => Object.values(collection).reduce((sum, value) => sum + value, 0);
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    recordVideo: { dir: output, size: { width: 390, height: 844 } } });
  await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
  page = await context.newPage(); recordingStartedAt = Date.now(); touch = await context.newCDPSession(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().endsWith('/api/boosters/open')) opened++; });
  await page.goto('http://127.0.0.1:31962', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && cyberduelAccount.user && !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openBoosterShop());
  for (const faction of ['raspcorp', 'echossystem', 'humbanet', 'remanescentes', 'sindicato']) {
    await page.locator(`.booster-faction[data-faction="${faction}"]`).click();
    assert.equal(await page.locator('.booster-pack-lid img').count(), 0, 'A aba de abertura não contém retrato.');
    assert.equal(await page.locator('.booster-pack').evaluate(pack => {
      const windowArt = pack.querySelector('.booster-pack-window'), lid = pack.querySelector('.booster-pack-lid');
      return windowArt.offsetTop >= lid.offsetHeight && getComputedStyle(pack.querySelector('.booster-pack-art')).objectFit === 'contain';
    }), true, 'Tampa e personagem ocupam áreas separadas.');
    assert.equal(await page.locator('.booster-pack-name').evaluate(name => name.scrollWidth <= name.clientWidth), true, 'Nome da facção cabe na embalagem.');
    assert.match(await page.locator('.booster-pack-art').getAttribute('src'), /\/game\/.*\.webp/);
  }
  await page.getByRole('button', { name: 'Fechar loja de boosters', exact: true }).click();
  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openBoosterInventory());
  await page.locator('.booster-inventory-item').filter({ hasText: 'EchoSsystem' }).getByRole('button', { name: 'ABRIR BOOSTER', exact: true }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.booster-fullscreen')).opacity === '1' && document.querySelector('.booster-pack-art').complete);
  await page.screenshot({ path: path.join(output, 'pacote-fechado.png') });
  const seal = await page.locator('.booster-scratch').boundingBox();
  const sx = seal.x + seal.width * .25, sy = seal.y + seal.height / 2;
  await startTouch(sx, sy); await moveTouch(sx + seal.width * .2, sy);
  assert.equal(await page.locator('.booster-pack').evaluate(node => node.classList.contains('is-tearing')), true);
  await endTouch(true);
  assert.equal(opened, 0, 'Cancelar o lacre não consome um pacote.');
  await startTouch(sx, sy);
  for (let i = 1; i <= 8; i++) await moveTouch(sx + seal.width * .7 * i / 8, sy);
  await endTouch();
  await page.waitForSelector('.title-booster-dialog.is-opening');
  animationStartedAt = Date.now() - recordingStartedAt;
  await page.waitForFunction(() => document.querySelector('.booster-pack').getAnimations().some(animation => animation.currentTime >= 450));
  await page.screenshot({ path: path.join(output, 'lacre-rompendo.png') });
  await frontReady();
  assert.equal(opened, 1);
  assert.equal(await page.locator('.title-booster-card:not(.is-front) img[src]').count(), 0, 'Somente a carta revelada carrega sua imagem.');
  assert.match(await page.locator('.title-booster-card.is-front img').getAttribute('src'), /\/game\/.*\.webp/);
  const card = await page.locator('.title-booster-card.is-front').boundingBox();
  const x = card.x + card.width / 2, y = card.y + card.height * .6;
  await startTouch(x, y); await moveTouch(x + 35, y - 85);
  assert.equal(await page.locator('.title-booster-card.is-front').evaluate(node => node.classList.contains('is-dragging')), true);
  assert.equal(await page.locator('.title-booster-card.is-front').evaluate(node => Number.parseFloat(node.style.getPropertyValue('--drag-y')) < -60), true);
  await page.screenshot({ path: path.join(output, 'carta-arrastando.png') });
  await endTouch(true);
  assert.equal(await page.locator('.title-booster-card').count(), 5);
  assert.equal(await page.locator('.title-booster-card.is-front').evaluate(node => node.style.getPropertyValue('--drag-y')), '');
  await startTouch(x, y);
  for (let i = 1; i <= 6; i++) await moveTouch(x + i * 4, y - i * 22);
  await endTouch();
  await page.waitForFunction(() => document.querySelectorAll('.title-booster-card').length === 4);
  await frontReady();
  assert.equal(opened, 1, 'Arrastar não reabre nem cobra novamente.');
  await page.locator('.booster-buy').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.title-booster-card').length === 3); await frontReady();
  await page.mouse.move(x, y); await page.mouse.wheel(0, -180);
  await page.waitForFunction(() => document.querySelectorAll('.title-booster-card').length === 2); await frontReady();
  await page.getByRole('button', { name: 'PRÓXIMA CARTA', exact: false }).click();
  await page.locator('.booster-cutin').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(output, 'lendaria.png') });
  await frontReady();
  assert.equal(await page.locator('.title-booster-card.is-front strong').innerText(), 'A Aranha');
  await page.screenshot({ path: path.join(output, 'carta-revelada.png') });
  const last = await page.locator('.title-booster-card.is-front').boundingBox();
  await startTouch(last.x + last.width / 2, last.y + last.height / 2);
  await moveTouch(last.x + last.width / 2, last.y + last.height / 2 - 100); await endTouch();
  assert.equal(await page.locator('.title-booster-card').count(), 1, 'Última carta retorna ao repouso.');
  assert.equal(await page.evaluate(() => cyberduelAccount.currency), before.currency);
  assert.equal(await page.evaluate(() => Object.values(cyberduelAccount.collection).reduce((sum, n) => sum + n, 0)), total(before.collection) + 5);
  checks.push('Toque: lacre cancelado e rompido, carta acompanha o dedo, cancelamento retorna, arraste revela uma carta sem repetir a abertura.');
  checks.push('Teclado, roda do mouse, lendária, última carta, saldo e cinco cartas recebidas conferidos.');
  await page.getByRole('button', { name: 'VOLTAR AO INVENTÁRIO', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'ABRIR BOOSTER', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.booster-fullscreen').length === 1 && getComputedStyle(document.querySelector('.booster-fullscreen')).opacity === '1' && document.querySelector('.booster-pack-art').complete && document.querySelector('.booster-pack-art').naturalWidth > 0);
  await page.screenshot({ path: path.join(output, 'raspcorp-lacre-separado.png') });
  await page.setViewportSize({ width: 320, height: 568 });
  const action = await page.locator('.booster-buy').boundingBox();
  assert.ok(action.y + action.height <= 569, 'Botão de abertura cabe no celular compacto.');
  assert.equal(await page.locator('.booster-pack-window').evaluate(windowArt => windowArt.clientHeight >= windowArt.closest('.booster-pack').clientHeight * .4), true, 'O retrato continua legível no celular compacto.');
  assert.equal(await page.locator('.booster-pack-name').evaluate(name => name.scrollWidth <= name.clientWidth), true);
  await page.screenshot({ path: path.join(output, 'raspcorp-celular-compacto.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('.booster-scratch').focus(); await page.keyboard.press('Enter'); await frontReady();
  assert.equal(opened, 2);
  assert.equal(await page.locator('.title-booster-card.is-front').evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.screenshot({ path: path.join(output, 'desktop-movimento-reduzido.png') });
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'PRÓXIMA CARTA', exact: false }).click(); await frontReady();
  }
  assert.equal(await page.evaluate(() => cyberduelAccount.boosters.length), 0);
  assert.equal(await page.evaluate(() => cyberduelAccount.currency), before.currency);
  checks.push('1366×768 e movimento reduzido: abertura por Enter, cinco revelações, duas aberturas únicas e saldo preservado.');
  checks.push('Cinco facções: arte inteira separada do lacre, nomes sem cortes, imagens WebP e carregamento somente da carta revelada; RaspCorp conferida em 320×568.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors, opened, animationStartedAt }, null, 2));
  const video = page.video(); await context.close(); await video.saveAs(path.join(output, 'booster-abertura-arraste.webm'));
  console.log(checks.join('\n'));
}
run().catch(async error => {
  console.error(error); console.error(errors);
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') });
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  fs.rmSync(dataDir, { recursive: true, force: true });
});
