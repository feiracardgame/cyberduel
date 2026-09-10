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

// Every available character has a public, ordered summon event, even passive-only characters.
for (const base of pool) {
  const p = match(), source = create(base);
  p.jogador.mao.cartas.push(source);
  assert.ok(p.colocarCartaDoJogador(source, 5));
  assert.equal(p.eventosEfeito.at(-1).fonte.nome, base.nome);
  assert.equal(p.eventosEfeito.at(-1).momento, 'invocacao');
}

let activeCount = 0;
for (const base of pool.filter((c) => c.habilidadeAtiva)) {
  const p = match(), source = create(base);
  p.jogador.campo.cartas[5] = source;
  p.jogador.campo.cartas[1] = card('O Tigre');
  p.jogador.campo.cartas[1].poder = 7;
  p.jogador.campo.cartas[1].usadaEsteTurno = true;
  p.jogador.campo.cartas[2] = card('O Rato');
  p.inimigo.campo.cartas[0] = card('Saloon');
  for (let i = 1; i < 10; i++) p.inimigo.campo.cartas[i] = card('O Rato');
  const possible = p.alvosParaHabilidadeEmCampo(source, p.jogador, p.inimigo);
  let target = possible[0], second = possible[1];
  if (source.efeito.acao === 'mover') second = 8;
  if (source.efeito.tipo === T.DISTRIBUIR_DANO || source.efeito.tipo === T.BUFF_ATE_DOIS_ALIADOS) target = possible.slice(0, 2);
  assert.ok(p.ativarHabilidade(source, p.jogador, p.inimigo, target, second).sucesso, base.nome);
  const event = p.eventosEfeito.find((e) => e.momento === 'habilidade');
  assert.ok(event, `Evento ausente: ${base.nome}`);
  assert.equal(event.fonte.nome, base.nome);
  assert.equal(event.fonte.efeito.tipo, base.efeito.tipo, 'Aprender conserva o efeito que foi usado no evento.');
  const snapshot = codec.serializeMatch(p);
  const enemy = codec.swapSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const reversed = enemy.eventosEfeito.find((e) => e.id === event.id);
  assert.equal(reversed.lado, 'inimigo');
  event.alvos.forEach((alvo, index) => assert.notEqual(reversed.alvos[index].lado, alvo.lado));
  assert.equal(JSON.stringify(codec.serializeMatch(codec.hydrateMatch(snapshot)).eventosEfeito), JSON.stringify(snapshot.eventosEfeito));
  assert.equal(JSON.stringify(codec.swapSnapshot(enemy)), JSON.stringify(snapshot));
  activeCount++;
}

// Repeated activation survives reset and removal of the source before the next snapshot.
{
  const p = match(), source = card('Advogado Corporativo');
  p.jogador.campo.cartas[5] = source;
  for (let i = 0; i < 2; i++) {
    p.inimigo.campo.cartas[i] = card('Saloon');
    source.usadaEsteTurno = false;
    p.ativarHabilidade(source, p.jogador, p.inimigo, i);
  }
  p.jogador.campo.removerCarta(5);
  const events = codec.serializeMatch(p).eventosEfeito.filter((e) => e.momento === 'habilidade');
  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  assert.deepEqual(Array.from(events, (e) => e.alvos.find((a) => a.lado === 'inimigo').indice), [0, 1]);
  // The presentation consumes every ID from combined updates once, in order, on either side.
  for (const payload of [events, codec.swapSnapshot(codec.serializeMatch(p)).eventosEfeito]) {
    const renderer = Object.create(CenaEfeitos.prototype);
    renderer.fila = []; renderer.ultimoEvento = 0; renderer.proximo = () => {};
    renderer.receber(payload); renderer.receber(payload);
    assert.equal(renderer.fila.length, payload.length);
  }
}

// Continuous effects remember each source, don't replay on identical recalculations, and survive sync.
{
  const p = match();
  p.jogador.campo.cartas[0] = card('Torre MonteCorp');
  p.jogador.campo.cartas[1] = card('CryptoAcionistas');
  p.resolverEfeitosContinuos(p.jogador);
  assert.equal(p.eventosEfeito.at(-1).fonte.nome, 'Torre MonteCorp');
  const sequence = p.sequenciaEfeito;
  p.resolverEfeitosContinuos(p.jogador);
  assert.equal(p.sequenciaEfeito, sequence);
  const restored = codec.hydrateMatch(codec.swapSnapshot(codec.serializeMatch(p)));
  restored.resolverEfeitosContinuos(restored.inimigo);
  assert.equal(restored.sequenciaEfeito, sequence);
  p.jogador.campo.removerCarta(0); p.resolverEfeitosContinuos(p.jogador);
  assert.equal(p.eventosEfeito.at(-1).mensagem, 'Efeito contínuo encerrado');
}

