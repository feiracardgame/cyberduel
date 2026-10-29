const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ window: {}, console: { log() {} },
  Phaser: { Scene: class {}, Utils: { Array: { Shuffle: cards => cards } } } });
for (const file of ['js/cartas.js', 'js/main.js', 'js/cenas/jogo.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
const Scene = vm.runInContext('CenaJogo', context);
const createCard = vm.runInContext(`name => {
  const base = POOL_CARTAS_MONSTRO.find(c => c.nome === name);
  return new Carta(1, base.poder, 'monstro', { ...base });
}`, context);
const partida = vm.runInContext('new Partida(null, true)', context);
const layout = vm.runInContext('LAYOUT_CAMPO_NORMAL', context);
const shapes = [];
const scene = Object.assign(Object.create(Scene.prototype), {
  partida, layout, visualSelecaoCarta: { objetos: [] },
  input: { off() {} }, tweens: { killTweensOf() {} },
  add: { rectangle(x, y, width, height, color, alpha) {
    const shape = { x, y, width, height, alpha, active: true,
      setStrokeStyle(width, color, alpha) { this.strokeAlpha = alpha; return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setName(name) { this.name = name; return this; },
      destroy() { this.active = false; },
    };
    shapes.push(shape); return shape;
  } },
});
function preview(name, origin, own = true) {
  scene.limparSelecaoCartaCampo(true);
  assert.ok(shapes.every(shape => !shape.active), 'A seleção anterior remove todas as áreas.');
  shapes.length = 0;
  scene.visualSelecaoCarta = { objetos: [] };
  partida.jogador.campo.cartas.fill(null); partida.inimigo.campo.cartas.fill(null);
  const card = createCard(name);
  const owner = own ? partida.jogador : partida.inimigo;
  const opponent = own ? partida.inimigo : partida.jogador;
  owner.campo.cartas[origin] = card;
  scene.criarVisualAlcanceCarta({ dadosCartaCampo: card });
  const rows = own ? layout.yInimigo : layout.yJogador;
  const indices = shapes.map(shape => layout.x.indexOf(shape.x) + 5 * rows.indexOf(shape.y));
  assert.ok(shapes.every(shape => shape.alpha < 0.2 && shape.strokeAlpha < 0.8 && !shape.input),
    'O alcance é sutil, sem bloquear cliques ou exigir animação contínua.');
  // Os mesmos espaços, quando ocupados, precisam ser os alvos do motor real.
  opponent.campo.cartas.fill(null);
  if (indices.length) {
    for (let i = 0; i < 10; i++) opponent.campo.cartas[i] = createCard('O Tigre');
    const targets = Array.from(partida.alvosParaHabilidadeEmCampo(card, owner, opponent));
    const enemyTargets = card.efeito.alvo === 'qualquer' ? targets.filter(i => i >= 10).map(i => i - 10) : targets;
    assert.deepEqual(enemyTargets, indices);
  }
  return indices;
}
assert.deepEqual(preview('O Tigre', 7), [5, 6, 7, 8, 9]);
assert.deepEqual(preview('O Tigre', 2), [], 'Ataque V1 não alcança inimigos a partir da fileira de trás.');
assert.deepEqual(preview('UCC "Juggernaut"', 7), [1, 2, 3, 6, 7, 8]);
assert.deepEqual(preview('UCC "Juggernaut"', 2), [6, 7, 8]);
assert.deepEqual(preview('Agente da DIPSP', 5), [0, 1, 5, 6], 'O alcance não atravessa as bordas do campo.');
assert.deepEqual(preview('O Bom', 2), [1, 2, 3, 6, 7, 8]);
assert.deepEqual(preview("Dieh'Go, o Xerife", 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(preview('O Rato', 7), [6, 7, 8]);
assert.deepEqual(preview('A Cobra', 0), [0, 1, 2, 5, 6, 7]);
assert.deepEqual(preview('O Tigre', 7, false), [5, 6, 7, 8, 9], 'Carta inimiga revelada indica o alcance no campo oposto.');
assert.deepEqual(preview('Influenciador Digital', 7), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(preview('TecnoAgentes de Segurança', 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(preview('NeoMedicânico', 7), [], 'Cura aliada não mostra alcance de ataque.');
assert.deepEqual(preview('CyberVendedor da RaspCorp', 7), [], 'Buff aliado não pinta o campo inimigo.');
assert.deepEqual(preview('Estagiário de Machine Learning', 7), [], 'Carta sem ataque não mostra alcance.');
console.log('Alcance: fileiras, colunas, bordas, espaços vazios, ataques globais, campos espelhados e limpeza validados.');
