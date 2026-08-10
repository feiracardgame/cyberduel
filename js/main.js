console.log("Cyberduel iniciou!");

// Os dados de carta (classe Carta, TIPOS_EFEITO, descreverEfeito e o pool
// POOL_CARTAS_EFEITO) agora moram em js/cartas.js, que é carregado antes
// deste arquivo — veja index.html.

class Deck {
  constructor() {
    this.cartas = [];
    this.limite = 20;
  }
  adicionarCarta(carta) {
    if (this.cartas.length < this.limite) {
      this.cartas.push(carta);
    }
  }
  embaralhar() {
    Phaser.Utils.Array.Shuffle(this.cartas);
  }
}

class Mao {
  constructor() {
    this.cartas = [];
  }
  adicionarCarta(carta) {
    this.cartas.push(carta);
  }
}

class Campo {
  constructor() {
    // 10 posições por jogador (layout 2x5: 2 fileiras de 5 slots cada,
    // por jogador — ou seja, 4 fileiras no total: 2 do inimigo em cima,
    // 2 do jogador embaixo). Índices 0-4 = fileira de trás, 5-9 =
    // fileira da frente (ver CenaJogo.desenharCampoInimigo/Jogador).
    this.cartas = new Array(10).fill(null);
    this.limite = 10;
  }
  adicionarCarta(carta, posicao) {
    if (this.cartas[posicao] === null) {
      this.cartas[posicao] = carta;
    }
  }
  temEspaco(posicao) {
    return this.cartas[posicao] === null;
  }
}

class Jogador {
  constructor() {
    this.deck = new Deck();
    this.mao = new Mao();
    this.campo = new Campo();
    this.vitorias = 0;
  }

  jogarCarta(carta, posicao) {
    if (!this.campo.temEspaco(posicao)) return false;

    this.campo.adicionarCarta(carta, posicao);

    const indice = this.mao.cartas.indexOf(carta);
    if (indice !== -1) {
      this.mao.cartas.splice(indice, 1);
    }
    return true;
  }

  // Cartas de efeito nunca ocupam o campo: são consumidas na hora,
  // aplicam sua passiva e vão descartadas.
  jogarCartaEfeito(carta) {
    const indice = this.mao.cartas.indexOf(carta);
    if (indice !== -1) {
      this.mao.cartas.splice(indice, 1);
    }
    return true;
  }

  criardeckteste() {
    // Uma seleção de cartas de efeito, garantindo variedade tática no deck
    const efeitosEmbaralhados = Phaser.Utils.Array.Shuffle([
      ...POOL_CARTAS_EFEITO,
    ]);
    const quantidadeEfeitos = 6;

    for (let i = 0; i < quantidadeEfeitos; i++) {
      const base = efeitosEmbaralhados[i % efeitosEmbaralhados.length];
      const carta = new Carta(1000 + i, base.poder, "efeito", {
        nome: base.nome,
        descricao: base.descricao,
        efeito: base.efeito,
      });
      this.deck.adicionarCarta(carta);
    }

    // Monstros especiais: cópias fixas (não aleatórias) do pool de
    // POOL_CARTAS_MONSTRO. Hoje isso é só 2x CryptoAcionistas.
    const copiasMonstroEspecial = [
      POOL_CARTAS_MONSTRO[0],
      POOL_CARTAS_MONSTRO[0],
    ];
    const quantidadeMonstrosEspeciais = copiasMonstroEspecial.length;
    copiasMonstroEspecial.forEach((base, i) => {
      const carta = new Carta(2000 + i, base.poder, "monstro", {
        nome: base.nome,
        descricao: base.descricao,
        efeitoTurno: base.efeitoTurno,
        imagem: base.imagem,
        foco: base.foco,
      });
      this.deck.adicionarCarta(carta);
    });

    // Restante do deck: cartas de monstro comuns, sem efeitos
    const quantidadeMonstros =
      this.deck.limite - quantidadeEfeitos - quantidadeMonstrosEspeciais;
    for (let i = 0; i < quantidadeMonstros; i++) {
      const carta = new Carta(
        i + 1,
        Math.floor(Math.random() * 10) + 1,
        "monstro",
        {
          nome: `Unidade ${i + 1}`,
          descricao:
            "Uma unidade de combate padrão, confiável em qualquer formação.",
        },
      );
      this.deck.adicionarCarta(carta);
    }
  }

  comprarCarta() {
    if (this.deck.cartas.length > 0) {
      const compra = this.deck.cartas.pop();
      this.mao.adicionarCarta(compra);
    }
  }
}

