const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/sindicato/tutorial');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.ttf': 'font/ttf' };
// Arquivos estáticos apenas: o treino também precisa funcionar com o perfil offline.
const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + path.sep)) throw Error('Caminho inválido');
    const info = fs.statSync(file); if (!info.isFile()) throw Error('Arquivo ausente');
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': info.size });
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(404); response.end(); }
});
let browser, page, touch;
const errors = [], checks = [];
const step = name => page.waitForFunction(name => game.scene.getScene('CenaJogo').training?.step === name &&
  game.scene.getScene('CenaJogo').input.enabled, name);
async function screenPoint(point) {
  return page.evaluate(({ x, y }) => {
    const s = game.scene.getScene('CenaJogo'), rect = game.canvas.getBoundingClientRect();
    const top = s.cameras.main.getWorldPoint(0, 0), bottom = s.cameras.main.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - top.x) / (bottom.x - top.x) * rect.width,
      y: rect.top + (y - top.y) / (bottom.y - top.y) * rect.height };
  }, point);
}
async function tap(point) {
  const screen = await screenPoint(point); await page.touchscreen.tap(screen.x, screen.y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function dialogue() {
  const box = page.locator('.elenai-dialogue'); await box.waitFor();
  for (let i = 0; i < 20 && await box.count(); i++) await box.locator('.elenai-actions button').click();
  assert.equal(await box.count(), 0);
}
async function card(name, hand = true) {
  return page.evaluate(({ name, hand }) => {
    const s = game.scene.getScene('CenaJogo');
    const o = s.children.list.find(o => (hand ? o.dadosCarta : o.dadosCartaCampo)?.nome === name);
    return { x: o.x, y: o.y };
  }, { name, hand });
}
async function slot(index, enemy = false) {
  return page.evaluate(({ index, enemy }) => {
    const L = game.scene.getScene('CenaJogo').layout;
    return { x: L.x[index % 5], y: (enemy ? L.yInimigo : L.yJogador)[Math.floor(index / 5)] };
  }, { index, enemy });
}
async function place(name, index) {
  await tap(await card(name));
  await page.waitForFunction(() => !!game.scene.getScene('CenaJogo').cartaMaoSelecionada);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').training.hint.textContent.includes('Carta selecionada')), true);
  await tap(await slot(index));
}
async function attack(name, target, viewport) {
  const source = name === 'O Tigre' ? 'tiger' : 'dipsp';
  await step(source + '-pass');
  await tap(await page.evaluate(() => {
    const o = game.scene.getScene('CenaJogo').botaoPassarTutorial; return { x: o.x, y: o.y };
  }));
  await step(source + '-ability');
  await tap(await card(name, false));
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.training.alvoDestaque === s.botaoHabilidadeCampo && s.botaoHabilidadeCampo?.visible &&
      !s.tweens.isTweening(s.cartaCampoSelecionada);
  });
  await page.screenshot({ path: path.join(output, `${source}-bolinha-${viewport.width}.png`) });
  await tap(await page.evaluate(() => {
    const o = game.scene.getScene('CenaJogo').botaoHabilidadeCampo; return { x: o.x, y: o.y };
  }));
  await page.waitForFunction(() => !!game.scene.getScene('CenaJogo').objetosSelecaoAlvo?.length);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), false);
  const targetPoint = await slot(target, true);
  assert.equal(await page.evaluate(({ x, y }) => {
    const h = game.scene.getScene('CenaJogo').training.highlight; return h.x === x && h.y === y;
  }, targetPoint), true, 'O destaque acompanha o alvo, depois da bolinha.');
  await tap(targetPoint);
  await dialogue();
}
async function runViewport(viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('cyberduel.settings.v1',
    JSON.stringify({ skipBattleAnnouncements: 1, animatedBackground: 0, masterVolume: 0 })));
  await context.route(/\/api\/|\/socket\.io\//, route => route.abort('connectionrefused'));
  page = await context.newPage(); page.setDefaultTimeout(30000);
  touch = await context.newCDPSession(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
  await page.evaluate(() => { cyberduelAccount.useOfflineAdmin(); game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { tutorial: true }); });
  await dialogue(); await step('intern-inspect');
  const first = await card('Estagiário de Machine Learning');
  await tap(first);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), false, 'Um toque curto não abre a ficha.');
  const point = await screenPoint(first), mobile = viewport.width < 600;
  if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
  else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
  await page.waitForTimeout(540);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), true);
  if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').painelDetalheAtual?.scaleX === 1);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').painelDetalheAtual.list.some(o =>
    o.text?.includes('SEGURE: SÓ A ARTE'))), false);
  await tap(await page.evaluate(() => {
    const o = game.scene.getScene('CenaJogo').painelDetalheAtual.getByName('fechar-detalhe-carta');
    const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty };
  }));
  await step('intern'); await place('Estagiário de Machine Learning', 0); await dialogue();
  await step('tiger'); await place('O Tigre', 7); await attack('O Tigre', 7, viewport);
  await step('dipsp'); await place('Agente da DIPSP', 8); await attack('Agente da DIPSP', 2, viewport);
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo'));
  assert.equal(await page.evaluate(() => cyberduelAccount.tutorial.completed), true);
  checks.push(`${viewport.width}x${viewport.height}: treino completo com segurar, selecionar, invocar, bolinha, alvo e conclusão offline.`);
  console.log(checks.at(-1)); await context.close(); page = null;
}
async function run() {
  fs.mkdirSync(output, { recursive: true }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) await runViewport(viewport);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
}
run().catch(async error => {
  console.error(error); console.error(errors); process.exitCode = 1;
  if (page && !page.isClosed()) {
    console.error(await page.evaluate(() => {
      const s = game.scene.getScene('CenaJogo'); return { step: s.training?.step, hint: s.training?.hint?.textContent,
        modal: s.modalAberto, locked: s.travado, input: s.input.enabled, effects: s.efeitosVisuaisPendentes() };
    }).catch(() => ({})));
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
}).finally(async () => {
  await browser?.close(); server.closeAllConnections();
  if (server.listening) { const closed = once(server, 'close'); server.close(); await closed; }
});
