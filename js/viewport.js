// Barras móveis, teclado e rotação podem reduzir a área visível sem mudar 100vh.
(function (global) {
  let logicalWidth = 720;
  let logicalHeight = 1480;
  let game = null;
  let frame = null;

  function update() {
    frame = null;
    const viewport = global.visualViewport;
    const width = Math.max(1, Math.min(global.innerWidth || Infinity,
      viewport?.width || global.innerWidth || document.documentElement.clientWidth));
    const height = Math.max(1, Math.min(global.innerHeight || Infinity,
      viewport?.height || global.innerHeight || document.documentElement.clientHeight));
    const fit = Math.min(width / logicalWidth, height / logicalHeight);
    const values = {
      "--viewport-width": width,
      "--viewport-height": height,
      "--viewport-left": viewport?.offsetLeft || 0,
      "--viewport-top": viewport?.offsetTop || 0,
      "--game-display-width": logicalWidth * fit,
      "--game-display-height": logicalHeight * fit,
    };
    for (const [name, value] of Object.entries(values))
      document.documentElement.style.setProperty(name, `${value}px`);
    if (game?.isBooted) game.scale?.setParentSize(width, height);
  }

  function schedule() {
    if (frame === null) frame = global.requestAnimationFrame(update);
  }

  global.addEventListener("resize", schedule);
  global.addEventListener("orientationchange", schedule);
  global.visualViewport?.addEventListener("resize", schedule);
  global.visualViewport?.addEventListener("scroll", schedule);
  global.cyberduelViewport = {
    configure(width, height) { logicalWidth = width; logicalHeight = height; update(); },
    attach(value) { game = value; update(); },
    update,
  };
  update();
})(window);
