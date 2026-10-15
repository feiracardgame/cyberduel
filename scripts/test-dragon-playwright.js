const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const port = 31979;
const output = path.resolve('output/sindicato/dragon-awakening');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-dragon-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['DragonQA']);
const accountsPath = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountsPath));
Object.assign(accounts.accounts[fixture.accountKey], {
  avatar: 'assets/fotosdeperfil/humba_brain_icon.png',
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] },
});
fs.writeFileSync(accountsPath, JSON.stringify(accounts));
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
const errors = [], checks = [], screenshots = [];
const selectedCases = new Set(process.argv.slice(2));
let browser;

async function openGame(viewport, video = false) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600,
    ...(video ? { recordVideo: { dir: output, size: viewport } } : {}) });
  await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta && window.cyberduelAccount?.user, null, { timeout: 120000 });
  await page.waitForFunction(() => window.cyberduelAccount.faction || document.querySelector('.title-faction-dialog'));
  if (await page.locator('.title-faction-dialog').count()) {
    await page.locator('.title-faction--raspcorp').click();
    await page.waitForFunction(() => window.cyberduelAccount.faction === 'raspcorp' &&
      !game.scene.getScene('CenaTitulo').titleUI.modal);
  }
  await page.evaluate(() => {
    window.cyberduelSettings.set('skipBattleAnnouncements', 1);
    window.qaDragonSounds = [];
    const play = game.sound.play.bind(game.sound);
    game.sound.play = (key, options) => {
      const result = play(key, options);
      if (key === 'somDragao') window.qaDragonSounds.push({ played: result,
        playing: game.sound.getAll(key).some(sound => sound.isPlaying),
        phase: game.scene.getScene('CenaEfeitos').despertarDragaoEmCurso?.fase });
      return result;
    };
    game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true });
  });
  await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));
  return { context, page };
}

async function awaken(page, trigger) {
  return page.evaluate(trigger => {
    const scene = game.scene.getScene('CenaJogo');
    scene.time.removeAllEvents();
    const p = new Partida(null, true);
    for (const player of [p.jogador, p.inimigo]) {
      player.campo.cartas.fill(null); player.mao.cartas = []; player.deck.cartas = [];
    }
    let id = 85000;
    const make = name => {
      const base = POOL_CARTAS_MONSTRO.find(card => card.nome === name);
      return new Carta(++id, base.poder, 'monstro', JSON.parse(JSON.stringify(base)));
    };
    const dragon = make('Dragão das Comunicações Móveis');
    p.jogador.campo.adicionarCarta(dragon, 1);
    if (/Memórias/.test(dragon.descricaoCompleta())) throw Error('Segredo revelado antes do despertar.');
    window.qaDragon = dragon;
    window.qaDragonSounds = [];
    scene.partida = window.partida = p;
    scene.faseAtual = p.fase = trigger === 'boi' ? 'habilidades' : 'colocar';
    scene.ehMeuTurno = true; scene.travado = false;
    const effects = game.scene.getScene('CenaEfeitos');
    effects.ultimoEvento = 0; effects.fila = []; effects.exibidos = [];
    if (trigger === 'boi') {
      const boi = make('O Boi'); p.jogador.campo.adicionarCarta(boi, 0);
      if (!p.ativarHabilidade(boi, p.jogador, p.inimigo, 1).sucesso) throw Error('Boi não ativou.');
    } else {
      for (const [index, name] of [[2, 'O Rato'], [3, 'A Ferreira'], [4, 'HAL 9001']])
        p.jogador.campo.adicionarCarta(make(name), index);
      const clay = make('RaspClay MonteCorp'); p.jogador.mao.adicionarCarta(clay);
      if (!p.jogarCartaDoJogador(clay, 0, [2, 3, 4]).sucesso) throw Error('RaspClay não invocou.');
    }
    const count = p.eventosEfeito.length;
    p.despertarDragao(dragon); p.despertarDragao(dragon);
    if (count !== p.eventosEfeito.length) throw Error('A mesma carta despertou duas vezes.');
    scene.desenharInterface(); scene.cameras.main.setAlpha(1);
    scene.apresentarEventosEfeito();
    effects.receber(p.eventosEfeito);
    return { awakened: dragon.dragaoDesperto, bonus: dragon.efeitoTurno?.valor,
      events: p.eventosEfeito.filter(event => event.momento === 'despertar').length };
  }, trigger);
}

async function phase(page, value) {
  await page.waitForFunction(value => game.scene.getScene('CenaEfeitos').despertarDragaoEmCurso?.fase === value, value);
}

