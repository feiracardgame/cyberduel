console.log("Cyberduel iniciou!");

// Os dados das cartas são carregados antes deste arquivo.

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
    // Campo 2×5: índices 0–4 atrás e 5–9 na frente.
    this.cartas = new Array(10).fill(null);
    this.limite = 10;
    this.armadilhas = new Set();
  }
  adicionarCarta(carta, posicao) {
    if (this.cartas[posicao] === null) {
      this.cartas[posicao] = carta;
      delete carta.marcoPerdasOponente;
      carta.marcoPerdas = (this.dono?.cartasPerdidas || 0) + (this.dono?.efeitosUtilizados || 0);
      if (carta.tipo === "monstro" && this.dono?.penalidadesInvocacao?.length) {
        carta.penalidadesRecebidas = this.dono.penalidadesInvocacao.map((penalidade) => ({ ...penalidade, indice: posicao, delta: carta.buff(-penalidade.valor) }));
        this.dono.penalidadesInvocacao = [];
      }
      if (carta.tipo !== "terreno" && this.armadilhas.has(posicao)) {
        this.armadilhas.delete(posicao);
        carta.buff(-2);
      }
    }
  }
  temEspaco(posicao) {
    return this.cartas[posicao] === null;
  }
  // Tira cartas com poder 0 do campo (deixa o slot null de novo). Terrenos ficam de fora: eles sempre têm 0 PA e não "morrem" por isso.
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

// Profundidade da linha dentro do campo do dono (1 = fileira da frente, mais perto do inimigo; 2 = fileira de trás, mais longe).
function profundidadeLinha(posicao) {
  return posicao < 5 ? 2 : 1;
}

// Retorna os índices inimigos dentro do alcance horizontal e vertical.
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
    this.efeitosUtilizados = 0;
    this.penalidadesInvocacao = [];
    this.vitorias = 0;

    // Registra as compras para animar apenas as cartas novas.
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

  // Cartas de efeito nunca ocupam o campo: são consumidas na hora, aplicam sua passiva e vão descartadas.
  jogarCartaEfeito(carta) {
    const indice = this.mao.cartas.indexOf(carta);
    if (indice !== -1) {
      this.mao.cartas.splice(indice, 1);
      this.registrarDescarte(carta, false);
      this.efeitosUtilizados = (this.efeitosUtilizados || 0) + 1;
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
      // Marca a carta para a animação de compra.
      this.cartasRecemCompradas.push(compra);
    }
  }
}

class Partida {
  constructor(deckDebug = null) {
    this.jogador = new Jogador();
    this.inimigo = new Jogador();

    const deckBuilder = window.cyberduelDeckBuilder;
    const multiplayer = window.cyberduelMultiplayer;
    const deckLocal = deckDebug || deckBuilder?.getDeckForMatch() || null;
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
    // A partida termina ao atingir quatro rodadas vencidas ou o limite de turnos.
    this.maxTurnos = 7;
    this.rodadasParaVencer = 4;
    this.rodadasJogador = 0;
    this.rodadasInimigo = 0;
    this.partidaEncerrada = false;
    this.cartaSelecionada = null;

    // Cartas afetadas por efeitos de turno (ex: CryptoAcionistas) no último fimTurno() resolvido, para a cena poder animar o buff.
    this.efeitosDeTurno = [];

    // Guarda o efeito da IA e os alvos para animá-los na cena.
    this.efeitoInimigoTurno = null;
    this.jogadasCampoInimigoTurno = [];

    // Histórico de todas as cartas jogadas na partida, na ordem em que foram jogadas. Cada entrada: { turno, quem: 'jogador'|'inimigo', carta }.
    this.historico = [];
  }

  // Eventos de apresentação são dados da partida, não inferências da interface.
  capturarCampoEfeitos() {
    return ["jogador", "inimigo"].flatMap((lado) => this[lado].campo.cartas.flatMap((c, indice) => c ? [{
      lado, indice, id: c.id, nome: c.nome, imagem: c.imagem, poder: c.poder,
      oculto: !!c.ocultadaPelaToca && !c.revelada,
      estado: JSON.stringify([c.usadaEsteTurno, c.protegidaPA, c.bonusBloqueado, c.envenenada,
        c.alvosAdvertidos, c.aliadoVinculadoId, c.efeitoDesabilitado, c.efeito, c.capturadaPorAranha?.id]),
    }] : []));
  }

  registrarEventoEfeito(carta, dono, momento, antes = [], extra = {}) {
    if (!carta) return;
    const lado = dono === this.inimigo ? "inimigo" : "jogador";
    const depois = this.capturarCampoEfeitos();
    const fonteReal = dono.campo.cartas.find((c) => c?.id === carta.id && c.nome === carta.nome) || carta;
    const alvos = antes.flatMap((anterior) => {
      const atual = depois.find((c) => c.lado === anterior.lado && c.id === anterior.id);
      if (atual && atual.poder === anterior.poder && atual.estado === anterior.estado && atual.indice === anterior.indice) return [];
      return [{ lado: anterior.lado, indice: atual?.indice ?? anterior.indice, id: anterior.id,
        nome: anterior.nome, imagem: anterior.imagem, oculto: anterior.oculto && (atual?.oculto ?? true),
        delta: (atual?.poder ?? 0) - anterior.poder, removida: !atual,
        mudouEstado: !atual || atual.estado !== anterior.estado }];
    });
    this.sequenciaEfeito = (this.sequenciaEfeito || 0) + 1;
    this.eventosEfeito ||= [];
    this.eventosEfeito.push({ id: this.sequenciaEfeito, turno: this.turno || 1, lado, momento,
      fonte: { id: carta.id, nome: carta.nome, imagem: carta.imagem, tipo: carta.tipo,
        efeito: carta.efeito ? JSON.parse(JSON.stringify(carta.efeito)) : null,
        efeitoTurno: carta.efeitoTurno, efeitoContinuo: carta.efeitoContinuo,
        habilidadeAprendidaDe: carta.habilidadeAprendidaDe,
        oculto: !!fonteReal.ocultadaPelaToca && !fonteReal.revelada,
        indice: dono.campo.cartas.includes(fonteReal) ? dono.campo.cartas.indexOf(fonteReal) : (antes.find((c) => c.lado === lado && c.id === carta.id)?.indice ?? -1) }, alvos, ...extra });
  }