class Partida {
  constructor() {
    this.jogador = new Jogador();
    this.inimigo = new Jogador();

    this.jogador.criardeckteste();
    this.inimigo.criardeckteste();

    this.jogador.deck.embaralhar();
    this.inimigo.deck.embaralhar();

    // Compra inicial: 5 + 3 cartas adicionais
    for (let i = 0; i < 3; i++) {
      this.jogador.comprarCarta();
      this.inimigo.comprarCarta();
    }

    this.turno = 1;
    // Duração fixa da partida: o combate só é resolvido depois que esse
    // turno é fechado (ver fimTurno / partidaEncerrada).
    this.maxTurnos = 7;
    this.partidaEncerrada = false;
    this.cartaSelecionada = null;

    // Cartas afetadas por efeitos de turno (ex: CryptoAcionistas) no
    // último fimTurno() resolvido, para a cena poder animar o buff.
    this.efeitosDeTurno = [];

    // Guarda a carta de efeito jogada pela IA no turno atual (se houver),
    // junto das cartas que foram afetadas por ela, para a cena poder
    // mostrar a animação de conjuração e de buff/debuff no momento certo.
    this.efeitoInimigoTurno = null;

    // Histórico de todas as cartas jogadas na partida, na ordem em que
    // foram jogadas. Cada entrada: { turno, quem: 'jogador'|'inimigo', carta }.
    this.historico = [];
  }

  // Registra uma jogada no histórico. "quem" é 'jogador' ou 'inimigo'.
  registrarHistorico(carta, quem) {
    this.historico.push({ turno: this.turno, quem, carta });
  }

  // Ponto único de entrada para o jogador jogar uma carta de monstro: garante
  // que o efeito passivo de invocação seja aplicado sempre que a jogada for válida.
  jogarCartaDoJogador(carta, posicao) {
    const sucesso = this.jogador.jogarCarta(carta, posicao);
    const afetadas = sucesso
      ? this.aplicarEfeitoInvocacao(carta, this.jogador, this.inimigo)
      : [];
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return { sucesso, afetadas };
  }

  // Ponto único de entrada para o jogador conjurar uma carta de efeito:
  // ela nunca vai para o campo, só é consumida e aplica sua passiva.
  jogarCartaEfeitoDoJogador(carta) {
    const sucesso = this.jogador.jogarCartaEfeito(carta);
    const afetadas = sucesso
      ? this.aplicarEfeitoInvocacao(carta, this.jogador, this.inimigo)
      : [];
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return { sucesso, afetadas };
  }

  // Aplica o efeito passivo de uma carta no momento em que ela é invocada.
  // "dono" é quem jogou a carta, "oponente" é o outro jogador.
  // Retorna a lista de cartas de campo afetadas (com o delta de poder
  // aplicado), para que a cena possa animar exatamente essas cartas.
  aplicarEfeitoInvocacao(carta, dono, oponente) {
    if (!carta.efeito) return [];
    const { tipo, valor } = carta.efeito;
    const afetadas = [];

    switch (tipo) {
      case TIPOS_EFEITO.BUFF_ALIADOS:
        dono.campo.cartas.forEach((c) => {
          if (c && c !== carta) {
            c.buff(valor);
            afetadas.push({ carta: c, delta: valor });
          }
        });
        break;
      case TIPOS_EFEITO.DEBUFF_INIMIGOS:
        oponente.campo.cartas.forEach((c) => {
          if (c) {
            c.buff(-valor);
            afetadas.push({ carta: c, delta: -valor });
          }
        });
        break;
      case TIPOS_EFEITO.COMPRAR_CARTA:
        for (let i = 0; i < valor; i++) dono.comprarCarta();
        break;
      case TIPOS_EFEITO.DESCARTAR_CARTA:
        for (let i = 0; i < valor && oponente.mao.cartas.length > 0; i++) {
          const idx = Math.floor(Math.random() * oponente.mao.cartas.length);
          oponente.mao.cartas.splice(idx, 1);
        }
        break;
    }

    return afetadas;
  }

  // Fecha o turno atual. O combate só é calculado (resolverCombate) quando
  // o turno que está sendo fechado é o último (this.turno === this.maxTurnos);
  // nos turnos anteriores só a IA joga e os efeitos de turno são resolvidos,
  // sem ninguém "vencer" ainda. Depois do 7º turno a partida trava
  // (this.partidaEncerrada = true) e fimTurno() não faz mais nada.
  fimTurno() {
    if (this.partidaEncerrada) {
      return { resultadoCombate: null, fimDeJogo: true };
    }

    this.turnoIA();
    // Cartas que a IA acabou de jogar neste turno também entram no sorteio
    // de efeitos de turno abaixo (mesma regra pro jogador e pro inimigo).
    this.efeitosDeTurno = this.resolverEfeitosDeTurno();

    const eraUltimoTurno = this.turno >= this.maxTurnos;
    let resultadoCombate = null;

    if (eraUltimoTurno) {
      // Combate só é resolvido aqui, no fechamento do último turno.
      resultadoCombate = this.resolverCombate();
      this.partidaEncerrada = true;
    } else {
      this.turno++;
      this.jogador.deck.embaralhar();
      this.inimigo.deck.embaralhar();
      for (let i = 0; i < 2; i++) {
        this.jogador.comprarCarta();
        this.inimigo.comprarCarta();
      }
    }

    // fimDeJogo avisa a cena que é hora de mostrar a tela de
    // VOCÊ VENCEU / VOCÊ PERDEU em vez do fluxo normal de próximo turno.
    return { resultadoCombate, fimDeJogo: eraUltimoTurno };
  }

