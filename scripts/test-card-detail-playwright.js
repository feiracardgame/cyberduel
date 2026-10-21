const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-card-detail-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['CardDetailQA']);
const accountFile = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountFile));
accounts.accounts[fixture.accountKey].tutorial = {
  introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [],
};
fs.writeFileSync(accountFile, JSON.stringify(accounts));
const base = 'http://127.0.0.1:31968';
const output = path.resolve('output/sindicato/card-detail');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], {
  env: { ...process.env, PORT: '31968', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser, page;
const errors = [], checks = [];

async function tapWorld(x, y) {
  const point = await screenPoint(x, y);
  await page.touchscreen.tap(point.x, point.y);
}

async function screenPoint(x, y) {
  return page.evaluate(({ x, y }) => {
    const scene = game.scene.getScene('CenaJogo'), rect = game.canvas.getBoundingClientRect();
    const top = scene.cameras.main.getWorldPoint(0, 0);
    const bottom = scene.cameras.main.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - top.x) / (bottom.x - top.x) * rect.width,
      y: rect.top + (y - top.y) / (bottom.y - top.y) * rect.height };
  }, { x, y });
}

async function openCard(name, tipo = 'monstro', options = {}) {
  await page.evaluate(({ name, tipo, options }) => {
    const scene = game.scene.getScene('CenaJogo');
    scene.fecharDetalheCarta(true);
    const pool = tipo === 'efeito' ? POOL_CARTAS_EFEITO : tipo === 'terreno' ? POOL_CARTAS_TERRENO : POOL_CARTAS_MONSTRO;
    const model = pool.find(card => card.nome === name);
    const card = new Carta(91000, model.poder || 0, tipo, JSON.parse(JSON.stringify(model)));
    Object.assign(card, options);
    window.qaDetailCard = card;
    scene.partida.jogador.campo.cartas.fill(null);
    scene.partida.jogador.campo.cartas[5] = card;
    const target = POOL_CARTAS_MONSTRO.find(card => card.nome === 'O Porco');
    scene.partida.inimigo.campo.cartas.fill(null);
    scene.partida.inimigo.campo.cartas[5] = new Carta(91001, target.poder, 'monstro', target);
    scene.mostrarDetalheCarta(card);
  }, { name, tipo, options });
  await page.waitForFunction(() => {
    const scene = game.scene.getScene('CenaJogo');
    return scene.modalAberto && scene.painelDetalheAtual?.scaleX === 1 && !scene.tweens.isTweening(scene.painelDetalheAtual);
  });
}

