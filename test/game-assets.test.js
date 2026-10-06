const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({
  window: {},
  Phaser: { Scene: class {} },
});
vm.runInContext(fs.readFileSync("js/battle-announcements.js", "utf8"), context);
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
  optimizedBytes < 6 * 1024 * 1024,
  "O conjunto de texturas da partida deve permanecer abaixo de 6 MiB, incluindo as novas artes da HumbaNet.",
);
const background = "assets/videos/background_cidade.mp4";
assert.ok(fs.existsSync(background));
assert.ok(fs.statSync(background).size > 0, "O vídeo da cidade não pode estar vazio.");
assert.ok(fs.readFileSync("js/cenas/preload.js", "utf8").includes(`${background}?v=`),
  "O preload deve carregar o novo fundo da cidade.");

console.log("Texturas otimizadas e novo vídeo de fundo da partida validados.");

for (const name of ['aranha', 'boi', 'cabra', 'cao', 'cavalo', 'cobra', 'coelho', 'galo', 'macaco', 'porco', 'rato', 'tigre']) {
  const key = 'efeito' + name[0].toUpperCase() + name.slice(1);
  assert.equal(game[key], `assets/efeitos/efeito-${name}.png`);
  assert.ok(fs.existsSync(game[key]), `Símbolo ausente: ${name}`);
}
console.log('Os 12 novos efeitos estão no catálogo de carregamento.');

const preloadVideos = [], preloadSounds = [];
const Preload = vm.runInContext('CenaPreload', context);
Preload.prototype.carregarAssets.call({ load: {
  image() {}, audio(key, url) { preloadSounds.push([key, url]); }, video(key, url) { preloadVideos.push([key, url]); },
} });
assert.ok(preloadVideos.some(([key, url]) => key === 'videoEfeitoJuggernaut' && url.split('?')[0] === 'assets/efeitos/efeito-juggernaut-alpha.webm'));
assert.ok(preloadVideos.some(([key, url]) => key === 'videoEfeitoBoi' && url === 'assets/efeitos/efeito-boi-alpha.webm'));
assert.ok(fs.statSync('assets/efeitos/efeito-boi-alpha.webm').size > 0);
console.log('Boi carrega a versão transparente do vídeo.');

for (const [key, url] of [...preloadVideos, ...preloadSounds]) {
  assert.ok(fs.statSync(url.split('?')[0]).size > 0, `Asset ausente: ${key} (${url})`);
}
vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), context);
const profiles = vm.runInContext('APRESENTACAO_EFEITOS', context);
for (const profile of Object.values(profiles)) {
  for (const value of Object.values(profile)) {
    if (typeof value === 'string' && value.startsWith('som'))
      assert.ok(preloadSounds.some(([key]) => key === value), `Som não carregado: ${value}`);
  }
  if (profile.video) assert.ok(preloadVideos.some(([key]) => key === profile.video));
}
assert.ok(fs.statSync('assets/fontes/Rushblade.ttf').size > 0);
console.log('Sons, vídeos de todos os perfis e fonte local disponíveis.');
