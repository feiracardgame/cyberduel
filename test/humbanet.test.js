const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: {}, Phaser: { Scene: class {}, Utils: { Array: { Shuffle: c => c } } } });
for (const file of ['js/cartas.js', 'js/main.js', 'js/multiplayer.js', 'js/cenas/preload.js'])
  vm.runInContext(fs.readFileSync(file, 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
const { Carta, Jogador, Partida, monsters, terrains, effects } = vm.runInContext('({ Carta, Jogador, Partida, monsters: POOL_CARTAS_MONSTRO, terrains: POOL_CARTAS_TERRENO, effects: POOL_CARTAS_EFEITO })', context);
const codec = context.window.cyberduelMultiplayer;
let id = 30000;
const card = name => {
  const base = [...monsters, ...terrains, ...effects].find(c => c.nome === name);
  assert.ok(base, name);
  return new Carta(id++, base.poder || 0, terrains.includes(base) ? 'terreno' : effects.includes(base) ? 'efeito' : 'monstro', JSON.parse(JSON.stringify(base)));
};
const match = () => Object.assign(Object.create(Partida.prototype), { jogador: new Jogador(), inimigo: new Jogador(), historico: [], turno: 1, maxTurnos: 7, rodadasParaVencer: 4, rodadasJogador: 0, rodadasInimigo: 0 });
const put = (p, name, index, enemy = false) => { const c = card(name); (enemy ? p.inimigo : p.jogador).campo.adicionarCarta(c, index); return c; };
const update = p => { p.resolverEfeitosContinuos(p.jogador); p.resolverEfeitosContinuos(p.inimigo); };
const use = (p, c, a, b, enemy = false) => p.ativarHabilidade(c, enemy ? p.inimigo : p.jogador, enemy ? p.jogador : p.inimigo, a, b);

// Every finished artwork referenced by the design document belongs to a playable card.
const images = new Set([...monsters, ...terrains, ...effects].map(c => context.window.CYBERDUEL_IMAGE_ASSETS[c.imagem]));
for (const [, path] of fs.readFileSync('Cartas e boosters.md', 'utf8').matchAll(/src="(assets\/cartas\/[^\"]+)"/g))
  assert.ok(images.has(path), `Carta com arte pronta fora do catálogo: ${path}`);
assert.equal(monsters.length, 38);

// Orthogonal adjacency, removal, and stable continuous bonuses.
{
  const p = match(); put(p, 'IA de treinamento', 4);
  const near = put(p, 'O Tigre', 3), below = put(p, 'O Tigre', 9), wrap = put(p, 'O Tigre', 5);
  update(p); update(p);
  assert.equal(near.poder, 13); assert.equal(below.poder, 13); assert.equal(wrap.poder, 9);
  p.jogador.campo.removerCarta(4); update(p);
  assert.equal(near.poder, 9); assert.equal(below.poder, 9);
}
// HAL can disable passive characters and terrains, switch its single target, and restore on removal.
{
  const p = match(), hal = put(p, 'HAL 9001', 0), ia = put(p, 'IA de treinamento', 0, true);
  const target = put(p, 'O Tigre', 1, true), bug = put(p, 'Bug na Matrix', 9, true);
  update(p); assert.equal(target.poder, 15);
  assert.ok(use(p, hal, 0).sucesso); assert.equal(target.poder, 11); assert.equal(ia.efeitoDesabilitado, true);
  assert.equal(use(p, hal, 9).sucesso, false);
  hal.usadaEsteTurno = false; assert.ok(use(p, hal, 9).sucesso);
  assert.equal(ia.efeitoDesabilitado, false); assert.equal(bug.efeitoContinuo, null); assert.equal(target.poder, 13);
  const event = p.eventosEfeito.findLast(e => e.momento === 'habilidade');
  assert.ok(event.alvos.some(a => a.id === bug.id));
  const restored = codec.hydrateMatch(codec.swapSnapshot(codec.serializeMatch(p)));
  update(restored); assert.equal(restored.jogador.campo.cartas[9].efeitoDesabilitado, true);
  restored.inimigo.campo.removerCarta(0); update(restored);
  assert.equal(restored.jogador.campo.cartas[9].efeitoDesabilitado, false);
  assert.equal(restored.jogador.campo.cartas[1].poder, 15);
}
// Multiple HALs keep independent targets; a blocked HAL stops maintaining control.
{
  const p = match(), a = put(p, 'HAL 9001', 0), b = put(p, 'HAL 9001', 1);
  const first = put(p, 'O Porco', 0, true), second = put(p, 'O Tigre', 1, true), enemyHal = put(p, 'HAL 9001', 2, true);
  use(p, a, 0); use(p, b, 1);
  assert.ok(first.efeitoDesabilitado && second.efeitoDesabilitado);
  assert.ok(use(p, enemyHal, 0, null, true).sucesso);
  assert.equal(first.efeitoDesabilitado, false); assert.equal(second.efeitoDesabilitado, true);
  assert.equal(use(p, a, 2).sucesso, false);
  p.inimigo.campo.removerCarta(2); update(p); assert.equal(first.efeitoDesabilitado, true);
}
// Active terrain, hand renewal, turn reset, Humba protection, and silencing Humba itself.
{
  const p = match(), deep = put(p, 'DeepClaude ChatGemini', 0), povo = put(p, 'Povo da Areia', 1);
  const old = [card('O Rato'), card('O Tigre')], drawn = [card('A Cabra'), card('O Porco')];
  p.jogador.mao.cartas = [...old]; p.jogador.deck.cartas = [...drawn];
  assert.ok(use(p, deep).sucesso); assert.deepEqual(Array.from(p.jogador.mao.cartas), [...drawn].reverse());
  assert.ok(old.every(c => p.jogador.descarte.includes(c))); assert.equal(povo.poder, 4);
  assert.equal(use(p, deep).sucesso, false);
  p.fimTurno({ semIA: true }); assert.equal(deep.usadaEsteTurno, false);
  put(p, 'HumbaBrain', 0, true); update(p);
  assert.equal(use(p, deep).sucesso, false);
  const hal = put(p, 'HAL 9001', 2); use(p, hal, 0);
  assert.equal(deep.efeitoDesabilitado, false); assert.ok(use(p, deep).sucesso);
}
{
  const p = match(), rep = put(p, 'Replicantes', 0); put(p, 'Bug na Matrix', 1); put(p, 'Saloon', 1, true);
  put(p, 'HumbaBrain', 0, true); update(p); update(p);
  assert.equal(rep.poder, 13, 'Terrenos desabilitados continuam presentes e contam para Replicantes.');
  p.inimigo.campo.removerCarta(1); update(p); assert.equal(rep.poder, 10);
  const harvis = card('H.A.R.V.I.S'), next = card('A Cabra'); p.jogador.deck.cartas = [next];
  p.jogarCartaDoJogador(harvis, 2); assert.equal(p.jogador.mao.cartas.at(-1), next);
}
// Faro persists across snapshots, ignores terrain, and affects only the next character.
{
  const p = match(), dog = card('O Cão'); p.jogarCartaDoJogador(dog, 0);
  const r = codec.hydrateMatch(codec.swapSnapshot(codec.serializeMatch(p)));
  const terrain = card('Saloon'); r.jogarCartaDoJogador(terrain, 0);
  assert.equal(r.jogador.penalidadesInvocacao.length, 1);
  const target = card('O Tigre'); r.jogarCartaDoJogador(target, 5);
  assert.equal(target.poder, 6); assert.equal(r.jogador.penalidadesInvocacao.length, 0);
  const other = card('O Tigre'); r.jogarCartaDoJogador(other, 6); assert.equal(other.poder, 9);
  const event = r.eventosEfeito.find(e => e.mensagem?.startsWith('Faro'));
  assert.equal(event.alvos[0].indice, 5); assert.equal(event.lado, 'inimigo'); assert.equal(event.alvos[0].delta, -3);
}
// Povo counts only events since invocation, not earlier losses or discarded hands.
{
  const p = match(); p.jogador.cartasPerdidas = 3; p.jogador.efeitosUtilizados = 2;
  p.inimigo.cartasPerdidas = 4;
  const povo = put(p, 'Povo da Areia', 0); update(p); assert.equal(povo.poder, 4);
  put(p, 'O Rato', 1); p.jogador.campo.removerCarta(1); update(p); assert.equal(povo.poder, 5);
  const effect = card('O Canto do Galo'); p.jogador.mao.cartas.push(effect); p.jogador.jogarCartaEfeito(effect);
  update(p); assert.equal(povo.poder, 6);
  p.jogador.registrarDescarte(card('O Tigre'), false); update(p); assert.equal(povo.poder, 6);
  put(p, 'Saloon', 1); p.jogador.campo.removerCarta(1); update(p); assert.equal(povo.poder, 7);
  put(p, 'O Rato', 0, true); p.inimigo.campo.removerCarta(0); update(p); assert.equal(povo.poder, 8);
}
// Feio's own bonus must not be confused with an adjacent IA's bonus.
{
  const p = match(), bom = put(p, 'O Bom', 0), feio = put(p, "Tuh'Coh, O Feio", 1), mau = put(p, "Sen'Tenzhah, O Mau", 2);
  update(p); update(p); assert.equal(bom.poder, 10); assert.equal(feio.poder, 10); assert.equal(mau.poder, 9);
  p.jogador.campo.cartas[2] = null; p.jogador.campo.cartas[7] = mau; update(p);
  assert.equal(bom.poder, 7); assert.equal(feio.poder, 5); assert.equal(mau.poder, 6);
  p.jogador.campo.cartas[0] = null; put(p, 'IA de treinamento', 0); update(p);
  assert.equal(feio.poder, 9); assert.equal(mau.poder, 6);
  const bystander = put(p, 'O Tigre', 2); update(p); assert.equal(bystander.poder, 9);
}
// Updated floor and full recovery; blocked Porco temporarily loses its floor.
{
  const p = match(), porco = put(p, 'O Porco', 0); porco.buff(4); assert.equal(porco.buff(-2), -2); assert.equal(porco.poder, 8);
  assert.equal(porco.buff(-20), -2); assert.equal(porco.poder, 6);
  const hal = put(p, 'HAL 9001', 0, true); use(p, hal, 0, null, true);
  porco.buff(-3); assert.equal(porco.poder, 3);
  const medico = put(p, 'NeoMedicânico', 1), tigre = put(p, 'O Tigre', 2); tigre.buff(-7);
  use(p, medico, 2); assert.equal(tigre.poder, 9);
}
// A suspended Override keeps its source link after synchronization and perspective inversion.
{
  const p = match(), spider = put(p, 'A Aranha', 0), target = put(p, 'O Rato', 0, true);
  const hal = put(p, 'HAL 9001', 1, true);
  use(p, spider, 0); assert.equal(target.capturadaPor, p.jogador);
  use(p, hal, 0, null, true); p.atualizarOverrides(); assert.equal(target.capturadaPor, null);
  const restored = codec.hydrateMatch(codec.swapSnapshot(codec.serializeMatch(p)));
  assert.equal(restored.jogador.campo.cartas[0].capturadaPorAranha, restored.inimigo.campo.cartas[0]);
  restored.jogador.campo.removerCarta(1); restored.atualizarOverrides();
  assert.equal(restored.jogador.campo.cartas[0].capturadaPor, restored.inimigo);
}
// Poison pauses while its source is blocked, resumes after release, and preserves every source event.
{
  const p = match(), hal = put(p, 'HAL 9001', 0), target = put(p, 'O Tigre', 5);
  const cobra = put(p, 'A Cobra', 5, true), other = put(p, 'A Cobra', 6, true);
  use(p, cobra, 5, null, true); use(p, other, 5, null, true);
  use(p, hal, 5); p.resolverEfeitosDeTurno(); assert.equal(target.poder, 8);
  assert.equal(p.eventosEfeito.findLast(e => e.momento === 'veneno').fonte.id, other.id);
  p.jogador.campo.removerCarta(0); update(p);
  assert.ok(p.eventosEfeito.some(e => e.mensagem === 'Efeitos restaurados' && e.alvos.some(a => a.id === cobra.id)));
  const count = p.eventosEfeito.filter(e => e.momento === 'veneno').length;
  p.resolverEfeitosDeTurno(); assert.equal(target.poder, 6);
  assert.equal(p.eventosEfeito.filter(e => e.momento === 'veneno').length - count, 2);
}
{
  const p = match(), seller = put(p, 'CyberVendedor da RaspCorp', 0);
  assert.ok(use(p, seller, 0).sucesso); assert.equal(seller.poder, 4);
  assert.equal(use(p, seller, 0).sucesso, false);
  const analyst = card('NeoAnalista de Suporte Nível Alpha');
  assert.equal(analyst.efeito.valor, 15); assert.equal(analyst.efeito.minimo, 20);
  vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
  const scene = vm.runInContext('Object.create(CenaJogo.prototype)', context);
  scene.partida = p; scene.duracaoTurnoBase = 40000;
  p.inimigo.campo.adicionarCarta(analyst, 0);
  assert.equal(scene.duracaoPermitidaPara(p.jogador), 25000);
  put(p, 'NeoAnalista de Suporte Nível Alpha', 1, true);
  assert.equal(scene.duracaoPermitidaPara(p.jogador), 20000);
  const hal = put(p, 'HAL 9001', 1); use(p, hal, 0);
  assert.equal(scene.duracaoPermitidaPara(p.jogador), 25000);
}
console.log('HumbaNet, artes prontas, supressões, Faro, Povo, trio e novos valores validados.');