async function capture(page, name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file }); screenshots.push(file);
}

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou.')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    for (const trigger of ['boi', 'raspclay']) {
      const label = `${viewport.width < 600 ? 'mobile' : 'desktop'}-${trigger}`;
      if (selectedCases.size && !selectedCases.has(label)) continue;
      const { context, page } = await openGame(viewport, label === 'mobile-boi');
      assert.deepEqual(await awaken(page, trigger), { awakened: true, bonus: 3, events: 1 });
      await phase(page, 'pressagio');
      assert.deepEqual(await page.evaluate(() => window.qaDragonSounds), []);
      const queue = await page.evaluate(() => {
        const scene = game.scene.getScene('CenaJogo'), effects = game.scene.getScene('CenaEfeitos');
        const awakeningId = effects.eventoAtual.id;
        const before = qaDragon.poder;
        scene.partida.resolverEfeitosInicioRodada();
        const next = scene.partida.eventosEfeito.at(-1);
        scene.apresentarEventosEfeito();
        window.qaDragonQueue = { awakeningId, nextId: next.id };
        return { bonus: qaDragon.poder - before, busy: scene.efeitosVisuaisPendentes(),
          queued: effects.fila.some(event => event.id === next.id),
          current: effects.eventoAtual.id === awakeningId };
      });
      assert.deepEqual(queue, { bonus: 3, busy: true, queued: true, current: true });
      await phase(page, 'despertar');
      await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object =>
        object.name === 'despertar-dragao-titulo' && object.alpha > .95));
      assert.deepEqual(await page.evaluate(() => window.qaDragonSounds), [{ played: true, playing: true, phase: 'despertar' }]);
      assert.equal(await page.evaluate(() => {
        const effects = game.scene.getScene('CenaEfeitos');
        return effects.children.list.some(object => object.name === 'despertar-dragao-retrato' && object.visible && object.alpha > .9) &&
          effects.children.list.some(object => object.name === 'despertar-dragao-vortice') &&
          effects.eventoAtual.id === qaDragonQueue.awakeningId && !effects.exibidos.includes(qaDragonQueue.nextId);
      }), true);
      await capture(page, `${label}-reveal`);
      await phase(page, 'memorias');
      await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object =>
        object.name === 'despertar-dragao-arte' && object.visible && object.alpha > .9));
      const artResolution = await page.evaluate(() => {
        const art = game.scene.getScene('CenaEfeitos').children.list.find(object => object.name === 'despertar-dragao-arte');
        const source = art.texture.getSourceImage();
        return { key: art.texture.key, width: source.naturalWidth, height: source.naturalHeight };
      });
      console.log(`${label}: arte final ${JSON.stringify(artResolution)}`);
      assert.equal(artResolution.key, 'despertarDragaoArte');
      assert.ok(artResolution.width >= 1000 && artResolution.height >= 1500,
        'A arte cinematográfica deve usar a imagem original em alta resolução.');
      await capture(page, `${label}-memories`);
      assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').efeitosVisuaisPendentes()), true);
      await page.waitForFunction(() => !game.scene.getScene('CenaJogo').efeitosVisuaisPendentes());
      assert.deepEqual(await page.evaluate(() => {
        const effects = game.scene.getScene('CenaEfeitos');
        return { state: effects.despertarDragaoEmCurso, objects: effects.children.list.filter(object =>
          object.name?.startsWith('despertar-dragao-')).length,
        continued: effects.exibidos.includes(qaDragonQueue.nextId), roars: qaDragonSounds.length,
        secret: /Memórias do passado/.test(qaDragon.descricaoCompleta()),
        roarPlaying: game.sound.getAll('somDragao').some(sound => sound.isPlaying) };
      }), { state: null, objects: 0, continued: true, roars: 1, secret: true, roarPlaying: false });
      const video = page.video();
      await context.close();
      if (video) { await video.saveAs(path.join(output, `${label}.webm`)); await video.delete(); }
      checks.push(`${label}: gatilho real, segredo, +3 PA, rugido único, fila, retorno e limpeza.`);
      console.log(checks.at(-1));
    }
  }

  const { context, page } = await openGame({ width: 390, height: 844 });
  await awaken(page, 'boi'); await phase(page, 'despertar');
  await page.evaluate(() => {
    window.qaStoppedEffects = game.scene.getScene('CenaEfeitos');
    window.qaStoppedSounds = ['somDragao', 'somExplosao'].flatMap(key => game.sound.getAll(key));
    game.scene.getScene('CenaJogo').scene.start('CenaTitulo');
  });
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.isActive('CenaEfeitos') &&
    !game.scene.getScene('CenaTitulo').restaurandoConta);
  assert.deepEqual(await page.evaluate(() => ({ state: qaStoppedEffects.despertarDragaoEmCurso,
    children: qaStoppedEffects.children.list.length, soundPlaying: qaStoppedSounds.some(sound => sound.isPlaying),
    shake: game.scene.getScene('CenaJogo').cameras.main?.shakeEffect?.isRunning || false })),
  { state: null, children: 0, soundPlaying: false, shake: false });
  await page.waitForTimeout(8000);
  assert.equal(await page.evaluate(() => qaDragonSounds.length), 1);
  assert.equal(await page.evaluate(() => qaStoppedEffects.children.list.length), 0);
  await context.close();
  checks.push('Saída durante o rugido: objetos, tremor e sons limpos; timers cancelados.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors, screenshots }, null, 2));
  console.log(checks.at(-1));
  console.log(`Capturas e vídeo: ${output}`);
}

run().catch(error => { console.error(error); console.error(errors); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); server.kill(); });
