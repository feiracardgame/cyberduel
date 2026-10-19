const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/sindicato/aprendizado');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-learning-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['AprendizadoQA']);
const accountsPath = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountsPath));
Object.assign(accounts.accounts[fixture.accountKey], { avatar: 'assets/fotosdeperfil/humba_brain_icon.png',
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] } });
fs.writeFileSync(accountsPath, JSON.stringify(accounts));
fs.mkdirSync(output, { recursive: true });
const port = process.env.LEARNING_TEST_PORT || '31981';
const server = spawn(process.execPath, ['scripts/dev-server.js'], { cwd: root, windowsHide: true,
  env: { ...process.env, PORT: port, DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
const errors = [], checks = [], screenshots = [];
const cases = new Set(process.argv.slice(2));
let browser, page;

async function openGame(viewport, reducedMotion = 'no-preference', record = false) {
  const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion,
    ...(record ? { recordVideo: { dir: output, size: viewport } } : {}) });
  await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta && window.cyberduelAccount?.user, null, { timeout: 120000 });
  await page.evaluate(async () => {
    if (!window.cyberduelAccount.faction) await window.cyberduelAccount.chooseFaction('raspcorp');
    window.cyberduelSettings.set('skipBattleAnnouncements', 1);
    const builder = window.cyberduelDeckBuilder, catalog = builder.getCatalog(), deckDebug = [];
    for (const [level, count] of [['baixa', 12], ['media', 6], ['alta', 2]]) {
      let remaining = count;
      for (const card of catalog.filter(card => card.nivel === level)) {
        const quantidade = Math.min(card.limite, remaining);
        if (quantidade) deckDebug.push({ tipo: card.tipo, nome: card.nome, quantidade });
        remaining -= quantidade;
      }
    }
    if (!builder.isValid(deckDebug)) throw Error('Deck temporário de teste inválido.');
    game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true, deckDebug });
  });
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));
  await page.evaluate(() => {
    window.cena = game.scene.getScene('CenaJogo');
    cena.time.removeAllEvents();
    const p = new Partida(null, true);
    for (const player of [p.jogador, p.inimigo]) {
      player.campo.cartas.fill(null); player.mao.cartas = []; player.deck.cartas = [];
    }
    let id = 87000;
    for (const [index, name] of [[0, 'Estudante de Curso Técnico'], [1, 'Professores de Duelo'], [2, 'Refrigeradores de DataCenter']]) {
      const base = POOL_CARTAS_MONSTRO.find(card => card.nome === name);
      p.jogador.campo.cartas[index] = new Carta(++id, base.poder, 'monstro', JSON.parse(JSON.stringify(base)));
    }
    cena.partida = window.partida = p;
    cena.faseAtual = p.fase = 'habilidades'; cena.ehMeuTurno = true; cena.travado = false;
    cena.avisoLocal = null; cena.prazoFaseLocal = Date.now() + 600000;
    cena.timerTurnoExpirado = false; cena.finalDebug = false;
    const effects = game.scene.getScene('CenaEfeitos');
    effects.ultimoEvento = 0; effects.exibidos = []; effects.fila = [];
    window.qaLearningSounds = []; window.qaLearningAudio = [];
    const play = effects.sound.play.bind(effects.sound);
    effects.sound.play = (key, options) => {
      const previous = effects.sound.getAll(key);
      const played = play(key, options);
      if (['somEstudante', 'somProfessores', 'somExplosao', 'somInteracao'].includes(key))
        qaLearningAudio.push(...effects.sound.getAll(key).filter(sound => !previous.includes(sound)));
      if (key === 'somEstudante') qaLearningSounds.push({ played,
        playing: effects.sound.getAll(key).some(sound => sound.isPlaying),
        encounter: effects.encontroEmCurso?.encontro || null });
      return played;
    };
    cena.desenharInterface(); cena.cameras.main.setAlpha(1);
  });
  await idle();
  return context;
}

async function idle() {
  await page.waitForFunction(() => !cena.efeitosVisuaisPendentes() && cena.input.enabled &&
    !cena.interfaceOcultaPorEfeitos, null, { timeout: 30000 });
}

