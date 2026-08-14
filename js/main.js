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
  // Tira cartas com poder 0 do campo (deixa o slot null de novo).
  removerMortas() {
    for (let i = 0; i < this.cartas.length; i++) {
      if (this.cartas[i] && this.cartas[i].poder <= 0) this.cartas[i] = null;
    }
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
    if (!carta) continue;
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
    this.campo = new Campo();
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
        somAtaque: base.somAtaque,
      });
      this.deck.adicionarCarta(carta);
    }

    // Monstros especiais: cópias fixas (não aleatórias) do pool de
    // POOL_CARTAS_MONSTRO. Hoje isso é só 2x CryptoAcionistas.
    const copiasMonstroEspecial = [
      POOL_CARTAS_MONSTRO[0],
      POOL_CARTAS_MONSTRO[1],
    ];
    const quantidadeMonstrosEspeciais = copiasMonstroEspecial.length;
    copiasMonstroEspecial.forEach((base, i) => {
      const carta = new Carta(2000 + i, base.poder, "monstro", {
        nome: base.nome,
        descricao: base.descricao,
        efeitoTurno: base.efeitoTurno,
        imagem: base.imagem,
        foco: base.foco,
        efeito: base.efeito,
        habilidadeAtiva: base.habilidadeAtiva,
        somAtaque: base.somAtaque,
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
    const afetadas = sucesso
      ? this.aplicarEfeitoInvocacao(
          carta,
          this.jogador,
          this.inimigo,
          posicao,
          alvoEscolhido,
        )
      : [];
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return { sucesso, afetadas };
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
  // dois tipos de efeito ativo hoje:
  //   ATACAR                -> dano em alvo(s) do campo INIMIGO
  //   BUFF_ALIADO_ESCOLHIDO -> +poder em uma carta ALIADA escolhida
  // (Agente da DIPSP/Juggernaut usam o primeiro; Estagiário de ML usa o
  // segundo — ver POOL_CARTAS_MONSTRO em cartas.js.)
  ativarHabilidade(carta, dono, oponente, alvoEscolhido = null) {
    if (!carta.efeito || !carta.habilidadeAtiva || carta.usadaEsteTurno)
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
      });
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
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
        dono.campo.cartas[alvoEscolhido];
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
      return { sucesso: true, afetadas };
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

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) {
      const indices = [];
      dono.campo.cartas.forEach((c, i) => {
        if (c && i !== posicao) indices.push(i);
      });
      return indices;
    }

    return [];
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
        // cai no padrão de buffar a própria carta recém-invocada.
        // (Cartas com habilidadeAtiva=true, como o Estagiário de ML, nunca
        // chegam aqui — ver o early return de habilidadeAtiva acima.)
        const idxAlvo =
          alvoEscolhido !== null &&
          alvoEscolhido !== undefined &&
          dono.campo.cartas[alvoEscolhido]
            ? alvoEscolhido
            : posicao;
        const alvo = dono.campo.cartas[idxAlvo];
        if (alvo) {
          alvo.buff(valor);
          afetadas.push({ carta: alvo, delta: valor });
        }
        break;
      }
    }

    return afetadas;
  }

  // Fecha o turno atual. A cada turno fechado, uma rodada é resolvida
  // (resolverRodada): quem tiver mais poder total em campo fatura o
  // ponto daquela rodada. A partida termina — e fimTurno() para de fazer
  // qualquer coisa depois disso (this.partidaEncerrada = true) — assim
  // que um dos lados chegar a 4 rodadas vencidas (melhor de 7) ou o turno
  // máximo (7) for atingido, o que vier primeiro.
  fimTurno() {
    if (this.partidaEncerrada) {
      return { resultadoCombate: null, fimDeJogo: true, resultadoRodada: null };
    }

    // Libera de novo as habilidades ativas (1x por turno) dos dois lados.
    [...this.jogador.campo.cartas, ...this.inimigo.campo.cartas].forEach(
      (c) => {
        if (c) c.usadaEsteTurno = false;
      },
    );

    this.turnoIA();
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

    this.jogador.campo.removerMortas();
    this.inimigo.campo.removerMortas();
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

    // IA também ativa habilidades de ataque disponíveis em campo (1x cada).
    this.inimigo.campo.cartas.forEach((c) => {
      if (c && c.habilidadeAtiva && !c.usadaEsteTurno) {
        this.ativarHabilidade(c, this.inimigo, this.jogador);
      }
    });
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

  // Encerra a partida na hora, como derrota do jogador — usado pelo botão
  // "Desistir" da roda de botões (jogo.js). Diferente de resolverCombate(),
  // o resultado aqui não depende do poder em campo: quem desiste perde,
  // ponto final. Ainda assim reaproveita calcularPoderTotal/
  // obterCartaComMaiorPoder pra preencher a mesma tela de fim de jogo.
  desistir() {
    if (this.partidaEncerrada) return null;
    this.partidaEncerrada = true;
    this.inimigo.vitorias++;

    const poderJogador = this.calcularPoderTotal(this.jogador.campo);
    const poderInimigo = this.calcularPoderTotal(this.inimigo.campo);
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
    const poderJogador = this.calcularPoderTotal(this.jogador.campo);
    const poderInimigo = this.calcularPoderTotal(this.inimigo.campo);

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
    const poderJogador = this.calcularPoderTotal(this.jogador.campo);
    const poderInimigo = this.calcularPoderTotal(this.inimigo.campo);

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
  scene: [CenaPreload, CenaTitulo, CenaJogo],
};

const game = new Phaser.Game(config);