  // Percorre o campo dos dois jogadores e reavalia o efeitoTurno de cada
  // carta presente. Retorna a lista de cartas afetadas (com o delta de
  // poder aplicado), no mesmo formato de aplicarEfeitoInvocacao(), para a
  // cena poder animar exatamente essas cartas (reaproveita
  // animarCartasAfetadas em jogo.js).
  resolverEfeitosDeTurno() {
    const afetadas = [];

    [this.jogador, this.inimigo].forEach((dono) => {
      dono.campo.cartas.forEach((carta) => {
        if (!carta || !carta.efeitoTurno) return;
        const { tipo, chance, valor } = carta.efeitoTurno;

        switch (tipo) {
          case TIPOS_EFEITO_TURNO.CHANCE_GANHAR_PODER:
            if (Math.random() < chance) {
              carta.buff(valor);
              afetadas.push({ carta, delta: valor });
            }
            break;
        }
      });
    });

    return afetadas;
  }

  turnoIA() {
    this.efeitoInimigoTurno = null;

    const carta = this.inimigo.mao.cartas[0];
    if (!carta) return;

    // Cartas de efeito nunca vão para o campo: são conjuradas e consumidas
    if (carta.tipo === "efeito") {
      const sucesso = this.inimigo.jogarCartaEfeito(carta);
      if (sucesso) {
        const afetadas = this.aplicarEfeitoInvocacao(
          carta,
          this.inimigo,
          this.jogador,
        );
        this.efeitoInimigoTurno = { carta, afetadas };
        this.registrarHistorico(carta, "inimigo");
      }
      return;
    }

    for (let i = 0; i < 10; i++) {
      if (this.inimigo.campo.temEspaco(i)) {
        const sucesso = this.inimigo.jogarCarta(carta, i);
        if (sucesso) this.registrarHistorico(carta, "inimigo");
        break;
      }
    }
  }

  calcularPoderTotal(campo) {
    let total = 0;
    for (let carta of campo.cartas) {
      if (carta !== null) {
        total += carta.poder;
      }
    }
    return total;
  }

  // Retorna a carta com maior poder (PA) presente num campo, ou null se
  // o campo estiver vazio. Usada pela tela de fim de jogo para mostrar a
  // carta "MVP" embaixo do texto de VOCÊ VENCEU / VOCÊ PERDEU.
  obterCartaComMaiorPoder(campo) {
    let maior = null;
    for (const carta of campo.cartas) {
      if (carta && (!maior || carta.poder > maior.poder)) {
        maior = carta;
      }
    }
    return maior;
  }

  resolverCombate() {
    let poderJogador = this.calcularPoderTotal(this.jogador.campo);
    let poderInimigo = this.calcularPoderTotal(this.inimigo.campo);

    let resultado;
    if (poderJogador > poderInimigo) {
      this.jogador.vitorias++;
      resultado = "jogador";
    } else if (poderInimigo > poderJogador) {
      this.inimigo.vitorias++;
      resultado = "inimigo";
    } else {
      resultado = "empate";
    }

    // Carta de maior poder do lado vencedor, para a tela de fim de jogo.
    // Em caso de empate, mostra a maior carta entre os dois campos.
    let cartaDestaque = null;
    if (resultado === "jogador") {
      cartaDestaque = this.obterCartaComMaiorPoder(this.jogador.campo);
    } else if (resultado === "inimigo") {
      cartaDestaque = this.obterCartaComMaiorPoder(this.inimigo.campo);
    } else {
      const maiorJogador = this.obterCartaComMaiorPoder(this.jogador.campo);
      const maiorInimigo = this.obterCartaComMaiorPoder(this.inimigo.campo);
      cartaDestaque =
        maiorJogador &&
        (!maiorInimigo || maiorJogador.poder >= maiorInimigo.poder)
          ? maiorJogador
          : maiorInimigo;
    }

    console.log(
      `Poder Jogador: ${poderJogador} | Poder Inimigo: ${poderInimigo} | Resultado: ${resultado}`,
    );

    // Retorna o resultado em vez de só logar, para a cena (jogo.js)
    // poder mostrar feedback visual (texto, flash de câmera etc.)
    return { poderJogador, poderInimigo, resultado, cartaDestaque };
  }
}

// Configuração Phaser para celulares na vertical.
// Resolução interna elevada para 1080x2160 (mantendo a proporção 1:2
// original de 360x720) para tirar proveito das telas de alta densidade
// (Retina/AMOLED) mais comuns em celulares atuais. O modo FIT + CENTER_BOTH
// garante que o jogo continue se ajustando a qualquer tamanho de tela sem
// distorcer, só que agora renderizando com muito mais nitidez.
const config = {
  type: Phaser.AUTO,
  width: 1080,
  height: 2160,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [CenaJogo],
};

const game = new Phaser.Game(config);