async function tap(x, y, sceneName = 'CenaJogo') {
  const point = await page.evaluate(({ x, y, sceneName }) => {
    const camera = game.scene.getScene(sceneName).cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    const topLeft = camera.getWorldPoint(0, 0), bottomRight = camera.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - topLeft.x) / (bottomRight.x - topLeft.x) * rect.width,
      y: rect.top + (y - topLeft.y) / (bottomRight.y - topLeft.y) * rect.height };
  }, { x, y, sceneName });
  await page.touchscreen.tap(point.x, point.y);
}

async function slot(index) {
  const point = await page.evaluate(index => ({ x: cena.layout.x[index % 5],
    y: cena.layout.yJogador[Math.floor(index / 5)] }), index);
  await tap(point.x, point.y);
}

async function copyTeacher() {
  await page.waitForFunction(() => cena.children.list.some(object =>
    object.dadosCartaCampo === partida.jogador.campo.cartas[0] && object.scaleX === 1));
  await slot(0);
  await page.waitForFunction(() => cena.modalAberto && cena.painelDetalheAtual?.scaleX === 1 &&
    !cena.tweens.isTweening(cena.painelDetalheAtual));
  const button = await page.evaluate(() => {
    const walk = items => {
      for (const object of items) {
        if (object.name === 'ativar-habilidade' && object.input?.enabled) {
          const matrix = object.getWorldTransformMatrix();
          return { x: matrix.tx, y: matrix.ty, scene: object.scene.scene.key };
        }
        if (object.list) { const found = walk(object.list); if (found) return found; }
      }
    };
    for (const scene of game.scene.getScenes(true)) { const result = walk(scene.children.list); if (result) return result; }
  });
  assert.ok(button, 'Botão real de ativação disponível');
  await tap(button.x, button.y, button.scene);
  await page.waitForFunction(() => cena.objetosSelecaoAlvo?.length > 0 && !cena.modalAberto);
  await slot(1);
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').encontroEmCurso?.encontro === 'aprendizado');
  assert.deepEqual(await page.evaluate(() => {
    const card = partida.jogador.campo.cartas[0], effects = game.scene.getScene('CenaEfeitos');
    return { power: card.poder, learned: card.aprendizadoUsado, from: card.habilidadeAprendidaDe,
      action: card.efeito.acao, encounter: effects.eventoAtual.encontro,
      blocked: cena.efeitosBloqueiamInteracao(), studentSounds: qaLearningSounds.length };
  }), { power: 1, learned: true, from: 'Professores de Duelo', action: 'reativar',
    encounter: 'aprendizado', blocked: true, studentSounds: 0 });
}

async function phase(name) {
  await page.waitForFunction(name => game.scene.getScene('CenaEfeitos').encontroEmCurso?.faseEncontro === name, name);
}

