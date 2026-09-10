const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({
  console,
  window: { screen: { width: 1920, height: 1080 } },
  GW: 1920,
  GH: 1080,
  CenaPreload: class {},
  CenaTitulo: class {},
  CenaTransicao: class {},
  CenaJogo: class {},
  CenaDeckBuilder: class {},
  Phaser: {
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
    Game: class {},
    Utils: { Array: { Shuffle: (cards) => cards } },
  },
});
vm.runInContext(fs.readFileSync("js/cartas.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/main.js", "utf8"), context);
vm.runInContext(
  "globalThis.t = { Carta, Jogador, Partida, TIPOS_EFEITO, TIPOS_EFEITO_CONTINUO, POOL_CARTAS_MONSTRO, POOL_CARTAS_TERRENO, POOL_CARTAS_EFEITO }",
  context,
);

const { Carta, Jogador, Partida, POOL_CARTAS_MONSTRO, POOL_CARTAS_TERRENO, POOL_CARTAS_EFEITO } = context.t;
let id = 2000;
function carta(nome) {
  const base = [...POOL_CARTAS_MONSTRO, ...POOL_CARTAS_TERRENO, ...POOL_CARTAS_EFEITO].find(c => c.nome === nome);
  assert.ok(base, nome);
  const tipo = POOL_CARTAS_TERRENO.includes(base) ? 'terreno' : POOL_CARTAS_EFEITO.includes(base) ? 'efeito' : 'monstro';
  return new Carta(id++, base.poder, tipo, JSON.parse(JSON.stringify(base)));
}
function mesa() {
  const p = Object.create(Partida.prototype);
  p.jogador = new Jogador(); p.inimigo = new Jogador();
  return p;
}
const colocar = (p, nome, indice, inimigo = false) => {
  const c = carta(nome); (inimigo ? p.inimigo : p.jogador).campo.cartas[indice] = c; return c;
};
const ativar = (p, c, a, b) => p.ativarHabilidade(c, p.jogador, p.inimigo, a, b);
{
  const p = mesa(); const tecnico = colocar(p, 'Refrigeradores de DataCenter', 0);
  const aliado = colocar(p, 'O Tigre', 1);
  assert.equal(ativar(p, tecnico, 9).sucesso, false);
  assert.equal(ativar(p, tecnico, 1).sucesso, true);
  aliado.buff(-5); assert.equal(aliado.poder, 9);
  assert.equal(ativar(p, tecnico, 0).sucesso, false);
  const deserto = colocar(p, 'Terras Desertas', 0, true);
  p.resolverEfeitosContinuos(p.jogador); assert.equal(aliado.poder, 9);
  aliado.protegidaPA = false; p.resolverEfeitosContinuos(p.jogador); assert.equal(aliado.poder, 8);
}
{
  const p = mesa(); const montador = colocar(p, 'Montadores de Cabos', 0);
  const aliado = colocar(p, 'O Tigre', 1);
  assert.equal(ativar(p, montador, 1, 0).sucesso, false);
  assert.equal(ativar(p, montador, 1, 8).sucesso, true);
  assert.equal(p.jogador.campo.cartas[1], null); assert.equal(p.jogador.campo.cartas[8], aliado);
}
{
  const p = mesa(); const aluno = colocar(p, 'Estudante de Curso Técnico', 0);
  const medico = colocar(p, 'NeoMedicânico', 1);
  assert.equal(ativar(p, aluno, 1).sucesso, true);
  assert.equal(aluno.poder, 1); assert.equal(aluno.efeito.acao, 'curar');
  assert.notEqual(aluno.efeito, medico.efeito);
  aluno.usadaEsteTurno = false;
  assert.equal(ativar(p, aluno, 0).sucesso, true); assert.equal(aluno.poder, 3);
}
{
  const p = mesa(); const bombeiro = colocar(p, 'CyberUnidades de Emergência', 0);
  const alvo = colocar(p, 'Refrigeradores de DataCenter', 0, true);
  colocar(p, 'NeoPalhoça', 1, true);
  p.resolverEfeitosContinuos(p.inimigo); assert.equal(alvo.poder, 7);
  assert.equal(ativar(p, bombeiro, 0).sucesso, true);
  alvo.buff(4); assert.equal(alvo.poder, 7);
  colocar(p, 'NeoPalhoça', 2, true); p.resolverEfeitosContinuos(p.inimigo); assert.equal(alvo.poder, 7);
  alvo.bonusBloqueado = false; p.resolverEfeitosContinuos(p.inimigo); assert.equal(alvo.poder, 10);
}
{
  const p = mesa(); const agente = colocar(p, 'TecnoAgentes de Segurança', 0);
  const atacante = colocar(p, 'O Rato', 0, true); atacante.buff(8);
  assert.equal(ativar(p, agente, 0).sucesso, true);
  assert.equal(p.ativarHabilidade(atacante, p.inimigo, p.jogador, 0).sucesso, true);
  assert.equal(atacante.poder, 8);
  p.jogador.campo.removerCarta(0); colocar(p, 'O Tigre', 1);
  atacante.usadaEsteTurno = false;
  p.ativarHabilidade(atacante, p.inimigo, p.jogador, 1); assert.equal(atacante.poder, 9);
}
{
  const p = mesa(); const influencer = colocar(p, 'Influenciador Digital', 0);
  const inimigo = colocar(p, 'O Tigre', 0, true);
  assert.equal(ativar(p, influencer, 0, 0).sucesso, false);
  assert.equal(ativar(p, influencer, 0, 10).sucesso, true);
  assert.equal(influencer.poder, 8); assert.equal(inimigo.poder, 7);
  const professor = colocar(p, 'Professores de Duelo', 1);
  assert.equal(ativar(p, professor, 0).sucesso, true);
  assert.equal(influencer.usadaEsteTurno, false);
}
{
  const p = mesa(); const politico = colocar(p, 'CyberPolíticos', 0);
  const aliado = colocar(p, 'NeoMedicânico', 1);
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, 1);
  assert.equal(politico.poder, 12);
  p.resolverEfeitosContinuos(p.jogador); assert.equal(politico.poder, 12);
  p.jogador.campo.removerCarta(1); p.resolverEfeitosContinuos(p.jogador);
  assert.equal(p.jogador.campo.cartas[0], null);
  assert.ok(p.jogador.descarte.includes(politico));
}
{
  const p = mesa(); const porco = colocar(p, 'O Porco', 0); porco.buff(3); porco.buff(-2); assert.equal(porco.poder, 7);
  const cobra = colocar(p, 'A Cobra', 1); const alvo = colocar(p, 'O Tigre', 5, true);
  ativar(p, cobra, 5); p.resolverEfeitosDeTurno(); assert.equal(alvo.poder, 8);
  p.jogador.campo.removerCarta(1); p.resolverEfeitosDeTurno(); assert.equal(alvo.poder, 8);
  const advogado = colocar(p, 'Advogado Corporativo', 1); colocar(p, 'Saloon', 0, true);
  assert.equal(ativar(p, advogado, 0).sucesso, true);
  advogado.usadaEsteTurno = false; colocar(p, 'Saloon', 0, true);
  assert.equal(ativar(p, advogado, 0).sucesso, true);
}
{
  const p = mesa(); const sugestao = carta('Sugestão Algorítmica');
  p.jogador.mao.cartas = [carta('O Rato'), carta('O Tigre')];
  const cartas = ['O Boi', 'O Porco', 'A Cobra', 'A Cabra'].map(carta);
  p.jogador.deck.cartas = [...cartas];
  p.aplicarEfeitoInvocacao(sugestao, p.jogador, p.inimigo, null, 0);
  assert.equal(p.jogador.descarte.length, 2);
  assert.deepEqual(p.jogador.mao.cartas, [cartas[3], cartas[2], cartas[0]]);
  assert.equal(p.jogador.cartasPerdidas, 0);
}
assert.equal(carta('Dragão das Comunicações Móveis').poder, 14);
assert.equal(carta('CyberPolíticos').nivel, 'alta');
assert.equal(carta('Professores de Duelo').lendaria, true);
console.log('Sindicato, Dragão e regras do catálogo validados.');
{
  const p = mesa(); const tecnico = colocar(p, 'Refrigeradores de DataCenter', 0);
  ativar(p, tecnico, 0);
  p.iniciarTurno(p.inimigo); assert.equal(tecnico.protegidaPA, true);
  p.iniciarTurno(p.jogador); assert.equal(tecnico.protegidaPA, false);
}
// Todos os estados novos sobrevivem à serialização e à troca de perspectiva.
vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8'), context);
{
  const p = mesa(); p.historico = [];
  const politico = colocar(p, 'CyberPolíticos', 0);
  const tecnico = colocar(p, 'Refrigeradores de DataCenter', 1);
  const agente = colocar(p, 'TecnoAgentes de Segurança', 2);
  const inimigo = colocar(p, 'O Rato', 0, true);
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, 1);
  ativar(p, tecnico, 0); ativar(p, agente, 0);
  const multiplayer = context.window.cyberduelMultiplayer;
  multiplayer.player = 1;
  const snapshot = multiplayer.canonicalSnapshot(p);
  multiplayer.player = 2;
  const restaurada = multiplayer.hydrateMatch(multiplayer.localSnapshot(snapshot));
  assert.equal(restaurada.inimigo.campo.cartas[0].protegidaPA, true);
  assert.equal(restaurada.inimigo.campo.cartas[0].aliadoVinculadoId, tecnico.id);
  assert.equal(restaurada.inimigo.campo.cartas[2].alvosAdvertidos[0], inimigo.id);
  restaurada.inimigo.campo.removerCarta(1);
  restaurada.resolverEfeitosContinuos(restaurada.inimigo);
  assert.equal(restaurada.inimigo.campo.cartas[0], null);
}
// Extintor bloqueia o ganho real e o delta usado pela animação.
{
  const p = mesa();
  const bombeiro = colocar(p, 'CyberUnidades de Emergência', 0);
  const alvo = colocar(p, 'O Tigre', 0, true);
  const estagiario = colocar(p, 'Estagiário de Machine Learning', 1, true);
  ativar(p, bombeiro, 0);
  const resultado = p.ativarHabilidade(estagiario, p.inimigo, p.jogador, 0);
  assert.equal(alvo.poder, 9);
  assert.equal(resultado.afetadas.find(e => e.carta === alvo).delta, 0);
  const boi = colocar(p, 'O Boi', 2, true);
  alvo.buff(-4);
  p.ativarHabilidade(boi, p.inimigo, p.jogador, 0);
  assert.equal(alvo.poder, 5, 'Novo Começo não pode aumentar PA sob Extintor.');
  const vendedor = colocar(p, 'CyberVendedor da RaspCorp', 3, true);
  const venda = p.ativarHabilidade(vendedor, p.inimigo, p.jogador, 0);
  assert.equal(venda.sucesso, true);
  assert.equal(venda.afetadas.find(e => e.carta === alvo).delta, 0);
  assert.equal(alvo.poder, 5);
  colocar(p, 'Saloon', 4, true);
  p.resolverEfeitosContinuos(p.inimigo);
  assert.equal(alvo.poder, 5, 'Bônus de terreno também deve ser impedido.');
  p.historico = [];
  const multiplayer = context.window.cyberduelMultiplayer;
  const restaurada = multiplayer.hydrateMatch(multiplayer.serializeMatch(p));
  assert.equal(restaurada.inimigo.campo.cartas[0].bonusBloqueado, true);
  assert.equal(restaurada.inimigo.campo.cartas[0].buff(3), 0);
  p.turno = 1; p.maxTurnos = 7; p.rodadasParaVencer = 4;
  p.rodadasJogador = 0; p.rodadasInimigo = 0;
  p.resolverRodada = () => {
    assert.equal(alvo.bonusBloqueado, true, 'Extintor dura até a pontuação da rodada.');
    return {};
  };
  p.fimTurno({ semIA: true });
  assert.equal(alvo.bonusBloqueado, false);
  assert.equal(alvo.buff(1), 1, 'Bônus voltam a funcionar após a rodada.');
}
{
  const p = mesa(); const politico = colocar(p, 'CyberPolíticos', 0);
  assert.equal(p.alvosParaVinculoAliado(politico, p.jogador).length, 0);
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, 0);
  assert.equal(politico.poder, 6);
  assert.equal(politico.aliadoVinculadoId, undefined);
  const aliado = colocar(p, 'O Tigre', 1);
  assert.deepEqual(Array.from(p.alvosParaVinculoAliado(politico, p.jogador)), [1]);
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, 0);
  assert.equal(politico.aliadoVinculadoId, undefined, 'Escolher a si mesmo não cria vínculo nem escolhe outro alvo em silêncio.');
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, 1);
  assert.equal(politico.aliadoVinculadoId, aliado.id);
  assert.equal(politico.poder, 12);
}
// O marcador visual nasce e desaparece com o mesmo estado que bloqueia o PA.
context.Phaser.Scene = class {};
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
vm.runInContext('globalThis.CenaTesteExtintor = CenaJogo', context);
{
  const cena = Object.create(context.CenaTesteExtintor.prototype);
  const textos = [];
  cena.add = {
    rectangle: () => ({ setStrokeStyle() { return this; } }),
    text: (x, y, texto) => { textos.push(texto); return { setOrigin() { return this; } }; },
  };
  const alvo = carta('O Tigre');
  assert.equal(cena.criarIndicadorExtintor(alvo, 150, 200, 1).length, 0);
  alvo.bonusBloqueado = true;
  assert.equal(cena.criarIndicadorExtintor(alvo, 150, 200, 1).length, 3);
  assert.ok(textos.includes('EXTINTOR\nSEM BÔNUS'));
  alvo.bonusBloqueado = false;
  assert.equal(cena.criarIndicadorExtintor(alvo, 150, 200, 1).length, 0);
}
// Regressão: clicar fora da seleção nunca confirma Troca de Favores.
{
  const p = mesa();
  const politico = colocar(p, 'CyberPolíticos', 0);
  const aliado = colocar(p, 'O Tigre', 1);
  p.aplicarEfeitoInvocacao(politico, p.jogador, p.inimigo, 0, null);
  assert.equal(politico.aliadoVinculadoId, undefined, 'Ausência de escolha não seleciona um aliado automaticamente.');
  assert.equal(politico.poder, 6);

  const cena = Object.create(context.CenaTesteExtintor.prototype);
  const retangulos = [];
  const objeto = () => ({
    eventos: {},
    setDepth() { return this; }, setInteractive() { return this; },
    setOrigin() { return this; }, setStrokeStyle() { return this; },
    on(evento, handler) { this.eventos[evento] = handler; return this; },
    destroy() { this.destruido = true; },
  });
  cena.partida = p;
  cena.layout = { x: [10, 20, 30, 40, 50], yJogador: [100, 200], slotW: 9, slotH: 18 };
  cena.add = {
    rectangle: () => { const o = objeto(); retangulos.push(o); return o; },
    text: objeto,
  };
  cena.tweens = { add() {} };
  cena.processarCartasAfetadas = (afetadas, concluir) => concluir();
  cena.desenharInterface = () => {};
  cena.iniciarSelecaoDeAliadoParaBuff(politico, 0);
  const overlay = retangulos[0];
  overlay.eventos.pointerup();
  overlay.eventos.pointerup();
  assert.equal(politico.poder, 6);
  assert.equal(politico.aliadoVinculadoId, undefined);
  assert.equal(cena.travado, true, 'Clicar fora deve manter a seleção aberta.');
  assert.equal(overlay.destruido, undefined);
  const zonas = retangulos.slice(1).filter(o => o.eventos.pointerup);
  assert.equal(zonas.length, 1, 'Apenas o outro aliado recebe uma zona de seleção.');
  zonas[0].eventos.pointerup();
  assert.equal(politico.aliadoVinculadoId, aliado.id);
  assert.equal(politico.poder, 12);
  assert.equal(cena.travado, false);
  assert.equal(overlay.destruido, true);

  p.jogador.campo.cartas[1] = null;
  const sozinho = colocar(p, 'CyberPolíticos', 0);
  cena.iniciarSelecaoDeAliadoParaBuff(sozinho, 0);
  assert.equal(sozinho.poder, 6, 'Sem outro aliado, a invocação termina sem bônus.');
  assert.equal(sozinho.aliadoVinculadoId, undefined);
  assert.equal(cena.travado, false);
}
