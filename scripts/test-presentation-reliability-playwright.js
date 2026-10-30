const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-reliability-'));
const base = 'http://127.0.0.1:32147';
const output = path.resolve('output/sindicato/presentation-reliability');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '32147', DATA_DIR: dataDir, PUBLIC_URL: base },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const checks = [], errors = [];
let browser;

async function ready(page, label) {
  await page.waitForFunction(() => /^CÓDIGO \d{6}$/.test(document.querySelector('.presentation-center .presentation-code')?.textContent), null, { timeout: 45000 });
  assert.equal(await page.locator('#boot-status').isVisible(), false, label);
  const state = await page.evaluate(() => ({
    code: cyberduelMultiplayer.room,
    audioMB: game.cache.audio.getKeys().reduce((sum, key) => {
      const buffer = game.cache.audio.get(key);
      return sum + buffer.length * buffer.numberOfChannels * 4;
    }, 0) / 1048576,
    musicBuffers: game.cache.audio.getKeys().filter(key => key.startsWith('musica')),
  }));
  assert.deepEqual(state.musicBuffers, [], 'Músicas não ocupam buffers do preload.');
  assert.ok(state.audioMB < 70, `Buffers de áudio limitados: ${state.audioMB} MB`);
  checks.push({ label, ...state });
  console.log(label, state.code, state.audioMB.toFixed(1) + ' MB');
  return state.code;
}

async function release(page) {
  await page.evaluate(() => cyberduelMultiplayer.leaveRoom());
  await page.waitForTimeout(100);
}

(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
    server.once('exit', () => { clearTimeout(timer); reject(Error('Servidor encerrou')); });
  });
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('crash', () => errors.push('CRASH ' + page.url()));
  });
  const page = await context.newPage();
  for (const route of ['/apresentacao', ...[1, 2, 3, 4, 5].map(n => '/apresentacao' + n)]) {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    const code = await ready(page, route + ' abertura');
    for (let n = 1; n <= 3; n++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await ready(page, route + ' recarga ' + n), code, 'Recarga mantém a mesma sala.');
    }
    await release(page);
  }

  const closing = await context.newPage();
  await closing.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  const closedCode = await ready(closing, 'antes de fechar a aba');
  await closing.close();
  const reopened = await context.newPage();
  await reopened.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  assert.equal(await ready(reopened, 'nova aba com chave persistida'), closedCode);
  await reopened.close();
  const otherBrowser = await browser.newContext();
  const recovered = await otherBrowser.newPage();
  await recovered.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  assert.equal(await ready(recovered, 'outro navegador recupera mesa vazia'), closedCode);
  await release(recovered);
  await otherBrowser.close();

  await page.goto(base + '/apresentacao1?renderer=canvas', { waitUntil: 'domcontentloaded' });
  await ready(page, 'renderização Canvas');
  await release(page);

  await page.route('**/assets/sons/jogo-menu.mp3', route => route.abort());
  await page.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  await ready(page, 'música indisponível');
  await page.screenshot({ path: path.join(output, 'musica-bloqueada.png') });
  await release(page);
  await page.unroute('**/assets/sons/jogo-menu.mp3');

  let textureRequests = 0;
  await page.route('**/assets/fundo/fundo_carta_2.png', route => ++textureRequests === 1 ? route.abort() : route.continue());
  await page.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  await ready(page, 'textura falha uma vez e recupera');
  assert.equal(textureRequests, 2, 'Loader repete o download que falhou.');
  await release(page);
  await page.unroute('**/assets/fundo/fundo_carta_2.png');

  await page.addInitScript(() => { document.fonts.load = () => new Promise(() => {}); });
  await page.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  await ready(page, 'fonte sem resposta');
  const lost = await page.evaluate(() => {
    const extension = game.renderer.gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    window.qaContextLoss = extension;
    extension.loseContext();
    return true;
  });
  assert.ok(lost, 'Chromium disponibiliza a simulação de perda da GPU.');
  await page.getByText('Restaurando a imagem do jogo…').waitFor();
  await page.evaluate(() => qaContextLoss.restoreContext());
  await page.waitForFunction(() => !game.renderer.contextLost);
  await ready(page, 'GPU restaurada');
  await release(page);

  await page.route('**/assets/fundo/fundo_carta_2.png', route => route.abort());
  await page.goto(base + '/apresentacao1', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TENTAR NOVAMENTE', exact: true }).waitFor();
  assert.equal(await page.locator('.presentation-screen').count(), 0, 'Não entra numa arena com assets incompletos.');
  await page.screenshot({ path: path.join(output, 'falha-recuperavel.png') });
  await page.unroute('**/assets/fundo/fundo_carta_2.png');
  await page.getByRole('button', { name: 'TENTAR NOVAMENTE', exact: true }).click();
  await ready(page, 'recuperação pelo botão');
  await release(page);
  await context.close();

  const simultaneous = await browser.newContext();
  simultaneous.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('crash', () => errors.push('CRASH ' + page.url()));
  });
  const pages = await Promise.all([1, 2, 3, 4, 5].map(async table => {
    const tab = await simultaneous.newPage();
    await tab.goto(base + '/apresentacao' + table, { waitUntil: 'domcontentloaded' });
    await ready(tab, 'mesa simultânea ' + table);
    return tab;
  }));
  for (const tab of pages) await release(tab);
  await simultaneous.close();
  assert.deepEqual(errors, []);
  console.log(`${checks.length} aberturas/recuperações aprovadas, sem erro JavaScript ou crash.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const ended = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await ended;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
