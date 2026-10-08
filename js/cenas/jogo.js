// Resolução de saída: altere apenas GW/GH para mudar o tamanho do canvas.
const GW = 720;
const GH = 1480;

// A câmera mantém o layout proporcional sem cortar o campo.
const LARGURA_LAYOUT = Math.max(1080, (2160 * GW) / GH);
const ALTURA_LAYOUT = Math.max(2160, (1080 * GH) / GW);
// Dez pixels na resolução base, convertidos para as coordenadas da arena.
const DESLOCAMENTO_GUI_Y = 10 * LARGURA_LAYOUT / GW;

const DURACAO_TURNO_MS = 40_000;

const FONTE_LENDARIA = 'Arial, sans-serif';

const VIDEOS_INVOCACAO_POR_CARTA = Object.freeze({
  "RaspClay MonteCorp": "efeitoRaspClayVertical",
});

// Calcula as quatro fileiras e cinco colunas do campo.
function calcularLayoutCampo(slotW, slotH, gapFileira, gapTimes, yInimigoTras) {
  const yInimigoFrente = yInimigoTras + slotH + gapFileira;
  const yJogadorFrente = yInimigoFrente + slotH + gapTimes;
  const yJogadorTras = yJogadorFrente + slotH + gapFileira;

  const gapCol = Math.min(20, Math.max(10, (LARGURA_LAYOUT - slotW * 5) / 4));
  const larguraTotal = 5 * slotW + 4 * gapCol;
  const margem = (LARGURA_LAYOUT - larguraTotal) / 2;
  const primeiro = margem + slotW / 2;
  const xs = [0, 1, 2, 3, 4].map((i) => primeiro + i * (slotW + gapCol));

  return {
    slotW,
    slotH,
    yInimigoTras,
    yInimigoFrente,
    yJogadorFrente,
    yJogadorTras,
    yInimigo: [yInimigoTras, yInimigoFrente],
    yJogador: [yJogadorTras, yJogadorFrente],
    x: xs,
  };
}

// Layout normal: mão visível embaixo. Cartas maiores e menor distância entre o campo inimigo e o jogador.
const LAYOUT_CAMPO_NORMAL = calcularLayoutCampo(
  195, // slotW: largura da carta
  270, // slotH: altura da carta
  12, // gapFileira: espaço entre as duas fileiras
  74, // gapTimes: faixa da fase entre os dois lados
  510 + DESLOCAMENTO_GUI_Y, // yInimigoTras: espaço para retrato, timer e mão do oponente
);

// Layout ampliado: mão escondida. Cartas ainda maiores, aproveitando o espaço liberado pela mão.
const LAYOUT_CAMPO_AMPLIADO = calcularLayoutCampo(
  195, // slotW: largura da carta
  280, // slotH: altura da carta
  16, // gapFileira: espaço entre as duas fileiras
  120, // gapTimes: espaço entre inimigo e jogador
  585 + DESLOCAMENTO_GUI_Y, // yInimigoTras
);

// Altura Y da faixa da mão do inimigo (topo da tela) e da mão do jogador (perto do rodapé) — usadas em desenharMaoInimigo() e desenharMaoEmLeque().
const Y_MAO_INIMIGO = 230 + DESLOCAMENTO_GUI_Y;
const Y_MAO_JOGADOR = ALTURA_LAYOUT - 175;

class CenaJogo extends Phaser.Scene {
  constructor() {
    super("CenaJogo");
  }

