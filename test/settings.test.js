const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const saved = new Map();
const localStorage = {
  getItem: (key) => saved.get(key) || null,
  setItem: (key, value) => saved.set(key, value),
};
const context = vm.createContext({ console, window: {}, localStorage, setTimeout });
vm.runInContext(fs.readFileSync("js/settings.js", "utf8"), context, {
  filename: "js/settings.js",
});

const settings = context.window.cyberduelSettings;
assert.equal(settings.get("textScale"), 1.12, "O texto deve nascer maior no celular.");
assert.equal(settings.phaserTextStyle({ fontSize: "20px" }).fontSize, "22.4px");
assert.equal(settings.effects(1), 0.85 * 0.9);

settings.set("textScale", 1.25);
settings.set("masterVolume", 0.5);
assert.equal(settings.get("textScale"), 1.25);
assert.equal(settings.music(1), 0.5 * 0.75);
assert.match(saved.get("cyberduel.settings.v1"), /"textScale":1.25/);

settings.set("textScale", 9);
assert.equal(settings.get("textScale"), 1.35, "A escala deve ser limitada para não quebrar a UI.");

console.log("Volume e escala de texto persistentes validados.");
