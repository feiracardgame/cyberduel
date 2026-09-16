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
