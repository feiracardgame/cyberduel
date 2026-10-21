const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-keyboard-'));
const [user] = require('../test/account-fixture')(dataDir, ['KeyboardQA']);
const file = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
store.accounts[user.accountKey].tutorial = {
  introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [],
};
fs.writeFileSync(file, JSON.stringify(store));
const base = 'http://127.0.0.1:31967';
const output = path.resolve('output/sindicato/keyboard');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server/server.js'], {
  env: { ...process.env, PORT: '31967', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser, page;
const errors = [], checks = [];

async function keyboard(height, top = 0) {
  await page.evaluate(({ height, top }) => {
    window.qaKeyboard = height ? { height, top } : null;
    visualViewport.dispatchEvent(new Event('resize'));
    visualViewport.dispatchEvent(new Event('scroll'));
  }, { height, top });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function checkField(label, screenshot, height = 410, top = 0) {
  const input = page.getByLabel(label, { exact: true });
  await input.focus();
  await keyboard(height, top);
  await page.waitForTimeout(250);
  const bounds = await input.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height, focused: document.activeElement === node,
      hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === node };
  });
  await page.screenshot({ path: path.join(output, screenshot + '.png') });
  assert.ok(bounds.focused && bounds.height > 0 && bounds.top >= top - 1 && bounds.bottom <= top + height + 1 && bounds.hit,
    `${label}: campo precisa ficar inteiro acima do teclado. ${JSON.stringify(bounds)}`);
  checks.push(`${label}: visível e editável com ${height}px livres e deslocamento ${top}px.`);
}

async function closeTitleModal() {
  await keyboard(null);
  await page.evaluate(() => {
    document.activeElement?.blur();
    game.scene.getScene('CenaTitulo').titleUI.closeModal(true);
  });
}

(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  const response = await fetch(base + '/api/account/faction', {
    method: 'POST', headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ faction: 'raspcorp' }),
  });
  assert.equal(response.status, 200);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    const viewport = window.visualViewport;
    for (const [key, stateKey] of [['height', 'height'], ['offsetTop', 'top']]) {
      const native = Object.getOwnPropertyDescriptor(VisualViewport.prototype, key).get.bind(viewport);
      Object.defineProperty(viewport, key, { get: () => window.qaKeyboard?.[stateKey] ?? native() });
    }
  }, user.token);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    window.cyberduelAccount?.user && !game.scene.getScene('CenaTitulo').restaurandoConta);

  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openProfileScreen());
  await checkField('Apelido', 'apelido');
  await closeTitleModal();
  await page.evaluate(() => {
    const ui = game.scene.getScene('CenaTitulo').titleUI;
    ui.callbacks.onJoinRoom = code => { window.qaSubmittedCode = code; };
    ui.openRoomDialog('join');
  });
  await checkField('Código da sala', 'codigo');
  await page.getByLabel('Código da sala', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'ENTRAR NA SALA', exact: true }).tap();
  assert.equal(await page.evaluate(() => window.qaSubmittedCode), '123456', 'Confirmar continua funcionando com o teclado aberto.');
  await keyboard(null);

  await page.evaluate(() => {
    window.qaDialogue = showElenAI(game.scene.getScene('CenaTitulo'),
      [{ sprite: 4, speaker: 'ElenAI', text: 'Como você quer ser chamado?' }], () => {}, { name: async () => {} });
  });
  await checkField('Seu apelido', 'elenai');
  await page.evaluate(() => window.qaDialogue.dispose());
  await keyboard(null);

  await page.evaluate(() => cyberduelNameGuard.show({ username: true, nickname: true }, { preview: true }));
  await checkField('NOVO NICK ÚNICO', 'nick', 350, 30);
  await checkField('NOVO APELIDO', 'novo-apelido', 350, 30);
  await page.evaluate(() => cyberduelNameGuard.close());
  await keyboard(null);

  await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaDeckBuilder'));
  await page.waitForFunction(() => game.scene.isActive('CenaDeckBuilder') && game.scene.getScene('CenaDeckBuilder').deckBuilderUI?.root);
  await checkField('Buscar na coleção', 'busca');
  await keyboard(null);
  await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.openSavedBuilds());
  await checkField('Nome da build', 'build');
  await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
  await page.setViewportSize({ width: 844, height: 390 });
  await checkField('Nome da build', 'build-paisagem', 220, 12);
  await keyboard(null);
  assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viewport-height'))), 390);
  assert.deepEqual(errors, []);
  console.log('Teclado simulado: perfil, código, ElenAI, nomes, busca, build, confirmação e rotação aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  const stopped = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await stopped;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