async function inspect() {
  return page.evaluate(() => {
    const scene = game.scene.getScene('CenaJogo');
    const flatten = nodes => nodes.flatMap(node => [node, ...(node.list ? flatten(node.list) : [])]);
    const nodes = flatten(scene.painelDetalheAtual.list);
    const image = nodes.find(node => node.texture?.key === qaDetailCard.imagem);
    const type = nodes.find(node => node.name === 'ficha-tipo');
    const power = nodes.find(node => node.name === 'ficha-poder');
    const textArea = nodes.find(node => node.name === 'ficha-textos');
    const panel = scene.painelDetalheAtual, background = panel.list[0];
    const bounds = { left: panel.x - background.width / 2, right: panel.x + background.width / 2,
      top: panel.y - background.height / 2, bottom: panel.y + background.height / 2 };
    return {
      cropped: image?.isCropped, ratio: image && image.displayWidth / image.displayHeight,
      nativeRatio: image && image.width / image.height,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
      world: { width: LARGURA_LAYOUT, height: ALTURA_LAYOUT },
      texts: nodes.filter(node => typeof node.text === 'string').map(node => ({ name: node.name, text: node.text, color: node.style.color, fontStyle: node.style.fontStyle })),
      parts: qaDetailCard.partesDescricao(), type: type?.text, power: power?.text,
      scroll: !!scene.handlersScrollDescAtual, textY: textArea?.y,
      ability: nodes.find(node => node.name === 'ativar-habilidade')?.input?.enabled || false,
    };
  });
}

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  const response = await fetch(base + '/api/account/faction', { method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ faction: 'raspcorp' }) });
  assert.equal(response.status, 200);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ skipBattleAnnouncements: 1, animatedBackground: 0, masterVolume: 0 }));
  }, fixture.token);
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta && cyberduelAccount.user, null, { timeout: 120000 });
  await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true }));
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));
  await page.evaluate(() => {
    const scene = game.scene.getScene('CenaJogo');
    scene.executarFaseSolo = () => {}; scene.time.removeAllEvents();
    scene.avisoLocal = null; scene.avisoInicialPendente = false; scene.ehMeuTurno = true; scene.travado = false;
    scene.prazoFaseLocal = Date.now() + 600000; scene.timerTurnoExpirado = false;
    scene.faseAtual = scene.partida.fase = 'habilidades'; scene.cameras.main.setAlpha(1);
  });
  for (const [name, tipo, category, slug] of [
    ['HAL 9001', 'monstro', 'PERSONAGEM / MÉDIA', 'media'],
    ['O Rato', 'monstro', 'PERSONAGEM / BAIXA', 'baixa'],
    ['Dragão das Comunicações Móveis', 'monstro', 'PERSONAGEM / ALTA', 'alta'],
    ['Gestor de Recursos Predominantemente Humanos', 'monstro', 'PERSONAGEM / MÉDIA', 'nome-longo'],
    ['Você Parece Sozinho', 'efeito', 'CARTA DE EFEITO', 'efeito'],
    ['Saloon', 'terreno', 'CARTA DE TERRENO', 'terreno'],
  ]) {
    await openCard(name, tipo);
    await page.screenshot({ path: path.join(output, `modal-${slug}.png`) });
    const detail = await inspect();
    assert.equal(detail.cropped, false, `${name}: imagem inteira, sem recorte.`);
    assert.ok(Math.abs(detail.ratio - detail.nativeRatio) < .001, `${name}: proporção original preservada.`);
    assert.equal(detail.type, category);
    const expectedPower = await page.evaluate(() => `${qaDetailCard.poder} PA`);
    assert.equal(detail.power, tipo === 'monstro' ? expectedPower : '— PA');
    assert.ok(detail.bounds.left >= 0 && detail.bounds.right <= detail.world.width && detail.bounds.top >= 0 && detail.bounds.bottom <= detail.world.height, `${name}: ficha cabe na tela.`);
    for (const part of detail.parts) assert.ok(detail.texts.some(node => node.text === part.texto), `${name}: conteúdo completo preservado.`);
    const effect = detail.texts.find(node => node.name === 'ficha-efeito');
    const description = detail.texts.find(node => node.name === 'ficha-descricao');
    assert.ok(effect && description && effect.color !== description.color && effect.fontStyle !== description.fontStyle, 'Descrição e efeito têm tratamentos distintos.');
    if (detail.scroll) {
      const world = await page.evaluate(() => {
        const scene = game.scene.getScene('CenaJogo');
        const area = scene.painelDetalheAtual.list.find(node => node.name === 'ficha-controles-scroll').list[0];
        const bounds = area.getBounds(); return { x: bounds.centerX, y: bounds.centerY };
      });
      const point = await screenPoint(world.x, world.y);
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, 2000);
      await page.waitForFunction(y => game.scene.getScene('CenaJogo').painelDetalheAtual.list.find(node => node.name === 'ficha-textos').y < y, detail.textY);
      await page.screenshot({ path: path.join(output, `descricao-${slug}.png`) });
    }
    checks.push(`${name}: arte inteira, categoria, descrição e efeito conferidos.`);
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => cyberduelSettings.set('textScale', 1.35));
    await openCard('Gestor de Recursos Predominantemente Humanos');
    const detail = await inspect();
    assert.equal(detail.cropped, false);
    const geometry = await page.evaluate(() => {
      const scene = game.scene.getScene('CenaJogo'), nodes = scene.painelDetalheAtual.list;
      const title = nodes.find(node => node.name === 'ficha-nome').getBounds();
      const category = nodes.find(node => node.name === 'ficha-tipo').getBounds();
      const power = nodes.find(node => node.name === 'ficha-poder').getBounds();
      return { titleFits: title.left >= 0 && title.right <= LARGURA_LAYOUT && title.bottom < category.top,
        statsFit: category.right < power.left };
    });
    assert.equal(geometry.titleFits, true); assert.equal(geometry.statsFit, true);
    await page.screenshot({ path: path.join(output, `modal-${viewport.width}-texto-ampliado.png`) });
  }
  checks.push('320×568 e 1366×768: nome longo e atributos cabem com texto em 135%.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => cyberduelSettings.set('textScale', 1.12));
  await openCard('O Rato', 'monstro', { imagem: null, efeito: null, habilidadeAtiva: false });
  let detail = await inspect();
  assert.ok(detail.texts.some(node => node.text === 'ILUSTRAÇÃO INDISPONÍVEL'));
  assert.ok(detail.texts.some(node => node.text === 'Esta carta não possui efeito.'));
  await openCard('O Rato', 'monstro', { poder: 12, capturadaPor: 42 });
  detail = await inspect();
  assert.equal(detail.power, '12 PA');
  assert.equal(detail.ability, false);
  assert.ok(detail.texts.some(node => node.text.startsWith('HABILIDADE BLOQUEADA')));
  await openCard('HAL 9001', 'monstro', { usadaEsteTurno: true });
  detail = await inspect();
  assert.equal(detail.ability, false); assert.ok(detail.texts.some(node => node.text === 'Habilidade já usada'));
  checks.push('PA atual, arte ausente, ausência de efeito, captura e habilidade já usada preservados.');

  await openCard('O Rato');
  const art = await page.evaluate(() => {
    const panel = game.scene.getScene('CenaJogo').painelDetalheAtual;
    const group = panel.list.find(node => node.list?.some(child => child.name === 'ficha-imagem'));
    const matrix = group.getWorldTransformMatrix(); return { x: matrix.tx, y: matrix.ty };
  });
  await tapWorld(art.x, art.y);
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').zoomAberto);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), true);
  const zoom = await page.evaluate(() => {
    const panel = game.scene.getScene('CenaJogo').painelZoomAtual;
    const image = panel.list.find(node => node.type === 'Image');
    return { x: panel.x + image.displayWidth * .25, y: panel.y + image.displayHeight * .25 };
  });
  await tapWorld(zoom.x, zoom.y);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').zoomAberto), true, 'Tocar na arte mantém o zoom aberto.');
  await tapWorld(20, 40);
  await page.waitForFunction(() => !game.scene.getScene('CenaJogo').zoomAberto);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), true, 'Fechar o zoom mantém a ficha.');
  await tapWorld(20, 40);
  await page.waitForFunction(() => !game.scene.getScene('CenaJogo').modalAberto);
  assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').handlersScrollDescAtual), false);
  checks.push('Toque na arte abre o zoom; fechar o zoom mantém a ficha; fechar a ficha limpa a rolagem.');

  await openCard('RaspClay MonteCorp');
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').tweensLendariaAtual.length), 3);
  await page.screenshot({ path: path.join(output, 'modal-lendaria-preservada.png') });
  checks.push('Ficha lendária mantém a apresentação e as animações existentes.');

  await openCard('HAL 9001');
  const button = await page.evaluate(() => {
    const node = game.scene.getScene('CenaJogo').painelDetalheAtual.list.find(node => node.name === 'ativar-habilidade');
    const matrix = node.getWorldTransformMatrix(); return { x: matrix.tx, y: matrix.ty };
  });
  await tapWorld(button.x, button.y);
  await page.waitForFunction(() => !game.scene.getScene('CenaJogo').modalAberto && game.scene.getScene('CenaJogo').objetosSelecaoAlvo?.length);
  checks.push('Botão de habilidade fecha a ficha e inicia a seleção de alvo.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(checks.join('\n'));
}
run().catch(async error => {
  console.error(error);
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') });
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  fs.rmSync(dataDir, { recursive: true, force: true });
});
