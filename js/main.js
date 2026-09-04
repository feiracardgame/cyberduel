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
  constructor(dono = null) {
    this.dono = dono;
    // 10 posições por jogador (layout 2x5: 2 fileiras de 5 slots cada,
    // por jogador — ou seja, 4 fileiras no total: 2 do inimigo em cima,
    // 2 do jogador embaixo). Índices 0-4 = fileira de trás, 5-9 =
    // fileira da frente (ver CenaJogo.desenharCampoInimigo/Jogador).
    this.cartas = new Array(10).fill(null);
    this.limite = 10;
    this.armadilhas = new Set();
  }
  adicionarCarta(carta, posicao) {
    if (this.cartas[posicao] === null) {
      this.cartas[posicao] = carta;
      if (carta.tipo !== "terreno" && this.armadilhas.has(posicao)) {
        this.armadilhas.delete(posicao);
        carta.buff(-2);
      }
    }
  }
  temEspaco(posicao) {
    return this.cartas[posicao] === null;
  }
  // Tira cartas com poder 0 do campo (deixa o slot null de novo).
  // Terrenos ficam de fora: eles sempre têm 0 PA e não "morrem" por isso.
  removerMortas() {
    for (let i = 0; i < this.cartas.length; i++) {
      const c = this.cartas[i];
      if (c && c.tipo !== "terreno" && c.poder <= 0) this.removerCarta(i);
    }
  }
  removerCarta(posicao) {
    const carta = this.cartas[posicao];
    if (!carta) return null;
    this.cartas[posicao] = null;
    this.dono?.registrarDescarte(carta);
    return carta;
  }
}

// Profundidade da linha dentro do campo do dono (1 = fileira da frente,
// mais perto do inimigo; 2 = fileira de trás, mais longe).
function profundidadeLinha(posicao) {
  return posicao < 5 ? 2 : 1;
}

// Acha os alvos possíveis no campo do oponente pra uma carta atacante numa
// posição, respeitando rangeH (colunas) e rangeV (linhas, olha as duas
// fileiras dos dois lados). Retorna índices do campo do oponente.
function alvosEmRange(posicaoAtacante, rangeH, rangeV, campoOponente) {
  const colAtk = posicaoAtacante % 5;
  const profAtk = profundidadeLinha(posicaoAtacante);
  const alvos = [];
  for (let i = 0; i < campoOponente.cartas.length; i++) {
    const carta = campoOponente.cartas[i];
    if (!carta || carta.tipo === "terreno") continue; // terreno não é alvo de ataque
    const colDiff = Math.abs((i % 5) - colAtk);
    const dist = profAtk + profundidadeLinha(i) - 1;
    if (colDiff <= rangeH - 1 && dist <= rangeV) alvos.push(i);
  }
  return alvos;
}

class Jogador {
  constructor() {
    this.deck = new Deck();
    this.mao = new Mao();
    this.campo = new Campo(this);
    this.descarte = [];
    this.cartasPerdidas = 0;
    this.vitorias = 0;

    // Cartas compradas desde a última vez que a cena consumiu essa
    // lista (ver CenaJogo.desenharMaoEmLeque, em jogo.js). Serve só
    // pra cena saber QUAIS cartas da mão são "novas" e por isso devem
    // receber a animação de compra (voar do monte até o leque) em vez
    // de simplesmente entrar com o fade padrão.
    this.cartasRecemCompradas = [];
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
      this.registrarDescarte(carta, false);
    }
    return true;
  }

  registrarDescarte(carta, contarPerda = true) {
    if (!carta || this.descarte.includes(carta)) return;
    this.descarte.push(carta);
    if (contarPerda) this.cartasPerdidas += 1;
  }

  criarDeckConfigurado(configuracao) {
    const pools = {
      monstro: POOL_CARTAS_MONSTRO,
      efeito: POOL_CARTAS_EFEITO,
      terreno: POOL_CARTAS_TERRENO,
    };
    let id = 10000;
    for (const entrada of configuracao) {
      const tipo = entrada.tipo;
      const base = pools[tipo]?.find((carta) => carta.nome === entrada.nome);
      if (!base) continue;
      for (let copia = 0; copia < entrada.quantidade; copia++) {
        this.deck.adicionarCarta(
          new Carta(id++, tipo === "terreno" ? 0 : base.poder || 0, tipo, {
            ...base,
          }),
        );
      }
    }
    return this.deck.cartas.length === this.deck.limite;
  }

  criardeckteste(configuracao = null) {
    const builder = window.cyberduelDeckBuilder;
    const configuracaoNormalizada = builder?.normalize(configuracao);
    const configuracaoFinal = builder?.isValid(configuracaoNormalizada)
      ? configuracaoNormalizada
      : null;
    if (
      Array.isArray(configuracaoFinal) &&
      configuracaoFinal.reduce(
        (total, entrada) => total + (Number(entrada.quantidade) || 0),
        0,
      ) === this.deck.limite &&
      this.criarDeckConfigurado(configuracaoFinal)
    )
      return;

    throw new Error(
      "Não foi possível montar um deck válido usando o catálogo de cartas.",
    );
  }

  comprarCarta() {
    if (this.deck.cartas.length > 0) {
      const compra = this.deck.cartas.pop();
      this.mao.adicionarCarta(compra);
      // Registrada aqui pra cena poder animar essa carta especificamente
      // como uma "compra" (voando do monte até o leque) na próxima
      // renderização — ver CenaJogo.desenharMaoEmLeque, em jogo.js.
      this.cartasRecemCompradas.push(compra);
    }
  }
}

class Partida {
  constructor() {
    this.jogador = new Jogador();
    this.inimigo = new Jogador();

    const deckBuilder = window.cyberduelDeckBuilder;
    const multiplayer = window.cyberduelMultiplayer;
    const deckLocal = deckBuilder?.getDeckForMatch() || null;
    const deckOponente =
      multiplayer?.active && multiplayer.opponentDeck?.length
        ? multiplayer.opponentDeck
        : deckLocal;
    this.jogador.criardeckteste(deckLocal);
    this.inimigo.criardeckteste(deckOponente);

    this.jogador.deck.embaralhar();
    this.inimigo.deck.embaralhar();

    // Compra inicial: 5 + 3 cartas adicionais
    for (let i = 0; i < 3; i++) {
      this.jogador.comprarCarta();
      this.inimigo.comprarCarta();
    }

    this.turno = 1;
    // Duração máxima da partida em turnos — mas o confronto pode terminar
    // antes disso: cada turno vira uma "rodada" (compara o poder total em
    // campo dos dois lados) e quem fizer 4 rodadas primeiro vence, no
    // estilo melhor de 7 — ver resolverRodada()/fimTurno().
    this.maxTurnos = 7;
    this.rodadasParaVencer = 4;
    this.rodadasJogador = 0;
    this.rodadasInimigo = 0;
    this.partidaEncerrada = false;
    this.cartaSelecionada = null;

    // Cartas afetadas por efeitos de turno (ex: CryptoAcionistas) no
    // último fimTurno() resolvido, para a cena poder animar o buff.
    this.efeitosDeTurno = [];

    // Guarda a carta de efeito jogada pela IA no turno atual (se houver),
    // junto das cartas que foram afetadas por ela, para a cena poder
    // mostrar a animação de conjuração e de buff/debuff no momento certo.
    this.efeitoInimigoTurno = null;
    this.jogadasCampoInimigoTurno = [];

    // Histórico de todas as cartas jogadas na partida, na ordem em que
    // foram jogadas. Cada entrada: { turno, quem: 'jogador'|'inimigo', carta }.
    this.historico = [];
  }

  // Registra uma jogada no histórico. "quem" é 'jogador' ou 'inimigo'.
  registrarHistorico(carta, quem) {
    this.historico.push({ turno: this.turno, quem, carta });
  }

  // Variante de jogarCartaDoJogador() usada quando o efeito da carta exige
  // uma ESCOLHA do jogador antes de poder ser resolvido (hoje, só
  // BUFF_ALIADO_ESCOLHIDO/CyberVendedor). A cena chama isto primeiro só pra
  // colocar a carta em campo — sem aplicar nenhum efeito ainda — mostra a UI
  // de seleção de alvo, e só então chama aplicarEfeitoInvocacao() (abaixo,
  // já público) com o alvoEscolhido de fato.
  colocarCartaDoJogador(carta, posicao) {
    const sucesso = this.jogador.jogarCarta(carta, posicao);
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return sucesso;
  }