  // O ponteiro chega em pixels do canvas; gestos e limites usam o mundo.
  pontoDoPonteiro(pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  // Os assets já foram carregados pela CenaPreload.

  create(dados = {}) {
    // Phaser reutiliza os dados da última abertura quando start() não recebe dados.
    this.sys.settings.data = {};
    this.tutorial = dados.tutorial === true;
    this.training = null;
    this.finalDebug = false;
    this.avisoInicialPendente = true;
    this.avisoBatalhaTexto = null;
    this.avisoBatalhaSom = null;
    this.avisoLocal = null;
    this.tipoAvisoBatalha = null;
    this.avisosBatalhaTocados = new Set();
    this.avisoSequencia = 0;
    this.avisoBatalhaDispensado = null;
    this.events.once("shutdown", () => this.avisoBatalhaSom?.destroy());
    this.camadaModalCarta = null;
    this.events.once("shutdown", () => {
      this.limparEventosDescricao();
      this.limparCamadaModalCarta();
    });
    this.videoFundo = null;
    this.fundoBatalha = null;
    this.baseCampo = null;
    this.layoutBaseCampo = null;
    this.gestosMaoConfigurados = false;
    this.partidaRegistradaNaConta = !!dados.debug || this.tutorial;
    configurarCameraLogica(this);
    const sessao = window.cyberduelMultiplayer;
    if (sessao?.presentation) this.input.keyboard.on("keydown-ESC", () => {
      sessao.leaveRoom();
      this.scene.start("CenaTitulo");
    });
    this.partida = !this.tutorial && sessao?.pendingUpdate?.state
      ? sessao.hydrateMatch(sessao.localSnapshot(sessao.pendingUpdate.state))
      : new Partida(dados.deckDebug, this.tutorial);
    if (this.tutorial) this.training = new CyberduelTraining(this);
    this.sequenciaInicialEfeitos = this.partida.sequenciaEfeito || 0;
    if (window.CenaEfeitos) {
      if (!this.scene.manager.keys.CenaEfeitos)
        this.scene.add("CenaEfeitos", window.CenaEfeitos);
      this.scene.launch("CenaEfeitos", {
        jogo: this,
        sequencia: this.sequenciaInicialEfeitos,
      });
      this.events.once("shutdown", () => this.scene.stop("CenaEfeitos"));
    }
    this.faseAtual = "colocar";
    this.soloStep = 0;
    this.soloStarter = this.tutorial ? 1 : Math.random() < 0.5 ? 1 : 2;
    this.telaFinalExibida = false;
    const volumeMusica = (base) =>
      window.cyberduelSettings?.music(base) ?? base;
    const volumeEfeito = (base) =>
      window.cyberduelSettings?.effects(base) ?? base;
    const sons = [
      ["musicaFundo", true, 0.3],
      ["somTorcida", true, 0.03],
      ["somJogarCarta", false, 0.3],
      ["somPop", false, 0.3],
      ["somComprarCarta", false, 0.3],
      ["somBuff", false, 0.3],
      ["somHover", false, 0.15],
      ["somRaspClay", false, 0.3],
    ].map(([chave, loop, volume]) => {
      const som = this.sound.add(chave, {
        loop,
        volume: (loop ? volumeMusica : volumeEfeito)(volume),
      });
      this[chave] = som;
      return som;
    });
    this.events.once("shutdown", () => sons.forEach((som) => som.destroy()));
    this.musicaFundo.play();
    this.somTorcida.play();

    // O fade começa após o redesenho, que cancela os tweens existentes.
    this.cameras.main.setAlpha(0);

    // Aplica contorno preto nos textos sem estilo próprio.
    if (!this.__cyberduelStrokeTextInstalled) {
      const criarTextoOriginal = this.add.text.bind(this.add);
      this.add.text = (x, y, texto, estilo = {}) => {
        const estiloComTraco = Object.assign(
          { stroke: "#000000", strokeThickness: 4 },
          estilo,
        );
        return criarTextoOriginal(x, y, texto, estiloComTraco);
      };
      this.__cyberduelStrokeTextInstalled = true;
    }

    // Controla se a mão está escondida (para dar mais espaço/destaque ao campo). Começa visível.
    this.maoEscondida = false;
    this.layout = LAYOUT_CAMPO_NORMAL;

    // Bloqueia comandos durante animações e modais.
    this.travado = false;
    this.turnoAposEfeitos = null;
    this.finalizandoJogada = false;
    this.interfaceOcultaPorEfeitos = false;

    // Estado dos relógios de cada jogador.
    this.tempoRestanteTurno = DURACAO_TURNO_MS;
    this.tempoRestanteOponente = DURACAO_TURNO_MS;
    this.duracaoTurnoAtual = DURACAO_TURNO_MS;
    this.duracaoTurnoOponenteAtual = DURACAO_TURNO_MS;
    this.timerOponenteRodando = true;
    this.timerTurnoExpirado = false;
    this.ehMeuTurno = true;
    this.timerContainer = null;
    this.timerTexto = null;
    this.timerEstadoTexto = null;
    this.timerBarra = null;
    this.timerHalo = null;
    this.timerUltimoSegundo = null;
    this.timerUltimoEstado = null;
    this.proximaAtualizacaoAuras = 0;

    // Registra cartas visíveis para não repetir animações de entrada.
    this.interfaceJaDesenhada = false;
    this.renderizandoInterface = false;
    this.chavesCampoRenderAnterior = new Set();
    this.chavesCampoNovasRender = new Set();
    this.atmosferaTatica = null;

    // Referência ao texto de resultado do combate, para poder destruí-lo com segurança caso a interface seja redesenhada antes da animação dele terminar.
    this.textoResultadoAtual = null;

    // Controle do modal de visualização de carta
    this.modalAberto = false;
    this.painelDetalheAtual = null;
    this.overlayDetalheAtual = null;
    this.mascaraDetalheAtual = null;

    // Estado do zoom sobre a ficha da carta.
    this.zoomAberto = false;
    this.painelZoomAtual = null;
    this.overlayZoomAtual = null;
    this.handlerTiltZoomAtual = null;

    // Bloqueia reaberturas acidentais do zoom após um toque.
    this.zoomBloqueadoAte = 0;

    // Guarda os listeners de rolagem para removê-los ao fechar o modal.
    this.handlersScrollDescAtual = null;

    // Objetos do modo de mira (anéis + zonas de toque) do botão "Ativar Habilidade" do modal de detalhe — ver iniciarAtivacaoHabilidade().
    this.objetosSelecaoAlvo = null;

    // Referência ao botão de menu enquanto estiver visível.
    this.rodaBotoesContainer = null;

    // As opções existem apenas enquanto o menu está aberto.
    this.rodaOpcoesContainer = null;

    // Controle do modal de histórico de cartas jogadas
    this.historicoAberto = false;
    this.painelHistoricoAtual = null;
    this.overlayHistoricoAtual = null;
    this.listaHistoricoContainer = null;
    this.labelPaginaHistorico = null;
    this.btnAnteriorHistorico = null;
    this.btnProximaHistorico = null;
    this.historicoPagina = 0;

    // Distingue toque de arraste pela distância percorrida.
    this.input.dragDistanceThreshold = 8;

    // Atalhos de depuração para listar e puxar cartas.
    window.partida = this.partida;
    window.cena = this;

    window.listarDeck = () => {
      console.table(
        this.partida.jogador.deck.cartas.map((c) => ({
          id: c.id,
          nome: c.nome,
          tipo: c.tipo,
          poder: c.poder,
        })),
      );
    };

    window.listarMao = () => {
      console.table(
        this.partida.jogador.mao.cartas.map((c) => ({
          id: c.id,
          nome: c.nome,
          tipo: c.tipo,
          poder: c.poder,
        })),
      );
    };

    window.puxarCarta = (busca) => {
      requireAdminAccount();
      this.partidaRegistradaNaConta = true;
      const termo = (busca || "").toString().toLowerCase();
      const deck = this.partida.jogador.deck.cartas;
      const indice = deck.findIndex((c) =>
        c.nome.toLowerCase().includes(termo),
      );

      let carta;
      if (indice !== -1) {
        [carta] = deck.splice(indice, 1);
      } else {
        // Não achou no deck: procura nos pools e cria a carta na hora, mesmo que ela nunca tenha entrado no deck desta partida.
        const baseEfeito = POOL_CARTAS_EFEITO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );
        const baseMonstro = POOL_CARTAS_MONSTRO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );
        const baseTerreno = POOL_CARTAS_TERRENO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );

        if (baseEfeito) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            baseEfeito.poder,
            "efeito",
            { ...baseEfeito },
          );
        } else if (baseMonstro) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            baseMonstro.poder,
            "monstro",
            { ...baseMonstro },
          );
        } else if (baseTerreno) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            0,
            "terreno",
            { ...baseTerreno },
          );
        } else {
          console.warn(
            `puxarCarta: nada encontrado com "${busca}". Use listarDeck() ou confira os nomes nos pools.`,
          );
          return null;
        }
      }

      this.partida.jogador.mao.adicionarCarta(carta);
      this.partida.jogador.cartasRecemCompradas.push(carta);

      if (!this.travado) this.desenharInterface();
      return carta;
    };

    // Debug: coloca uma carta inimiga sem validar turno nem aplicar invocação.
    window.invocarCartaInimigo = (busca, posicao) => {
      requireAdminAccount();
      this.partidaRegistradaNaConta = true;
      if (posicao === undefined || posicao === null) {
        console.warn(
          'invocarCartaInimigo: informe a posição (0-9). Ex: invocarCartaInimigo("juggernaut", 6)',
        );
        return null;
      }
      if (!this.partida.inimigo.campo.temEspaco(posicao)) {
        console.warn(`invocarCartaInimigo: posição ${posicao} já ocupada.`);
        return null;
      }

      const termo = (busca || "").toString().toLowerCase();
      const deck = this.partida.inimigo.deck.cartas;
      const indice = deck.findIndex((c) =>
        c.nome.toLowerCase().includes(termo),
      );

      let carta;
      if (indice !== -1) {
        [carta] = deck.splice(indice, 1);
      } else {
        const baseMonstro = POOL_CARTAS_MONSTRO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );
        const baseTerreno = POOL_CARTAS_TERRENO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );

        if (baseMonstro) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            baseMonstro.poder,
            "monstro",
            { ...baseMonstro },
          );
        } else if (baseTerreno) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            0,
            "terreno",
            { ...baseTerreno },
          );
        } else {
          console.warn(
            `invocarCartaInimigo: nada encontrado com "${busca}". Cartas de efeito não vão a campo.`,
          );
          return null;
        }
      }

      this.partida.inimigo.campo.adicionarCarta(carta, posicao);
      this.partida.resolverEfeitosContinuos(this.partida.inimigo);
      this.partida.resolverEfeitosContinuos(this.partida.jogador);
      if (!this.travado) this.desenharInterface();
      return carta;
    };

    this.cartaMaoSelecionada = null;
    this.input.on("pointerup", (pointer, objetos) => {
      if (objetos.some((o) => o.dadosCarta)) return;
      this.jogarCartaSelecionadaNoCampo(pointer);
    });

    // Drag and Drop das cartas da mão
    this.input.on("dragstart", (pointer, gameObject) => {
      if (
        !this.podeJogarCartasAgora() ||
        (this.faseAtual === "habilidades" && gameObject.dadosCarta?.tipo !== "efeito") ||
        this.travado ||
        gameObject.animandoCompra ||
        !gameObject.dadosCarta
      )
        return;
      // Mesma defesa de tratarSoltarCarta: se a carta deste objeto não está mais na mão, nem deixa o arraste começar.
      if (!this.partida.jogador.mao.cartas.includes(gameObject.dadosCarta)) {
        return;
      }
      this.baixarOutrasCartasDaMao(gameObject);
      this.cartaMaoSelecionada = null;
      this.gestoMaoAtivo = false;
      this.tweens.killTweensOf(gameObject);
      gameObject.setDepth(2000); // sempre por cima de tudo durante o arraste
      this.tweens.add({
        targets: gameObject,
        scaleX: 1.2,
        scaleY: 1.2,
        angle: 0,
        duration: 120,
        ease: "Back.Out",
      });
    });

    this.input.on("drag", (pointer, gameObject, dragX, dragY) => {
      if (
        !this.podeJogarCartasAgora() ||
        (this.faseAtual === "habilidades" && gameObject.dadosCarta?.tipo !== "efeito") ||
        this.travado ||
        !gameObject.dadosCarta
      )
        return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on("dragend", (pointer, gameObject) => {
      if (
        !this.podeJogarCartasAgora() ||
        (this.faseAtual === "habilidades" && gameObject.dadosCarta?.tipo !== "efeito") ||
        this.travado ||
        !gameObject.dadosCarta
      )
        return;
      this.tratarSoltarCarta(gameObject);
    });

    this.multiplayer = window.cyberduelMultiplayer;
    this.multiplayerAtivo = !this.tutorial && !!this.multiplayer?.active;
    this.carregarRetratosDuelo();
    this.soloMatchStart = !this.multiplayerAtivo && !dados.debug && !this.tutorial && window.cyberduelAccount?.user
      ? window.cyberduelAccount.startSoloMatch().then(matchId => ({ matchId }), error => ({ error }))
      : null;
    if (this.multiplayerAtivo) {
      this.faseAtual = this.multiplayer.phase;
      this.partida.fase = this.faseAtual;
      this.ehMeuTurno =
        this.multiplayer.initialized &&
        this.multiplayer.activePlayer === this.multiplayer.player;
      this.travado = !this.ehMeuTurno;
      this.multiplayer.attachScene(this);
      this.events.once("shutdown", () => this.multiplayer.detachScene(this));
      if (this.multiplayer.player === 1 && !this.multiplayer.initialized)
        this.multiplayer.sendInitialState(this.partida);
    } else {
      this.ehMeuTurno = this.soloStarter === 1;
      this.travado = !this.ehMeuTurno;
      this.partida.fase = "colocar";
    }
    if (this.ehMeuTurno) this.reiniciarTimerTurno();
    else this.reiniciarTimerOponente();

    this.desenharInterface();
    this.atualizarAvisoBatalha();
    this.training?.start();
    if (!this.multiplayerAtivo && !this.ehMeuTurno)
      this.time.delayedCall(Math.max(0, this.avisoLocal.phaseStartsAt - Date.now()) + 650, () => this.executarFaseSolo());

    if (this.multiplayerAtivo && this.travado) this.mostrarEsperaMultiplayer();

    // Inicia o fade após o redesenho para preservar seu tween.
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 1,
      duration: 600,
      ease: "Sine.easeOut",
    });
  }

  configurarAvisoLocal(duracaoTurno) {
    const avisos = window.cyberduelBattleAnnouncements;
    const announcementAt = Date.now();
    const skip = this.tutorial || window.cyberduelSettings?.get("skipBattleAnnouncements") === 1;
    const introUntil = announcementAt + (this.avisoInicialPendente && !skip ? avisos.inicio.duracao : 0);
    this.avisoInicialPendente = false;
    this.avisoSequencia++;
    this.avisoLocal = { announcementAt, introUntil,
      phaseStartsAt: introUntil + (this.ehMeuTurno && !skip ? avisos[this.faseAtual].duracao : 0) };
    this.prazoFaseLocal = this.avisoLocal.phaseStartsAt + duracaoTurno;
  }

  avisoBatalhaPendente() {
    return this.multiplayerAtivo ? this.multiplayer.announcementPending?.()
      : this.avisoLocal?.phaseStartsAt > Date.now();
  }

  atualizarAvisoBatalha() {
    const skip = window.cyberduelSettings?.get("skipBattleAnnouncements") === 1;
    if (skip && this.multiplayerAtivo) this.multiplayer.skipAnnouncement();
    const relogio = this.multiplayerAtivo ? this.multiplayer : this.avisoLocal;
    const agora = Date.now() + (this.multiplayerAtivo ? this.multiplayer.clockOffset : 0);
    let tipo = null;
    const fase = this.multiplayerAtivo ? `${this.multiplayer.round}:${this.multiplayer.step}` : this.avisoSequencia;
    if (!skip && this.avisoBatalhaDispensado !== fase && !this.partida?.partidaEncerrada && !this.efeitosVisuaisPendentes() && !this.multiplayer?.effectsPaused &&
        relogio && agora >= relogio.announcementAt && agora < relogio.phaseStartsAt) {
      if (agora < relogio.introUntil) tipo = "inicio";
      else if (this.ehMeuTurno && !this.multiplayer?.spectator) tipo = this.faseAtual;
    }
    const aviso = window.cyberduelBattleAnnouncements?.[tipo];
    if (!aviso) {
      this.avisoBatalhaSom?.destroy();
      this.avisoBatalhaSom = null;
    }
    if (this.tipoAvisoBatalha !== tipo || (aviso && !this.avisoBatalhaTexto?.active)) {
      this.avisoBatalhaTexto?.destroy();
      this.avisoBatalhaTexto = aviso ? this.add.text(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, aviso.texto, {
        fontFamily: "Rushblade, Arial, sans-serif", fontSize: "76px", color: "#ffffff",
        stroke: "#000000", strokeThickness: 10, align: "center", wordWrap: { width: LARGURA_LAYOUT - 80 },
      }).setOrigin(0.5).setDepth(5200) : null;
      this.tipoAvisoBatalha = tipo;
    }
    const chave = this.multiplayerAtivo ? `${this.multiplayer.round}:${this.multiplayer.step}:${tipo}` : `${this.avisoSequencia}:${tipo}`;
    if (aviso && !this.avisosBatalhaTocados.has(chave)) {
      this.avisosBatalhaTocados.add(chave);
      this.avisoBatalhaSom?.destroy();
      this.avisoBatalhaSom = this.sound.add(aviso.som, { volume: window.cyberduelSettings?.effects(1) ?? 1 });
      const inicio = tipo === "inicio" ? relogio.announcementAt : relogio.introUntil;
      this.avisoBatalhaSom.play({ seek: Math.max(0, (agora - inicio) / 1000) });
    }
  }

  apresentarEventosEfeito(eventos = this.partida?.eventosEfeito) {
    if (this.finalDebug) return;
    const efeitos = this.scene?.manager?.keys?.CenaEfeitos;
    if (eventos?.length && efeitos && eventos.at(-1).id > efeitos.ultimoEvento) {
      if (eventos.some(evento => evento.id > efeitos.ultimoEvento &&
          ["invocacao", "conjuracao", "habilidade"].includes(evento.momento))) {
        this.avisoBatalhaTexto?.destroy();
        this.avisoBatalhaTexto = null;
        this.avisoBatalhaDispensado = this.multiplayerAtivo ? `${this.multiplayer.round}:${this.multiplayer.step}` : this.avisoSequencia;
      }
      efeitos.receber(eventos);
    }
  }

  efeitosOponentePendentes() {
    const efeitos = this.scene?.manager?.keys?.CenaEfeitos;
    return Boolean(
      (efeitos?.executando && efeitos.eventoAtual?.lado === "inimigo") ||
      efeitos?.fila?.some((evento) => evento.lado === "inimigo"),
    );
  }

  efeitosVisuaisPendentes() {
    const efeitos = this.scene?.manager?.keys?.CenaEfeitos;
    return !!(efeitos?.executando || efeitos?.fila?.length || this.animacaoRemotaEmCurso);
  }

  efeitoInvocacaoEmCurso() {
    const efeitos = this.scene?.manager?.keys?.CenaEfeitos;
    return [efeitos?.eventoAtual, ...(efeitos?.fila || [])]
      .filter(Boolean)
      .some((evento) => evento.momento === "invocacao");
  }

  efeitosBloqueiamInteracao() {
    return (this.efeitosVisuaisPendentes() || !!this.multiplayer?.effectsPaused) && !this.efeitoInvocacaoEmCurso();
  }

  atualizarInteracaoDuranteEfeitos() {
    const bloqueado = this.efeitosBloqueiamInteracao() || this.avisoBatalhaPendente() || !!this.training?.dialog;
    let transicao = false;
    for (const objeto of this.children?.list || []) {
      if (!objeto.dadosCarta && objeto !== this.rodaBotoesContainer) continue;
      // Deixa a compra terminar antes de recolher a carta, sem cortar seu voo.
      if (objeto.animandoCompra) continue;
      const deslocamento = objeto.dadosCarta ? 80 : 28;
      const ocultar = bloqueado && !objeto.dadosCarta;
      if (!objeto.estadoAntesDosEfeitos &&
          (ocultar || (this.interfaceOcultaPorEfeitos && !objeto.dadosCarta && objeto.ocultoPorEfeitos === undefined))) {
        objeto.estadoAntesDosEfeitos = { y: objeto.y, alpha: objeto.alpha, visible: objeto.visible };
        this.tweens.killTweensOf(objeto);
        // Um redesenho durante a pausa deve preservar a interface já recolhida.
        if (this.interfaceOcultaPorEfeitos) {
          objeto.y += deslocamento;
          objeto.setAlpha(0).setVisible(false);
          objeto.ocultoPorEfeitos = true;
        }
      }
      const anterior = objeto.estadoAntesDosEfeitos;
      if (!anterior) continue;
      if (ocultar !== !!objeto.ocultoPorEfeitos) {
        objeto.tweenOcultacaoEfeitos?.stop();
        objeto.ocultoPorEfeitos = ocultar;
        objeto.setVisible(anterior.visible);
        objeto.tweenOcultacaoEfeitos = this.tweens.add({
          targets: objeto,
          y: anterior.y + (ocultar ? deslocamento : 0),
          alpha: ocultar ? 0 : anterior.alpha,
          duration: ocultar ? 220 : 300,
          ease: ocultar ? "Cubic.In" : "Cubic.Out",
          onComplete: () => {
            objeto.tweenOcultacaoEfeitos = null;
            if (ocultar) objeto.setVisible(false);
            else objeto.estadoAntesDosEfeitos = null;
          },
        });
      }
      transicao ||= !!objeto.tweenOcultacaoEfeitos;
    }
    this.interfaceOcultaPorEfeitos = bloqueado || transicao;
    if (this.input) this.input.enabled = !bloqueado && !transicao;
  }

  update(time) {
    this.apresentarEventosEfeito();
    this.atualizarInteracaoDuranteEfeitos();
    const agoraVisual = Date.now();
    const visual = this.efeitosVisuaisPendentes();
    if (!this.multiplayerAtivo && this.prazoFaseLocal && (visual || this.visualAnterior)) {
      const pausa = Math.max(0, agoraVisual - (this.ultimoTickVisual || agoraVisual));
      this.prazoFaseLocal += pausa;
      if (this.avisoLocal && this.avisoLocal.phaseStartsAt > (this.ultimoTickVisual || agoraVisual))
        for (const key of ["announcementAt", "introUntil", "phaseStartsAt"]) this.avisoLocal[key] += pausa;
    }
    this.ultimoTickVisual = agoraVisual;
    this.visualAnterior = visual;
    this.atualizarAvisoBatalha();
    if (!visual && this.multiplayerAtivo)
      this.multiplayer.effectsReady?.(this.scene?.manager?.keys?.CenaEfeitos?.ultimoEvento || 0);
    if (this.turnoAposEfeitos && !this.efeitosOponentePendentes()) {
      const continuar = this.turnoAposEfeitos;
      this.turnoAposEfeitos = null;
      continuar();
    }
    // A indicação visual não precisa recalcular alvos em cada frame.
    if (time >= this.proximaAtualizacaoAuras) {
      this.atualizarAurasHabilidade();
      this.proximaAtualizacaoAuras = time + 100;
    }
    if (this.training) { this.training.update(); return; }
    if (!this.partida || this.partida.partidaEncerrada) return;
    if (this.multiplayerAtivo && !this.multiplayer.initialized) return;
    const restante = this.multiplayerAtivo
      ? this.multiplayer.remainingMs()
      : Math.max(0, (this.prazoFaseLocal || Date.now()) - Math.max(Date.now(), this.avisoLocal?.phaseStartsAt || 0));
    if (this.ehMeuTurno) this.tempoRestanteTurno = restante;
    else this.tempoRestanteOponente = restante;
    this.atualizarVisualTimerTurno();
    if (this.avisoBatalhaPendente() || visual || this.multiplayer?.effectsPaused || restante > 0 || this.timerTurnoExpirado || !this.ehMeuTurno) return;
    this.timerTurnoExpirado = true;
    this.time.delayedCall(0, () => {
      if (this.partida.partidaEncerrada) return;
      this.encerrarSelecoesDaFase();
      this.aoClicarPassarTurno();
    });
  }

  podeContarTimerTurno() {
    return Boolean(
      this.partida &&
      !this.partida.partidaEncerrada &&
      this.ehMeuTurno &&
      !this.timerTurnoExpirado,
    );
  }

  podeContarTimerOponente() {
    return Boolean(
      this.partida && !this.partida.partidaEncerrada && !this.ehMeuTurno,
    );
  }

  podeJogarCartasAgora() {
    return (
      (!this.training || ["intern", "tiger", "dipsp"].includes(this.training.step)) &&
      !this.training?.dialog &&
      this.ehMeuTurno &&
      !this.avisoBatalhaPendente() && !this.efeitosVisuaisPendentes() && !this.multiplayer?.effectsPaused &&
      ["colocar", "habilidades"].includes(this.faseAtual) &&
      !this.timerTurnoExpirado &&
      !this.multiplayer?.spectator
    );
  }

  podeUsarHabilidadesAgora() {
    return (
      (!this.training || ["tiger-ability", "dipsp-ability"].includes(this.training.step)) &&
      !this.training?.dialog &&
      this.ehMeuTurno &&
      !this.avisoBatalhaPendente() && !this.efeitosVisuaisPendentes() && !this.multiplayer?.effectsPaused &&
      this.faseAtual === "habilidades" &&
      !this.timerTurnoExpirado &&
      !this.multiplayer?.spectator
    );
  }

  podeConsultarCartas() {
    return (
      (!this.training || ["intern", "tiger", "dipsp", "tiger-ability", "dipsp-ability"].includes(this.training.step)) &&
      !this.avisoBatalhaPendente() && !this.efeitosBloqueiamInteracao() &&
      !this.multiplayer?.presentation &&
      !this.modalAberto &&
      !this.animacaoRemotaEmCurso &&
      (!this.ehMeuTurno || !this.travado)
    );
  }

  encerrarSelecoesDaFase() {
    this.objetosSelecaoAlvo?.forEach((o) => o.destroy());
    this.objetosSelecaoAlvo = null;
    this.modalAberto = !!this.painelDetalheAtual?.active;
    this.travado = false;
    this.desenharInterface();
  }

  reiniciarTimerTurno() {
    this.ultimoTickVisual = Date.now(); this.visualAnterior = false;
    this.duracaoTurnoAtual = this.duracaoPermitidaPara(this.partida?.jogador);
    if (!this.multiplayerAtivo)
      this.configurarAvisoLocal(this.duracaoTurnoAtual);
    this.tempoRestanteTurno = this.multiplayerAtivo
      ? this.multiplayer.remainingMs()
      : this.duracaoTurnoAtual;
    this.timerTurnoExpirado = false;
    this.timerUltimoSegundo = null;
    this.timerUltimoEstado = null;
    this.atualizarVisualTimerTurno(true);
  }

  reiniciarTimerOponente() {
    this.ultimoTickVisual = Date.now(); this.visualAnterior = false;
    this.duracaoTurnoOponenteAtual = this.duracaoPermitidaPara(
      this.partida?.inimigo,
    );
    if (!this.multiplayerAtivo)
      this.configurarAvisoLocal(this.duracaoTurnoOponenteAtual);
    this.tempoRestanteOponente = this.multiplayerAtivo
      ? this.multiplayer.remainingMs()
      : this.duracaoTurnoOponenteAtual;
    this.timerOponenteRodando = true;
    this.timerUltimoSegundo = null;
    this.timerUltimoEstado = null;
    this.atualizarVisualTimerTurno(true);
  }

  receberTempoOponente(tempoRestante, rodando = true) {
    if (this.ehMeuTurno || !Number.isFinite(Number(tempoRestante))) return;
    this.tempoRestanteOponente = Phaser.Math.Clamp(
      Number(tempoRestante),
      0,
      this.duracaoTurnoOponenteAtual || DURACAO_TURNO_MS,
    );
    this.timerOponenteRodando = rodando !== false;
    this.atualizarVisualTimerTurno(true);
  }

  // NeoAnalistas reduzem o turno adversário, respeitando o mínimo da carta.
  duracaoPermitidaPara(donoDoTurno) {
    if (!this.partida || !donoDoTurno) return DURACAO_TURNO_MS;
    const adversario =
      donoDoTurno === this.partida.jogador
        ? this.partida.inimigo
        : this.partida.jogador;
    let reducaoSegundos = 0;
    let minimoSegundos = 0;
    adversario.campo.cartas.forEach((carta) => {
      if (carta?.efeito?.tipo !== TIPOS_EFEITO.REDUZIR_TEMPO_OPONENTE) return;
      reducaoSegundos += Math.max(0, Number(carta.efeito.valor) || 0);
      minimoSegundos = Math.max(
        minimoSegundos,
        Math.max(0, Number(carta.efeito.minimo) || 0),
      );
    });
    return Math.max(
      Math.max(15, minimoSegundos) * 1000,
      DURACAO_TURNO_MS - reducaoSegundos * 1000,
    );
  }

  iniciarNovoTurnoDoJogador() {
    if (this.faseAtual === "colocar")
      this.partida.iniciarTurno(this.partida.jogador);
    this.ehMeuTurno = true;
    this.reiniciarTimerTurno();
  }

  pausarTimerAteProximoTurno() {
    this.ehMeuTurno = false;
    this.reiniciarTimerOponente();
  }

  estadoTimerTurno() {
    if (this.avisoBatalhaPendente() || this.efeitosVisuaisPendentes() || this.multiplayer?.effectsPaused) return "animacao";
    if (this.finalizandoJogada) return "enviando";
    if (!this.ehMeuTurno) return "oponente";
    if (this.timerTurnoExpirado) return "esgotado";
    return "ativo";
  }

  tempoExibidoTimerTurno() {
    return this.ehMeuTurno
      ? this.tempoRestanteTurno
      : this.tempoRestanteOponente;
  }

  formatarTempoTurno(ms = this.tempoExibidoTimerTurno()) {
    const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  }

  // O clipe especial bloqueia a partida até chamar aoConcluir.
  reproduzirEfeitoInvocacao(carta, aoConcluir = () => {}) {
    if (window.CenaEfeitos) return false;
    const chaveVideo = VIDEOS_INVOCACAO_POR_CARTA[carta?.nome];
    if (!chaveVideo) return false;

    const video = this.add
      .video(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, chaveVideo)
      .setOrigin(0.5)
      .setDepth(5000)
      .setVisible(false)
      .setInteractive();
    this.videoInvocacaoAtual = video;

    // Ajusta o tamanho somente após created, quando existe um frame real.
    video.once("created", () => {
      if (!video.active) return;
      video.setDisplaySize(1080, 1636);
      video.setVisible(true);
    });

    let finalizado = false;
    const finalizar = () => {
      if (finalizado) return;
      finalizado = true;
      if (video.active) video.destroy();
      if (this.videoInvocacaoAtual === video) this.videoInvocacaoAtual = null;
      aoConcluir();
    };

    video.once("complete", finalizar);
    video.once("error", finalizar);
    video.play(false);

    // Proteção para codecs/navegadores que não emitirem "complete".
    this.time.delayedCall(1700, finalizar);
    return true;
  }

  // Gera uma cor fixa baseada no ID da carta
  obterCorPorId(id) {
    const cores = [
      0x8e44ad, 0x29b959, 0x27ae60, 0xd35400, 0xc0392b, 0x16a044, 0xf39c12,
      0x345e42,
    ];
    return cores[id % cores.length];
  }

  // Recorta a arte como cover, respeitando o foco de 0 a 1.
  aplicarRecorteCover(imagem, larguraJanela, alturaJanela, foco) {
    const f = foco || { x: 0.5, y: 0.5 };
    const nativoW = imagem.width;
    const nativoH = imagem.height;
    const escala = Math.max(larguraJanela / nativoW, alturaJanela / nativoH);

    // Tamanho (em pixels da textura ORIGINAL) da fatia que, nessa escala, preenche exatamente a janela — nunca maior que a imagem inteira.
    const cropW = Math.min(nativoW, larguraJanela / escala);
    const cropH = Math.min(nativoH, alturaJanela / escala);

    // Desloca a fatia dentro da imagem conforme o foco, sempre dentro dos limites da própria imagem (então nunca sobra borda vazia).
    const cropX = Phaser.Math.Clamp(
      (nativoW - cropW) * f.x,
      0,
      nativoW - cropW,
    );
    const cropY = Phaser.Math.Clamp(
      (nativoH - cropH) * f.y,
      0,
      nativoH - cropH,
    );

    imagem.setCrop(cropX, cropY, cropW, cropH);
    imagem.setScale(escala);

    // Compensa a origem: setCrop não altera a caixa da imagem.
    imagem.x = (nativoW * escala) / 2 - cropX * escala - larguraJanela / 2;
    imagem.y = (nativoH * escala) / 2 - cropY * escala - alturaJanela / 2;
  }

  // Encurta nomes longos sem alterar o texto original.
  truncarTexto(texto, maximo) {
    if (texto.length <= maximo) return texto;
    return texto.slice(0, maximo - 1) + "…";
  }

  // PA centralizado na mesma placa angular do HUD.
  criarSeloEstat(x, y, valor, corTexto, raio, cor = 0x54ddff) {
    const placa = this.criarPlacaDuelo(x, y, raio * 2, raio * 2, cor);
    const texto = this.criarTextoUI(x, y, `${valor}`, {
      fontSize: `${Math.round(raio * 1.05)}px`,
      color: ["#ff5555", "#ff6666"].includes(corTexto) ? "#f2f8ff" : corTexto,
      fontStyle: "bold",
    }).setOrigin(0.5);
    return [placa, texto];
  }

  elevarModalCarta(...objetos) {
    objetos.forEach((objeto) => objeto.setDepth(10000 + objeto.depth));
    this.scene.bringToTop();
  }

  limparCamadaModalCarta() {
    this.limparMascaraRender(this.mascaraDescricaoAtual);
    this.mascaraDescricaoAtual = null;
    this.scene.sendToBack();
  }

  // Superfícies locais à CenaJogo. Camadas vetoriais translúcidas mantêm o vídeo visível sem filtros de desfoque por frame ou texturas extras.
  criarSuperficieVidro(
    x,
    y,
    largura,
    altura,
    { cor = 0xc5ecd2, opacidade = 0.76, raio = 28 } = {},
  ) {
    const r = Math.min(raio, altura / 2, largura / 2);
    const g = this.add.graphics();
    const left = -largura / 2;
    const top = -altura / 2;
    g.fillStyle(0x020811, 0.18);
    g.fillRoundedRect(left, top + 7, largura, altura, r);
    g.fillStyle(0x173220, opacidade);
    g.fillRoundedRect(left, top, largura, altura, r);
    g.fillStyle(cor, 0.055);
    g.fillRoundedRect(left + 1, top + 1, largura - 2, altura - 2, r);
    g.lineStyle(1.5, 0xe8fff0, 0.27);
    g.strokeRoundedRect(left, top, largura, altura, r);
    // Reflexo superior e borda inferior dão espessura ao vidro.
    g.lineStyle(2, 0xffffff, 0.35);
    g.lineBetween(left + r, top + 2, -left - r, top + 2);
    g.lineStyle(1, cor, 0.16);
    g.lineBetween(left + r, -top - 2, -left - r, -top - 2);
    return this.add.container(x, y, [g]).setSize(largura, altura);
  }

  criarTextoUI(x, y, texto, estilo = {}) {
    return this.add.text(x, y, texto, {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      color: "#f2f6fc",
      ...estilo,
      strokeThickness: 0,
    });
  }

  // Placas e molduras vetoriais: o vídeo continua visível atrás da arena.
  criarPlacaDuelo(x, y, largura, altura, cor = 0x54ddff) {
    const g = this.add.graphics();
    const l = -largura / 2, t = -altura / 2;
    const corte = Math.min(22, altura / 3);
    const pontos = [
      { x: l + corte, y: t }, { x: -l, y: t },
      { x: -l, y: -t - corte }, { x: -l - corte, y: -t },
      { x: l, y: -t }, { x: l, y: t + corte },
    ];
    g.fillStyle(0x061027, 0.94);
    g.fillPoints(pontos, true);
    g.lineStyle(2, cor, 0.7);
    g.strokePoints(pontos, true);
    g.lineStyle(5, cor, 1);
    g.lineBetween(l + corte, -t - 1, -l - corte, -t - 1);
    return this.add.container(x, y, [g]).setSize(largura, altura);
  }

  criarMolduraCampo(x, y, largura, altura, cor) {
    const g = this.add.graphics();
    const l = -largura / 2, t = -altura / 2;
    g.fillStyle(0x071127, 0.24);
    g.fillRect(l, t, largura, altura);
    g.lineStyle(1.5, 0xd6e7ff, 0.38);
    g.strokeRect(l, t, largura, altura);
    g.lineStyle(3, cor, 0.8);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = sx * largura / 2, cy = sy * altura / 2;
      g.lineBetween(cx, cy - sy * 22, cx, cy);
      g.lineBetween(cx, cy, cx - sx * 22, cy);
    }
    return this.add.container(x, y, [g]).setSize(largura, altura);
  }

  carregarRetratosDuelo() {
    if (this.multiplayer?.presentation) return;
    const player = this.multiplayer?.player || 1;
    const profiles = this.multiplayerAtivo ? this.multiplayer.profiles : {};
    const urls = {
      jogador: profiles?.[player]?.avatar || window.cyberduelAccount?.avatar || "assets/fotosdeperfil/boi_icon.png",
      inimigo: profiles?.[3 - player]?.avatar || "assets/fotosdeperfil/raspclay_icon.png",
    };
    this.retratosDuelo = {};
    let pendentes = false;
    for (const [lado, url] of Object.entries(urls)) {
      if (!/^assets\/fotosdeperfil\/[\w-]+\.png$/.test(url)) continue;
      const key = `duelista:${url}`;
      this.retratosDuelo[lado] = key;
      if (!this.textures.exists(key)) {
        this.load.image(key, url);
        pendentes = true;
      }
    }
    if (pendentes) {
      const atualizar = () => {
        if (this.scene.isActive()) this.desenharInterface();
      };
      this.load.once("complete", atualizar);
      this.events.once("shutdown", () => this.load.off("complete", atualizar));
      this.load.start();
    }
  }

  criarPainelTatico(x, y, largura, altura, cor = 0xc5ecd2, alpha = 0.76) {
    return this.criarSuperficieVidro(x, y, largura, altura, {
      cor,
      opacidade: alpha,
    });
  }

  aplicarMascaraRender(alvo, mascaraGraphics) {
    const renderer = this.sys.game.renderer;
    if (renderer.type === Phaser.WEBGL) {
      // No WebGL do Phaser 4, a máscara usa filtros fora da display list.
      this.children.remove(mascaraGraphics);
      alvo.enableFilters();
      const filtro = alvo.filters.external.addMask(
        mascaraGraphics,
        false,
        this.cameras.main,
        "world",
      );
      filtro.autoUpdate = false;
      return { tipo: "filtro", alvo, filtro, mascaraGraphics };
    }

    // Mantém compatibilidade caso o navegador caia no renderer Canvas.
    mascaraGraphics.setVisible(false);
    const geometria = mascaraGraphics.createGeometryMask();
    alvo.setMask(geometria);
    return { tipo: "geometria", alvo, geometria, mascaraGraphics };
  }

  limparMascaraRender(referencia) {
    if (!referencia) return;
    const { tipo, alvo, filtro, geometria, mascaraGraphics } = referencia;
    if (tipo === "filtro") {
      if (alvo?.filters?.external?.list?.includes(filtro)) {
        alvo.filters.external.remove(filtro, true);
      } else if (filtro?.destroy) {
        filtro.destroy();
      }
    } else {
      if (alvo?.active) alvo.clearMask(false);
      if (geometria?.destroy) geometria.destroy();
    }
    if (mascaraGraphics?.active) mascaraGraphics.destroy();
  }

  desenharAtmosferaTatica() {
    if (!this.atmosferaTatica) {
      const fundo = this.add.graphics().setDepth(-98);
      fundo.fillStyle(0x050b22, 0.32);
      fundo.fillRect(0, 0, LARGURA_LAYOUT, ALTURA_LAYOUT);
      this.atmosferaTatica = fundo;
    } else {
      this.children.add(this.atmosferaTatica);
    }
    this.atmosferaTatica.setDepth(-98);
    return this.atmosferaTatica;
  }

  desenharTimerTurno() {
    const largura = 430;
    const altura = 98;
    const x = this.multiplayer?.presentation ? LARGURA_LAYOUT / 2 : LARGURA_LAYOUT - 380;
    const y = this.multiplayer?.presentation ? 84 : 84 + DESLOCAMENTO_GUI_Y;

    const fundo = this.multiplayer?.presentation
      ? this.criarSuperficieVidro(0, 0, largura, altura)
      : this.criarPlacaDuelo(0, 0, largura, altura);
    const halo = this.add.circle(-largura / 2 + 23, -19, 5, 0x54ddff, 1);
    const label = this.criarTextoUI(-largura / 2 + 40, -20, "Sua vez", {
      fontSize: "24px",
      color: "#d7efdf",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    const tempo = this.criarTextoUI(
      largura / 2 - 26,
      -18,
      this.formatarTempoTurno(),
      {
        fontSize: "42px",
        color: "#f3fcf6",
        fontStyle: "bold",
        fontFamily: "Arial, sans-serif",
      },
    ).setOrigin(1, 0.5);
    const estado = this.criarTextoUI(-largura / 2 + 30, 12, "Seu turno", {
      fontSize: "19px",
      color: "#54ddff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    const trilho = this.add
      .rectangle(-largura / 2 + 30, 34, largura - 60, 7, 0x172941, 1)
      .setOrigin(0, 0.5);
    const barra = this.add
      .rectangle(-largura / 2 + 30, 34, largura - 60, 7, 0x54ddff, 1)
      .setOrigin(0, 0.5);

    const container = this.add.container(x, y, [
      fundo,
      halo,
      label,
      tempo,
      estado,
      trilho,
      barra,
    ]);
    container.setDepth(190);
    if (!this.multiplayer?.presentation) container.add(this.criarTextoUI(
      0, -65, `TURNO ${this.partida.turno} / ${this.partida.maxTurnos}`,
      { fontSize: "24px", color: "#dceaff", fontStyle: "bold" },
    ).setOrigin(0.5));

    this.timerContainer = container;
    this.timerTexto = tempo;
    this.timerEstadoTexto = estado;
    this.timerLabelTexto = label;
    this.timerBarra = barra;
    this.timerHalo = halo;
    this.timerUltimoSegundo = null;
    this.timerUltimoEstado = null;
    this.atualizarVisualTimerTurno(true);
  }

  atualizarVisualTimerTurno(forcar = false) {
    if (!this.timerContainer?.active || !this.timerTexto?.active) return;
    if (this.training) {
      this.timerTexto.setText("∞");
      this.timerEstadoTexto.setText("Treino sem limite");
      this.timerLabelTexto.setText(this.faseAtual === "habilidades" ? "Habilidades" : "Colocar cartas");
      return;
    }

    if (this.multiplayer?.presentation) {
      const player = this.multiplayer.activePlayer;
      const name = player === 1 ? this.multiplayer.localNickname : this.multiplayer.opponentNickname;
      this.timerContainer.setPosition(LARGURA_LAYOUT / 2, player === 1 ? ALTURA_LAYOUT - 84 : 84);
      this.timerContainer.setAngle(player === 2 ? 180 : 0);
      this.timerLabelTexto.setText(this.faseAtual === "habilidades" ? "Habilidades" : "Colocar cartas");
      this.timerEstadoTexto.setText(`Vez de ${String(name || `Jogador ${player}`).slice(0, 32)}`);
      this.timerTexto.setText(this.formatarTempoTurno());
      this.timerBarra.displayWidth = 370 * Phaser.Math.Clamp(this.multiplayer.remainingMs() / this.duracaoPermitidaPara(this.partida[player === 1 ? "jogador" : "inimigo"]), 0, 1);
      return;
    }
    const tempoExibido = this.tempoExibidoTimerTurno();
    const segundo = Math.max(0, Math.ceil(tempoExibido / 1000));
    const estado = this.estadoTimerTurno();
    if (
      !forcar &&
      segundo === this.timerUltimoSegundo &&
      estado === this.timerUltimoEstado
    )
      return;

    this.timerUltimoSegundo = segundo;
    this.timerUltimoEstado = estado;
    this.timerTexto.setText(this.formatarTempoTurno());
    const duracaoExibida = this.ehMeuTurno
      ? this.duracaoTurnoAtual
      : this.duracaoTurnoOponenteAtual;
    this.timerBarra.displayWidth =
      370 * Phaser.Math.Clamp(tempoExibido / duracaoExibida, 0, 1);

    const emContagem = estado === "ativo" || estado === "oponente";
    const critico = segundo <= 10 && emContagem;
    const atencao = segundo <= 30 && emContagem;
    const cor =
      critico || estado === "esgotado"
        ? 0xff93a4
        : atencao
          ? 0xf3cd91
          : estado === "oponente"
            ? 0xffb3bf
            : estado === "ativo"
              ? 0x54ddff
              : 0xa3c8ed;
    const corCss = `#${cor.toString(16).padStart(6, "0")}`;
    const rotulo = {
      ativo: critico ? "Tempo acabando" : "Sua vez",
      pausado: "Em pausa",
      animacao: "Efeitos • tempo pausado",
      enviando: "Confirmando jogada…",
      oponente: segundo === 0 ? "Tempo esgotado" : "Vez do oponente",
      esgotado: "Tempo esgotado",
    }[estado];

    this.timerLabelTexto?.setText(
      this.faseAtual === "habilidades" ? "Habilidades" : "Colocar cartas",
    );
    this.timerBarra.setFillStyle(cor, 1);
    this.timerTexto.setColor(corCss);
    this.timerEstadoTexto.setText(rotulo).setColor(corCss);
    this.timerHalo.setFillStyle(cor, critico && segundo % 2 === 0 ? 0.45 : 1);

    if (
      this.multiplayerAtivo &&
      this.ehMeuTurno &&
      !this.aplicandoEstadoRemoto
    ) {
      this.multiplayer.sendTurnTime(
        this.tempoRestanteTurno,
        estado === "ativo",
      );
    }
  }

  desenharInterface() {
    // Atualizações após a desistência não podem apagar o resultado já exibido.
    if (this.telaFinalExibida) return;
    // O estado continua sincronizado; o campo será redesenhado ao terminar a leitura.
    if (this.painelDetalheAtual?.active) {
      this.redesenhoAposLeitura = true;
      return;
    }
    this.redesenhoAposLeitura = false;
    this.limparCamadaModalCarta();
    this.partida.atualizarOverrides();
    const chavesCampoAtuais = new Set(
      [
        ...this.partida.jogador.campo.cartas,
        ...this.partida.inimigo.campo.cartas,
      ]
        .filter(Boolean)
        .map((carta) => this.chaveCartaMultiplayer(carta)),
    );
    this.chavesCampoNovasRender = new Set(
      [...chavesCampoAtuais].filter(
        (chave) => !this.chavesCampoRenderAnterior.has(chave),
      ),
    );
    this.renderizandoInterface = true;

    // Cancela tweens e textos de resultado antes de destruir os objetos.
    this.tweens.killAll();
    // Uma atualização durante o fade inicial não pode deixar o campo transparente.
    if (this.interfaceJaDesenhada) this.cameras.main.setAlpha(1);
    if (this.textoResultadoAtual) {
      this.textoResultadoAtual.destroy();
      this.textoResultadoAtual = null;
    }

    // Desanexa o vídeo sem destruí-lo para preservar a reprodução.
    if (this.videoFundo) this.children.remove(this.videoFundo, false);
    // A camada de contraste não depende do estado da partida.
    if (this.atmosferaTatica) this.children.remove(this.atmosferaTatica, false);
    if (this.baseCampo) this.children.remove(this.baseCampo, false);

    // Destrói os objetos antigos para remover áreas de toque invisíveis.
    if (this.avisoBatalhaTexto?.active) this.children.remove(this.avisoBatalhaTexto, false);
    this.children.removeAll(true);
    if (this.avisoBatalhaTexto?.active) this.children.add(this.avisoBatalhaTexto);
    this.cartaMaoSelecionada = null;

    // Limpa referências aos controles destruídos.
    this.rodaBotoesContainer = null;
    this.rodaOpcoesContainer = null;
    this.timerContainer = null;
    this.timerTexto = null;
    this.timerEstadoTexto = null;
    this.timerLabelTexto = null;
    this.timerBarra = null;
    this.timerHalo = null;

    // Se a interface for redesenhada, qualquer modal antigo perde a validade (os objetos já foram destruídos por removeAll acima)
    this.modalAberto = false;
    this.painelDetalheAtual = null;
    this.overlayDetalheAtual = null;
    this.mascaraDetalheAtual = null;
    this.zoomAberto = false;
    this.painelZoomAtual = null;
    this.overlayZoomAtual = null;
    this.zoomBloqueadoAte = 0;
    if (this.handlerTiltZoomAtual) {
      this.input.off("pointermove", this.handlerTiltZoomAtual);
      this.handlerTiltZoomAtual = null;
    }
    this.limparEventosDescricao();
    this.historicoAberto = false;
    this.painelHistoricoAtual = null;
    this.overlayHistoricoAtual = null;
    this.listaHistoricoContainer = null;
    this.labelPaginaHistorico = null;
    this.btnAnteriorHistorico = null;
    this.btnProximaHistorico = null;

    this.layout = this.maoEscondida
      ? LAYOUT_CAMPO_AMPLIADO
      : LAYOUT_CAMPO_NORMAL;

    this.desenharStatus();
    this.desenharMaoInimigo();
    this.desenharBaseCampo();
    this.desenharCampoInimigo();
    this.desenharCampoJogador();
    this.desenharIndicadoresPoder();
    this.desenharIndicadoresDeck();
    this.desenharFundoJogo();
    this.desenharAtmosferaTatica();
    this.desenharTimerTurno();
    if (!this.maoEscondida) this.desenharMaoEmLeque();

    // Desenha o menu somente quando a interação está liberada.
    if (!this.travado) this.desenharRodaBotoes();

    if (this.multiplayer?.spectator && !this.multiplayer?.presentation) {
      this.add
        .text(LARGURA_LAYOUT / 2, ALTURA_LAYOUT - 65, "SAIR DA ESPECTAÇÃO", {
          fontSize: "28px",
          color: "#ffffff",
          backgroundColor: "#1b2440",
          padding: { x: 18, y: 12 },
        })
        .setOrigin(0.5)
        .setDepth(4900)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          this.multiplayer.leaveRoom();
          this.scene.start("CenaTitulo");
        });
    }
    this.configurarGestosMao();
    this.chavesCampoRenderAnterior = chavesCampoAtuais;
    this.interfaceJaDesenhada = true;
    this.renderizandoInterface = false;
    this.atualizarInteracaoDuranteEfeitos();
    if (this.multiplayerAtivo && !this.aplicandoEstadoRemoto)
      this.multiplayer.sendLiveState(this.partida);
  }

  // Mostra as costas das cartas na mão do inimigo, no topo da tela — só pra dar noção visual de quantas cartas ele tem (não revela quais são).
  desenharMaoInimigo(lado = "inimigo") {
    if (this.multiplayer?.presentation) return;
    const cartasMao = this.partida[lado].mao.cartas;
    const total = cartasMao.length;
    if (total === 0) return;

    // Nexus de Dados Global: enquanto esse terreno estiver no campo do jogador, a mão do inimigo fica revelada.
    const revelada =
      !this.multiplayer?.spectator &&
      this.partida.maoRevelada(this.partida.jogador);

    const centroY = lado === "jogador" ? Y_MAO_JOGADOR : Y_MAO_INIMIGO;
    const larguraCarta = 140;
    const alturaCarta = 200;
    const espacamentoMax = 60;
    const espacamentoMin = 26;
    const espacamento =
      total <= 8
        ? espacamentoMax
        : Math.max(espacamentoMin, espacamentoMax - (total - 8) * 5);
    const centroX = lado === "jogador"
      ? LARGURA_LAYOUT / 2
      : LARGURA_LAYOUT * 0.62;

    cartasMao.forEach((carta, indice) => {
      const offset = indice - (total - 1) / 2;
      const posX = centroX + offset * espacamento;
      const posY = centroY - Math.pow(offset, 2) * 4;
      const angulo = offset * 1.2;

      let sombra = this.add.rectangle(
        5,
        8,
        larguraCarta,
        alturaCarta,
        0x000000,
        0.3,
      );

      if (!revelada) {
        let costas = this.add
          .image(0, 0, "fundoCarta")
          .setDisplaySize(larguraCarta, alturaCarta);
        let container = this.add.container(posX, posY, [sombra, costas]);
        container.setAngle(angulo);
        container.setDepth(-99);
        container.maoOcultaLado = lado;
        return;
      }

      // Carta revelada: mesma lógica visual do leque do jogador
      const corFundo = this.obterCorPorId(carta.id);
      const ehEfeito = carta.tipo === "efeito";
      const ehTerreno = carta.tipo === "terreno";

      let fundoCarta = carta.imagem
        ? this.add
            .image(0, 0, carta.imagem)
            .setDisplaySize(larguraCarta, alturaCarta)
        : this.add.rectangle(0, 0, larguraCarta, alturaCarta, corFundo);
      let borda = this.add
        .rectangle(0, 0, larguraCarta, alturaCarta)
        .setStrokeStyle(3, 0xffffff);
      let nomeTexto = this.add
        .text(0, -larguraCarta / 2 + 4, this.truncarTexto(carta.nome, 10), {
          fontSize: "15px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: larguraCarta - 10 },
        })
        .setOrigin(0.5, 0);

      const filhos = [sombra, fundoCarta, borda, nomeTexto];

      if (!ehEfeito && !ehTerreno) {
        const [poderBola, poderTexto] = this.criarSeloEstat(
          0,
          alturaCarta / 2 - 20,
          carta.poder,
          "#ff5555",
          16,
        );
        filhos.push(poderBola, poderTexto);
      } else if (ehEfeito) {
        let iconeSelo = this.add
          .text(0, alturaCarta / 2 - 20, "⚡", { fontSize: "20px" })
          .setOrigin(0.5);
        filhos.push(iconeSelo);
      } else if (ehTerreno) {
        let iconeSelo = this.add
          .text(0, alturaCarta / 2 - 20, "⛰", { fontSize: "20px" })
          .setOrigin(0.5);
        filhos.push(iconeSelo);
      }

      let container = this.add.container(posX, posY, filhos);

      // Ajustes para o Leque Inimigo Interativo:
      container.setSize(larguraCarta, alturaCarta);
      container.setAngle(angulo);

      // Controla a profundidade baseada no índice para que as cartas se sobreponham corretamente, assim como no leque original.
      container.depthBase = 10 + indice;
      container.setDepth(container.depthBase);

      container.setInteractive({ useHandCursor: true });

      // Eventos de animação parecidos com o "desenharMaoEmLeque"
      container.on("pointerover", (pointer) => {
        if (!this.podeConsultarCartas()) return;
        this.tweens.killTweensOf(container);
        container.setDepth(1000);
        this.tweens.add({
          targets: container,
          y: posY + 40, // Puxa a carta ligeiramente para baixo ao invés de para cima
          angle: 0,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 150,
          ease: "Back.Out",
          onComplete: () => {
            if (!this.travado && this.somHover) {
              this.somHover.play();
            }
          },
        });
      });

      container.on("pointerout", () => {
        if (!this.podeConsultarCartas()) return;
        this.tweens.killTweensOf(container);
        this.tweens.add({
          targets: container,
          x: posX,
          y: posY,
          angle: angulo,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: "Sine.easeOut",
          onComplete: () => {
            if (container && container.active) {
              container.setDepth(container.depthBase);
            }
          },
        });
      });

      // Abre a ficha detalhada ao clicar/tocar
      container.on("pointerup", () => {
        if (!this.podeConsultarCartas()) return;
        this.mostrarDetalheCarta(carta);
      });
    });
  }

  // Indicador de quantas cartas restam em cada deck (o do jogador, perto da mão dele embaixo; o do inimigo, perto da mão dele em cima).
  desenharIndicadoresDeck() {
    if (this.multiplayer?.presentation) return;
    this.criarIndicadorDeck(
      85,
      this.layout.yJogadorTras + this.layout.slotH / 2 + 140,
      this.partida.jogador.deck.cartas.length,
      "Deck",
    );
    this.criarIndicadorDeck(
      85,
      292 + DESLOCAMENTO_GUI_Y,
      this.partida.inimigo.deck.cartas.length,
      "Deck",
    );
  }

  criarIndicadorDeck(x, y, quantidade, label) {
    const cartas = [8, 4, 0].map(offset => this.add.image(offset, -offset, "fundoCarta")
      .setDisplaySize(100, 138));
    const placa = this.add.container(x, y, cartas);
    const contador = this.criarPlacaDuelo(0, 45, 92, 55);
    const numero = this.criarTextoUI(0, 45, String(quantidade), {
      fontSize: "36px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const rotulo = this.criarTextoUI(70, 0, label.toLocaleUpperCase("pt-BR"), {
      fontSize: "21px",
      color: "#dceaff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    placa.add([contador, numero, rotulo]);
  }

  // LÓGICA DE ARRASTAR E SOLTAR

  tratarSoltarCarta(gameObject, ponto = gameObject) {
    if (!this.podeJogarCartasAgora()) {
      this.animarRetornoAoLeque(gameObject, false);
      return;
    }
    const carta = gameObject.dadosCarta;
    if (this.faseAtual === "habilidades" && carta?.tipo !== "efeito") {
      this.animarRetornoAoLeque(gameObject, false);
      return;
    }

    // Confirma nos dados que a carta ainda pertence à mão.
    if (!carta || !this.partida.jogador.mao.cartas.includes(carta)) {
      gameObject.destroy();
      return;
    }

    // Efeitos podem ser soltos em qualquer ponto da arena após iniciar o arraste.
    if (carta.tipo === "efeito") {
      this.tratarSoltarCartaEfeito(gameObject, carta);
      return;
    }

    let slots = this.children.list.filter((child) => child.isSlot);
    let slotAtingido = null;

    // Usa o centro da carta para evitar colisão com dois slots vizinhos.
    slots.forEach((slot, index) => {
      if (Phaser.Geom.Rectangle.Contains(slot.getBounds(), ponto.x, ponto.y)) {
        slotAtingido = index;
      }
    });

    // Soltou fora da área de jogo: volta pro leque normalmente
    if (slotAtingido === null) {
      this.animarRetornoAoLeque(gameObject, false);
      return;
    }

    if (this.training && !this.training.canPlace(carta, slotAtingido)) {
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    // Cartas de monstro: comportamento original, vão para o campo
    const temEspaco = this.partida.jogador.campo.temEspaco(slotAtingido);
    this.somJogarCarta.play();

    if (!temEspaco) {
      this.animarRetornoAoLeque(gameObject, true);
      this.cameras.main.shake(150, 0.002);
      return;
    }

    this.travado = true;
    const slotObj = slots[slotAtingido];

    this.tweens.killTweensOf(gameObject);
    this.tweens.add({
      targets: gameObject,
      x: slotObj.x,
      y: slotObj.y,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Cubic.Out",
      onComplete: () => {
        if (!this.podeJogarCartasAgora()) return;
        // Invoca primeiro e aplica o buff após a escolha do aliado.
        const precisaEscolherAlvo =
          carta.efeito &&
          (carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO ||
            carta.efeito.tipo === TIPOS_EFEITO.VINCULO_ALIADO) &&
          !carta.habilidadeAtiva;

        // RaspClay permite selecionar várias aliadas antes de confirmar.
        const precisaEscolherAlvosAbsorcao =
          carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.ABSORVER_ALIADOS;

        if (precisaEscolherAlvo || precisaEscolherAlvosAbsorcao) {
          const sucesso = this.partida.colocarCartaDoJogador(
            carta,
            slotAtingido,
          );
          this.desenharInterface();
          if (sucesso) {
            if (!window.CenaEfeitos) this.somRaspClay.play();
            const continuarInvocacao = () => {
              if (precisaEscolherAlvosAbsorcao) {
                this.iniciarSelecaoDeAbsorcao(carta, slotAtingido);
              } else {
                this.iniciarSelecaoDeAliadoParaBuff(carta, slotAtingido);
              }
            };
            if (!this.reproduzirEfeitoInvocacao(carta, continuarInvocacao))
              continuarInvocacao();
          } else {
            this.travado = false;
          }
          return;
        }

        this.partida.jogarCartaDoJogador(carta, slotAtingido);
        this.travado = false;
        this.desenharInterface();
        this.training?.placed(carta);
        // Mostra as cartas reveladas por Faro nesta invocação.
        if (carta.efeito?.tipo === TIPOS_EFEITO.REVELAR_CARTAS_INIMIGO) {
          this.mostrarRevelacaoFaro(this.partida.ultimaRevelacaoFaro || []);
        }
      },
    });
  }

  tratarSoltarCartaEfeito(gameObject, carta) {
    if (carta.efeito?.tipo === TIPOS_EFEITO.BUSCAR_CARTA_DECK) {
      this.iniciarSelecaoDeCartaDoBaralho(gameObject, carta);
      return;
    }
    if (carta.efeito?.tipo === TIPOS_EFEITO.RECICLAR_DESCARTE) {
      this.iniciarSelecaoDeCartaDoBaralho(gameObject, carta, "descarte");
      return;
    }
    if (carta.efeito?.tipo === TIPOS_EFEITO.REMOVER_TERRENO) {
      const alvos = this.partida.inimigo.campo.cartas
        .map((alvo, indice) => (alvo?.tipo === "terreno" ? indice : null))
        .filter((indice) => indice !== null);
      if (!alvos.length) {
        this.animarRetornoAoLeque(gameObject, true);
        return;
      }
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        "Escolha um terreno inimigo para remover",
        (indice) => {
          this.cancelarSelecaoDeAlvo();
          this.conjurarCartaDeEfeitoJogador(gameObject, carta, indice);
        },
        () => this.animarRetornoAoLeque(gameObject, false),
      );
      return;
    }
    if (
      carta.efeito?.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO &&
      carta.efeito.exigeAlvoIsolado
    ) {
      this.iniciarSelecaoDeAliadoIsolado(gameObject, carta);
      return;
    }
    if (carta.efeito?.tipo === TIPOS_EFEITO.ATACAR_COLUNA) {
      this.iniciarSelecaoDeColunaInimiga(gameObject, carta);
      return;
    }
    if (carta.efeito?.tipo === TIPOS_EFEITO.BUFF_DOIS_ALIADOS) {
      this.iniciarSelecaoDoCantoDoGalo(gameObject, carta);
      return;
    }
    if (carta.efeito?.tipo === TIPOS_EFEITO.ARMADILHA_ESPACO) {
      this.iniciarSelecaoDeArmadilha(gameObject, carta);
      return;
    }
    this.conjurarCartaDeEfeitoJogador(gameObject, carta);
    this.somPop.play();
  }

  // Faro (O Cão): painel dedicado com arte, nome, nível, tipo e PA de cada carta farejada. Permanece aberto até o jogador confirmar.
  mostrarRevelacaoFaro(cartas) {
    this.travado = true;
    const objetos = [];
    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.82,
      )
      .setDepth(4000)
      .setInteractive();
    const painel = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        900,
        1240,
        0x14141c,
        0.98,
      )
      .setStrokeStyle(8, 0xffd166)
      .setDepth(4001);
    objetos.push(overlay, painel);

    objetos.push(
      this.add
        .text(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2 - 560, "🐕  FARO DO CÃO", {
          fontSize: "48px",
          color: "#ffe08a",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(4002),
    );

    if (!cartas.length) {
      objetos.push(
        this.add
          .text(
            LARGURA_LAYOUT / 2,
            ALTURA_LAYOUT / 2,
            "O inimigo não possui cartas para farejar.",
            {
              fontSize: "32px",
              color: "#dddddd",
            },
          )
          .setOrigin(0.5)
          .setDepth(4002),
      );
    }

    cartas.forEach((carta, i) => {
      const y = ALTURA_LAYOUT / 2 - 420 + i * 190;
      const fundoLinha = this.add
        .rectangle(LARGURA_LAYOUT / 2, y, 780, 160, 0x252538, 0.95)
        .setStrokeStyle(3, 0x6b6b88)
        .setDepth(4002);
      const arte = carta.imagem
        ? this.add
            .image(LARGURA_LAYOUT / 2 - 315, y, carta.imagem)
            .setDisplaySize(100, 140)
        : this.add.rectangle(LARGURA_LAYOUT / 2 - 315, y, 100, 140, 0x444466);
      arte.setDepth(4003);
      const nivel = (carta.nivel || carta.tipo).toUpperCase();
      const texto = this.add
        .text(
          LARGURA_LAYOUT / 2 - 235,
          y - 48,
          `${carta.nome}\n${nivel}${carta.tipo === "monstro" ? `  •  ${carta.poder} PA` : ""}`,
          {
            fontSize: "28px",
            color: "#ffffff",
            fontStyle: "bold",
            lineSpacing: 12,
            wordWrap: { width: 560 },
          },
        )
        .setOrigin(0, 0)
        .setDepth(4003);
      objetos.push(fundoLinha, arte, texto);
    });

    const fechar = () => {
      objetos.forEach((o) => o.destroy());
      this.travado = false;
      this.desenharInterface();
    };
    const btn = this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2 + 545,
      "Entendido",
      0x665522,
      fechar,
    ).setDepth(4004);
    objetos.push(btn);
  }

  animarRetornoAoLeque(gameObject, comErro) {
    this.travado = true;
    const destino = gameObject.posOriginal;

    this.tweens.killTweensOf(gameObject);
    this.tweens.add({
      targets: gameObject,
      x: destino.x,
      y: destino.y,
      angle: destino.angle,
      scaleX: 1,
      scaleY: 1,
      duration: comErro ? 340 : 240,
      ease: comErro ? "Elastic.Out" : "Back.Out",
      onComplete: () => {
        // Restaura a profundidade da carta no leque após o arraste.
        gameObject.setDepth(gameObject.depthBase);
        this.travado = false;
      },
    });
  }

  // Anima a conjuração, aplica o efeito e depois redesenha o campo.
  conjurarCartaDeEfeitoJogador(gameObject, carta, alvoEscolhido = null) {
    if (!this.podeJogarCartasAgora()) return;
    if (window.CenaEfeitos) {
      const resultado = this.partida.jogarCartaEfeitoDoJogador(carta, alvoEscolhido);
      if (!resultado.sucesso) return;
      gameObject.destroy();
      this.travado = false;
      this.desenharInterface();
      this.apresentarEventosEfeito();
      return;
    }
    this.travado = true;
    this.esconderRodaBotoes();
    this.tweens.killTweensOf(gameObject);
    gameObject.setDepth(3500);

    this.tweens.add({
      targets: gameObject,
      x: LARGURA_LAYOUT / 2,
      y: ALTURA_LAYOUT / 2,
      angle: 0,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 260,
      ease: "Back.Out",
      onComplete: () => {
        if (!this.podeJogarCartasAgora()) return;
        const resultado = this.partida.jogarCartaEfeitoDoJogador(
          carta,
          alvoEscolhido,
        );

        // Pulso no instante em que o efeito é aplicado
        this.tweens.add({
          targets: gameObject,
          scaleX: 2.4,
          scaleY: 2.4,
          duration: 130,
          yoyo: true,
          ease: "Sine.easeInOut",
          onComplete: () => {
            this.tweens.add({
              targets: gameObject,
              alpha: 0,
              scaleX: 0.6,
              scaleY: 0.6,
              duration: 260,
              delay: 100,
              ease: "Sine.easeIn",
              onComplete: () => {
                gameObject.destroy();
                this.processarCartasAfetadas(resultado.afetadas, () => {
                  this.travado = false;
                  this.desenharInterface();
                });
              },
            });
          },
        });
      },
    });
  }

  // Cria uma carta temporária para animar a conjuração da IA.
  conjurarCartaDeEfeitoInimigo(
    carta,
    aoConcluir,
    textoRotulo = "O inimigo conjurou:",
  ) {
    const corFundo = this.obterCorPorId(carta.id);

    let rotulo = this.add
      .text(0, -285, textoRotulo, {
        fontSize: "26px",
        color: "#ff8888",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let sombra = this.add.rectangle(8, 10, 260, 340, 0x000000, 0.4);
    let fundo = carta.imagem
      ? this.add.image(0, 0, carta.imagem).setDisplaySize(260, 340)
      : this.add.rectangle(0, 0, 260, 340, corFundo);
    let moldura = this.add
      .rectangle(0, 0, 260, 340)
      .setStrokeStyle(6, 0xff4444);
    let nomeTexto = this.add
      .text(0, -95, carta.nome, {
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5);
    let iconeTexto = carta.imagem
      ? null
      : this.add.text(0, 60, "⚡", { fontSize: "70px" }).setOrigin(0.5);

    let container = this.add.container(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      [rotulo, sombra, fundo, moldura, nomeTexto, iconeTexto].filter(Boolean),
    );
    container.setDepth(3500);
    container.setScale(0.3);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 130,
          yoyo: true,
          delay: 200,
          ease: "Sine.easeInOut",
          onComplete: () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              scale: 0.6,
              duration: 260,
              delay: 100,
              ease: "Sine.easeIn",
              onComplete: () => {
                container.destroy();
                aoConcluir();
              },
            });
          },
        });
      },
    });
  }

  // Anima dano ou bônus; espera a entrada somente das cartas novas.
  animarCartasAfetadas(afetadas) {
    if (!afetadas || afetadas.length === 0) return;

    const temCartaEntrando = afetadas.some(({ carta }) =>
      this.chavesCampoNovasRender.has(this.chaveCartaMultiplayer(carta)),
    );
    const atraso = temCartaEntrando ? 320 : 0;
    this.time.delayedCall(atraso, () => {
      afetadas.forEach(({ carta: cartaAfetada, delta }) => {
        const alvo = this.children.list.find(
          (c) => c.dadosCartaCampo === cartaAfetada,
        );
        if (!alvo) return;
        // Delta negativo anima dano; positivo anima bônus; zero não anima.
        if (delta < 0) this.animarDanoCarta(alvo, delta);
        else if (delta > 0) this.animarBuffCarta(alvo, delta);
      });
    });
  }

  // Anima as mortes antes do redesenho e os bônus depois.
  processarCartasAfetadas(afetadas, redesenharFn) {
    // A camada de eventos já anima os alvos e as remoções, inclusive as garras do Tigre.
    if (window.CenaEfeitos) { redesenharFn(); return; }
    afetadas = [...(afetadas || [])];
    const campo = [
      ...this.partida.jogador.campo.cartas,
      ...this.partida.inimigo.campo.cartas,
    ];
    this.children.list.forEach((objeto) => {
      const carta = objeto.dadosCartaCampo;
      if (
        carta?.efeito?.tipo === TIPOS_EFEITO.VINCULO_ALIADO &&
        !campo.includes(carta) &&
        !afetadas.some((e) => e.carta === carta)
      )
        afetadas.push({ carta, delta: 0, removida: true });
    });
    if (!afetadas || afetadas.length === 0) {
      redesenharFn();
      return;
    }

    const mortas = afetadas.filter(
      ({ carta, removida }) => removida || carta.poder <= 0,
    );
    const vivas = afetadas.filter(
      ({ carta, removida }) => !removida && carta.poder > 0,
    );

    if (mortas.length === 0) {
      redesenharFn();
      this.animarCartasAfetadas(vivas);
      return;
    }

    let pendentes = mortas.length;
    const prosseguir = () => {
      pendentes--;
      if (pendentes > 0) return;
      redesenharFn();
      this.animarCartasAfetadas(vivas);
    };

    mortas.forEach(({ carta }) => {
      const alvo = this.children.list.find((c) => c.dadosCartaCampo === carta);
      if (alvo) this.animarMorteCarta(alvo, prosseguir);
      else prosseguir();
    });
  }

  // Anima dano com rasgo vermelho, tremor e número flutuante.
  animarDanoCarta(containerCampo, delta) {
    if (!containerCampo || !containerCampo.active) return;
    this.tweens.killTweensOf(containerCampo);
    containerCampo.setScale(1);
    containerCampo.setAngle(0);

    const rasgo = this.add.graphics().setDepth(3599);
    rasgo.setPosition(containerCampo.x, containerCampo.y);
    rasgo.lineStyle(10, 0xff2222, 0.95);
    rasgo.beginPath();
    rasgo.moveTo(-95, -125);
    rasgo.lineTo(95, 125);
    rasgo.strokePath();
    rasgo.lineStyle(5, 0xffcccc, 0.8);
    rasgo.beginPath();
    rasgo.moveTo(-95, -125);
    rasgo.lineTo(95, 125);
    rasgo.strokePath();
    rasgo.setAlpha(0);
    rasgo.setScale(0.55, 0.55);

    this.tweens.add({
      targets: rasgo,
      alpha: 1,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 80,
      ease: "Cubic.Out",
      onComplete: () => {
        this.tweens.add({
          targets: rasgo,
          alpha: 0,
          duration: 220,
          delay: 70,
          onComplete: () => rasgo.destroy(),
        });
      },
    });

    let texto = this.add
      .text(containerCampo.x, containerCampo.y - 170, `${delta}`, {
        fontSize: "46px",
        color: "#ff2222",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(3600)
      .setAlpha(0)
      .setScale(1.4)
      .setAngle(-8);

    this.tweens.add({
      targets: texto,
      alpha: 1,
      scale: 1,
      angle: 0,
      y: containerCampo.y - 260,
      duration: 550,
      ease: "Cubic.Out",
      onComplete: () => texto.destroy(),
    });
    this.tweens.add({ targets: texto, alpha: 0, delay: 320, duration: 230 });

    // Tremor brusco (bem diferente do pulso suave do buff)
    this.tweens.add({
      targets: containerCampo,
      x: containerCampo.x - 10,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: containerCampo,
      scaleX: 0.9,
      scaleY: 1.06,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeInOut",
    });

    if (this.somBuff) this.somBuff.play();
    this.cameras.main.shake(90, 0.004);
  }

  // Anima a morte antes de remover a carta do campo.

  animarMorteCyberPolitico(container, concluir) {
    this.tweens.killTweensOf(container);
    const { x, y } = container;
    const selo = this.add
      .text(x, y, "CONTRATO\nROMPIDO", {
        fontSize: "28px",
        color: "#ffbbff",
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#301040",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(4500)
      .setAngle(-12)
      .setAlpha(0);
    this.tweens.add({
      targets: selo,
      alpha: 1,
      duration: 180,
      yoyo: true,
      hold: 450,
    });
    for (let i = 0; i < 12; i++) {
      const papel = this.add
        .rectangle(x, y, 14 + (i % 3) * 4, 26, i % 2 ? 0xf3d9ff : 0xb68cff)
        .setDepth(4499)
        .setAngle(i * 30);
      const angulo = (i * Math.PI) / 6;
      this.tweens.add({
        targets: papel,
        x: x + Math.cos(angulo) * 160,
        y: y + Math.sin(angulo) * 120 + 110,
        angle: i * 90,
        alpha: 0,
        scale: 0.3,
        duration: 850,
        delay: 180,
        ease: "Cubic.Out",
        onComplete: () => papel.destroy(),
      });
    }
    this.tweens.add({
      targets: container,
      angle: -8,
      duration: 70,
      yoyo: true,
      repeat: 2,
    });
    this.tweens.add({
      targets: container,
      y: y + 100,
      scaleX: 0.05,
      scaleY: 0.7,
      alpha: 0,
      duration: 550,
      delay: 350,
      ease: "Cubic.In",
      onComplete: () => {
        selo.destroy();
        container.destroy();
        concluir?.();
      },
    });
  }

  animarMorteCarta(containerCampo, aoConcluir) {
    if (!containerCampo || !containerCampo.active) {
      if (aoConcluir) aoConcluir();
      return;
    }

    if (
      containerCampo.dadosCartaCampo?.efeito?.tipo ===
      TIPOS_EFEITO.VINCULO_ALIADO
    ) {
      this.animarMorteCyberPolitico(containerCampo, aoConcluir);
      return;
    }
    // Cancela qualquer tween antigo que ainda esteja controlando a carta.
    this.tweens.killTweensOf(containerCampo);

    // Garante um estado visual válido.
    containerCampo.setVisible(true);
    containerCampo.setActive(true);
    containerCampo.setAlpha(1);
    containerCampo.setScale(1);
    containerCampo.setAngle(0);

    const cx = containerCampo.x;
    const cy = containerCampo.y;

    const CW = Math.max(1, containerCampo.width || 225);
    const CH = Math.max(1, containerCampo.height || 315);

    // IMPACTO

    this.cameras.main.shake(180, 0.008);

    if (this.somBuff) {
      try {
        this.somBuff.play();
      } catch (e) {
        console.warn("Erro ao tocar som de morte:", e);
      }
    }

    // FLASH VERMELHO

    const flash = this.add
      .rectangle(cx, cy, CW + 20, CH + 20, 0xff2222, 0.65)
      .setDepth(3900)
      .setAlpha(0);

    this.tweens.add({
      targets: flash,
      alpha: 0.65,
      duration: 50,
      yoyo: true,
      hold: 40,
      onComplete: () => {
        if (flash && flash.active) {
          flash.destroy();
        }
      },
    });

    // RACHADURA

    const rachadura = this.add.graphics().setDepth(3901);

    rachadura.setPosition(cx, cy);

    // Linha vermelha grossa.
    rachadura.lineStyle(12, 0xff2222, 1);

    rachadura.beginPath();

    rachadura.moveTo(-CW / 2, -CH / 2);

    rachadura.lineTo(CW / 2, CH / 2);

    rachadura.strokePath();

    // Linha branca interna.
    rachadura.lineStyle(4, 0xffffff, 0.95);

    rachadura.beginPath();

    rachadura.moveTo(-CW / 2, -CH / 2);

    rachadura.lineTo(CW / 2, CH / 2);

    rachadura.strokePath();

    rachadura.setAlpha(0);
    rachadura.setScale(0.65);

    this.tweens.add({
      targets: rachadura,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 90,
      ease: "Back.Out",
    });

    // TREME A CARTA

    this.tweens.add({
      targets: containerCampo,

      x: cx + 10,

      duration: 35,

      yoyo: true,

      repeat: 5,

      ease: "Sine.easeInOut",

      onComplete: () => {
        this._explodirCartaMorta(
          containerCampo,
          rachadura,
          cx,
          cy,
          CW,
          CH,
          aoConcluir,
        );
      },
    });
  }

  // Os cacos usam Graphics independentes da textura original.

  _explodirCartaMorta(
    containerOriginal,
    rachadura,
    cx,
    cy,
    CW,
    CH,
    aoConcluir,
  ) {
    // Remove a rachadura.
    if (rachadura && rachadura.active) {
      rachadura.destroy();
    }

    // ESCONDE A CARTA ORIGINAL

    containerOriginal.setVisible(false);
    containerOriginal.disableInteractive();

    // CRIA OS CACOS

    const pedacos = [];

    // Cores dos cacos.
    const cores = [0xff2222, 0xff4444, 0xff5555, 0xcc1111, 0xff7777];

    // DUAS GRANDES METADES

    const metadeA = this.add.graphics().setDepth(3700);

    metadeA.fillStyle(0xff4444, 1);

    metadeA.beginPath();

    metadeA.moveTo(cx - CW / 2, cy - CH / 2);

    metadeA.lineTo(cx + CW / 2, cy - CH / 2);

    metadeA.lineTo(cx + CW / 2, cy + CH / 2);

    metadeA.closePath();
    metadeA.fillPath();

    pedacos.push({
      obj: metadeA,
      dir: {
        x: 1,
        y: -0.35,
      },
      distancia: 220,
      giro: Phaser.Math.Between(35, 70),
      escala: 0.7,
    });

    const metadeB = this.add.graphics().setDepth(3700);

    metadeB.fillStyle(0xcc2222, 1);

    metadeB.beginPath();

    metadeB.moveTo(cx - CW / 2, cy - CH / 2);

    metadeB.lineTo(cx + CW / 2, cy + CH / 2);

    metadeB.lineTo(cx - CW / 2, cy + CH / 2);

    metadeB.closePath();
    metadeB.fillPath();

    pedacos.push({
      obj: metadeB,
      dir: {
        x: -1,
        y: 0.45,
      },
      distancia: 220,
      giro: Phaser.Math.Between(-70, -35),
      escala: 0.7,
    });

    // 12 CACOS MENORES

    const COLS = 4;
    const LINHAS = 3;

    const pecaW = CW / COLS;
    const pecaH = CH / LINHAS;

    for (let linha = 0; linha < LINHAS; linha++) {
      for (let coluna = 0; coluna < COLS; coluna++) {
        const centroX = cx - CW / 2 + pecaW * (coluna + 0.5);

        const centroY = cy - CH / 2 + pecaH * (linha + 0.5);

        const caco = this.add.graphics().setDepth(3701);

        const cor = cores[Phaser.Math.Between(0, cores.length - 1)];

        caco.fillStyle(cor, Phaser.Math.FloatBetween(0.75, 1));

        // Pequeno quadrado/retângulo irregular.
        const margemX = pecaW * 0.12;
        const margemY = pecaH * 0.12;

        caco.fillRect(
          centroX - pecaW / 2 + margemX,
          centroY - pecaH / 2 + margemY,
          pecaW - margemX * 2,
          pecaH - margemY * 2,
        );

        // Direção baseada na distância do centro.
        const dx = centroX - cx;
        const dy = centroY - cy;

        const distanciaCentro = Math.hypot(dx, dy) || 1;

        pedacos.push({
          obj: caco,

          dir: {
            x: dx / distanciaCentro,
            y: dy / distanciaCentro,
          },

          distancia: Phaser.Math.Between(120, 260),

          giro: Phaser.Math.Between(-220, 220),

          escala: Phaser.Math.FloatBetween(0.25, 0.65),
        });
      }
    }

    // EXPLOSÃO

    let pendentes = pedacos.length;

    if (pendentes === 0) {
      if (containerOriginal && containerOriginal.active) {
        containerOriginal.destroy();
      }

      if (aoConcluir) {
        aoConcluir();
      }

      return;
    }

    pedacos.forEach(({ obj, dir, distancia, giro, escala }) => {
      if (!obj || !obj.active) {
        pendentes--;

        return;
      }

      const destinoX = obj.x + dir.x * distancia;

      const destinoY = obj.y + dir.y * distancia + Phaser.Math.Between(30, 100);

      this.tweens.add({
        targets: obj,

        x: destinoX,

        y: destinoY,

        angle: giro,

        alpha: 0,

        scaleX: escala,

        scaleY: escala,

        duration: Phaser.Math.Between(420, 620),

        delay: Phaser.Math.Between(0, 100),

        ease: "Cubic.In",

        onComplete: () => {
          if (obj && obj.active) {
            obj.destroy();
          }

          pendentes--;

          if (pendentes <= 0) {
            // Finalmente destrói a carta original.
            if (containerOriginal && containerOriginal.active) {
              containerOriginal.destroy();
            }

            // Continua o fluxo do combate.
            if (aoConcluir) {
              aoConcluir();
            }
          }
        },
      });
    });
  }
  fundoAnimadoAtivo() {
    return window.cyberduelSettings?.get("animatedBackground") !== 0;
  }

  definirFundoAnimado(ativo) {
    window.cyberduelSettings?.set("animatedBackground", ativo);
    this.desenharFundoJogo();
  }

  // Desativar destrói o vídeo para interromper a reprodução e liberar recursos.
  desenharFundoJogo() {
    if (!this.fundoAnimadoAtivo()) {
      this.videoFundo?.destroy();
      this.videoFundo = null;
      this.cameras.main.setBackgroundColor("#071f0f");
      return null;
    }
    const ajustarCover = (video, larguraNativa, alturaNativa) => {
      if (!video?.active || !larguraNativa || !alturaNativa) return;
      const escala = Math.max(
        LARGURA_LAYOUT / larguraNativa,
        ALTURA_LAYOUT / alturaNativa,
      );
      video
        .setPosition(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2)
        .setDisplaySize(larguraNativa * escala, alturaNativa * escala)
        .setVisible(true);
    };

    if (!this.fundoBatalha) {
      let anterior;
      try { anterior = window.sessionStorage?.getItem("cyberduel.ultimoFundoBatalha"); } catch {}
      const candidatos = ["videoParte3", "videoDeserto"].filter(chave => chave !== anterior);
      this.fundoBatalha = candidatos[Math.floor(Math.random() * candidatos.length)];
      try { window.sessionStorage?.setItem("cyberduel.ultimoFundoBatalha", this.fundoBatalha); } catch {}
    }
    if (!this.videoFundo) {
      this.videoFundo = this.add.video(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        this.fundoBatalha,
      );
      this.videoFundo.setOrigin(0.5);
      this.videoFundo.setVisible(false);
      this.videoFundo.setMute(true);
      this.videoFundo.once("created", (video, largura, altura) =>
        ajustarCover(video, largura, altura),
      );
      this.videoFundo.play(true);
    } else {
      this.children.addAt(this.videoFundo, 0);
      if (this.videoFundo.frameReady) {
        ajustarCover(
          this.videoFundo,
          this.videoFundo.width,
          this.videoFundo.height,
        );
      }
    }
    this.videoFundo.setDepth(-100);

    return this.videoFundo;
  }

  animarBuffCarta(containerCampo, delta) {
    // Cancela tweens antigos e restaura a escala antes do pulso.
    if (!containerCampo || !containerCampo.active) return;
    this.tweens.killTweensOf(containerCampo);
    containerCampo.setScale(1);

    const positivo = delta >= 0;
    const cor = positivo ? "#66ff99" : "#ff6666";

    let texto = this.add
      .text(
        containerCampo.x,
        containerCampo.y - 180,
        `${positivo ? "+" : ""}${delta}`,
        {
          fontSize: "40px",
          color: cor,
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3600)
      .setAlpha(0);

    this.tweens.add({
      targets: texto,
      alpha: 1,
      y: containerCampo.y - 270,
      duration: 700,
      ease: "Cubic.Out",
      onComplete: () => texto.destroy(),
    });

    this.tweens.add({
      targets: texto,
      alpha: 0,
      delay: 450,
      duration: 300,
    });

    this.tweens.add({
      targets: containerCampo,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 140,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
    this.somBuff.play();
  }

  // DESENHO DO CAMPO

  desenharBaseCampo() {
    if (this.baseCampo?.active && this.layoutBaseCampo === this.layout) {
      this.children.add(this.baseCampo);
      return;
    }
    this.baseCampo?.destroy();
    const L = this.layout;
    this.baseCampo = this.add.container(0, 0).setDepth(-1);
    this.layoutBaseCampo = L;
    for (const [fileiras, cor] of [[L.yInimigo, 0xff72af], [L.yJogador, 0x54ddff]]) {
      for (const y of fileiras) {
        for (const x of L.x) {
          this.baseCampo.add(this.criarMolduraCampo(x, y, L.slotW, L.slotH, cor));
        }
      }
    }
  }

  desenharCampoInimigo() {
    const L = this.layout;

    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];


      if (
        !this.multiplayer?.spectator &&
        this.partida.inimigo.campo.armadilhas.has(i)
      ) {
        this.criarIndicadorArmadilha(xPos, yPos, L);
      }

      let carta = this.partida.inimigo.campo.cartas[i];
      if (carta) {
        this.criarCartaDeCampo(
          xPos,
          yPos,
          carta,
          L,
          carta.ocultadaPelaToca && !carta.revelada,
          false,
        );
      }
    }
  }

  desenharCampoJogador() {
    const L = this.layout;

    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let slot = this.add.rectangle(xPos, yPos, L.slotW, L.slotH, 0x000000, 0);
      slot.isSlot = true; // Identificador para a colisão do Drag & Drop

      let carta = this.partida.jogador.campo.cartas[i];
      if (carta) {
        this.criarCartaDeCampo(
          xPos,
          yPos,
          carta,
          L,
          !!this.multiplayer?.spectator && carta.ocultadaPelaToca && !carta.revelada,
          !this.multiplayer?.spectator,
        );
      }
    }
  }

  atualizarAurasHabilidade() {
    for (const objeto of this.children.list) {
      if (!objeto.auraHabilidade) continue;
      const visivel = this.habilidadeDisponivelAgora(objeto.dadosCartaCampo);
      if (objeto.auraHabilidade.visible !== visivel)
        objeto.auraHabilidade.setVisible(visivel);
    }
  }

  habilidadeDisponivelAgora(carta) {
    if (this.training && (!carta || !this.training.canUse(carta))) return false;
    if (
      !this.podeUsarHabilidadesAgora() ||
      !carta?.habilidadeAtiva ||
      carta.usadaEsteTurno ||
      this.partida?.partidaEncerrada ||
      !this.ehMeuTurno ||
      !this.partida?.jogador.campo.cartas.includes(carta)
    )
      return false;

    const alvos = this.partida.alvosParaHabilidadeEmCampo(
      carta,
      this.partida.jogador,
      this.partida.inimigo,
    );
    if (!alvos.length) return false;

    if (carta.efeito?.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER) {
      const aliados = this.partida.jogador.campo.cartas
        .map((alvo, indice) =>
          alvo && alvo.tipo !== "terreno" ? indice : null,
        )
        .filter((indice) => indice !== null);
      return alvos.some((doador) => aliados.some((alvo) => alvo !== doador));
    }
    return true;
  }

  // Carta do campo com PA, animação de entrada e acesso à ficha.
  criarCartaDeCampo(
    xPos,
    yPos,
    carta,
    layout,
    viradaParaBaixo = false,
    podeInteragirOculta = false,
  ) {
    const L = layout || this.layout;
    const escala = L.slotH / 210; // 210 = altura base do slot no layout normal
    let corFundo = this.obterCorPorId(carta.id);
    const CW = Math.round(L.slotW * 0.926),
      CH = Math.round(L.slotH * 0.914); // um pouco menor que o slot, com respiro

    let sombra = this.add.rectangle(6, 8, CW, CH, 0x000000, 0.35);
    let brilho = this.add.rectangle(0, -CH / 2 + 3, CW - 10, 4, 0xffffff, 0.35);
    let nomeTexto = null;
    if (!carta.imagem && !viradaParaBaixo) {
      let nomeCurto = this.truncarTexto(carta.nome, 14);
      nomeTexto = this.add
        .text(0, Math.round(-58 * escala), nomeCurto, {
          fontSize: `${Math.round(20 * escala)}px`,
          color: "#fff",
          align: "center",
          wordWrap: { width: Math.round(150 * escala) },
        })
        .setOrigin(0.5, 0);
    }

    const [poderBola, poderTexto] =
      carta.tipo === "terreno" || viradaParaBaixo
        ? [null, null]
        : this.criarSeloEstat(
            0,
            Math.round(66 * escala),
            carta.poder,
            "#ff5555",
            Math.round(24 * escala),
            this.partida.inimigo.campo.cartas.includes(carta) ? 0xff63ad : 0x54ddff,
          );
    let fundo = viradaParaBaixo
      ? this.add.image(0, 0, "fundoCarta").setDisplaySize(CW, CH)
      : carta.imagem
        ? this.add.image(0, 0, carta.imagem).setDisplaySize(CW, CH)
        : this.add.rectangle(0, 0, CW, CH, corFundo);
    const filhos = [
      sombra,
      fundo,
      brilho,
      nomeTexto,
      poderBola,
      poderTexto,
    ].filter(Boolean);

    // A aura indica habilidade disponível com alvo válido.
    let auraHabilidade = null;
    if (
      podeInteragirOculta &&
      !viradaParaBaixo &&
      carta.habilidadeAtiva &&
      this.partida.jogador.campo.cartas.includes(carta)
    ) {
      auraHabilidade = this.add
        .rectangle(0, 0, CW + 14, CH + 14, 0x38f2a0, 0.035)
        .setStrokeStyle(6, 0x38f2a0, 0.82)
        .setVisible(this.habilidadeDisponivelAgora(carta));
      filhos.unshift(auraHabilidade);
    }

    // Selo indicando que é uma carta de efeito (a passiva já foi disparada ao entrar em campo — este selo é só um lembrete visual)
    if (carta.tipo === "efeito") {
      let selo = this.add
        .circle(
          Math.round(66 * escala),
          Math.round(-72 * escala),
          Math.round(17 * escala),
          0x1a1a1a,
        )
        .setStrokeStyle(2, 0xffffff);
      let iconeSelo = this.add
        .text(Math.round(66 * escala), Math.round(-72 * escala), "⚡", {
          fontSize: `${Math.round(18 * escala)}px`,
        })
        .setOrigin(0.5);
      filhos.push(selo, iconeSelo);
    }

    // O dono vê sua carta e um pequeno coelho; adversários continuam vendo o verso.
    if (podeInteragirOculta && carta.ocultadaPelaToca && !carta.revelada) {
      const halo = this.add.rectangle(0, 0, CW + 6, CH + 6, 0xffb8d8, 0.06)
        .setStrokeStyle(3, 0xffb8d8, 0.7);
      const coelho = this.add.container(CW / 2 - 25, -CH / 2 + 29, [
        this.add.ellipse(-6, -12, 8, 23, 0xffedf5),
        this.add.ellipse(6, -12, 8, 23, 0xffedf5),
        this.add.ellipse(-6, -13, 3, 15, 0xf49dbd),
        this.add.ellipse(6, -13, 3, 15, 0xf49dbd),
        this.add.circle(0, 1, 13, 0xffedf5),
        this.add.circle(-5, 0, 1.8, 0x49303b),
        this.add.circle(5, 0, 1.8, 0x49303b),
        this.add.circle(0, 5, 2, 0xf49dbd),
      ]).setScale(escala);
      coelho.indicadorToca = true;
      filhos.push(halo, coelho);
    }

    // A marca acompanha o vínculo e some no próximo redesenho após sua remoção.
    if (carta.capturadaPor && this.textures.exists("efeitoAranha")) {
      const marca = this.add.image(0, 0, "efeitoAranha");
      marca.setScale(Math.min(CW * 0.75 / marca.width, CH * 0.65 / marca.height));
      marca.setAlpha(0.75);
      filhos.push(marca);
    }

    if (carta.efeitoDesabilitado && !viradaParaBaixo) {
      if (carta.fonteSupressao?.efeito?.tipo === TIPOS_EFEITO.SILENCIAR_CARTA && this.textures.exists("efeitoHal")) {
        const cadeado = this.add.image(0, 0, "efeitoHal");
        cadeado.setScale(Math.min(CW * 0.75 / cadeado.width, CH * 0.65 / cadeado.height));
        cadeado.indicadorHal = true;
        filhos.push(cadeado);
      }
      filhos.push(
        this.add
          .text(0, -CH / 2 + 22, "EFEITO BLOQUEADO", {
            fontSize: "17px",
            fontStyle: "bold",
            color: "#aaffbb",
            backgroundColor: "#072715",
            padding: { x: 4, y: 5 },
          })
          .setOrigin(0.5),
      );
    }
    if (carta.tipo === "terreno" && !viradaParaBaixo &&
      [...this.partida.jogador.campo.cartas, ...this.partida.inimigo.campo.cartas]
        .some((c) => c?.efeito && c.efeito.tipo === TIPOS_EFEITO.BONUS_POR_TERRENOS)) {
      const contorno = this.add.rectangle(0, 0, CW + 6, CH + 6, 0x38ff68, 0.025)
        .setStrokeStyle(5, 0x38ff68, 0.95);
      contorno.indicadorReplicantes = true;
      filhos.push(contorno);
    }
    filhos.push(...this.criarIndicadorExtintor(carta, CW, CH, escala));
    // Gira o conteúdo para o dono; tweens no container externo não desfazem a orientação.
    if (this.multiplayer?.presentation && this.partida.inimigo.campo.cartas.includes(carta)) {
      for (const filho of filhos)
        filho.setPosition(-filho.x, -filho.y).setAngle((filho.angle || 0) + 180);
    }

    const chaveCarta = this.chaveCartaMultiplayer(carta);
    const aguardaInvocacao =
      !!this.scene?.manager?.keys?.CenaEfeitos?.deveOcultarCarta(carta);
    const animarEntrada =
      !aguardaInvocacao &&
      (!this.renderizandoInterface ||
        !this.interfaceJaDesenhada ||
        this.chavesCampoNovasRender.has(chaveCarta));

    // O anel só existe na invocação real. Antes ele era recriado em toda atualização de HUD e fazia cartas antigas parecerem recém-jogadas.
    let anel = null;
    if (animarEntrada) {
      anel = this.add
        .circle(xPos, yPos, 10, corFundo, 0)
        .setStrokeStyle(6, 0xffffff, 0.9)
        .setDepth(500);
    }

    let container = this.add.container(xPos, yPos, filhos);
    container.setScale(animarEntrada ? 0 : 1);
    container.setSize(CW, CH);
    container.setInteractive({ useHandCursor: true });

    // Referência à carta de dados, usada para localizar esta carta na tela quando um efeito de buff/debuff precisa animá-la.
    container.dadosCartaCampo = carta;
    container.auraHabilidade = auraHabilidade;
    // Nasce oculta: não espera o próximo update da camada de efeitos.
    container.ocultaPorInvocacao = aguardaInvocacao;
    container.setVisible(!aguardaInvocacao);

    container.on("pointerup", (pointer) => {
      if (this.jogarCartaSelecionadaNoCampo(pointer)) return;
      if (
        !this.podeConsultarCartas() ||
        (viradaParaBaixo && !podeInteragirOculta)
      )
        return;
      this.mostrarDetalheCarta(carta);
    });

    // Mouse abre a ficha no hover; telas de toque usam pointerup.
    container.on("pointerover", (pointer) => {
      if (
        this.cartaMaoSelecionada?.active ||
        !this.podeConsultarCartas() ||
        (viradaParaBaixo && !podeInteragirOculta) ||
        pointer.pointerType !== "mouse"
      )
        return;
      this.mostrarDetalheCarta(carta);
    });

    if (animarEntrada) {
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 300,
        ease: "Back.Out",
      });

      // Anel se expandindo e sumindo — o "pop" visual de invocação.
      this.tweens.add({
        targets: anel,
        radius: 110,
        alpha: 0,
        duration: 380,
        ease: "Cubic.Out",
        onComplete: () => anel.destroy(),
      });
    }
  }

  // O marcador acompanha a carta em ambos os campos até o bloqueio expirar.
  criarIndicadorExtintor(carta, largura, altura, escala) {
    if (!carta.bonusBloqueado) return [];
    const borda = this.add
      .rectangle(0, 0, largura, altura, 0xff9933, 0)
      .setStrokeStyle(Math.max(3, Math.round(3 * escala)), 0xff9933, 1);
    const faixa = this.add.rectangle(
      0,
      -altura / 2 + 26 * escala,
      largura - 8,
      42 * escala,
      0x351800,
      0.96,
    );
    const texto = this.add
      .text(0, -altura / 2 + 26 * escala, "EXTINTOR\nSEM BÔNUS", {
        fontSize: `${Math.round(13 * escala)}px`,
        color: "#ffcc88",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);
    return [borda, faixa, texto];
  }

  // Marcador persistente da Travessura do Macaco. Ele é redesenhado junto do campo e desaparece automaticamente quando a armadilha é consumida.
  criarIndicadorArmadilha(xPos, yPos, layout) {
    const L = layout || this.layout;
    const marca = this.add.image(xPos, yPos, "efeitoMacaco").setDepth(421);
    marca.setScale(Math.min((L.slotW - 8) / marca.width, (L.slotH - 8) / marca.height));
    marca.setAlpha(0.72);
  }

  // As compras partem do monte acima da mão.
  obterPosicaoMonteCompra() {
    return { x: LARGURA_LAYOUT / 2, y: 1230 };
  }

  desenharMaoEmLeque() {
    if (this.multiplayer?.presentation) return;
    if (this.multiplayer?.spectator) {
      this.desenharMaoInimigo("jogador");
      return;
    }
    let cartasMao = this.partida.jogador.mao.cartas;
    let totalCartas = cartasMao.length;

    if (totalCartas === 0) return;

    // CARTAS RECÉM-COMPRADAS

    const recemCompradas = this.partida.jogador.cartasRecemCompradas || [];

    this.partida.jogador.cartasRecemCompradas = [];

    // CONFIGURAÇÃO DO LEQUE

    const centroY = Y_MAO_JOGADOR;

    const espacamentoMax = 108;
    const espacamentoMin = 34;

    const espacamentoX =
      totalCartas <= 6
        ? espacamentoMax
        : Math.max(espacamentoMin, espacamentoMax - (totalCartas - 6) * 7);
    const centroX = LARGURA_LAYOUT / 2;

    const anguloPasso = 4;
    const curvaturaY = 2;

    cartasMao.forEach((carta, indice) => {
      let offset = indice - (totalCartas - 1) / 2;

      let posX = centroX + offset * espacamentoX;

      let posY = centroY + Math.pow(offset, 2) * curvaturaY;

      let angulo = offset * anguloPasso;

      // VISUAL DA CARTA

      let corFundo = this.obterCorPorId(carta.id);

      let sombra = this.add.rectangle(7, 12, 176, 246, 0x000000, 0.35);

      let fundoCarta = carta.imagem
        ? this.add.image(0, 0, carta.imagem).setDisplaySize(176, 246)
        : this.add.rectangle(0, 0, 176, 246, corFundo);

      let borda = this.add
        .rectangle(0, 0, 176, 246)
        .setStrokeStyle(4, 0xffffff);

      let nomeCurto = this.truncarTexto(carta.nome, 12);

      let nomeTexto = this.add
        .text(0, -94, nomeCurto, {
          fontSize: "27px",
          color: "#ffffff",
          align: "center",
          wordWrap: {
            width: 152,
          },
        })
        .setOrigin(0.5, 0);

      const ehEfeitoLeque = carta.tipo === "efeito";
      const ehTerrenoLeque = carta.tipo === "terreno";

      const filhos = [sombra, fundoCarta, borda, nomeTexto];

      // SELO DE PODER

      if (!ehEfeitoLeque && !ehTerrenoLeque) {
        const [poderBola, poderTexto] = this.criarSeloEstat(
          0,
          94,
          carta.poder,
          "#ff5555",
          31,
        );

        filhos.push(poderBola, poderTexto);
      }

      // CARTA DE EFEITO

      if (ehEfeitoLeque) {
        let selo = this.add
          .circle(70, -98, 22, 0x1a1a1a)
          .setStrokeStyle(2, 0xffffff);

        let iconeSelo = this.add
          .text(70, -98, "⚡", {
            fontSize: "23px",
          })
          .setOrigin(0.5);

        filhos.push(selo, iconeSelo);
      }

      // CONTAINER DA CARTA

      let containerCarta = this.add.container(posX, posY, filhos);

      containerCarta.setSize(176, 246);

      containerCarta.setAngle(angulo);

      containerCarta.setInteractive({
        useHandCursor: true,
      });

      // Dados usados pelo drag/drop.
      containerCarta.dadosCarta = carta;

      containerCarta.posOriginal = {
        x: posX,
        y: posY,
        angle: angulo,
      };

      // Profundidade normal da carta.
      containerCarta.depthBase = indice;

      containerCarta.setDepth(indice);

      this.input.setDraggable(containerCarta);

      // ANIMAÇÃO DE ENTRADA

      const indiceCompra = recemCompradas.indexOf(carta);

      if (indiceCompra !== -1) {
        this.animarCompraCarta(
          containerCarta,
          posX,
          posY,
          angulo,
          indiceCompra,
        );
      } else if (!this.interfaceJaDesenhada) {
        containerCarta.setAlpha(0);

        containerCarta.setScale(0.6);

        this.tweens.add({
          targets: containerCarta,

          alpha: 1,

          scale: 1,

          duration: 220,

          delay: indice * 35,

          ease: "Back.Out",
        });
      } else {
        containerCarta.setAlpha(1);
        containerCarta.setScale(1);
      }

      // Seleção persiste ao tirar o ponteiro: o próximo clique pode ser no campo.
      containerCarta.on("pointerup", (pointer) => {
        if (pointer.getDistance() > this.input.dragDistanceThreshold) return;
        this.selecionarCartaDaMao(containerCarta);
      });
    });
  }

  baixarOutrasCartasDaMao(excecao) {
    for (const carta of this.children.list) {
      if (
        !carta.dadosCarta ||
        !carta.active ||
        carta === excecao ||
        carta.animandoCompra
      )
        continue;
      // Restaura imediatamente, antes de levantar outra carta. O gesto não pode reutilizar a posição elevada capturada no pointerdown anterior.
      this.tweens.killTweensOf(carta);
      Object.assign(carta, carta.posOriginal, {
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
      });
      carta.setDepth(carta.depthBase);
      carta._maoSwipeYOriginal = undefined;
      carta._maoSwipeXOriginal = undefined;
      carta._maoSwipeAlphaOriginal = undefined;
    }
  }

  selecionarCartaDaMao(container) {
    if (this.training && !this.podeJogarCartasAgora()) return;
    if (
      !this.podeConsultarCartas() ||
      container.animandoCompra ||
      !container.active
    )
      return;
    if (this.cartaMaoSelecionada === container) {
      this.mostrarDetalheCarta(container.dadosCarta);
      return;
    }
    this.baixarOutrasCartasDaMao(container);
    this.cartaMaoSelecionada = container;
    this.tweens.killTweensOf(container);
    container.setDepth(1000);
    this.tweens.add({
      targets: container,
      y: Y_MAO_JOGADOR - 82,
      angle: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 150,
      ease: "Back.Out",
    });
    this.somHover?.play();
  }

  jogarCartaSelecionadaNoCampo(pointer) {
    const container = this.cartaMaoSelecionada;
    if (
      !container?.active ||
      this.travado ||
      this.modalAberto ||
      !this.podeJogarCartasAgora() ||
      (this.faseAtual === "habilidades" && container.dadosCarta?.tipo !== "efeito") ||
      pointer.getDistance() > this.input.dragDistanceThreshold
    )
      return false;
    const ponto = this.pontoDoPonteiro(pointer);
    const noCampo = this.children.list.some(
      (o) =>
        o.isSlot &&
        Phaser.Geom.Rectangle.Contains(o.getBounds(), ponto.x, ponto.y),
    );
    if (!noCampo) return false;
    this.cartaMaoSelecionada = null;
    this.tratarSoltarCarta(container, ponto);
    return true;
  }

  // Anima as cartas compradas em sequência, com som no início do voo.
  animarCompraCarta(
    containerCarta,
    destinoX,
    destinoY,
    anguloFinal,
    indiceCompra,
  ) {
    const origem = this.obterPosicaoMonteCompra();
    const ATRASO_ENTRE_CARTAS = 220; // ms entre a saída de uma carta e a da próxima
    const atraso = indiceCompra * ATRASO_ENTRE_CARTAS;

    this.tweens.killTweensOf(containerCarta);
    containerCarta.animandoCompra = true;
    containerCarta.setPosition(origem.x, origem.y);
    containerCarta.setAngle(0);
    // Mantém a escala fixa para evitar saltos durante redraw ou hover.
    containerCarta.setScale(1);
    containerCarta.setAlpha(0);
    // Fica por cima de tudo enquanto está "voando", pra não passar por baixo de outras cartas do leque no meio do caminho.
    containerCarta.setDepth(3000 + indiceCompra);
    // Evita que o jogador consiga arrastar/clicar a carta enquanto ela ainda está em pleno voo, vindo do monte.
    containerCarta.disableInteractive();

    this.time.delayedCall(atraso, () => {
      if (!containerCarta.active) return;

      containerCarta.setAlpha(1);
      if (this.somComprarCarta) this.somComprarCarta.play();

      this.tweens.add({
        targets: containerCarta,
        x: destinoX,
        y: destinoY,
        angle: anguloFinal,
        duration: 380,
        // Sem overshoot: Back.Out podia ampliar a carta no exato instante de um redraw/hover e deixar aquela escala gravada no container.
        ease: "Cubic.Out",
        onUpdate: () => {
          if (!containerCarta.active) return;
          containerCarta.setScale(1);
        },
        onComplete: () => {
          if (!containerCarta.active) return;
          containerCarta.setPosition(destinoX, destinoY);
          containerCarta.setAngle(anguloFinal);
          containerCarta.setScale(1);
          containerCarta.setAlpha(1);
          containerCarta.animandoCompra = false;
          containerCarta.setDepth(containerCarta.depthBase);
          containerCarta.setInteractive({ useHandCursor: true });
          this.input.setDraggable(containerCarta);
        },
      });
    });
  }

  // Histórico paginado, das jogadas mais recentes às antigas.

  mostrarHistorico() {
    if (this.modalAberto) return;
    this.modalAberto = true;
    this.historicoAberto = true;
    this.travado = true;
    this.historicoPagina = 0;

    let overlay = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      0x020714,
      0.82,
    );
    overlay.setDepth(4000);
    overlay.setInteractive();
    overlay.on("pointerup", () => this.fecharHistorico());

    const painelBg = this.criarPlacaDuelo(0, 0, 880, 1480);
    painelBg.setInteractive();
    painelBg.on("pointerup", () => {});

    const etiqueta = this.criarTextoUI(-392, -674, "HISTÓRICO", {
      fontSize: "24px",
      color: "#91deef",
      fontStyle: "bold",
      letterSpacing: 2,
    }).setOrigin(0, 0.5);
    const titulo = this.criarTextoUI(-392, -616, "Cartas jogadas", {
      fontSize: "52px",
      color: "#f2f8ff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);

    const fecharBtn = this.criarBotaoFecharDetalhe(348, -674, 0x54ddff, () =>
      this.fecharHistorico(),
    ).setName("fechar-historico");

    const totalCartas = this.partida.historico.length;
    let subtitulo = this.criarTextoUI(
      -392,
      -550,
      `${totalCartas} carta${totalCartas === 1 ? "" : "s"} jogada${totalCartas === 1 ? "" : "s"}`,
      { fontSize: "30px", color: "#91a3bb" },
    ).setOrigin(0, 0.5);
    const divisorias = this.add.graphics().lineStyle(1.5, 0x54ddff, 0.3);
    divisorias.lineBetween(-392, -508, 392, -508);
    divisorias.lineBetween(-392, 532, 392, 532);

    // Container que guarda só as linhas da página atual: fica fácil recriar apenas ele quando o usuário troca de página.
    let listaContainer = this.add.container(0, 0, []);

    let btnAnterior = this.criarBotaoPaginacaoHistorico(-180, 630, "‹", () =>
      this.mudarPaginaHistorico(-1),
    );
    let labelPagina = this.criarTextoUI(0, 630, "", {
      fontSize: "34px",
      color: "#d5e9f7",
      fontStyle: "bold",
      letterSpacing: 2,
    }).setOrigin(0.5);
    let btnProxima = this.criarBotaoPaginacaoHistorico(180, 630, "›", () =>
      this.mudarPaginaHistorico(1),
    );

    let painel = this.add.container(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, [
      painelBg,
      etiqueta,
      titulo,
      fecharBtn,
      subtitulo,
      divisorias,
      listaContainer,
      btnAnterior,
      labelPagina,
      btnProxima,
    ]);
    painel.setDepth(4001);
    painel.setScale(0.96);
    painel.setAlpha(0);

    this.overlayHistoricoAtual = overlay;
    this.painelHistoricoAtual = painel;
    this.listaHistoricoContainer = listaContainer;
    this.labelPaginaHistorico = labelPagina;
    this.btnAnteriorHistorico = btnAnterior;
    this.btnProximaHistorico = btnProxima;

    this.tweens.add({
      targets: painel,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Cubic.Out",
    });

    this.atualizarListaHistorico();
    this.somPop.play();
  }

  criarBotaoPaginacaoHistorico(x, y, texto, aoClicar) {
    let bg = this.criarPlacaDuelo(0, 0, 112, 100);
    let label = this.criarTextoUI(0, 0, texto, {
      fontSize: "64px",
      color: "#b9f1ff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    let btn = this.add.container(x, y, [bg, label]);
    btn.setSize(124, 124);
    btn.setName(x < 0 ? "pagina-anterior-historico" : "pagina-proxima-historico");
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", aoClicar);
    return btn;
  }

  // Redesenha só as linhas da página atual (chamado ao abrir o modal e sempre que o usuário navega entre páginas).
  atualizarListaHistorico() {
    if (!this.listaHistoricoContainer) return;
    this.listaHistoricoContainer.removeAll(true);

    const TAMANHO_PAGINA = 6;
    // Mais recente primeiro
    const historico = [...this.partida.historico].reverse();
    const totalPaginas = Math.max(
      1,
      Math.ceil(historico.length / TAMANHO_PAGINA),
    );
    this.historicoPagina = Phaser.Math.Clamp(
      this.historicoPagina,
      0,
      totalPaginas - 1,
    );

    if (historico.length === 0) {
      let vazio = this.criarTextoUI(0, -60, "Nenhuma carta jogada ainda.", {
        fontSize: "36px",
        color: "#91a3bb",
        align: "center",
        wordWrap: { width: 780 },
      }).setOrigin(0.5);
      this.listaHistoricoContainer.add(vazio);
    } else {
      const inicio = this.historicoPagina * TAMANHO_PAGINA;
      const pagina = historico.slice(inicio, inicio + TAMANHO_PAGINA);

      pagina.forEach((entrada, indice) => {
        const y = -418 + indice * 162;
        this.listaHistoricoContainer.add(this.criarLinhaHistorico(entrada, y));
      });
    }

    if (this.labelPaginaHistorico) {
      this.labelPaginaHistorico.setText(
        `${this.historicoPagina + 1} / ${totalPaginas}`,
      );
    }
    if (this.btnAnteriorHistorico) {
      this.btnAnteriorHistorico.setAlpha(this.historicoPagina === 0 ? 0.35 : 1);
    }
    if (this.btnProximaHistorico) {
      this.btnProximaHistorico.setAlpha(
        this.historicoPagina >= totalPaginas - 1 ? 0.35 : 1,
      );
    }
  }

  mudarPaginaHistorico(delta) {
    this.historicoPagina += delta;
    this.atualizarListaHistorico();
  }

  // Tocar na jogada abre a ficha; ciano e magenta identificam cada lado.
  criarLinhaHistorico(entrada, y) {
    const corDono = entrada.quem === "jogador" ? 0x54ddff : 0xff63ad;
    const labelDono = entrada.quem === "jogador" ? "Você" : "Inimigo";
    const corLabelDono = entrada.quem === "jogador" ? "#91deef" : "#ff9dca";

    let fundo = this.criarPlacaDuelo(0, 0, 784, 144, corDono);
    let barra = this.add.rectangle(-389, 0, 4, 64, corDono);

    let turnoTexto = this.criarTextoUI(-344, 32, `TURNO ${entrada.turno}`, {
      fontSize: "26px",
      color: "#91a3bb",
    }).setOrigin(0, 0.5);

    let donoTexto = this.criarTextoUI(-162, 32, labelDono.toUpperCase(), {
      fontSize: "26px",
      color: corLabelDono,
      fontStyle: "bold",
    }).setOrigin(0, 0.5);

    let nomeTexto = this.criarTextoUI(
      -344,
      -24,
      this.truncarTexto(entrada.carta.nome, 26),
      {
        fontSize: "32px",
        color: "#f2f8ff",
        fontStyle: "bold",
      },
    ).setOrigin(0, 0.5);
    if (nomeTexto.width > 620) nomeTexto.setScale(620 / nomeTexto.width);

    let seta = this.criarTextoUI(352, 0, "›", {
      fontSize: "54px",
      color: corLabelDono,
    }).setOrigin(0.5);

    let linha = this.add.container(0, y, [
      fundo,
      barra,
      turnoTexto,
      donoTexto,
      nomeTexto,
      seta,
    ]);
    linha.setSize(784, 144);
    linha.setInteractive({ useHandCursor: true });
    linha.on("pointerover", () => linha.setScale(1.01));
    linha.on("pointerout", () => linha.setScale(1));
    linha.on("pointerup", () => this.abrirDetalheDoHistorico(entrada.carta));

    return linha;
  }

  // Fecha o histórico antes de abrir a ficha selecionada.
  abrirDetalheDoHistorico(carta) {
    if (this.painelHistoricoAtual) this.painelHistoricoAtual.destroy();
    if (this.overlayHistoricoAtual) this.overlayHistoricoAtual.destroy();
    this.painelHistoricoAtual = null;
    this.overlayHistoricoAtual = null;
    this.listaHistoricoContainer = null;
    this.labelPaginaHistorico = null;
    this.btnAnteriorHistorico = null;
    this.btnProximaHistorico = null;
    this.historicoAberto = false;
    this.modalAberto = false;

    this.mostrarDetalheCarta(carta);
  }

  fecharHistorico() {
    if (!this.historicoAberto) return;

    this.tweens.add({
      targets: this.painelHistoricoAtual,
      scale: 0.96,
      alpha: 0,
      duration: 150,
      ease: "Sine.easeIn",
      onComplete: () => {
        if (this.painelHistoricoAtual) this.painelHistoricoAtual.destroy();
        if (this.overlayHistoricoAtual) this.overlayHistoricoAtual.destroy();
        this.painelHistoricoAtual = null;
        this.overlayHistoricoAtual = null;
        this.listaHistoricoContainer = null;
        this.labelPaginaHistorico = null;
        this.btnAnteriorHistorico = null;
        this.btnProximaHistorico = null;
        this.historicoAberto = false;
        this.modalAberto = false;
        this.travado = false;
      },
    });
  }

  // Ficha da carta com arte, PA e descrição.

  criarBotaoFecharDetalhe(x, y, cor = 0x54ddff, aoClicar = () => this.fecharDetalheCarta()) {
    const fundo = this.criarPlacaDuelo(0, 0, 88, 88, cor);
    const icone = this.add.graphics().lineStyle(5, 0xecf7ff, 1);
    icone.lineBetween(-16, -16, 16, 16);
    icone.lineBetween(-16, 16, 16, -16);
    const botao = this.add.container(x, y, [fundo, icone]).setSize(112, 112);
    botao.setName("fechar-detalhe-carta").setInteractive({ useHandCursor: true });
    botao.on("pointerover", () => this.tweens.add({ targets: botao, scale: 1.05, duration: 100 }));
    botao.on("pointerout", () => this.tweens.add({ targets: botao, scale: 1, duration: 100 }));
    botao.on("pointerup", aoClicar);
    return botao;
  }

  criarBotaoHabilidadeDetalhe(carta, x, y, largura, usada, cor = 0x54ddff) {
    const fundo = this.criarPlacaDuelo(0, 0, largura, 112, usada ? 0x42546a : cor);
    const texto = this.criarTextoUI(0, 0, usada ? "Habilidade já usada" : "ATIVAR HABILIDADE  ›", {
      fontSize: "32px", color: usada ? "#91a3bb" : "#effaff", fontStyle: "bold", letterSpacing: 1,
    }).setOrigin(0.5);
    const botao = this.add.container(x, y, [fundo, texto]).setSize(largura, 112);
    botao.setName("ativar-habilidade");
    if (usada) return botao.setAlpha(0.65);
    botao.setInteractive({ useHandCursor: true });
    botao.on("pointerover", () => this.tweens.add({ targets: botao, scale: 1.02, duration: 100 }));
    botao.on("pointerout", () => this.tweens.add({ targets: botao, scale: 1, duration: 100 }));
    botao.on("pointerdown", () => botao.setScale(0.98));
    botao.on("pointerup", () => {
      if ((carta.habilidadeAprendidaDe || carta.nome) === "O Bom" && this.cache?.audio.exists("somBom1"))
        this.sound.play("somBom1", { volume: window.cyberduelSettings?.effects(0.3) ?? 0.3 });
      this.fecharDetalheCarta();
      this.time.delayedCall(180, () => this.iniciarAtivacaoHabilidade(carta));
    });
    return botao;
  }

  mostrarDetalheCarta(carta) {
    if (this.training && !this.training.canUse(carta)) return;
    if (this.cache?.audio.exists("somInteracao")) this.sound.play("somInteracao", { volume: window.cyberduelSettings?.effects(0.16) ?? 0.16 });
    if (this.modalAberto) return;
    // Lendárias usam uma ficha própria com arte ampliada.
    if (carta.lendaria) {
      this.mostrarDetalheCartaLendaria(carta);
      return;
    }
    this.modalAberto = true;
    this.travado = true;

    this.zoomBloqueadoAte = this.time.now + 2000;

    let overlay = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      0x020714,
      0.82,
    );
    overlay.setDepth(4000);
    overlay.setInteractive();
    overlay.on("pointerup", () => this.fecharDetalheCarta());

    const corFundo = this.obterCorPorId(carta.id);
    const ehEfeito = carta.tipo === "efeito";
    const ehTerreno = carta.tipo === "terreno";

    const podeMostrarBotaoHabilidade =
      this.podeUsarHabilidadesAgora() &&
      !this.partida.partidaEncerrada &&
      !!carta.habilidadeAtiva &&
      carta.efeito &&
      (carta.efeito.tipo === TIPOS_EFEITO.SILENCIAR_CARTA ||
        carta.efeito.tipo === TIPOS_EFEITO.RENOVAR_MAO ||
        carta.efeito.tipo === TIPOS_EFEITO.SINDICATO ||
        carta.efeito.tipo === TIPOS_EFEITO.ATACAR ||
        carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO ||
        carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO ||
        carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS ||
        carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE ||
        carta.efeito.tipo === TIPOS_EFEITO.ROUBAR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR ||
        carta.efeito.tipo === TIPOS_EFEITO.ENVENENAR ||
        carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO ||
        carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS) &&
      this.partida.jogador.campo.cartas.includes(carta);
    const habilidadeJaUsada =
      podeMostrarBotaoHabilidade && carta.usadaEsteTurno;

    const PAINEL_LARGURA = 880;
    const PAINEL_ALTURA = 1560;
    const COR_DESTAQUE = 0x54ddff;
    const MARGEM = 48;
    const LARGURA_CONTEUDO = PAINEL_LARGURA - MARGEM * 2;
    const CABECALHO_Y = -PAINEL_ALTURA / 2 + 66;

    const painelBg = this.criarPlacaDuelo(0, 0, PAINEL_LARGURA, PAINEL_ALTURA, COR_DESTAQUE);
    // Centraliza a área de toque do painel para não cobrir o botão de habilidade.
    painelBg.setInteractive(
      new Phaser.Geom.Rectangle(
        -PAINEL_LARGURA / 2,
        -PAINEL_ALTURA / 2,
        PAINEL_LARGURA,
        PAINEL_ALTURA,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    painelBg.on("pointerup", () => {});

    const JANELA_ARTE_W = LARGURA_CONTEUDO;
    const JANELA_ARTE_H = 540;

    let imagem, iconeImagem;
    if (carta.imagem) {
      imagem = this.add.image(0, 0, carta.imagem);
      this.aplicarRecorteCover(
        imagem,
        JANELA_ARTE_W,
        JANELA_ARTE_H,
        carta.foco,
      );
      iconeImagem = null;
    } else {
      imagem = this.add.rectangle(0, 0, JANELA_ARTE_W, JANELA_ARTE_H, corFundo);
      iconeImagem = this.criarTextoUI(
        0,
        0,
        ehTerreno ? "⛰" : ehEfeito ? "⚡" : "⚔",
        {
          fontSize: "156px",
        },
      ).setOrigin(0.5);
    }
    let moldura = this.add
      .rectangle(0, 0, JANELA_ARTE_W, JANELA_ARTE_H)
      .setStrokeStyle(1.5, COR_DESTAQUE, 0.5);
    const cantosArte = this.criarMolduraCampo(0, 0, JANELA_ARTE_W + 12, JANELA_ARTE_H + 12, COR_DESTAQUE);

    let containerImagem = this.add.container(
      0,
      0,
      [cantosArte, imagem, moldura, iconeImagem].filter(Boolean),
    );

    if (carta.imagem) {
      moldura.setInteractive({ useHandCursor: true });
      moldura.on("pointerover", () => this.abrirZoomCarta(carta));
      moldura.on("pointerup", () => this.abrirZoomCarta(carta));
    }

    let etiquetaTipo = this.criarTextoUI(
      -LARGURA_CONTEUDO / 2,
      CABECALHO_Y,
      ehTerreno
        ? "CARTA DE TERRENO"
        : ehEfeito
          ? "CARTA DE EFEITO"
          : `CARTA ${(carta.nivel || "personagem").toUpperCase()}`,
      {
        fontSize: "24px",
        color: "#91deef",
        fontStyle: "bold",
        letterSpacing: 2,
      },
    ).setOrigin(0, 0.5);

    let nomeTexto = this.criarTextoUI(-LARGURA_CONTEUDO / 2, CABECALHO_Y + 58, carta.nome, {
      fontSize: "54px",
      color: "#f2f8ff",
      fontStyle: "bold",
      align: "left",
      wordWrap: { width: LARGURA_CONTEUDO },
    }).setOrigin(0, 0);
    containerImagem.y = nomeTexto.y + nomeTexto.height + 34 + JANELA_ARTE_H / 2;

    const elementosTopo = [containerImagem, etiquetaTipo, nomeTexto];

    if (!ehEfeito && !ehTerreno) {
      const poderTexto = this.criarTextoUI(PAINEL_LARGURA / 2 - 170, CABECALHO_Y, `${carta.poder} PA`, {
        fontSize: "42px", fontStyle: "bold", color: "#f2f8ff", fontFamily: "Arial, sans-serif",
      }).setOrigin(1, 0.5);
      if (poderTexto.width > 160) poderTexto.setScale(160 / poderTexto.width);
      elementosTopo.push(poderTexto);
      this.somPop.play();
    }

    const painelDescY = containerImagem.y + JANELA_ARTE_H / 2 + 36;
    const descricaoLimiteY = PAINEL_ALTURA / 2 - (podeMostrarBotaoHabilidade ? 192 : 44);
    const painelDescAltura = descricaoLimiteY - painelDescY;
    const placaDescricao = this.add.graphics();
    placaDescricao.fillStyle(0x0a1930, 0.8);
    placaDescricao.fillRect(
      -LARGURA_CONTEUDO / 2,
      painelDescY,
      LARGURA_CONTEUDO,
      painelDescAltura,
    );
    placaDescricao.lineStyle(1.5, COR_DESTAQUE, 0.35);
    placaDescricao.lineBetween(-LARGURA_CONTEUDO / 2, painelDescY, LARGURA_CONTEUDO / 2, painelDescY);
    const descY = painelDescY + 26;
    const DESC_LARGURA = LARGURA_CONTEUDO - 52;
    const DESC_ALTURA = painelDescAltura - 52;

    // Mesma diferenciação de cor usada na carta lendária: flavor x efeito.
    const GAP_PARTES_DESC = 24;
    let textosDescricao = [];
    let yParte = 0;
    for (const parte of carta.partesDescricao()) {
      let t = this.criarTextoUI(0, yParte, parte.texto, {
        fontSize: "32px",
        color: parte.tipo === "efeito" ? "#a7ebff" : "#c4d2e5",
        fontStyle: parte.tipo === "efeito" ? "bold" : "normal",
        align: "left",
        wordWrap: { width: DESC_LARGURA },
        lineSpacing: 10,
      })
        .setFixedSize(DESC_LARGURA, 0)
        .setOrigin(0.5, 0);
      textosDescricao.push(t);
      yParte += t.height + GAP_PARTES_DESC;
    }

    let containerDescricao = this.add.container(0, descY, textosDescricao);

    // NOVO SISMETA DE MÁSCARA - PHASER 4
    const maskX = (LARGURA_LAYOUT - DESC_LARGURA) / 2;
    const maskY = ALTURA_LAYOUT / 2 + descY;

    let mascaraGraphics = this.add.graphics();
    mascaraGraphics.fillStyle(0xffffff);
    mascaraGraphics.fillRect(maskX, maskY, DESC_LARGURA, DESC_ALTURA);
    this.mascaraDescricaoAtual = this.aplicarMascaraRender(
      containerDescricao,
      mascaraGraphics,
    );

    const alturaTotalDescricao = Math.max(0, yParte - GAP_PARTES_DESC);
    const alturaExcedente = alturaTotalDescricao - DESC_ALTURA;
    const elementosScroll = [];
    if (alturaExcedente > 0) {
      let areaArraste = this.add
        .rectangle(
          0,
          DESC_ALTURA / 2,
          DESC_LARGURA,
          DESC_ALTURA,
          0xffffff,
          0.001,
        )
        .setInteractive({ useHandCursor: true });

      let trilho = this.add
        .rectangle(
          DESC_LARGURA / 2 + 22,
          DESC_ALTURA / 2,
          6,
          DESC_ALTURA,
          0xffffff,
          0.15,
        )
        .setOrigin(0.5);
      const alturaIndicador = Math.max(
        40,
        (DESC_ALTURA / alturaTotalDescricao) * DESC_ALTURA,
      );
      let indicador = this.add
        .rectangle(DESC_LARGURA / 2 + 22, 0, 6, alturaIndicador, COR_DESTAQUE, 0.8)
        .setOrigin(0.5, 0);
      // A área de toque e o indicador ficam fixos; só o texto é rolado.
      elementosScroll.push(
        this.add.container(0, descY, [areaArraste, trilho, indicador]),
      );

      this.habilitarScrollDescricao(
        areaArraste,
        containerDescricao,
        alturaExcedente,
        DESC_ALTURA,
        indicador,
      );
    }

    const fecharBtn = this.criarBotaoFecharDetalhe(PAINEL_LARGURA / 2 - 68, CABECALHO_Y);

    const filhosPainel = [
      painelBg,
      placaDescricao,
      containerDescricao,
      ...elementosScroll,
      ...elementosTopo,
      fecharBtn,
    ];

    if (podeMostrarBotaoHabilidade) {
      filhosPainel.push(this.criarBotaoHabilidadeDetalhe(carta, 0,
        PAINEL_ALTURA / 2 - 96, LARGURA_CONTEUDO, habilidadeJaUsada));
    }

    let painel = this.add.container(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      filhosPainel,
    );
    painel.setDepth(4001);
    painel.setScale(0.96);
    painel.setAlpha(0);

    this.tweens.add({
      targets: painel,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Cubic.Out",
    });

    this.overlayDetalheAtual = overlay;
    this.painelDetalheAtual = painel;
    this.elevarModalCarta(overlay, painel);
  }

  // Ficha lendária com arte inteira e textos sobrepostos.
  mostrarDetalheCartaLendaria(carta) {
    this.modalAberto = true;
    this.travado = true;
    this.zoomBloqueadoAte = this.time.now + 2000;

    let overlay = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      0x000000,
      0.85,
    );
    overlay.setDepth(4000);
    overlay.setInteractive();
    overlay.on("pointerup", () => this.fecharDetalheCarta());

    const corFundo = this.obterCorPorId(carta.id);
    const ehEfeito = carta.tipo === "efeito";
    const ehTerreno = carta.tipo === "terreno";

    const podeMostrarBotaoHabilidade =
      this.podeUsarHabilidadesAgora() &&
      !this.partida.partidaEncerrada &&
      !!carta.habilidadeAtiva &&
      carta.efeito &&
      (carta.efeito.tipo === TIPOS_EFEITO.SILENCIAR_CARTA ||
        carta.efeito.tipo === TIPOS_EFEITO.RENOVAR_MAO ||
        carta.efeito.tipo === TIPOS_EFEITO.SINDICATO ||
        carta.efeito.tipo === TIPOS_EFEITO.ATACAR ||
        carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO ||
        carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO ||
        carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS ||
        carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE ||
        carta.efeito.tipo === TIPOS_EFEITO.ROUBAR_PODER ||
        carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR ||
        carta.efeito.tipo === TIPOS_EFEITO.ENVENENAR ||
        carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO ||
        carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS) &&
      this.partida.jogador.campo.cartas.includes(carta);
    const habilidadeJaUsada =
      podeMostrarBotaoHabilidade && carta.usadaEsteTurno;

    // Cartão bem grande, quase do tamanho da tela — é essa a diferença principal em relação ao modal normal (840x1320).
    const PAINEL_LARGURA = 980;
    const PAINEL_ALTURA = 1760;

    // Guarda os tweens contínuos para pará-los ao fechar a ficha.
    let tweensLendaria = [];
    let sunburst = this.add.star(0, 0, 24, 60, 800, 0xffd966, 0.07);
    let glowAnel = this.add
      .rectangle(0, 0, PAINEL_LARGURA + 36, PAINEL_ALTURA + 36)
      .setStrokeStyle(6, 0xffd966, 0.5);
    tweensLendaria.push(
      this.tweens.add({
        targets: sunburst,
        angle: 360,
        duration: 28000,
        repeat: -1,
      }),
      this.tweens.add({
        targets: glowAnel,
        alpha: { from: 0.35, to: 1 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );

    // Moldura dupla (borda grossa + fina por dentro), tipo quadro emoldurado — a área de dentro é quase inteira ocupada pela arte.
    let painelBg = this.criarPlacaDuelo(0, 0, PAINEL_LARGURA, PAINEL_ALTURA, 0xffd966);
    painelBg.setInteractive(new Phaser.Geom.Rectangle(-PAINEL_LARGURA / 2, -PAINEL_ALTURA / 2,
      PAINEL_LARGURA, PAINEL_ALTURA), Phaser.Geom.Rectangle.Contains);
    painelBg.on("pointerup", () => {});
    let painelBgInterno = this.add
      .rectangle(0, 0, PAINEL_LARGURA - 26, PAINEL_ALTURA - 26)
      .setStrokeStyle(2, 0xffd966, 0.7);

    // Mostra a arte inteira; o fundo cobre as margens restantes.
    const IMG_W = PAINEL_LARGURA - 52;
    const IMG_H = PAINEL_ALTURA - 52;

    let fundoArte = this.add.graphics();
    fundoArte.fillGradientStyle(corFundo, corFundo, 0x000000, 0x000000, 1);
    fundoArte.fillRect(-IMG_W / 2, -IMG_H / 2, IMG_W, IMG_H);

    let imagem, iconeImagem;
    if (carta.imagem) {
      imagem = this.add.image(0, 0, carta.imagem);
      this.aplicarRecorteCover(imagem, IMG_W, IMG_H, carta.foco);
      iconeImagem = null;
    } else {
      imagem = this.add.rectangle(0, 0, IMG_W, IMG_H, corFundo);
      iconeImagem = this.add
        .text(0, 0, ehTerreno ? "⛰" : ehEfeito ? "⚡" : "⚔", {
          fontSize: "220px",
        })
        .setOrigin(0.5);
    }

    // Losangos dourados nos 4 cantos da arte — acabamento de moldura ornamentada, tipo carta colecionável.
    let ornamentosCantos = [];
    for (const cx of [-IMG_W / 2, IMG_W / 2]) {
      for (const cy of [-IMG_H / 2, IMG_H / 2]) {
        ornamentosCantos.push(this.add.star(cx, cy, 4, 6, 15, 0xffd966, 1));
      }
    }

    let containerImagem = this.add.container(
      0,
      0,
      [fundoArte, imagem, ...ornamentosCantos, iconeImagem].filter(Boolean),
    );

    // Mede os textos antes de dimensionar a placa do título.
    let etiquetaTipo = this.add
      .text(0, 0, "CARTA LENDÁRIA", {
        fontFamily: FONTE_LENDARIA,
        fontSize: "30px",
        color: "#ffd966",
        fontStyle: "bold",
        letterSpacing: 6,
      })
      .setOrigin(0.5, 0);
    etiquetaTipo.setShadow(0, 0, "#ffcc33", 10, false, true);

    let nomeTexto = this.add
      .text(0, 0, carta.nome, {
        fontFamily: FONTE_LENDARIA,
        fontSize: "58px",
        color: "#fff1c4",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: PAINEL_LARGURA - 220 },
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);
    nomeTexto.setShadow(0, 0, "#ffcc33", 18, false, true);

    const PLACA_PAD_V = 22;
    const PLACA_PAD_H = 40;
    const GAP_ETQ_NOME = 10;
    const placaTituloAltura =
      etiquetaTipo.height + GAP_ETQ_NOME + nomeTexto.height + PLACA_PAD_V * 2;
    const placaTituloLargura = Math.min(
      PAINEL_LARGURA - 220,
      Math.max(etiquetaTipo.width, nomeTexto.width) + PLACA_PAD_H * 2,
    );
    const placaTituloTopoY = -PAINEL_ALTURA / 2 + 150;

    const placaTitulo = this.criarPlacaDuelo(0, placaTituloTopoY + placaTituloAltura / 2,
      placaTituloLargura, placaTituloAltura, 0xffd966);

    etiquetaTipo.setPosition(0, placaTituloTopoY + PLACA_PAD_V);
    nomeTexto.setPosition(
      0,
      placaTituloTopoY + PLACA_PAD_V + etiquetaTipo.height + GAP_ETQ_NOME,
    );

    tweensLendaria.push(
      this.tweens.add({
        targets: etiquetaTipo,
        alpha: { from: 0.75, to: 1 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );

    // CANTO SUPERIOR: selo de poder (esq.) e botão de fechar (dir.)
    const CANTO_Y = -PAINEL_ALTURA / 2 + 66;
    const elementosTopo = [placaTitulo, etiquetaTipo, nomeTexto];

    if (!ehEfeito && !ehTerreno) {
      const poderTexto = this.criarTextoUI(-PAINEL_LARGURA / 2 + 62, CANTO_Y, `${carta.poder} PA`, {
        fontSize: "42px", fontStyle: "bold", color: "#fff1c4", fontFamily: "Arial, sans-serif",
      }).setOrigin(0, 0.5);
      elementosTopo.push(poderTexto);
      this.somPop.play();
    }

    const fecharBtn = this.criarBotaoFecharDetalhe(PAINEL_LARGURA / 2 - 76, CANTO_Y, 0xffd966);

    // PLACA DA DESCRIÇÃO, sobreposta perto do rodapé
    const DESC_PLACA_LARGURA = PAINEL_LARGURA - 80;
    const DESC_PLACA_ALTURA = 420;
    const DESC_PLACA_TOPO_Y = PAINEL_ALTURA / 2 - DESC_PLACA_ALTURA - 46;
    const DESC_PAD = 34;
    const DESC_LARGURA = DESC_PLACA_LARGURA - DESC_PAD * 2;
    const DESC_ALTURA = DESC_PLACA_ALTURA - DESC_PAD * 2;

    const placaDescricao = this.criarPlacaDuelo(0, DESC_PLACA_TOPO_Y + DESC_PLACA_ALTURA / 2,
      DESC_PLACA_LARGURA, DESC_PLACA_ALTURA, 0xffd966);

    const descY = DESC_PLACA_TOPO_Y + DESC_PAD;

    // Diferencia ambientação e regras pela cor do texto.
    const GAP_PARTES_DESC = 14;
    let textosDescricao = [];
    let yParte = 0;
    for (const parte of carta.partesDescricao()) {
      let t = this.add
        .text(0, yParte, parte.texto, {
          fontFamily: "Arial, sans-serif",
          fontSize: "30px",
          color: parte.tipo === "efeito" ? "#ffd966" : "#f2f2f2",
          fontStyle: parte.tipo === "efeito" ? "bold" : "normal",
          align: "left",
          wordWrap: { width: DESC_LARGURA },
          lineSpacing: 10,
        })
        .setOrigin(0.5, 0);
      textosDescricao.push(t);
      yParte += t.height + GAP_PARTES_DESC;
    }
    const alturaTotalDescricao = Math.max(0, yParte - GAP_PARTES_DESC);

    let containerDescricao = this.add.container(0, descY, textosDescricao);

    // MÁSCARA (mesmo esquema usado no modal normal)
    const maskX = (LARGURA_LAYOUT - DESC_LARGURA) / 2;
    const maskY = ALTURA_LAYOUT / 2 + descY;

    let mascaraGraphics = this.add.graphics();
    mascaraGraphics.fillStyle(0xffffff);
    mascaraGraphics.fillRect(maskX, maskY, DESC_LARGURA, DESC_ALTURA);
    this.mascaraDescricaoAtual = this.aplicarMascaraRender(
      containerDescricao,
      mascaraGraphics,
    );

    const alturaExcedente = alturaTotalDescricao - DESC_ALTURA;
    if (alturaExcedente > 0) {
      let areaArraste = this.add
        .rectangle(
          0,
          DESC_ALTURA / 2,
          DESC_LARGURA,
          DESC_ALTURA,
          0xffffff,
          0.001,
        )
        .setInteractive({ useHandCursor: true });
      containerDescricao.add(areaArraste);

      let trilho = this.add
        .rectangle(
          DESC_LARGURA / 2 + 22,
          DESC_ALTURA / 2,
          6,
          DESC_ALTURA,
          0xffffff,
          0.15,
        )
        .setOrigin(0.5);
      const alturaIndicador = Math.max(
        40,
        (DESC_ALTURA / alturaTotalDescricao) * DESC_ALTURA,
      );
      let indicador = this.add
        .rectangle(DESC_LARGURA / 2 + 22, 0, 6, alturaIndicador, 0xffd966, 0.7)
        .setOrigin(0.5, 0);
      containerDescricao.add([trilho, indicador]);

      this.habilitarScrollDescricao(
        areaArraste,
        containerDescricao,
        alturaExcedente,
        DESC_ALTURA,
        indicador,
      );
    }

    const filhosPainel = [
      sunburst,
      glowAnel,
      painelBg,
      painelBgInterno,
      containerImagem, // a arte fica embaixo — placa/texto da descrição têm que aparecer por cima dela
      placaDescricao,
      containerDescricao,
      ...elementosTopo,
      fecharBtn,
    ];

    if (podeMostrarBotaoHabilidade) {
      filhosPainel.push(this.criarBotaoHabilidadeDetalhe(carta, 0,
        PAINEL_ALTURA / 2 + 108, 780, habilidadeJaUsada, 0xffd966));
    }

    let painel = this.add.container(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      filhosPainel,
    );
    painel.setDepth(4001);
    painel.setScale(0.8);
    painel.setAlpha(0);

    this.tweens.add({
      targets: painel,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: "Back.Out",
    });

    this.overlayDetalheAtual = overlay;
    this.painelDetalheAtual = painel;
    this.elevarModalCarta(overlay, painel);
    // Para os tweens contínuos ao fechar a ficha.
    this.tweensLendariaAtual = tweensLendaria;
  }

  limparEventosDescricao() {
    const handlers = this.handlersScrollDescAtual;
    if (!handlers) return;
    this.input.off("pointermove", handlers.handlerMove);
    this.input.off("pointerup", handlers.handlerUp);
    this.input.off("pointerupoutside", handlers.handlerUp);
    this.input.off("wheel", handlers.handlerWheel);
    this.handlersScrollDescAtual = null;
  }

  habilitarScrollDescricao(
    areaArraste,
    descTexto,
    alturaExcedente,
    alturaJanela,
    indicador,
  ) {
    let arrastando = false;
    let ultimoY = 0;

    // Captura a posição Y real em que o texto começa na tela
    const yInicial = descTexto.y;

    const aplicarScroll = (novoY) => {
      // Limita o scroll respeitando a posição inicial (em vez do zero absoluto)
      descTexto.y = Phaser.Math.Clamp(
        novoY,
        yInicial - alturaExcedente,
        yInicial,
      );

      if (indicador) {
        // Calcula a proporção de descida com base no quanto o texto se distanciou do yInicial
        const proporcao = (yInicial - descTexto.y) / alturaExcedente;
        indicador.y = proporcao * (alturaJanela - indicador.height);
      }
    };

    areaArraste.on("pointerdown", (pointer) => {
      arrastando = true;
      ultimoY = this.pontoDoPonteiro(pointer).y;
    });

    const handlerMove = (pointer) => {
      if (!arrastando) return;
      const y = this.pontoDoPonteiro(pointer).y;
      const delta = y - ultimoY;
      ultimoY = y;
      aplicarScroll(descTexto.y + delta);
    };

    const handlerUp = () => {
      arrastando = false;
    };

    const handlerWheel = (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.modalAberto) return;
      const bounds = areaArraste.getBounds();
      if (
        !bounds.contains(
          this.pontoDoPonteiro(pointer).x,
          this.pontoDoPonteiro(pointer).y,
        )
      )
        return;
      aplicarScroll(descTexto.y - deltaY * 0.5);
    };

    this.input.on("pointermove", handlerMove);
    this.input.on("pointerup", handlerUp);
    this.input.on("pointerupoutside", handlerUp);
    this.input.on("wheel", handlerWheel);

    // Guardado pra poder desligar (this.input.off) quando o modal fechar
    this.handlersScrollDescAtual = { handlerMove, handlerUp, handlerWheel };
  }

  // Zoom da arte completa sobre a ficha, com inclinação pelo ponteiro.
  abrirZoomCarta(carta) {
    if (!carta.imagem || this.zoomAberto) return;
    if (this.time.now < this.zoomBloqueadoAte) return;
    this.zoomAberto = true;

    // Overlay próprio: clicar fora da janela de zoom fecha só ela (não o painel de detalhe por baixo, que continua aberto normalmente).
    let overlayZoom = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      0x000000,
      0.35,
    );
    overlayZoom.setDepth(4500);
    overlayZoom.setInteractive();
    overlayZoom.on("pointerup", () => this.fecharZoomCarta());

    // O zoom é menor que a ficha; lendárias já exibem a arte ampliada.
    const ZOOM_MAX_W = 680;
    const ZOOM_MAX_H = 1040;
    const PADDING = 36;

    let imagemZoom = this.add.image(0, 0, carta.imagem);
    const nativoW = imagemZoom.width;
    const nativoH = imagemZoom.height;
    const escalaContain = Math.min(ZOOM_MAX_W / nativoW, ZOOM_MAX_H / nativoH);
    const largImg = nativoW * escalaContain;
    const altImg = nativoH * escalaContain;
    imagemZoom.setDisplaySize(largImg, altImg);

    const painelZoomBg = this.criarPlacaDuelo(0, 0, largImg + PADDING, altImg + PADDING,
      carta.lendaria ? 0xffd966 : 0x54ddff);
    // Impede que o toque na própria arte "vaze" pro overlay e feche a janela
    painelZoomBg.setInteractive(new Phaser.Geom.Rectangle(-(largImg + PADDING) / 2, -(altImg + PADDING) / 2,
      largImg + PADDING, altImg + PADDING), Phaser.Geom.Rectangle.Contains);
    painelZoomBg.on("pointerup", () => {});

    // Brilho que se desloca conforme o mouse, simulando reflexo de luz na superfície da carta (parte do efeito de "inclinar").
    let brilhoZoom = this.add
      .rectangle(0, 0, largImg, altImg, 0xffffff, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);

    let containerZoom = this.add.container(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      [painelZoomBg, imagemZoom, brilhoZoom],
    );
    containerZoom.setDepth(4501);
    containerZoom.setScale(0.85);
    containerZoom.setAlpha(0);

    this.tweens.add({
      targets: containerZoom,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.Out",
    });

    this.overlayZoomAtual = overlayZoom;
    this.painelZoomAtual = containerZoom;
    this.elevarModalCarta(overlayZoom, containerZoom);

    // Inclina a arte somente enquanto o zoom está aberto.
    const centroZoomX = LARGURA_LAYOUT / 2;
    const centroZoomY = ALTURA_LAYOUT / 2;
    const metadeLarguraZoom = largImg / 2;
    const metadeAlturaZoom = altImg / 2;
    const inclinacaoMaxGraus = 7;

    const handlerTiltZoom = (pointer) => {
      if (!this.zoomAberto || !containerZoom.active) return;

      const dx = Phaser.Math.Clamp(
        (this.pontoDoPonteiro(pointer).x - centroZoomX) / metadeLarguraZoom,
        -1,
        1,
      );
      const dy = Phaser.Math.Clamp(
        (this.pontoDoPonteiro(pointer).y - centroZoomY) / metadeAlturaZoom,
        -1,
        1,
      );

      containerZoom.rotation = dx * Phaser.Math.DegToRad(inclinacaoMaxGraus);
      containerZoom.y = ALTURA_LAYOUT / 2 + dy * 14;
      containerZoom.scaleY = 1 - Math.abs(dy) * 0.04;
      containerZoom.scaleX = 1 - Math.abs(dx) * 0.02;

      brilhoZoom.x = dx * (largImg / 3);
      brilhoZoom.y = dy * (altImg / 3.4);
    };

    this.input.on("pointermove", handlerTiltZoom);
    this.handlerTiltZoomAtual = handlerTiltZoom;
    this.somJogarCarta.play();
  }

  fecharZoomCarta() {
    if (!this.zoomAberto) return;

    if (this.tweensZoomLendariaAtual) {
      this.tweensZoomLendariaAtual.forEach((t) => t.stop());
      this.tweensZoomLendariaAtual = null;
    }

    // Bloqueia reabertura por 2s — evita reabrir na hora se o dedo/mouse ainda estiver em cima da arte logo depois de fechar.
    this.zoomBloqueadoAte = this.time.now + 2000;

    if (this.handlerTiltZoomAtual) {
      this.input.off("pointermove", this.handlerTiltZoomAtual);
      this.handlerTiltZoomAtual = null;
    }

    this.tweens.add({
      targets: this.painelZoomAtual,
      scale: 0.85,
      alpha: 0,
      duration: 130,
      ease: "Sine.easeIn",
      onComplete: () => {
        if (this.painelZoomAtual) this.painelZoomAtual.destroy();
        if (this.overlayZoomAtual) this.overlayZoomAtual.destroy();
        this.painelZoomAtual = null;
        this.overlayZoomAtual = null;
        this.zoomAberto = false;
        this.somJogarCarta.play();
      },
    });
  }

  fecharDetalheCarta(imediato = false) {
    if (!this.modalAberto) return;

    if (this.tweensLendariaAtual) {
      this.tweensLendariaAtual.forEach((t) => t.stop());
      this.tweensLendariaAtual = null;
    }

    // Fecha também o zoom para não deixar objetos órfãos.
    if (this.zoomAberto) {
      if (this.handlerTiltZoomAtual) {
        this.input.off("pointermove", this.handlerTiltZoomAtual);
        this.handlerTiltZoomAtual = null;
      }
      if (this.tweensZoomLendariaAtual) {
        this.tweensZoomLendariaAtual.forEach((t) => t.stop());
        this.tweensZoomLendariaAtual = null;
      }
      if (this.painelZoomAtual) this.painelZoomAtual.destroy();
      if (this.overlayZoomAtual) this.overlayZoomAtual.destroy();
      this.painelZoomAtual = null;
      this.overlayZoomAtual = null;
      this.zoomAberto = false;
    }

    this.limparEventosDescricao();

    const concluir = () => {
      this.limparMascaraRender(this.mascaraDescricaoAtual);
      this.mascaraDescricaoAtual = null;
      if (this.painelDetalheAtual) this.painelDetalheAtual.destroy();
      if (this.overlayDetalheAtual) this.overlayDetalheAtual.destroy();
      this.limparCamadaModalCarta();
      this.painelDetalheAtual = null;
      this.overlayDetalheAtual = null;
      this.modalAberto = false;
      this.travado = !this.ehMeuTurno;
      if (this.redesenhoAposLeitura) this.desenharInterface();
      if (!imediato) this.somJogarCarta.play();
    };
    if (imediato) concluir();
    else
      this.tweens.add({
        targets: this.painelDetalheAtual,
        scale: 0.8,
        alpha: 0,
        duration: 150,
        ease: "Sine.easeIn",
        onComplete: concluir,
      });
  }

  // HABILIDADE ATIVA (ex: Atirador de Elite) Chamada pelo botão "Ativar Habilidade" do modal de detalhe.
  iniciarAtivacaoHabilidade(carta) {
    if (this.training && !this.training.canUse(carta)) return;
    if (!this.podeUsarHabilidadesAgora()) return;
    if (this.partida.partidaEncerrada) return;

    const dono = this.partida.jogador;
    const oponente = this.partida.inimigo;
    const alvos = this.partida.alvosParaHabilidadeEmCampo(
      carta,
      dono,
      oponente,
    );
    const atingeTodos = !!(carta.efeito && carta.efeito.atingeTodos);
    // Machine Learning seleciona uma carta aliada.
    const ehBuffAliado =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO;
    // O Gestor seleciona duas aliadas distintas para transferir PA.
    const ehRedistribuir =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.REDISTRIBUIR_PODER;
    // Cessar e Desistir seleciona um terreno inimigo.
    const ehDestruirTerreno =
      carta.efeito &&
      carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO;
    // O Boi seleciona uma carta de qualquer campo.
    const ehResetarPoder =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.RESETAR_PODER;
    // O Tigre seleciona até dois inimigos dentro do alcance.
    const ehAtaqueDuplo =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.ATACAR_DOIS_ALVOS;
    // A Aranha (Override): alvo é uma carta INIMIGA (mesmo modo de mira de ATACAR/Cessar e Desistir), só com texto de instrução próprio.
    const ehOverride =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.OVERRIDE;
    // O Rato seleciona qualquer carta inimiga válida.
    const ehRoubarPoder =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.ROUBAR_PODER;
    // A Cabra seleciona um slot do próprio campo, livre ou ocupado.
    const ehReposicionar =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.REPOSICIONAR;
    // A Cobra (Dose Letal): alvo é uma carta INIMIGA em alcance curto — mesmo modo de mira de ATACAR, só com texto de instrução próprio.
    const ehEnvenenar =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.ENVENENAR;
    const ehDistribuirDano =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.DISTRIBUIR_DANO;
    const ehBuffAteDois =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.BUFF_ATE_DOIS_ALIADOS;

    this.travado = true;
    this.esconderRodaBotoes();

    // "Atinge todos" não precisa de escolha (acerta o range inteiro de uma vez). Sem nenhum alvo em alcance também não há o que escolher.
    if (carta.efeito?.tipo === TIPOS_EFEITO.RENOVAR_MAO) {
      this.executarHabilidade(carta, null);
      return;
    }
    if (atingeTodos) {
      this.executarHabilidade(carta, null);
      return;
    }
    if (alvos.length === 0) {
      this.avisarSemAlvo();
      return;
    }

    // Mesmo com um único alvo possível, o jogador escolhe ativamente tocando nele — assim ele sempre confirma a ação, em vez do jogo disparar sozinho.
    if (carta.efeito.tipo === TIPOS_EFEITO.SINDICATO) {
      this.iniciarSelecaoSindicato(carta, alvos);
    } else if (ehBuffAteDois) {
      this.iniciarSelecaoDeBuffAteDois(carta, alvos);
    } else if (ehDistribuirDano) {
      this.iniciarDistribuicaoDeDano(carta, alvos);
    } else if (ehRedistribuir) {
      // Precisa de pelo menos 2 aliadas em campo (o Gestor + mais uma) pra fazer sentido escolher "quem perde" e "quem ganha" separadamente.
      const todosAliados = dono.campo.cartas
        .map((alvo, indice) =>
          alvo && alvo.tipo !== "terreno" ? indice : null,
        )
        .filter((indice) => indice !== null);
      const existeParValido = alvos.some((doador) =>
        todosAliados.some((alvo) => alvo !== doador),
      );
      if (!existeParValido) {
        this.avisarSemAlvo();
        return;
      }
      this.iniciarSelecaoDePerdaRedistribuir(carta, alvos, todosAliados);
    } else if (ehAtaqueDuplo && alvos.length >= 2) {
      this.iniciarSelecaoDoPrimeiroAlvoDuplo(carta, alvos);
    } else if (ehBuffAliado) {
      this.iniciarSelecaoDeAliadoParaHabilidade(carta, alvos);
    } else if (ehResetarPoder) {
      this.iniciarSelecaoDeQualquerCartaParaHabilidade(
        carta,
        alvos,
        "Toque em 1 carta de qualquer lado.\nEla volta ao PA original.",
      );
    } else if (ehDestruirTerreno) {
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        "Toque em 1 terreno inimigo destacado para removê-lo.",
      );
    } else if (carta.efeito.tipo === TIPOS_EFEITO.SILENCIAR_CARTA) {
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        "Toque em 1 carta inimiga.\nOs efeitos dela serão bloqueados.",
      );
    } else if (ehOverride) {
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        "Toque em 1 inimigo com menos PA que a Aranha.\nOs pontos dele passam para você.",
      );
    } else if (ehRoubarPoder) {
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        `Toque em 1 carta inimiga.\nRoube ${carta.efeito.valor} PA para esta carta.`,
      );
    } else if (ehReposicionar) {
      this.iniciarSelecaoDeAliadoParaHabilidade(
        carta,
        alvos,
        "Toque em um espaço aliado.\nMova a Cabra ou troque com a carta ali.",
      );
    } else if (ehEnvenenar) {
      this.iniciarSelecaoDeAlvo(
        carta,
        alvos,
        `Toque em 1 carta inimiga.\nAplique ${carta.efeito.valor} de veneno por turno.`,
      );
    } else {
      this.iniciarSelecaoDeAlvo(carta, alvos);
    }
  }

  iniciarSelecaoSindicato(carta, alvos) {
    const { acao, alvo } = carta.efeito;
    const tam = this.partida.jogador.campo.cartas.length;
    const limpar = () => {
      this.objetosSelecaoAlvo?.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    };
    const escolher = (indices, texto, callback) => {
      limpar();
      this.iniciarSelecaoDeQualquerCartaParaHabilidade(
        carta,
        indices,
        texto,
        callback,
      );
    };
    const instrucoes = {
      proteger: "Escolha uma aliada para proteger até o próximo turno",
      mover: "Escolha a aliada que deseja mover",
      aprender: "Escolha a habilidade para aprender (esta carta perde 2 PA)",
      bloquear_bonus: "Escolha uma inimiga para bloquear seus bônus",
      advertir: "Escolha uma inimiga para advertir",
      curar: "Escolha uma aliada para recuperar até 4 PA",
      opiniao: "1 de 2 • Toque em uma carta.\nAliado: +2 PA. Inimigo: −2 PA.",
      reativar: "Escolha uma aliada para liberar sua habilidade novamente",
    };
    escolher(
      alvos.map((i) => (alvo === "inimigo" ? i + tam : i)),
      instrucoes[acao],
      (indice) => {
        const primeiro = alvo === "inimigo" ? indice - tam : indice;
        if (acao === "mover") {
          const livres = this.partida.jogador.campo.cartas.flatMap((c, i) =>
            c === null ? [i] : [],
          );
          escolher(livres, "Escolha o espaço livre de destino", (destino) =>
            this.executarHabilidade(carta, primeiro, destino),
          );
        } else if (acao === "opiniao") {
          escolher(
            alvos.filter((i) => i !== primeiro),
            "2 de 2 • Toque em outra carta.\nAliado: +2 PA. Inimigo: −2 PA.",
            (segundo) => this.executarHabilidade(carta, primeiro, segundo),
          );
        } else this.executarHabilidade(carta, primeiro);
      },
    );
  }

  // Cada toque aloca dano; permite confirmar antes de gastar toda a reserva.
  iniciarDistribuicaoDeDano(carta, alvos) {
    const ehBom = (carta.habilidadeAprendidaDe || carta.nome) === "O Bom";
    const chaveMarcador = ehBom ? "efeitoBom" : "efeitoDiego";
    const total = carta.efeito.total || 6;
    const totalDistribuivel = Math.min(
      total,
      carta.efeito.alvosUnicos
        ? alvos.length
        : alvos.reduce(
            (soma, indice) =>
              soma + this.partida.inimigo.campo.cartas[indice].poder,
            0,
          ),
    );
    const distribuicao = [];
    const contagens = new Map();
    const objetos = [];
    const L = this.layout;

    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    objetos.push(overlay);

    const instrucao = this.criarInstrucaoSelecao(`Distribua até ${totalDistribuivel} PA de dano.\n${carta.efeito.alvosUnicos ? "Toque em inimigos diferentes." : "Cada toque em um inimigo adiciona 1 de dano."}`,
        {
          fontSize: "38px",
          color: "#ffcc66",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3900);
    const contador = this.add
      .text(LARGURA_LAYOUT / 2, 265, `Restam: ${totalDistribuivel}`, {
        fontSize: "30px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(instrucao, contador);

    const limpar = () => {
      objetos.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    };
    overlay.on("pointerup", () => {
      if (distribuicao.length) return;
      limpar();
      this.cancelarSelecaoDeAlvo();
    });

    let btnConfirmar = null;
    const atualizar = () => {
      contador.setText(`Restam: ${totalDistribuivel - distribuicao.length}`);
      if (btnConfirmar)
        btnConfirmar.setAlpha(distribuicao.length > 0 ? 1 : 0.35);
      if (btnConfirmar)
        btnConfirmar.list
          .find((objeto) => objeto.type === "Text")
          ?.setText(`Confirmar ${distribuicao.length} de dano`);
    };

    alvos.forEach((indice) => {
      const xPos = L.x[indice % 5];
      const yPos = L.yInimigo[Math.floor(indice / 5)];
      const anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xff7744, 0)
        .setStrokeStyle(8, 0xff7744, 1)
        .setDepth(3800);
      const zonaMais = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3803)
        .setInteractive({ useHandCursor: true });
      zonaMais.on("pointerup", () => {
        const vidaDoAlvo = this.partida.inimigo.campo.cartas[indice].poder;
        if (
          distribuicao.length >= totalDistribuivel ||
          (carta.efeito.alvosUnicos && (contagens.get(indice) || 0) >= 1) ||
          (contagens.get(indice) || 0) >= vidaDoAlvo
        )
          return;
        distribuicao.push(indice);
        contagens.set(indice, (contagens.get(indice) || 0) + 1);
        const ponto = contagens.get(indice) - 1;
        const tamanho = ehBom ? Math.min(112, L.slotW * 0.68) : Math.min(46, L.slotW / 4);
        const x = ehBom ? xPos : xPos + ((ponto % 3) - 1) * (tamanho + 4);
        const y = ehBom ? yPos : yPos - tamanho / 2 + Math.floor(ponto / 3) * (tamanho + 4);
        const marcador = this.textures.exists(chaveMarcador)
          ? this.add.image(x, y, chaveMarcador)
          : this.add
              .text(x, y, ehBom ? "◆" : "☠", {
                fontSize: `${tamanho}px`,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
              })
              .setOrigin(0.5);
        if (this.textures.exists(chaveMarcador)) {
          if (ehBom) marcador.setScale(tamanho / marcador.width);
          else marcador.setDisplaySize(tamanho, tamanho);
        }
        objetos.push(marcador.setDepth(3804));
        atualizar();
      });
      objetos.push(anel, zonaMais);
    });

    btnConfirmar = this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2,
      Y_MAO_JOGADOR - 60,
      "Confirmar 0 de dano",
      0x884422,
      () => {
        if (distribuicao.length === 0) return;
        limpar();
        this.executarHabilidade(carta, distribuicao);
      },
    );
    btnConfirmar.setAlpha(0.35);
    objetos.push(btnConfirmar);
    this.objetosSelecaoAlvo = objetos;
  }

  criarInstrucaoSelecao(texto, estilo = {}) {
    const instrucao = this.add.text(LARGURA_LAYOUT / 2, 165, texto, {
      ...estilo, fontFamily: "Arial, sans-serif", fontSize: "32px", align: "center",
      backgroundColor: "#071b16", padding: { x: 20, y: 14 },
      wordWrap: { width: LARGURA_LAYOUT - 160, useAdvancedWrap: true },
      lineSpacing: 6,
    }).setOrigin(0.5).setDepth(3900);
    instrucao.setScale(Math.min(1, (LARGURA_LAYOUT - 80) / instrucao.width, 120 / instrucao.height));
    instrucao.instrucaoHabilidade = true;
    if (this.cache?.audio.exists("somAlvo")) this.sound.play("somAlvo", { volume: window.cyberduelSettings?.effects(0.18) ?? 0.18 });
    return instrucao;
  }

  // Avisa sobre a falta de alvos sem gastar a habilidade.
  avisarSemAlvo() {
    let texto = this.criarInstrucaoSelecao("Nenhum alvo em alcance", {
        fontSize: "36px",
        color: "#ff8888",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900)
      .setAlpha(0);

    this.tweens.add({
      targets: texto,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 900,
      onComplete: () => texto.destroy(),
    });

    this.travado = false;
    this.desenharRodaBotoes();
  }

  // Destaca alvos válidos; tocar fora cancela sem gastar a habilidade.
  iniciarSelecaoDeAlvo(
    carta,
    alvos,
    textoInstrucao = `Toque em 1 inimigo destacado.\nEle perde ${carta.efeito.valor || 0} PA.`,
    aoEscolher = null,
    aoCancelar = null,
  ) {
    const L = this.layout;
    const objetos = [];

    // Escurece o fundo sem esconder os alvos.
    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => {
      this.cancelarSelecaoDeAlvo();
      if (aoCancelar) aoCancelar();
    });
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(textoInstrucao, {
        fontSize: "40px",
        color: "#ffcc00",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];
      const raio = Math.max(L.slotW, L.slotH) / 2 + 16;

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffcc00, 0)
        .setStrokeStyle(8, 0xffcc00, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        aoEscolher
          ? aoEscolher(indice)
          : this.executarHabilidade(carta, indice),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  cancelarSelecaoDeAlvo() {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }
    this.travado = false;
    this.desenharRodaBotoes();
  }

  // Seleciona uma carta do deck antes de consumir a conjuração.
  iniciarSelecaoDeCartaDoBaralho(gameObject, carta, origem = "deck") {
    const deck =
      origem === "descarte"
        ? this.partida.jogador.descarte.filter((item) => item !== carta)
        : carta.efeito?.tipo === TIPOS_EFEITO.BUSCAR_CARTA_DECK
          ? this.partida.jogador.deck.cartas.slice(
              0,
              Math.max(
                0,
                this.partida.jogador.deck.cartas.length -
                  this.partida.jogador.mao.cartas.filter((c) => c !== carta)
                    .length,
              ),
            )
          : this.partida.jogador.deck.cartas;

    if (deck.length === 0) {
      if (carta.efeito?.tipo === TIPOS_EFEITO.BUSCAR_CARTA_DECK) {
        this.conjurarCartaDeEfeitoJogador(gameObject, carta, null);
        return;
      }
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    this.travado = true;
    this.esconderRodaBotoes();

    const objetos = [];
    let objetosPagina = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.86,
      )
      .setDepth(3900)
      .setInteractive();
    overlay.on("pointerup", () =>
      this.cancelarSelecaoDeCartaDoBaralho(gameObject),
    );
    objetos.push(overlay);

    const painel = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        920,
        1200,
        0x11121c,
        0.98,
      )
      .setStrokeStyle(7, 0xffcc00)
      .setDepth(3910)
      .setInteractive();
    objetos.push(painel);

    let textoInstr = this.add
      .text(
        LARGURA_LAYOUT / 2,
        520,
        origem === "descarte" ? "RECICLAGEM" : "SUGESTÃO ALGORÍTMICA",
        {
          fontSize: "46px",
          color: "#ffcc00",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3950);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(
        LARGURA_LAYOUT / 2,
        580,
        origem === "descarte"
          ? "Escolha uma carta do descarte para recuperar"
          : "Escolha uma carta para adicionar à sua mão",
        {
          fontSize: "27px",
          color: "#dddddd",
        },
      )
      .setOrigin(0.5)
      .setDepth(3950);
    objetos.push(textoCancelar);

    const porPagina = 6;
    const totalPaginas = Math.ceil(deck.length / porPagina);
    let pagina = 0;

    const renderizarPagina = () => {
      objetosPagina.forEach((o) => o.destroy());
      objetosPagina = [];
      const inicio = pagina * porPagina;
      deck.slice(inicio, inicio + porPagina).forEach((cartaDeck, local) => {
        const indiceReal = inicio + local;
        const col = local % 3;
        const linha = Math.floor(local / 3);
        const x = 285 + col * 255;
        const y = 790 + linha * 405;
        const cardW = 220;
        const cardH = 360;
        const arteH = 270;
        const corFundo = this.obterCorPorId(cartaDeck.id);

        const moldura = this.add
          .rectangle(x, y, cardW, cardH, 0x252638, 1)
          .setStrokeStyle(5, cartaDeck.lendaria ? 0xffd700 : 0xffffff)
          .setDepth(3950)
          .setInteractive({ useHandCursor: true });
        const arte = cartaDeck.imagem
          ? this.add
              .image(x, y - 36, cartaDeck.imagem)
              .setDisplaySize(cardW - 16, arteH)
          : this.add.rectangle(x, y - 36, cardW - 16, arteH, corFundo);
        arte.setDepth(3951);
        const nomeTxt = this.add
          .text(x, y + 112, cartaDeck.nome, {
            fontSize: "20px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: cardW - 18 },
          })
          .setOrigin(0.5, 0)
          .setDepth(3952);
        const alturaNome = 58;
        const mascaraGrafico = this.add.graphics();
        mascaraGrafico.fillStyle(0xffffff, 1);
        mascaraGrafico.fillRect(
          x - cardW / 2 + 8,
          y + 108,
          cardW - 16,
          alturaNome,
        );
        const mascaraNome = this.aplicarMascaraRender(nomeTxt, mascaraGrafico);

        let tweenNome = null;
        if (nomeTxt.height > alturaNome) {
          const excesso = nomeTxt.height - alturaNome + 8;
          tweenNome = this.tweens.add({
            targets: nomeTxt,
            y: nomeTxt.y - excesso,
            duration: Math.max(1200, excesso * 55),
            delay: 700,
            hold: 900,
            yoyo: true,
            repeat: -1,
            repeatDelay: 500,
            ease: "Sine.easeInOut",
          });
        }
        moldura.on("pointerover", () => moldura.setScale(1.04));
        moldura.on("pointerout", () => moldura.setScale(1));
        moldura.on("pointerup", () =>
          this.confirmarEscolhaCartaDoBaralho(gameObject, carta, indiceReal),
        );
        objetosPagina.push(
          {
            destroy: () => {
              if (tweenNome) tweenNome.stop();
              this.limparMascaraRender(mascaraNome);
            },
          },
          moldura,
          arte,
          nomeTxt,
        );
      });

      const paginaTxt = this.add
        .text(LARGURA_LAYOUT / 2, 1480, `${pagina + 1} / ${totalPaginas}`, {
          fontSize: "28px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(3952);
      objetosPagina.push(paginaTxt);

      if (pagina > 0) {
        const anterior = this.criarBotaoConfirmacao(
          320,
          1480,
          "‹ Anterior",
          0x3a3a55,
          () => {
            pagina--;
            renderizarPagina();
          },
        ).setDepth(3953);
        objetosPagina.push(anterior);
      }
      if (pagina < totalPaginas - 1) {
        const proxima = this.criarBotaoConfirmacao(
          760,
          1480,
          "Próxima ›",
          0x3a3a55,
          () => {
            pagina++;
            renderizarPagina();
          },
        ).setDepth(3953);
        objetosPagina.push(proxima);
      }
    };

    renderizarPagina();
    objetos.push({ destroy: () => objetosPagina.forEach((o) => o.destroy()) });

    this.objetosSelecaoBaralho = objetos;
  }

  confirmarEscolhaCartaDoBaralho(gameObject, carta, indiceEscolhido) {
    if (this.objetosSelecaoBaralho) {
      this.objetosSelecaoBaralho.forEach((o) => o.destroy());
      this.objetosSelecaoBaralho = null;
    }
    this.desenharRodaBotoes();
    this.conjurarCartaDeEfeitoJogador(gameObject, carta, indiceEscolhido);
    this.somPop.play();
  }

  cancelarSelecaoDeCartaDoBaralho(gameObject) {
    if (this.objetosSelecaoBaralho) {
      this.objetosSelecaoBaralho.forEach((o) => o.destroy());
      this.objetosSelecaoBaralho = null;
    }
    this.travado = false;
    this.animarRetornoAoLeque(gameObject, false);
  }

  // O Cavalo seleciona uma coluna inimiga com alvo válido.
  iniciarSelecaoDeColunaInimiga(gameObject, carta) {
    const colunas = this.partida.colunasComAlvoInimigo();
    if (colunas.length === 0) {
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    this.travado = true;
    this.esconderRodaBotoes();
    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () =>
      this.cancelarSelecaoDeColunaInimiga(gameObject),
    );
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(`Toque em 1 coluna inimiga.\nTodas as cartas nela perdem ${carta.efeito.valor} PA.`,
        {
          fontSize: "36px",
          color: "#ff9b6b",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    colunas.forEach((col) => {
      const xPos = L.x[col];
      const yTopo = L.yInimigo[0];
      const yBase = L.yInimigo[1];
      const alturaTotal = yBase - yTopo + L.slotH;
      const yCentro = (yTopo + yBase) / 2;

      let anel = this.add
        .rectangle(xPos, yCentro, L.slotW + 12, alturaTotal + 12, 0xff9b6b, 0)
        .setStrokeStyle(8, 0xff9b6b, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.04,
        scaleY: 1.04,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(
          xPos,
          yCentro,
          L.slotW + 12,
          alturaTotal + 12,
          0xffffff,
          0.001,
        )
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.confirmarEscolhaColunaInimiga(gameObject, carta, col),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoColuna = objetos;
  }

  confirmarEscolhaColunaInimiga(gameObject, carta, colunaEscolhida) {
    if (this.objetosSelecaoColuna) {
      this.objetosSelecaoColuna.forEach((o) => o.destroy());
      this.objetosSelecaoColuna = null;
    }
    this.desenharRodaBotoes();
    this.conjurarCartaDeEfeitoJogador(gameObject, carta, colunaEscolhida);
    this.somPop.play();
  }

  cancelarSelecaoDeColunaInimiga(gameObject) {
    if (this.objetosSelecaoColuna) {
      this.objetosSelecaoColuna.forEach((o) => o.destroy());
      this.objetosSelecaoColuna = null;
    }
    this.travado = false;
    this.animarRetornoAoLeque(gameObject, false);
  }

  // A Travessura do Macaco: destaca todos os slots vazios do inimigo e guarda a armadilha no campo até uma carta ser invocada naquele espaço.
  iniciarSelecaoDeArmadilha(gameObject, carta) {
    const alvos = this.partida.inimigo.campo.cartas
      .map((c, i) =>
        !c && !this.partida.inimigo.campo.armadilhas.has(i) ? i : null,
      )
      .filter((i) => i !== null);
    if (!alvos.length) {
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    this.travado = true;
    this.esconderRodaBotoes();
    const objetos = [];
    const L = this.layout;
    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    objetos.push(overlay);

    const cancelar = () => {
      objetos.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
      this.desenharRodaBotoes();
      this.animarRetornoAoLeque(gameObject, false);
    };
    overlay.on("pointerup", cancelar);
    objetos.push(
      this.criarInstrucaoSelecao(`Toque em 1 espaço vazio inimigo.\nA próxima carta ali perde ${carta.efeito.valor} PA.`, {
          fontSize: "36px",
          color: "#ff9b6b",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(3900),
    );

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];
      const anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xff9b6b, 0)
        .setStrokeStyle(8, 0xff9b6b, 1)
        .setDepth(3800);
      const zona = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zona.on("pointerup", () => {
        objetos.forEach((o) => o.destroy());
        this.objetosSelecaoAlvo = null;
        this.desenharRodaBotoes();
        this.conjurarCartaDeEfeitoJogador(gameObject, carta, indice);
        this.somPop.play();
      });
      objetos.push(anel, zona);
    });
    this.objetosSelecaoAlvo = objetos;
  }

  iniciarSelecaoDeAliadoIsolado(gameObject, carta) {
    const campo = this.partida.jogador.campo.cartas;
    const adjacentes = (i) => {
      const linha = Math.floor(i / 5);
      const coluna = i % 5;
      return [
        coluna > 0 ? i - 1 : null,
        coluna < 4 ? i + 1 : null,
        linha > 0 ? i - 5 : null,
        linha < 1 ? i + 5 : null,
      ].filter((v) => v !== null);
    };
    const alvos = campo
      .map((c, i) =>
        c &&
        c.tipo !== "terreno" &&
        adjacentes(i).every((vizinho) => !campo[vizinho])
          ? i
          : null,
      )
      .filter((i) => i !== null);

    if (!alvos.length) {
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    this.travado = true;
    this.esconderRodaBotoes();
    const objetos = [];
    const L = this.layout;
    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    const cancelar = () => {
      objetos.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
      this.desenharRodaBotoes();
      this.animarRetornoAoLeque(gameObject, false);
    };
    overlay.on("pointerup", cancelar);
    objetos.push(overlay);
    objetos.push(
      this.criarInstrucaoSelecao("Escolha uma carta aliada sem vizinhos",
          {
            fontSize: "36px",
            color: "#88ff99",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 6,
          },
        )
        .setOrigin(0.5)
        .setDepth(3900),
    );
    alvos.forEach((indice) => {
      const xPos = L.x[indice % 5];
      const yPos = L.yJogador[Math.floor(indice / 5)];
      const anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
        .setStrokeStyle(8, 0x88ff99, 1)
        .setDepth(3800);
      const zona = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zona.on("pointerup", () => {
        objetos.forEach((o) => o.destroy());
        this.objetosSelecaoAlvo = null;
        this.desenharRodaBotoes();
        this.conjurarCartaDeEfeitoJogador(gameObject, carta, indice);
        this.somPop.play();
      });
      objetos.push(anel, zona);
    });
    this.objetosSelecaoAlvo = objetos;
  }

  // O Canto do Galo: exige dois aliados distintos. A ordem importa porque o primeiro recebe +2 PA e o segundo +1 PA.
  iniciarSelecaoDoCantoDoGalo(gameObject, carta, primeiroAlvo = null) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
    }

    const alvos = this.partida.jogador.campo.cartas
      .map((c, i) =>
        c && c.tipo !== "terreno" && i !== primeiroAlvo ? i : null,
      )
      .filter((i) => i !== null);

    // A carta só pode ser conjurada quando há dois aliados válidos.
    if ((primeiroAlvo === null && alvos.length < 2) || alvos.length === 0) {
      this.objetosSelecaoAlvo = null;
      this.animarRetornoAoLeque(gameObject, true);
      return;
    }

    this.travado = true;
    this.esconderRodaBotoes();
    const objetos = [];
    const L = this.layout;
    const etapa = primeiroAlvo === null ? 1 : 2;

    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => {
      objetos.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
      this.desenharRodaBotoes();
      this.animarRetornoAoLeque(gameObject, false);
    });
    objetos.push(overlay);

    objetos.push(
      this.criarInstrucaoSelecao(etapa === 1
            ? `1 de 2 • Toque no aliado que recebe +${carta.efeito.valores[0]} PA.`
            : `2 de 2 • Toque em outro aliado para receber +${carta.efeito.valores[1]} PA.`,
          {
            fontSize: "38px",
            color: "#88ff99",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 6,
          },
        )
        .setOrigin(0.5)
        .setDepth(3900),
    );

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];
      const anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
        .setStrokeStyle(8, 0x88ff99, 1)
        .setDepth(3800);
      const zona = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zona.on("pointerup", () => {
        objetos.forEach((o) => o.destroy());
        this.objetosSelecaoAlvo = null;
        if (primeiroAlvo === null) {
          this.iniciarSelecaoDoCantoDoGalo(gameObject, carta, indice);
        } else {
          this.desenharRodaBotoes();
          this.conjurarCartaDeEfeitoJogador(gameObject, carta, [
            primeiroAlvo,
            indice,
          ]);
          this.somPop.play();
        }
      });
      objetos.push(anel, zona);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Destaca aliadas válidas para Machine Learning.
  iniciarSelecaoDeAliadoParaHabilidade(
    carta,
    alvos,
    textoInstrucao = `Toque em 1 aliado destacado.\nEle recebe +${carta.efeito.valor || 0} PA.`,
  ) {
    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(textoInstrucao, {
        fontSize: "40px",
        color: "#88ff99",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];
      const raio = Math.max(L.slotW, L.slotH) / 2 + 16;

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
        .setStrokeStyle(8, 0x88ff99, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () => this.executarHabilidade(carta, indice));

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  iniciarSelecaoDeBuffAteDois(carta, alvos, primeiroAlvo = null) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }
    const L = this.layout;
    const objetos = [];
    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () =>
      primeiroAlvo === null
        ? this.cancelarSelecaoDeAlvo()
        : this.executarHabilidade(carta, [primeiroAlvo]),
    );
    objetos.push(overlay);
    const instrucao = this.criarInstrucaoSelecao(primeiroAlvo === null
          ? "Escolha a primeira aliada para reparar (1/2)"
          : "Escolha a segunda aliada (2/2)",
        {
          fontSize: "40px",
          color: "#88ff99",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(instrucao);
    alvos
      .filter((indice) => indice !== primeiroAlvo)
      .forEach((indice) => {
        const col = indice % 5;
        const fileira = Math.floor(indice / 5);
        const xPos = L.x[col];
        const yPos = L.yJogador[fileira];
        const anel = this.add
          .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
          .setStrokeStyle(8, 0x88ff99, 1)
          .setDepth(3800);
        const zona = this.add
          .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
          .setDepth(3801)
          .setInteractive({ useHandCursor: true });
        zona.on("pointerup", () => {
          if (primeiroAlvo === null)
            this.iniciarSelecaoDeBuffAteDois(carta, alvos, indice);
          else this.executarHabilidade(carta, [primeiroAlvo, indice]);
        });
        objetos.push(anel, zona);
      });
    this.objetosSelecaoAlvo = objetos;
  }

  // O Boi destaca ambos os campos; índices inimigos começam em TAM.
  iniciarSelecaoDeQualquerCartaParaHabilidade(
    carta,
    alvos,
    textoInstrucao = "Escolha uma carta para redefinir o poder",
    aoEscolher = null,
  ) {
    const L = this.layout;
    const objetos = [];
    const TAM = this.partida.jogador.campo.cartas.length;

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(textoInstrucao, {
        fontSize: "40px",
        color: "#88ff99",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvos.forEach((indiceDeslocado) => {
      const ehInimigo = indiceDeslocado >= TAM;
      const indice = ehInimigo ? indiceDeslocado - TAM : indiceDeslocado;
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = ehInimigo ? L.yInimigo[fileira] : L.yJogador[fileira];
      const cor = ehInimigo ? 0xffcc00 : 0x88ff99;

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, cor, 0)
        .setStrokeStyle(8, cor, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        aoEscolher
          ? aoEscolher(indiceDeslocado)
          : this.executarHabilidade(carta, indiceDeslocado),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Resolve a habilidade e anima as cartas afetadas.
  executarHabilidade(carta, alvoEscolhido, alvoSecundario = null) {
    if (this.training && !this.training.canUse(carta, alvoEscolhido)) return;
    if (!this.podeUsarHabilidadesAgora()) return;
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const resultado = this.partida.ativarHabilidade(
      carta,
      this.partida.jogador,
      this.partida.inimigo,
      alvoEscolhido,
      alvoSecundario,
    );

    if (resultado.sucesso) {
      this.training?.used(carta);
      const finalizar = () => {
        this.processarCartasAfetadas(resultado.afetadas, () => {
          this.travado = false;
          this.desenharInterface();
        });
      };

      if (
        !window.CenaEfeitos &&
        carta.efeito.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO
      ) {
        // Agora passamos o alvoEscolhido para a animação!
        this.animarEfeitoAdvogado(alvoEscolhido, finalizar);
      } else {
        finalizar();
      }
    } else {
      this.travado = false;
      this.desenharRodaBotoes();
    }
  }
  animarEfeitoAdvogado(alvoEscolhido, aoConcluir, campoAliado = false) {
    // Posição padrão no centro, caso algo dê errado
    let xPos = LARGURA_LAYOUT / 2;
    let yPos = ALTURA_LAYOUT / 2;

    // Se temos um alvo, calculamos a posição dele no campo inimigo
    if (alvoEscolhido !== null && alvoEscolhido !== undefined) {
      const L = this.layout;
      const col = alvoEscolhido % 5;
      const fileira = Math.floor(alvoEscolhido / 5);
      xPos = L.x[col];
      yPos = (campoAliado ? L.yJogador : L.yInimigo)[fileira];
    }

    // 1. Cria a imagem na posição exata do terreno alvo
    let imgEfeito = this.add.image(xPos, yPos, "efeitoAdvogado");
    imgEfeito.setDepth(4500); // Fica por cima de tudo
    imgEfeito.setScale(0); // Começa invisível para dar um efeito de "pop"

    this.tweens.add({
      targets: imgEfeito,
      scale: 0.5, // Aumentei um pouco para cobrir bem a carta
      duration: 300,
      ease: "Back.Out",
    });

    // 2. Toca o som do advogado
    const som = this.sound.add("somAdvogado", {
      loop: false,
      volume: window.cyberduelSettings?.effects(0.3) ?? 0.3,
    });
    som.play();

    // Um timer garante a conclusão mesmo se o navegador bloquear o áudio.
    let finalizado = false;
    const finalizarRemocao = () => {
      if (finalizado) return;
      finalizado = true;
      this.tweens.add({
        targets: imgEfeito,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          if (imgEfeito.active) imgEfeito.destroy();
          aoConcluir();
        },
      });
    };

    // 3. Quando o som terminar de tocar, remove a imagem.
    som.once("complete", finalizarRemocao);

    // Duração visual máxima, mesmo com áudio bloqueado ou sem evento.
    this.time.delayedCall(1100, finalizarRemocao);
  }

  // Seleciona a aliada que perde PA, incluindo o próprio Gestor.
  iniciarSelecaoDePerdaRedistribuir(carta, alvos, todosAliados = alvos) {
    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(`1 de 2 • Toque no aliado que perde ${carta.efeito.perda || 2} PA.`, {
        fontSize: "40px",
        color: "#ff8888",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xff8888, 0)
        .setStrokeStyle(8, 0xff8888, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.iniciarSelecaoDeGanhoRedistribuir(
          carta,
          indice,
          todosAliados.filter((i) => i !== indice),
        ),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Seleciona uma aliada diferente para receber PA.
  iniciarSelecaoDeGanhoRedistribuir(carta, alvoPerda, alvosRestantes) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(`2 de 2 • Toque em outro aliado para ganhar ${carta.efeito.ganho || 4} PA.`, {
        fontSize: "40px",
        color: "#88ff99",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvosRestantes.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
        .setStrokeStyle(8, 0x88ff99, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.executarHabilidade(carta, alvoPerda, indice),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Seleciona dois inimigos distintos para o Tigre.
  iniciarSelecaoDoPrimeiroAlvoDuplo(carta, alvos) {
    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(`1 de 2 • Toque no primeiro inimigo.\nCada alvo perde ${carta.efeito.valor} PA.`, {
        fontSize: "40px",
        color: "#ffcc00",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora dos destaques para cancelar", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffcc00, 0)
        .setStrokeStyle(8, 0xffcc00, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.iniciarSelecaoDoSegundoAlvoDuplo(
          carta,
          indice,
          alvos.filter((i) => i !== indice),
        ),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  iniciarSelecaoDoSegundoAlvoDuplo(carta, alvo1, alvosRestantes) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    // Tocar fora após o primeiro alvo confirma o ataque com apenas ele.
    overlay.on("pointerup", () => this.executarHabilidade(carta, alvo1));
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(`2 de 2 • Toque em outro inimigo.\nEle também perde ${carta.efeito.valor} PA.`, {
        fontSize: "40px",
        color: "#ffcc00",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoCancelar = this.add
      .text(LARGURA_LAYOUT / 2, 260, "Toque fora para atingir apenas o primeiro alvo", {
        fontSize: "26px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoCancelar);

    alvosRestantes.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffcc00, 0)
        .setStrokeStyle(8, 0xffcc00, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.executarHabilidade(carta, alvo1, indice),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Venda Casada seleciona uma aliada, inclusive o CyberVendedor.
  iniciarSelecaoDeAliadoParaBuff(carta, posicaoPropria) {
    const L = this.layout;
    const objetos = [];

    const exigeEscolhaExplicita =
      carta.efeito.tipo === TIPOS_EFEITO.VINCULO_ALIADO;
    const indicesAliados = exigeEscolhaExplicita
      ? this.partida.alvosParaVinculoAliado(carta, this.partida.jogador)
      : this.partida.jogador.campo.cartas.flatMap((c, i) =>
          c && c.tipo !== "terreno" ? [i] : [],
        );

    if (!indicesAliados.length) {
      this.confirmarEscolhaBuffAliado(carta, posicaoPropria, null);
      return;
    }
    this.travado = true;

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => {
      if (!exigeEscolhaExplicita)
        this.confirmarEscolhaBuffAliado(
          carta,
          posicaoPropria,
          indicesAliados[0],
        );
    });
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(carta.efeito.tipo === TIPOS_EFEITO.VINCULO_ALIADO
          ? "Escolha a aliada que sustenta a Troca de Favores"
          : `Toque em 1 aliado destacado.\nEle recebe +${carta.efeito.valor || 0} PA.`,
        {
          fontSize: "40px",
          color: "#88ff99",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    indicesAliados.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x88ff99, 0)
        .setStrokeStyle(8, 0x88ff99, 1)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.2,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () =>
        this.confirmarEscolhaBuffAliado(carta, posicaoPropria, indice),
      );

      objetos.push(anel, zonaToque);
    });

    this.objetosSelecaoAlvo = objetos;
  }

  // Aplica o efeito escolhido e anima a aliada afetada.
  confirmarEscolhaBuffAliado(carta, posicaoPropria, alvoEscolhido) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const afetadas = this.partida.aplicarEfeitoInvocacao(
      carta,
      this.partida.jogador,
      this.partida.inimigo,
      posicaoPropria,
      alvoEscolhido,
    );

    this.processarCartasAfetadas(afetadas, () => {
      this.travado = false;
      this.desenharInterface();
    });
  }

  // Seleciona aliadas para absorção e exige confirmação.
  iniciarSelecaoDeAbsorcao(carta, posicaoPropria) {
    const L = this.layout;
    const objetos = [];
    const selecionados = new Set();

    const alvos = this.partida.alvosParaAbsorverAliados(
      carta,
      this.partida.jogador,
      posicaoPropria,
    );
    const maxAlvos = carta.efeito.maxAlvos || 3;

    // Sem alvos válidos, mantém a invocação sem abrir seletor nem aplicar o efeito.
    if (alvos.length === 0) {
      this.partida.resolverEfeitosContinuos(this.partida.jogador);
      this.partida.resolverEfeitosContinuos(this.partida.inimigo);
      this.travado = false;
      this.desenharInterface();
      return;
    }

    this.travado = true;

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.35,
      )
      .setDepth(3700)
      .setInteractive();
    objetos.push(overlay);

    let textoInstr = this.criarInstrucaoSelecao(
        `Toque em até ${maxAlvos} aliados de nível baixo ou médio.\nConfirme para absorver as cartas escolhidas.`,
        {
          fontSize: "34px",
          color: "#ffcc00",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
          align: "center",
          wordWrap: { width: LARGURA_LAYOUT - 160 },
        },
      )
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoInstr);

    let textoContador = this.add
      .text(LARGURA_LAYOUT / 2, 260, `0/${maxAlvos} escolhidas`, {
        fontSize: "28px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(3900);
    objetos.push(textoContador);

    alvos.forEach((indice) => {
      const col = indice % 5;
      const fileira = Math.floor(indice / 5);
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let anel = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffcc00, 0)
        .setStrokeStyle(8, 0xffcc00, 0.5)
        .setDepth(3800);
      this.tweens.add({
        targets: anel,
        scaleX: 1.08,
        scaleY: 1.08,
        alpha: 0.15,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      let zonaToque = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0xffffff, 0.001)
        .setDepth(3801)
        .setInteractive({ useHandCursor: true });
      zonaToque.on("pointerup", () => {
        if (selecionados.has(indice)) {
          selecionados.delete(indice);
          anel.setStrokeStyle(8, 0xffcc00, 0.5);
        } else if (selecionados.size < maxAlvos) {
          selecionados.add(indice);
          anel.setStrokeStyle(10, 0x88ff99, 1);
        }
        textoContador.setText(`${selecionados.size}/${maxAlvos} escolhidas`);
      });

      objetos.push(anel, zonaToque);
    });

    let btnConfirmar = this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2,
      Y_MAO_JOGADOR - 60,
      "Confirmar",
      0x336633,
      () =>
        this.confirmarAbsorcao(carta, posicaoPropria, Array.from(selecionados)),
    );
    objetos.push(btnConfirmar);

    overlay.on("pointerup", () =>
      this.confirmarAbsorcao(carta, posicaoPropria, Array.from(selecionados)),
    );

    this.objetosSelecaoAlvo = objetos;
  }

  // Aplica a absorção e anima o ganho de PA e a remoção das aliadas.
  confirmarAbsorcao(carta, posicaoPropria, indices) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const afetadas = this.partida.aplicarEfeitoInvocacao(
      carta,
      this.partida.jogador,
      this.partida.inimigo,
      posicaoPropria,
      indices,
    );

    this.processarCartasAfetadas(afetadas, () => {
      this.travado = false;
      this.desenharInterface();
    });
  }

  // Rodadas no topo e fase no intervalo entre os campos.
  desenharStatus() {
    if (this.multiplayer?.presentation) {
      for (const player of [1, 2]) {
        const side = player === 1 ? "jogador" : "inimigo";
        const name = player === 1 ? this.multiplayer.localNickname : this.multiplayer.opponentNickname;
        const wins = player === 1 ? this.partida.rodadasJogador : this.partida.rodadasInimigo;
        const otherWins = player === 1 ? this.partida.rodadasInimigo : this.partida.rodadasJogador;
        const panel = this.criarPainelTatico(LARGURA_LAYOUT / 2, player === 1 ? ALTURA_LAYOUT - 220 : 220, 780, 160);
        const label = this.criarTextoUI(0, -38, String(name || `Jogador ${player}`).slice(0, 32), { fontSize: "32px", color: "#e9fff3", fontStyle: "bold" }).setOrigin(0.5);
        const score = this.criarTextoUI(0, 18, `PA ${this.partida.calcularPoderTotal(this.partida[side])} · Rodadas ${wins} : ${otherWins}`, { fontSize: "28px", color: "#afe5ce" }).setOrigin(0.5);
        const round = this.criarTextoUI(0, 58, `Turno ${this.partida.turno} / ${this.partida.maxTurnos}`, { fontSize: "22px", color: "#d7efdf" }).setOrigin(0.5);
        panel.add([label, score, round]); panel.setAngle(player === 2 ? 180 : 0);
      }
      return;
    }
    const painel = this.criarPlacaDuelo(LARGURA_LAYOUT / 2, 339 + DESLOCAMENTO_GUI_Y, 430, 48);
    painel.add(this.criarTextoUI(0, 0,
      `RODADAS   ${this.partida.rodadasJogador}  :  ${this.partida.rodadasInimigo}`,
      { fontSize: "23px", color: "#dceaff", fontStyle: "bold" },
    ).setOrigin(0.5));

    const yFase = (this.layout.yInimigoFrente + this.layout.yJogadorFrente) / 2;
    const faixa = this.criarPlacaDuelo(LARGURA_LAYOUT / 2, yFase, 620, 52,
      this.ehMeuTurno ? 0x54ddff : 0xff72af);
    faixa.add(this.criarTextoUI(0, 0,
      this.faseAtual === "habilidades" ? "HABILIDADES" : "COLOCAR CARTAS",
      { fontSize: "32px", color: "#f2fbff", fontStyle: "bold italic", letterSpacing: 2 },
    ).setOrigin(0.5));
  }

  // Contadores estáveis deixam a comparação de poder legível sem alterar o tamanho do HUD a cada carta colocada.
  desenharIndicadoresPoder() {
    if (this.multiplayer?.presentation) return;
    const L = this.layout;
    this.criarIndicadorPoder(
      235,
      145 + DESLOCAMENTO_GUI_Y,
      this.partida.calcularPoderTotal(this.partida.inimigo),
      "inimigo",
    );
    this.criarIndicadorPoder(
      LARGURA_LAYOUT - 235,
      this.maoEscondida ? ALTURA_LAYOUT - 185 + DESLOCAMENTO_GUI_Y : L.yJogadorTras + L.slotH / 2 + 235,
      this.partida.calcularPoderTotal(this.partida.jogador),
      "jogador",
    );
  }

  criarIndicadorPoder(x, y, valor, lado) {
    const local = lado === "jogador";
    const cor = local ? 0x54ddff : 0xff72af;
    const placa = this.criarPlacaDuelo(x, y, 470, 160, cor).setScale(0.9).setDepth(180);
    const retratoX = local ? 158 : -158;
    const moldura = this.add.rectangle(retratoX, 0, 132, 132, 0x101e37)
      .setStrokeStyle(3, cor);
    placa.add(moldura);
    const key = this.retratosDuelo?.[lado];
    if (key && this.textures.exists(key)) placa.add(this.add.image(retratoX, 0, key)
      .setDisplaySize(126, 126));

    const textoX = local ? -207 : -65;
    const nome = local
      ? (this.multiplayerAtivo ? this.multiplayer.localNickname : window.cyberduelAccount?.nickname) || "VOCÊ"
      : this.multiplayerAtivo ? this.multiplayer.opponentNickname || "OPONENTE" : "BOT";
    const nomeTexto = this.criarTextoUI(textoX, -45, String(nome).slice(0, 32).toLocaleUpperCase("pt-BR"), {
      fontSize: "27px", color: local ? "#a7efff" : "#ffafd0", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    if (nomeTexto.width > 265) nomeTexto.setScale(265 / nomeTexto.width);
    const numero = this.criarTextoUI(textoX + 57, 15, String(valor), {
      fontSize: "92px", color: "#ffffff", fontFamily: "Arial, sans-serif", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    if (numero.width > 208) numero.setScale(208 / numero.width);
    const label = this.criarTextoUI(textoX, 29, "PA", {
      fontSize: "29px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0, 0.5);
    placa.add([nomeTexto, numero, label]);
    return placa;
  }

  // Menu no topo; a seta lateral usa o fluxo original de passagem de turno.
  desenharRodaBotoes() {
    if (this.multiplayer?.presentation) return;
    const RAIO = 62;
    const X = LARGURA_LAYOUT - RAIO - 24;
    const Y = 90 + DESLOCAMENTO_GUI_Y;
    const bg = this.criarPlacaDuelo(0, 0, RAIO * 2, RAIO * 2);
    const icone = this.add.graphics().lineStyle(7, 0xf2fbff, 1);
    for (const y of [-23, 0, 23]) icone.lineBetween(-30, y, 30, y);
    const botaoMenu = this.add.container(X, Y, [bg, icone]);
    botaoMenu.setSize(RAIO * 2, RAIO * 2);
    botaoMenu.setInteractive({ useHandCursor: true });
    if (this.training) botaoMenu.setVisible(false).disableInteractive();

    botaoMenu.on("pointerover", () => {
      if (this.travado) return;
      this.tweens.add({ targets: botaoMenu, scale: 1.05, duration: 100 });
    });
    botaoMenu.on("pointerout", () => {
      if (this.travado) return;
      this.tweens.add({ targets: botaoMenu, scale: 1, duration: 100 });
    });
    botaoMenu.on("pointerup", () => {
      if (this.travado) return;
      this.alternarOpcoesDaRoda();
    });

    const botaoPassar = this.criarSetaPassarTurno(
      LARGURA_LAYOUT - 105,
      this.layout.yJogadorTras + this.layout.slotH / 2 + 85,
    );
    this.botaoPassarTutorial = this.training ? botaoPassar : null;

    const roda = this.add.container(0, 0, [botaoMenu, botaoPassar]);
    roda.setDepth(200);
    this.rodaBotoesContainer = roda;
  }

  criarSetaPassarTurno(x, y) {
    const aro = this.add.circle(0, 0, 79, 0x54ddff, 0.12).setStrokeStyle(3, 0x54ddff, 0.4);
    const fundo = this.add.circle(0, 0, 68, 0x07172e, 0.96).setStrokeStyle(3, 0x54ddff);
    const seta = this.add.graphics().lineStyle(12, 0xf2fbff, 1);
    for (const offset of [-38, 6]) seta.strokePoints([
      { x: offset, y: -32 }, { x: offset + 32, y: 0 }, { x: offset, y: 32 },
    ], false);
    const botao = this.add.container(x, y, [aro, fundo, seta]).setSize(158, 158);
    botao.setName("passar-turno");
    botao.setInteractive(new Phaser.Geom.Circle(79, 79, 79), Phaser.Geom.Circle.Contains);
    botao.input.cursor = "pointer";
    botao.on("pointerover", () => {
      if (!this.travado) this.tweens.add({ targets: botao, scale: 1.06, duration: 100 });
    });
    botao.on("pointerout", () => this.tweens.add({ targets: botao, scale: 1, duration: 100 }));
    botao.on("pointerup", () => this.aoClicarPassarTurno());
    return botao;
  }

  // Abre ou fecha as 3 opções, dependendo do estado atual.
  alternarOpcoesDaRoda() {
    if (this.rodaOpcoesContainer) {
      this.fecharOpcoesDaRoda();
    } else {
      this.abrirOpcoesDaRoda();
    }
  }

  // Abre as opções; tocar no fundo fecha o menu.
  abrirOpcoesDaRoda() {
    if (this.training) return;
    if (this.rodaOpcoesContainer) return;

    const LARGURA = 600;
    const ALTURA = 132;
    const ESPACO = 154;

    const definicoes = [
      {
        rotulo: "Histórico de cartas",
        cor: 0x54ddff,
        aoClicar: () => this.mostrarHistorico(),
      },
      {
        rotulo: this.fundoAnimadoAtivo() ? "Desativar fundo" : "Ativar fundo",
        cor: 0x54ddff,
        aoClicar: () => this.definirFundoAnimado(!this.fundoAnimadoAtivo()),
      },
      {
        rotulo: "Desistir da partida",
        cor: 0xff5573,
        aoClicar: () => this.aoClicarDesistir(),
      },
    ];

    // O fundo fecha o menu sem interceptar os botões.
    const overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x020714,
        0.72,
      )
      .setInteractive();
    overlay.on("pointerup", () => this.fecharOpcoesDaRoda());

    const totalAltura = ESPACO * (definicoes.length - 1);
    const yInicio = ALTURA_LAYOUT / 2 - totalAltura / 2;

    const botoes = definicoes.map((def, indice) =>
      this.criarBotaoDaRoda(
        LARGURA_LAYOUT / 2,
        yInicio + indice * ESPACO,
        LARGURA,
        ALTURA,
        def.rotulo,
        def.cor,
        () => {
          // Fecha o menu antes de disparar a ação escolhida, pra não deixar o fundo escurecido por cima de um modal/transição.
          this.fecharOpcoesDaRoda();
          def.aoClicar();
        },
      ),
    );

    const opcoes = this.add.container(0, 0, [overlay, ...botoes]);
    opcoes.setDepth(250);
    opcoes.setAlpha(0);
    opcoes.setScale(0.96);
    this.rodaOpcoesContainer = opcoes;

    this.tweens.add({
      targets: opcoes,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Cubic.Out",
    });
  }

  // Esconde de novo as 3 opções e o fundo escurecido (mas mantém o botão de menu visível no canto).
  fecharOpcoesDaRoda() {
    if (!this.rodaOpcoesContainer) return;
    const opcoes = this.rodaOpcoesContainer;
    this.rodaOpcoesContainer = null;

    this.tweens.add({
      targets: opcoes,
      alpha: 0,
      scale: 0.96,
      duration: 120,
      ease: "Cubic.In",
      onComplete: () => opcoes.destroy(),
    });
  }

  // Cria um botão individual (fundo + texto + hover/click) já posicionado dentro do menu de opções. `x`/`y` são relativos ao container pai.
  criarBotaoDaRoda(x, y, largura, altura, rotulo, cor, aoClicar) {
    const bg = this.criarPlacaDuelo(0, 0, largura, altura, cor);
    const texto = this.criarTextoUI(-largura / 2 + 40, 0, rotulo, {
      fontSize: "32px",
      color: cor === 0xff5573 ? "#ffc0ca" : "#f2f8ff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    const seta = this.criarTextoUI(largura / 2 - 40, 0, "›", {
      fontSize: "52px",
      color: cor === 0xff5573 ? "#ffc0ca" : "#91deef",
    }).setOrigin(0.5);
    const btn = this.add.container(x, y, [bg, texto, seta]);
    btn.setSize(largura, altura);
    btn.setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => {
      if (this.travado) return;
      this.tweens.add({ targets: btn, scale: 1.02, duration: 100 });
    });

    btn.on("pointerout", () => {
      if (this.travado) return;
      this.tweens.add({ targets: btn, scale: 1, duration: 100 });
    });

    btn.on("pointerup", () => {
      if (this.travado) return;
      aoClicar();
    });

    return btn;
  }

  // Retira o botão com animação e fecha as opções imediatamente.
  esconderRodaBotoes() {
    if (this.rodaOpcoesContainer) {
      this.rodaOpcoesContainer.destroy();
      this.rodaOpcoesContainer = null;
    }

    if (!this.rodaBotoesContainer) return;
    const roda = this.rodaBotoesContainer;
    this.rodaBotoesContainer = null;

    this.tweens.add({
      targets: roda,
      x: roda.x + 420,
      duration: 140,
      ease: "Cubic.In",
      onComplete: () => roda.destroy(),
    });
  }

  // Bloqueia comandos e resolve o encerramento do turno.
  aoClicarPassarTurno() {
    if (
      this.avisoBatalhaPendente() ||
      this.efeitosVisuaisPendentes() ||
      this.multiplayer?.effectsPaused ||
      this.travado ||
      !this.ehMeuTurno ||
      this.partida.partidaEncerrada ||
      this.multiplayer?.spectator
    )
      return;
    if (this.training) { this.training.pass(); return; }
    if (this.modalAberto || this.objetosSelecaoAlvo) this.encerrarSelecoesDaFase();
    this.travado = true;
    if (this.multiplayerAtivo) {
      this.finalizandoJogada = true;
      this.multiplayer.finishTurn(this.partida);
    } else {
      this.pausarTimerAteProximoTurno();
      this.avancarFaseSolo();
    }
  }

  avancarFaseSolo() {
    this.apresentarEventosEfeito();
    if (this.efeitosOponentePendentes()) {
      this.ehMeuTurno = false;
      this.travado = true;
      this.turnoAposEfeitos = () => this.avancarFaseSolo();
      return;
    }
    this.soloStep++;
    let result = null;
    if (this.soloStep === 4) {
      result = this.partida.fimTurno({ semIA: true });
      this.soloStep = 0;
      this.soloStarter = 3 - this.soloStarter;
    }
    this.faseAtual = this.soloStep < 2 ? "colocar" : "habilidades";
    this.partida.fase = this.faseAtual;
    this.ehMeuTurno =
      (this.soloStep % 2 === 0 ? this.soloStarter : 3 - this.soloStarter) === 1;
    this.travado = !this.ehMeuTurno;
    this.timerTurnoExpirado = false;
    const continuar = () => {
      this.desenharInterface();
      if (result?.fimDeJogo) {
        this.mostrarTelaFimDeJogo(result.resultadoCombate);
        return;
      }
      if (this.ehMeuTurno) this.iniciarNovoTurnoDoJogador();
      else {
        this.reiniciarTimerOponente();
        this.time.delayedCall(650, () => this.executarFaseSolo());
      }
    };
    if (result?.resultadoRodada)
      this.mostrarBannerRodada(result.resultadoRodada, continuar);
    else continuar();
  }

  executarFaseSolo() {
    if (this.partida.partidaEncerrada || this.ehMeuTurno) return;
    const anterior = this.partida;
    const nova = this.multiplayer.hydrateMatch(
      this.multiplayer.serializeMatch(anterior),
    );
    nova.jogador.cartasRecemCompradas = [];
    nova.fase = this.faseAtual;
    nova.turnoIA(this.faseAtual);
    this.apresentarEventosEfeito(nova.eventosEfeito);
    const eventos = this.detectarEventosVisuaisMultiplayer(anterior, nova);
    if (window.CenaEfeitos) {
      this.partida = nova;
      window.partida = nova;
      this.desenharInterface();
      this.avancarFaseSolo();
      if (eventos.compras)
        this.animarComprasInimigas(eventos.compras, () => {});
      return;
    }
    this.animacaoRemotaEmCurso = true;
    this.executarEventosVisuaisMultiplayer(anterior, nova, eventos, () => {
      this.animacaoRemotaEmCurso = false;
      this.avancarFaseSolo();
    });
  }

  receberEstadoMultiplayer(snapshot, resultado, update) {
    if (update.debugFinal && resultado?.fimDeJogo) {
      this.partida = this.multiplayer.hydrateMatch(snapshot);
      window.partida = this.partida;
      this.mostrarFinalParaTeste(resultado.resultadoCombate);
      return;
    }
    this.faseAtual = update.phase || this.multiplayer.phase;
    this.apresentarEventosEfeito(snapshot.eventosEfeito);
    if (update.phaseChanged && (this.modalAberto || this.objetosSelecaoAlvo))
      this.encerrarSelecoesDaFase();
    if (this.animacaoRemotaEmCurso) {
      this.atualizacaoRemotaPendente = { snapshot, resultado, update };
      return;
    }

    this.aplicandoEstadoRemoto = true;

    const partidaAnterior = this.partida;
    const novaPartida = this.multiplayer.hydrateMatch(snapshot);
    if (!update.initial && partidaAnterior) {
      const naMao = new Set(partidaAnterior.jogador.mao.cartas.map(c => this.chaveCartaMultiplayer(c)));
      novaPartida.jogador.cartasRecemCompradas = novaPartida.jogador.cartasRecemCompradas
        .filter(c => !naMao.has(this.chaveCartaMultiplayer(c)));
    }
    const eventos = update.initial
      ? null
      : this.detectarEventosVisuaisMultiplayer(partidaAnterior, novaPartida);

    if (window.CenaEfeitos) {
      // Aplica o estado já, mas só libera a vez após os efeitos do oponente.
      this.partida = novaPartida;
      window.partida = this.partida;
      this.finalizarRecebimentoMultiplayer(resultado, update, false);
      this.aplicandoEstadoRemoto = false;
      if (eventos?.compras)
        this.animarComprasInimigas(eventos.compras, () => {});
      return;
    }

    if (eventos && eventos.temEventos) {
      this.animacaoRemotaEmCurso = true;
      this.travado = true;
      this.executarEventosVisuaisMultiplayer(
        partidaAnterior,
        novaPartida,
        eventos,
        () => {
          this.finalizarRecebimentoMultiplayer(resultado, update, true);
          this.aplicandoEstadoRemoto = false;
          this.animacaoRemotaEmCurso = false;
          if (this.atualizacaoRemotaPendente) {
            const pendente = this.atualizacaoRemotaPendente;
            this.atualizacaoRemotaPendente = null;
            this.receberEstadoMultiplayer(
              pendente.snapshot,
              pendente.resultado,
              pendente.update,
            );
          }
        },
      );
      return;
    }

    this.partida = novaPartida;
    window.partida = this.partida;
    this.finalizarRecebimentoMultiplayer(resultado, update, false);
    this.aplicandoEstadoRemoto = false;
  }

  finalizarRecebimentoMultiplayer(resultado, update, interfaceDesenhada) {
    if (update.initial || update.phaseChanged || resultado?.fimDeJogo) this.finalizandoJogada = false;
    // Uma atualização mais nova substitui a liberação pendente da anterior.
    this.turnoAposEfeitos = null;
    if (this.efeitosOponentePendentes()) {
      this.ehMeuTurno = false;
      this.travado = true;
      this.turnoAposEfeitos = () =>
        this.finalizarRecebimentoMultiplayer(resultado, update, false);
      this.desenharInterface();
      return;
    }
    const podeJogar =
      !this.multiplayer.spectator &&
      update.activePlayer === this.multiplayer.player;
    const eraMeuTurno = this.ehMeuTurno;
    this.faseAtual = update.phase || this.multiplayer.phase;
    this.partida.fase = this.faseAtual;
    this.timerTurnoExpirado = false;
    this.ehMeuTurno = podeJogar;
    if (podeJogar && (!eraMeuTurno || update.phaseChanged || update.initial))
      this.iniciarNovoTurnoDoJogador();
    else if (!podeJogar && eraMeuTurno) this.reiniciarTimerOponente();
    else if (!podeJogar) this.atualizarVisualTimerTurno(true);
    this.travado = !podeJogar || !!resultado?.resultadoRodada || !!this.finalizandoJogada;
    // Redesenha após receber a vez para atualizar controles e auras.
    if (!interfaceDesenhada || update.phaseChanged || podeJogar !== eraMeuTurno)
      this.desenharInterface();

    if (resultado?.fimDeJogo) {
      this.travado = true;
      this.mostrarTelaFimDeJogo(resultado.resultadoCombate);
      return;
    }

    const concluir = () => {
      if (this.travado) this.mostrarEsperaMultiplayer();
      else if (!this.rodaBotoesContainer) this.desenharRodaBotoes();
    };
    if (resultado?.resultadoRodada) {
      this.mostrarBannerRodada(resultado.resultadoRodada, () => {
        this.travado = !podeJogar;
        concluir();
      });
    } else concluir();
  }

  chaveCartaMultiplayer(carta) {
    return carta ? `${carta.id}:${carta.nome}:${carta.tipo}` : null;
  }

  detectarEventosVisuaisMultiplayer(anterior, nova) {
    if (!anterior || !nova) return { temEventos: false };
    const chave = (carta) => this.chaveCartaMultiplayer(carta);
    const campoAnteriorInimigo = anterior.inimigo.campo.cartas;
    const campoNovoInimigo = nova.inimigo.campo.cartas;
    const chavesCampoAnterior = new Set(
      campoAnteriorInimigo.filter(Boolean).map(chave),
    );

    const jogadasCampo = campoNovoInimigo
      .map((carta, posicao) => ({ carta, posicao }))
      .filter(({ carta }) => carta && !chavesCampoAnterior.has(chave(carta)));

    const novasEntradasHistorico = nova.historico.slice(
      anterior.historico.length,
    );
    const efeitos = novasEntradasHistorico
      .filter(
        (entrada) =>
          entrada.quem === "inimigo" && entrada.carta?.tipo === "efeito",
      )
      .map((entrada) => entrada.carta);

    const ativacoes = [];
    [...campoNovoInimigo, ...nova.inimigo.descarte].forEach((cartaNova) => {
      if (!cartaNova?.habilidadeAtiva) return;
      const cartaAnterior = [
        ...campoAnteriorInimigo,
        ...anterior.inimigo.descarte,
      ].find((carta) => chave(carta) === chave(cartaNova));
      if (
        cartaAnterior &&
        ((cartaNova.ativacoes || 0) > (cartaAnterior.ativacoes || 0) ||
          (cartaNova.usadaEsteTurno && !cartaAnterior.usadaEsteTurno))
      )
        ativacoes.push(cartaNova);
    });

    const contagemMaoAnterior = new Map();
    anterior.inimigo.mao.cartas.forEach((carta) => {
      const key = chave(carta);
      contagemMaoAnterior.set(key, (contagemMaoAnterior.get(key) || 0) + 1);
    });
    let compras = 0;
    nova.inimigo.mao.cartas.forEach((carta) => {
      const key = chave(carta);
      const disponiveis = contagemMaoAnterior.get(key) || 0;
      if (disponiveis > 0) contagemMaoAnterior.set(key, disponiveis - 1);
      else compras++;
    });

    const afetadas = [];
    const compararCampo = (campoAnterior, campoNovo) => {
      campoNovo.forEach((cartaNova) => {
        if (!cartaNova) return;
        const cartaAnterior = campoAnterior.find(
          (carta) => chave(carta) === chave(cartaNova),
        );
        if (!cartaAnterior) return;
        const delta = cartaNova.poder - cartaAnterior.poder;
        if (delta !== 0) afetadas.push({ carta: cartaNova, delta });
      });
    };
    compararCampo(anterior.jogador.campo.cartas, nova.jogador.campo.cartas);
    compararCampo(campoAnteriorInimigo, campoNovoInimigo);

    const chavesNovasDoInimigo = new Set(
      [
        ...nova.inimigo.campo.cartas,
        ...nova.inimigo.mao.cartas,
        ...nova.inimigo.deck.cartas,
      ]
        .filter(Boolean)
        .map(chave),
    );
    const removidas = campoAnteriorInimigo.filter(
      (carta) => carta && !chavesNovasDoInimigo.has(chave(carta)),
    );
    const chavesNovasAliadas = new Set(
      [
        ...nova.jogador.campo.cartas,
        ...nova.jogador.mao.cartas,
        ...nova.jogador.deck.cartas,
      ]
        .filter(Boolean)
        .map(chave),
    );
    removidas.push(
      ...anterior.jogador.campo.cartas.filter(
        (c) => c && !chavesNovasAliadas.has(chave(c)),
      ),
    );

    return {
      jogadasCampo,
      efeitos,
      ativacoes,
      compras,
      afetadas,
      removidas,
      temEventos:
        jogadasCampo.length > 0 ||
        efeitos.length > 0 ||
        ativacoes.length > 0 ||
        compras > 0 ||
        afetadas.length > 0 ||
        removidas.length > 0,
    };
  }

  executarEventosVisuaisMultiplayer(
    partidaAnterior,
    novaPartida,
    eventos,
    aoConcluir,
  ) {
    const aplicarNovoEstado = () => {
      this.partida = novaPartida;
      window.partida = this.partida;

      const apresentacoes = window.CenaEfeitos
        ? []
        : [
            ...eventos.efeitos.map((carta) => ({
              carta,
              rotulo: "O inimigo conjurou:",
            })),
            ...eventos.ativacoes.map((carta) => ({
              carta,
              rotulo: "O inimigo ativou:",
            })),
          ];

      const finalizar = () => {
        this.desenharInterface();
        this.animarCartasAfetadas(eventos.afetadas);
        aoConcluir();
      };

      const apresentarCarta = (indice) => {
        if (indice >= apresentacoes.length) {
          this.animarComprasInimigas(eventos.compras, finalizar);
          return;
        }
        const apresentacao = apresentacoes[indice];
        this.conjurarCartaDeEfeitoInimigo(
          apresentacao.carta,
          () => apresentarCarta(indice + 1),
          apresentacao.rotulo,
        );
      };

      this.animarJogadasCampoInimigo(eventos.jogadasCampo, () =>
        apresentarCarta(0),
      );
    };

    const advogados = window.CenaEfeitos
      ? []
      : eventos.ativacoes.filter(
          (c) => c.efeito?.tipo === TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO,
        );
    const remover = () =>
      this.animarRemocoesInimigas(eventos.removidas, aplicarNovoEstado);
    const animarAdvogado = (indice) => {
      if (indice >= advogados.length) return remover();
      this.animarEfeitoAdvogado(
        advogados[indice].ultimoAlvoHabilidade,
        () => animarAdvogado(indice + 1),
        true,
      );
    };
    animarAdvogado(0);
  }

  animarRemocoesInimigas(cartas, aoConcluir) {
    if (!cartas.length) {
      aoConcluir();
      return;
    }
    let restantes = cartas.length;
    const terminou = () => {
      restantes--;
      if (restantes === 0) aoConcluir();
    };
    cartas.forEach((carta) => {
      const container = this.children.list.find(
        (objeto) => objeto.dadosCartaCampo === carta,
      );
      if (container) this.animarMorteCarta(container, terminou);
      else terminou();
    });
  }

  animarComprasInimigas(quantidade, aoConcluir) {
    if (this.multiplayer?.presentation || !quantidade) {
      aoConcluir();
      return;
    }

    const origem = { x: LARGURA_LAYOUT / 5.4, y: Y_MAO_INIMIGO };
    const totalMao = this.partida.inimigo.mao.cartas.length;
    let concluidas = 0;
    for (let indice = 0; indice < quantidade; indice++) {
      const offset = indice - (quantidade - 1) / 2;
      const destinoX = LARGURA_LAYOUT / 2 + offset * 58;
      const destinoY = Y_MAO_INIMIGO - 20 - Math.abs(offset) * 5;
      const verso = this.add
        .image(origem.x, origem.y, "fundoCarta")
        .setDisplaySize(140, 200)
        .setDepth(3700 + indice)
        .setAlpha(0);
      const escalaX = verso.scaleX;
      const escalaY = verso.scaleY;
      this.time.delayedCall(indice * 190, () => {
        if (this.somComprarCarta) this.somComprarCarta.play();
        this.tweens.add({
          targets: verso,
          x: destinoX,
          y: destinoY,
          alpha: 1,
          scaleX: escalaX,
          scaleY: escalaY,
          angle: offset * 2,
          duration: 430,
          ease: "Back.Out",
          onComplete: () => {
            this.tweens.add({
              targets: verso,
              alpha: 0,
              duration: 140,
              delay: 120,
              onComplete: () => {
                verso.destroy();
                concluidas++;
                if (concluidas === quantidade) aoConcluir();
              },
            });
          },
        });
      });
    }

    this.add
      .text(
        LARGURA_LAYOUT / 2,
        Y_MAO_INIMIGO + 145,
        `Oponente comprou ${quantidade} carta${quantidade > 1 ? "s" : ""}`,
        {
          fontSize: "26px",
          color: "#9bffbc",
        },
      )
      .setOrigin(0.5)
      .setDepth(3699);
  }

  mostrarEsperaMultiplayer(texto = "AGUARDANDO O OPONENTE...") {
    if (this.multiplayer?.presentation) return;
    if (!this.multiplayerAtivo || this.partida.partidaEncerrada) return;
    this.add
      .text(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT - 150,
        this.multiplayer?.spectator ? "MODO ESPECTADOR" : texto,
        {
          fontSize: "38px",
          color: "#9bffbc",
          fontStyle: "bold",
          backgroundColor: "#000000cc",
          padding: { x: 32, y: 22 },
        },
      )
      .setOrigin(0.5)
      .setDepth(5000);
  }

  oponenteDesistiuMultiplayer(jogadorDesistente) {
    if (!this.multiplayerAtivo || this.partida.partidaEncerrada) return;
    this.partida.partidaEncerrada = true;
    const vencedor =
      this.multiplayer.spectator && jogadorDesistente === 1
        ? "inimigo"
        : "jogador";
    const resultado = {
      poderJogador: this.partida.calcularPoderTotal(this.partida.jogador),
      poderInimigo: this.partida.calcularPoderTotal(this.partida.inimigo),
      resultado: vencedor,
      cartaDestaque: this.partida.obterCartaComMaiorPoder(
        this.partida[vencedor].campo,
      ),
      rodadasJogador: this.partida.rodadasJogador,
      rodadasInimigo: this.partida.rodadasInimigo,
    };
    this.mostrarTelaFimDeJogo(resultado);
  }

  oponenteSaiuMultiplayer() {
    if (!this.multiplayerAtivo || this.partida.partidaEncerrada) return;
    this.travado = true;
    this.desenharInterface();
    this.mostrarEsperaMultiplayer("O OPONENTE SAIU DA PARTIDA");
  }

  // Apresenta as invocações da IA uma por vez sem redesenhar a interface inteira a cada carta. Isso evita os flashes dos objetos já existentes.
  animarJogadasCampoInimigo(jogadas, aoTerminar) {
    const validas = jogadas.filter(
      ({ carta, posicao }) =>
        this.partida.inimigo.campo.cartas[posicao] === carta,
    );
    if (!validas.length) {
      aoTerminar();
      return;
    }

    const cartasJogadas = new Set(validas.map(({ carta }) => carta));
    let tocaJaVisivel = this.partida.inimigo.campo.cartas.some(
      (c) =>
        c &&
        !cartasJogadas.has(c) &&
        c.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.OCULTAR_ALIADOS,
    );

    const mostrar = (indice) => {
      if (indice >= validas.length) {
        // O redesenho final do turno aplica a aparência definitiva da Toca. Não redesenhamos aqui para evitar um segundo flash desnecessário.
        this.time.delayedCall(650, aoTerminar);
        return;
      }
      const { carta, posicao } = validas[indice];
      const col = posicao % 5;
      const fileira = Math.floor(posicao / 5);
      const ehToca =
        carta.efeitoContinuo?.tipo === TIPOS_EFEITO_CONTINUO.OCULTAR_ALIADOS;
      this.criarCartaDeCampo(
        this.layout.x[col],
        this.layout.yInimigo[fileira],
        carta,
        this.layout,
        tocaJaVisivel && carta.tipo !== "terreno",
        false,
      );
      if (ehToca) {
        tocaJaVisivel = true;
        this.animarFlipCartasInimigasParaBaixo(carta);
      }
      const mostrarProxima = () => mostrar(indice + 1);
      if (
        !this.reproduzirEfeitoInvocacao(carta, () =>
          this.time.delayedCall(180, mostrarProxima),
        )
      ) {
        this.time.delayedCall(950, mostrarProxima);
      }
    };
    this.time.delayedCall(420, () => mostrar(0));
  }

  // Quando a Toca é jogada depois de outra carta, vira somente as cartas inimigas que já estão desenhadas, sem redesenhar/piscar a tela inteira.
  animarFlipCartasInimigasParaBaixo(tocaRecemJogada) {
    const campoInimigo = this.partida.inimigo.campo.cartas;
    this.children.list
      .filter((objeto) => {
        const carta = objeto.dadosCartaCampo;
        return (
          carta &&
          carta !== tocaRecemJogada &&
          carta.tipo !== "terreno" &&
          campoInimigo.includes(carta)
        );
      })
      .forEach((container) => {
        const carta = container.dadosCartaCampo;
        carta.ocultadaPelaToca = true;
        carta.revelada = false;
        this.tweens.add({
          targets: container,
          scaleX: 0,
          duration: 190,
          ease: "Sine.easeIn",
          onComplete: () => {
            if (!container.active) return;
            const verso = this.add
              .image(0, 0, "fundoCarta")
              .setDisplaySize(container.width, container.height);
            container.add(verso);
            this.tweens.add({
              targets: container,
              scaleX: 1,
              duration: 210,
              ease: "Sine.easeOut",
            });
          },
        });
      });
  }

  // Exibe o resultado da rodada e chama aoTerminar ao concluir.
  mostrarBannerRodada(resultadoRodada, aoTerminar) {
    const config = {
      jogador: { texto: "VOCÊ VENCEU A RODADA", cor: "#66ff88" },
      inimigo: { texto: "VOCÊ PERDEU A RODADA", cor: "#ff6666" },
      empate: { texto: "RODADA EMPATADA", cor: "#ffd966" },
    }[resultadoRodada.vencedor];

    const texto = this.add
      .text(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, config.texto, {
        fontSize: "58px",
        color: config.cor,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 8,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0)
      .setScale(0.85);

    this.tweens.add({
      targets: texto,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: "Back.Out",
      onComplete: () => {
        this.time.delayedCall(650, () => {
          this.tweens.add({
            targets: texto,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              texto.destroy();
              aoTerminar();
            },
          });
        });
      },
    });
  }

  // Handler do botão "Desistir": pede confirmação (ação irreversível) antes de encerrar a partida como derrota do jogador.
  aoClicarDesistir() {
    if (this.training) return;
    if (this.partida.partidaEncerrada || this.modalAberto) return;

    this.modalAberto = true;
    this.travado = true;
    this.esconderRodaBotoes();

    let overlay = this.add
      .rectangle(
        LARGURA_LAYOUT / 2,
        ALTURA_LAYOUT / 2,
        LARGURA_LAYOUT,
        ALTURA_LAYOUT,
        0x000000,
        0.75,
      )
      .setDepth(4000)
      .setInteractive();

    const painel = this.criarSuperficieVidro(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2 - 35,
      800,
      420,
      { opacidade: 0.94, raio: 44 },
    ).setDepth(4000);

    let titulo = this.criarTextoUI(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2 - 140,
      "Desistir da partida?",
      {
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    )
      .setOrigin(0.5)
      .setDepth(4001);

    let subtitulo = this.criarTextoUI(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2 - 70,
      "Você perde a partida imediatamente.",
      {
        fontSize: "28px",
        color: "#dddddd",
      },
    )
      .setOrigin(0.5)
      .setDepth(4001);

    const fechar = () => {
      overlay.destroy();
      painel.destroy();
      titulo.destroy();
      subtitulo.destroy();
      btnConfirmar.destroy();
      btnCancelar.destroy();
    };

    let btnConfirmar = this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2 - 170,
      ALTURA_LAYOUT / 2 + 60,
      "Desistir",
      0x883333,
      () => {
        fechar();
        this.modalAberto = false;
        if (this.multiplayerAtivo) this.multiplayer.surrender();
        const resultado = this.partida.desistir();
        this.mostrarTelaFimDeJogo(resultado);
      },
    );

    let btnCancelar = this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2 + 170,
      ALTURA_LAYOUT / 2 + 60,
      "Cancelar",
      0x336633,
      () => {
        fechar();
        this.modalAberto = false;
        this.travado = false;
        this.desenharRodaBotoes();
      },
    );
  }

  // Botão da confirmação de desistência em coordenadas absolutas.
  criarBotaoConfirmacao(x, y, rotulo, cor, aoClicar) {
    let bg = this.criarSuperficieVidro(0, 0, 300, 124, {
      cor,
      raio: 62,
      opacidade: 0.94,
    });
    let texto = this.criarTextoUI(0, 0, rotulo, {
      fontSize: "30px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 260 },
    }).setOrigin(0.5);

    let btn = this.add.container(x, y, [bg, texto]);
    btn.setSize(300, 124);
    btn.setDepth(4001);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", aoClicar);

    return btn;
  }

  // Botão inferior que alterna a mão e o tamanho do campo.
  desenharBotaoToggleMao() {
    const qtd = this.partida.jogador.mao.cartas.length;
    const rotulo = this.maoEscondida ? `▲ Mostrar Mão (${qtd})` : "▼";
    const corBg = this.maoEscondida ? 0x225533 : 0x333333;

    let bg = this.add
      .rectangle(0, 0, 340, 72, corBg)
      .setStrokeStyle(3, 0xffffff, 0.7);
    let texto = this.add
      .text(0, 0, rotulo, { fontSize: "26px", color: "#ffffff" })
      .setOrigin(0.5);

    let btn = this.add.container(LARGURA_LAYOUT / 2, ALTURA_LAYOUT - 50, [
      bg,
      texto,
    ]);
    btn.setSize(340, 72);
    btn.setDepth(50);
    btn.setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => {
      if (this.travado) return;
      this.tweens.add({ targets: btn, scale: 1.05, duration: 100 });
    });

    btn.on("pointerout", () => {
      if (this.travado) return;
      this.tweens.add({ targets: btn, scale: 1, duration: 100 });
    });

    btn.on("pointerup", () => {
      if (this.travado) return;
      this.alternarMao();
    });
  }

  // Anima a mão antes de recalcular o layout do campo.
  alternarMao() {
    // MOSTRAR A MÃO NOVAMENTE

    if (this.maoEscondida) {
      this.maoEscondida = false;
      this.desenharInterface();
      return;
    }

    // Pega SOMENTE as cartas da mão do jogador.
    const cartasNaTela = this.children.list.filter((c) => c.dadosCarta);

    if (cartasNaTela.length === 0) {
      this.maoEscondida = true;
      this.desenharInterface();
      return;
    }

    // Impede clicar/jogar enquanto a animação acontece.
    this.travado = true;

    // Cancela qualquer animação anterior dessas cartas.
    this.tweens.killTweensOf(cartasNaTela);

    // Desliza a mão para fora da tela antes de ocultá-la.

    let finalizadas = 0;

    cartasNaTela.forEach((carta, indice) => {
      if (!carta || !carta.active) {
        finalizadas++;
        return;
      }

      // Garante que a carta fique por cima durante a animação.
      carta.setDepth(2000 + indice);

      // Pequena diferença entre as cartas para dar sensação de que a mão inteira está deslizando para baixo.
      const delay = indice * 25;

      this.tweens.add({
        targets: carta,

        // Sai completamente pela parte inferior da tela.
        y: carta.y + 500,

        // Continua aparecendo enquanto desce e desaparece no final.
        alpha: 0,

        duration: 380,

        delay: delay,

        ease: "Cubic.In",

        onComplete: () => {
          finalizadas++;

          if (finalizadas >= cartasNaTela.length) {
            // Agora que a animação terminou, muda o layout.
            this.maoEscondida = true;
            this.travado = false;

            // Redesenha o campo ampliado.
            this.desenharInterface();
          }
        },
      });
    });
  }

  mostrarFinalParaTeste(resultado) {
    // Cancela callbacks da IA e animações que poderiam redesenhar sobre o final.
    this.finalDebug = true;
    this.partidaRegistradaNaConta = true;
    this.partida.partidaEncerrada = true;
    this.time.removeAllEvents();
    this.tweens.killAll();
    if (this.painelDetalheAtual) this.fecharDetalheCarta(true);
    this.objetosSelecaoAlvo?.forEach((o) => o.destroy());
    this.objetosSelecaoAlvo = null;
    this.modalAberto = false;
    const camada = this.scene.manager.keys.CenaEfeitos;
    if (camada) {
      camada.fila = [];
      camada.executando = false;
      this.scene.stop("CenaEfeitos");
    }
    this.cameras.main.postFX?.clear();
    this.telaFinalExibida = false;
    this.aguardandoEfeitosFinais = false;
    this.animacaoRemotaEmCurso = false;
    this.atualizacaoRemotaPendente = null;
    this.travado = true;
    this.desenharInterface();
    this.mostrarTelaFimDeJogo(resultado);
  }

  // Exibe uma única tela final com o resultado e a carta de destaque.
  mostrarTelaFimDeJogo(resultadoCombate) {
    if (!resultadoCombate || this.telaFinalExibida) return;
    this.apresentarEventosEfeito();
    const camada = this.scene?.manager?.keys?.CenaEfeitos;
    if (camada?.executando || camada?.fila?.length) {
      if (!this.aguardandoEfeitosFinais) {
        this.aguardandoEfeitosFinais = true;
        this.time.delayedCall(150, () => {
          this.aguardandoEfeitosFinais = false;
          this.mostrarTelaFimDeJogo(resultadoCombate);
        });
      }
      return;
    }
    if (this.painelDetalheAtual?.active) this.fecharDetalheCarta(true);
    this.telaFinalExibida = true;
    this.avisoBatalhaTexto?.destroy();
    this.avisoBatalhaSom?.destroy();
    this.avisoBatalhaTexto = null;
    this.avisoBatalhaSom = null;
    const voltar = () => {
      this.retornoMenuTimer?.remove();
      this.multiplayer?.leaveRoom?.();
      this.scene.start("CenaTitulo");
    };
    // Mantém a ação junto do resultado, com espaço para a carta de destaque.
    const yVoltarMenu =
      ALTURA_LAYOUT / 2 + (resultadoCombate.cartaDestaque ? 500 : 160);
    this.criarBotaoConfirmacao(
      LARGURA_LAYOUT / 2,
      yVoltarMenu,
      "Voltar ao menu",
      0xc5ecd2,
      voltar,
    ).setDepth(5100);
    const returnText = this.criarTextoUI(
      LARGURA_LAYOUT / 2,
      yVoltarMenu + 100,
      "Retorno automático em 10 segundos",
      {
        fontSize: "25px",
        color: "#dddddd",
      },
    )
      .setOrigin(0.5)
      .setDepth(5100);
    this.retornoMenuTimer = this.time.delayedCall(10000, voltar);
    if (this.multiplayerAtivo && !this.multiplayer?.spectator)
      window.cyberduelAccount?.restore().catch(() => {});
    if (this.soloMatchStart && !this.partidaRegistradaNaConta) {
      const rewardText = this.criarTextoUI(LARGURA_LAYOUT / 2, yVoltarMenu - 85,
        "Registrando recompensa…", { fontSize: "28px", color: "#afe5ce", align: "center" })
        .setOrigin(0.5).setDepth(5100);
      let saving = false;
      const saveReward = async () => {
        if (saving || this.partidaRegistradaNaConta) return;
        saving = true;
        try {
          let started = await this.soloMatchStart;
          if (started.error) {
            // A partida ainda não foi registrada; permite tentar novamente sem perder o resultado.
            this.soloMatchStart = window.cyberduelAccount.startSoloMatch()
              .then(matchId => ({ matchId }), error => ({ error }));
            started = await this.soloMatchStart;
            if (started.error) throw started.error;
          }
          const reward = await window.cyberduelAccount.recordMatch(started.matchId, resultadoCombate.resultado);
          this.partidaRegistradaNaConta = true;
          if (rewardText.active) {
            rewardText.setText(`+${reward.toLocaleString("pt-BR")} tijolinhos`);
            returnText.setText("Retorno automático em 10 segundos");
            this.retornoMenuTimer?.remove();
            this.retornoMenuTimer = this.time.delayedCall(10000, voltar);
          }
        } catch (error) {
          if (rewardText.active) {
            rewardText.setText("Falha ao registrar. Clique para tentar novamente.");
            this.retornoMenuTimer?.remove();
            returnText.setText("Retorno automático pausado para tentar novamente");
          }
        } finally { saving = false; }
      };
      rewardText.setInteractive({ useHandCursor: true }).on("pointerdown", saveReward);
      saveReward();
    }

    const vitoria = resultadoCombate.resultado === "jogador";
    const derrota = resultadoCombate.resultado === "inimigo";

    const corFundo = vitoria ? 0x1fd67a : derrota ? 0xff3b3b : 0xbbbbbb;
    const corTexto = vitoria ? "#afe5ce" : derrota ? "#ffc0ca" : "#eeeeee";
    if (vitoria || derrota) this.sound?.play(this.multiplayer?.spectator || vitoria ? "somVitoria" : "somDerrota",
      { volume: window.cyberduelSettings?.effects(1) ?? 1 });
    const textoPrincipal =
      this.multiplayer?.spectator && (vitoria || derrota)
        ? "VITÓRIA"
        : vitoria
          ? "VITÓRIA"
          : derrota
            ? "DERROTA"
            : "EMPATE";

    if (this.multiplayer?.spectator && (vitoria || derrota)) {
      const vencedor = vitoria ? this.multiplayer.localNickname : this.multiplayer.opponentNickname;
      const perdedor = vitoria ? this.multiplayer.opponentNickname : this.multiplayer.localNickname;
      const y = (vitoria ? this.layout.yJogadorFrente : this.layout.yInimigoTras) - this.layout.slotH / 2 - 80;
      this.criarTextoUI(LARGURA_LAYOUT / 2, y, `VITÓRIA — ${vencedor}\nDERROTA — ${perdedor}`, {
        fontFamily: "Rushblade, Arial, sans-serif", fontSize: "48px", color: "#ffffff", align: "center",
      }).setOrigin(0.5).setDepth(5200);
    }
    this.cameras.main.flash(
      400,
      vitoria ? 0 : 255,
      vitoria ? 255 : derrota ? 59 : 200,
      vitoria ? 136 : derrota ? 59 : 200,
    );

    // Aplica desfoque apenas quando o renderer oferece postFX.
    if (this.cameras.main.postFX && this.cameras.main.postFX.addBlur) {
      this.cameras.main.postFX.addBlur(0, 2, 2, 0.15, 0xffffff, 6);
    }

    // Camada escura por baixo da cor, pra garantir contraste do texto não importa o fundo do campo naquele momento.
    let escurecido = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      0x000000,
      0.55,
    );
    escurecido.setDepth(5000);

    // Camada colorida translúcida (verde na vitória, vermelha na derrota)
    let corCamada = this.add.rectangle(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2,
      LARGURA_LAYOUT,
      ALTURA_LAYOUT,
      corFundo,
      0.08,
    );
    corCamada.setDepth(5001);

    const filhos = [];

    let textoGrande = this.criarTextoUI(0, -140, textoPrincipal, {
      fontFamily: "Rushblade, Arial, sans-serif",
      fontSize: "88px",
      fontStyle: "bold",
      color: corTexto,
      stroke: "#ffffff",
      strokeThickness: 0,
      align: "center",
    }).setOrigin(0.5);
    filhos.push(textoGrande);

    // Carta de maior PA do lado vencedor, embaixo do texto
    const cartaDestaque = resultadoCombate.cartaDestaque;
    if (cartaDestaque) {
      const corFundoCarta = this.obterCorPorId(cartaDestaque.id);
      const CW = 320;
      const CH = 448;

      let sombraCarta = this.add.rectangle(8, 10, CW, CH, 0x000000, 0.45);
      let fundoCarta = cartaDestaque.imagem
        ? this.add.image(0, 0, cartaDestaque.imagem).setDisplaySize(CW, CH)
        : this.add.rectangle(0, 0, CW, CH, corFundoCarta);
      let bordaCarta = this.add
        .rectangle(0, 0, CW, CH)
        .setStrokeStyle(7, 0xffffff);
      let nomeCarta = this.criarTextoUI(
        0,
        -CH / 2 + 30,
        this.truncarTexto(cartaDestaque.nome, 16),
        {
          fontSize: "30px",
          color: "#ffffff",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: CW - 30 },
        },
      ).setOrigin(0.5, 0);
      const [poderBola, poderTexto] = this.criarSeloEstat(
        0,
        CH / 2 - 46,
        cartaDestaque.poder,
        "#ff5555",
        36,
      );

      let containerCarta = this.add.container(0, 300, [
        sombraCarta,
        fundoCarta,
        bordaCarta,
        nomeCarta,
        poderBola,
        poderTexto,
      ]);
      filhos.push(containerCarta);
    }

    let subtitulo = this.criarTextoUI(
      0,
      cartaDestaque ? 570 : 120,
      `Poder final — Você: ${resultadoCombate.poderJogador}  ×  Inimigo: ${resultadoCombate.poderInimigo}`,
      {
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center",
      },
    ).setOrigin(0.5);
    filhos.push(subtitulo);

    // Posiciona o resultado acima do centro da tela.
    let container = this.add.container(
      LARGURA_LAYOUT / 2,
      ALTURA_LAYOUT / 2 - 220,
      filhos,
    );
    container.setDepth(5002);
    container.setScale(0.7);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 500,
      delay: 150,
      ease: "Back.Out",
    });
    if (!vitoria && !derrota) this.somBuff.play();
  }
  // Gestos verticais alternam a visibilidade da mão.

  configurarGestosMao() {
    if (this.training) return;
    // Arrastar para baixo esconde a mão; para cima, mostra.

    if (this.gestosMaoConfigurados) return;

    this.gestosMaoConfigurados = true;

    this.gestoMaoAtivo = false;
    this.gestoMaoX = 0;
    this.gestoMaoY = 0;

    // COMEÇOU O TOQUE

    this.input.on("pointerdown", (pointer) => {
      if (this.travado) return;

      const LIMITE_MAO = ALTURA_LAYOUT - 650;

      const ponto = this.pontoDoPonteiro(pointer);
      if (ponto.y < LIMITE_MAO) return;
      this.gestoMaoAtivo = true;
      this.gestoMaoX = ponto.x;
      this.gestoMaoY = ponto.y;

      // GUARDA A POSIÇÃO ORIGINAL DE TODAS AS CARTAS

      const cartas = this.children.list.filter((c) => c.dadosCarta);

      cartas.forEach((carta) => {
        if (!carta || !carta.active) return;

        carta._maoSwipeYOriginal = carta.y;
        carta._maoSwipeXOriginal = carta.x;
        carta._maoSwipeAlphaOriginal = carta.alpha;
      });
    });

    // SOLTOU O DEDO

    const finalizarGesto = (pointer) => {
      if (!this.gestoMaoAtivo) return;

      this.gestoMaoAtivo = false;

      if (this.travado) return;

      const deslocamentoY = this.pontoDoPonteiro(pointer).y - this.gestoMaoY;

      const LIMITE_GESTO = 45;

      // SWIPE PARA BAIXO COMPLETO

      if (!this.maoEscondida && deslocamentoY >= LIMITE_GESTO) {
        this.esconderMaoComSwipe();
        return;
      }

      // SWIPE PARA CIMA COMPLETO

      if (this.maoEscondida && deslocamentoY <= -LIMITE_GESTO) {
        this.mostrarMaoComSwipe();
        return;
      }

      // Restaura a mão se o gesto não atingir o limite.

      this.voltarMaoParaPosicao();
    };

    this.input.on("pointerup", finalizarGesto);

    this.input.on("pointerupoutside", finalizarGesto);
  }

  // RESTAURA A MÃO QUANDO O SWIPE NÃO FOI COMPLETO

  voltarMaoParaPosicao() {
    this.baixarOutrasCartasDaMao(this.cartaMaoSelecionada);
  }
  // Esconde a mão após o gesto.
  esconderMaoComSwipe(deslocamento) {
    const cartas = this.children.list.filter((c) => c.dadosCarta);

    if (cartas.length === 0) {
      this.maoEscondida = true;
      this.desenharInterface();
      return;
    }

    this.travado = true;

    cartas.forEach((carta, indice) => {
      if (!carta || !carta.active) return;

      const yInicial =
        carta._maoSwipeYOriginal !== undefined
          ? carta._maoSwipeYOriginal
          : carta.y;

      carta._maoSwipeYOriginal = undefined;

      this.tweens.killTweensOf(carta);

      this.tweens.add({
        targets: carta,

        y: ALTURA_LAYOUT + 300,

        alpha: 0,

        duration: 220,

        delay: indice * 15,

        ease: "Cubic.In",
      });
    });

    // Espera a animação acabar antes de redesenhar.
    this.time.delayedCall(260 + cartas.length * 15, () => {
      this.maoEscondida = true;
      this.travado = false;

      this.desenharInterface();
    });
  }

  // MOSTRA A MÃO

  mostrarMaoComSwipe() {
    // MOSTRAR A MÃO COM SWIPE PARA CIMA

    this.travado = true;

    // Muda para o layout normal.
    this.maoEscondida = false;

    // Reconstrói a interface para criar a mão na posição correta.
    this.desenharInterface();

    // Pega as cartas da mão recém-criadas.
    const cartas = this.children.list.filter((c) => c.dadosCarta);

    if (cartas.length === 0) {
      this.travado = false;
      return;
    }

    // FAZ A MÃO ENTRAR DE BAIXO PARA CIMA

    cartas.forEach((carta, indice) => {
      if (!carta || !carta.active) return;

      // Guarda a posição final.
      const yFinal = carta.y;

      // Começa completamente abaixo da tela.
      carta.y = ALTURA_LAYOUT + 300;

      // Começa invisível.
      carta.alpha = 0;

      // Garante que a carta fique acima dos elementos do campo durante a entrada.
      carta.setDepth(2000 + indice);

      this.tweens.add({
        targets: carta,

        // Sobe até a posição normal da mão.
        y: yFinal,

        // Aparece junto com o movimento.
        alpha: 1,

        duration: 300,

        // Pequeno atraso entre as cartas para dar sensação de que a mão inteira está subindo.
        delay: indice * 18,

        ease: "Cubic.Out",

        onComplete: () => {
          // Garante que terminou completamente visível.
          carta.alpha = 1;
          carta.y = yFinal;
        },
      });
    });

    // LIBERA O JOGO DEPOIS DA ANIMAÇÃO

    this.time.delayedCall(340 + cartas.length * 18, () => {
      this.travado = false;
      this.desenharRodaBotoes();
    });
  }
}
