const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-deck-art-'));
const output = path.resolve('output/sindicato/deck-art');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], {
  env: { ...process.env, PORT: '31972', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser, page;
const errors = [], checks = [];
// Regiões importantes medidas nas artes originais, independentes do foco configurado.
const protectedRegions = {
  'RaspClay MonteCorp': [.32, .01, .72, .26],
  'O Boi': [.25, 0, .8, .35],
  'Estudante de Curso Técnico': [.25, .09, .49, .29],
  'H.A.R.V.I.S': [.4, .075, .63, .25],
  'HAL 9001': [.35, .15, .58, .31],
  'Montadores de Cabos': [.35, .19, .61, .37],
  'Refrigeradores de DataCenter': [.4, .18, .72, .36],
  'O Bom': [.26, .22, .74, .48],
  'A Ferreira': [.43, .13, .61, .33],
  'DeepClaude ChatGemini': [.25, .07, .78, .45],
  'Torre MonteCorp': [.4, .11, .59, .26],
  "Sen'Tenzhah, O Mau": [.4, .1, .73, .4],
};

async function inspect(image, card, surface, viewport) {
  await image.evaluate(img => img.decode());
  const geometry = await image.evaluate((img, card) => {
    const box = img.getBoundingClientRect(), frame = img.parentElement.getBoundingClientRect();
    const style = getComputedStyle(img);
    const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const artWidth = img.naturalWidth * scale, artHeight = img.naturalHeight * scale;
    const [x, y] = style.objectPosition.split(' ').map(value => parseFloat(value) / 100);
    const left = box.left + (box.width - artWidth) * x, top = box.top + (box.height - artHeight) * y;
    const region = card.region;
    return {
      loaded: img.naturalWidth > 0 && img.naturalHeight > 0,
      nativeWidth: img.naturalWidth, nativeHeight: img.naturalHeight,
      fit: style.objectFit, position: style.objectPosition, transform: style.transform,
      focused: Math.abs(x - card.focus.x) < .001 && Math.abs(y - card.focus.y) < .001,
      filled: style.objectFit === 'cover' && left <= frame.left + 1 && top <= frame.top + 1 &&
        left + artWidth >= frame.right - 1 && top + artHeight >= frame.bottom - 1,
      unobstructed: [[frame.left + frame.width / 2, frame.top + 4], [frame.left + frame.width / 2, frame.bottom - 4],
        [frame.left + 4, frame.top + frame.height / 2], [frame.right - 4, frame.top + frame.height / 2]].every(([x, y]) =>
        img.parentElement.contains(document.elementFromPoint(x, y))),
      subjectVisible: !region || (left + artWidth * region[0] >= frame.left - 1 &&
        left + artWidth * region[2] <= frame.right + 1 && top + artHeight * region[1] >= frame.top - 1 &&
        top + artHeight * region[3] <= frame.bottom + 1),
    };
  }, { ...card, region: protectedRegions[card.name] });
  checks.push({ name: card.name, surface, viewport, ...geometry });
}

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => {
      if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); }
    });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({ channel: 'chromium' });
  page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ masterVolume: 0 })));
  await page.goto('http://127.0.0.1:31972/?deck=1&renderer=canvas', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaDeckBuilder') &&
    document.querySelector('.deck-forge.is-ready'), null, { timeout: 120000 });
  // Termina as transições imediatamente para medir também o estado final do hover.
  await page.addStyleTag({ content: '.deck-forge, .deck-forge * { transition: none !important; animation: none !important; }' });
  const cards = await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.visibleCards().map(card => ({ key: card.key, name: card.nome, focus: card.foco })));
  assert.ok(cards.length >= 50, 'A auditoria deve incluir o catálogo inteiro, sem filtro de conta ou demo.');

  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.showMobileView('collection', { scroll: false }));
    for (const [index, card] of cards.entries()) {
      const article = page.locator(`[data-card-key=${JSON.stringify(card.key)}].forge-card`);
      const art = article.locator('.forge-card__art');
      await art.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.mouse.move(0, 0);
      await inspect(art.locator('img'), card, 'collection', viewport.width);
      await art.hover();
      await inspect(art.locator('img'), card, 'collection-hover', viewport.width);
      await art.screenshot({ path: path.join(output, `${viewport.width}-${index}-collection.png`) });
      await art.click();
      const detail = page.locator('.forge-detail');
      await detail.waitFor();
      await inspect(detail.locator('img'), card, 'detail', viewport.width);
      await detail.screenshot({ path: path.join(output, `${viewport.width}-${index}-detail.png`) });
      await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.closeModal(true));
    }
    await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').deckBuilderUI.showMobileView('deck', { scroll: false }));
    for (const [index, card] of cards.entries()) {
      await page.evaluate(key => {
        const ui = game.scene.getScene('CenaDeckBuilder').deckBuilderUI;
        ui.deckPanel.querySelector('.forge-deck-list').replaceChildren(ui.createDeckRow(ui.catalogByKey.get(key), 1));
      }, card.key);
      const preview = page.locator('.forge-deck-row__preview');
      await preview.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.mouse.move(0, 0);
      await inspect(preview.locator('img'), card, 'deck', viewport.width);
      await preview.hover();
      await inspect(preview.locator('img'), card, 'deck-hover', viewport.width);
      await preview.screenshot({ path: path.join(output, `${viewport.width}-${index}-deck.png`) });
    }
    console.log(`${viewport.width}px: ${cards.length} cartas verificadas individualmente na coleção, ficha e deck, incluindo hover.`);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ cards: cards.length, checks, errors }, null, 2));
  }
  const failures = checks.filter(check => !check.loaded || !check.filled || !check.focused || !check.unobstructed || !check.subjectVisible);
  assert.deepEqual(errors, []);
  assert.equal(failures.length, 0, `Arte cortada: ${JSON.stringify(failures)}`);
  console.log(`${checks.length} verificações passaram; capturas e relatório em ${output}.`);
}

run().catch(async error => {
  console.error(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') });
}).finally(async () => {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  fs.rmSync(dataDir, { recursive: true, force: true });
});
