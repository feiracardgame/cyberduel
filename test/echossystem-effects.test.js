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
