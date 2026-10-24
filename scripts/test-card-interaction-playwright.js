const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-card-interaction-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['CardInteractionQA']);
const accountFile = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountFile));
Object.assign(accounts.accounts[fixture.accountKey], {
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] },
});
fs.writeFileSync(accountFile, JSON.stringify(accounts));
const port = process.env.CARD_INTERACTION_TEST_PORT || '31969';
const base = `http://127.0.0.1:${port}`;
const output = path.resolve('output/sindicato/card-interaction');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: port, DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
const errors = [], checks = [];
let browser, page, touch;

async function frame() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function screenPoint(point) {
  return page.evaluate(({ x, y }) => {
    const scene = game.scene.getScene('CenaJogo'), rect = game.canvas.getBoundingClientRect();
    const top = scene.cameras.main.getWorldPoint(0, 0);
    const bottom = scene.cameras.main.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - top.x) / (bottom.x - top.x) * rect.width,
      y: rect.top + (y - top.y) / (bottom.y - top.y) * rect.height };
  }, point);
}

async function tap(point) {
  const screen = await screenPoint(point);
  await page.touchscreen.tap(screen.x, screen.y);
  await frame();
}

async function cardPoint(side = 'jogador', index = 5, hand = false) {
  return page.evaluate(({ side, index, hand }) => {
    const s = game.scene.getScene('CenaJogo');
    const card = hand ? s.partida.jogador.mao.cartas[0] : s.partida[side].campo.cartas[index];
    const object = s.children.list.find(o => hand ? o.dadosCarta === card : o.dadosCartaCampo === card);
    return { x: object.x, y: object.y };
  }, { side, index, hand });
}

async function setup(options = {}) {
  await page.evaluate(options => {
    const s = game.scene.getScene('CenaJogo');
    if (s.modalAberto) s.fecharDetalheCarta(true);
    s.cancelarSelecaoDeAlvo(); s.time.removeAllEvents();
    s.executarFaseSolo = () => {};
    const p = new Partida(null, true);
    for (const owner of [p.jogador, p.inimigo]) {
      owner.campo.cartas.fill(null); owner.mao.cartas = []; owner.cartasRecemCompradas = [];
    }
    const make = (name, id) => {
      const model = POOL_CARTAS_MONSTRO.find(card => card.nome === name);
      return new Carta(id, model.poder, 'monstro', JSON.parse(JSON.stringify(model)));
    };
    const source = make(options.name || 'O Rato', 98000);
    source.usadaEsteTurno = !!options.used;
    p.jogador.campo.cartas[options.index ?? 5] = source;
    p.inimigo.campo.cartas[options.index ?? 5] = make(options.enemyAbility ? 'O Rato' : 'O Cão', 98001);
    p.jogador.mao.cartas = [make('O Porco', 98002)];
    window.qaSource = source; window.qaTarget = p.inimigo.campo.cartas[options.index ?? 5];
    s.partida = window.partida = p;
    s.faseAtual = p.fase = options.phase || 'habilidades';
    s.ehMeuTurno = options.myTurn !== false; s.travado = !s.ehMeuTurno;
    s.avisoLocal = null; s.avisoInicialPendente = false;
    s.prazoFaseLocal = Date.now() + 600000; s.timerTurnoExpirado = false;
    s.maoEscondida = false; s.animacaoRemotaEmCurso = false;
    const effects = game.scene.getScene('CenaEfeitos');
    effects.ultimoEvento = 0; effects.exibidos = []; effects.fila = [];
    s.desenharInterface(); s.cameras.main.setAlpha(1);
  }, options);
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.input.enabled && !s.efeitosVisuaisPendentes() && s.children.list.some(o =>
      o.dadosCartaCampo === qaSource && o.visible && o.scaleX === 1 && !s.tweens.isTweening(o));
  });
  await page.mouse.move(0, 0);
  await frame();
}

async function selected() {
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.cartaCampoSelecionada?.dadosCartaCampo === qaSource &&
      s.botaoHabilidadeCampo?.visible && !s.tweens.isTweening(s.cartaCampoSelecionada);
  });
}

