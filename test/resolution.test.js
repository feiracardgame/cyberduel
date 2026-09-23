const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sceneSource = fs.readFileSync('js/cenas/jogo.js', 'utf8');
const mainSource = fs.readFileSync('js/main.js', 'utf8');
const renderSource = mainSource.slice(mainSource.indexOf('const usarCanvasParaDiagnostico'));
for (const [width, height] of [[720, 1480], [1080, 2160], [720, 1280]]) {
  for (const quality of ['high', 'mobile']) {
    const styles = {};
    const context = vm.createContext({
      console: { log() {} }, URLSearchParams,
      window: { location: { search: `?quality=${quality}` } },
      document: { documentElement: { style: { setProperty(k, v) { styles[k] = v; } } } },
      Phaser: { Scene: class {}, Scale: {}, Game: class {} },
      CenaPreload: class {}, CenaTitulo: class {}, CenaDeckBuilder: class {}, CenaTransicao: class {},
    });
    vm.runInContext(sceneSource.replace(/const GW = \d+;/, `const GW = ${width};`).replace(/const GH = \d+;/, `const GH = ${height};`), context);
    vm.runInContext(renderSource, context);
    const result = vm.runInContext(`(() => {
      const camera = {
        setZoom(x,y) { this.zoomX=x; this.zoomY=y; },
        centerOn(x,y) { this.cx=x; this.cy=y; },
        getWorldPoint(x,y) { return {x:x/this.zoomX,y:y/this.zoomY}; },
      };
      const scene = new CenaJogo();
      scene.add = {text() {}}; scene.cameras = {main:camera};
      configurarCameraLogica(scene);
      return {camera, width:LARGURA_LAYOUT, height:ALTURA_LAYOUT,
        render:window.CYBERDUEL_RENDER_PROFILE,
        point:scene.pontoDoPonteiro({x:LARGURA_RENDER/2,y:ALTURA_RENDER/2}),
        layouts:[LAYOUT_CAMPO_NORMAL,LAYOUT_CAMPO_AMPLIADO], hand:Y_MAO_JOGADOR};
    })()`, context);
    const scale = quality === 'mobile' ? 2/3 : 1;
    assert.equal(result.render.width, Math.round(width*scale));
    assert.equal(result.render.height, Math.round(height*scale));
    assert.equal(result.width*result.camera.zoomX, result.render.width);
    assert.equal(result.height*result.camera.zoomY, result.render.height);
    assert.equal(result.point.x, result.width/2);
    assert.equal(result.point.y, result.height/2);
    for (const layout of result.layouts) {
      assert.ok(layout.x[0]-layout.slotW/2 >= 0, 'Primeira coluna visível');
      assert.ok(layout.x[4]+layout.slotW/2 <= result.width, 'Última coluna visível');
      assert.ok(layout.yJogadorTras+layout.slotH/2 < result.height, 'Campo inteiro visível');
    }
    assert.ok(result.hand+150 < result.height, 'Mão dentro da tela');
    assert.equal(styles['--game-width-vh'], `${100*width/height}vh`);
    assert.equal(styles['--game-height-vw'], `${100*height/width}vw`);
  }
}
console.log('Resolução, limites do campo/mão, câmera, ponteiro e proporção HTML validados nos dois perfis.');

for (const [viewportWidth, viewportHeight, dpr, quality, expectedWidth] of [
  [390, 844, 3, '', 720],
  [360, 780, 2, '', 720],
  [430, 932, 3, '', 720],
  [390, 844, 4, '', 720],
  [390, 844, 3, 'mobile', 480],
  [390, 844, 3, 'high', 1080],
  [1920, 1080, 1, '', 720],
  [844, 390, 3, '', 720],
]) {
  const context = vm.createContext({
    console: { log() {} }, URLSearchParams,
    navigator: { maxTouchPoints: 5 },
    window: { location: { search: quality ? `?quality=${quality}` : '' },
      innerWidth: viewportWidth, innerHeight: viewportHeight, devicePixelRatio: dpr,
      screen: { width: viewportWidth, height: viewportHeight } },
    Phaser: { Scene: class {}, Scale: {}, Game: class {} },
    CenaPreload: class {}, CenaTitulo: class {}, CenaDeckBuilder: class {}, CenaTransicao: class {},
  });
  vm.runInContext(sceneSource, context);
  vm.runInContext(renderSource, context);
  const profile = context.window.CYBERDUEL_RENDER_PROFILE;
  assert.equal(profile.width, expectedWidth, `Resolução em ${viewportWidth}×${viewportHeight}, DPR ${dpr}, ${quality || 'auto'}`);
  assert.ok(profile.width * profile.height <= 1080 * 2220, 'Limitar pixels em aparelhos de alta densidade.');
  assert.equal(vm.runInContext('config.render.roundPixels', context), false);
  if (profile.mobile) {
    assert.ok(profile.width * profile.height <= 720 * 1480, 'Celular não excede a resolução base.');
    assert.equal(vm.runInContext('config.fps.limit', context), 60, 'Limitar trabalho em telas de 90/120 Hz.');
  } else {
    assert.equal(vm.runInContext('config.fps.limit', context), 0);
  }
}
console.log('Nitidez automática, limite de pixels, orientação e perfil econômico validados.');
