const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const animations = [];
class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.attributes = {}; this.classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)) };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  set src(value) { this.attributes.src = value; }
  getAttribute(name) { return this.attributes[name]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener() {}
  append(...children) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } }
  insertBefore(child, reference) {
    this.insertions = (this.insertions || 0) + 1;
    child.remove(); child.parent = this;
    this.children.splice(reference ? this.children.indexOf(reference) : this.children.length, 0, child);
  }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; } }
  querySelectorAll(query) { return this.children.filter(child => query.split(',').some(selector => child.classes.has(selector.trim().slice(1)))); }
  querySelector(query) { return this.querySelectorAll(query)[0]; }
  getBoundingClientRect() { return { top: (this.parent?.children.indexOf(this) || 0) * 50 }; }
  animate(frames) { animations.push({ row: this, frames }); return { finished: Promise.resolve() }; }
}
const parts = { '#leaderboard-rows': new Element(), '#leaderboard-status': new Element(), '#leaderboard-empty': new Element() };
const root = new Element(); root.querySelector = query => parts[query];
const media = { matches: true };
let clock = 0;
const context = vm.createContext({
  window: { matchMedia: () => media },
  document: { createElement: () => new Element(), querySelector: () => null },
  Intl, setTimeout: callback => { callback(); return 0; },
  performance: { now: () => clock }, requestAnimationFrame: callback => { clock += 1200; callback(clock); },
});
vm.runInContext(fs.readFileSync('js/leaderboard.js', 'utf8'), context);
const board = new context.window.CyberduelLeaderboard(root);
const entry = (username, rating = 1000) => ({ username, nickname: 'Mesmo apelido', rating, avatar: '' });
async function run() {
  await board.update([entry('one', 2000), entry('two', 1800)]);
  const one = board.rows.get('one'), two = board.rows.get('two');
  const scrolling = {};
  one.parts.nameViewport.clientWidth = 100;
  one.parts.name.scrollWidth = 180;
  one.parts.name.style = { setProperty: (key, value) => scrolling[key] = value };
  board.updateNameScrolling();
  assert.equal(one.parts.nameViewport.classes.has('is-scrolling'), true);
  assert.equal(scrolling['--name-overflow'], '80px');
  one.parts.name.scrollWidth = 70;
  board.updateNameScrolling();
  assert.equal(one.parts.nameViewport.classes.has('is-scrolling'), false, 'Nome curto permanece parado.');
  assert.equal(board.rows.size, 2, 'Apelidos repetidos não combinam os jogadores.');
  assert.equal(parts['#leaderboard-rows'].children.length, 10, 'Mantém dez posições no painel.');
  const insertions = parts['#leaderboard-rows'].insertions;
  await board.update([entry('one', 2000), entry('two', 1800)]);
  assert.equal(parts['#leaderboard-rows'].insertions, insertions, 'Atualização sem mudança preserva as linhas e a animação dos nomes.');
  await board.update([entry('two', 2100), entry('one', 1900)]);
  assert.equal(parts['#leaderboard-rows'].children[0], two, 'A linha existente acompanha o jogador na troca.');
  assert.equal(board.rows.get('one'), one);
  assert.equal(two.parts.score.textContent, '2.100');
  assert.equal(animations.length, 0, 'Movimento reduzido atualiza sem animação.');
  media.matches = false;
  await board.update([entry('one', 2200), entry('two', 2100)]);
  assert.equal(animations.length, 2, 'Anima ambas as linhas quando trocam de posição.');
  assert.equal(one.parts.score.textContent, '2.200');
  animations.length = 0;
  await board.update([entry('one', 2300), entry('two', 2100)]);
  assert.equal(animations.length, 0, 'Pontuação sem troca não move as linhas.');
  assert.equal(one.parts.score.textContent, '2.300');
  await board.update([entry('new', 2400), entry('one', 2300)]);
  assert.equal(board.rows.has('two'), false, 'Remove quem saiu do top 10.');
  assert.equal(parts['#leaderboard-rows'].children[0], board.rows.get('new'));
  const rename = { ...entry('new', 2400), nickname: '<b>Nome alterado</b>' };
  await board.update([rename, entry('one', 2300)]);
  assert.equal(board.rows.get('new').parts.name.textContent, rename.nickname, 'Nomes são texto, sem interpretar HTML.');
  await board.update(Array.from({ length: 12 }, (_, i) => entry(`player${i}`, 3000 - i)));
  assert.equal(board.rows.size, 10, 'Exibe somente os dez primeiros.');
  await board.update([]);
  assert.equal(board.rows.size, 0);
  assert.equal(parts['#leaderboard-empty'].hidden, false);
  assert.equal(parts['#leaderboard-rows'].children.length, 10);
  animations.length = 0;
  await board.update([entry('first')]);
  assert.equal(animations.length, 1, 'Anima a entrada do primeiro jogador após um ranking vazio.');
  console.log('Leaderboard: identidade, reordenação, animações, pontos, entrada/saída, top 10 e movimento reduzido validados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
