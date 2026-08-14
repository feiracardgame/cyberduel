// ============================================================================
// CONSTANTES DE LAYOUT
// ============================================================================
// A resolução interna do jogo foi elevada para 1080x2160 (ver main.js), 3x a
// resolução original de 360x720, para ficar nítido em telas de alta
// densidade. Todas as posições e tamanhos abaixo já estão nessa escala.
//
// O campo de batalha segue o layout 2x5 POR JOGADOR: cada lado (inimigo e
// jogador) tem 2 fileiras de 5 slots (10 cartas por lado, 20 no total).
// O inimigo ocupa as duas fileiras de cima, o jogador as duas de baixo.
// O layout tem duas variações (normal e ampliada, com a mão escondida — ver
// LAYOUT_CAMPO_NORMAL/AMPLIADO abaixo). x guarda o centro X de cada uma das
// 5 colunas (compartilhado pelas 4 fileiras); y* guarda o centro Y de cada
// fileira individual.
// ============================================================================
const GW = 1080; // largura interna do jogo
const GH = 2160; // altura interna do jogo

// Gera o layout completo do campo (posições X/Y de cada uma das 4 fileiras
// e das 5 colunas) a partir de um punhado de medidas base. Usado para gerar
// dois layouts: um normal (com a mão visível) e um ampliado (mão escondida,
// cartas maiores ocupando o espaço que a mão deixou livre).
function calcularLayoutCampo(slotW, slotH, gapFileira, gapTimes, yInimigoTras) {
  const yInimigoFrente = yInimigoTras + slotH + gapFileira;
  const yJogadorFrente = yInimigoFrente + slotH + gapTimes;
  const yJogadorTras = yJogadorFrente + slotH + gapFileira;

  const gapCol = Math.min(20, Math.max(10, (GW - slotW * 5) / 4));
  const larguraTotal = 5 * slotW + 4 * gapCol;
  const margem = (GW - larguraTotal) / 2;
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

// Layout normal: mão visível embaixo.
// Cartas maiores e menor distância entre o campo inimigo e o jogador.
const LAYOUT_CAMPO_NORMAL = calcularLayoutCampo(
  195, // slotW: largura da carta
  255, // slotH: altura da carta
  12, // gapFileira: espaço entre as duas fileiras
  30, // gapTimes: espaço entre inimigo e jogador
  560, // yInimigoTras (empurrado pra baixo, deixa espaço pra mão do inimigo no topo)
);

// Layout ampliado: mão escondida.
// Cartas ainda maiores, aproveitando o espaço liberado pela mão.
const LAYOUT_CAMPO_AMPLIADO = calcularLayoutCampo(
  195, // slotW: largura da carta
  280, // slotH: altura da carta
  16, // gapFileira: espaço entre as duas fileiras
  120, // gapTimes: espaço entre inimigo e jogador
  585, // yInimigoTras
);

// Altura Y da faixa da mão do inimigo (topo da tela) e da mão do jogador
// (perto do rodapé) — usadas em desenharMaoInimigo() e desenharMaoEmLeque().
const Y_MAO_INIMIGO = 230;
const Y_MAO_JOGADOR = 1900;

class CenaJogo extends Phaser.Scene {
  constructor() {
    super("CenaJogo");
  }

  // Sem preload() aqui de propósito: todos os assets (imagens e sons)
  // já foram carregados antes, pela CenaPreload (ver js/cenas/preload.js)
  // — que roda primeiro e mostra a barra de carregamento — e ficam
  // disponíveis no cache do Phaser em qualquer cena depois dela,
  // incluindo esta.

  create() {
    this.partida = new Partida();
    this.musicaFundo = this.sound.add("musicaFundo", {
      loop: true,
      volume: 0.3,
    });
    this.somTorcida = this.sound.add("somTorcida", {
      loop: true,
      volume: 0.03,
    });
    this.somJogarCarta = this.sound.add("somJogarCarta", {
      loop: false,
      volume: 0.3,
    });
    this.somPop = this.sound.add("somPop", {
      loop: false,
      volume: 0.3,
    });
    this.somComprarCarta = this.sound.add("somComprarCarta", {
      loop: false,
      volume: 0.3,
    });
    this.somBuff = this.sound.add("somBuff", {
      loop: false,
      volume: 0.3,
    });
    this.somHover = this.sound.add("somHover", {
      loop: false,
      volume: 0.15,
    });
    this.musicaFundo.play();
    this.somTorcida.play();

    // Traçado preto padrão em TODOS os textos da cena: sobrescreve
    // this.add.text para injetar stroke preto sempre que a chamada não
    // definir um estilo de traçado próprio. Assim não precisamos repetir
    // { stroke: '#000000', strokeThickness: N } em cada this.add.text().
    const criarTextoOriginal = this.add.text.bind(this.add);
    this.add.text = (x, y, texto, estilo = {}) => {
      const estiloComTraco = Object.assign(
        { stroke: "#000000", strokeThickness: 4 },
        estilo,
      );
      return criarTextoOriginal(x, y, texto, estiloComTraco);
    };

    // Controla se a mão está escondida (para dar mais espaço/destaque
    // ao campo). Começa visível.
    this.maoEscondida = false;
    this.layout = LAYOUT_CAMPO_NORMAL;

    // Trava a interação enquanto uma animação de "resposta" está rolando
    // (jogar carta, conjurar efeito, devolver carta, passar turno) ou
    // enquanto a visualização detalhada de uma carta está aberta, para
    // evitar cliques duplos e conflitos de tween.
    this.travado = false;

    // Referência ao texto de resultado do combate, para poder
    // destruí-lo com segurança caso a interface seja redesenhada
    // antes da animação dele terminar.
    this.textoResultadoAtual = null;

    // Controle do modal de visualização de carta
    this.modalAberto = false;
    this.painelDetalheAtual = null;
    this.overlayDetalheAtual = null;
    this.mascaraDetalheAtual = null;

    // Controle da janela de zoom da arte (abre por cima do modal de
    // detalhe, ao passar o mouse sobre a arte recortada — ver
    // abrirZoomCarta()/fecharZoomCarta()).
    this.zoomAberto = false;
    this.painelZoomAtual = null;
    this.overlayZoomAtual = null;
    this.handlerTiltZoomAtual = null;

    // Timestamp (this.time.now) até quando abrirZoomCarta() fica
    // bloqueado — evita abrir o zoom sem querer logo ao abrir a
    // visualização avançada (o dedo/mouse pode já estar em cima da
    // arte nesse instante) ou logo depois de fechar o zoom (evita
    // reabrir na hora por causa do ponteiro ainda estar ali perto).
    this.zoomBloqueadoAte = 0;

    // Listeners globais (this.input.on) do arrastar-pra-rolar da descrição
    // no modal de detalhe (ver habilitarScrollDescricao()). Precisam ser
    // guardados aqui pra poderem ser desligados com this.input.off() ao
    // fechar o modal — senão eles ficam acumulando toda vez que uma carta
    // com descrição rolável é aberta.
    this.handlersScrollDescAtual = null;

    // Objetos do modo de mira (anéis + zonas de toque) do botão "Ativar
    // Habilidade" do modal de detalhe — ver iniciarAtivacaoHabilidade().
    this.objetosSelecaoAlvo = null;

    // Botão de menu (☰) fixo no canto direito da tela — ver
    // desenharRodaBotoes()/esconderRodaBotoes(). Só existe (não-null)
    // quando está de fato visível em cena.
    this.rodaBotoesContainer = null;

    // As 3 opções (Histórico / Passar Turno / Desistir) ficam escondidas
    // até o botão de menu ser tocado — ver abrirOpcoesDaRoda()/
    // fecharOpcoesDaRoda(). Só existe (não-null) enquanto o menu estiver
    // aberto na tela.
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

    // Só considera que um "arraste" de fato começou depois que o ponteiro
    // se mover mais que este limiar. Sem isso, qualquer toque (mesmo um
    // clique simples para abrir os detalhes da carta) dispararia
    // dragstart/dragend e nunca chegaríamos a um "tap" limpo.
    this.input.dragDistanceThreshold = 8;

    // ---------- COMANDOS DE DEBUG (console do navegador) ----------
    // window.puxarCarta("nome ou pedaço do nome") -> tira essa carta do
    //   SEU deck (procura por nome, sem diferenciar maiúscula/minúscula
    //   nem exigir o nome completo) e coloca na sua mão, redesenhando a
    //   tela na hora. Ex: puxarCarta("cryptoacionistas") ou puxarCarta("vírus")
    // window.listarDeck() -> mostra (console.table) todas as cartas que
    //   ainda estão no seu deck, pra saber o nome exato de cada uma.
    // window.listarMao() -> mesma coisa, mas pra mão.
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
      const termo = (busca || "").toString().toLowerCase();
      const deck = this.partida.jogador.deck.cartas;
      const indice = deck.findIndex((c) =>
        c.nome.toLowerCase().includes(termo),
      );

      let carta;
      if (indice !== -1) {
        [carta] = deck.splice(indice, 1);
      } else {
        // Não achou no deck: procura nos pools e cria a carta na hora,
        // mesmo que ela nunca tenha entrado no deck desta partida.
        const baseEfeito = POOL_CARTAS_EFEITO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );
        const baseMonstro = POOL_CARTAS_MONSTRO.find((c) =>
          c.nome.toLowerCase().includes(termo),
        );

        if (baseEfeito) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            baseEfeito.poder,
            "efeito",
            {
              nome: baseEfeito.nome,
              descricao: baseEfeito.descricao,
              efeito: baseEfeito.efeito,
            },
          );
        } else if (baseMonstro) {
          carta = new Carta(
            9000 + Math.floor(Math.random() * 1000),
            baseMonstro.poder,
            "monstro",
            {
              nome: baseMonstro.nome,
              descricao: baseMonstro.descricao,
              efeitoTurno: baseMonstro.efeitoTurno,
              imagem: baseMonstro.imagem,
              foco: baseMonstro.foco,
              efeito: baseMonstro.efeito, // <- adicionado
              habilidadeAtiva: baseMonstro.habilidadeAtiva, // <- adicionado
              somAtaque: baseMonstro.somAtaque,
            },
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
      console.log(`puxarCarta: "${carta.nome}" foi pra sua mão.`);
      return carta;
    };

    // --- Drag and Drop das cartas da mão ---
    this.input.on("dragstart", (pointer, gameObject) => {
      if (this.travado || !gameObject.dadosCarta) return;
      // Mesma defesa de tratarSoltarCarta: se a carta deste objeto não
      // está mais na mão, nem deixa o arraste começar.
      if (!this.partida.jogador.mao.cartas.includes(gameObject.dadosCarta)) {
        return;
      }
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
      if (this.travado || !gameObject.dadosCarta) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on("dragend", (pointer, gameObject) => {
      if (this.travado || !gameObject.dadosCarta) return;
      this.tratarSoltarCarta(gameObject);
    });

    this.desenharInterface();
  }

  // Gera uma cor fixa baseada no ID da carta
  obterCorPorId(id) {
    const cores = [
      0x8e44ad, 0x2980b9, 0x27ae60, 0xd35400, 0xc0392b, 0x16a085, 0xf39c12,
      0x34495e,
    ];
    return cores[id % cores.length];
  }

  // Recorta de verdade (setCrop, na textura original) a fatia da imagem
  // que — depois de escalada — preenche exatamente a janela de
  // larguraJanela x alturaJanela, sem esticar/distorcer a arte (mesma
  // ideia do "object-fit: cover" do CSS) e sem deformar nada. "foco" (0 a
  // 1 em cada eixo — ver POOL_CARTAS_MONSTRO em cartas.js) escolhe QUAL
  // parte da imagem entra nessa fatia: 0.5/0.5 é o centro (padrão),
  // 0/0 pega o canto superior esquerdo, 1/1 o canto inferior direito etc.
  // Como o recorte é feito na textura mesmo (não só escondido atrás de
  // uma máscara por cima), a arte NUNCA pode vazar da janela, custe o
  // que custar o deslocamento pedido pelo foco — é só ajustar o "foco"
  // de cada carta em cartas.js pra reenquadrar, sem tocar em mais nada.
  aplicarRecorteCover(imagem, larguraJanela, alturaJanela, foco) {
    const f = foco || { x: 0.5, y: 0.5 };
    const nativoW = imagem.width;
    const nativoH = imagem.height;
    const escala = Math.max(larguraJanela / nativoW, alturaJanela / nativoH);

    // Tamanho (em pixels da textura ORIGINAL) da fatia que, nessa escala,
    // preenche exatamente a janela — nunca maior que a imagem inteira.
    const cropW = Math.min(nativoW, larguraJanela / escala);
    const cropH = Math.min(nativoH, alturaJanela / escala);

    // Desloca a fatia dentro da imagem conforme o foco, sempre dentro dos
    // limites da própria imagem (então nunca sobra borda vazia).
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

    // IMPORTANTE: setCrop() só decide QUAIS pixels da textura são
    // desenhados — ele NÃO redimensiona a "caixa" (bounding box) que o
    // Phaser usa pra posicionar o objeto (origin). Essa caixa continua
    // do tamanho da imagem INTEIRA já escalada (nativoW x nativoH), não
    // do recorte. Então, sem essa correção, sempre que o recorte não é
    // simétrico dos dois lados — ou seja, sempre que "foco" é diferente
    // de 0.5 em algum eixo — o pedaço visível fica deslocado dentro da
    // janela e pode vazar pra fora dela (era exatamente o bug com o
    // foco.y: 0.15 do CryptoAcionistas). Aqui a gente desloca a imagem
    // de volta pra recentralizar o pedaço visível no meio da janela,
    // não importa o foco escolhido.
    imagem.x = (nativoW * escala) / 2 - cropX * escala - larguraJanela / 2;
    imagem.y = (nativoH * escala) / 2 - cropY * escala - alturaJanela / 2;
  }

  // Encurta nomes longos para caber no espaço pequeno das cartas
  truncarTexto(texto, maximo) {
    if (texto.length <= maximo) return texto;
    return texto.slice(0, maximo - 1) + "…";
  }

  // Selo circular usado para mostrar poder (e também os números
  // maiores da visualização detalhada): bola preta, contorno branco e
  // texto colorido no meio.
  criarSeloEstat(x, y, valor, corTexto, raio) {
    let bola = this.add
      .circle(x, y, raio, 0x000000)
      .setStrokeStyle(1.5, 0xffffff);
    let texto = this.add
      .text(x, y, `${valor}`, {
        fontSize: `${Math.round(raio * 0.95)}px`,
        color: corTexto,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    return [bola, texto];
  }

  desenharInterface() {
    // Mata tweens pendentes e remove qualquer texto de resultado que
    // ainda estivesse na tela, evitando animações "órfãs" apontando
    // para objetos destruídos.
    this.tweens.killAll();
    if (this.textoResultadoAtual) {
      this.textoResultadoAtual.destroy();
      this.textoResultadoAtual = null;
    }

    // IMPORTANTE: removeAll(true) — o "true" manda destruir de verdade os
    // objetos antigos, não só tirá-los da tela. Sem isso (removeAll()
    // sozinho só desanexa, não destrói) as cartas da mão de uma
    // renderização anterior continuavam "fantasmas": invisíveis, mas
    // ainda registradas como interativas/arrastáveis no input do Phaser
    // — daí dava pra arrastar no local onde a mão costumava estar e o
    // jogo aceitava como se aquela carta (já jogada, e não mais na mão)
    // ainda existisse.
    this.children.removeAll(true);

    // O botão de menu e as opções (se existiam) acabaram de ser destruídos
    // junto com o resto — zera as referências pra não mexer num objeto
    // morto (ver esconderRodaBotoes()).
    this.rodaBotoesContainer = null;
    this.rodaOpcoesContainer = null;

    // Se a interface for redesenhada, qualquer modal antigo perde a
    // validade (os objetos já foram destruídos por removeAll acima)
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
    if (this.handlersScrollDescAtual) {
      this.input.off("pointermove", this.handlersScrollDescAtual.handlerMove);
      this.input.off("pointerup", this.handlersScrollDescAtual.handlerUp);
      this.input.off(
        "pointerupoutside",
        this.handlersScrollDescAtual.handlerUp,
      );
      this.input.off("wheel", this.handlersScrollDescAtual.handlerWheel);
      this.handlersScrollDescAtual = null;
    }
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
    this.desenharCampoInimigo();
    this.desenharCampoJogador();
    this.desenharIndicadoresPoder();
    this.desenharIndicadoresDeck();
    this.desenharFundoJogo();
    if (!this.maoEscondida) this.desenharMaoEmLeque();

    // A roda só é (re)desenhada quando o jogador pode de fato interagir.
    // Enquanto travado (vez do oponente resolvendo, efeito em execução,
    // modal aberto etc.), ela fica de fora — ver esconderRodaBotoes() para
    // quem dispara a animação de saída; aqui é só a entrada normal.
    if (!this.travado) this.desenharRodaBotoes();

    this.configurarGestosMao();
  }

  // Mostra as costas das cartas na mão do inimigo, no topo da tela — só
  // pra dar noção visual de quantas cartas ele tem (não revela quais são).
  desenharMaoInimigo() {
    const cartasMao = this.partida.inimigo.mao.cartas;
    const total = cartasMao.length;
    if (total === 0) return;

    const centroX = GW / 2;
    const centroY = Y_MAO_INIMIGO;
    const larguraCarta = 110;
    const alturaCarta = 154;
    const espacamentoMax = 60;
    const espacamentoMin = 26;
    const espacamento =
      total <= 8
        ? espacamentoMax
        : Math.max(espacamentoMin, espacamentoMax - (total - 8) * 5);

    cartasMao.forEach((_carta, indice) => {
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
      let costas = this.add
        .rectangle(0, 0, larguraCarta, alturaCarta, 0x772222)
        .setStrokeStyle(3, 0xffffff);

      let container = this.add.container(posX, posY, [sombra, costas]);
      container.setAngle(angulo);
      container.setDepth(-99);
    });
  }

  // Indicador de quantas cartas restam em cada deck (o do jogador, perto
  // da mão dele embaixo; o do inimigo, perto da mão dele em cima).
  desenharIndicadoresDeck() {
    this.criarIndicadorDeck(
      GW / 9,
      Y_MAO_JOGADOR,
      this.partida.jogador.deck.cartas.length,
      "Deck",
      "#66ff88",
    );
    this.criarIndicadorDeck(
      GW / 5.4,
      Y_MAO_INIMIGO,
      this.partida.inimigo.deck.cartas.length,
      "Deck",
      "#ff6666",
    );
  }

  criarIndicadorDeck(x, y, quantidade, label, cor) {
    const larguraCarta = 100;
    const alturaCarta = 140;

    let sombra = this.add.rectangle(
      6,
      8,
      larguraCarta,
      alturaCarta,
      0x000000,
      0.35,
    );
    let costas = this.add
      .rectangle(0, 0, larguraCarta, alturaCarta, 0x222233)
      .setStrokeStyle(4, cor);
    let numero = this.add
      .text(0, 0, `${quantidade}`, {
        fontSize: "48px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    let rotulo = this.add
      .text(0, alturaCarta / 2 + 26, label, {
        fontSize: "24px",
        color: cor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add.container(x, y, [sombra, costas, numero, rotulo]);
  }

  // ---------- LÓGICA DE ARRASTAR E SOLTAR ----------

  tratarSoltarCarta(gameObject) {
    const carta = gameObject.dadosCarta;

    // Defesa extra (além do removeAll(true) em desenharInterface()): se
    // por qualquer motivo este objeto ainda estiver na tela depois da
    // carta já ter saído da mão — por exemplo jogada, descartada, ou uma
    // renderização antiga que sobrou por uma condição de corrida — a
    // carta não vai mais estar em jogador.mao.cartas. Aqui a gente
    // confirma isso nos DADOS antes de aceitar a jogada, não só
    // confiando que o objeto visual está correto. Sem essa checagem, um
    // objeto "fantasma" nessa situação ainda seria arrastável e o jogo
    // aceitaria a jogada como se a carta estivesse na mão.
    if (!carta || !this.partida.jogador.mao.cartas.includes(carta)) {
      gameObject.destroy();
      return;
    }

    let slots = this.children.list.filter((child) => child.isSlot);
    let slotAtingido = null;

    // Usa o centro da carta arrastada (não a caixa inteira) para achar o
    // slot: com 5 slots lado a lado a carta é mais larga que o espaço
    // entre eles, então testar a bounding box inteira faria o mesmo
    // arraste "bater" em dois slots vizinhos ao mesmo tempo.
    slots.forEach((slot, index) => {
      if (
        Phaser.Geom.Rectangle.Contains(
          slot.getBounds(),
          gameObject.x,
          gameObject.y,
        )
      ) {
        slotAtingido = index;
      }
    });

    // Soltou fora da área de jogo: volta pro leque normalmente
    if (slotAtingido === null) {
      this.animarRetornoAoLeque(gameObject, false);
      return;
    }

    // --- Cartas de efeito: nunca vão para o campo. Ao serem soltas,
    // são conjuradas no meio da tela e consumidas na hora. ---
    if (carta.tipo === "efeito") {
      this.conjurarCartaDeEfeitoJogador(gameObject, carta);
      this.somPop.play();
      return;
    }

    // --- Cartas de monstro: comportamento original, vão para o campo ---
    const temEspaco = this.partida.jogador.campo.temEspaco(slotAtingido);
    this.somJogarCarta.play();

    if (!temEspaco) {
      this.animarRetornoAoLeque(gameObject, true);
      this.cameras.main.shake(150, 0.002);
      return;
      this.somJogarCarta.play();
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
        // CyberVendedor (e qualquer outra carta BUFF_ALIADO_ESCOLHIDO no
        // futuro): o efeito não pode ser aplicado de cara porque depende de
        // uma escolha do jogador. Em vez de jogarCartaDoJogador() (que já
        // resolveria o efeito sozinho), coloca a carta em campo "crua" e
        // abre a seleção — o efeito só é aplicado quando o jogador escolhe
        // o alvo, em confirmarEscolhaBuffAliado().
        // IMPORTANTE: isso é só pra efeito passivo "ao invocar" (Venda
        // Casada). Cartas com habilidadeAtiva=true (ex: Estagiário de ML)
        // NÃO devem abrir essa seleção na invocação — o alvo delas só é
        // escolhido depois, em campo, pelo botão "Ativar Habilidade" (ver
        // iniciarAtivacaoHabilidade). Sem esse filtro, o Estagiário também
        // disparava a seleção de aliado assim que entrava em campo.
        const precisaEscolherAlvo =
          carta.efeito &&
          carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO &&
          !carta.habilidadeAtiva;

        if (precisaEscolherAlvo) {
          const sucesso = this.partida.colocarCartaDoJogador(
            carta,
            slotAtingido,
          );
          this.desenharInterface();
          if (sucesso) {
            this.iniciarSelecaoDeAliadoParaBuff(carta, slotAtingido);
          } else {
            this.travado = false;
          }
          return;
        }

        this.partida.jogarCartaDoJogador(carta, slotAtingido);
        this.travado = false;
        this.desenharInterface();
      },
    });
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
        // Restaura a profundidade original da carta na pilha do leque.
        // É essa linha (setDepth em vez de reordenar a lista de
        // children) que garante que nenhuma carta fique "presa"
        // atrás de outra depois de um hover ou de um drag.
        gameObject.setDepth(gameObject.depthBase);
        this.travado = false;
      },
    });
  }

  // ---------- CONJURAÇÃO DE CARTAS DE EFEITO ----------

  // Quando o jogador solta uma carta de efeito: a própria carta arrastada
  // voa até o meio da tela, cresce, "pulsa" no impacto (momento em que o
  // efeito é de fato aplicado) e então desaparece. Só depois a interface
  // é redesenhada e os alvos afetados recebem a animação de buff/debuff.
  conjurarCartaDeEfeitoJogador(gameObject, carta) {
    this.travado = true;
    this.esconderRodaBotoes();
    this.tweens.killTweensOf(gameObject);
    gameObject.setDepth(3500);

    this.tweens.add({
      targets: gameObject,
      x: GW / 2,
      y: GH / 2,
      angle: 0,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 260,
      ease: "Back.Out",
      onComplete: () => {
        const resultado = this.partida.jogarCartaEfeitoDoJogador(carta);

        // Pulso no instante em que o efeito é aplicado
        this.tweens.add({
          targets: gameObject,
          scaleX: 1.85,
          scaleY: 1.85,
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

  // Versão usada quando é a IA quem conjura uma carta de efeito: não existe
  // um objeto de carta sendo arrastado, então criamos uma carta temporária
  // no meio da tela só para a animação de conjuração.
  conjurarCartaDeEfeitoInimigo(carta, aoConcluir) {
    const corFundo = this.obterCorPorId(carta.id);

    let rotulo = this.add
      .text(0, -285, "O inimigo conjurou:", {
        fontSize: "26px",
        color: "#ff8888",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let sombra = this.add.rectangle(8, 10, 260, 340, 0x000000, 0.4);
    let fundo = this.add
      .rectangle(0, 0, 260, 340, corFundo)
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
    let iconeTexto = this.add
      .text(0, 60, "⚡", { fontSize: "70px" })
      .setOrigin(0.5);

    let container = this.add.container(GW / 2, GH / 2, [
      rotulo,
      sombra,
      fundo,
      nomeTexto,
      iconeTexto,
    ]);
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

  // Mostra um "+X"/"-X" flutuante sobre cada carta de campo afetada por um
  // buff ou debuff, junto de um pequeno pulso de escala na própria carta.
  //
  // IMPORTANTE: as cartas de campo acabaram de ser (re)criadas por
  // desenharInterface() e já têm sua própria animação de entrada rodando
  // (scale 0 -> 1, ver criarCartaDeCampo). Se disparássemos o pulso do
  // buff agora, ele entraria em conflito com essa animação de entrada —
  // as duas mexendo em scaleX/scaleY ao mesmo tempo — e o resultado era a
  // carta "sumir" (ir parar em escala 0) no meio do processo. Por isso
  // esperamos a entrada terminar antes de disparar o pulso.
  animarCartasAfetadas(afetadas) {
    if (!afetadas || afetadas.length === 0) return;

    const DURACAO_ENTRADA_CARTA = 260; // precisa bater com criarCartaDeCampo
    this.time.delayedCall(DURACAO_ENTRADA_CARTA + 20, () => {
      afetadas.forEach(({ carta: cartaAfetada, delta }) => {
        const alvo = this.children.list.find(
          (c) => c.dadosCartaCampo === cartaAfetada,
        );
        if (!alvo) return;
        // delta negativo = dano de verdade (rasgo vermelho); delta
        // positivo/zero = fortalecimento (pulso verde) — ver
        // animarDanoCarta/animarBuffCarta logo abaixo.
        if (delta < 0) this.animarDanoCarta(alvo, delta);
        else this.animarBuffCarta(alvo, delta);
      });
    });
  }

  // Ponto único de entrada para tratar cartas afetadas por um efeito quando
  // ALGUMAS delas podem ter morrido (poder chegou a 0). Diferente de
  // animarCartasAfetadas (que assume que a interface já foi redesenhada e
  // a carta morta já sumiu do campo), esta função roda ANTES do redesenho:
  // toca a animação de morte em cima do container que ainda está na tela,
  // e só chama redesenharFn() (o desenharInterface() de sempre — a carta
  // já foi removida do array pelo removerMortas() lá em main.js, só falta
  // a interface refletir isso) depois que a animação de morte termina.
  // Cartas que só foram feridas (mas sobreviveram) recebem a animação
  // normal de dano/buff depois do redesenho, como sempre.
  processarCartasAfetadas(afetadas, redesenharFn) {
    if (!afetadas || afetadas.length === 0) {
      redesenharFn();
      return;
    }

    const mortas = afetadas.filter(({ carta }) => carta.poder <= 0);
    const vivas = afetadas.filter(({ carta }) => carta.poder > 0);

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

  // Animação de dano "de verdade" (carta sobreviveu, mas perdeu poder):
  // um rasgo vermelho corta o card e o número do dano sobe em vermelho,
  // com um tremor mais brusco que o pulso suave do buff — pra ficar claro
  // que é um golpe, não um reforço.
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

  // Animação de morte: a carta treme, racha e se despedaça (colapsa de
  // escala com rotação) enquanto uma caveira sobe e se dissolve. Roda
  // sobre o container que ESTÁ na tela agora, antes do redesenho tirar a
  // carta morta do campo — ver processarCartasAfetadas().
  // Animação de morte: treme, racha ao meio na mesma diagonal do rasgo de
  // dano, e então a carta literalmente se despedaça — as duas metades
  // voam pra lados opostos e um punhado de cacos menores explode entre
  // elas, tudo girando, tingido de vermelho e sumindo num fade. Roda
  // sobre o container que ESTÁ na tela agora, antes do redesenho tirar a
  // carta morta do campo — ver processarCartasAfetadas().
  // ============================================================================
  // ANIMAÇÃO DE MORTE DA CARTA
  // ============================================================================
  // Fluxo:
  // 1. Captura a carta atual numa RenderTexture.
  // 2. Mostra a rachadura.
  // 3. Esconde a carta original.
  // 4. Divide a captura em duas metades + cacos.
  // 5. Faz tudo voar, girar, diminuir e desaparecer.
  // 6. Só depois destrói a carta original e libera o redraw.
  //
  // CORREÇÃO IMPORTANTE:
  // A RenderTexture é criada em 0,0, mas a carta está em coordenadas de mundo
  // (cx, cy). Então o draw() precisa compensar cx/cy. Sem isso a captura pode
  // ficar fora da área da textura e os pedaços aparecem transparentes.
  // ============================================================================

  // ============================================================================
  // ANIMAÇÃO DE MORTE DA CARTA
  // ============================================================================
  // Versão robusta:
  // - NÃO usa RenderTexture
  // - NÃO usa textura temporária
  // - NÃO usa crop
  // - NÃO usa GeometryMask
  //
  // A carta original é animada diretamente e, no momento da explosão,
  // são criados cacos gráficos independentes.
  // ============================================================================

  animarMorteCarta(containerCampo, aoConcluir) {
    if (!containerCampo || !containerCampo.active) {
      if (aoConcluir) aoConcluir();
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

    // --------------------------------------------------------------------------
    // IMPACTO
    // --------------------------------------------------------------------------

    this.cameras.main.shake(180, 0.008);

    if (this.somBuff) {
      try {
        this.somBuff.play();
      } catch (e) {
        console.warn("Erro ao tocar som de morte:", e);
      }
    }

    // --------------------------------------------------------------------------
    // FLASH VERMELHO
    // --------------------------------------------------------------------------

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

    // --------------------------------------------------------------------------
    // RACHADURA
    // --------------------------------------------------------------------------

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

    // --------------------------------------------------------------------------
    // TREME A CARTA
    // --------------------------------------------------------------------------

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

  // ============================================================================
  // EXPLOSÃO / DESPEDAÇAMENTO
  // ============================================================================
  // Essa função NÃO depende de nenhuma textura.
  // Os cacos são Graphics independentes e, portanto, continuam sendo
  // renderizados mesmo se a carta original tiver imagem, máscara, etc.
  // ============================================================================

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

    // --------------------------------------------------------------------------
    // ESCONDE A CARTA ORIGINAL
    // --------------------------------------------------------------------------

    containerOriginal.setVisible(false);
    containerOriginal.disableInteractive();

    // --------------------------------------------------------------------------
    // CRIA OS CACOS
    // --------------------------------------------------------------------------

    const pedacos = [];

    // Cores dos cacos.
    const cores = [0xff2222, 0xff4444, 0xff5555, 0xcc1111, 0xff7777];

    // --------------------------------------------------------------------------
    // DUAS GRANDES METADES
    // --------------------------------------------------------------------------

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

    // --------------------------------------------------------------------------
    // 12 CACOS MENORES
    // --------------------------------------------------------------------------

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

    // --------------------------------------------------------------------------
    // EXPLOSÃO
    // --------------------------------------------------------------------------

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
  desenharFundoJogo() {
    const fundo = this.add
      .image(GW / 2, GH / 2, "jogoFundo")
      .setOrigin(0.5)
      .setDisplaySize(GW, GH)
      .setAlpha(0.3)
      .setDepth(-100);

    fundo.setScrollFactor(0);

    return fundo;
  }

  despedacarCarta(chaveTextura, cx, cy, CW, CH, containerOriginal, aoConcluir) {
    const pedacos = [];

    // --------------------------------------------------------------------------
    // 1) DUAS METADES GRANDES
    // --------------------------------------------------------------------------

    const metades = [
      {
        // Triângulo superior/direito.
        pontos: [-CW / 2, -CH / 2, CW / 2, -CH / 2, CW / 2, CH / 2],

        dir: {
          x: 1,
          y: -0.4,
        },
      },

      {
        // Triângulo inferior/esquerdo.
        pontos: [-CW / 2, -CH / 2, CW / 2, CH / 2, -CW / 2, CH / 2],

        dir: {
          x: -1,
          y: 0.4,
        },
      },
    ];

    metades.forEach(({ pontos, dir }) => {
      let imagem = this.add.image(cx, cy, chaveTextura).setOrigin(0.5);

      imagem.setDepth(3700);
      imagem.setTint(0xff5555);

      // Máscara triangular.
      let mascaraG = this.add.graphics();

      mascaraG.fillStyle(0xffffff);

      mascaraG.beginPath();

      mascaraG.moveTo(cx + pontos[0], cy + pontos[1]);

      mascaraG.lineTo(cx + pontos[2], cy + pontos[3]);

      mascaraG.lineTo(cx + pontos[4], cy + pontos[5]);

      mascaraG.closePath();
      mascaraG.fillPath();

      mascaraG.setVisible(false);

      imagem.setMask(mascaraG.createGeometryMask());

      // Guardamos pra destruir junto depois.
      imagem._mascaraGraphics = mascaraG;

      pedacos.push({
        obj: imagem,
        dir,
        giro: Phaser.Math.Between(20, 60) * (dir.x >= 0 ? 1 : -1),
      });
    });

    // --------------------------------------------------------------------------
    // 2) CACOS MENORES
    // --------------------------------------------------------------------------

    const COLS = 3;
    const LINS = 3;

    const pecaW = CW / COLS;
    const pecaH = CH / LINS;

    for (let l = 0; l < LINS; l++) {
      for (let c = 0; c < COLS; c++) {
        let caco = this.add.image(cx, cy, chaveTextura).setOrigin(0.5);

        // Recorta um pedaço da textura.
        caco.setCrop(c * pecaW, l * pecaH, pecaW, pecaH);

        caco.setTint(0xff6666);
        caco.setDepth(3701);

        // Posição original desse caco dentro da carta.
        const offX = -CW / 2 + pecaW * (c + 0.5);

        const offY = -CH / 2 + pecaH * (l + 0.5);

        const dist = Math.hypot(offX, offY) || 1;

        pedacos.push({
          obj: caco,

          dir: {
            x: offX / dist,
            y: offY / dist,
          },

          giro: Phaser.Math.Between(-180, 180),

          pequeno: true,
        });
      }
    }

    // --------------------------------------------------------------------------
    // 3) ANIMA TODOS OS PEDAÇOS
    // --------------------------------------------------------------------------

    let pendentes = pedacos.length;

    // Segurança extrema: se por algum motivo não houver pedaços,
    // não deixa a partida travada para sempre.
    if (pendentes === 0) {
      this.textures.remove(chaveTextura);

      if (containerOriginal && containerOriginal.active) {
        containerOriginal.destroy();
      }

      aoConcluir();
      return;
    }

    pedacos.forEach(({ obj, dir, giro, pequeno }) => {
      const distancia = pequeno
        ? Phaser.Math.Between(90, 220)
        : Phaser.Math.Between(160, 260);

      const atraso = pequeno ? Phaser.Math.Between(0, 90) : 0;

      // Salva posição inicial antes do tween.
      const destinoX = obj.x + dir.x * distancia;

      const destinoY = obj.y + dir.y * distancia + 60;

      this.tweens.add({
        targets: obj,

        x: destinoX,
        y: destinoY,

        angle: giro,

        alpha: 0,

        scaleX: pequeno ? 0.4 : 0.75,
        scaleY: pequeno ? 0.4 : 0.75,

        duration: pequeno ? 480 : 560,

        delay: atraso,

        ease: "Cubic.In",

        onComplete: () => {
          // Destrói a máscara específica das metades.
          if (obj._mascaraGraphics && obj._mascaraGraphics.active) {
            obj._mascaraGraphics.destroy();
          }

          // Destrói o pedaço.
          if (obj && obj.active) {
            obj.destroy();
          }

          pendentes--;

          // Quando TODOS os pedaços terminaram:
          if (pendentes === 0) {
            // Libera a textura temporária.
            this.textures.remove(chaveTextura);

            // Agora sim destrói a carta original.
            if (containerOriginal && containerOriginal.active) {
              containerOriginal.destroy();
            }

            // Libera o fluxo para o redraw.
            aoConcluir();
          }
        },
      });
    });
  }
  animarBuffCarta(containerCampo, delta) {
    // Defesa extra: garante que não haja nenhuma tween antiga ainda
    // mexendo na escala desta carta, e parte de um estado conhecido
    // (escala 1) antes de aplicar o pulso.
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

  // ---------- DESENHO DO CAMPO ----------

  desenharCampoInimigo() {
    const L = this.layout;
    this.add
      .text(GW / 2, L.yInimigoTras - L.slotH / 2 - 26, "INIMIGO", {
        fontSize: "24px",
        color: "#ff8888",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
      const xPos = L.x[col];
      const yPos = L.yInimigo[fileira];

      let slotInimigo = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x552222)
        .setStrokeStyle(2, 0x552222)
        .setAlpha(0);
      this.tweens.add({
        targets: slotInimigo,
        alpha: 0.4,
        duration: 260,
        delay: i * 18,
        ease: "Sine.easeOut",
      });

      let carta = this.partida.inimigo.campo.cartas[i];
      if (carta) {
        this.criarCartaDeCampo(xPos, yPos, carta, L);
      }
    }
  }

  desenharCampoJogador() {
    const L = this.layout;
    this.add
      .text(GW / 2, L.yJogadorTras + L.slotH / 2 + 26, "VOCÊ", {
        fontSize: "24px",
        color: "#88ff99",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
      const xPos = L.x[col];
      const yPos = L.yJogador[fileira];

      let slot = this.add
        .rectangle(xPos, yPos, L.slotW, L.slotH, 0x224422)
        .setStrokeStyle(2, 0x225522)
        .setAlpha(0);
      slot.isSlot = true; // Identificador para a colisão do Drag & Drop
      this.tweens.add({
        targets: slot,
        alpha: 0.4,
        duration: 260,
        delay: i * 18,
        ease: "Sine.easeOut",
      });

      let carta = this.partida.jogador.campo.cartas[i];
      if (carta) {
        this.criarCartaDeCampo(xPos, yPos, carta, L);
      }
    }
  }

  // Carta do campo com pequena sombra e animação de "pop" ao aparecer.
  // O poder fica centralizado embaixo, dentro de um selo circular.
  // Também é clicável: um toque abre a visualização detalhada da carta.
  criarCartaDeCampo(xPos, yPos, carta, layout) {
    const L = layout || this.layout;
    const escala = L.slotH / 210; // 210 = altura base do slot no layout normal
    let corFundo = this.obterCorPorId(carta.id);
    const CW = Math.round(L.slotW * 0.926),
      CH = Math.round(L.slotH * 0.914); // um pouco menor que o slot, com respiro

    let sombra = this.add.rectangle(6, 8, CW, CH, 0x000000, 0.35);
    let brilho = this.add.rectangle(0, -CH / 2 + 3, CW - 10, 4, 0xffffff, 0.35);
    let nomeTexto = null;
    if (!carta.imagem) {
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

    const [poderBola, poderTexto] = this.criarSeloEstat(
      0,
      Math.round(66 * escala),
      carta.poder,
      "#ff5555",
      Math.round(24 * escala),
    );
    let fundo = carta.imagem
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

    // Selo indicando que é uma carta de efeito (a passiva já foi
    // disparada ao entrar em campo — este selo é só um lembrete visual)
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

    // Anel de impacto: some rapidinho, dá um "pop" visual no instante
    // em que a carta assenta no slot.
    let anel = this.add
      .circle(xPos, yPos, 10, corFundo, 0)
      .setStrokeStyle(6, 0xffffff, 0.9)
      .setDepth(500);

    let container = this.add.container(xPos, yPos, filhos);
    container.setScale(0);
    container.setSize(CW, CH);
    container.setInteractive({ useHandCursor: true });

    // Referência à carta de dados, usada para localizar esta carta na
    // tela quando um efeito de buff/debuff precisa animá-la.
    container.dadosCartaCampo = carta;

    container.on("pointerup", () => {
      if (this.travado) return;
      this.mostrarDetalheCarta(carta);
    });

    // No desktop, passar o mouse já abre a visualização grande.
    // Em touch não existe "hover" de verdade, então o toque continua
    // sendo tratado pelo pointerup acima.
    container.on("pointerover", (pointer) => {
      if (this.travado || pointer.pointerType !== "mouse") return;
      this.mostrarDetalheCarta(carta);
    });

    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 300,
      ease: "Back.Out",
    });

    // Anel se expandindo e sumindo — o "pop" visual de entrada
    this.tweens.add({
      targets: anel,
      radius: 110,
      alpha: 0,
      duration: 380,
      ease: "Cubic.Out",
      onComplete: () => anel.destroy(),
    });
  }

  // ---------- DESENHO DA MÃO (LEQUE) ----------

  // Posição de onde as cartas recém-compradas "saem" (o monte de compra)
  // até chegarem na posição delas no leque — ver animarCompraCarta().
  // Fica acima da mão, no centro, simulando o baralho entregando as
  // cartas uma a uma para a mão do jogador.
  obterPosicaoMonteCompra() {
    return { x: GW / 2, y: 1230 };
  }

  desenharMaoEmLeque() {
    let cartasMao = this.partida.jogador.mao.cartas;
    let totalCartas = cartasMao.length;

    if (totalCartas === 0) return;

    // --------------------------------------------------------------------------
    // CARTAS RECÉM-COMPRADAS
    // --------------------------------------------------------------------------

    const recemCompradas = this.partida.jogador.cartasRecemCompradas || [];

    this.partida.jogador.cartasRecemCompradas = [];

    // --------------------------------------------------------------------------
    // CONFIGURAÇÃO DO LEQUE
    // --------------------------------------------------------------------------

    const centroX = GW / 2;
    const centroY = Y_MAO_JOGADOR;

    const espacamentoMax = 82;
    const espacamentoMin = 34;

    const espacamentoX =
      totalCartas <= 6
        ? espacamentoMax
        : Math.max(espacamentoMin, espacamentoMax - (totalCartas - 6) * 7);

    const anguloPasso = 1;
    const curvaturaY = 7;

    cartasMao.forEach((carta, indice) => {
      let offset = indice - (totalCartas - 1) / 2;

      let posX = centroX + offset * espacamentoX;

      let posY = centroY + Math.pow(offset, 2) * curvaturaY;

      let angulo = offset * anguloPasso;

      // ------------------------------------------------------------------------
      // VISUAL DA CARTA
      // ------------------------------------------------------------------------

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

      const filhos = [sombra, fundoCarta, borda, nomeTexto];

      // ------------------------------------------------------------------------
      // SELO DE PODER
      // ------------------------------------------------------------------------

      if (!ehEfeitoLeque) {
        const [poderBola, poderTexto] = this.criarSeloEstat(
          0,
          94,
          carta.poder,
          "#ff5555",
          31,
        );

        filhos.push(poderBola, poderTexto);
      }

      // ------------------------------------------------------------------------
      // CARTA DE EFEITO
      // ------------------------------------------------------------------------

      if (ehEfeitoLeque) {
        let iconeGrande = this.add
          .text(0, 70, "⚡", {
            fontSize: "70px",
          })
          .setOrigin(0.5);

        let selo = this.add
          .circle(70, -98, 22, 0x1a1a1a)
          .setStrokeStyle(2, 0xffffff);

        let iconeSelo = this.add
          .text(70, -98, "⚡", {
            fontSize: "23px",
          })
          .setOrigin(0.5);

        filhos.push(iconeGrande, selo, iconeSelo);
      }

      // ------------------------------------------------------------------------
      // CONTAINER DA CARTA
      // ------------------------------------------------------------------------

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

      // =========================================================================
      // ANIMAÇÃO DE ENTRADA
      // =========================================================================

      const indiceCompra = recemCompradas.indexOf(carta);

      if (indiceCompra !== -1) {
        this.animarCompraCarta(
          containerCarta,
          posX,
          posY,
          angulo,
          indiceCompra,
        );
      } else {
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
      }

      // =========================================================================
      // HOVER
      //
      // REGRA:
      // SOMENTE UMA CARTA PODE ESTAR LEVANTADA.
      // =========================================================================

      containerCarta.on("pointerover", (pointer) => {
        if (this.travado) return;

        // ----------------------------------------------------------------------
        // ABAIXA A CARTA QUE ESTAVA LEVANTADA
        // ----------------------------------------------------------------------

        const cartaAnterior = this.cartaHoverAtual;

        if (
          cartaAnterior &&
          cartaAnterior !== containerCarta &&
          cartaAnterior.active
        ) {
          this.tweens.killTweensOf(cartaAnterior);

          const posAnterior = cartaAnterior.posOriginal;

          this.tweens.add({
            targets: cartaAnterior,

            x: posAnterior.x,

            y: posAnterior.y,

            angle: posAnterior.angle,

            scaleX: 1,

            scaleY: 1,

            duration: 120,

            ease: "Sine.easeOut",

            onComplete: () => {
              if (cartaAnterior && cartaAnterior.active) {
                cartaAnterior.setDepth(cartaAnterior.depthBase);
              }
            },
          });
        }

        // ----------------------------------------------------------------------
        // ESTA PASSA A SER A CARTA ATIVA
        // ----------------------------------------------------------------------

        this.cartaHoverAtual = containerCarta;

        this.tweens.killTweensOf(containerCarta);

        containerCarta.setDepth(1000);

        this.tweens.add({
          targets: containerCarta,

          y: centroY - 82,

          angle: 0,

          scaleX: 1.15,

          scaleY: 1.15,

          duration: 150,

          ease: "Back.Out",

          onComplete: () => {
            if (!this.travado && this.somHover) {
              this.somHover.play();
            }
          },
        });

        // ----------------------------------------------------------------------
        // DESKTOP:
        // ABRE A VISUALIZAÇÃO GRANDE
        // ----------------------------------------------------------------------

        if (pointer.pointerType === "mouse") {
          this.mostrarDetalheCarta(carta);
        }
      });

      // =========================================================================
      // POINTER OUT
      // =========================================================================

      containerCarta.on("pointerout", () => {
        if (this.travado) return;

        // ----------------------------------------------------------------------
        // SE OUTRA CARTA JÁ FOI SELECIONADA,
        // NÃO ABAIXA ESTA.
        // ----------------------------------------------------------------------

        if (this.cartaHoverAtual !== containerCarta) {
          return;
        }

        // Agora nenhuma carta está sendo apontada.
        this.cartaHoverAtual = null;

        this.tweens.killTweensOf(containerCarta);

        this.tweens.add({
          targets: containerCarta,

          x: posX,

          y: posY,

          angle: angulo,

          scaleX: 1,

          scaleY: 1,

          duration: 150,

          ease: "Sine.easeOut",

          onComplete: () => {
            if (containerCarta && containerCarta.active) {
              containerCarta.setDepth(containerCarta.depthBase);
            }
          },
        });
      });

      // =========================================================================
      // TOQUE / CLIQUE
      // =========================================================================

      containerCarta.on("pointerup", () => {
        if (this.travado) return;

        this.mostrarDetalheCarta(carta);
      });
    });
  }

  // Anima uma carta recém-comprada: sai do monte de compra (ver
  // obterPosicaoMonteCompra) e "pousa" na posição dela no leque. Cada
  // carta da leva de compras espera sua vez (atraso = indiceCompra *
  // ATRASO_ENTRE_CARTAS), pra chegarem uma de cada vez, não todas juntas.
  // Toca o som de compra bem no instante em que cada carta começa a
  // voar — por enquanto o whoosh de "somComprarCarta" (ver preload()).
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

    containerCarta.setPosition(origem.x, origem.y);
    containerCarta.setAngle(0);
    containerCarta.setScale(0.35);
    containerCarta.setAlpha(0);
    // Fica por cima de tudo enquanto está "voando", pra não passar por
    // baixo de outras cartas do leque no meio do caminho.
    containerCarta.setDepth(3000 + indiceCompra);
    // Evita que o jogador consiga arrastar/clicar a carta enquanto ela
    // ainda está em pleno voo, vindo do monte.
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
        scaleX: 1,
        scaleY: 1,
        duration: 380,
        ease: "Back.Out",
        onComplete: () => {
          if (!containerCarta.active) return;
          containerCarta.setDepth(containerCarta.depthBase);
          containerCarta.setInteractive({ useHandCursor: true });
        },
      });
    });
  }

  // ---------- HISTÓRICO DE CARTAS JOGADAS ----------
  //
  // Modal com a lista (paginada) de todas as cartas jogadas na partida,
  // mais recentes primeiro. Cada linha mostra o turno, quem jogou e o
  // nome da carta; tocar numa linha abre a ficha detalhada dessa carta
  // (reaproveitando mostrarDetalheCarta).

  mostrarHistorico() {
    if (this.modalAberto) return;
    this.modalAberto = true;
    this.historicoAberto = true;
    this.travado = true;
    this.historicoPagina = 0;

    let overlay = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.78);
    overlay.setDepth(4000);
    overlay.setInteractive();
    overlay.on("pointerup", () => this.fecharHistorico());

    let painelBg = this.add
      .rectangle(0, 0, 960, 1440, 0x14141c)
      .setStrokeStyle(9, 0xffffff);
    painelBg.setInteractive();
    painelBg.on("pointerup", () => {});

    let titulo = this.add
      .text(0, -645, "Histórico de Cartas", {
        fontSize: "54px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let fecharBg = this.add
      .circle(420, -645, 42, 0x2a2a2a)
      .setStrokeStyle(3, 0xffffff);
    let fecharTexto = this.add
      .text(420, -645, "✕", { fontSize: "48px", color: "#ffffff" })
      .setOrigin(0.5);
    let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
    fecharBtn.setSize(84, 84);
    fecharBtn.setInteractive({ useHandCursor: true });
    fecharBtn.on("pointerup", () => this.fecharHistorico());

    const totalCartas = this.partida.historico.length;
    let subtitulo = this.add
      .text(
        0,
        -564,
        `${totalCartas} carta${totalCartas === 1 ? "" : "s"} jogada${totalCartas === 1 ? "" : "s"}`,
        { fontSize: "36px", color: "#999999" },
      )
      .setOrigin(0.5);

    // Container que guarda só as linhas da página atual: fica fácil
    // recriar apenas ele quando o usuário troca de página.
    let listaContainer = this.add.container(0, 0, []);

    let btnAnterior = this.criarBotaoPaginacaoHistorico(-180, 585, "‹", () =>
      this.mudarPaginaHistorico(-1),
    );
    let labelPagina = this.add
      .text(0, 585, "", { fontSize: "39px", color: "#cccccc" })
      .setOrigin(0.5);
    let btnProxima = this.criarBotaoPaginacaoHistorico(180, 585, "›", () =>
      this.mudarPaginaHistorico(1),
    );

    let painel = this.add.container(GW / 2, GH / 2, [
      painelBg,
      titulo,
      fecharBtn,
      subtitulo,
      listaContainer,
      btnAnterior,
      labelPagina,
      btnProxima,
    ]);
    painel.setDepth(4001);
    painel.setScale(0.85);
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
      ease: "Back.Out",
    });

    this.atualizarListaHistorico();
    this.somPop.play();
  }

  criarBotaoPaginacaoHistorico(x, y, texto, aoClicar) {
    let bg = this.add.circle(x, y, 48, 0x2a2a2a).setStrokeStyle(3, 0xffffff);
    let label = this.add
      .text(x, y, texto, {
        fontSize: "54px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    let btn = this.add.container(0, 0, [bg, label]);
    btn.setSize(96, 96);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", aoClicar);
    return btn;
  }

  // Redesenha só as linhas da página atual (chamado ao abrir o modal e
  // sempre que o usuário navega entre páginas).
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
      let vazio = this.add
        .text(0, -60, "Nenhuma carta jogada ainda.", {
          fontSize: "38px",
          color: "#aaaaaa",
          align: "center",
          wordWrap: { width: 780 },
        })
        .setOrigin(0.5);
      this.listaHistoricoContainer.add(vazio);
    } else {
      const inicio = this.historicoPagina * TAMANHO_PAGINA;
      const pagina = historico.slice(inicio, inicio + TAMANHO_PAGINA);

      pagina.forEach((entrada, indice) => {
        const y = -450 + indice * 162;
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

  // Uma linha da lista: turno + quem jogou de um lado, nome da carta no
  // meio, seta indicando que é clicável. Tocar na linha abre a ficha da carta.
  criarLinhaHistorico(entrada, y) {
    const corDono = entrada.quem === "jogador" ? 0x2ecc71 : 0xe74c3c;
    const labelDono = entrada.quem === "jogador" ? "Você" : "Inimigo";
    const corLabelDono = entrada.quem === "jogador" ? "#66ff99" : "#ff8888";

    let fundo = this.add
      .rectangle(0, 0, 840, 138, 0x1e1e28)
      .setStrokeStyle(3, 0x333344);
    let barra = this.add.rectangle(-402, 0, 18, 138, corDono);

    let turnoTexto = this.add
      .text(-354, -33, `Turno ${entrada.turno}`, {
        fontSize: "30px",
        color: "#999999",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    let donoTexto = this.add
      .text(-354, 33, labelDono, {
        fontSize: "30px",
        color: corLabelDono,
      })
      .setOrigin(0, 0.5);

    let nomeTexto = this.add
      .text(-60, 0, this.truncarTexto(entrada.carta.nome, 18), {
        fontSize: "38px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 390 },
      })
      .setOrigin(0.5);

    let seta = this.add
      .text(384, 0, "›", { fontSize: "48px", color: "#888888" })
      .setOrigin(0.5);

    let linha = this.add.container(0, y, [
      fundo,
      barra,
      turnoTexto,
      donoTexto,
      nomeTexto,
      seta,
    ]);
    linha.setSize(840, 138);
    linha.setInteractive({ useHandCursor: true });
    linha.on("pointerover", () => fundo.setFillStyle(0x28283a));
    linha.on("pointerout", () => fundo.setFillStyle(0x1e1e28));
    linha.on("pointerup", () => this.abrirDetalheDoHistorico(entrada.carta));

    return linha;
  }

  // Chamado ao tocar numa linha do histórico: fecha o modal de histórico
  // imediatamente (sem animação de saída, pra não brigar de estado com o
  // modal de detalhe) e abre a ficha da carta na sequência.
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
      scale: 0.85,
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

  // ---------- VISUALIZAÇÃO DETALHADA DA CARTA ----------

  // Mostra um painel grande com a "arte" (placeholder colorido), nome,
  // poder (no mesmo selo circular usado nas cartas) e a descrição
  // completa (flavor text + efeito passivo).
  mostrarDetalheCarta(carta) {
    if (this.modalAberto) return;
    this.modalAberto = true;
    this.travado = true;

    // Bloqueia a abertura do zoom da arte por 2s: sem isso, se o
    // dedo/mouse já estiver em cima de onde a arte vai aparecer, o
    // "pointerover" pode disparar o zoom sem querer assim que o modal
    // abre (ver abrirZoomCarta).
    this.zoomBloqueadoAte = this.time.now + 2000;

    // Fundo escurecido cobrindo a tela toda; tocar nele fecha o painel
    let overlay = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.78);
    overlay.setDepth(4000);
    overlay.setInteractive();
    overlay.on("pointerup", () => this.fecharDetalheCarta());

    const corFundo = this.obterCorPorId(carta.id);
    const ehEfeito = carta.tipo === "efeito";

    // A carta tem uma habilidade ativa (ex: Atirador de Elite) e está no
    // SEU campo? Se sim, e ela ainda não foi usada neste turno, mostramos
    // um botão "Ativar Habilidade" no rodapé do painel (ver mais abaixo,
    // logo depois da janela de descrição).
    const podeMostrarBotaoHabilidade =
      !this.partida.partidaEncerrada &&
      !!carta.habilidadeAtiva &&
      carta.efeito &&
      (carta.efeito.tipo === TIPOS_EFEITO.ATACAR ||
        carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO) &&
      this.partida.jogador.campo.cartas.includes(carta);
    const habilidadeJaUsada =
      podeMostrarBotaoHabilidade && carta.usadaEsteTurno;

    let painelBg = this.add
      .rectangle(0, 0, 840, 1320, 0x14141c)
      .setStrokeStyle(9, 0xffffff);
    // Impede que o toque no painel "vaze" para o overlay e feche o modal
    painelBg.setInteractive();
    painelBg.on("pointerup", () => {});

    // Imagem real da carta (quando ela tiver uma textura associada);
    // senão, cai no placeholder colorido de sempre. Tudo isolado dentro
    // de containerImagem só para manter a posição (o efeito de "inclinar"
    // saiu daqui — agora só acontece na janela de zoom, ver abrirZoomCarta).
    const JANELA_ARTE_W = 660;
    const JANELA_ARTE_H = 480;

    let imagem, iconeImagem;
    if (carta.imagem) {
      // A arte real é em pé (retrato) e a janela reservada aqui é mais
      // larga que alta — em vez de esticar a imagem pra caber (o que
      // distorcia o desenho), ela é escalada mantendo a proporção
      // original até cobrir a janela inteira, e o excedente é recortado
      // de verdade da textura (setCrop), não só escondido por uma
      // máscara por cima — assim é IMPOSSÍVEL a arte vazar da janela,
      // não importa o quanto o "foco" (ver cartas.js) desloque o recorte.
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
      iconeImagem = this.add
        .text(0, 0, ehEfeito ? "⚡" : "⚔", { fontSize: "156px" })
        .setOrigin(0.5);
    }
    let moldura = this.add
      .rectangle(0, 0, JANELA_ARTE_W, JANELA_ARTE_H)
      .setStrokeStyle(6, 0xffffff);

    let containerImagem = this.add.container(
      0,
      -320,
      [imagem, moldura, iconeImagem].filter(Boolean),
    );

    if (carta.imagem) {
      // Passar o mouse sobre a arte recortada abre a versão ampliada,
      // por cima deste painel (ver abrirZoomCarta). O hit-area é a
      // moldura, do mesmo tamanho da janela de recorte.
      moldura.setInteractive({ useHandCursor: true });
      moldura.on("pointerover", () => this.abrirZoomCarta(carta));
    }

    let etiquetaTipo = this.add
      .text(0, -615, ehEfeito ? "CARTA DE EFEITO" : "CARTA DE PERSONAGEM", {
        fontSize: "36px",
        color: ehEfeito ? "#ffe066" : "#9be7ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let nomeTexto = this.add
      .text(0, -60, carta.nome, {
        fontSize: "54px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 750 },
      })
      .setOrigin(0.5, 0);

    const filhosPainel = [painelBg, containerImagem, etiquetaTipo, nomeTexto];

    let descY = 160;
    if (!ehEfeito) {
      const [poderBola, poderTexto] = this.criarSeloEstat(
        0,
        135,
        carta.poder,
        "#ff5555",
        90,
      );
      let poderLabel = this.add
        .text(0, 255, "PODER", { fontSize: "33px", color: "#aaaaaa" })
        .setOrigin(0.5);
      filhosPainel.push(poderBola, poderTexto, poderLabel);
      descY = 330;
      this.somPop.play();
    }

    // ---- Descrição: janela de tamanho fixo, com scroll se o texto não couber ----
    // Antes o texto da descrição podia vazar pra fora do retângulo do
    // painel quando era muito longo. Agora ele fica preso dentro de uma
    // "janela" de altura fixa (DESC_ALTURA, calculada pra sempre caber
    // até perto da borda inferior do painel) e, se o texto for mais alto
    // que essa janela, dá pra arrastar (dedo ou mouse) ou usar a rodinha
    // do mouse pra rolar, com uma barrinha indicando a posição.
    const DESC_LARGURA = 720;
    // Reserva espaço embaixo da descrição pro botão de ativar habilidade,
    // quando ele vai aparecer (ver podeMostrarBotaoHabilidade acima).
    const ALTURA_BOTAO_HABILIDADE = 130;
    const DESC_ALTURA =
      620 - descY - (podeMostrarBotaoHabilidade ? ALTURA_BOTAO_HABILIDADE : 0);

    let descTexto = this.add
      .text(0, 0, carta.descricaoCompleta(), {
        fontSize: "30px",
        color: "#dddddd",
        align: "center",
        wordWrap: { width: DESC_LARGURA },
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0);

    // Container "viewport": tudo relacionado à descrição vive aqui, em
    // coordenadas locais próprias (0,0 = topo-centro da janela reservada).
    let containerDescricao = this.add.container(0, descY, [descTexto]);

    // Máscara geométrica que recorta o texto pra não vazar da janela.
    // IMPORTANTE: o retângulo é desenhado em coordenadas de MUNDO, não
    // como filho do container — uma Graphics usada como máscara
    // geométrica dentro de containers aninhados (o painel inteiro já é
    // um container, e containerDescricao é outro dentro dele) nem
    // sempre respeita corretamente a posição herdada dos containers
    // pais, e era isso que fazia o texto vazar por baixo do painel
    // quando a descrição era longa (ex: CryptoAcionistas, com o texto
    // do efeito de turno somado ao flavor text). Como o painel sempre
    // fica centralizado em GW/2, GH/2, dá pra calcular exatamente onde
    // a janela da descrição cai em mundo, sem depender da cadeia de
    // containers.
    let mascaraDescGraphics = this.add.graphics();
    mascaraDescGraphics.fillStyle(0xffffff);
    mascaraDescGraphics.fillRect(
      GW / 2 - DESC_LARGURA / 2 - 20,
      GH / 2 + descY,
      DESC_LARGURA + 40,
      DESC_ALTURA,
    );
    mascaraDescGraphics.setVisible(false);
    descTexto.setMask(mascaraDescGraphics.createGeometryMask());
    // Guardado à parte (não é mais filho do painel) só pra poder
    // destruir explicitamente em fecharDetalheCarta().
    this.mascaraDetalheAtual = mascaraDescGraphics;

    const alturaExcedente = descTexto.height - DESC_ALTURA;
    if (alturaExcedente > 0) {
      // Área invisível cobrindo a janela inteira, só pra capturar o
      // arraste (funciona tanto no toque quanto no mouse). Fica por cima
      // do texto, então também impede o clique de "vazar" pro overlay.
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

      // Trilho + indicador, só aparecem quando dá pra rolar de verdade.
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
        (DESC_ALTURA / descTexto.height) * DESC_ALTURA,
      );
      let indicador = this.add
        .rectangle(DESC_LARGURA / 2 + 22, 0, 6, alturaIndicador, 0xffffff, 0.6)
        .setOrigin(0.5, 0);
      containerDescricao.add([trilho, indicador]);

      this.habilitarScrollDescricao(
        areaArraste,
        descTexto,
        alturaExcedente,
        DESC_ALTURA,
        indicador,
      );
    }

    let fecharBg = this.add
      .circle(360, -615, 42, 0x2a2a2a)
      .setStrokeStyle(3, 0xffffff);
    let fecharTexto = this.add
      .text(360, -615, "✕", { fontSize: "48px", color: "#ffffff" })
      .setOrigin(0.5);
    let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
    fecharBtn.setSize(84, 84);
    fecharBtn.setInteractive({ useHandCursor: true });
    fecharBtn.on("pointerup", () => this.fecharDetalheCarta());

    filhosPainel.push(containerDescricao, fecharBtn);

    // ---- Botão "Ativar Habilidade" ----
    // Só aparece pra cartas com habilidade ativa que estejam no campo do
    // jogador (ver podeMostrarBotaoHabilidade, no topo da função). Fica
    // cinza e travado se a habilidade já foi usada neste turno.
    if (podeMostrarBotaoHabilidade) {
      const botaoY = descY + DESC_ALTURA + ALTURA_BOTAO_HABILIDADE / 2 + 10;
      const corBotao = habilidadeJaUsada ? 0x333333 : 0xff5500;
      const corBorda = habilidadeJaUsada ? 0x666666 : 0xffffff;
      const textoBotao = habilidadeJaUsada
        ? "Habilidade já usada"
        : "⚡ Ativar Habilidade";

      let habBg = this.add
        .rectangle(0, botaoY, 660, 96, corBotao)
        .setStrokeStyle(4, corBorda);
      let habTexto = this.add
        .text(0, botaoY, textoBotao, {
          fontSize: "36px",
          color: habilidadeJaUsada ? "#999999" : "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      filhosPainel.push(habBg, habTexto);

      if (!habilidadeJaUsada) {
        habBg.setInteractive({ useHandCursor: true });
        habBg.on("pointerover", () => {
          this.tweens.add({
            targets: [habBg, habTexto],
            scale: 1.03,
            duration: 100,
          });
        });
        habBg.on("pointerout", () => {
          this.tweens.add({
            targets: [habBg, habTexto],
            scale: 1,
            duration: 100,
          });
        });
        habBg.on("pointerup", () => {
          this.fecharDetalheCarta();
          this.time.delayedCall(180, () =>
            this.iniciarAtivacaoHabilidade(carta),
          );
        });
      }
    }

    let painel = this.add.container(GW / 2, GH / 2, filhosPainel);
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
  }

  // Liga o "arrastar pra rolar" numa área de descrição, para quando o
  // texto é mais alto que a janela reservada pra ele (ver bloco de
  // descrição em mostrarDetalheCarta). Funciona com o dedo, arrastando
  // com o mouse, ou com a rodinha do mouse — sempre limitando (clamp) o
  // quanto o texto pode subir/descer, pra nunca vazar da janela.
  habilitarScrollDescricao(
    areaArraste,
    descTexto,
    alturaExcedente,
    alturaJanela,
    indicador,
  ) {
    let arrastando = false;
    let ultimoY = 0;

    const aplicarScroll = (novoY) => {
      descTexto.y = Phaser.Math.Clamp(novoY, -alturaExcedente, 0);
      if (indicador) {
        const proporcao = -descTexto.y / alturaExcedente;
        indicador.y = proporcao * (alturaJanela - indicador.height);
      }
    };

    areaArraste.on("pointerdown", (pointer) => {
      arrastando = true;
      ultimoY = pointer.y;
    });

    const handlerMove = (pointer) => {
      if (!arrastando) return;
      const delta = pointer.y - ultimoY;
      ultimoY = pointer.y;
      aplicarScroll(descTexto.y + delta);
    };
    const handlerUp = () => {
      arrastando = false;
    };
    const handlerWheel = (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.modalAberto) return;
      const bounds = areaArraste.getBounds();
      if (!bounds.contains(pointer.x, pointer.y)) return;
      aplicarScroll(descTexto.y - deltaY * 0.5);
    };

    this.input.on("pointermove", handlerMove);
    this.input.on("pointerup", handlerUp);
    this.input.on("pointerupoutside", handlerUp);
    this.input.on("wheel", handlerWheel);

    // Guardado pra poder desligar (this.input.off) quando o modal fechar
    // — ver fecharDetalheCarta() e o reset em desenharInterface().
    this.handlersScrollDescAtual = { handlerMove, handlerUp, handlerWheel };
  }

  // ---------- JANELA DE ZOOM DA ARTE (abre ao passar o mouse na arte) ----------
  //
  // Mostra a arte completa da carta, sem recorte, ampliada e centralizada
  // na tela — por cima do painel de detalhe, porém menor que ele. É aqui
  // (e só aqui) que mora o efeito de "inclinar" a carta conforme o mouse;
  // a miniatura recortada em mostrarDetalheCarta() fica estática.
  abrirZoomCarta(carta) {
    if (!carta.imagem || this.zoomAberto) return;
    if (this.time.now < this.zoomBloqueadoAte) return;
    this.zoomAberto = true;

    // Overlay próprio: clicar fora da janela de zoom fecha só ela (não o
    // painel de detalhe por baixo, que continua aberto normalmente).
    let overlayZoom = this.add.rectangle(
      GW / 2,
      GH / 2,
      GW,
      GH,
      0x000000,
      0.35,
    );
    overlayZoom.setDepth(4500);
    overlayZoom.setInteractive();
    overlayZoom.on("pointerup", () => this.fecharZoomCarta());

    // Janela de zoom sempre menor que o painel de detalhe (840x1320).
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

    let painelZoomBg = this.add
      .rectangle(0, 0, largImg + PADDING, altImg + PADDING, 0x14141c)
      .setStrokeStyle(8, 0xffffff);
    // Impede que o toque na própria arte "vaze" pro overlay e feche a janela
    painelZoomBg.setInteractive();
    painelZoomBg.on("pointerup", () => {});

    // Brilho que se desloca conforme o mouse, simulando reflexo de luz
    // na superfície da carta (parte do efeito de "inclinar").
    let brilhoZoom = this.add
      .rectangle(0, 0, largImg, altImg, 0xffffff, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);

    let containerZoom = this.add.container(GW / 2, GH / 2, [
      painelZoomBg,
      imagemZoom,
      brilhoZoom,
    ]);
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

    // ---------- EFEITO DE "INCLINAR" A CARTA CONFORME O MOUSE ----------
    // Mesma lógica que existia na miniatura, só que agora só roda enquanto
    // a janela de zoom estiver aberta.
    const centroZoomX = GW / 2;
    const centroZoomY = GH / 2;
    const metadeLarguraZoom = largImg / 2;
    const metadeAlturaZoom = altImg / 2;
    const inclinacaoMaxGraus = 7;

    const handlerTiltZoom = (pointer) => {
      if (!this.zoomAberto || !containerZoom.active) return;

      const dx = Phaser.Math.Clamp(
        (pointer.x - centroZoomX) / metadeLarguraZoom,
        -1,
        1,
      );
      const dy = Phaser.Math.Clamp(
        (pointer.y - centroZoomY) / metadeAlturaZoom,
        -1,
        1,
      );

      containerZoom.rotation = dx * Phaser.Math.DegToRad(inclinacaoMaxGraus);
      containerZoom.y = GH / 2 + dy * 14;
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

    // Bloqueia reabertura por 2s — evita reabrir na hora se o
    // dedo/mouse ainda estiver em cima da arte logo depois de fechar.
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

  fecharDetalheCarta() {
    if (!this.modalAberto) return;

    // Se a janela de zoom ainda estiver aberta (não deveria, já que ela
    // fica por cima e captura o clique primeiro — mas por segurança),
    // fecha ela junto pra não sobrar objeto órfão na cena.
    if (this.zoomAberto) {
      if (this.handlerTiltZoomAtual) {
        this.input.off("pointermove", this.handlerTiltZoomAtual);
        this.handlerTiltZoomAtual = null;
      }
      if (this.painelZoomAtual) this.painelZoomAtual.destroy();
      if (this.overlayZoomAtual) this.overlayZoomAtual.destroy();
      this.painelZoomAtual = null;
      this.overlayZoomAtual = null;
      this.zoomAberto = false;
    }

    if (this.handlersScrollDescAtual) {
      this.input.off("pointermove", this.handlersScrollDescAtual.handlerMove);
      this.input.off("pointerup", this.handlersScrollDescAtual.handlerUp);
      this.input.off(
        "pointerupoutside",
        this.handlersScrollDescAtual.handlerUp,
      );
      this.input.off("wheel", this.handlersScrollDescAtual.handlerWheel);
      this.handlersScrollDescAtual = null;
    }

    this.tweens.add({
      targets: this.painelDetalheAtual,
      scale: 0.8,
      alpha: 0,
      duration: 150,
      ease: "Sine.easeIn",
      onComplete: () => {
        if (this.painelDetalheAtual) this.painelDetalheAtual.destroy();
        if (this.overlayDetalheAtual) this.overlayDetalheAtual.destroy();
        if (this.mascaraDetalheAtual) this.mascaraDetalheAtual.destroy();
        this.painelDetalheAtual = null;
        this.overlayDetalheAtual = null;
        this.mascaraDetalheAtual = null;
        this.modalAberto = false;
        this.travado = false;
        this.somJogarCarta.play();
      },
    });
  }

  // ---------- HABILIDADE ATIVA (ex: Atirador de Elite) ----------

  // Chamada pelo botão "Ativar Habilidade" do modal de detalhe. Descobre
  // quais alvos a habilidade alcançaria agora e decide se dá pra disparar
  // direto (atinge todos, ou só existe 0/1 alvo possível) ou se precisa
  // abrir o modo de seleção de alvo (ver iniciarSelecaoDeAlvo).
  iniciarAtivacaoHabilidade(carta) {
    if (this.partida.partidaEncerrada) return;

    const dono = this.partida.jogador;
    const oponente = this.partida.inimigo;
    const alvos = this.partida.alvosParaHabilidadeEmCampo(
      carta,
      dono,
      oponente,
    );
    const atingeTodos = !!(carta.efeito && carta.efeito.atingeTodos);
    // Machine Learning (Estagiário): habilidade ativa cujo alvo é uma
    // carta ALIADA em campo, não uma inimiga — usa um modo de mira
    // diferente (iniciarSelecaoDeAliadoParaHabilidade, abaixo), que
    // destaca o campo do próprio jogador em vez do campo inimigo.
    const ehBuffAliado =
      carta.efeito && carta.efeito.tipo === TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO;

    this.travado = true;
    this.esconderRodaBotoes();

    // "Atinge todos" não precisa de escolha (acerta o range inteiro de
    // uma vez). Sem nenhum alvo em alcance também não há o que escolher.
    if (atingeTodos) {
      this.executarHabilidade(carta, null);
      return;
    }
    if (alvos.length === 0) {
      this.avisarSemAlvo();
      return;
    }

    // Mesmo com um único alvo possível, o jogador escolhe ativamente
    // tocando nele — assim ele sempre confirma a ação, em vez do jogo
    // disparar sozinho.
    if (ehBuffAliado) {
      this.iniciarSelecaoDeAliadoParaHabilidade(carta, alvos);
    } else {
      this.iniciarSelecaoDeAlvo(carta, alvos);
    }
  }

  // Mostra um avisinho rápido de "nenhum alvo em alcance" quando o
  // jogador tenta ativar uma habilidade sem ter nenhum inimigo dentro do
  // range dela, e destrava a interação sem gastar o turno da habilidade.
  avisarSemAlvo() {
    let texto = this.add
      .text(GW / 2, 140, "Nenhum alvo em alcance", {
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

  // Modo de mira: destaca (com um anel pulsante amarelo) cada slot inimigo
  // dentro do alcance da habilidade e espera o jogador tocar num deles.
  // Tocar fora dos alvos destacados cancela a ativação sem gastar o turno
  // da habilidade.
  iniciarSelecaoDeAlvo(carta, alvos) {
    const L = this.layout;
    const objetos = [];

    // Fundo escurecido (bem sutil) só pra dar contraste ao texto e aos
    // anéis, sem esconder o campo por trás — o jogador precisa continuar
    // vendo as cartas pra escolher o alvo.
    let overlay = this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.35)
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.add
      .text(GW / 2, 140, "Escolha um alvo para atacar", {
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
      .text(GW / 2, 195, "(toque fora para cancelar)", {
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
      zonaToque.on("pointerup", () => this.executarHabilidade(carta, indice));

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

  // Modo de mira da habilidade ativa "Machine Learning" (Estagiário de ML):
  // igual em espírito a iniciarSelecaoDeAlvo() (ataque), mas destaca as
  // cartas ALIADAS em campo (anel verde, mesma cor de
  // iniciarSelecaoDeAliadoParaBuff) em vez das inimigas, já que aqui o
  // alvo é quem vai RECEBER o +poder. Tocar fora dos alvos cancela a
  // ativação sem gastar o turno da habilidade (diferente da Venda Casada,
  // que é resolvida na hora de invocar e por isso não tem cancelamento).
  iniciarSelecaoDeAliadoParaHabilidade(carta, alvos) {
    const L = this.layout;
    const objetos = [];

    let overlay = this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.35)
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () => this.cancelarSelecaoDeAlvo());
    objetos.push(overlay);

    let textoInstr = this.add
      .text(GW / 2, 140, "Escolha uma aliada para fortalecer", {
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
      .text(GW / 2, 195, "(toque fora para cancelar)", {
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

  // Resolve de fato a ativação (via Partida.ativarHabilidade) e anima as
  // cartas inimigas afetadas, reaproveitando animarCartasAfetadas — o
  // mesmo efeito visual usado pelos buffs/debuffs de invocação.
  executarHabilidade(carta, alvoEscolhido) {
    if (this.objetosSelecaoAlvo) {
      this.objetosSelecaoAlvo.forEach((o) => o.destroy());
      this.objetosSelecaoAlvo = null;
    }

    const resultado = this.partida.ativarHabilidade(
      carta,
      this.partida.jogador,
      this.partida.inimigo,
      alvoEscolhido,
    );

    if (resultado.sucesso) {
      this.processarCartasAfetadas(resultado.afetadas, () => {
        this.travado = false;
        this.desenharInterface();
      });
    } else {
      this.travado = false;
      this.desenharRodaBotoes();
    }
  }

  // Modo de mira "Venda Casada": igual em espírito a iniciarSelecaoDeAlvo(),
  // mas em vez de mirar no campo inimigo pra atacar, destaca (anel pulsante
  // verde) cada carta ALIADA em campo — incluindo o CyberVendedor recém
  // colocado — pra o jogador escolher quem ganha o +poder. A carta já está
  // em campo nesse momento (colocarCartaDoJogador já rodou), então não tem
  // "cancelar": tocar fora simplesmente confirma o alvo padrão (a própria
  // carta recém-jogada), pra garantir que o efeito sempre seja resolvido.
  iniciarSelecaoDeAliadoParaBuff(carta, posicaoPropria) {
    const L = this.layout;
    const objetos = [];

    const indicesAliados = this.partida.jogador.campo.cartas
      .map((c, i) => (c ? i : null))
      .filter((i) => i !== null);

    this.travado = true;

    let overlay = this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.35)
      .setDepth(3700)
      .setInteractive();
    overlay.on("pointerup", () =>
      this.confirmarEscolhaBuffAliado(carta, posicaoPropria, posicaoPropria),
    );
    objetos.push(overlay);

    let textoInstr = this.add
      .text(GW / 2, 140, "Escolha uma aliada para fortalecer", {
        fontSize: "40px",
        color: "#88ff99",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
      })
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

  // Resolve de fato o efeito (via Partida.aplicarEfeitoInvocacao) e anima a
  // carta aliada escolhida, reaproveitando processarCartasAfetadas — mesmo
  // efeito visual usado pelos outros buffs/debuffs de invocação.
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

  // ---------- STATUS / UI ----------

  // Turno + placar melhor-de-7. Normalmente fica compacto no canto
  // superior esquerdo; quando a mão está escondida (this.maoEscondida),
  // não faz sentido deixá-los ali "perdidos" embaixo do campo ampliado —
  // então eles migram pro centro horizontal, na faixa onde a mão ficaria
  // (Y_MAO_JOGADOR), maiores e mais fáceis de ler.
  desenharStatus() {
    const centralizado = this.maoEscondida;
    const x = centralizado ? GW / 2 : 45;
    const yTurno = centralizado ? Y_MAO_JOGADOR - 30 : 1590;
    const yPlacar = centralizado ? Y_MAO_JOGADOR + 30 : 1645;
    const origin = centralizado ? 0.5 : 0;

    this.add
      .text(
        x,
        yTurno,
        `Turno: ${this.partida.turno}/${this.partida.maxTurnos}`,
        {
          fontSize: centralizado ? "52px" : "45px",
          color: "#ffffff",
        },
      )
      .setOrigin(origin, 0.5);

    this.add
      .text(
        x,
        yPlacar,
        `🏆 ${this.partida.rodadasJogador} — ${this.partida.rodadasInimigo}`,
        {
          fontSize: centralizado ? "40px" : "34px",
          color: "#ffd966",
          fontStyle: "bold",
        },
      )
      .setOrigin(origin, 0.5);
  }

  // Dois ícones de "poder total" (soma do poder de todas as cartas em
  // campo), um pro oponente (topo, lado direito) e um pro jogador
  // (embaixo, lado direito). O tamanho de cada ícone é relativo ao do
  // outro: quem tem mais poder no campo fica com o ícone maior, quem tem
  // menos fica com o ícone menor — dá pra ver de relance quem tá na
  // frente sem precisar somar nada na mão.
  desenharIndicadoresPoder() {
    const L = this.layout;
    const poderJogador = this.partida.calcularPoderTotal(
      this.partida.jogador.campo,
    );
    const poderInimigo = this.partida.calcularPoderTotal(
      this.partida.inimigo.campo,
    );

    const TAM_MIN = 46;
    const TAM_MAX = 116;
    const total = poderJogador + poderInimigo;
    let tamJogador = 80;
    let tamInimigo = 80;
    if (total > 0) {
      tamJogador = Phaser.Math.Linear(TAM_MIN, TAM_MAX, poderJogador / total);
      tamInimigo = Phaser.Math.Linear(TAM_MIN, TAM_MAX, poderInimigo / total);
    }

    // Lado do oponente: no canto superior ESQUERDO, acima do campo dele.
    // (Ficava à direita, mas esse canto agora é ocupado pela roda de
    // botões — ver desenharRodaBotoes().)
    this.criarIndicadorPoder(90, 210, poderInimigo, tamInimigo, "#ff6666");

    // Lado do jogador: perto de você, também na direita, entre o campo e
    // a mão (ou perto do rodapé, se a mão estiver escondida).
    const yJogadorIcone = L.yJogadorTras + L.slotH / 2 + 100;
    this.criarIndicadorPoder(
      GW - 90,
      yJogadorIcone,
      poderJogador,
      tamJogador,
      "#66ff88",
    );
  }

  // Ícone individual: um selo com "⚔" (representando o poder somado) e o
  // número embaixo, entrando com fade + pop.
  criarIndicadorPoder(x, y, valor, tamanho, cor) {
    let fundo = this.add
      .circle(0, 0, tamanho / 2, 0xffffff, 0.55)
      .setStrokeStyle(4, cor);
    let icone = this.add
      .text(0, -6, "⚔", {
        fontSize: `${Math.round(tamanho * 0.6)}px`,
      })
      .setOrigin(0.5);
    let numero = this.add
      .text(0, tamanho / 2 + 24, `${valor}`, {
        fontSize: "30px",
        color: cor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let container = this.add.container(x, y, [fundo, icone, numero]);
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 320,
      ease: "Back.Out",
    });
  }

  // ---------- MENU DE BOTÕES (Histórico / Passar Turno / Desistir) ----------
  //
  // Só o botão de menu (☰), um círculo fixo no canto direito da tela,
  // fica sempre visível (dentro de this.rodaBotoesContainer). As 3 opções
  // (Histórico / Passar Turno / Desistir) ficam escondidas até esse botão
  // ser tocado — aí elas aparecem centralizadas na tela, por cima de um
  // fundo escurecido (this.rodaOpcoesContainer) — ver abrirOpcoesDaRoda()/
  // fecharOpcoesDaRoda(). Tocar em qualquer lugar fora dos botões (ou
  // seja, no fundo escurecido) fecha o menu de novo.
  //
  // O botão de menu inteiro some (deslizando rápido pra fora, ver
  // esconderRodaBotoes()) sempre que um efeito está sendo executado ou é a
  // vez do oponente ser resolvida (Passar Turno), e volta a aparecer
  // quando o controle volta pro jogador — nesse caso, via
  // desenharInterface() chamando esta função de novo (gate em
  // `if (!this.travado)`, lá em desenharInterface()).
  //
  // IMPORTANTE: em alguns fluxos (ex: nenhum alvo em alcance pra
  // habilidade, cancelar seleção de alvo, desistir cancelado) a interação
  // é destravada SEM que desenharInterface() seja chamado de novo — nesses
  // pontos, chamamos desenharRodaBotoes() diretamente pra trazer o botão
  // de volta, já que ninguém mais vai fazer isso.
  desenharRodaBotoes() {
    const RAIO = 46;
    const X = GW - RAIO - 30;
    const Y = 90;

    let bg = this.add
      .circle(0, 0, RAIO, 0x222222, 0.92)
      .setStrokeStyle(4, 0xffffff);
    let icone = this.add
      .text(0, 0, "☰", { fontSize: "40px", color: "#ffffff" })
      .setOrigin(0.5);

    let botaoMenu = this.add.container(0, 0, [bg, icone]);
    botaoMenu.setSize(RAIO * 2, RAIO * 2);
    botaoMenu.setInteractive({ useHandCursor: true });

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

    const roda = this.add.container(X, Y, [botaoMenu]);
    roda.setDepth(200);
    this.rodaBotoesContainer = roda;
  }

  // Abre ou fecha as 3 opções, dependendo do estado atual.
  alternarOpcoesDaRoda() {
    if (this.rodaOpcoesContainer) {
      this.fecharOpcoesDaRoda();
    } else {
      this.abrirOpcoesDaRoda();
    }
  }

  // Revela as 3 opções (Histórico / Passar Turno / Desistir), centralizadas
  // na tela, por cima de um fundo escurecido que cobre a tela toda. Tocar
  // em qualquer lugar fora dos botões (ou seja, no fundo escurecido) fecha
  // o menu de novo.
  abrirOpcoesDaRoda() {
    if (this.rodaOpcoesContainer) return;

    const LARGURA = 340;
    const ALTURA = 96;
    const ESPACO = 116;

    const definicoes = [
      {
        rotulo: "📜 Histórico",
        cor: 0x2255aa,
        aoClicar: () => this.mostrarHistorico(),
      },
      {
        rotulo: "⏭ Passar Turno",
        cor: 0xff5500,
        aoClicar: () => this.aoClicarPassarTurno(),
      },
      {
        rotulo: "🏳 Desistir",
        cor: 0x883333,
        aoClicar: () => this.aoClicarDesistir(),
      },
    ];

    // Fundo escurecido cobrindo a tela toda — tocar nele fecha o menu.
    // Vem primeiro na lista de filhos (mais embaixo, atrás dos botões),
    // então um toque num botão nunca "vaza" pra ele.
    const overlay = this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.6)
      .setInteractive();
    overlay.on("pointerup", () => this.fecharOpcoesDaRoda());

    const totalAltura = ESPACO * (definicoes.length - 1);
    const yInicio = GH / 2 - totalAltura / 2;

    const botoes = definicoes.map((def, indice) =>
      this.criarBotaoDaRoda(
        GW / 2,
        yInicio + indice * ESPACO,
        LARGURA,
        ALTURA,
        def.rotulo,
        def.cor,
        () => {
          // Fecha o menu antes de disparar a ação escolhida, pra não
          // deixar o fundo escurecido por cima de um modal/transição.
          this.fecharOpcoesDaRoda();
          def.aoClicar();
        },
      ),
    );

    const opcoes = this.add.container(0, 0, [overlay, ...botoes]);
    opcoes.setDepth(250);
    opcoes.setAlpha(0);
    opcoes.setScale(0.9);
    this.rodaOpcoesContainer = opcoes;

    this.tweens.add({
      targets: opcoes,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.Out",
    });
  }

  // Esconde de novo as 3 opções e o fundo escurecido (mas mantém o botão
  // de menu visível no canto).
  fecharOpcoesDaRoda() {
    if (!this.rodaOpcoesContainer) return;
    const opcoes = this.rodaOpcoesContainer;
    this.rodaOpcoesContainer = null;

    this.tweens.add({
      targets: opcoes,
      alpha: 0,
      scale: 0.9,
      duration: 120,
      ease: "Cubic.In",
      onComplete: () => opcoes.destroy(),
    });
  }

  // Cria um botão individual (fundo + texto + hover/click) já posicionado
  // dentro do menu de opções. `x`/`y` são relativos ao container pai.
  criarBotaoDaRoda(x, y, largura, altura, rotulo, cor, aoClicar) {
    let bg = this.add
      .rectangle(0, 0, largura, altura, cor)
      .setStrokeStyle(4, 0xffffff);
    let texto = this.add
      .text(0, 0, rotulo, { fontSize: "27px", color: "#ffffff" })
      .setOrigin(0.5);

    let btn = this.add.container(x, y, [bg, texto]);
    btn.setSize(largura, altura);
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
      aoClicar();
    });

    return btn;
  }

  // Sumiço rápido: desliza o botão de menu pra fora da tela, pela direita,
  // e destrói ao final; se as 3 opções estiverem abertas na hora (menu +
  // fundo escurecido), elas são destruídas na hora, sem animação. Não-
  // destrutivo se o botão já não existir (ex: desenharInterface() já o
  // destruiu via removeAll(true)) — checa e sai.
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

  // Handler do botão "Passar Turno": trava a interação, tira a roda de
  // cena (a "vez do oponente" começa aqui) e só então resolve o turno —
  // fim de turno do jogador, jogada da IA, efeitos de turno e, se for o
  // último turno, o combate final.
  aoClicarPassarTurno() {
    this.travado = true;
    this.esconderRodaBotoes();

    const { resultadoCombate, fimDeJogo, resultadoRodada } =
      this.partida.fimTurno();
    const efeitoInimigo = this.partida.efeitoInimigoTurno;
    const efeitosDeTurno = this.partida.efeitosDeTurno;

    const finalizarTurno = () => {
      const todasAfetadas = [
        ...(efeitoInimigo ? efeitoInimigo.afetadas : []),
        ...(efeitosDeTurno || []),
      ];
      this.processarCartasAfetadas(todasAfetadas, () => {
        // Redesenha o campo AGORA — é isso que faz a jogada da IA (a
        // carta de monstro/efeito que ela acabou de colocar em campo)
        // aparecer na tela. Precisa acontecer ANTES do banner de rodada:
        // do contrário o jogador só vê a jogada do inimigo depois de ver
        // o resultado da rodada, o que fica com a ordem trocada.
        // Como this.travado ainda está true aqui, desenharRodaBotoes()
        // não roda junto (de propósito — ver prosseguir() abaixo, que
        // traz o botão de volta manualmente quando destrava).
        this.desenharInterface();

        const prosseguir = () => {
          // A roda só volta se a partida continua — em fim de jogo,
          // this.travado permanece true de propósito (ver
          // mostrarTelaFimDeJogo), então não faz sentido redesenhá-la.
          if (!fimDeJogo) {
            this.travado = false;
            // desenharInterface() (logo acima) rodou com this.travado
            // ainda true, então o botão de menu não foi recriado junto —
            // precisa trazer ele de volta manualmente agora que a vez
            // volta pro jogador (mesmo padrão descrito no comentário de
            // desenharRodaBotoes()).
            this.desenharRodaBotoes();
          }

          if (fimDeJogo) {
            this.mostrarTelaFimDeJogo(resultadoCombate);
          }
        };

        // Mostra rapidinho quem ganhou a rodada (turno) que acabou de
        // fechar — só quando a partida ainda continua; se já era a
        // decisiva, a tela de fim de jogo (mostrarTelaFimDeJogo) já cobre
        // esse resultado, então não precisa duplicar. Espera um pouco
        // antes de mostrar o banner, pra dar tempo do jogador ver a
        // jogada do inimigo (carta/efeito que acabou de entrar em campo)
        // antes do resultado da rodada tomar a tela.
        const PAUSA_ANTES_DO_BANNER = 300;
        this.time.delayedCall(PAUSA_ANTES_DO_BANNER, () => {
          if (!fimDeJogo && resultadoRodada) {
            this.mostrarBannerRodada(resultadoRodada, prosseguir);
          } else {
            prosseguir();
          }
        });
      });
    };

    if (efeitoInimigo) {
      this.conjurarCartaDeEfeitoInimigo(efeitoInimigo.carta, finalizarTurno);
    } else {
      finalizarTurno();
    }
  }

  // Banner central rápido (aparece e some sozinho) avisando quem venceu a
  // rodada que acabou de fechar — VOCÊ VENCEU / VOCÊ PERDEU / EMPATE.
  // Chama `aoTerminar` depois que ele já sumiu, pra encadear o resto do
  // fluxo (ex: liberar a interação de novo).
  mostrarBannerRodada(resultadoRodada, aoTerminar) {
    const config = {
      jogador: { texto: "VOCÊ VENCEU A RODADA", cor: "#66ff88" },
      inimigo: { texto: "VOCÊ PERDEU A RODADA", cor: "#ff6666" },
      empate: { texto: "RODADA EMPATADA", cor: "#ffd966" },
    }[resultadoRodada.vencedor];

    const texto = this.add
      .text(GW / 2, GH / 2, config.texto, {
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

  // Handler do botão "Desistir": pede confirmação (ação irreversível)
  // antes de encerrar a partida como derrota do jogador.
  aoClicarDesistir() {
    if (this.partida.partidaEncerrada || this.modalAberto) return;

    this.modalAberto = true;
    this.travado = true;
    this.esconderRodaBotoes();

    let overlay = this.add
      .rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.75)
      .setDepth(4000)
      .setInteractive();

    let titulo = this.add
      .text(GW / 2, GH / 2 - 140, "Desistir da partida?", {
        fontSize: "44px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(4001);

    let subtitulo = this.add
      .text(GW / 2, GH / 2 - 70, "Você perde a partida imediatamente.", {
        fontSize: "28px",
        color: "#dddddd",
      })
      .setOrigin(0.5)
      .setDepth(4001);

    const fechar = () => {
      overlay.destroy();
      titulo.destroy();
      subtitulo.destroy();
      btnConfirmar.destroy();
      btnCancelar.destroy();
    };

    let btnConfirmar = this.criarBotaoConfirmacao(
      GW / 2 - 170,
      GH / 2 + 60,
      "Desistir",
      0x883333,
      () => {
        fechar();
        this.modalAberto = false;
        const resultado = this.partida.desistir();
        this.mostrarTelaFimDeJogo(resultado);
      },
    );

    let btnCancelar = this.criarBotaoConfirmacao(
      GW / 2 + 170,
      GH / 2 + 60,
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

  // Botão simples (fundo + texto + clique) usado pelo diálogo de
  // confirmação de "Desistir". Posição em coordenadas absolutas de tela
  // (não é relativo a nenhum container pai).
  criarBotaoConfirmacao(x, y, rotulo, cor, aoClicar) {
    let bg = this.add.rectangle(0, 0, 300, 90, cor).setStrokeStyle(4, 0xffffff);
    let texto = this.add
      .text(0, 0, rotulo, { fontSize: "30px", color: "#ffffff" })
      .setOrigin(0.5);

    let btn = this.add.container(x, y, [bg, texto]);
    btn.setSize(300, 90);
    btn.setDepth(4001);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", aoClicar);

    return btn;
  }

  // Botão flutuante, sempre no rodapé, para esconder/mostrar a mão e dar
  // mais espaço/destaque ao campo. Some/reaparece com uma animação da
  // própria mão, não só um corte seco.
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

    let btn = this.add.container(GW / 2, GH - 50, [bg, texto]);
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

  // Alterna a visibilidade da mão. Ao esconder, as cartas na tela deslizam
  // para baixo e somem antes do campo ser redesenhado (maior); ao mostrar
  // de novo, a própria entrada animada do leque já cuida da transição.
  alternarMao() {
    // ============================================================
    // MOSTRAR A MÃO NOVAMENTE
    // ============================================================

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

    // ============================================================
    // ESCONDER A MÃO
    //
    // As cartas deslizam PARA BAIXO, saindo da tela.
    // Elas continuam visíveis durante a maior parte do movimento
    // e só começam a desaparecer perto do final.
    // ============================================================

    let finalizadas = 0;

    cartasNaTela.forEach((carta, indice) => {
      if (!carta || !carta.active) {
        finalizadas++;
        return;
      }

      // Garante que a carta fique por cima durante a animação.
      carta.setDepth(2000 + indice);

      // Pequena diferença entre as cartas para dar sensação
      // de que a mão inteira está deslizando para baixo.
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

  // Tela final da partida (chamada só uma vez, ao fechar o 7º turno):
  // fundo desfocado + camada verde/vermelha translúcida cobrindo a tela,
  // texto gigante "VOCÊ VENCEU"/"VOCÊ PERDEU" (verde ou vermelho, com
  // traçado branco) e, embaixo, a carta de maior poder (PA) do lado
  // vencedor. Não é mais destruída/redesenhada por desenharInterface(),
  // já que a partida acaba aqui — fica por cima de tudo até o jogador
  // recarregar a página.
  mostrarTelaFimDeJogo(resultadoCombate) {
    if (!resultadoCombate) return;

    const vitoria = resultadoCombate.resultado === "jogador";
    const derrota = resultadoCombate.resultado === "inimigo";

    const corFundo = vitoria ? 0x1fd67a : derrota ? 0xff3b3b : 0xbbbbbb;
    const corTexto = vitoria ? "#1fd67a" : derrota ? "#ff3b3b" : "#eeeeee";
    const textoPrincipal = vitoria
      ? "VOCÊ VENCEU"
      : derrota
        ? "VOCÊ PERDEU"
        : "EMPATE";

    this.cameras.main.flash(
      400,
      vitoria ? 0 : 255,
      vitoria ? 255 : derrota ? 59 : 200,
      vitoria ? 136 : derrota ? 59 : 200,
    );

    // Desfoca o campo de batalha por trás do overlay. postFX.addBlur só
    // existe em Phaser 3.60+ rodando em WebGL; se não estiver disponível
    // (ex: fallback Canvas), a tela de fim de jogo continua funcionando
    // normalmente, só sem o desfoque.
    if (this.cameras.main.postFX && this.cameras.main.postFX.addBlur) {
      this.cameras.main.postFX.addBlur(0, 2, 2, 0.15, 0xffffff, 6);
    }

    // Camada escura por baixo da cor, pra garantir contraste do texto
    // não importa o fundo do campo naquele momento.
    let escurecido = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.55);
    escurecido.setDepth(5000);

    // Camada colorida translúcida (verde na vitória, vermelha na derrota)
    let corCamada = this.add.rectangle(GW / 2, GH / 2, GW, GH, corFundo, 0.22);
    corCamada.setDepth(5001);

    const filhos = [];

    let textoGrande = this.add
      .text(0, -140, textoPrincipal, {
        fontSize: "126px",
        fontStyle: "bold",
        color: corTexto,
        stroke: "#ffffff",
        strokeThickness: 16,
        align: "center",
      })
      .setOrigin(0.5);
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
      let nomeCarta = this.add
        .text(0, -CH / 2 + 30, this.truncarTexto(cartaDestaque.nome, 16), {
          fontSize: "30px",
          color: "#ffffff",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: CW - 30 },
        })
        .setOrigin(0.5, 0);
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

    let subtitulo = this.add
      .text(
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
      )
      .setOrigin(0.5);
    filhos.push(subtitulo);

    // GH / 2 - 220: sobe o conjunto (texto + carta + subtítulo) em
    // relação ao centro da tela. Aumenta esse valor pra subir mais,
    // diminui (ou zera) pra centralizar de novo.
    let container = this.add.container(GW / 2, GH / 2 - 220, filhos);
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
    this.somBuff.play();
  }
  // ============================================================================
  // GESTO DE DESLIZAR A MÃO
  // ============================================================================
  //
  // MÃO VISÍVEL:
  //   swipe para baixo -> esconde
  //
  // MÃO ESCONDIDA:
  //   swipe para cima -> mostra
  //
  // Não existe botão.
  // O jogador literalmente puxa a mão com o dedo.
  // ============================================================================

  configurarGestosMao() {
    // ============================================================
    // GESTO DE SWIPE DA MÃO
    //
    // Mão visível:
    //   arrastar para baixo -> esconder
    //
    // Mão escondida:
    //   arrastar para cima -> mostrar
    //
    // Se o gesto não atingir o limite:
    //   volta para posição + alpha originais.
    // ============================================================

    if (this.gestosMaoConfigurados) return;

    this.gestosMaoConfigurados = true;

    this.gestoMaoAtivo = false;
    this.gestoMaoX = 0;
    this.gestoMaoY = 0;

    // --------------------------------------------------------------------------
    // COMEÇOU O TOQUE
    // --------------------------------------------------------------------------

    this.input.on("pointerdown", (pointer) => {
      if (this.travado) return;

      const LIMITE_MAO = GH - 650;

      // A mão escondida não está visível, então permitimos começar
      // o gesto na parte inferior da tela.
      //
      // A mão visível também pode ser agarrada diretamente em cima
      // de qualquer carta.
      if (!this.maoEscondida && pointer.y < LIMITE_MAO) {
        return;
      }

      if (this.maoEscondida && pointer.y < LIMITE_MAO) {
        return;
      }

      this.gestoMaoAtivo = true;

      this.gestoMaoX = pointer.x;
      this.gestoMaoY = pointer.y;

      // ============================================================
      // GUARDA A POSIÇÃO ORIGINAL DE TODAS AS CARTAS
      // ============================================================

      const cartas = this.children.list.filter((c) => c.dadosCarta);

      cartas.forEach((carta) => {
        if (!carta || !carta.active) return;

        carta._maoSwipeYOriginal = carta.y;
        carta._maoSwipeXOriginal = carta.x;
        carta._maoSwipeAlphaOriginal = carta.alpha;
      });
    });

    // --------------------------------------------------------------------------
    // MOVIMENTO DO DEDO
    // --------------------------------------------------------------------------

    this.input.on("pointermove", (pointer) => {
      if (!this.gestoMaoAtivo) return;
      if (this.travado) return;

      const deslocamentoY = pointer.y - this.gestoMaoY;

      const deslocamentoX = Math.abs(pointer.x - this.gestoMaoX);

      // Ignora movimentos predominantemente horizontais.
      if (deslocamentoX > Math.abs(deslocamentoY) * 1.5) {
        return;
      }

      // ============================================================
      // IMPORTANTE:
      //
      // O dedo NÃO move a mão durante o gesto.
      //
      // Assim:
      // 20px  -> nada muda
      // 50px  -> nada muda
      // 90px  -> nada muda
      // 100px -> dispara a animação
      //
      // Isso evita a mão ficar transparente ou deslocada
      // quando o jogador solta no meio.
      // ============================================================
    });

    // --------------------------------------------------------------------------
    // SOLTOU O DEDO
    // --------------------------------------------------------------------------

    const finalizarGesto = (pointer) => {
      if (!this.gestoMaoAtivo) return;

      this.gestoMaoAtivo = false;

      if (this.travado) return;

      const deslocamentoY = pointer.y - this.gestoMaoY;

      const LIMITE_GESTO = 45;

      // ============================================================
      // SWIPE PARA BAIXO COMPLETO
      // ============================================================

      if (!this.maoEscondida && deslocamentoY >= LIMITE_GESTO) {
        this.esconderMaoComSwipe();
        return;
      }

      // ============================================================
      // SWIPE PARA CIMA COMPLETO
      // ============================================================

      if (this.maoEscondida && deslocamentoY <= -LIMITE_GESTO) {
        this.mostrarMaoComSwipe();
        return;
      }

      // ============================================================
      // SWIPE CANCELADO
      //
      // Não atingiu o limite.
      //
      // Restaura:
      // - X
      // - Y
      // - alpha
      //
      // exatamente como estavam antes do gesto.
      // ============================================================

      this.voltarMaoParaPosicao();
    };

    this.input.on("pointerup", finalizarGesto);

    this.input.on("pointerupoutside", finalizarGesto);
  }

  // ============================================================================
  // RESTAURA A MÃO QUANDO O SWIPE NÃO FOI COMPLETO
  // ============================================================================

  voltarMaoParaPosicao() {
    const cartas = this.children.list.filter((c) => c.dadosCarta);

    cartas.forEach((carta) => {
      if (!carta || !carta.active) return;

      const yOriginal =
        carta._maoSwipeYOriginal !== undefined
          ? carta._maoSwipeYOriginal
          : carta.y;

      const xOriginal =
        carta._maoSwipeXOriginal !== undefined
          ? carta._maoSwipeXOriginal
          : carta.x;

      const alphaOriginal =
        carta._maoSwipeAlphaOriginal !== undefined
          ? carta._maoSwipeAlphaOriginal
          : 1;

      // Mata qualquer tween que possa ter ficado.
      this.tweens.killTweensOf(carta);

      this.tweens.add({
        targets: carta,

        x: xOriginal,

        y: yOriginal,

        alpha: alphaOriginal,

        duration: 180,

        ease: "Cubic.Out",

        onComplete: () => {
          if (!carta || !carta.active) return;

          // Garante o estado EXATO.
          carta.x = xOriginal;
          carta.y = yOriginal;
          carta.alpha = alphaOriginal;

          // Limpa os dados temporários.
          carta._maoSwipeYOriginal = undefined;

          carta._maoSwipeXOriginal = undefined;

          carta._maoSwipeAlphaOriginal = undefined;
        },
      });
    });
  }
  // ============================================================================
  // MOVE A MÃO JUNTO COM O DEDO
  // ============================================================================

  moverMaoDuranteGesto(deslocamentoY) {
    const cartas = this.children.list.filter((c) => c.dadosCarta);

    if (cartas.length === 0) return;

    // Limita o quanto pode puxar.
    const limite = 600;

    const deslocamento = Phaser.Math.Clamp(deslocamentoY, -limite, limite);

    cartas.forEach((carta) => {
      if (!carta || !carta.active) return;

      // Guarda posição original somente uma vez.
      if (carta._maoSwipeYOriginal === undefined) {
        carta._maoSwipeYOriginal = carta.y;
      }

      carta.y = carta._maoSwipeYOriginal + deslocamento;

      // Quando descendo, começa a desaparecer.
      // Quando subindo, reaparece.
      const progresso = Math.min(1, Math.abs(deslocamento) / 500);

      if (!this.maoEscondida) {
        carta.alpha = 1 - progresso * 0.9;
      } else {
        carta.alpha = progresso;
      }
    });
  }

  // ============================================================================
  // ESCONDE A MÃO
  // ============================================================================

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

        y: GH + 300,

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

  // ============================================================================
  // MOSTRA A MÃO
  // ============================================================================

  mostrarMaoComSwipe() {
    // ============================================================
    // MOSTRAR A MÃO COM SWIPE PARA CIMA
    // ============================================================

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

    // ============================================================
    // FAZ A MÃO ENTRAR DE BAIXO PARA CIMA
    // ============================================================

    cartas.forEach((carta, indice) => {
      if (!carta || !carta.active) return;

      // Guarda a posição final.
      const yFinal = carta.y;

      // Começa completamente abaixo da tela.
      carta.y = GH + 300;

      // Começa invisível.
      carta.alpha = 0;

      // Garante que a carta fique acima dos elementos do campo
      // durante a entrada.
      carta.setDepth(2000 + indice);

      this.tweens.add({
        targets: carta,

        // Sobe até a posição normal da mão.
        y: yFinal,

        // Aparece junto com o movimento.
        alpha: 1,

        duration: 300,

        // Pequeno atraso entre as cartas para dar sensação
        // de que a mão inteira está subindo.
        delay: indice * 18,

        ease: "Cubic.Out",

        onComplete: () => {
          // Garante que terminou completamente visível.
          carta.alpha = 1;
          carta.y = yFinal;
        },
      });
    });

    // ============================================================
    // LIBERA O JOGO DEPOIS DA ANIMAÇÃO
    // ============================================================

    this.time.delayedCall(340 + cartas.length * 18, () => {
      this.travado = false;
      this.desenharRodaBotoes();
    });
  }
}
