const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const properties = {}, listeners = {}, viewportListeners = {};
let pending, refreshes = 0;
const window = {
  innerWidth: 390, innerHeight: 844,
  visualViewport: { width: 390, height: 700, offsetLeft: 0, offsetTop: 0,
    addEventListener: (key, callback) => viewportListeners[key] = callback },
  addEventListener: (key, callback) => listeners[key] = callback,
  requestAnimationFrame: callback => { pending = callback; return 1; },
};
vm.runInNewContext(fs.readFileSync('js/viewport.js', 'utf8'), {
  window, document: { documentElement: { style: { setProperty: (k,v) => properties[k] = parseFloat(v) } } },
});
const api = window.cyberduelViewport;
api.configure(720,1480);
api.attach({ isBooted: true, scale: { setParentSize: (width, height) => {
  assert.equal(width, properties["--viewport-width"]);
  assert.equal(height, properties["--viewport-height"]);
  refreshes++;
} } });
assert.equal(properties['--viewport-height'],700);
assert.equal(properties['--game-display-height'],700);
assert.ok(properties['--game-display-width']<=390);
window.visualViewport.height=410;
viewportListeners.resize(); viewportListeners.scroll(); pending();
assert.equal(properties['--game-display-height'],410);
window.innerWidth=844;window.innerHeight=390;
window.visualViewport.width=844;window.visualViewport.height=320;
listeners.orientationchange();pending();
assert.equal(properties['--game-display-height'],320);
assert.ok(properties['--game-display-width']<=844);
window.visualViewport.offsetTop=24;window.visualViewport.offsetLeft=10;
viewportListeners.scroll();pending();
assert.equal(properties['--viewport-top'],24);assert.equal(properties['--viewport-left'],10);
window.visualViewport=null;listeners.resize();pending();
assert.equal(properties['--viewport-height'],390);
assert.equal(properties['--viewport-top'],0);
assert.ok(refreshes>=5);
console.log('Viewport: barras móveis, teclado, orientação, deslocamento e fallback sem VisualViewport validados.');