async function capture(name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file }); screenshots.push(file);
}

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou.')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => process.stderr.write(data));
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    const label = viewport.width < 600 ? 'mobile' : 'desktop';
    if (cases.size && !cases.has(label)) continue;
    const context = await openGame(viewport, 'no-preference', label === 'mobile');
    await copyTeacher();
    await phase('transferencia');
    await page.waitForTimeout(180);
    const composition = await page.evaluate(() => {
      const panel = game.scene.getScene('CenaEfeitos').encontroEmCurso;
      const all = items => items.flatMap(object => [object, ...all(object.list || [])]);
      return all(panel.list).filter(object => object.texture).map(object => object.texture.key);
    });
    for (const key of ['encontroFelipe', 'encontroSarda', 'encontroAluno', 'fundoAprendizado'])
      assert.ok(composition.includes(key), `${label}: asset ${key} na composição`);
    await capture(`${label}-transferencia`);
    assert.deepEqual(await page.evaluate(() => {
      const effects = game.scene.getScene('CenaEfeitos'), current = effects.eventoAtual.id;
      const protector = partida.jogador.campo.cartas[2];
      const result = partida.ativarHabilidade(protector, partida.jogador, partida.inimigo, 0);
      if (!result.sucesso) throw Error('Habilidade de continuidade não ativou.');
      window.qaLearningQueue = { current, next: partida.eventosEfeito.at(-1).id };
      cena.apresentarEventosEfeito();
      return { current: effects.eventoAtual.id === current,
        queued: effects.fila.some(event => event.id === qaLearningQueue.next),
        waiting: !effects.exibidos.includes(qaLearningQueue.next), blocked: cena.efeitosBloqueiamInteracao() };
    }), { current: true, queued: true, waiting: true, blocked: true });
    await phase('assimilacao');
    await page.waitForTimeout(180); await capture(`${label}-assimilacao`);
    await phase('concluido');
    await page.waitForTimeout(180); await capture(`${label}-concluido`);
    await idle();
    assert.deepEqual(await page.evaluate(() => {
      const effects = game.scene.getScene('CenaEfeitos');
      return { encounter: effects.encontroEmCurso, continued: effects.exibidos.includes(qaLearningQueue.next),
        originalOnce: effects.exibidos.filter(id => id === qaLearningQueue.current).length,
        sounds: qaLearningSounds, leftovers: effects.children.list.filter(object => object.name?.startsWith('aprendizado-')).length,
        blocked: cena.efeitosBloqueiamInteracao(), input: cena.input.enabled };
    }), { encounter: null, continued: true, originalOnce: 1,
      sounds: [{ played: true, playing: true, encounter: null }], leftovers: 0, blocked: false, input: true });
    const video = page.video();
    await context.close();
    if (video) { await video.saveAs(path.join(output, `${label}.webm`)); await video.delete(); }
    checks.push(`${label}: seleção real, três personagens, fundo, cópia permanente, custo de 2 PA, fila e retorno.`);
    console.log(checks.at(-1));
  }
  if (!cases.size || cases.has('reduced')) {
    const context = await openGame({ width: 390, height: 844 }, 'reduce');
    await copyTeacher();
    await page.waitForFunction(() => ['aprendizado-sarda', 'aprendizado-felipe', 'aprendizado-aluno'].every(name =>
      game.scene.getScene('CenaEfeitos').encontroEmCurso?.list.some(object => object.name === name && object.alpha > .95)));
    await capture('mobile-reduced');
    assert.equal(await page.evaluate(() => cena.cameras.main.shakeEffect.isRunning), false);
    await idle();
    assert.equal(await page.evaluate(() => qaLearningSounds.length), 1);
    await context.close();
    checks.push('Movimento reduzido: composição visível, sem tremor, efeito retomado uma vez.');
  }
  if (!cases.size || cases.has('cleanup')) {
    const context = await openGame({ width: 390, height: 844 });
    await copyTeacher(); await phase('transferencia');
    await page.evaluate(() => {
      window.qaStoppedLearning = game.scene.getScene('CenaEfeitos');
      window.qaStoppedPanel = qaStoppedLearning.encontroEmCurso;
      cena.scene.start('CenaTitulo');
    });
    await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.isActive('CenaEfeitos'));
    await page.waitForTimeout(7500);
    assert.deepEqual(await page.evaluate(() => ({ encounter: qaStoppedLearning.encontroEmCurso,
      active: qaStoppedPanel.active, children: qaStoppedLearning.children.list.length,
      studentSounds: qaLearningSounds.length, playing: qaLearningAudio.some(sound => sound.isPlaying) })),
    { encounter: null, active: false, children: 0, studentSounds: 0, playing: false });
    await context.close();
    checks.push('Saída durante a transferência: painel destruído e timers não retomam o efeito.');
  }
  assert.deepEqual(errors, [], 'Sem erros JavaScript no navegador');
  for (const name of fs.readdirSync(output)) if (name === 'failure.png' || /^page@.*\.webm$/.test(name))
    fs.unlinkSync(path.join(output, name));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors, screenshots }, null, 2));
  console.log(`Capturas e vídeo: ${output}`);
}

run().catch(async error => {
  if (page && !page.isClosed()) await capture('failure').catch(() => {});
  console.error(error); console.error(errors); process.exitCode = 1;
}).finally(async () => {
  await browser?.close(); server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  assert.ok(path.dirname(dataDir) === os.tmpdir() && path.basename(dataDir).startsWith('cyberduel-learning-'));
  fs.rmSync(dataDir, { recursive: true, force: true });
});
