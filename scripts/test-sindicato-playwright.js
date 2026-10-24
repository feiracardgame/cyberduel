const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-sindicato-playwright-'));
const output = path.join(root, 'output/sindicato');
fs.mkdirSync(output, { recursive: true });
const port = process.env.SINDICATO_TEST_PORT || '31973';
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/dev-server.js'], {
  cwd: root, windowsHide: true, env: { ...process.env, PORT: port, DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser, page;
const errors = [], checks = [];

async function waitIdle() {
  await page.waitForFunction(() => !window.cena.efeitosVisuaisPendentes() && window.cena.input.enabled && !window.cena.interfaceOcultaPorEfeitos &&
    game.scene.getScene('CenaEfeitos').ultimoEvento >= (window.cena.partida.eventosEfeito?.at(-1)?.id || 0), null, { timeout: 20000 });
}
async function shot(name) { await page.screenshot({ path: path.join(output, `${name}.png`) }); }
async function tapWorld(x, y, sceneName = 'CenaJogo') {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const point = await page.evaluate(({ x, y, sceneName }) => {
    const scene = game.scene.getScene(sceneName), camera = scene.cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    // Inverte a mesma conversão de coordenadas usada pelo ponteiro do jogo.
    const topLeft = camera.getWorldPoint(0, 0);
    const bottomRight = camera.getWorldPoint(game.canvas.width, game.canvas.height);
    return { x: rect.left + (x - topLeft.x) / (bottomRight.x - topLeft.x) * rect.width,
      y: rect.top + (y - topLeft.y) / (bottomRight.y - topLeft.y) * rect.height };
  }, { x, y, sceneName });
  await page.touchscreen.tap(point.x, point.y);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function tapSlot(side, index) {
  const point = await page.evaluate(({ side, index }) => {
    const layout = window.cena.layout;
    return { x: layout.x[index % 5], y: (side === 'jogador' ? layout.yJogador : layout.yInimigo)[Math.floor(index / 5)] };
  }, { side, index });
  await tapWorld(point.x, point.y);
}
async function activate(index = 0) {
  await waitIdle();
  await page.waitForFunction(index => cena.children.list.some(object => object.dadosCartaCampo === partida.jogador.campo.cartas[index] && object.scaleX === 1), index);
  await tapSlot('jogador', index);
  await page.waitForFunction(index => !cena.modalAberto &&
    cena.cartaCampoSelecionada?.dadosCartaCampo === partida.jogador.campo.cartas[index] &&
    cena.botaoHabilidadeCampo?.name === 'ativar-habilidade-campo' && cena.botaoHabilidadeCampo.input?.enabled &&
    !cena.tweens.isTweening(cena.cartaCampoSelecionada), index);
  const button = await page.evaluate(() => {
    const object = cena.botaoHabilidadeCampo;
    const matrix = object.getWorldTransformMatrix();
    return { x: matrix.tx, y: matrix.ty, scene: object.scene.scene.key };
  });
  assert.ok(button, 'Bolinha de ativar habilidade disponível sem abrir a ficha');
  await tapWorld(button.x, button.y, button.scene);
  await page.waitForFunction(() => window.cena.objetosSelecaoAlvo?.length > 0 && !window.cena.modalAberto && window.cena.input.enabled);
}
async function setup(name, allies = [{ name: 'O Tigre', index: 1 }], enemies = [{ name: 'O Tigre', index: 0 }]) {
  await waitIdle();
  await page.evaluate(({ name, allies, enemies }) => {
    const scene = window.cena;
    if (scene.modalAberto) scene.fecharDetalheCarta(true);
    scene.cancelarSelecaoDeAlvo();
    scene.time.removeAllEvents();
    const p = new Partida(null, true);
    p.fase = 'habilidades';
    let nextId = 50000;
    const make = spec => {
      const base = [...POOL_CARTAS_MONSTRO, ...POOL_CARTAS_TERRENO].find(card => card.nome === spec.name);
      if (!base) throw Error(`Carta ausente: ${spec.name}`);
      const type = POOL_CARTAS_TERRENO.includes(base) ? 'terreno' : 'monstro';
      const card = new Carta(nextId++, base.poder, type, JSON.parse(JSON.stringify(base)));
      if (spec.damage) card.buff(-spec.damage);
      if (spec.bonus) card.buff(spec.bonus);
      if (spec.used) card.usadaEsteTurno = true;
      return card;
    };
    p.jogador.campo.cartas[0] = make({ name });
    allies.forEach(spec => p.jogador.campo.cartas[spec.index] = make(spec));
    enemies.forEach(spec => p.inimigo.campo.cartas[spec.index] = make(spec));
    scene.partida = window.partida = p;
    scene.faseAtual = 'habilidades'; scene.ehMeuTurno = true; scene.travado = false;
    scene.avisoLocal = null; scene.prazoFaseLocal = Date.now() + 600000;
    scene.timerTurnoExpirado = false; scene.finalDebug = false;
    const e = game.scene.getScene('CenaEfeitos');
    e.ultimoEvento = 0; e.exibidos = []; e.fila = [];
    e.marcasSindicato.forEach(mark => mark.destroy()); e.marcasSindicato.clear();
    window.qaSounds = []; window.qaAudioResults = []; window.qaVideos = [];
    scene.desenharInterface();
    scene.cameras.main.setAlpha(1);
  }, { name, allies, enemies });
  await page.waitForFunction(() => window.cena.children.list.some(object => object.dadosCartaCampo === partida.jogador.campo.cartas[0] && object.scaleX === 1));
}
async function hasVisual(key, name = key) {
  await page.waitForFunction(key => game.scene.getScene('CenaEfeitos').children.list.some(object =>
    object.active && object.alpha > .2 && (!object.isCropped || object._crop.height > object.height * .85) &&
    (object.texture?.key === key || object[key] === true)), key);
  await shot(name);
}
async function soundOnce(key) {
  await waitIdle();
  assert.equal(await page.evaluate(key => window.qaSounds.filter(sound => sound === key).length, key), 1, `${key}: toca uma única vez`);
  assert.equal(await page.evaluate(key => window.qaAudioResults.some(result => result.key === key && result.played && result.playing), key), true, `${key}: reprodução real iniciada`);
  assert.equal(await page.evaluate(() => window.qaSounds.includes('somAlvo')), false, 'Target Acquired continua restrito à DIPSP/Juggernaut');
  console.log(`Áudio e animação aprovados: ${key}`);
}
async function mark(key) {
  return page.evaluate(key => [...game.scene.getScene('CenaEfeitos').marcasSindicato.values()].filter(object => object.marcaSindicato === key).length, key);
}
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor de teste não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => process.stderr.write(data));
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);
  browser = await chromium.launch({ channel, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'no-preference' });
  await context.tracing.start({ screenshots: true, snapshots: true });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo'), null, { timeout: 120000 });
  await page.evaluate(async () => {
    await window.cyberduelAccount.localLogin('SindicatoQA');
    await window.cyberduelAccount.chooseFaction('raspcorp');
    window.cyberduelSettings.set('skipBattleAnnouncements', 1);
    window.irParaX1();
  });
  await page.waitForFunction(() => window.cena?.partida && game.scene.isActive('CenaEfeitos'));
  await page.evaluate(() => {
    window.qaSounds = []; window.qaAudioResults = []; window.qaVideos = [];
    const e = game.scene.getScene('CenaEfeitos'), originalPlay = e.sound.play.bind(e.sound);
    e.sound.play = (key, options) => {
      window.qaSounds.push(key);
      const played = originalPlay(key, options);
      window.qaAudioResults.push({ key, played, playing: e.sound.getAll(key).some(sound => sound.isPlaying) });
      return played;
    };
    const originalVideo = e.add.video.bind(e.add);
    e.add.video = (...args) => { window.qaVideos.push(args[2]); return originalVideo(...args); };
  });
  console.log('Playwright: arena real aberta em 390×844; iniciando seleção por toques.');

  await setup('Refrigeradores de DataCenter');
  await activate(); await tapSlot('jogador', 1);
  await hasVisual('efeitoRefrigerador', '01-refrigerador');
  await soundOnce('somRefrigerador');
  assert.deepEqual(await page.evaluate(() => { const card = partida.jogador.campo.cartas[1]; const before = card.poder; card.buff(-5); return [card.protegidaPA, card.poder === before]; }), [true, true]);
  await page.evaluate(() => partida.iniciarTurno(partida.inimigo));
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[1].protegidaPA), true);
  await page.evaluate(() => partida.iniciarTurno(partida.jogador));
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[1].protegidaPA), false);
  checks.push('Refrigerador: símbolo, som, proteção e expiração no próximo turno do dono');

  await setup('Montadores de Cabos');
  await activate(); await tapSlot('jogador', 1); await tapSlot('jogador', 8);
  await hasVisual('efeitoMontador', '02-montador');
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').children.list.filter(o => o.texture?.key === 'efeitoMontador').length), 2);
  await soundOnce('somMontador');
  assert.deepEqual(await page.evaluate(() => [partida.jogador.campo.cartas[1], partida.jogador.campo.cartas[8].nome]), [null, 'O Tigre']);
  checks.push('Montador: escolha de origem/destino, dois símbolos e movimento real');

  await setup('Estudante de Curso Técnico', [{ name: 'NeoMedicânico', index: 1 }]);
  await activate(); await tapSlot('jogador', 1);
  await hasVisual('brilhoAprendizado', '03-estudante');
  await soundOnce('somEstudante');
  assert.deepEqual(await page.evaluate(() => { const card = partida.jogador.campo.cartas[0]; return [card.poder, card.aprendizadoUsado, card.habilidadeAprendidaDe, card.efeito.acao]; }), [1, true, 'NeoMedicânico', 'curar']);
  await page.evaluate(() => { partida.fimTurno({ semIA: true }); partida.iniciarTurno(partida.jogador); cena.desenharInterface(); });
  await activate(); await tapSlot('jogador', 0);
  await hasVisual('efeitoMedico', '03-estudante-cura-aprendida');
  await soundOnce('somMedico');
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[0].poder), 3);
  checks.push('Estudante: brilho roxo, custo de 2 PA, aprendizagem permanente e efeito copiado');

  await setup('CyberUnidades de Emergência');
  await activate(); await tapSlot('inimigo', 0);
  await hasVisual('rajadaExtintor', '04-bombeiro-rajada');
  await soundOnce('somBombeiro');
  assert.equal(await mark('efeitoBombeiro'), 1);
  assert.equal(await page.evaluate(() => partida.inimigo.campo.cartas[0].buff(5)), 0);
  await shot('04-bombeiro-persistente');
  await page.evaluate(() => { cena.desenharInterface(); });
  assert.equal(await mark('efeitoBombeiro'), 1, 'A marca sobrevive ao redesenho');
  await page.evaluate(() => { partida.fimTurno({ semIA: true }); cena.desenharInterface(); });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').marcasSindicato.size === 0);
  assert.equal(await page.evaluate(() => partida.inimigo.campo.cartas[0].bonusBloqueado), false);
  checks.push('Extintor: rajada branca, símbolo persistente, bloqueio e fim da rodada atual');

  await setup('TecnoAgentes de Segurança', [], [{ name: 'O Rato', index: 0, bonus: 5 }]);
  await activate(); await tapSlot('inimigo', 0);
  await hasVisual('efeitoPolicial', '05-policial');
  await soundOnce('somPolicial');
  assert.equal(await mark('efeitoPolicial'), 1);
  assert.deepEqual(await page.evaluate(() => {
    const before = partida.inimigo.campo.cartas[0].poder;
    const rat = partida.inimigo.campo.cartas[0], agent = partida.jogador.campo.cartas[0];
    partida.inimigo.campo.cartas[0] = null; partida.inimigo.campo.cartas[5] = rat;
    partida.jogador.campo.cartas[0] = null; partida.jogador.campo.cartas[5] = agent;
    const result = partida.ativarHabilidade(rat, partida.inimigo, partida.jogador, 5);
    return [result.sucesso, rat.poder - before];
  }), [true, 0], 'Rato ganha 2 PA e perde 2 pela advertência');
  await waitIdle();
  await page.evaluate(() => { partida.jogador.campo.removerCarta(5); cena.desenharInterface(); });
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').marcasSindicato.size === 0);
  checks.push('Policial: advertência persistente, penalidade de 2 PA e saída da fonte');

  await setup('NeoMedicânico', [{ name: 'O Tigre', index: 1, damage: 7 }]);
  await activate(); await tapSlot('jogador', 1);
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(o => o.antesCuraMedico && o.active && o.list.some(child => child.type === 'Text' && child.text === '2')));
  await hasVisual('efeitoMedico', '06-medico');
  await soundOnce('somMedico');
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[1].poder), 9, 'Restaura todos os 7 PA perdidos');
  checks.push('Medicânico: símbolo antes da restauração, cura completa e limpeza');

  await setup('Influenciador Digital');
  await activate(); await tapSlot('jogador', 1); await tapSlot('inimigo', 0);
  await hasVisual('efeitoInfluenciadorLike', '07-influenciador');
  assert.equal(await page.evaluate(() => game.scene.getScene('CenaEfeitos').children.list.some(o => o.texture?.key === 'efeitoInfluenciadorDeslike')), true);
  await soundOnce('somInfluenciador');
  assert.deepEqual(await page.evaluate(() => [partida.jogador.campo.cartas[1].poder, partida.inimigo.campo.cartas[0].poder]), [11, 7]);
  checks.push('Influenciador: dois alvos distintos, like +2 e dislike −2');

  await setup('CyberPolíticos', [{ name: 'O Tigre', index: 1 }, { name: 'Refrigeradores de DataCenter', index: 2 }]);
  await page.evaluate(() => cena.iniciarSelecaoDeAliadoParaBuff(partida.jogador.campo.cartas[0], 0));
  await tapSlot('jogador', 1);
  await hasVisual('efeitoPolitico', '08-politico');
  await soundOnce('somPolitico');
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[0].poder), 12);
  await activate(2); await tapSlot('jogador', 1);
  await hasVisual('efeitoRefrigerador', '08-politico-acima-do-outro-efeito');
  assert.equal(await page.evaluate(() => {
    const children = game.scene.getScene('CenaEfeitos').children.list;
    return children.find(o => o.texture?.key === 'efeitoPolitico').depth > children.find(o => o.texture?.key === 'efeitoRefrigerador').depth;
  }), true, 'Coligação fica acima dos outros efeitos');
  await waitIdle();
  await page.evaluate(() => { partida.jogador.campo.removerCarta(1); partida.resolverEfeitosContinuos(partida.jogador); cena.desenharInterface(); });
  await page.waitForFunction(() => [...game.scene.getScene('CenaEfeitos').marcasSindicato.values()].every(o => o.marcaSindicato !== 'efeitoPolitico'));
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[0]), null);
  checks.push('Político: vínculo escolhido, +6 PA, marca acima das demais e eliminação conjunta');

  await setup('NeoPalhoça', [{ name: 'Refrigeradores de DataCenter', index: 1 }, { name: 'O Tigre', index: 2 }]);
  await page.evaluate(() => { partida.registrarHistorico(partida.jogador.campo.cartas[0], 'jogador'); partida.resolverEfeitosContinuos(partida.jogador); cena.desenharInterface(); });
  await page.waitForFunction(() => window.qaSounds.includes('somNeoPalhoca'));
  await shot('09-neopalhoca'); await soundOnce('somNeoPalhoca');
  assert.deepEqual(await page.evaluate(() => [partida.jogador.campo.cartas[1].poder, partida.jogador.campo.cartas[2].poder]), [7, 9]);
  checks.push('NeoPalhoça: som de invocação e +3 PA apenas ao Sindicato');

  await setup('Professores de Duelo', [{ name: 'Montadores de Cabos', index: 1, used: true }]);
  await activate(); await tapSlot('jogador', 1);
  await page.waitForFunction(() => window.qaVideos.includes('videoEfeitoprofessores'));
  await page.waitForFunction(() => game.scene.getScene('CenaEfeitos').children.list.some(object => object.type === 'Video' && object.frameReady && object.video?.currentTime > .1));
  await shot('10-professores'); await soundOnce('somProfessores');
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[1].usadaEsteTurno), false);
  await activate(1); await tapSlot('jogador', 0); await tapSlot('jogador', 8);
  await soundOnce('somMontador');
  assert.equal(await page.evaluate(() => partida.jogador.campo.cartas[8].nome), 'Professores de Duelo', 'A habilidade liberada realmente pode ser utilizada novamente.');
  checks.push('Professores: vídeo real, som e liberação da habilidade usada');

  await page.setViewportSize({ width: 1366, height: 768 });
  await setup('TecnoAgentes de Segurança');
  await page.evaluate(() => {
    const codec = window.cyberduelMultiplayer;
    partida.ativarHabilidade(partida.jogador.campo.cartas[0], partida.jogador, partida.inimigo, 0);
    cena.partida = window.partida = codec.hydrateMatch(codec.serializeMatch(partida));
    cena.desenharInterface();
  });
  await waitIdle();
  await hasVisual('efeitoPolicial', '11-desktop-estado-restaurado');
  assert.equal(await mark('efeitoPolicial'), 1);
  await page.evaluate(() => {
    const e = game.scene.getScene('CenaEfeitos');
    e.jogo.multiplayer.presentation = true;
    e.atualizarMarcasSindicato();
  });
  assert.equal(await page.evaluate(() => Math.abs([...game.scene.getScene('CenaEfeitos').marcasSindicato.values()][0].angle)), 180);
  await shot('12-orientacao-apresentacao');
  checks.push('Persistência após serialização, desktop 1366×768 e orientação da apresentação');
  assert.deepEqual(errors, [], 'Sem erros JavaScript no navegador');
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: browser.version(), checks, errors }, null, 2));
  await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  const failureShot = path.join(output, 'failure.png');
  if (fs.existsSync(failureShot)) fs.unlinkSync(failureShot);
  console.log(`Playwright: ${checks.length} verificações aprovadas; capturas e trace em output/sindicato/.`);
  checks.forEach(check => console.log(`✓ ${check}`));
}
run().catch(async error => {
  if (page) { await shot('failure').catch(() => {}); console.error(await page.evaluate(() => ({ phase: window.cena?.faseAtual, modal: window.cena?.modalAberto, locked: window.cena?.travado, canRead: window.cena?.podeConsultarCartas(), pending: window.cena?.efeitosVisuaisPendentes(), source: partida.jogador.campo.cartas[0], fields: cena.children.list.filter(o=>o.dadosCartaCampo).map(o=>({name:o.dadosCartaCampo.nome,input:o.input?.enabled,visible:o.visible,x:o.x,y:o.y})), sounds: window.qaSounds, event: game.scene.getScene('CenaEfeitos')?.eventoAtual })).catch(() => ({}))); }
  console.error(error); process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  assert.ok(path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.ok(path.basename(dataDir).startsWith('cyberduel-sindicato-playwright-'));
  fs.rmSync(dataDir, { recursive: true, force: true });
});
