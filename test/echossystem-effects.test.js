const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, window: {}, Phaser: {
  Scene: class {}, Utils: { Array: { Shuffle: (cards) => cards } },
} });
vm.runInContext(fs.readFileSync('js/cartas.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/main.js', 'utf8').split('const usarCanvasParaDiagnostico =')[0], context);
vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), context);
const { Partida, Jogador, Carta, pool, terrenos, T, CenaEfeitos, perfil } = vm.runInContext('({Partida,Jogador,Carta,pool:POOL_CARTAS_MONSTRO,terrenos:POOL_CARTAS_TERRENO,T:TIPOS_EFEITO,CenaEfeitos,perfil:APRESENTACAO_EFEITOS})', context);
const codec = context.window.cyberduelMultiplayer;
let id = 20000;
const create = (base) => new Carta(id++, base.poder, terrenos.includes(base) ? 'terreno' : 'monstro', JSON.parse(JSON.stringify(base)));
const card = (name) => create([...pool, ...terrenos].find((c) => c.nome === name));
const match = () => { return Object.assign(Object.create(Partida.prototype), { jogador: new Jogador(), inimigo: new Jogador(), turno: 1, maxTurnos: 7, rodadasParaVencer: 4, rodadasJogador: 0, rodadasInimigo: 0, partidaEncerrada: false, historico: [] }); };

// A armadilha revela o Macaco após a invocação; o piso do Porco também produz evento visual.
{
  const p = match(), pig = card('O Porco');
  const trap = vm.runInContext('POOL_CARTAS_EFEITO.find(c => c.nome === "A Travessura do Macaco")', context);
  const monkey = new Carta(id++, trap.poder, 'efeito', trap);
  p.aplicarEfeitoInvocacao(monkey, p.jogador, p.inimigo, null, 5);
  assert.ok(p.eventosEfeito.at(-1).alvos.some(a => a.armadilha && a.indice === 5 && a.lado === 'inimigo'));
  p.inimigo.campo.adicionarCarta(pig, 5);
  p.registrarHistorico(pig, 'inimigo');
  const events = p.eventosEfeito.slice(-2);
  assert.equal(events[0].momento, 'invocacao');
  assert.equal(events[1].momento, 'armadilha');
  assert.equal(events[1].fonte.nome, 'A Travessura do Macaco');
  assert.equal(events[1].alvos[0].cascaGrossa, true);
  assert.equal(pig.poder, 6);
  assert.equal(p.inimigo.campo.armadilhas.has(5), false);
  const swapped = codec.swapSnapshot(codec.serializeMatch(p)).eventosEfeito.at(-1);
  assert.equal(swapped.lado, 'inimigo');
  assert.equal(swapped.alvos[0].lado, 'jogador');
}
{
  const p = match(), pig = card('O Porco'), tiger = card('O Tigre');
  pig.buff(1); p.inimigo.campo.cartas[5] = pig; p.jogador.campo.cartas[5] = tiger;
  p.ativarHabilidade(tiger, p.jogador, p.inimigo, 5);
  const target = p.eventosEfeito.findLast(e => e.momento === 'habilidade').alvos.find(a => a.id === pig.id);
  assert.equal(target.delta, -1); assert.equal(target.cascaGrossa, true);
}
console.log('Armadilha, ordem de revelação e proteção parcial do Porco validadas no motor e na perspectiva remota.');

// Faro não acumula, mas pode voltar a penalizar após consumir a marca anterior.
{
  const p = match();
  for (let i = 0; i < 3; i++) p.aplicarEfeitoInvocacao(card('O Cão'), p.jogador, p.inimigo);
  assert.equal(p.inimigo.penalidadesInvocacao.length, 1);
  const target = card('Agente da DIPSP'), original = target.poder;
  const penalty = p.inimigo.penalidadesInvocacao[0].valor;
  p.inimigo.campo.adicionarCarta(target, 5);
  assert.equal(target.poder, original - penalty);
  assert.equal(p.inimigo.penalidadesInvocacao.length, 0);
  const second = card('Agente da DIPSP');
  p.inimigo.campo.adicionarCarta(second, 6);
  assert.equal(second.poder, original);
  p.aplicarEfeitoInvocacao(card('O Cão'), p.jogador, p.inimigo);
  assert.equal(p.inimigo.penalidadesInvocacao.length, 1);
}
// Povo da Areia só cresce por perdas do campo ou cartas de efeito consumidas.
for (const side of ['jogador', 'inimigo']) {
  let p = match();
  const sand = card('Povo da Areia');
  p.jogador.campo.adicionarCarta(sand, 0);
  const refresh = () => { p.resolverEfeitosContinuos(p.jogador); p.resolverEfeitosContinuos(p.inimigo); };
  refresh();
  const ally = card('Agente da DIPSP'); p[side].mao.cartas.push(ally);
  p[side].jogarCarta(ally, 5); refresh();
  assert.equal(sand.poder, 4, 'Invocar personagem não conta.');
  assert.equal(p[side].jogarCartaEfeito(ally), false, 'Personagem não é carta de efeito.');
  refresh(); assert.equal(sand.poder, 4);
  const other = side === 'jogador' ? 'inimigo' : 'jogador';
  const target = card('Agente da DIPSP'); target.poder = 30;
  p[other].campo.adicionarCarta(target, 5);
  assert.equal(p.ativarHabilidade(ally, p[side], p[other], 5).sucesso, true);
  refresh(); assert.equal(sand.bonusEfeitoContinuo, 0, 'Habilidade sem morte não aciona o bônus.');
  const invalidEffect = card('O Cão'); p[side].mao.cartas.push(invalidEffect);
  assert.equal(p[side].jogarCartaEfeito(invalidEffect), false);
  assert.ok(p[side].mao.cartas.includes(invalidEffect));
  const drawn = card('O Tigre'); p[side].deck.cartas.push(drawn); p[side].comprarCarta();
  p[side].registrarDescarte(drawn, false); refresh();
  assert.equal(sand.poder, 4, 'Comprar/descartar da mão não conta.');
  const ground = card('Saloon'); p[side].campo.adicionarCarta(ground, 1); refresh();
  assert.equal(sand.bonusEfeitoContinuo, 0, 'Invocar terreno não conta.');
  p[side].campo.removerCarta(1); refresh();
  assert.equal(sand.bonusEfeitoContinuo, 1, 'Remover terreno conta uma vez.');
  ally.poder = 0; p[side].campo.removerMortas(); refresh();
  assert.equal(sand.bonusEfeitoContinuo, 2, 'Morte conta uma vez.');
  const effect = new Carta(id++, 0, 'efeito', { nome: 'Teste' });
  p[side].mao.cartas.push(effect); assert.equal(p[side].jogarCartaEfeito(effect), true); refresh();
  assert.equal(sand.bonusEfeitoContinuo, 3, 'Conjurar efeito conta uma vez.');
  assert.equal(p[side].jogarCartaEfeito(effect), false);
  for (let i = 0; i < 4; i++) refresh();
  assert.equal(sand.bonusEfeitoContinuo, 3, 'Recálculo não acumula bônus.');
  p = codec.hydrateMatch(codec.serializeMatch(p)); refresh();
  assert.equal(p.jogador.campo.cartas[0].bonusEfeitoContinuo, 3, 'Sincronização preserva o bônus.');
}
console.log('Faro sem acúmulo e gatilhos do Povo da Areia nos dois lados validados.');
