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
  "globalThis.t = { Carta, Jogador, Partida, TIPOS_EFEITO, TIPOS_EFEITO_CONTINUO }",
  context,
);

const { Carta, Jogador, Partida, TIPOS_EFEITO, TIPOS_EFEITO_CONTINUO } =
  context.t;
const partida = Object.create(Partida.prototype);
partida.jogador = new Jogador();
partida.inimigo = new Jogador();

const povo = new Carta(1, 4, "monstro", {
  nome: "Povo da Areia",
  efeito: { tipo: TIPOS_EFEITO.BONUS_POR_PERDIDAS, valor: 1 },
});
const baixa = new Carta(2, 1, "monstro", { nome: "Baixa" });
partida.jogador.campo.cartas[0] = povo;
partida.jogador.campo.cartas[1] = baixa;
baixa.buff(-1);
partida.jogador.campo.removerMortas();
partida.resolverEfeitosContinuos(partida.jogador);
assert.equal(partida.jogador.cartasPerdidas, 1);
assert.equal(povo.poder, 5);

const feio = new Carta(3, 5, "monstro", {
  nome: "Tuh'Coh, O Feio",
  efeito: {
    tipo: TIPOS_EFEITO.BONUS_TRIO_ADJACENTE,
    nomes: ["O Bom", "Sen'Tenzhah, O Mau"],
    valor: 4,
  },
});
partida.jogador.campo.cartas.fill(null);
partida.jogador.campo.cartas.splice(
  0,
  3,
  new Carta(4, 7, "monstro", { nome: "O Bom" }),
  feio,
  new Carta(5, 6, "monstro", { nome: "Sen'Tenzhah, O Mau" }),
);
partida.resolverEfeitosContinuos(partida.jogador);
assert.equal(feio.poder, 9);

const deserto = new Carta(6, 0, "terreno", {
  nome: "Terras Desertas",
  efeitoContinuo: {
    tipo: TIPOS_EFEITO_CONTINUO.DEBUFF_CAMPO_INIMIGO,
    valor: 1,
  },
});
const inimigo = new Carta(7, 3, "monstro", { nome: "Inimigo" });
partida.jogador.campo.cartas.fill(null);
partida.inimigo.campo.cartas.fill(null);
partida.jogador.campo.cartas[0] = deserto;
partida.inimigo.campo.cartas[0] = inimigo;
partida.resolverEfeitosContinuos(partida.inimigo);
assert.equal(inimigo.poder, 2);

const ferreira = new Carta(8, 5, "monstro", {
  nome: "A Ferreira",
  habilidadeAtiva: true,
  efeito: { tipo: TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS, valor: 1, maxAlvos: 2 },
});
const aliadoA = new Carta(9, 2, "monstro", { nome: "Aliado A" });
const aliadoB = new Carta(10, 2, "monstro", { nome: "Aliado B" });
partida.jogador.campo.cartas.fill(null);
partida.jogador.campo.cartas.splice(0, 3, ferreira, aliadoA, aliadoB);
assert.equal(
  partida.ativarHabilidade(
    ferreira,
    partida.jogador,
    partida.inimigo,
    [1, 2],
  ).sucesso,
  true,
);
assert.equal(aliadoA.poder, 3);
assert.equal(aliadoB.poder, 3);

const reciclada = new Carta(11, 2, "efeito", { nome: "Efeito antigo" });
const reciclagem = new Carta(12, 1, "efeito", {
  nome: "Reciclagem",
  efeito: { tipo: TIPOS_EFEITO.RECICLAR_DESCARTE },
});
partida.jogador.descarte = [reciclada, reciclagem];
partida.aplicarEfeitoInvocacao(
  reciclagem,
  partida.jogador,
  partida.inimigo,
);
assert.equal(partida.jogador.mao.cartas.at(-1), reciclada);

console.log("Efeitos das cartas dos Remanescentes validados.");
