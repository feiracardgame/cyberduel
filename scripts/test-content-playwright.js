const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-content-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['ContentQA']);
const accountsPath = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountsPath));
Object.assign(accounts.accounts[fixture.accountKey], { avatar: 'assets/fotosdeperfil/humba_brain_icon.png',
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] } });
fs.writeFileSync(accountsPath, JSON.stringify(accounts));
const output = path.resolve('output/sindicato/content-update'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: '31974', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const errors = [], checks = [];
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:31974', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && document.querySelector('.title-faction-dialog'), null, { timeout: 120000 });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    const details = page.locator('.title-faction-dialog .faction-analysis');
    assert.equal(await details.count(), 5);
    for (let i = 0; i < 5; i++) {
      await details.nth(i).locator('summary').click();
      const reading = details.nth(i).locator('.faction-analysis__text');
      assert.ok((await reading.innerText()).length > 1500);
      assert.ok(await reading.evaluate(el => getComputedStyle(el.querySelector('p')).fontSize !== '10px'));
      await reading.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await details.nth(i).locator('summary').click();
    }
    await page.screenshot({ path: path.join(output, `factions-${viewport.width}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  checks.push('Cinco análises completas, leitura e rolagem em celular e desktop.');
  await page.locator('.title-faction--raspcorp').click();
  await page.waitForFunction(() => window.cyberduelAccount.faction === 'raspcorp' && !game.scene.getScene('CenaTitulo').titleUI.modal);
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').cyberMusic?.isPlaying);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaTitulo').cyberMusic.key), 'musicaMenu');
  await page.evaluate(() => {
    const scene = game.scene.getScene('CenaTitulo');
    window.qaDialogue = showElenAI(scene, [{ sprite: 10, speaker: 'ElenAI', text: 'Alcance horizontal e vertical.' }], () => {});
  });
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').cyberMusic?.key === 'musicaIA' && game.scene.getScene('CenaTitulo').cyberMusic.isPlaying);
  await page.locator('.elenai-actions button').click();
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').cyberMusic?.key === 'musicaMenu' && game.scene.getScene('CenaTitulo').cyberMusic.isPlaying);
  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.openBoosterShop());
  for (const faction of ['raspcorp', 'echossystem', 'sindicato', 'humbanet', 'remanescentes']) {
    await page.locator(`.booster-faction[data-faction="${faction}"]`).click();
    await page.locator('.booster-analysis summary').click();
    assert.ok((await page.locator('.booster-analysis .faction-analysis__text').innerText()).length > 1500);
  }
  await page.evaluate(async () => {
    const ui = game.scene.getScene('CenaTitulo').titleUI;
    ui.closeModal(true); await window.cyberduelAccount.buyBooster('raspcorp');
    game.scene.getScene('CenaTitulo').titleUI.openBoosterOpening(window.cyberduelAccount.boosters[0]);
  });
  await page.locator('.booster-buy').click();
  await page.waitForFunction(() => game.scene.getScene('CenaTitulo').titleUI.boosterOpenAudio?.currentTime > 0);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.boosterOpenAudio.paused), false);
  await page.waitForFunction(() => document.querySelector('.title-booster-dialog.is-revealed'));
  await page.evaluate(() => game.scene.getScene('CenaTitulo').titleUI.closeModal(true));
  checks.push('Menu, fala da IA e retorno da música; áudio real de abertura de booster.');
  await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaDeckBuilder'));
  await page.waitForFunction(() => game.scene.getScene('CenaDeckBuilder').cyberMusic?.isPlaying);
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaDeckBuilder').cyberMusic.key), 'musicaDeck');
  for (const [field, music] of [[1, 'musicaPadrao'], [2, 'musicaFundo'], [4, 'musicaRemanescentes']]) {
    await page.evaluate(field => {
      window.cyberduelSettings.set('battlefield', field); window.cyberduelSettings.set('skipBattleAnnouncements', 1);
      // A conta de teste começa sem os desbloqueios de avatar; verifica o mapeamento do busto diretamente.
      window.cyberduelAccount.avatar = 'assets/fotosdeperfil/humba_brain_icon.png';
      const scene = game.scene.getScenes(true).find(s => s.scene.key !== 'CenaEfeitos');
      scene.scene.start('CenaJogo', { debug: true });
    }, field);
    await page.waitForFunction(music => game.scene.isActive('CenaJogo') && game.scene.getScene('CenaJogo').cyberMusic?.key === music && game.scene.getScene('CenaJogo').cyberMusic.isPlaying, music);
    assert.equal(await page.evaluate(() => game.sound.sounds.filter(s => s.isPlaying && s.key.startsWith('musica')).length), 1);
    await page.waitForFunction(() => game.scene.getScene('CenaJogo').textures.exists('personagem:assets/profiles/humbabrain_profile.png'));
    await page.waitForFunction(() => {
      const scene = game.scene.getScene('CenaJogo');
      return scene.cameras.main.alpha === 1 && scene.children.list.some(object => object.name === 'personagem-jogador' && object.visible);
    });
    if (field === 3) await page.screenshot({ path: path.join(output, 'humba-profile.png') });
    await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
    await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  }
  await page.evaluate(() => {
    window.qaDragonSounds = [];
    const play = game.sound.play.bind(game.sound);
    game.sound.play = (key, options) => {
      const result = play(key, options);
      if (key === 'somDragao') window.qaDragonSounds.push({ played: result, playing: game.sound.getAll(key).some(sound => sound.isPlaying) });
      return result;
    };
  });
  for (const trigger of ['boi', 'raspclay']) {
    await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true }));
    await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos'));
    assert.equal(await page.evaluate(trigger => {
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
      const dragon = make('Dragão das Comunicações Móveis'); p.jogador.campo.adicionarCarta(dragon, 1);
      window.qaDragon = dragon; window.qaDragonSounds = [];
      if (/Memórias/.test(dragon.descricaoCompleta())) throw Error('Efeito secreto revelado antes de despertar.');
      scene.partida = window.partida = p; scene.faseAtual = p.fase = trigger === 'boi' ? 'habilidades' : 'colocar';
      scene.ehMeuTurno = true; scene.travado = false;
      const effects = game.scene.getScene('CenaEfeitos'); effects.ultimoEvento = 0; effects.fila = [];
      if (trigger === 'boi') {
        const boi = make('O Boi'); p.jogador.campo.adicionarCarta(boi, 0);
        if (!p.ativarHabilidade(boi, p.jogador, p.inimigo, 1).sucesso) throw Error('Boi não ativou.');
      } else {
        for (const [index, name] of [[2, 'O Rato'], [3, 'A Ferreira'], [4, 'HAL 9001']])
          p.jogador.campo.adicionarCarta(make(name), index);
        const clay = make('RaspClay MonteCorp'); p.jogador.mao.adicionarCarta(clay);
        if (!p.jogarCartaDoJogador(clay, 0, [2, 3, 4]).sucesso) throw Error('RaspClay não invocou.');
      }
      scene.desenharInterface(); scene.cameras.main.setAlpha(1);
      return dragon.dragaoDesperto && dragon.efeitoTurno.valor === 3;
    }, trigger), true);
    await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object =>
      object.name === 'despertar-dragao-arte' && object.texture?.key === 'despertarDragaoArte' && object.visible && object.alpha > .9));
    assert.deepEqual(await page.evaluate(() => window.qaDragonSounds), [{ played: true, playing: true }]);
    await page.screenshot({ path: path.join(output, `dragao-${trigger}.png`) });
    await page.waitForFunction(() => !game.scene.getScene('CenaJogo').efeitosVisuaisPendentes());
    assert.deepEqual(await page.evaluate(() => {
      const p = game.scene.getScene('CenaJogo').partida; p.fimTurno({ semIA: true });
      return [qaDragon.poder, /Memórias do passado/.test(qaDragon.descricaoCompleta())];
    }), [17, true]);
    await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
    await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
  }
  checks.push('Dragão: despertar pelo Boi e por três sacrifícios do RaspClay, full art, rugido real, segredo revelado e +3 PA na rodada.');
  await page.evaluate(() => game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { tutorial: true }));
  await page.waitForFunction(() => game.scene.getScene('CenaJogo').cyberMusic?.key === 'musicaIA' && document.querySelector('.elenai-dialogue'));
  await page.screenshot({ path: path.join(output, 'tutorial.png') });
  checks.push('Editor, quatro campos e tutorial com música exclusiva, sem sobreposição, e busto HumbaBrain carregado.');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(checks.join('\n'));
}
run().catch(error => { console.error(error); console.error(errors); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });
