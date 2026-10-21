// Barras móveis, teclado e rotação podem reduzir a área visível sem mudar 100vh.
(function (global) {
  let logicalWidth = 720;
  let logicalHeight = 1480;
  let game = null;
  let frame = null;
  let fullscreenPending = false;

  function update() {
    frame = null;
    const viewport = global.visualViewport;
    const style = global.getComputedStyle?.(document.documentElement);
    const left = parseFloat(style?.getPropertyValue("--safe-area-left")) || 0;
    const right = parseFloat(style?.getPropertyValue("--safe-area-right")) || 0;
    const top = parseFloat(style?.getPropertyValue("--safe-area-top")) || 0;
    const bottom = parseFloat(style?.getPropertyValue("--safe-area-bottom")) || 0;
    const width = Math.max(1, Math.min(global.innerWidth || Infinity,
      viewport?.width || global.innerWidth || document.documentElement.clientWidth) - left - right);
    const height = Math.max(1, Math.min(global.innerHeight || Infinity,
      viewport?.height || global.innerHeight || document.documentElement.clientHeight) - top - bottom);
    const fit = Math.min(width / logicalWidth, height / logicalHeight);
    const values = {
      "--viewport-width": width,
      "--viewport-height": height,
      "--viewport-left": (viewport?.offsetLeft || 0) + left,
      "--viewport-top": (viewport?.offsetTop || 0) + top,
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

  async function fullscreenOnTouch(event) {
    const root = document.documentElement;
    if (fullscreenPending || !global.matchMedia?.("(pointer: coarse)")?.matches ||
        document.fullscreenElement || document.webkitFullscreenElement || global.navigator?.standalone ||
        global.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)")?.matches ||
        event.target?.closest?.("input, textarea, select, [contenteditable], a, .title-google-login")) return;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    fullscreenPending = true;
    try {
      await request.call(root, { navigationUI: "hide" });
      global.removeEventListener("pointerup", fullscreenOnTouch, true);
      schedule();
    } catch {
      fullscreenPending = false;
    }
  }

  global.addEventListener("resize", schedule);
  global.addEventListener("orientationchange", schedule);
  global.addEventListener("pointerup", fullscreenOnTouch, { capture: true, passive: true });
  document.addEventListener("fullscreenchange", schedule);
  document.addEventListener("webkitfullscreenchange", schedule);
  global.visualViewport?.addEventListener("resize", schedule);
  global.visualViewport?.addEventListener("scroll", schedule);
  global.cyberduelViewport = {
    configure(width, height) { logicalWidth = width; logicalHeight = height; update(); },
    attach(value) { game = value; update(); },
    update,
  };
  update();
})(window);
