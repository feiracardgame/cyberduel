const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-interactions-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['EncontrosQA']);
const accountFile = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountFile));
Object.assign(accounts.accounts[fixture.accountKey], {
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] } });
fs.writeFileSync(accountFile, JSON.stringify(accounts));
const port = process.env.INTERACTIONS_TEST_PORT || '31978';
const output = path.resolve(process.env.INTERACTIONS_TEST_OUTPUT || 'output/sindicato/interactions'); fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: port, DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, page;
const errors = [], missing = [], checks = [];
async function tapWorld(page, x, y, sceneName = 'CenaJogo') {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = await page.evaluate(({ x, y, sceneName }) => {
    const scene = game.scene.getScene(sceneName), rect = game.canvas.getBoundingClientRect();
    const top = scene.cameras.main.getWorldPoint(0, 0);
    const bottom = scene.cameras.main.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - top.x) / (bottom.x - top.x) * rect.width,
      y: rect.top + (y - top.y) / (bottom.y - top.y) * rect.height };
  }, { x, y, sceneName });
  await page.touchscreen.tap(point.x, point.y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function tapSlot(page, side, index) {
  const point = await page.evaluate(({ side, index }) => {
    const s = game.scene.getScene('CenaJogo'), l = s.layout;
    const x = l.x[index % 5], y = (side === 'jogador' ? l.yJogador : l.yInimigo)[Math.floor(index / 5)];
    const zones = (s.objetosSelecaoAlvo || []).filter(o => o.input?.enabled && o.depth >= 3800 &&
      Math.abs(o.x - x) < 2 && (side === 'inimigo' ? o.y < ALTURA_LAYOUT / 2 : o.y > ALTURA_LAYOUT / 2));
    zones.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
    const zone = zones[0];
    return zone ? { x: zone.x, y: zone.y } : { x, y };
  }, { side, index });
  await tapWorld(page, point.x, point.y);
}
async function activateFromUI(page, sourceName) {
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.input.enabled && !s.efeitosVisuaisPendentes() && s.children.list.some(o =>
      o.dadosCartaCampo === s.partida.jogador.campo.cartas[5] && o.scaleX === 1);
  });
  await tapSlot(page, 'jogador', 5);
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.modalAberto && s.painelDetalheAtual?.scaleX === 1 && !s.tweens.isTweening(s.painelDetalheAtual);
  });
  const button = await page.evaluate(() => {
    const find = objects => {
      for (const o of objects) {
        if (o.name === 'ativar-habilidade' && o.input?.enabled) {
          const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty, scene: o.scene.scene.key };
        }
        if (o.list) { const found = find(o.list); if (found) return found; }
      }
    };
    for (const s of game.scene.getScenes(true)) { const found = find(s.children.list); if (found) return found; }
  });
  assert.ok(button, `Botão real de habilidade: ${sourceName}`);
  await tapWorld(page, button.x, button.y, button.scene);
  await page.waitForFunction(() => {
    const s = game.scene.getScene('CenaJogo');
    return s.objetosSelecaoAlvo?.length && !s.modalAberto && s.input.enabled;
  });
  await tapSlot(page, 'inimigo', 5);
  if (sourceName === 'O Bom') {
    const confirm = await page.evaluate(() => {
      const o = game.scene.getScene('CenaJogo').objetosSelecaoAlvo.find(o => o.list?.some(child => child.text?.startsWith('Confirmar 1')));
      const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty };
    });
    await tapWorld(page, confirm.x, confirm.y);
  }
}
async function main() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timeout); resolve(); } });
    server.once('exit', code => { clearTimeout(timeout); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    reducedMotion: 'no-preference', recordVideo: { dir: output, size: { width: 390, height: 844 } } });
  await context.addInitScript(token => {
    localStorage.setItem('cyberduel.account.token.v1', token);
    localStorage.setItem('cyberduel.settings.v1', JSON.stringify({ skipBattleAnnouncements: 1 }));
  }, fixture.token);
  page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) missing.push(response.url()); });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta,
    null, { timeout: 120000 });
  await page.locator('.title-faction--echossystem').click();
  await page.waitForFunction(() => cyberduelAccount.faction === 'echossystem' && !game.scene.getScene('CenaTitulo').titleUI.modal);
  await page.evaluate(() => {
    window.qaAudio = [];
    const play = game.sound.play.bind(game.sound);
    game.sound.play = (key, options) => {
      const played = play(key, options);
      qaAudio.push({ key, played, playing: game.sound.getAll(key).some(s => s.isPlaying) });
      return played;
    };
  });
  for (const [field, music, videoKey] of [
    [1, 'musicaPadrao', 'videoAberturaEchoRasp'], [2, 'musicaFundo', 'videoAberturaSindicato'],
    [3, 'musicaHumbaNet', 'videoAberturaEchoRasp'], [4, 'musicaRemanescentes', 'videoAberturaRemanescentes'],
  ]) {
    await page.evaluate(field => {
      cyberduelSettings.set('battlefield', field);
      const scene = game.scene.getScenes(true).find(s => s.scene.key !== 'CenaEfeitos');
      scene.scene.start('CenaTransicao');
    }, field);
    await page.waitForFunction(() => game.scene.isActive('CenaTransicao'));
    assert.deepEqual(await page.evaluate(() => {
      const scene = game.scene.getScene('CenaTransicao');
      const video = scene.children.list.find(o => o.type === 'Video');
      return { music: scene.cyberMusic.key, video: video.cacheKey, muted: video.isMuted() };
    }), { music, video: videoKey, muted: true });
    await page.keyboard.press('Space');
    await page.waitForFunction(music => game.scene.isActive('CenaJogo') && game.scene.getScene('CenaJogo').cyberMusic?.key === music, music);
    assert.equal(await page.evaluate(() => game.sound.sounds.filter(s => s.isPlaying && s.key.startsWith('musica')).length), 1);
    await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
    await page.waitForFunction(() => game.scene.isActive('CenaTitulo'));
  }
  checks.push('Quatro campos: abertura correta após mudar ajustes, trilha da facção, vídeo mudo, skip e uma única música.');
  const cases = [
    ['boi_raspclay', 'O Boi', 'RaspClay MonteCorp'],
    ['tigre_dipsp', 'Agente da DIPSP', 'O Tigre'],
    ['tigre_dipsp', 'O Tigre', 'Agente da DIPSP'],
    ['bom_mau', 'O Bom', "Sen'Tenzhah, O Mau"],
    ['trio', "Tuh'Coh, O Feio", null],
  ];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const [encontro, sourceName, targetName] of cases) {
      await page.evaluate(() => {
        const current = game.scene.getScenes(true).find(s => s.scene.key !== 'CenaEfeitos');
        window.qaPreviousPartida = current.partida;
        current.scene.start('CenaJogo', { debug: true });
      });
      await page.waitForFunction(() => game.scene.isActive('CenaJogo') && game.scene.isActive('CenaEfeitos') &&
        game.scene.getScene('CenaJogo').partida !== window.qaPreviousPartida);
      let event = await page.evaluate(({ encontro, sourceName, targetName }) => {
        const scene = game.scene.getScene('CenaJogo'), p = scene.partida;
        scene.executarFaseSolo = () => {}; scene.ehMeuTurno = true; scene.travado = false;
        p.fase = 'habilidades'; scene.faseAtual = 'habilidades';
        scene.time.removeAllEvents(); scene.avisoLocal = null;
        scene.prazoFaseLocal = Date.now() + 600000; scene.timerTurnoExpirado = false;
        window.qaAudio = [];
        for (const who of [p.jogador, p.inimigo]) who.campo.cartas.fill(null);
        let nextId = 90000;
        const card = name => { const base = POOL_CARTAS_MONSTRO.find(c => c.nome === name);
          return new Carta(nextId++, base.poder, 'monstro', JSON.parse(JSON.stringify(base))); };
        const source = card(sourceName);
        p.jogador.campo.cartas[5] = source;
        if (encontro === 'trio') {
          p.jogador.campo.cartas[5] = card('O Bom');
          p.jogador.campo.cartas[7] = card("Sen'Tenzhah, O Mau");
          p.jogador.mao.cartas = [source];
          p.fase = 'colocar'; scene.faseAtual = 'colocar';
        } else {
          p.inimigo.campo.cartas[5] = card(targetName);
          if (sourceName === 'O Boi') p.inimigo.campo.cartas[5].buff(3);
        }
        const event = p.eventosEfeito?.findLast(e => e.encontro === encontro);
        scene.desenharInterface(); scene.apresentarEventosEfeito();
        scene.cameras.main.setAlpha(1);
        return event || null;
      }, { encontro, sourceName, targetName });
      if (encontro !== 'trio') await activateFromUI(page, sourceName);
      else {
        await page.waitForFunction(() => {
          const s = game.scene.getScene('CenaJogo');
          return s.input.enabled && s.children.list.some(o => o.dadosCarta?.nome === "Tuh'Coh, O Feio");
        });
        const hand = await page.evaluate(() => {
          const o = game.scene.getScene('CenaJogo').children.list.find(o => o.dadosCarta?.nome === "Tuh'Coh, O Feio");
          const m = o.getWorldTransformMatrix(); return { x: m.tx, y: m.ty };
        });
        await tapWorld(page, hand.x, hand.y);
        await page.waitForFunction(() => game.scene.getScene('CenaJogo').cartaMaoSelecionada?.dadosCarta?.nome === "Tuh'Coh, O Feio");
        await tapSlot(page, 'jogador', 6);
      }
      await page.waitForFunction(() => game.scene.getScene('CenaJogo').partida.eventosEfeito?.some(e => e.encontro));
      event = await page.evaluate(() => game.scene.getScene('CenaJogo').partida.eventosEfeito.findLast(e => e.encontro));
      assert.equal(event.encontro, encontro);
      await page.waitForFunction(encontro => game.scene.getScene('CenaEfeitos').children.list.some(o => o.encontro === encontro && o.alpha > .1), encontro);
      const opening = await page.evaluate(() => {
        const panel = game.scene.getScene('CenaEfeitos').children.list.find(o => o.encontro);
        const left = panel.list.find(o => o.name === 'retrato-esquerdo');
        const poster = panel.list.find(o => o.name === 'poster-trio');
        return { x: left?.x, revealed: poster?.revelado };
      });
      await page.waitForFunction(() => {
        const panel = game.scene.getScene('CenaEfeitos').children.list.find(o => o.encontro);
        return panel && ['cartaz', 'confronto', 'combate'].includes(panel.faseEncontro);
      });
      assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').input.enabled), false, 'Todas as vinhetas bloqueiam novas jogadas.');
      const artwork = await page.evaluate(() => {
        const panel = game.scene.getScene('CenaEfeitos').children.list.find(o => o.encontro);
        const poster = panel.list.find(o => o.name === 'poster-trio');
        const background = panel.list.find(o => o.name === 'fundo-encontro');
        const bounds = poster?.getBounds();
        return { poster: poster?.texture.key, background: background?.texture.key,
          x: panel.list.find(o => o.name === 'retrato-esquerdo')?.x, revealed: poster?.revelado,
          entirePoster: !bounds || (bounds.left >= 0 && bounds.right <= LARGURA_LAYOUT && bounds.top >= 0 && bounds.bottom <= ALTURA_LAYOUT) };
      });
      if (encontro === 'trio') {
        assert.equal(artwork.poster, 'posterTrio');
        assert.equal(artwork.entirePoster, true, 'Pôster completo, sem cortar molduras ou títulos.');
        assert.equal(opening.revealed, false); assert.equal(artwork.revealed, true);
      } else {
        assert.equal(artwork.background, { boi_raspclay: 'fundoEncontroBoi', tigre_dipsp: 'fundoEncontroTigre', bom_mau: 'fundoEncontroBom' }[encontro]);
        assert.ok(artwork.x > opening.x + 100, 'Retratos entram em movimento real.');
        assert.equal(await page.evaluate(() => game.scene.getScene('CenaJogo').input.enabled), false, 'Jogadas bloqueadas durante a vinheta.');
      }
      if (encontro === 'tigre_dipsp') {
        await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.find(o => o.encontro)?.impactosEncontro >= 2);
        assert.equal(await page.evaluate(() => {
          const p = game.scene.getScene('CenaEfeitos').children.list.find(o => o.encontro);
          return p.list.some(o => o.name === 'disparo-dipsp' || o.name === 'garra-tigre');
        }), false, 'Confronto sem projéteis ou garras desenhadas.');
      }
      const label = `${encontro}-${sourceName === 'O Tigre' ? 'tigre' : 'fonte'}-${viewport.width}`;
      await page.screenshot({ path: path.join(output, `${label}.png`) });
      await page.waitForFunction(() => !game.scene.getScene('CenaJogo').efeitosVisuaisPendentes());
      await page.waitForFunction(() => game.scene.getScene('CenaJogo').input.enabled);
      assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').children.list.some(o => o.encontro)), false);
      assert.equal(await page.evaluate(id => game.scene.getScene('CenaEfeitos').exibidos.filter(e => e === id).length, event.id), 1);
      if (encontro === 'tigre_dipsp') for (const key of ['somTiro', 'somTigreAtaque'])
        assert.equal(await page.evaluate(key => qaAudio.some(s => s.key === key && s.played && s.playing), key), true, `Áudio real: ${key}`);
      assert.deepEqual(errors, []);
    }
  }
  checks.push('Cinco interações em celular/desktop; habilidades por toques reais, entrada em movimento, revelação do cartaz, combate alternado com áudio, bloqueio e liberação da interface, evento único e limpeza.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const e = game.scene.getScene('CenaEfeitos');
    e.receber([{ id: e.ultimoEvento + 1, lado: 'jogador', momento: 'continuo', encontro: 'trio',
      fonte: { nome: "Tuh'Coh, O Feio", indice: 6 }, alvos: [] }]);
  });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').encontroEmCurso?.faseEncontro === 'cartaz');
  assert.deepEqual(await page.evaluate(() => {
    const e = game.scene.getScene('CenaEfeitos'), poster = e.encontroEmCurso.list.find(o => o.name === 'poster-trio');
    return { revealed: poster.revelado, angle: poster.angle, tweens: e.tweens.getTweensOf(poster).length };
  }), { revealed: true, angle: 0, tweens: 0 });
  await page.waitForFunction(() => !game.scene.getScene('CenaJogo').efeitosVisuaisPendentes() && game.scene.getScene('CenaJogo').input.enabled);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const e = game.scene.getScene('CenaEfeitos');
    e.receber([{ id: e.ultimoEvento + 1, lado: 'jogador', momento: 'habilidade', encontro: 'tigre_dipsp',
      fonte: { nome: 'Agente da DIPSP', indice: 5 }, alvos: [] }]);
  });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').encontroEmCurso?.active);
  await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
  await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.isActive('CenaEfeitos'));
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').encontroEmCurso), null);
  checks.push('Movimento reduzido: cartaz inteiro sem recorte/zoom/rotação; sair durante a vinheta cancela seus objetos e a cena.');
  assert.deepEqual(missing, []); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors, missing }, null, 2));
  const video = page.video(); await context.close(); await video.saveAs(path.join(output, 'animacoes.webm'));
  console.log(checks.join('\n'));
}
main().catch(async error => {
  console.error(error); console.error(errors); process.exitCode = 1;
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(output, 'failure.png') });
    console.error(await page.evaluate(() => {
      const s = game.scene.getScene('CenaJogo');
      return { phase: s.faseAtual, ownTurn: s.ehMeuTurno, locked: s.travado, input: s.input.enabled,
        modal: s.modalAberto, selected: s.cartaMaoSelecionada?.dadosCarta?.nome,
        selection: s.objetosSelecaoAlvo?.length, effects: s.efeitosVisuaisPendentes(),
        events: s.partida?.eventosEfeito?.map(e => [e.id, e.momento, e.encontro]) };
    }));
  }
})
  .finally(async () => { await browser?.close(); server.kill(); });