async function hold(point, mobile, move = false) {
  const screen = await screenPoint(point);
  if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...screen, id: 0 }] });
  else { await page.mouse.move(screen.x, screen.y); await page.mouse.down(); }
  if (move) {
    const moved = { x: screen.x + 30, y: screen.y };
    if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...moved, id: 0 }] });
    else await page.mouse.move(moved.x, moved.y, { steps: 4 });
  }
  await page.waitForTimeout(520);
  const opened = await page.evaluate(() => !!game.scene.getScene('CenaJogo').modalAberto);
  assert.equal(opened, !move, `${mobile ? 'Toque' : 'Mouse'}: segurar ${move ? 'com movimento cancela' : 'abre'} a ficha.`);
  if (mobile) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
  await frame();
  assert.deepEqual(await page.evaluate(() => {
    const s = game.scene.getScene('CenaJogo');
    return { modal: !!s.modalAberto, zoom: !!s.zoomAberto };
  }), { modal: !move, zoom: false }, 'Soltar preserva o resultado do gesto e não abre zoom.');
  if (!move) await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.painelDetalheAtual?.scaleX === 1 && !s.tweens.isTweening(s.painelDetalheAtual);
  });
}

async function testViewport(viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  await context.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ skipBattleAnnouncements: 1, animatedBackground: 0, masterVolume: 0 }));
  }, fixture.token);
  page = await context.newPage(); page.setDefaultTimeout(25000);
  touch = await context.newCDPSession(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta && cyberduelAccount.user, null, { timeout: 120000 });
  await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true }));
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));

  await setup();
  let point = await cardPoint();
  const screen = await screenPoint(point);
  await page.mouse.move(screen.x, screen.y); await page.waitForTimeout(520);
  assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').modalAberto), false, 'Hover não abre a ficha.');
  await tap(point); await selected();
  assert.deepEqual(await page.evaluate(() => {
    const s = game.scene.getScene('CenaJogo'), card = s.cartaCampoSelecionada;
    return { modal: !!s.modalAberto, raised: card.y < card.posCampoOriginal.y,
      scale: card.scaleX > 1 && card.scaleY > 1, button: s.botaoHabilidadeCampo.name };
  }), { modal: false, raised: true, scale: true, button: 'ativar-habilidade-campo' });
  await page.screenshot({ path: path.join(output, `selection-${viewport.width}.png`) });
  const tiltPoint = await page.evaluate(() => {
    const s = game.scene.getScene('CenaJogo'), card = s.cartaCampoSelecionada;
    return { x: card.posCampoOriginal.x + card.width * 0.55, y: card.posCampoOriginal.y - card.height * 0.25 };
  });
  const tiltScreen = await screenPoint(tiltPoint);
  await page.mouse.move(tiltScreen.x, tiltScreen.y, { steps: 5 });
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.cartaCampoSelecionada?.angle > -1 && !s.tweens.isTweening(s.cartaCampoSelecionada);
  });
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').modalAberto), false);
  await page.screenshot({ path: path.join(output, `selection-tilt-${viewport.width}.png`) });
  await page.mouse.move(0, 0);
  await selected();
  await tap(await cardPoint()); await selected();
  assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').modalAberto), false, 'Repetir clique mantém a seleção sem ficha.');
  const initial = await page.evaluate(() => ({ source: qaSource.poder, target: qaTarget.poder }));
  await tap(await page.evaluate(() => {
    const button = game.scene.getScene('CenaJogo').botaoHabilidadeCampo;
    return { x: button.x, y: button.y };
  }));
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return !s.modalAberto && s.objetosSelecaoAlvo?.length > 0;
  });
  await tap(await cardPoint('inimigo'));
  await page.waitForFunction(() => qaSource.usadaEsteTurno && qaSource.poder > 2);
  assert.deepEqual(await page.evaluate(() => ({ source: qaSource.poder, target: qaTarget.poder })),
    { source: initial.source + 2, target: initial.target - 2 }, 'Bolinha e alvo resolvem a habilidade real.');
  await page.waitForFunction(() => !game.scene.getScene('CenaJogo').efeitosVisuaisPendentes(), null, { timeout: 45000 });

  for (const [label, options, enemy] of [
    ['turno adversário', { myTurn: false }], ['habilidade usada', { used: true }],
    ['carta passiva', { name: 'O Porco' }], ['carta inimiga', { enemyAbility: true }, true],
    ['fase de colocar', { phase: 'colocar' }],
  ]) {
    await setup(options);
    await tap(await cardPoint(enemy ? 'inimigo' : 'jogador'));
    await frame();
    assert.equal(await page.evaluate(() => {
      const s = game.scene.getScene('CenaJogo');
      return !!s.botaoHabilidadeCampo?.visible;
    }), false, `${label}: sem botão disponível.`);
    assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').objetosSelecaoAlvo?.length), false,
      `${label}: nenhuma habilidade ativada.`);
  }

  await setup(); await tap(await cardPoint()); await selected();
  const staleButton = await page.evaluate(() => {
    const s = game.scene.getScene('CenaJogo'), button = s.botaoHabilidadeCampo;
    s.ehMeuTurno = false; s.travado = true;
    return { x: button.x, y: button.y };
  });
  await tap(staleButton);
  assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').objetosSelecaoAlvo?.length), false,
    'Mudar de turno depois de selecionar impede ativação pelo botão antigo.');

  for (const mobile of [false, true]) {
    await setup(); await hold(await cardPoint(), mobile);
    await setup(); await hold(await cardPoint(), mobile, true);
  }
  await setup({ phase: 'colocar' });
  await tap(await cardPoint('jogador', 5, true));
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.cartaMaoSelecionada && !s.tweens.isTweening(s.cartaMaoSelecionada);
  });
  await tap(await cardPoint('jogador', 5, true));
  assert.equal(await page.evaluate(() => !!game.scene.getScene('CenaJogo').modalAberto), false, 'Dois cliques na mão não abrem ficha.');
  await hold(await cardPoint('jogador', 5, true), false);
  await setup({ phase: 'colocar' });
  await hold(await cardPoint('jogador', 5, true), true, true);

  await setup({ index: 9 }); await tap(await cardPoint('jogador', 9)); await selected();
  const edge = await page.evaluate(() => {
    const s = game.scene.getScene('CenaJogo'), button = s.botaoHabilidadeCampo;
    const bounds = button.getBounds();
    return { left: bounds.left, right: bounds.right, width: LARGURA_LAYOUT,
      buttonX: button.x, cardX: s.cartaCampoSelecionada.x };
  });
  assert.ok(edge.left >= 0 && edge.right <= edge.width, 'Bolinha da última coluna cabe no campo.');
  assert.ok(edge.buttonX < edge.cardX, 'Última coluna posiciona a bolinha à esquerda.');
  await page.screenshot({ path: path.join(output, `last-column-${viewport.width}.png`) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(); await tap(await cardPoint()); await selected();
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').cartaCampoSelecionada.angle), 0,
    'Movimento reduzido mantém a carta estável e a habilidade disponível.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push(`${viewport.width}x${viewport.height}: clique, relevo, repetição, hover, habilidade, bloqueios, segurar mouse/toque, movimento, mão e última coluna.`);
  console.log(checks.at(-1));
  await context.close(); page = null;
}

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou.')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => process.stderr.write(data));
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  const response = await fetch(base + '/api/account/faction', { method: 'POST',
    headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ faction: 'echossystem' }) });
  assert.equal(response.status, 200);
  browser = await chromium.launch({
    channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) await testViewport(viewport);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
}

run().catch(async error => {
  console.error(error);
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    console.error(await page.evaluate(() => {
      const s = game.scene.getScene('CenaJogo');
      return { phase: s?.faseAtual, modal: s?.modalAberto, locked: s?.travado, gesture: !!s?.gestoInspecaoCarta,
        selected: s?.cartaCampoSelecionada?.dadosCartaCampo?.nome, button: s?.botaoHabilidadeCampo?.visible,
        canRead: s?.podeConsultarCartas(), effects: s?.efeitosVisuaisPendentes(),
        source: { power: qaSource.poder, used: qaSource.usadaEsteTurno },
        target: { power: qaTarget.poder }, selection: s?.objetosSelecaoAlvo?.length };
    }).catch(() => ({})));
  }
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  if (path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dataDir, { recursive: true, force: true });
});
