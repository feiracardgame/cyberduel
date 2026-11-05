const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('phaser.js', 'utf8');
function method(name) {
  const start = source.indexOf(`    ${name}: function ()`);
  assert.ok(start >= 0);
  const end = source.indexOf('\n    },', start);
  return vm.runInNewContext('(' + source.slice(start, end).trim().replace(`${name}: `, '') + '\n})', { Uint8Array, window: { setTimeout: fn => fn() } });
}

const processTexture = method('_processTexture');
for (const pixels of [null, new Uint8Array([255, 128, 64, 128]), { width: 1, height: 1 }]) {
  let flags, upload, mipmaps = 0;
  const texture = {
    pixels, width: 1, height: 1, flipY: true, pma: true,
    renderer: {
      glTextureUnits: { bind() {} },
      glWrapper: { updateTexturing(value) { flags = value.texturing; } },
      gl: { texParameteri() {}, texImage2D(...args) { upload = args; } },
    },
    generateMipmap() { mipmaps++; },
  };
  processTexture.call(texture);
  const domSource = pixels !== null && !(pixels instanceof Uint8Array);
  assert.equal(flags.flipY, domSource, 'Inverte apenas imagens DOM.');
  assert.equal(flags.premultiplyAlpha, domSource, 'Pré-multiplica apenas imagens DOM.');
  assert.equal(upload.length, domSource ? 6 : 9);
  assert.equal(upload.at(-1), pixels, 'Preserva os dados enviados à GPU.');
  assert.equal(mipmaps, 1);
}

const onGameVisible = method('onGameVisible');
let resumes = 0, suspends = 0;
const context = { resume() { resumes++; }, suspend() { suspends++; } };
onGameVisible.call({ locked: true, context });
assert.equal(resumes + suspends, 0, 'Voltar à aba não desbloqueia áudio sem gesto.');
onGameVisible.call({ locked: false, context });
assert.equal(resumes, 1, 'Preserva a recuperação de áudio após desbloquear.');
assert.equal(suspends, 1);
console.log('Phaser: upload de texturas e retorno à aba com áudio bloqueado validados.');
