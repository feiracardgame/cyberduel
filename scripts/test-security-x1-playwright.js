const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-security-x1-browser-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['DragonAdmin']);
const accountsPath = path.join(dataDir, 'accounts.json'), accounts = JSON.parse(fs.readFileSync(accountsPath));
Object.assign(accounts.accounts[fixture.accountKey], { faction: null,
  tutorial: { introSeen: true, named: true, wantsTutorial: false, completed: true, farewellSeen: true, seen: [] } });
fs.writeFileSync(accountsPath, JSON.stringify(accounts));
const output = path.resolve('output/sindicato/seguranca-x1'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], { windowsHide: true,
  env: { ...process.env, PORT: '31976', DATA_DIR: dataDir, ADMIN_USERNAMES: fixture.username }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, page, recordingStartedAt, animationStartedAt;
const errors = [], checks = [];
async function tapWorld(x, y) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = await page.evaluate(({ x, y }) => {
    const scene = game.scene.getScene('CenaJogo'), rect = game.canvas.getBoundingClientRect();
    const a = scene.cameras.main.getWorldPoint(0, 0), b = scene.cameras.main.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - a.x) / (b.x - a.x) * rect.width, y: rect.top + (y - a.y) / (b.y - a.y) * rect.height };
  }, { x, y });
  await page.touchscreen.tap(point.x, point.y);
}
async function arena() {
  await page.evaluate(() => {
    window.cyberduelSettings.set('skipBattleAnnouncements', 1); window.cyberduelSettings.set('battlefield', 1);
    game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true });
  });
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));
  await page.evaluate(() => {
    const scene = game.scene.getScene('CenaJogo'); scene.time.removeAllEvents();
    const match = new Partida(null, true);
    for (const player of [match.jogador, match.inimigo]) {
      player.campo.cartas.fill(null); player.mao.cartas = []; player.deck.cartas = []; player.cartasRecemCompradas = [];
    }
    let id = 87000;
    const make = (name, type = 'monstro') => {
      const base = [...POOL_CARTAS_MONSTRO, ...POOL_CARTAS_TERRENO].find(card => card.nome === name);
      return new Carta(++id, base.poder || 0, type, JSON.parse(JSON.stringify(base)));
    };
    window.qaDragon = make('Dragão das Comunicações Móveis'); match.jogador.mao.adicionarCarta(qaDragon);
    ['O Porco', 'O Tigre', 'HAL 9001', 'A Aranha', 'HumbaBrain', 'O Boi', 'A Cobra', 'O Bom'].forEach((name, index) => match.inimigo.campo.adicionarCarta(make(name), index));
    match.inimigo.campo.adicionarCarta(make('Saloon', 'terreno'), 8);
    match.inimigo.campo.adicionarCarta(make('Terras Desertas', 'terreno'), 9);
    match.inimigo.campo.cartas[1].protegidaPA = true;
    scene.partida = window.partida = match; scene.faseAtual = match.fase = 'colocar'; scene.ehMeuTurno = true;
    scene.travado = false; scene.avisoLocal = null; scene.prazoFaseLocal = Date.now() + 600000;
    scene.timerTurnoExpirado = false; scene.finalDebug = false;
    const effects = game.scene.getScene('CenaEfeitos'); effects.ultimoEvento = 0; effects.fila = [];
    scene.desenharInterface(); scene.cameras.main.setAlpha(1);
  });
  await page.waitForFunction(() => {
    const scene = game.scene.getScene('CenaJogo'), card = scene.children.list.find(object => object.dadosCarta === qaDragon);
    return scene.input.enabled && scene.cameras.main.alpha === 1 && card?.input?.enabled && card.alpha > .8 && card.scaleX === 1;
  });
}
async function summon() {
  const hand = await page.evaluate(() => {
    const card = game.scene.getScene('CenaJogo').children.list.find(object => object.dadosCarta === qaDragon);
    return { x: card.x, y: card.y };
  });
  await tapWorld(hand.x, hand.y);
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').cartaMaoSelecionada?.dadosCarta === qaDragon);
  const slot = await page.evaluate(() => { const layout = game.scene.getScene('CenaJogo').layout; return { x: layout.x[2], y: layout.yJogador[1] }; });
  await tapWorld(slot.x, slot.y);
}
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  const starter = await fetch('http://127.0.0.1:31976/api/account/faction', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.token}` },
    body: JSON.stringify({ faction: 'raspcorp' }) });
  assert.equal(starter.status, 200);
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    recordVideo: { dir: output, size: { width: 390, height: 844 } } });
  await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
  page = await context.newPage(); page.setDefaultTimeout(25000); page.on('pageerror', error => errors.push(error.message));
  recordingStartedAt = Date.now();
  await page.goto('http://127.0.0.1:31976', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && window.cyberduelAccount?.isAdmin && !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openSettingsDialog());
  await page.getByRole('button', { name: 'ADMIN', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Segurança X1', exact: true });
  await toggle.check(); await page.waitForFunction(() => window.cyberduelAccount.segurancaX1);
  await page.screenshot({ path: path.join(output, 'admin-toggle.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && window.cyberduelAccount?.segurancaX1 && !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
  checks.push('Toggle Segurança X1 no admin, salvo no servidor e preservado ao recarregar.');
  await arena(); await summon();
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').partida.partidaEncerrada);
  assert.equal(await page.evaluate(() => partida.inimigo.campo.cartas.filter(Boolean).length), 0);
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object => object.name === 'seguranca-x1-dragao'));
  animationStartedAt = Date.now() - recordingStartedAt;
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object => object.name === 'seguranca-x1-dragao' && object.alpha > .8));
  assert.equal(await page.evaluate(() => game.sound.getAll('somDragao').some(sound => sound.isPlaying)), true);
  await page.screenshot({ path: path.join(output, 'dragao-carga.png') });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.filter(object => object.name === 'seguranca-x1-fragmento' && object.active).length >= 12);
  assert.equal(await page.evaluate(() => game.sound.getAll('somExplosao').some(sound => sound.isPlaying)), true);
  await page.screenshot({ path: path.join(output, 'campo-explodindo.png') });
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').telaFinalExibida), false, 'Vitória aguarda a animação terminar.');
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
  assert.equal(await page.evaluate(() => partida.rodadasJogador), 4);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').children.list.filter(object => object.name?.startsWith('seguranca-x1-')).length), 0);
  await page.screenshot({ path: path.join(output, 'vitoria.png') });
  checks.push('Toques na mão/campo: dez cartas explodidas, incluindo terrenos e proteções; Dragão, fragmentos, vitória única e limpeza da animação.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  await arena(); await summon();
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').segurancaX1EmCurso?.fase === 'sobrecarga');
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').cameras.main.shakeEffect.isRunning), false);
  await page.screenshot({ path: path.join(output, 'movimento-reduzido.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').segurancaX1EmCurso?.fase === 'veredito');
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').children.list.some(object => object.name === 'seguranca-x1-fragmento')), false);
  await page.screenshot({ path: path.join(output, 'veredito-desktop.png') });
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').telaFinalExibida);
  checks.push('Movimento reduzido: sem tremores ou fragmentos; composição e veredito também conferidos em 1366×768.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  await arena(); await summon();
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').segurancaX1EmCurso?.fase === 'sobrecarga');
  await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.isActive('CenaEfeitos'));
  assert.equal(await page.evaluate(() => game.sound.getAll('somDragao').some(sound => sound.isPlaying)), false);
  checks.push('Sair durante a sobrecarga cancela a cena e interrompe os rugidos.');
  await page.evaluate(async () => {
    await window.cyberduelAccount.setSegurancaX1(false);
    game.scene.getScene('CenaJogo').scene.start('CenaTitulo');
  });
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  await arena(); await summon();
  await page.waitForFunction(() => partida.jogador.campo.cartas.includes(qaDragon));
  assert.equal(await page.evaluate(() => Boolean(partida.partidaEncerrada)), false);
  assert.equal(await page.evaluate(() => partida.inimigo.campo.cartas.filter(Boolean).length), 10);
  checks.push('Toggle desligado: invocação comum preserva o campo e não encerra a partida.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors, animationStartedAt }, null, 2));
  const video = page.video(); await context.close(); await video.saveAs(path.join(output, 'seguranca-x1.webm'));
  console.log(checks.join('\n'));
}
run().catch(async error => {
  console.error(error); console.error(errors);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png') });
    console.error(await page.evaluate(() => {
      const scene = game.scene.getScene('CenaJogo');
      return { active: scene.scene.isActive(), phase: scene.faseAtual, turn: scene.ehMeuTurno, locked: scene.travado,
        modal: scene.modalAberto, input: scene.input.enabled, canPlay: scene.podeJogarCartasAgora(),
        selected: scene.cartaMaoSelecionada?.dadosCarta?.nome, hand: scene.partida?.jogador.mao.cartas.map(card => card.nome),
        board: scene.partida?.jogador.campo.cartas.map(card => card?.nome), flag: cyberduelAccount.segurancaX1 };
    }));
  }
  process.exitCode = 1;
}).finally(async () => { await browser?.close(); server.kill(); });