  // Ponto único de entrada para o jogador jogar uma carta de monstro: garante
  // que o efeito passivo de invocação seja aplicado sempre que a jogada for válida.
  jogarCartaDoJogador(carta, posicao, alvoEscolhido = null) {
    const sucesso = this.jogador.jogarCarta(carta, posicao);
    let afetadas = [];
    if (sucesso && carta.tipo === "terreno") {
      // Terreno não tem efeito de invocação — só ativa o efeito contínuo,
      // que fica sendo recalculado do zero (ver resolverEfeitosContinuos).
      this.resolverEfeitosContinuos(this.jogador);
      this.resolverEfeitosContinuos(this.inimigo);
    } else if (sucesso) {
      afetadas = this.aplicarEfeitoInvocacao(
        carta,
        this.jogador,
        this.inimigo,
        posicao,
        alvoEscolhido,
      );
      this.resolverEfeitosContinuos(this.jogador);
      this.resolverEfeitosContinuos(this.inimigo);
    }
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return { sucesso, afetadas };
  }

  // Recalcula, do zero, o bônus de PA que os terrenos do "dono" concedem ao
  // campo dele. Reverte o bônus aplicado anteriormente (bonusTerreno) e
  // reaplica com base nos terrenos que estão em campo agora — assim
  // terrenos que saem de campo, entram, ou se somam não acumulam bônus à
  // toa. Deve ser chamado sempre que o campo do "dono" mudar (jogar carta,
  // fim de turno, etc.).
  resolverEfeitosContinuos(dono) {
    dono.campo.cartas.forEach((c) => {
      if (c && c.bonusTerreno) {
        c.poder -= c.bonusTerreno;
        c.bonusTerreno = 0;
      }
      if (c && c.bonusDiehGo) {
        c.poder -= c.bonusDiehGo;
        c.bonusDiehGo = 0;
      }
      if (c && c.bonusEfeitoContinuo) {
        c.poder -= c.bonusEfeitoContinuo;
        c.bonusEfeitoContinuo = 0;
      }
    });

    const oponente = dono === this.jogador ? this.inimigo : this.jogador;
    const terrenosNeutralizados = oponente.campo.cartas.some(
      (c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX,
    );

    dono.campo.cartas
      .filter((c) => c && c.tipo === "terreno" && c.efeitoContinuo)
      .forEach((terreno) => {
        if (terrenosNeutralizados) return;
        const { tipo, valor, booster } = terreno.efeitoContinuo;
        if (
          tipo !== TIPOS_EFEITO_CONTINUO.BUFF_CAMPO_CONTINUO &&
          tipo !== TIPOS_EFEITO_CONTINUO.BUFF_MESMA_LINHA
        )
          return;
        const posicaoTerreno = dono.campo.cartas.indexOf(terreno);
        dono.campo.cartas.forEach((c, posicaoCarta) => {
          if (
            c &&
            c.tipo !== "terreno" &&
            (!booster || c.booster === booster) &&
            (tipo !== TIPOS_EFEITO_CONTINUO.BUFF_MESMA_LINHA ||
              Math.floor(posicaoCarta / 5) === Math.floor(posicaoTerreno / 5))
          ) {
            c.poder += valor;
            c.bonusTerreno += valor;
          }
        });
      });

    const tocaAtiva =
      !terrenosNeutralizados &&
      dono.campo.cartas.some(
        (c) =>
          c?.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.OCULTAR_ALIADOS,
      );
    dono.campo.cartas.forEach((c) => {
      if (!c || c.tipo === "terreno") return;
      if (tocaAtiva && !c.ocultadaPelaToca) {
        c.ocultadaPelaToca = true;
        c.revelada = false;
      } else if (!tocaAtiva) {
        c.ocultadaPelaToca = false;
        c.revelada = true;
      }
    });

    dono.campo.cartas.forEach((c, i) => {
      if (c?.nome !== "Dieh'Go, o Xerife" || i < 5) return;
      const cartaAtras = dono.campo.cartas[i - 5];
      if (cartaAtras && cartaAtras.tipo !== "terreno") {
        cartaAtras.poder += 2;
        cartaAtras.bonusDiehGo = (cartaAtras.bonusDiehGo || 0) + 2;
      }
    });

    dono.campo.cartas.forEach((carta, indice) => {
      if (!carta || carta.tipo === "terreno") return;
      let bonus = 0;
      if (carta.efeito?.tipo === TIPOS_EFEITO.BONUS_POR_PERDIDAS) {
        bonus += dono.cartasPerdidas * (carta.efeito.valor || 1);
      }
      if (carta.efeito?.tipo === TIPOS_EFEITO.BONUS_TRIO_ADJACENTE) {
        const vizinhos = [indice - 1, indice + 1].filter(
          (i) => i >= 0 && i < dono.campo.cartas.length && Math.floor(i / 5) === Math.floor(indice / 5),
        );
        const nomes = new Set(vizinhos.map((i) => dono.campo.cartas[i]?.nome));
        if (carta.efeito.nomes.every((nome) => nomes.has(nome)))
          bonus += carta.efeito.valor || 0;
      }
      carta.poder += bonus;
      carta.bonusEfeitoContinuo = bonus;
    });

    const terrenoHostilAtivo = oponente.campo.cartas.some(
      (c) =>
        c?.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.DEBUFF_CAMPO_INIMIGO,
    );
    const terrenoHostilNeutralizado = dono.campo.cartas.some(
      (c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX,
    );
    if (terrenoHostilAtivo && !terrenoHostilNeutralizado) {
      const valor = Math.max(
        ...oponente.campo.cartas
          .filter(
            (c) =>
              c?.efeitoContinuo?.tipo ===
              TIPOS_EFEITO_CONTINUO.DEBUFF_CAMPO_INIMIGO,
          )
          .map((c) => c.efeitoContinuo.valor || 0),
      );
      dono.campo.cartas.forEach((c) => {
        if (!c || c.tipo === "terreno") return;
        c.poder -= valor;
        c.bonusEfeitoContinuo -= valor;
      });
      dono.campo.removerMortas();
    }
  }

  // true se o "dono" tiver algum terreno com REVELAR_MAO_CONTINUO em campo
  // — a cena usa isso para decidir se mostra a mão do oponente virada.
  maoRevelada(dono) {
    const oponente = dono === this.jogador ? this.inimigo : this.jogador;
    if (
      oponente.campo.cartas.some(
        (c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX,
      )
    )
      return false;
    return dono.campo.cartas.some(
      (c) =>
        c &&
        c.tipo === "terreno" &&
        c.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.REVELAR_MAO_CONTINUO,
    );
  }

  // Lista os índices do campo inimigo que uma carta ATACAR alcançaria se
  // fosse jogada em "posicao" agora — pra UI mostrar o range antes de
  // confirmar e deixar escolher o alvo (quando atingeTodos for false).
  previsualizarAlvosAtaque(carta, posicao) {
    if (!carta.efeito || carta.efeito.tipo !== TIPOS_EFEITO.ATACAR) return [];
    return alvosEmRange(
      posicao,
      carta.efeito.rangeH,
      carta.efeito.rangeV,
      this.inimigo.campo,
    );
  }

  // Ativa a habilidade de uma carta que JÁ ESTÁ em campo, uma vez por turno
  // por carta (controlado por carta.usadaEsteTurno, liberado a cada
  // fimTurno()). dono/oponente são os Jogador donos dos campos. Suporta
  // três tipos de efeito ativo hoje:
  //   ATACAR                -> dano em alvo(s) do campo INIMIGO
  //   BUFF_ALIADO_ESCOLHIDO -> +poder em uma carta ALIADA escolhida
  //   REDISTRIBUIR_PODER    -> uma carta ALIADA escolhida perde poder, OUTRA ganha
  // (Agente da DIPSP/Juggernaut usam o primeiro; Estagiário de ML usa o
  // segundo; Gestor de RH usa o terceiro — ver POOL_CARTAS_MONSTRO em
  // cartas.js.) alvoSecundario só é usado por REDISTRIBUIR_PODER (é o
  // segundo alvo escolhido, quem ganha poder; alvoEscolhido é quem perde).
  ativarHabilidade(
    carta,
    dono,
    oponente,
    alvoEscolhido = null,
    alvoSecundario = null,
  ) {
    this.atualizarOverrides();
    // Cessar e Desistir (Advogado Corporativo) é 1x POR PARTIDA, não 1x
    // por turno — usa usadaNaPartida em vez de usadaEsteTurno pra decidir
    // se já foi gasta (usadaNaPartida nunca é resetado em fimTurno()).
    const jaFoiUsada =
      carta.usadaEsteTurno ||
      (carta.efeito?.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO &&
        carta.usadaNaPartida);
    if (!carta.efeito || !carta.habilidadeAtiva || jaFoiUsada)
      return { sucesso: false, afetadas: [] };

    const posicao = dono.campo.cartas.indexOf(carta);
    if (posicao === -1) return { sucesso: false, afetadas: [] };

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR) {
      const { valor, rangeH, rangeV, atingeTodos } = carta.efeito;
      const possiveis = alvosEmRange(posicao, rangeH, rangeV, oponente.campo);
      const indices = atingeTodos
        ? possiveis
        : possiveis.includes(alvoEscolhido)
          ? [alvoEscolhido]
          : possiveis.length
            ? [possiveis[Math.floor(Math.random() * possiveis.length)]]
            : [];

      const afetadas = [];
      indices.forEach((i) => {
        const c = oponente.campo.cartas[i];
        c.buff(-valor);
        afetadas.push({ carta: c, delta: -valor });
        if (c.poder <= 0 && carta.efeito.bonusAoEliminar) {
          carta.buff(carta.efeito.bonusAoEliminar);
          afetadas.push({ carta, delta: carta.efeito.bonusAoEliminar });
        }
      });
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      if (carta.somAtaque && typeof window !== "undefined" && window.cena) {
        const s =
          window.cena.sound.get(carta.somAtaque) ||
          window.cena.sound.add(carta.somAtaque);
        if (s) s.play();
      }

      return { sucesso: indices.length > 0, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) {
      // Machine Learning: alvo tem que ser outra carta aliada em campo
      // (não pode escolher a si mesma). Sem alvo válido, a habilidade não
      // é gasta — o jogador tem que escolher outra aliada em campo antes.
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        alvoEscolhido !== posicao &&
        dono.campo.cartas[alvoEscolhido] &&
        dono.campo.cartas[alvoEscolhido].tipo !== "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      const { valor, custoProprio } = carta.efeito;
      const afetadas = [];
      const alvo = dono.campo.cartas[alvoEscolhido];
      alvo.buff(valor);
      afetadas.push({ carta: alvo, delta: valor });

      if (custoProprio) {
        carta.buff(-custoProprio);
        afetadas.push({ carta, delta: -custoProprio });
      }
      dono.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO) {
      const distribuicao = Array.isArray(alvoEscolhido) ? alvoEscolhido : [];
      const total = carta.efeito.total || 6;
      const vidaTotalDisponivel = oponente.campo.cartas.reduce(
        (soma, alvo) =>
          soma + (alvo && alvo.tipo !== "terreno" ? alvo.poder : 0),
        0,
      );
      const totalDisponivel = Math.min(total, vidaTotalDisponivel);
      const indicesValidos = distribuicao
        .slice(0, totalDisponivel)
        .filter(
          (i) =>
            Number.isInteger(i) &&
            oponente.campo.cartas[i] &&
            oponente.campo.cartas[i].tipo !== "terreno",
        );
      if (
        carta.efeito.alvosUnicos &&
        new Set(indicesValidos).size !== indicesValidos.length
      )
        return { sucesso: false, afetadas: [] };
      if (
        indicesValidos.length === 0 ||
        indicesValidos.length !== distribuicao.length ||
        indicesValidos.length > totalDisponivel
      )
        return { sucesso: false, afetadas: [] };

      const danoPorCarta = new Map();
      indicesValidos.forEach((i) =>
        danoPorCarta.set(i, (danoPorCarta.get(i) || 0) + 1),
      );
      const excedeuVida = Array.from(danoPorCarta.entries()).some(
        ([i, dano]) => dano > oponente.campo.cartas[i].poder,
      );
      if (excedeuVida) return { sucesso: false, afetadas: [] };
      const afetadas = [];
      danoPorCarta.forEach((dano, i) => {
        const alvo = oponente.campo.cartas[i];
        const antes = alvo.poder;
        alvo.buff(-dano);
        afetadas.push({ carta: alvo, delta: alvo.poder - antes });
      });
      oponente.campo.removerMortas();
      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS) {
      const indices = Array.isArray(alvoEscolhido)
        ? [...new Set(alvoEscolhido)]
        : [alvoEscolhido];
      const validos = indices.filter(
        (i) => Number.isInteger(i) && dono.campo.cartas[i]?.tipo !== "terreno",
      );
      if (!validos.length || validos.length > carta.efeito.maxAlvos)
        return { sucesso: false, afetadas: [] };
      const afetadas = validos.map((i) => {
        const alvo = dono.campo.cartas[i];
        alvo.buff(carta.efeito.valor);
        return { carta: alvo, delta: carta.efeito.valor };
      });
      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER) {
      // Reestruturação Interna (Gestor de RH): dois alvos DISTINTOS, ambos
      // aliados em campo (qualquer um dos dois pode ser o próprio Gestor).
      // alvoEscolhido = quem perde poder; alvoSecundario = quem ganha.
      const alvoPerdaValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        dono.campo.cartas[alvoEscolhido] &&
        dono.campo.cartas[alvoEscolhido].tipo !== "terreno";
      const alvoGanhoValido =
        alvoSecundario !== null &&
        alvoSecundario !== undefined &&
        alvoSecundario !== alvoEscolhido &&
        dono.campo.cartas[alvoSecundario] &&
        dono.campo.cartas[alvoSecundario].tipo !== "terreno";
      if (!alvoPerdaValido || !alvoGanhoValido)
        return { sucesso: false, afetadas: [] };

      const { perda, ganho } = carta.efeito;
      const afetadas = [];

      const cartaPerda = dono.campo.cartas[alvoEscolhido];
      // O custo precisa existir por inteiro antes da habilidade acontecer.
      // Sem esta guarda, uma carta com 1 PA era aceita e ainda gerava o
      // bônus de +3, criando poder do nada.
      if (cartaPerda.poder < perda)
        return { sucesso: false, afetadas: [] };
      cartaPerda.buff(-perda);
      afetadas.push({ carta: cartaPerda, delta: -perda });

      const cartaGanho = dono.campo.cartas[alvoSecundario];
      cartaGanho.buff(ganho);
      afetadas.push({ carta: cartaGanho, delta: ganho });

      dono.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO) {
      // Cessar e Desistir: alvo tem que ser um terreno no campo do
      // oponente. Sem alvo válido, a habilidade não é gasta.
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        oponente.campo.cartas[alvoEscolhido] &&
        oponente.campo.cartas[alvoEscolhido].tipo === "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };
      const protegidoPorHumba = oponente.campo.cartas.some(
        (c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX,
      );
      if (protegidoPorHumba) return { sucesso: false, afetadas: [] };

      const terrenoDestruido = oponente.campo.removerCarta(alvoEscolhido);

      // Bônus contínuo do terreno destruído deixa de existir — recalcula
      // do zero pro lado do oponente (mesmo mecanismo do bug corrigido
      // antes: garante que o campo inimigo perca o buff na hora).
      this.resolverEfeitosContinuos(oponente);

      carta.usadaNaPartida = true; // 1x por PARTIDA: não reseta em fimTurno()
      carta.usadaEsteTurno = true; // também trava o botão neste turno, por consistência visual
      carta.revelada = true;
      return { sucesso: true, afetadas: [], terrenoDestruido };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER) {
      // Novo Começo (O Boi): alvo pode ser QUALQUER carta em campo, aliada
      // ou inimiga (terrenos não têm poder, então nunca são alvo válido).
      // alvoEscolhido usa índice deslocado: 0..TAM-1 é o campo do dono,
      // TAM..2*TAM-1 é o campo do oponente (TAM = tamanho do campo) —
      // ver alvosParaHabilidadeEmCampo() e iniciarSelecaoDeQualquerCarta-
      // ParaHabilidade() em jogo.js, que geram/consomem esse mesmo esquema.
      const TAM = dono.campo.cartas.length;
      const lado =
        alvoEscolhido !== null && alvoEscolhido !== undefined
          ? alvoEscolhido < TAM
            ? dono
            : oponente
          : null;
      const indiceReal =
        lado !== null
          ? alvoEscolhido < TAM
            ? alvoEscolhido
            : alvoEscolhido - TAM
          : null;
      const alvoValido =
        lado !== null &&
        lado.campo.cartas[indiceReal] &&
        lado.campo.cartas[indiceReal].tipo !== "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      const alvo = lado.campo.cartas[indiceReal];
      const poderAntes = alvo.poder;
      alvo.poder = alvo.poderBase;
      // Zera o bônus de terreno acumulado e deixa resolverEfeitosContinuos
      // recalcular do zero — evita que o próximo recálculo subtraia um
      // bônus que este reset já descartou.
      alvo.bonusTerreno = 0;
      this.resolverEfeitosContinuos(lado);

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return {
        sucesso: true,
        afetadas: [{ carta: alvo, delta: alvo.poder - poderAntes }],
      };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS) {
      // Garra de aço (O Tigre): alvoEscolhido e alvoSecundario são dois
      // índices distintos no campo do oponente, ambos dentro do range —
      // se só um alvo válido foi escolhido (ex: só havia 1 em alcance), o
      // efeito ainda se aplica a esse um, sem gastar o segundo.
      const { valor, rangeH, rangeV } = carta.efeito;
      const possiveis = alvosEmRange(posicao, rangeH, rangeV, oponente.campo);
      if (!possiveis.includes(alvoEscolhido))
        return { sucesso: false, afetadas: [] };

      const indices = [alvoEscolhido];
      if (
        alvoSecundario !== null &&
        alvoSecundario !== undefined &&
        alvoSecundario !== alvoEscolhido &&
        possiveis.includes(alvoSecundario)
      ) {
        indices.push(alvoSecundario);
      }

      const afetadas = [];
      indices.forEach((i) => {
        const c = oponente.campo.cartas[i];
        c.buff(-valor);
        afetadas.push({ carta: c, delta: -valor });
      });
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      if (carta.somAtaque && typeof window !== "undefined" && window.cena) {
        const s =
          window.cena.sound.get(carta.somAtaque) ||
          window.cena.sound.add(carta.somAtaque);
        if (s) s.play();
      }

      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE) {
      // Override (A Aranha): a carta-alvo CONTINUA no campo do oponente
      // (não muda de dono nem de slot) — só passa a contar ponto pro
      // dono da Aranha, via a flag capturadaPor (ver calcularPoderTotal).
      const hackAnterior = this.obterCartaHackeadaPor(carta);
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        oponente.campo.cartas[alvoEscolhido] &&
        oponente.campo.cartas[alvoEscolhido].tipo !== "terreno" &&
        oponente.campo.cartas[alvoEscolhido] !== hackAnterior &&
        !oponente.campo.cartas[alvoEscolhido].capturadaPorAranha &&
        oponente.campo.cartas[alvoEscolhido].poder < carta.poder;
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      // Troca atômica de alvo: o vínculo antigo só é solto depois que o
      // novo alvo foi completamente validado. Assim um clique inválido não
      // faz a Aranha perder o controle que já possuía.
      if (hackAnterior) {
        hackAnterior.capturadaPor = null;
        hackAnterior.capturadaPorAranha = null;
      }
      const capturada = oponente.campo.cartas[alvoEscolhido];
      capturada.capturadaPor = dono;
      capturada.capturadaPorAranha = carta;

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return {
        sucesso: true,
        afetadas: [],
        capturada,
        liberadaAnterior: hackAnterior || null,
      };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ROUBAR_PODER) {
      // Mãos Leves (O Rato): alvo pode ser QUALQUER carta inimiga em campo
      // (sem restrição de range/coluna, diferente do ATACAR).
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        oponente.campo.cartas[alvoEscolhido] &&
        oponente.campo.cartas[alvoEscolhido].tipo !== "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      const { valor } = carta.efeito;
      const alvo = oponente.campo.cartas[alvoEscolhido];
      const roubado = Math.min(valor, alvo.poder);

      alvo.buff(-roubado);
      carta.buff(roubado);
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return {
        sucesso: true,
        afetadas: [
          { carta: alvo, delta: -roubado },
          { carta, delta: roubado },
        ],
      };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR) {
      // Escalada (A Cabra): troca de lugar com outra carta aliada, ou se
      // move pra um espaço livre — sempre dentro do próprio campo. Nunca
      // troca com terreno (terreno não sai do lugar).
      const alvoOcupante = dono.campo.cartas[alvoEscolhido];
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        alvoEscolhido !== posicao &&
        (alvoOcupante === null || alvoOcupante.tipo !== "terreno");
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      dono.campo.cartas[posicao] = alvoOcupante;
      dono.campo.cartas[alvoEscolhido] = carta;

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas: [] };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ENVENENAR) {
      // Dose Letal (A Cobra): alvo é uma carta inimiga em alcance curto
      // (mesmo esquema de range de ATACAR). A picada em si não causa dano
      // na hora — só marca a carta como envenenada; o dano por turno é
      // resolvido em Partida.resolverEfeitosDeTurno().
      const { rangeH, rangeV, valor } = carta.efeito;
      const possiveis = alvosEmRange(posicao, rangeH, rangeV, oponente.campo);
      if (!possiveis.includes(alvoEscolhido))
        return { sucesso: false, afetadas: [] };

      const alvo = oponente.campo.cartas[alvoEscolhido];
      const venenoAnterior = Math.max(
        0,
        Number(alvo.envenenada?.valor) || 0,
      );
      alvo.envenenada = {
        valor: venenoAnterior + valor,
        stacks: Math.max(0, Number(alvo.envenenada?.stacks) || 0) + 1,
      };

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas: [] };
    }

    return { sucesso: false, afetadas: [] };
  }

  // Lista os índices de campo que ativarHabilidade() atingiria agora, pra
  // UI destacar os alvos possíveis e deixar o jogador escolher antes de
  // confirmar. Pra ATACAR, os alvos são no campo do OPONENTE; pra
  // BUFF_ALIADO_ESCOLHIDO (Estagiário de ML), os alvos são no campo do
  // próprio DONO, exceto a própria carta.
  alvosParaHabilidadeEmCampo(carta, dono, oponente) {
    if (!carta.efeito || !carta.habilidadeAtiva) return [];
    const posicao = dono.campo.cartas.indexOf(carta);
    if (posicao === -1) return [];

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR) {
      return alvosEmRange(
        posicao,
        carta.efeito.rangeH,
        carta.efeito.rangeV,
        oponente.campo,
      );
    }

    // Eu Sou a Lei ignora completamente posição, fileira e alcance:
    // toda carta inimiga que tenha PA é um alvo válido.
    if (carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO) {
      return oponente.campo.cartas
        .map((c, i) => (c && c.tipo !== "terreno" ? i : null))
        .filter((i) => i !== null);
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) {
      const indices = [];
      dono.campo.cartas.forEach((c, i) => {
        if (c && i !== posicao && c.tipo !== "terreno") indices.push(i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS) {
      return dono.campo.cartas
        .map((c, i) => (c && c.tipo !== "terreno" ? i : null))
        .filter((i) => i !== null);
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER) {
      // Diferente do BUFF_ALIADO_ESCOLHIDO, aqui a própria carta (o Gestor)
      // TAMBÉM pode ser escolhida como um dos dois alvos — a UI (jogo.js)
      // é quem cuida de excluir o primeiro alvo escolhido da segunda lista.
      const indices = [];
      const custo = Math.max(0, Number(carta.efeito.perda) || 0);
      dono.campo.cartas.forEach((c, i) => {
        if (c && c.tipo !== "terreno" && c.poder >= custo) indices.push(i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO) {
      const indices = [];
      oponente.campo.cartas.forEach((c, i) => {
        if (c && c.tipo === "terreno") indices.push(i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER) {
      // Novo Começo (O Boi): alvo é QUALQUER carta em campo — aliada
      // (incluindo o próprio Boi) ou inimiga. Índice deslocado: 0..TAM-1
      // = campo do dono, TAM..2*TAM-1 = campo do oponente (mesmo esquema
      // decodificado em ativarHabilidade()).
      const TAM = dono.campo.cartas.length;
      const indices = [];
      dono.campo.cartas.forEach((c, i) => {
        if (c && c.tipo !== "terreno") indices.push(i);
      });
      oponente.campo.cartas.forEach((c, i) => {
        if (c && c.tipo !== "terreno") indices.push(TAM + i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS) {
      // Garra de aço (O Tigre): mesmo range de ATACAR — a diferença (dois
      // alvos em vez de um) é resolvida pela UI em duas etapas, ver
      // iniciarSelecaoDoPrimeiroAlvoDuplo() em jogo.js.
      return alvosEmRange(
        posicao,
        carta.efeito.rangeH,
        carta.efeito.rangeV,
        oponente.campo,
      );
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE) {
      this.atualizarOverrides();
      const hackAtual = this.obterCartaHackeadaPor(carta);
      // Override (A Aranha): só cartas inimigas com poder MENOR que o
      // dela — a carta capturada fica no campo do oponente, então não
      // precisa de slot livre no campo do dono.
      const indices = [];
      oponente.campo.cartas.forEach((c, i) => {
        if (
          c &&
          c.tipo !== "terreno" &&
          c !== hackAtual &&
          !c.capturadaPorAranha &&
          c.poder < carta.poder
        ) {
          indices.push(i);
        }
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ROUBAR_PODER) {
      // Mãos Leves (O Rato): qualquer carta inimiga em campo, sem range.
      const indices = [];
      oponente.campo.cartas.forEach((c, i) => {
        if (c && c.tipo !== "terreno") indices.push(i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR) {
      // Escalada (A Cabra): qualquer espaço do PRÓPRIO campo, livre ou
      // ocupado por aliada (não-terreno), exceto a posição atual dela.
      const indices = [];
      dono.campo.cartas.forEach((c, i) => {
        if (i !== posicao && (c === null || c.tipo !== "terreno")) {
          indices.push(i);
        }
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ENVENENAR) {
      // Dose Letal (A Cobra): mesmo esquema de alvosEmRange do ATACAR.
      return alvosEmRange(
        posicao,
        carta.efeito.rangeH,
        carta.efeito.rangeV,
        oponente.campo,
      );
    }

    return [];
  }

  // O Trotar do Cavalo: lista as colunas (0-4) do campo inimigo que têm ao
  // menos uma carta (não-terreno), pra UI saber quais colunas destacar
  // antes do jogador confirmar (ver iniciarSelecaoDeColunaInimiga, jogo.js).
  colunasComAlvoInimigo() {
    const colunas = [];
    for (let col = 0; col < 5; col++) {
      const a = this.inimigo.campo.cartas[col];
      const b = this.inimigo.campo.cartas[col + 5];
      const temAlvo = (a && a.tipo !== "terreno") || (b && b.tipo !== "terreno");
      if (temAlvo) colunas.push(col);
    }
    return colunas;
  }

  // Ponto único de entrada para o jogador conjurar uma carta de efeito:
  // ela nunca vai para o campo, só é consumida e aplica sua passiva.
  // alvoEscolhido só é usado pela Sugestão Algorítmica (BUSCAR_CARTA_DECK):
  // é o índice, no baralho do jogador, da carta escolhida pra ir pra mão.
  jogarCartaEfeitoDoJogador(carta, alvoEscolhido = null) {
    const sucesso = this.jogador.jogarCartaEfeito(carta);
    const afetadas = sucesso
      ? this.aplicarEfeitoInvocacao(
          carta,
          this.jogador,
          this.inimigo,
          null,
          alvoEscolhido,
        )
      : [];
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return { sucesso, afetadas };
  }

  // Aplica o efeito passivo de uma carta no momento em que ela é invocada.
  // "dono" é quem jogou a carta, "oponente" é o outro jogador.
  // Retorna a lista de cartas de campo afetadas (com o delta de poder
  // aplicado), para que a cena possa animar exatamente essas cartas.
  aplicarEfeitoInvocacao(
    carta,
    dono,
    oponente,
    posicao = null,
    alvoEscolhido = null,
  ) {
    if (!carta.efeito) return [];
    const { tipo, valor } = carta.efeito;
    const afetadas = [];

    if (tipo === TIPOS_EFEITO.ATACAR) return []; // habilidade ativa: não dispara ao invocar, ver ativarHabilidade()
    if (carta.habilidadeAtiva) return []; // qualquer efeito marcado como habilidade ativa (ex: Estagiário de ML) só dispara via ativarHabilidade()

    switch (tipo) {
      case TIPOS_EFEITO.BUFF_ALIADOS:
        dono.campo.cartas.forEach((c) => {
          if (c && c !== carta && c.tipo !== "terreno") {
            c.buff(valor);
            afetadas.push({ carta: c, delta: valor });
          }
        });
        break;
      case TIPOS_EFEITO.DEBUFF_INIMIGOS:
        oponente.campo.cartas.forEach((c) => {
          if (c && c.tipo !== "terreno") {
            c.buff(-valor);
            afetadas.push({ carta: c, delta: -valor });
          }
        });
        oponente.campo.removerMortas();
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
      case TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO: {
        // alvoEscolhido é um índice no campo do dono (Venda Casada permite
        // escolher qualquer aliada em campo, inclusive esta mesma carta,
        // que nesse momento já está em "posicao"). Sem escolha válida,
        // cai no padrão de buffar a própria carta recém-invocada. Terreno
        // nunca é alvo válido (não tem PA).
        // (Cartas com habilidadeAtiva=true, como o Estagiário de ML, nunca
        // chegam aqui — ver o early return de habilidadeAtiva acima.)
        const idxAlvo =
          alvoEscolhido !== null &&
          alvoEscolhido !== undefined &&
          dono.campo.cartas[alvoEscolhido] &&
          dono.campo.cartas[alvoEscolhido].tipo !== "terreno"
            ? alvoEscolhido
            : posicao;
        const alvo = dono.campo.cartas[idxAlvo];
        if (alvo && alvo.tipo !== "terreno") {
          alvo.buff(valor);
          afetadas.push({ carta: alvo, delta: valor });
        }
        break;
      }
      case TIPOS_EFEITO.BUSCAR_CARTA_DECK: {
        // Sugestão Algorítmica: alvoEscolhido é o índice, no baralho do
        // dono, da carta escolhida. Sem escolha válida, o efeito não faz
        // nada (a carta ainda é consumida normalmente ao ser conjurada).
        if (
          alvoEscolhido !== null &&
          alvoEscolhido !== undefined &&
          dono.deck.cartas[alvoEscolhido]
        ) {
          const [comprada] = dono.deck.cartas.splice(alvoEscolhido, 1);
          dono.mao.adicionarCarta(comprada);
          dono.cartasRecemCompradas.push(comprada);
        }
        break;
      }
      case TIPOS_EFEITO.ABSORVER_ALIADOS: {
        // Potencialização de Capital (RaspClay MonteCorp): alvoEscolhido
        // aqui é um ARRAY de índices no campo do dono (não um índice só,
        // como nos outros efeitos) — já filtrados pela UI (jogo.js) como
        // aliadas elegíveis (nível baixo/médio, ver alvosParaAbsorverAliados
        // abaixo) e limitados a efeito.maxAlvos. Cada aliada escolhida é
        // sacrificada diretamente e o poder somado delas vira ganho pra esta
        // carta. Sacrifício não é redução de PA: por isso ele ignora efeitos
        // como Casca Grossa, que protege O Porco apenas contra debuffs.
        const indices = Array.isArray(alvoEscolhido) ? alvoEscolhido : [];
        const maxAlvos = carta.efeito.maxAlvos || 0;
        let somaPoder = 0;

        indices.slice(0, maxAlvos).forEach((idx) => {
          const alvo = dono.campo.cartas[idx];
          if (!alvo || alvo === carta || alvo.tipo === "terreno") return;
          const poderSacrificado = alvo.poder;
          somaPoder += poderSacrificado;
          afetadas.push({ carta: alvo, delta: -poderSacrificado });
          alvo.poder = 0;
          alvo.revelada = true;
        });

        if (somaPoder > 0) {
          carta.buff(somaPoder);
          afetadas.push({ carta, delta: somaPoder });
        }
        dono.campo.removerMortas();
        break;
      }
      case TIPOS_EFEITO.ATACAR_COLUNA: {
        // O Trotar do Cavalo: alvoEscolhido é a COLUNA (0-4) escolhida pelo
        // jogador (ver alvosParaAtacarColuna abaixo e a seleção em jogo.js).
        // Atinge as duas fileiras dessa coluna no campo do oponente.
        const coluna = alvoEscolhido;
        if (coluna !== null && coluna !== undefined) {
          [coluna, coluna + 5].forEach((idx) => {
            const c = oponente.campo.cartas[idx];
            if (c && c.tipo !== "terreno") {
              c.buff(-valor);
              afetadas.push({ carta: c, delta: -valor });
            }
          });
          oponente.campo.removerMortas();
        }
        break;
      }
      case TIPOS_EFEITO.BUFF_DOIS_ALIADOS: {
        const indices = Array.isArray(alvoEscolhido) ? alvoEscolhido : [];
        const valores = carta.efeito.valores || [2, 1];
        indices.slice(0, 2).forEach((idx, ordem) => {
          const alvo = dono.campo.cartas[idx];
          if (!alvo || alvo.tipo === "terreno") return;
          const ganho = valores[ordem] || 0;
          alvo.buff(ganho);
          afetadas.push({ carta: alvo, delta: ganho });
        });
        break;
      }
      case TIPOS_EFEITO.ARMADILHA_ESPACO: {
        const idx = Number(alvoEscolhido);
        if (Number.isInteger(idx) && idx >= 0 && idx < 10 && !oponente.campo.cartas[idx]) {
          oponente.campo.armadilhas.add(idx);
        }
        break;
      }
      case TIPOS_EFEITO.REVELAR_CARTAS_INIMIGO: {
        // Faro (O Cão): junta mão + baralho do oponente e revela até
        // `valor` cartas (prioriza a mão, completa com o baralho) — não
        // mexe no campo, então "afetadas" fica vazio. A UI (jogo.js) lê
        // this.ultimaRevelacaoFaro pra mostrar os nomes revelados.
        const poolInimigo = [...oponente.mao.cartas, ...oponente.deck.cartas];
        this.ultimaRevelacaoFaro = poolInimigo.slice(0, valor);
        break;
      }
      case TIPOS_EFEITO.RECICLAR_DESCARTE: {
        const disponiveis = dono.descarte.filter((descartada) => descartada !== carta);
        const escolhida = Number.isInteger(alvoEscolhido)
          ? disponiveis[alvoEscolhido]
          : disponiveis[disponiveis.length - 1];
        if (escolhida) {
          dono.descarte.splice(dono.descarte.indexOf(escolhida), 1);
          dono.mao.adicionarCarta(escolhida);
          dono.cartasRecemCompradas.push(escolhida);
        }
        break;
      }
      case TIPOS_EFEITO.REMOVER_TERRENO: {
        const indice = Number(alvoEscolhido);
        const alvo = oponente.campo.cartas[indice];
        if (Number.isInteger(indice) && alvo?.tipo === "terreno") {
          oponente.campo.removerCarta(indice);
          this.resolverEfeitosContinuos(oponente);
          this.resolverEfeitosContinuos(dono);
        }
        break;
      }
    }

    return afetadas;
  }

  // Lista os índices do campo do DONO que uma carta ABSORVER_ALIADOS (ex:
  // RaspClay MonteCorp) pode escolher pra absorver agora: aliadas cuja
  // classificação oficial esteja permitida pelo efeito, sem contar terrenos
  // nem a própria carta recém-invocada. Usada pela
  // UI (iniciarSelecaoDeAbsorcao, em jogo.js) pra saber quais slots
  // destacar antes do jogador confirmar.
  alvosParaAbsorverAliados(carta, dono, posicaoPropria) {
    if (!carta.efeito || carta.efeito.tipo !== TIPOS_EFEITO.ABSORVER_ALIADOS)
      return [];
    const niveisPermitidos = carta.efeito.niveisPermitidos || [
      "baixa",
      "media",
    ];
    const indices = [];
    dono.campo.cartas.forEach((c, i) => {
      if (
        c &&
        i !== posicaoPropria &&
        c.tipo !== "terreno" &&
        niveisPermitidos.includes(c.nivel)
      )
        indices.push(i);
    });
    return indices;
  }

  // Fecha o turno atual. A cada turno fechado, uma rodada é resolvida
  // (resolverRodada): quem tiver mais poder total em campo fatura o
  // ponto daquela rodada. A partida termina — e fimTurno() para de fazer
  // qualquer coisa depois disso (this.partidaEncerrada = true) — assim
  // que um dos lados chegar a 4 rodadas vencidas (melhor de 7) ou o turno
  // máximo (7) for atingido, o que vier primeiro.
  fimTurno(opcoes = {}) {
    if (this.partidaEncerrada) {
      return { resultadoCombate: null, fimDeJogo: true, resultadoRodada: null };
    }

    // Libera de novo as habilidades ativas (1x por turno) dos dois lados.
    [...this.jogador.campo.cartas, ...this.inimigo.campo.cartas].forEach(
      (c) => {
        if (c) c.usadaEsteTurno = false;
      },
    );

    // No multiplayer, o segundo cliente ocupa o lugar da IA. O estado da
    // primeira metade da rodada já chegou pela rede, então fechamos a rodada
    // sem gerar uma jogada automática.
    if (!opcoes.semIA) this.turnoIA();
    // Cartas que a IA acabou de jogar neste turno também entram no sorteio
    // de efeitos de turno abaixo (mesma regra pro jogador e pro inimigo).
    this.efeitosDeTurno = this.resolverEfeitosDeTurno();

    const resultadoRodada = this.resolverRodada();
    const partidaDecidida =
      this.rodadasJogador >= this.rodadasParaVencer ||
      this.rodadasInimigo >= this.rodadasParaVencer;
    const fimDeJogo = partidaDecidida || this.turno >= this.maxTurnos;

    let resultadoCombate = null;
    if (fimDeJogo) {
      resultadoCombate = this.finalizarPartida();
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
    // resultadoRodada é o placar da rodada que acabou de fechar (quem tinha
    // mais poder em campo), útil pra cena mostrar o placar melhor-de-7
    // mesmo nos turnos em que a partida ainda não terminou.
    return { resultadoCombate, fimDeJogo, resultadoRodada };
  }

  // Percorre o campo dos dois jogadores e reavalia o efeitoTurno de cada
  // carta presente. Retorna a lista de cartas afetadas (com o delta de
  // poder aplicado), no mesmo formato de aplicarEfeitoInvocacao(), para a
  // cena poder animar exatamente essas cartas (reaproveita
  // animarCartasAfetadas em jogo.js).
  resolverEfeitosDeTurno() {
    const afetadas = [];

    [this.jogador, this.inimigo].forEach((dono) => {
      // Agrupa as cartas em campo por TIPO de efeito de turno. Antes, cada
      // cópia da carta rolava a chance separadamente — com 2 CryptoAcionistas
      // em campo o buff total virava +2 (uma rolagem por cópia), com 3 virava
      // +3, etc. Agora existe UMA rolagem só por tipo de efeito, então o
      // ganho total continua sendo +1 (o valor configurado na carta) não
      // importa quantas cópias estejam em campo.
      const porTipo = {};
      dono.campo.cartas.forEach((carta) => {
        if (!carta || !carta.efeitoTurno) return;
        const tipo = carta.efeitoTurno.tipo;
        if (!porTipo[tipo]) porTipo[tipo] = [];
        porTipo[tipo].push(carta);
      });

      Object.values(porTipo).forEach((cartasDoGrupo) => {
        // Todas as cópias de uma mesma carta compartilham a mesma
        // config (chance/valor), então pega da primeira do grupo.
        const { tipo, chance, valor } = cartasDoGrupo[0].efeitoTurno;

        switch (tipo) {
          case TIPOS_EFEITO_TURNO.CHANCE_GANHAR_PODER:
            if (Math.random() < chance) {
              // Só uma carta do grupo recebe o buff (sorteada entre as
              // cópias em campo), mantendo o ganho total em +valor.
              const alvo =
                cartasDoGrupo[Math.floor(Math.random() * cartasDoGrupo.length)];
              alvo.buff(valor);
              afetadas.push({ carta: alvo, delta: valor });
            }
            break;
        }
      });
    });

    // Dose Letal (A Cobra): cartas envenenadas perdem poder a cada turno,
    // sempre respeitando Casca Grossa (buff() já ignora reduções nesse
    // caso). O veneno persiste enquanto a carta estiver em campo — não
    // existe cura por enquanto.
    [this.jogador, this.inimigo].forEach((dono) => {
      dono.campo.cartas.forEach((c) => {
        if (c && c.envenenada) {
          const poderAntes = c.poder;
          c.buff(-c.envenenada.valor);
          const delta = c.poder - poderAntes;
          if (delta !== 0) afetadas.push({ carta: c, delta });
        }
      });
    });

    // Recupera dano de cartas aliadas enquanto um terreno Beira-mar (ou
    // qualquer outro RECUPERAR_DANO_CONTINUO) estiver em campo — nunca
    // passa do PA original da carta (poderBase).
    [this.jogador, this.inimigo].forEach((dono) => {
      const terrenos = dono.campo.cartas.filter(
        (c) =>
          c &&
          c.tipo === "terreno" &&
          c.efeitoContinuo?.tipo ===
            TIPOS_EFEITO_CONTINUO.RECUPERAR_DANO_CONTINUO,
      );
      const oponente = dono === this.jogador ? this.inimigo : this.jogador;
      const neutralizados = oponente.campo.cartas.some(
        (c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX,
      );
      if (neutralizados) return;
      if (terrenos.length === 0) return;
      const valor = Math.max(...terrenos.map((t) => t.efeitoContinuo.valor));
      dono.campo.cartas.forEach((c) => {
        if (c && c.tipo !== "terreno" && c.poder < c.poderBase) {
          const novoPoder = Math.min(c.poderBase, c.poder + valor);
          const delta = novoPoder - c.poder;
          c.poder = novoPoder;
          if (delta > 0) afetadas.push({ carta: c, delta });
        }
      });
    });

    // Reavalia bônus contínuos dos terrenos (Torre MonteCorp etc.) antes de
    // remover mortas, já que o buff/recuperação pode ter tirado uma carta
    // da zona de "morta".
    this.resolverEfeitosContinuos(this.jogador);
    this.resolverEfeitosContinuos(this.inimigo);

    this.jogador.campo.removerMortas();
    this.inimigo.campo.removerMortas();
    return afetadas;
  }

  turnoIA() {
    this.efeitoInimigoTurno = null;
    this.jogadasCampoInimigoTurno = [];
    const candidatas = Phaser.Utils.Array.Shuffle([...this.inimigo.mao.cartas]);
    const efeitosConjurados = [];
    const afetadasPorEfeitos = [];
    const maxJogadas = candidatas.length
      ? Phaser.Math.Between(1, Math.min(3, candidatas.length))
      : 0;
    let jogadas = 0;

    for (const carta of candidatas) {
      if (jogadas >= maxJogadas) break;

      if (carta.tipo === "efeito") {
        const sucesso = this.inimigo.jogarCartaEfeito(carta);
        if (!sucesso) continue;
        const alvoDeckIA =
          carta.efeito?.tipo === TIPOS_EFEITO.BUSCAR_CARTA_DECK &&
          this.inimigo.deck.cartas.length > 0
            ? Math.floor(Math.random() * this.inimigo.deck.cartas.length)
            : null;
        const aliados = this.inimigo.campo.cartas
          .map((c, i) => (c && c.tipo !== "terreno" ? i : null))
          .filter((i) => i !== null);
        const slotsJogadorVazios = this.jogador.campo.cartas
          .map((c, i) => (!c ? i : null))
          .filter((i) => i !== null);
        const alvoEfeitoIA =
          carta.efeito?.tipo === TIPOS_EFEITO.BUFF_DOIS_ALIADOS &&
          aliados.length >= 2
            ? Phaser.Utils.Array.Shuffle([...aliados]).slice(0, 2)
            : carta.efeito?.tipo === TIPOS_EFEITO.ARMADILHA_ESPACO &&
                slotsJogadorVazios.length
              ? Phaser.Utils.Array.GetRandom(slotsJogadorVazios)
              : alvoDeckIA;
        afetadasPorEfeitos.push(
          ...this.aplicarEfeitoInvocacao(
            carta,
            this.inimigo,
            this.jogador,
            null,
            alvoEfeitoIA,
          ),
        );
        efeitosConjurados.push(carta);
        this.registrarHistorico(carta, "inimigo");
        jogadas++;
        continue;
      }

      const slotsLivres = this.inimigo.campo.cartas
        .map((c, i) => (!c ? i : null))
        .filter((i) => i !== null);
      if (!slotsLivres.length) continue;
      const posicao = Phaser.Utils.Array.GetRandom(slotsLivres);
      const sucesso = this.inimigo.jogarCarta(carta, posicao);
      if (!sucesso) continue;
      this.registrarHistorico(carta, "inimigo");
      this.jogadasCampoInimigoTurno.push({ carta, posicao });
      if (carta.tipo !== "terreno") {
        this.aplicarEfeitoInvocacao(
          carta,
          this.inimigo,
          this.jogador,
          posicao,
        );
      }
      this.resolverEfeitosContinuos(this.inimigo);
      this.resolverEfeitosContinuos(this.jogador);
      jogadas++;
    }

    if (efeitosConjurados.length) {
      this.efeitoInimigoTurno = {
        carta: efeitosConjurados[0],
        cartas: efeitosConjurados,
        afetadas: afetadasPorEfeitos,
      };
    }

    // Reavalia uma última vez depois das duas jogadas. Isso é importante
    // quando a Toca do Coelho foi a primeira: a segunda carta também deve
    // nascer oculta antes de a cena iniciar a animação sequencial.
    this.resolverEfeitosContinuos(this.inimigo);
    this.resolverEfeitosContinuos(this.jogador);

    // IA também ativa habilidades de ataque disponíveis em campo (1x cada).
    this.inimigo.campo.cartas.forEach((c) => {
      if (c && c.habilidadeAtiva && !c.usadaEsteTurno) {
        // Cessar e Desistir (Advogado Corporativo): a IA precisa de um
        // alvo explícito (terreno do jogador) — sem isso ativarHabilidade
        // sempre falharia em silêncio, então mira no primeiro disponível.
        const alvoTerrenoIA =
          c.efeito?.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO
            ? this.alvosParaHabilidadeEmCampo(c, this.inimigo, this.jogador)[0]
            : c.efeito?.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO
              ? this.montarDistribuicaoDanoIA(c, this.jogador)
              : c.efeito?.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS
                ? this.alvosParaHabilidadeEmCampo(
                    c,
                    this.inimigo,
                    this.jogador,
                  ).slice(0, c.efeito.maxAlvos || 2)
                : null;
        this.ativarHabilidade(c, this.inimigo, this.jogador, alvoTerrenoIA);
      }
    });
  }

  montarDistribuicaoDanoIA(carta, oponente) {
    let restante = carta.efeito.total || 6;
    const distribuicao = [];
    oponente.campo.cartas.forEach((alvo, indice) => {
      if (!alvo || alvo.tipo === "terreno" || restante <= 0) return;
      const dano = carta.efeito.alvosUnicos
        ? 1
        : Math.min(alvo.poder, restante);
      for (let i = 0; i < dano; i++) distribuicao.push(indice);
      restante -= dano;
    });
    return distribuicao;
  }

  // A identidade da própria instância da Aranha define o vínculo. Assim,
  // duas ou mais Aranhas podem manter hacks diferentes sem compartilhar
  // estado; somente um alvo já hackeado fica indisponível para as demais.
  obterCartaHackeadaPor(aranha) {
    for (const dono of [this.jogador, this.inimigo]) {
      const alvo = dono.campo.cartas.find(
        (carta) => carta?.capturadaPorAranha === aranha,
      );
      if (alvo) return alvo;
    }
    return null;
  }

  // Mantém o Override da Dona Aranha como um vínculo contínuo. Ela pode
  // controlar somente uma carta; se sair de campo ou deixar de ter PA
  // estritamente maior que o alvo, o hack acaba imediatamente.
  atualizarOverrides() {
    [this.jogador, this.inimigo].forEach((donoDoCampoFisico) => {
      donoDoCampoFisico.campo.cartas.forEach((alvo) => {
        if (!alvo?.capturadaPorAranha) return;
        const aranha = alvo.capturadaPorAranha;
        const aranhaEmCampo =
          this.jogador.campo.cartas.includes(aranha) ||
          this.inimigo.campo.cartas.includes(aranha);
        if (aranhaEmCampo && aranha.poder > alvo.poder) return;

        alvo.capturadaPor = null;
        alvo.capturadaPorAranha = null;
      });
    });
  }

  // Recebe o JOGADOR (não mais o campo) porque, com Override (A Aranha),
  // uma carta pode fisicamente estar no campo do oponente mas contar
  // ponto pro dono da Aranha (carta.capturadaPor) — então é preciso
  // varrer os dois campos e decidir o dono efetivo de cada carta.
  calcularPoderTotal(jogadorAlvo) {
    this.atualizarOverrides();
    let total = 0;
    [this.jogador, this.inimigo].forEach((donoDoCampoFisico) => {
      donoDoCampoFisico.campo.cartas.forEach((carta) => {
        if (!carta) return;
        const donoEfetivo = carta.capturadaPor || donoDoCampoFisico;
        if (donoEfetivo === jogadorAlvo) total += carta.poder;
      });
    });
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

  // Encerra a partida na hora, como derrota do jogador — usado pelo botão
  // "Desistir" da roda de botões (jogo.js). Diferente de resolverCombate(),
  // o resultado aqui não depende do poder em campo: quem desiste perde,
  // ponto final. Ainda assim reaproveita calcularPoderTotal/
  // obterCartaComMaiorPoder pra preencher a mesma tela de fim de jogo.
  desistir() {
    if (this.partidaEncerrada) return null;
    this.partidaEncerrada = true;
    this.inimigo.vitorias++;

    const poderJogador = this.calcularPoderTotal(this.jogador);
    const poderInimigo = this.calcularPoderTotal(this.inimigo);
    const cartaDestaque = this.obterCartaComMaiorPoder(this.inimigo.campo);

    return {
      poderJogador,
      poderInimigo,
      resultado: "inimigo",
      cartaDestaque,
      rodadasJogador: this.rodadasJogador,
      rodadasInimigo: this.rodadasInimigo,
    };
  }

  // Resolve UMA rodada (chamada a cada fimTurno): compara o poder total em
  // campo dos dois lados neste instante e dá o ponto pra quem estiver na
  // frente (empate não pontua ninguém). Isso é só o placar da rodada —
  // quem vence a PARTIDA é decidido em finalizarPartida().
  resolverRodada() {
    const poderJogador = this.calcularPoderTotal(this.jogador);
    const poderInimigo = this.calcularPoderTotal(this.inimigo);

    let vencedor = "empate";
    if (poderJogador > poderInimigo) {
      this.rodadasJogador++;
      vencedor = "jogador";
    } else if (poderInimigo > poderJogador) {
      this.rodadasInimigo++;
      vencedor = "inimigo";
    }

    return {
      poderJogador,
      poderInimigo,
      vencedor,
      rodadasJogador: this.rodadasJogador,
      rodadasInimigo: this.rodadasInimigo,
    };
  }

  // Fecha a PARTIDA (chamada só quando fimTurno detecta que ela terminou):
  // o lado com mais rodadas vencidas (melhor de 7) leva a vitória; se os
  // dois turnos acabarem empatados em rodadas, é empate mesmo. Monta o
  // mesmo formato de resultado de antes (poder final em campo + carta
  // destaque) pra tela de fim de jogo não precisar mudar.
  finalizarPartida() {
    const poderJogador = this.calcularPoderTotal(this.jogador);
    const poderInimigo = this.calcularPoderTotal(this.inimigo);

    let resultado;
    if (this.rodadasJogador > this.rodadasInimigo) {
      this.jogador.vitorias++;
      resultado = "jogador";
    } else if (this.rodadasInimigo > this.rodadasJogador) {
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
      `Rodadas Jogador: ${this.rodadasJogador} | Rodadas Inimigo: ${this.rodadasInimigo} | Resultado: ${resultado}`,
    );

    // Retorna o resultado em vez de só logar, para a cena (jogo.js)
    // poder mostrar feedback visual (texto, flash de câmera etc.)
    return {
      poderJogador,
      poderInimigo,
      resultado,
      cartaDestaque,
      rodadasJogador: this.rodadasJogador,
      rodadasInimigo: this.rodadasInimigo,
    };
  }
}

// O layout continua usando o espaço lógico de 1080x2160, mas celulares
// renderizam em 720x1440. A câmera faz a conversão sem mudar nenhuma
// coordenada de jogo ou de input. Isso corta 56% dos pixels processados por
// frame, uma diferença grande justamente nos aparelhos que mais precisam.
const usarCanvasParaDiagnostico =
  typeof window !== "undefined" &&
  typeof URLSearchParams !== "undefined" &&
  new URLSearchParams(window.location.search).get("renderer") === "canvas";

const parametrosRender =
  typeof URLSearchParams !== "undefined"
    ? new URLSearchParams(window.location?.search || "")
    : { get: () => null };
const qualidadeSolicitada = parametrosRender.get("quality");
const ponteiroGrosso = window.matchMedia?.("(pointer: coarse)")?.matches;
const telaCompacta =
  Math.min(window.screen?.width || GW, window.screen?.height || GH) <= 1024;
const quantidadeToques =
  typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;
const usarPerfilMovel =
  qualidadeSolicitada !== "high" &&
  (qualidadeSolicitada === "mobile" ||
    (quantidadeToques > 0 && telaCompacta) ||
    (ponteiroGrosso && telaCompacta));
const ESCALA_RENDER = usarPerfilMovel ? 2 / 3 : 1;
const LARGURA_RENDER = Math.round(GW * ESCALA_RENDER);
const ALTURA_RENDER = Math.round(GH * ESCALA_RENDER);

function configurarCameraLogica(scene) {
  if (!scene.__cyberduelTextScaleInstalled) {
    const criarTextoOriginal = scene.add.text.bind(scene.add);
    scene.add.text = (x, y, texto, estilo = {}) =>
      criarTextoOriginal(
        x,
        y,
        texto,
        window.cyberduelSettings?.phaserTextStyle(estilo) || estilo,
      );
    scene.__cyberduelTextScaleInstalled = true;
  }
  if (ESCALA_RENDER === 1) return;
  const camera = scene.cameras.main;
  camera.setZoom(ESCALA_RENDER);
  camera.centerOn(GW / 2, GH / 2);
}

window.CYBERDUEL_RENDER_PROFILE = Object.freeze({
  mobile: usarPerfilMovel,
  scale: ESCALA_RENDER,
  width: LARGURA_RENDER,
  height: ALTURA_RENDER,
});

const config = {
  type: usarCanvasParaDiagnostico ? Phaser.CANVAS : Phaser.AUTO,
  width: LARGURA_RENDER,
  height: ALTURA_RENDER,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  render: {
    antialias: true,
    antialiasGL: false,
    roundPixels: usarPerfilMovel,
    powerPreference: "high-performance",
    batchSize: 4096,
    skipUnreadyShaders: usarPerfilMovel,
  },
  scene: [CenaPreload, CenaTitulo, CenaDeckBuilder, CenaTransicao, CenaJogo],
};

const game = new Phaser.Game(config);
