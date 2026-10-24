const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { chromium } = require('playwright');

// Serve apenas arquivos, como o Live Server; não carrega o backend do jogo.
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/sindicato');
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file, size;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw Error('Arquivo ausente');
    const info = fs.statSync(file);
    if (!info.isFile()) throw Error('Arquivo ausente');
    size = info.size;
  } catch { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
    'Content-Length': size });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(file).pipe(response);
});
const errors = [], apiRequests = [];
let browser, page;

async function waitForDuel() {
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos') &&
    game.scene.getScene('CenaJogo').cameras.main.alpha === 1 &&
    game.scene.getScene('CenaJogo').children.list.some(object => object.dadosCarta && object.visible));
}

async function state() {
  return page.evaluate(() => {
    const account = cyberduelAccount, scene = game.scene.getScene('CenaJogo');
    return { user: account.user, admin: account.isAdmin, provider: account.authProvider,
      token: account.token, storedToken: localStorage.getItem(account.storageKey),
      registered: scene.partidaRegistradaNaConta, soloStart: scene.soloMatchStart,
      hand: scene.partida.jogador.mao.cartas.length };
  });
}

async function run() {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  console.log('Servidor estático iniciado, sem backend.');
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('cyberduel.settings.v1',
    JSON.stringify({ skipBattleAnnouncements: 1, animatedBackground: 0, masterVolume: 0 })));
  await context.route(/\/api\/|\/socket\.io\//, route => {
    apiRequests.push(new URL(route.request().url()).pathname);
    return route.abort('connectionrefused');
  });
  page = await context.newPage(); page.setDefaultTimeout(25000);
  console.log('Chrome iniciado.');
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
  console.log('Menu carregado com o backend bloqueado.');
  assert.equal(await page.evaluate(() => cyberduelAccount.user), null);
  const baseline = apiRequests.length;
  assert.match(await page.evaluate(() => irParaX1()), /iniciado contra o bot/);
  await waitForDuel();
  console.log('X1 iniciado com admin offline.');
  const offline = await state();
  assert.deepEqual({ ...offline, hand: undefined }, { user: 'Admin', admin: true, provider: 'offline',
    token: null, storedToken: null, registered: true, soloStart: null, hand: undefined });
  assert.ok(offline.hand > 0, 'O deck temporário gera uma mão jogável sem conta no servidor.');
  assert.equal(await page.evaluate(() => puxarCarta('O Rato').nome), 'O Rato');
  assert.equal(await page.evaluate(() => partida.jogador.mao.cartas.some(card => card.nome === 'O Rato')), true);
  assert.match(await page.evaluate(() => irParaX1()), /iniciado contra o bot/);
  await waitForDuel();
  assert.equal((await state()).provider, 'offline', 'Reabrir mantém o perfil admin temporário.');
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'x1-offline.png') });
  await page.evaluate(() => irParaFinal());
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
  assert.equal(await page.evaluate(() => partida.partidaEncerrada), true);
  const requiresBackend = route => /auth\/local|match-start|match-complete|account\/tutorial/.test(route);
  assert.deepEqual(apiRequests.slice(baseline).filter(requiresBackend), [],
    'Entrar, reiniciar e finalizar o X1 não exigem autenticação ou registro no backend.');
  await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta);
  assert.match(await page.evaluate(() => irParaX1()), /iniciado contra o bot/);
  await waitForDuel();
  assert.equal((await state()).provider, 'offline', 'Voltar ao menu e reabrir mantém o perfil offline.');
  assert.ok(!apiRequests.some(requiresBackend),
    'Retornar ao menu não exige login, registro da partida ou tutorial no backend.');
  assert.deepEqual(errors, []);
  console.log('X1 offline: admin temporário, deck/mão reais, puxarCarta, reinício e final sem backend ou token aprovados.');
}

run().catch(async error => {
  console.error(error); console.error(errors); process.exitCode = 1;
  if (page && !page.isClosed()) {
    console.error(await page.evaluate(() => typeof game === 'undefined' ? { game: false } : ({
      scenes: game.scene.getScenes(true).map(scene => scene.scene.key),
      user: window.cyberduelAccount?.user, provider: window.cyberduelAccount?.authProvider,
      preload: game.scene.getScene('CenaPreload')?.load?.progress,
    })).catch(() => ({})));
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'x1-offline-failure.png') }).catch(() => {});
  }
}).finally(async () => {
  await browser?.close();
  server.closeAllConnections();
  if (server.listening) { const closed = once(server, 'close'); server.close(); await closed; }
});