// State-only targets and blocked PA changes still identify the affected side.
{
  const p = match(), agente = card('TecnoAgentes de Segurança'), target = card('O Porco');
  p.jogador.campo.cartas[5] = agente; p.inimigo.campo.cartas[5] = target;
  p.ativarHabilidade(agente, p.jogador, p.inimigo, 5);
  assert.ok(p.eventosEfeito.at(-1).alvos.some((a) => a.id === target.id && a.lado === 'inimigo'));
  const rato = card('O Rato'); p.jogador.campo.cartas[1] = rato;
  const clone = card('O Porco'); clone.id = target.id; p.jogador.campo.cartas[2] = clone;
  p.ativarHabilidade(rato, p.jogador, p.inimigo, 5);
  assert.ok(p.eventosEfeito.findLast((e) => e.momento === 'habilidade').alvos.some((a) => a.id === target.id && a.lado === 'inimigo' && a.bloqueado));
}
{
  const p = match(), aluno = card('Estudante de Curso Técnico'), dipsp = card('Agente da DIPSP');
  p.jogador.campo.cartas[5] = aluno; p.jogador.campo.cartas[1] = dipsp;
  p.inimigo.campo.cartas[5] = card('O Tigre');
  p.ativarHabilidade(aluno, p.jogador, p.inimigo, 1); aluno.usadaEsteTurno = false;
  p.ativarHabilidade(aluno, p.jogador, p.inimigo, 5);
  assert.equal(p.eventosEfeito.findLast((e) => e.momento === 'habilidade').fonte.habilidadeAprendidaDe, 'Agente da DIPSP');
}

// Descriptions must belong to the matching document card (including strings containing quotes).
const document = fs.readFileSync('Cartas e boosters.md', 'utf8');
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const descriptions = new Map();
const powers = new Map();
for (const section of document.split(/^#{3,4} (?=.*carta)/m).slice(1)) {
  const heading = section.split('\n')[0];
  const name = heading.split(/\s*(?:->| - )\s*/).at(-1).trim();
  const line = section.match(/^\s*\*?\s*Descrição:\s*(.*)$/m);
  const pa = section.match(/(?:^|\n)\s*\*?\s*PA:\s*(\d+)/);
  if (pa) powers.set(normalize(name), Number(pa[1]));
  if (line) descriptions.set(normalize(name), normalize(line[1].replace(/^(?:Descrição:|:)\s*/, '')));
}
for (const base of [...pool, ...terrenos]) {
  const expectedPower = powers.get(normalize(base.nome));
  if (expectedPower !== undefined) assert.equal(base.poder, expectedPower, `PA de ${base.nome}`);
  const expected = descriptions.get(normalize(base.nome));
  if (expected) assert.equal(normalize(base.descricao), expected, `Descrição de ${base.nome}`);
}

// Document balance, turn timing, and dedicated visual assets.
assert.equal(pool.find((c) => c.nome === 'CryptoAcionistas').efeitoTurno.valor, 2);
assert.equal(pool.find((c) => c.nome === 'UCC "Juggernaut"').poder, 10);
assert.equal(pool.find((c) => c.nome === 'Agente da DIPSP').efeito.rangeH - 1, 1);
{
  const p = match(), crypto = card('CryptoAcionistas'); p.jogador.campo.cartas[0] = crypto;
  context.p = p; vm.runInContext('Math.random = () => 0', context);
  p.resolverEfeitosDeTurno(); assert.equal(crypto.poder, 6);
  p.resolverEfeitosInicioRodada(); assert.equal(crypto.poder, 8);
  assert.equal(p.eventosEfeito.at(-1).momento, 'inicio_turno');
}
assert.equal(perfil['Agente da DIPSP'].visual, 'plasma');
assert.equal(perfil["Dieh'Go, o Xerife"].visual, 'caveiras');
assert.equal(perfil['NeoAnalista de Suporte Nível Alpha'].video, 'efeitoNeoAnalista');
console.log(`${pool.length} personagens e ${activeCount} habilidades: eventos, repetição, remoção, passivas e duas perspectivas validados.`);