  // Registra uma jogada no histórico. "quem" é 'jogador' ou 'inimigo'.
  registrarHistorico(carta, quem) {
    this.historico.push({ turno: this.turno, quem, carta });
    for (const penalidade of carta.penalidadesRecebidas || []) {
      this.registrarEventoEfeito(penalidade.fonte, this[quem === "jogador" ? "inimigo" : "jogador"], "passiva", [], {
        mensagem: "Faro — penalidade na próxima invocação",
        alvos: [{ lado: quem, indice: penalidade.indice, id: carta.id, nome: carta.nome, delta: penalidade.delta }],
      });
    }
    delete carta.penalidadesRecebidas;
    if (carta.tipo !== "efeito") this.registrarEventoEfeito(carta, this[quem], "invocacao");
  }

  // Invoca sem aplicar o efeito até o jogador escolher o alvo.
  colocarCartaDoJogador(carta, posicao) {
    if (this.fase && this.fase !== "colocar") return false;
    const sucesso = this.jogador.jogarCarta(carta, posicao);
    if (sucesso) this.registrarHistorico(carta, "jogador");
    return sucesso;
  }

  // Invoca monstros e aplica seus efeitos após validar a jogada.
  jogarCartaDoJogador(carta, posicao, alvoEscolhido = null) {
    if (this.fase && this.fase !== "colocar") return { sucesso: false, afetadas: [] };
    const sucesso = this.jogador.jogarCarta(carta, posicao);
    let afetadas = [];
    if (sucesso && carta.tipo === "terreno") {
      // Terreno não tem efeito de invocação — só ativa o efeito contínuo, que fica sendo recalculado do zero (ver resolverEfeitosContinuos).
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

  // Remove o bônus anterior e reaplica os terrenos atuais.
  atualizarSupressoes() {
    const campos = [this.jogador, this.inimigo];
    const cartas = campos.flatMap((d) => d.campo.cartas.filter(Boolean));
    const antes = this.capturarCampoEfeitos();
    const anteriores = new Map(cartas.map((c) => [c, c.fonteSupressao]));
    for (const carta of cartas) {
      if (carta.efeitosSuspensos) Object.assign(carta, carta.efeitosSuspensos);
      carta.efeitosSuspensos = null;
      carta.efeitoDesabilitado = false;
      carta.silenciadaPorNome = null;
      carta.fonteSupressao = null;
    }
    const silenciar = (alvo, fonte) => {
      if (!alvo || alvo.efeitoDesabilitado) return;
      alvo.efeitosSuspensos = { efeito: alvo.efeito, efeitoTurno: alvo.efeitoTurno,
        efeitoContinuo: alvo.efeitoContinuo, habilidadeAtiva: alvo.habilidadeAtiva };
      alvo.efeito = null; alvo.efeitoTurno = null; alvo.efeitoContinuo = null; alvo.habilidadeAtiva = false;
      alvo.efeitoDesabilitado = true; alvo.silenciadaPorNome = fonte.nome;
      alvo.fonteSupressao = { id: fonte.id, nome: fonte.nome, imagem: fonte.imagem, tipo: fonte.tipo, efeito: fonte.efeito,
        ocultadaPelaToca: fonte.ocultadaPelaToca, revelada: fonte.revelada };
    };
    const fontes = cartas.filter((c) => c.efeito?.tipo === TIPOS_EFEITO.SILENCIAR_CARTA)
      .sort((a, b) => (b.ordemControle || 0) - (a.ordemControle || 0));
    for (const fonte of fontes) {
      if (fonte.efeitoDesabilitado || fonte.alvoSilenciadoId == null) continue;
      const adversario = this.jogador.campo.cartas.includes(fonte) ? this.inimigo : this.jogador;
      silenciar(adversario.campo.cartas.find((c) => c?.id === fonte.alvoSilenciadoId), fonte);
    }
    for (const dono of campos) {
      const humba = dono.campo.cartas.find((c) => c?.efeito?.tipo === TIPOS_EFEITO.HUMATRIX);
      if (humba) (dono === this.jogador ? this.inimigo : this.jogador).campo.cartas.forEach((c) => {
        if (c?.tipo === "terreno") silenciar(c, humba);
      });
    }
    const alteracoes = new Map();
    for (const dono of campos) for (const carta of dono.campo.cartas.filter(Boolean)) {
      const anterior = anteriores.get(carta), atual = carta.fonteSupressao;
      if (anterior?.id === atual?.id && anterior?.nome === atual?.nome) continue;
      const fonte = atual || anterior;
      const ladoAlvo = dono === this.jogador ? "jogador" : "inimigo";
      const chave = `${ladoAlvo}:${fonte.id}:${!!atual}`;
      const alteracao = alteracoes.get(chave) || { fonte, dono: dono === this.jogador ? this.inimigo : this.jogador, antes: [], ativa: !!atual };
      alteracao.antes.push(...antes.filter((c) => c.lado === ladoAlvo && c.id === carta.id));
      alteracoes.set(chave, alteracao);
    }
    for (const { fonte, dono, antes: alvosAntes, ativa } of alteracoes.values())
      this.registrarEventoEfeito(fonte, dono, "continuo", alvosAntes, {
        mensagem: ativa ? "Efeitos desabilitados" : "Efeitos restaurados",
      });
  }

  resolverEfeitosContinuos(dono) {
    this.atualizarSupressoes();
    const antes = this.capturarCampoEfeitos();
    const anteriores = dono.contribuicoesEfeito || {};
    this.recalcularEfeitosContinuos(dono);
    const atuais = dono.contribuicoesEfeito || {};
    for (const chave of new Set([...Object.keys(anteriores), ...Object.keys(atuais)])) {
      const anterior = anteriores[chave], atual = atuais[chave];
      if (JSON.stringify(anterior) === JSON.stringify(atual)) continue;
      const contribuicao = atual || anterior;
      const ids = new Set([...Object.keys(anterior?.alvos || {}), ...Object.keys(atual?.alvos || {})]);
      this.registrarEventoEfeito(contribuicao.fonte, this[contribuicao.lado], "continuo",
        antes.filter((c) => ids.has(`${c.lado}:${c.id}`)),
        { mensagem: atual ? "Efeito contínuo atualizado" : "Efeito contínuo encerrado" });
    }
  }

  recalcularEfeitosContinuos(dono) {
    dono.contribuicoesEfeito = {};
    const contribuir = (fonte, alvo, valor, ladoFonte = dono) => {
      const lado = ladoFonte === this.jogador ? "jogador" : "inimigo";
      const chave = `${lado}:${fonte.id}`;
      const entry = dono.contribuicoesEfeito[chave] ||= {
        lado, fonte: { id: fonte.id, nome: fonte.nome, imagem: fonte.imagem, tipo: fonte.tipo,
          efeito: fonte.efeito, efeitoContinuo: fonte.efeitoContinuo }, alvos: {},
      };
      entry.alvos[`${dono === this.jogador ? "jogador" : "inimigo"}:${alvo.id}`] = valor;
    };
    const bonusAnteriores = new Map(dono.campo.cartas.filter(Boolean).map((c) => [c, (c.bonusTerreno || 0) + (c.bonusDiehGo || 0) + (c.bonusEfeitoContinuo || 0)]));
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
            contribuir(terreno, c, valor);
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
      if (tocaAtiva) {
        const toca = dono.campo.cartas.find((t) => t?.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.OCULTAR_ALIADOS);
        contribuir(toca, c, "ocultacao");
      }
      if (tocaAtiva && !c.ocultadaPelaToca) {
        c.ocultadaPelaToca = true;
        c.revelada = false;
      } else if (!tocaAtiva) {
        c.ocultadaPelaToca = false;
        c.revelada = true;
      }
    });

    dono.campo.cartas.forEach((carta, indice) => {
      if (!carta || carta.tipo === "terreno") return;
      let bonus = 0;
      if (!carta.efeitoDesabilitado && carta.aliadoVinculadoId != null) {
        if (!dono.campo.cartas.some((c) => c && c !== carta && c.id === carta.aliadoVinculadoId)) {
          dono.campo.removerCarta(indice);
          return;
        }
        bonus += 6;
      }
      if (carta.efeito?.tipo === TIPOS_EFEITO.BONUS_POR_PERDIDAS) {
        const total = (dono.cartasPerdidas || 0) + (dono.efeitosUtilizados || 0);
        carta.marcoPerdas ??= total;
        const totalOponente = (oponente.cartasPerdidas || 0) + (oponente.efeitosUtilizados || 0);
        carta.marcoPerdasOponente ??= totalOponente;
        bonus += Math.max(0, total + totalOponente - carta.marcoPerdas - carta.marcoPerdasOponente) * (carta.efeito.valor || 1);
      }
      if (carta.efeito?.tipo === TIPOS_EFEITO.BONUS_TRIO_ADJACENTE) {
        const vizinhos = [indice - 1, indice + 1].filter(
          (i) => i >= 0 && i < dono.campo.cartas.length && Math.floor(i / 5) === Math.floor(indice / 5),
        );
        const nomes = new Set(vizinhos.map((i) => dono.campo.cartas[i]?.nome));
        if (carta.efeito.nomes.every((nome) => nomes.has(nome)))
          bonus += carta.efeito.valor || 0;
      }
      if (carta.efeito?.tipo === TIPOS_EFEITO.BONUS_POR_TERRENOS)
        bonus += [...dono.campo.cartas, ...oponente.campo.cartas].filter((c) => c?.tipo === "terreno").length * carta.efeito.valor;
      carta.poder += bonus;
      carta.bonusEfeitoContinuo = bonus;
      if (bonus) contribuir(carta, carta, bonus);
    });

    dono.campo.cartas.forEach((fonte, indice) => {
      if (!fonte?.efeito) return;
      let vizinhos = [], valor = 0;
      if (fonte.efeito.tipo === TIPOS_EFEITO.BUFF_ADJACENTES) {
        vizinhos = dono.campo.cartas.map((c, i) => i).filter((i) => Math.abs(i % 5 - indice % 5) + Math.abs(Math.floor(i / 5) - Math.floor(indice / 5)) === 1);
        valor = fonte.efeito.valor;
      } else if (fonte.efeito.tipo === TIPOS_EFEITO.BONUS_TRIO_ADJACENTE &&
        indice % 5 > 0 && indice % 5 < 4 &&
        fonte.efeito.nomes.every((nome) => [dono.campo.cartas[indice - 1]?.nome, dono.campo.cartas[indice + 1]?.nome].includes(nome))) {
        vizinhos = [indice - 1, indice + 1]; valor = fonte.efeito.bonusVizinhos || 0;
      }
      for (const i of vizinhos) {
        const alvo = dono.campo.cartas[i];
        if (!alvo || alvo.tipo === "terreno") continue;
        alvo.poder += valor; alvo.bonusEfeitoContinuo = (alvo.bonusEfeitoContinuo || 0) + valor;
        contribuir(fonte, alvo, valor);
      }
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
        const fonte = oponente.campo.cartas.find((t) => t?.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.DEBUFF_CAMPO_INIMIGO && t.efeitoContinuo.valor === valor);
        contribuir(fonte, c, -valor, oponente);
      });
    }
    dono.campo.cartas.forEach((c) => {
      if (!c) return;
      const antes = bonusAnteriores.get(c) || 0;
      const atual = (c.bonusTerreno || 0) + (c.bonusDiehGo || 0) + (c.bonusEfeitoContinuo || 0);
      const permitido = c.protegidaPA && atual < antes ? antes : c.bonusBloqueado && atual > antes ? antes : atual;
      c.poder += permitido - atual;
      c.bonusEfeitoContinuo += permitido - atual;
      if (c.efeito?.tipo === TIPOS_EFEITO.CASCA_GROSSA && c.poder < 6) {
        c.bonusEfeitoContinuo += 6 - c.poder; c.poder = 6;
      }
    });
    dono.campo.removerMortas();
  }

  // true se o "dono" tiver algum terreno com REVELAR_MAO_CONTINUO em campo — a cena usa isso para decidir se mostra a mão do oponente virada.
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

  // Retorna alvos no alcance de ataque para a seleção visual.
  previsualizarAlvosAtaque(carta, posicao) {
    if (!carta.efeito || carta.efeito.tipo !== TIPOS_EFEITO.ATACAR) return [];
    return alvosEmRange(
      posicao,
      carta.efeito.rangeH,
      carta.efeito.rangeV,
      this.inimigo.campo,
    );
  }

  // Ativa a habilidade uma vez por turno, após validar os alvos.
  ativarHabilidade(carta, dono, oponente, alvo = null, secundario = null) {
    this.atualizarSupressoes();
    const antesEfeito = this.capturarCampoEfeitos();
    const efeitoOriginal = carta.efeito ? JSON.parse(JSON.stringify(carta.efeito)) : null;
    const resultado = this.resolverHabilidade(carta, dono, oponente, alvo, secundario);
    if (resultado.sucesso) {
      carta.ativacoes = (carta.ativacoes || 0) + 1;
      carta.ultimoAlvoHabilidade = alvo;
      this.registrarEventoEfeito(carta, dono, "habilidade", antesEfeito);
      // Aprender muda o efeito da instância; a apresentação descreve a ação que acabou de ocorrer.
      const evento = this.eventosEfeito.at(-1);
      evento.fonte.efeito = efeitoOriginal;
      if (efeitoOriginal?.acao === "aprender") evento.fonte.habilidadeAprendidaDe = null;
      for (const afetada of resultado.afetadas) {
        const ladoAlvo = this.jogador.campo.cartas.includes(afetada.carta) || this.jogador.descarte.includes(afetada.carta) ? "jogador" : "inimigo";
        const posicao = antesEfeito.find((c) => c.lado === ladoAlvo && c.id === afetada.carta.id && c.nome === afetada.carta.nome);
        if (posicao && !evento.alvos.some((c) => c.id === posicao.id && c.lado === posicao.lado))
          evento.alvos.push({ lado: posicao.lado, indice: posicao.indice, id: posicao.id, nome: posicao.nome, oculto: posicao.oculto, delta: afetada.delta, bloqueado: afetada.delta === 0 });
      }
      const aliados = [TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO, TIPOS_EFEITO.REDISTRIBUIR_PODER,
        TIPOS_EFEITO.REPOSICIONAR, TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS];
      const indices = Array.isArray(alvo) ? alvo : [alvo,
        [TIPOS_EFEITO.ATACAR_DOIS_ALVOS, TIPOS_EFEITO.REDISTRIBUIR_PODER].includes(efeitoOriginal.tipo) || efeitoOriginal.acao === "opiniao" ? secundario : null];
      for (const indice of indices) {
        if (!Number.isInteger(indice)) continue;
        const misto = efeitoOriginal.tipo === TIPOS_EFEITO.RESETAR_PODER || efeitoOriginal.alvo === "qualquer";
        const aliado = misto ? indice < 10 : aliados.includes(efeitoOriginal.tipo) || efeitoOriginal.alvo === "aliado";
        const ladoAlvo = (aliado ? dono : oponente) === this.jogador ? "jogador" : "inimigo";
        const pos = antesEfeito.find((c) => c.lado === ladoAlvo && c.indice === (misto ? indice % 10 : indice));
        if (pos && !evento.alvos.some((c) => c.id === pos.id && c.lado === pos.lado))
          evento.alvos.push({ lado: pos.lado, indice: pos.indice, id: pos.id, nome: pos.nome, oculto: pos.oculto, delta: 0, mudouEstado: true });
      }
      const agentes = oponente.campo.cartas.filter((c) =>
        c?.efeito?.acao === "advertir" && (c.alvosAdvertidos || []).includes(carta.id));
      const antes = carta.poder;
      for (const agente of agentes) {
        const antesAdvertencia = this.capturarCampoEfeitos();
        carta.buff(-3);
        this.registrarEventoEfeito(agente, oponente, "advertencia", antesAdvertencia);
      }
      if (carta.poder !== antes) resultado.afetadas.push({ carta, delta: carta.poder - antes });
      dono.campo.removerMortas();
      oponente.campo.removerMortas();
      this.resolverEfeitosContinuos(dono);
      this.resolverEfeitosContinuos(oponente);
    }
    return resultado;
  }

  alvosParaVinculoAliado(carta, dono) {
    return dono.campo.cartas.flatMap((alvo, indice) =>
      alvo && alvo !== carta && alvo.id !== carta.id && alvo.tipo !== "terreno" ? [indice] : []);
  }

  alvosSindicato(carta, dono, oponente) {
    const { acao, alvo } = carta.efeito;
    const campo = alvo === "inimigo" ? oponente.campo.cartas :
      alvo === "qualquer" ? [...dono.campo.cartas, ...oponente.campo.cartas] : dono.campo.cartas;
    return campo.flatMap((c, i) => {
      if (!c || c.tipo === "terreno") return [];
      if (acao === "aprender" && (c === carta || !c.habilidadeAtiva || c.efeito?.acao === "aprender")) return [];
      if (acao === "curar" && c.poder >= c.poderBase + (c.bonusTerreno || 0) + (c.bonusEfeitoContinuo || 0) + (c.bonusDiehGo || 0)) return [];
      if (acao === "reativar" && (c === carta || !c.habilidadeAtiva || !c.usadaEsteTurno)) return [];
      if (acao === "mover" && !dono.campo.cartas.includes(null)) return [];
      return [i];
    });
  }

  resolverHabilidadeSindicato(carta, dono, oponente, escolhido, secundario) {
    const falha = { sucesso: false, afetadas: [] };
    const { acao } = carta.efeito;
    const validos = this.alvosSindicato(carta, dono, oponente);
    const indices = acao === "opiniao" ? [escolhido, secundario] : [escolhido];
    if (indices.some((i) => !Number.isInteger(i) || !validos.includes(i)) || new Set(indices).size !== indices.length) return falha;
    if (acao === "mover" && (!Number.isInteger(secundario) || dono.campo.cartas[secundario] !== null)) return falha;
    if (acao === "aprender" && (carta.aprendizadoUsado || carta.poder < 2 || carta.protegidaPA)) return falha;
    const tam = dono.campo.cartas.length;
    const campo = carta.efeito.alvo === "inimigo" ? oponente.campo.cartas :
      carta.efeito.alvo === "qualquer" ? [...dono.campo.cartas, ...oponente.campo.cartas] : dono.campo.cartas;
    const alvo = campo[escolhido];
    const afetadas = [];
    const mudar = (c, valor) => { const antes = c.poder; c.buff(valor); afetadas.push({ carta: c, delta: c.poder - antes }); };
    switch (acao) {
      case "proteger": alvo.protegidaPA = true; break;
      case "bloquear_bonus":
        alvo.bonusBloqueado = true;
        alvo.bonusBloqueadoAteRodada = (this.turno || 1) + 1;
        break;
      case "advertir": carta.alvosAdvertidos = [...new Set([...(carta.alvosAdvertidos || []), alvo.id])]; break;
      case "mover": dono.campo.cartas[escolhido] = null; dono.campo.cartas[secundario] = alvo; break;
      case "curar": mudar(alvo, Math.max(0, alvo.poderBase + (alvo.bonusTerreno || 0) + (alvo.bonusEfeitoContinuo || 0) + (alvo.bonusDiehGo || 0) - alvo.poder)); break;
      case "opiniao": indices.forEach((i) => mudar(campo[i], i < tam ? 2 : -2)); break;
      case "reativar": alvo.usadaEsteTurno = false; break;
      case "aprender":
        mudar(carta, -2);
        carta.aprendizadoUsado = true;
        carta.habilidadeAprendidaDe = alvo.habilidadeAprendidaDe || alvo.nome;
        carta.efeito = JSON.parse(JSON.stringify(alvo.efeito));
        carta.somAtaque = alvo.somAtaque;
        break;
      default: return falha;
    }
    carta.usadaEsteTurno = true;
    carta.revelada = true;
    return { sucesso: true, afetadas };
  }

  resolverHabilidade(
    carta,
    dono,
    oponente,
    alvoEscolhido = null,
    alvoSecundario = null,
  ) {
    if (this.fase && this.fase !== "habilidades") return { sucesso: false, afetadas: [] };
    this.atualizarSupressoes();
    this.atualizarOverrides();
    const jaFoiUsada = carta.usadaEsteTurno;
    if (!carta.efeito || !carta.habilidadeAtiva || jaFoiUsada)
      return { sucesso: false, afetadas: [] };

    const posicao = dono.campo.cartas.indexOf(carta);
    if (posicao === -1) return { sucesso: false, afetadas: [] };

    if (carta.efeito.tipo === TIPOS_EFEITO.SILENCIAR_CARTA) {
      const alvo = oponente.campo.cartas[alvoEscolhido];
      if (!Number.isInteger(alvoEscolhido) || !alvo) return { sucesso: false, afetadas: [] };
      carta.alvoSilenciadoId = alvo.id;
      carta.ordemControle = 1 + Math.max(0, ...[...dono.campo.cartas, ...oponente.campo.cartas].filter(Boolean).map((c) => c.ordemControle || 0));
      carta.usadaEsteTurno = true; carta.revelada = true;
      this.atualizarSupressoes();
      return { sucesso: true, afetadas: [] };
    }
    if (carta.efeito.tipo === TIPOS_EFEITO.RENOVAR_MAO) {
      const quantidade = dono.mao.cartas.length;
      if (!quantidade) return { sucesso: false, afetadas: [] };
      dono.mao.cartas.splice(0).forEach((c) => dono.registrarDescarte(c, false));
      for (let i = 0; i < quantidade; i++) dono.comprarCarta();
      carta.usadaEsteTurno = true; carta.revelada = true;
      return { sucesso: true, afetadas: [] };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.SINDICATO) {
      return this.resolverHabilidadeSindicato(carta, dono, oponente, alvoEscolhido, alvoSecundario);
    }

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
        afetadas.push({ carta: c, delta: c.buff(-valor) });
        if (c.poder <= 0 && carta.efeito.bonusAoEliminar) {
          afetadas.push({ carta, delta: carta.buff(carta.efeito.bonusAoEliminar) });
        }
      });
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;


      return { sucesso: indices.length > 0, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) {
      // Machine Learning: alvo tem que ser outra carta aliada em campo (não pode escolher a si mesma).
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        (carta.efeito.permiteProprio || alvoEscolhido !== posicao) &&
        dono.campo.cartas[alvoEscolhido] &&
        dono.campo.cartas[alvoEscolhido].tipo !== "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      const { valor, custoProprio } = carta.efeito;
      const afetadas = [];
      const alvo = dono.campo.cartas[alvoEscolhido];
      afetadas.push({ carta: alvo, delta: alvo.buff(valor) });

      if (custoProprio) {
        afetadas.push({ carta, delta: carta.buff(-custoProprio) });
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
        afetadas.push({ carta: alvo, delta: alvo.buff(-dano) });
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
        (i) => Number.isInteger(i) && dono.campo.cartas[i] && dono.campo.cartas[i].tipo !== "terreno",
      );
      if (!validos.length || validos.length > carta.efeito.maxAlvos)
        return { sucesso: false, afetadas: [] };
      const afetadas = validos.map((i) => {
        const alvo = dono.campo.cartas[i];
        return { carta: alvo, delta: alvo.buff(carta.efeito.valor) };
      });
      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER) {
      // O Gestor transfere poder entre duas aliadas distintas, podendo ser uma delas.
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
      if (cartaPerda.poder < perda)
        return { sucesso: false, afetadas: [] };
      afetadas.push({ carta: cartaPerda, delta: cartaPerda.buff(-perda) });

      const cartaGanho = dono.campo.cartas[alvoSecundario];
      afetadas.push({ carta: cartaGanho, delta: cartaGanho.buff(ganho) });

      dono.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO) {
      // Cessar e Desistir: alvo tem que ser um terreno no campo do oponente. Sem alvo válido, a habilidade não é gasta.
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

      // Recalcula os bônus após remover o terreno inimigo.
      this.resolverEfeitosContinuos(oponente);

      carta.usadaEsteTurno = true; // também trava o botão neste turno, por consistência visual
      carta.revelada = true;
      return { sucesso: true, afetadas: [], terrenoDestruido };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER) {
      // O Boi usa índices 0..TAM-1 para aliados e TAM..2*TAM-1 para inimigos.
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
      const diferenca = alvo.poderBase - alvo.poder;
      const impedido = (diferenca > 0 && alvo.bonusBloqueado) ||
        (diferenca < 0 && alvo.protegidaPA);
      if (!impedido) {
        alvo.buff(diferenca);
        // O reset remove todos os modificadores antes de reavaliar as auras.
        alvo.bonusTerreno = 0;
        alvo.bonusDiehGo = 0;
        alvo.bonusEfeitoContinuo = 0;
        this.resolverEfeitosContinuos(lado);
      }

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return {
        sucesso: true,
        afetadas: [{ carta: alvo, delta: alvo.poder - poderAntes }],
      };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS) {
      // O Tigre ataca um ou dois inimigos distintos dentro do alcance.
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
        afetadas.push({ carta: c, delta: c.buff(-valor) });
      });
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;


      return { sucesso: true, afetadas };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE) {
      // Override mantém a carta no campo inimigo e transfere apenas seus pontos.
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

      // Troca atômica de alvo: o vínculo antigo só é solto depois que o novo alvo foi completamente validado.
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
      // Mãos Leves (O Rato): alvo pode ser QUALQUER carta inimiga em campo (sem restrição de range/coluna, diferente do ATACAR).
      const alvoValido =
        alvoEscolhido !== null &&
        alvoEscolhido !== undefined &&
        oponente.campo.cartas[alvoEscolhido] &&
        oponente.campo.cartas[alvoEscolhido].tipo !== "terreno";
      if (!alvoValido) return { sucesso: false, afetadas: [] };

      const { valor } = carta.efeito;
      const alvo = oponente.campo.cartas[alvoEscolhido];
      const roubado = Math.min(valor, alvo.poder);

      const perdaReal = alvo.buff(-roubado);
      const ganhoReal = carta.buff(-perdaReal);
      oponente.campo.removerMortas();

      carta.usadaEsteTurno = true;
      carta.revelada = true;
      return {
        sucesso: true,
        afetadas: [
          { carta: alvo, delta: perdaReal },
          { carta, delta: ganhoReal },
        ],
      };
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR) {
      // Escalada (A Cabra): troca de lugar com outra carta aliada, ou se move pra um espaço livre — sempre dentro do próprio campo.
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
      // O veneno aplica dano no fim do turno, não na picada.
      const { rangeH, rangeV, valor } = carta.efeito;
      const possiveis = alvosEmRange(posicao, rangeH, rangeV, oponente.campo);
      if (!possiveis.includes(alvoEscolhido))
        return { sucesso: false, afetadas: [] };

      const alvo = oponente.campo.cartas[alvoEscolhido];
      const venenoAnterior = Math.max(
        0,
        Number(alvo.envenenada?.valor) || 0,
      );
      alvo.venenosPorFonte = { ...(alvo.venenosPorFonte || {}), [carta.id]: (alvo.venenosPorFonte?.[carta.id] || 0) + valor };
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

  // Retorna alvos válidos para o seletor da habilidade.
  alvosParaHabilidadeEmCampo(carta, dono, oponente) {
    this.atualizarSupressoes();
    if (!carta.efeito || !carta.habilidadeAtiva) return [];
    const posicao = dono.campo.cartas.indexOf(carta);
    if (posicao === -1) return [];

    if (carta.efeito.tipo === TIPOS_EFEITO.SILENCIAR_CARTA)
      return oponente.campo.cartas.flatMap((c, i) => c ? [i] : []);
    if (carta.efeito.tipo === TIPOS_EFEITO.RENOVAR_MAO) return dono.mao.cartas.length ? [posicao] : [];
    if (carta.efeito.tipo === TIPOS_EFEITO.SINDICATO) return this.alvosSindicato(carta, dono, oponente);

    if (carta.efeito.tipo === TIPOS_EFEITO.ATACAR) {
      return alvosEmRange(
        posicao,
        carta.efeito.rangeH,
        carta.efeito.rangeV,
        oponente.campo,
      );
    }

    // Eu Sou a Lei ignora completamente posição, fileira e alcance: toda carta inimiga que tenha PA é um alvo válido.
    if (carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO) {
      return oponente.campo.cartas
        .map((c, i) => (c && c.tipo !== "terreno" ? i : null))
        .filter((i) => i !== null);
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) {
      const indices = [];
      dono.campo.cartas.forEach((c, i) => {
        if (c && (carta.efeito.permiteProprio || i !== posicao) && c.tipo !== "terreno") indices.push(i);
      });
      return indices;
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS) {
      return dono.campo.cartas
        .map((c, i) => (c && c.tipo !== "terreno" ? i : null))
        .filter((i) => i !== null);
    }

    if (carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER) {
      // O Gestor pode participar da troca; a UI exige alvos distintos.
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
      // O Boi alcança ambos os campos; inimigos usam índices deslocados por TAM.
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
      // O Tigre usa o alcance de ataque e seleciona até dois alvos.
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
      // Override exige inimigo com menos PA e não ocupa um novo slot.
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
      // Escalada (A Cabra): qualquer espaço do PRÓPRIO campo, livre ou ocupado por aliada (não-terreno), exceto a posição atual dela.
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

  // Lista as colunas inimigas com cartas que não sejam terrenos.
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

  // Consome a carta de efeito e aplica a conjuração sem ocupar o campo.
  jogarCartaEfeitoDoJogador(carta, alvoEscolhido = null) {
    if (this.fase && this.fase !== "colocar") return { sucesso: false, afetadas: [] };
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

  // Aplica a invocação e retorna as cartas afetadas para animação.
  aplicarEfeitoInvocacao(carta, dono, oponente, posicao = null, alvoEscolhido = null) {
    this.atualizarSupressoes();
    const antes = this.capturarCampoEfeitos();
    const afetadas = this.resolverEfeitoInvocacao(carta, dono, oponente, posicao, alvoEscolhido);
    if (carta.efeito && !carta.habilidadeAtiva) {
      this.registrarEventoEfeito(carta, dono, carta.tipo === "efeito" ? "conjuracao" : "passiva", antes);
      const evento = this.eventosEfeito.at(-1);
      for (const afetada of afetadas) {
        const lado = this.jogador.campo.cartas.includes(afetada.carta) || this.jogador.descarte.includes(afetada.carta) ? "jogador" : "inimigo";
        const pos = antes.find((c) => c.lado === lado && c.id === afetada.carta.id);
        if (pos && !evento.alvos.some((c) => c.lado === lado && c.id === pos.id))
          evento.alvos.push({ lado, indice: pos.indice, id: pos.id, nome: pos.nome, oculto: pos.oculto, delta: afetada.delta, bloqueado: afetada.delta === 0 });
      }
    }
    return afetadas;
  }

  resolverEfeitoInvocacao(
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
      case TIPOS_EFEITO.PENALIZAR_PROXIMA_INVOCACAO:
        oponente.penalidadesInvocacao ||= [];
        oponente.penalidadesInvocacao.push({ valor, fonte: { id: carta.id, nome: carta.nome, imagem: carta.imagem, tipo: carta.tipo, efeito: carta.efeito } });
        break;
      case TIPOS_EFEITO.VINCULO_ALIADO: {
        const validos = this.alvosParaVinculoAliado(carta, dono);
        const indice = alvoEscolhido;
        if (!validos.includes(indice)) break;
        const alvo = dono.campo.cartas[indice];
        carta.aliadoVinculadoId = alvo.id;
        this.resolverEfeitosContinuos(dono);
        afetadas.push({ carta, delta: carta.bonusEfeitoContinuo || 0 });
        break;
      }
      case TIPOS_EFEITO.BUFF_ALIADOS:
        dono.campo.cartas.forEach((c) => {
          if (c && c !== carta && c.tipo !== "terreno") {
            afetadas.push({ carta: c, delta: c.buff(valor) });
          }
        });
        break;
      case TIPOS_EFEITO.DEBUFF_INIMIGOS:
        oponente.campo.cartas.forEach((c) => {
          if (c && c.tipo !== "terreno") {
            afetadas.push({ carta: c, delta: c.buff(-valor) });
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
        // Venda Casada aceita qualquer aliada, inclusive a carta recém-invocada.
        const idxAlvo =
          alvoEscolhido !== null &&
          alvoEscolhido !== undefined &&
          dono.campo.cartas[alvoEscolhido] &&
          dono.campo.cartas[alvoEscolhido].tipo !== "terreno"
            ? alvoEscolhido
            : posicao;
        const alvo = dono.campo.cartas[idxAlvo];
        if (alvo && alvo.tipo !== "terreno") {
          afetadas.push({ carta: alvo, delta: alvo.buff(valor) });
        }
        break;
      }
      case TIPOS_EFEITO.BUSCAR_CARTA_DECK: {
        // A carta de efeito já saiu da mão. Renova a mão antes da busca.
        const descartadas = dono.mao.cartas.splice(0);
        descartadas.forEach((c) => dono.registrarDescarte(c, false));
        for (let i = 0; i < descartadas.length; i++) dono.comprarCarta();
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
        // RaspClay recebe um array de índices de aliadas elegíveis para absorção.
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
          afetadas.push({ carta, delta: carta.buff(somaPoder) });
        }
        dono.campo.removerMortas();
        break;
      }
      case TIPOS_EFEITO.ATACAR_COLUNA: {
        // O Trotar do Cavalo: alvoEscolhido é a COLUNA (0-4) escolhida pelo jogador (ver alvosParaAtacarColuna abaixo e a seleção em jogo.js).
        const coluna = alvoEscolhido;
        if (coluna !== null && coluna !== undefined) {
          [coluna, coluna + 5].forEach((idx) => {
            const c = oponente.campo.cartas[idx];
            if (c && c.tipo !== "terreno") {
              afetadas.push({ carta: c, delta: c.buff(-valor) });
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
          afetadas.push({ carta: alvo, delta: alvo.buff(ganho) });
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
        // Faro revela mão e depois deck; a UI lê ultimaRevelacaoFaro.
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

  // Lista aliadas de nível permitido para absorção, sem terrenos nem a própria carta.
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

  // Fecha o turno e resolve a rodada; partidas encerradas não avançam.
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

    // No multiplayer, o segundo cliente ocupa o lugar da IA.
    if (!opcoes.semIA) this.turnoIA();
    // Veneno e recuperação fecham a rodada; investimentos são sorteados no início da próxima.
    this.efeitosDeTurno = this.resolverEfeitosDeTurno();

    const resultadoRodada = this.resolverRodada();
    [this.jogador, this.inimigo].forEach((dono) => dono.campo.cartas.forEach((c) => {
      if (c?.bonusBloqueado && this.turno >= (c.bonusBloqueadoAteRodada || this.turno)) {
        c.bonusBloqueado = false;
        delete c.bonusBloqueadoAteRodada;
      }
    }));
    this.resolverEfeitosContinuos(this.jogador);
    this.resolverEfeitosContinuos(this.inimigo);
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
      this.resolverEfeitosInicioRodada();
      this.jogador.deck.embaralhar();
      this.inimigo.deck.embaralhar();
      for (let i = 0; i < 2; i++) {
        this.jogador.comprarCarta();
        this.inimigo.comprarCarta();
      }
    }

    // Retorna o fim da partida e o placar da rodada para a cena.
    return { resultadoCombate, fimDeJogo, resultadoRodada };
  }

  // Resolve os efeitos de turno dos dois campos e retorna as cartas afetadas.
  resolverEfeitosInicioRodada() {
    this.atualizarSupressoes();
    [this.jogador, this.inimigo].forEach((dono) => dono.campo.cartas.forEach((carta) => {
      if (carta?.efeitoTurno?.tipo !== TIPOS_EFEITO_TURNO.CHANCE_GANHAR_PODER) return;
      const antes = this.capturarCampoEfeitos();
      const ganhou = Math.random() < carta.efeitoTurno.chance;
      if (ganhou) carta.buff(carta.efeitoTurno.valor);
      this.registrarEventoEfeito(carta, dono, "inicio_turno", antes, { mensagem: ganhou ? "Investimento rendeu" : "Investimento sem ganho neste turno" });
    }));
  }

  resolverEfeitosDeTurno() {
    this.atualizarSupressoes();
    const afetadas = [];

    // Dose Letal (A Cobra): cartas envenenadas perdem poder a cada turno, sempre respeitando Casca Grossa (buff() já ignora reduções nesse caso).
    [this.jogador, this.inimigo].forEach((dono) => {
      dono.campo.cartas.forEach((c) => {
        if (c && c.envenenada) {
          if (c.venenosPorFonte) {
            const oponente = dono === this.jogador ? this.inimigo : this.jogador;
            const fontes = new Set(oponente.campo.cartas.filter((fonte) => (fonte?.efeito || fonte?.efeitosSuspensos?.efeito)?.tipo === TIPOS_EFEITO.ENVENENAR).map((fonte) => String(fonte.id)));
            c.venenosPorFonte = Object.fromEntries(Object.entries(c.venenosPorFonte).filter(([id]) => fontes.has(id)));
            c.envenenada.valor = Object.entries(c.venenosPorFonte).reduce((total, [id, valor]) => total +
              (oponente.campo.cartas.some((f) => String(f?.id) === id && f.efeito?.tipo === TIPOS_EFEITO.ENVENENAR) ? valor : 0), 0);
            if (!Object.keys(c.venenosPorFonte).length) { c.envenenada = null; return; }
            if (!c.envenenada.valor) return;
          }
          const poderAntes = c.poder;
          const inimigo = dono === this.jogador ? this.inimigo : this.jogador;
          const fontesAtivas = inimigo.campo.cartas.filter((f) => f?.efeito?.tipo === TIPOS_EFEITO.ENVENENAR && c.venenosPorFonte?.[f.id]);
          if (!c.venenosPorFonte) c.buff(-c.envenenada.valor);
          for (const fonte of fontesAtivas) {
            const antesVeneno = this.capturarCampoEfeitos();
            c.buff(-c.venenosPorFonte[fonte.id]);
            this.registrarEventoEfeito(fonte, inimigo, "veneno", antesVeneno);
          }
          const delta = c.poder - poderAntes;
          if (delta !== 0) afetadas.push({ carta: c, delta });
        }
      });
    });

    // A recuperação contínua não ultrapassa o poderBase da carta.
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
          const antesCura = this.capturarCampoEfeitos();
          const delta = c.buff(novoPoder - c.poder);
          this.registrarEventoEfeito(terrenos[0], dono, "cura", antesCura);
          if (delta > 0) afetadas.push({ carta: c, delta });
        }
      });
    });

    // Recalcula bônus e recuperação antes de remover cartas sem PA.
    this.resolverEfeitosContinuos(this.jogador);
    this.resolverEfeitosContinuos(this.inimigo);

    this.jogador.campo.removerMortas();
    this.inimigo.campo.removerMortas();
    return afetadas;
  }

  iniciarTurno(dono) {
    dono.campo.cartas.forEach((c) => { if (c) c.protegidaPA = false; });
    this.resolverEfeitosContinuos(dono);
  }

  turnoIA(fase = null) {
    if (fase !== "habilidades") this.iniciarTurno(this.inimigo);
    this.efeitoInimigoTurno = null;
    this.jogadasCampoInimigoTurno = [];
    const candidatas = fase === "habilidades" ? [] : Phaser.Utils.Array.Shuffle([...this.inimigo.mao.cartas]);
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
          this.inimigo.deck.cartas.length > this.inimigo.mao.cartas.length
            ? Math.floor(Math.random() * (this.inimigo.deck.cartas.length - this.inimigo.mao.cartas.length))
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
          carta.efeito?.tipo === TIPOS_EFEITO.VINCULO_ALIADO
            ? this.alvosParaVinculoAliado(carta, this.inimigo)[0] ?? null
            : null,
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

    // Reavalia uma última vez depois das duas jogadas.
    this.resolverEfeitosContinuos(this.inimigo);
    this.resolverEfeitosContinuos(this.jogador);

    if (fase === "colocar") return;

    // IA também ativa habilidades de ataque disponíveis em campo (1x cada).
    this.inimigo.campo.cartas.forEach((c) => {
      if (c && c.habilidadeAtiva && !c.usadaEsteTurno) {
        // A IA escolhe um terreno explícito para Cessar e Desistir.
        const alvoTerrenoIA =
          [TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO, TIPOS_EFEITO.SILENCIAR_CARTA, TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO].includes(c.efeito?.tipo)
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
        if (c.efeito?.tipo === TIPOS_EFEITO.SINDICATO) {
          const alvos = this.alvosSindicato(c, this.inimigo, this.jogador);
          const segundo = c.efeito.acao === "mover" ? this.inimigo.campo.cartas.indexOf(null) : alvos[1];
          this.ativarHabilidade(c, this.inimigo, this.jogador, alvos[0], segundo);
        } else this.ativarHabilidade(c, this.inimigo, this.jogador, alvoTerrenoIA);
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

  // A identidade da própria instância da Aranha define o vínculo.
  obterCartaHackeadaPor(aranha) {
    for (const dono of [this.jogador, this.inimigo]) {
      const alvo = dono.campo.cartas.find(
        (carta) => carta?.capturadaPorAranha === aranha,
      );
      if (alvo) return alvo;
    }
    return null;
  }

  // Mantém o Override da Dona Aranha como um vínculo contínuo.
  atualizarOverrides() {
    this.atualizarSupressoes();
    [this.jogador, this.inimigo].forEach((donoDoCampoFisico) => {
      donoDoCampoFisico.campo.cartas.forEach((alvo) => {
        if (!alvo?.capturadaPorAranha) return;
        const aranha = alvo.capturadaPorAranha;
        const aranhaEmCampo =
          this.jogador.campo.cartas.includes(aranha) ||
          this.inimigo.campo.cartas.includes(aranha);
        if (aranhaEmCampo && aranha.efeitoDesabilitado) { alvo.capturadaPor = null; return; }
        if (aranhaEmCampo && aranha.poder > alvo.poder) {
          alvo.capturadaPor = this.jogador.campo.cartas.includes(aranha) ? this.jogador : this.inimigo;
          return;
        }

        alvo.capturadaPor = null;
        alvo.capturadaPorAranha = null;
      });
    });
  }

  // Soma ambos os campos respeitando os vínculos de Override.
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

  // Retorna a carta com maior poder (PA) presente num campo, ou null se o campo estiver vazio.
  obterCartaComMaiorPoder(campo) {
    let maior = null;
    for (const carta of campo.cartas) {
      if (carta && (!maior || carta.poder > maior.poder)) {
        maior = carta;
      }
    }
    return maior;
  }

  // Encerra a partida na hora, como derrota do jogador — usado pelo botão "Desistir" da roda de botões (jogo.js).
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

  // Compara os poderes e pontua a rodada; empate não pontua.
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

  finalizarParaTeste(resultado = "jogador") {
    if (!["jogador", "inimigo", "empate"].includes(resultado))
      throw new Error("Resultado de teste inválido.");
    this.rodadasJogador = resultado === "jogador" ? 4 : resultado === "empate" ? 3 : 0;
    this.rodadasInimigo = resultado === "inimigo" ? 4 : resultado === "empate" ? 3 : 0;
    this.partidaEncerrada = true;
    return this.finalizarPartida();
  }

  // Encerra a partida pelo total de rodadas vencidas.
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

    // Carta de maior poder do lado vencedor, para a tela de fim de jogo. Em caso de empate, mostra a maior carta entre os dois campos.
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

    // Retorna o resultado em vez de só logar, para a cena (jogo.js) poder mostrar feedback visual (texto, flash de câmera etc.)
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

// A resolução de saída muda sem alterar o mundo lógico das cenas.
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
// Ajusta a nitidez à tela, limitando o custo a 1,5× a resolução base.
const escalaTela = Math.min(
  (window.innerWidth || GW) / GW,
  (window.innerHeight || GH) / GH,
);
const ESCALA_RENDER = qualidadeSolicitada === "mobile"
  ? 2 / 3
  : Math.min(1.5, Math.max(1, escalaTela * (window.devicePixelRatio || 1)));
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
  const camera = scene.cameras.main;
  camera.setZoom(LARGURA_RENDER / LARGURA_LAYOUT, ALTURA_RENDER / ALTURA_LAYOUT);
  camera.centerOn(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2);
}

// Menus HTML ocupam a mesma proporção do canvas, inclusive antes de abrir.
if (typeof document !== "undefined") {
  document.documentElement?.style.setProperty("--game-width-vh", `${100 * GW / GH}vh`);
  document.documentElement?.style.setProperty("--game-height-vw", `${100 * GH / GW}vw`);
}

window.CYBERDUEL_RENDER_PROFILE = Object.freeze({
  mobile: usarPerfilMovel,
  scale: ESCALA_RENDER,
  width: LARGURA_RENDER,
  height: ALTURA_RENDER,
});

window.cyberduelViewport?.configure(GW, GH);

const config = {
  parent: "game-viewport",
  type: usarCanvasParaDiagnostico ? Phaser.CANVAS : Phaser.AUTO,
  width: LARGURA_RENDER,
  height: ALTURA_RENDER,
  scale: {
    expandParent: false,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  render: {
    antialias: true,
    antialiasGL: false,
    roundPixels: false,
    powerPreference: "high-performance",
    batchSize: 4096,
    skipUnreadyShaders: usarPerfilMovel,
  },
  scene: [CenaPreload, CenaTitulo, CenaDeckBuilder, CenaTransicao, CenaJogo],
};

const game = new Phaser.Game(config);
window.cyberduelViewport?.attach(game);
