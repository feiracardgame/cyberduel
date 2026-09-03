const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({
  window: {},
  Phaser: { Scene: class {} },
});
vm.runInContext(fs.readFileSync("js/cenas/preload.js", "utf8"), context, {
  filename: "js/cenas/preload.js",
});

const original = context.window.CYBERDUEL_IMAGE_ASSETS;
const game = context.window.CYBERDUEL_GAME_IMAGE_ASSETS;
const cardEntries = Object.entries(original).filter(([, url]) =>
  url.startsWith("assets/cartas/"),
);

assert.ok(cardEntries.length >= 20);
let optimizedBytes = 0;
for (const [key, originalUrl] of cardEntries) {
  const optimizedUrl = game[key].split("?")[0];
  assert.notEqual(optimizedUrl, originalUrl);
  assert.match(optimizedUrl, /^assets\/cartas\/game\/.*\.webp$/i);
  assert.ok(fs.existsSync(originalUrl), `Arte original ausente: ${originalUrl}`);
  assert.ok(
    fs.existsSync(optimizedUrl),
    `Textura otimizada ausente: ${optimizedUrl}`,
  );
  optimizedBytes += fs.statSync(optimizedUrl).size;
}

assert.ok(
  optimizedBytes < 5 * 1024 * 1024,
  "O conjunto de texturas da partida deve permanecer abaixo de 5 MiB.",
);
assert.ok(fs.existsSync("assets/videos/game/parte_3-720p.mp4"));
assert.ok(
  fs.statSync("assets/videos/game/parte_3-720p.mp4").size < 2 * 1024 * 1024,
  "O loop móvel deve permanecer abaixo de 2 MiB.",
);

console.log("Texturas e vídeo otimizados da partida validados.");
