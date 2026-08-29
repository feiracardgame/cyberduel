// Montador de deck em uma cena Phaser independente. A cena usa zonas de
// toque absolutas e não sobrepostas: arte, botões +/- e modal nunca dividem
// a mesma hit area. Isso evita cliques atravessando cards ou submenus.
class CenaDeckBuilder extends Phaser.Scene {
  constructor() {
    super("CenaDeckBuilder");
  }

  create() {
    this.builder = window.cyberduelDeckBuilder;
    this.catalogo = this.builder.getCatalog();
    this.deck = this.builder.getDeckForMatch();
    this.filtro = "todos";
    this.ordemNivel = "crescente";
    this.pagina = 0;
    this.cartasPorPagina = 6;
    this.modalAberto = false;
    this.renderPendente = false;
    this.input.topOnly = true;
    this.events.once("shutdown", () => this.fecharModal?.());
    this.renderizarDeck();
  }

  // -------------------------------------------------------------------------
  // Estrutura visual comum
  // -------------------------------------------------------------------------
  limparCena() {
    this.fecharModal?.();
    this.tweens.killAll();
    this.children.removeAll(true);
    this.modalAberto = false;
  }

  agendarRender(nomeDoMetodo) {
    if (this.renderPendente) return;
    this.renderPendente = true;
    this.time.delayedCall(0, () => {
      this.renderPendente = false;
      if (this.scene.isActive() && !this.modalAberto) this[nomeDoMetodo]();
    });
  }

  desenharFundo(titulo, subtitulo, icone = "▦") {
    this.limparCena();
    this.cameras.main.setBackgroundColor("#030712");

    if (this.textures.exists("jogoFundo")) {
      this.add
        .image(GW / 2, GH / 2, "jogoFundo")
        .setDisplaySize(GW, GH)
        .setAlpha(0.14);
    }
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x020611, 0.76);

    // Malha técnica discreta para dar profundidade sem competir com as artes.
    for (let x = 0; x <= GW; x += 135)
      this.add.rectangle(x, GH / 2, 1, GH, 0x1c7899, 0.08);
    for (let y = 0; y <= GH; y += 135)
      this.add.rectangle(GW / 2, y, GW, 1, 0x1c7899, 0.08);

    // Barras e recortes dão à tela a mesma linguagem de HUD do jogo.
    this.add.rectangle(GW / 2, 106, GW - 30, 178, 0x061526, 0.98)
      .setStrokeStyle(4, 0x1acfff, 0.9);
    this.add.rectangle(GW / 2, 197, GW - 60, 4, 0x23dfff, 0.85);
    this.add.text(52, 72, icone, {
      fontSize: "54px",
      color: "#53e7ff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.add.text(118, 70, titulo, {
      fontSize: "56px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#00101c",
      strokeThickness: 8,
    }).setOrigin(0, 0.5);
    this.add.text(118, 132, subtitulo, {
      fontSize: "28px",
      color: "#8beaff",
    }).setOrigin(0, 0.5);

    this.add.circle(GW - 76, 72, 32, 0x0d2740, 1)
      .setStrokeStyle(3, 0x40dfff);
    this.add.text(GW - 76, 72, String(this.builder.total(this.deck)), {
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  desenharResumo(y = 242) {
    const total = this.builder.total(this.deck);
    const composition = this.builder.composition(this.deck);
    const valid = this.builder.isValid(this.deck);

    this.add.rectangle(GW / 2, y, GW - 54, 74, 0x07111f, 0.95)
      .setStrokeStyle(2, valid ? 0x35e795 : 0xff6f82, 0.8);
    this.add.text(50, y, `${total}/20`, {
      fontSize: "33px",
      color: valid ? "#66ffb1" : "#ff9aa8",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);

    const requisitos = [
      ["BAIXAS", composition.baixa, 6],
      ["MÉDIAS", composition.media, 4],
      ["ALTAS", composition.alta, 2],
    ];
    requisitos.forEach(([label, current, minimum], index) => {
      const ok = current >= minimum;
      const x = 322 + index * 235;
      this.add.rectangle(x, y, 215, 48, ok ? 0x123a2a : 0x3b1821, 1)
        .setStrokeStyle(2, ok ? 0x46ef9a : 0xff7184);
      this.add.text(x, y, `${label} ${current}/${minimum}`, {
        fontSize: "27px",
        color: ok ? "#78ffbd" : "#ff9eab",
        fontStyle: "bold",
      }).setOrigin(0.5);
    });
  }

  desenharSecao(y, texto) {
    this.add.rectangle(GW / 2, y, GW - 54, 58, 0x07172a, 0.98)
      .setStrokeStyle(2, 0x138fc0, 0.85);
    this.add.text(48, y, texto, {
      fontSize: "27px",
      color: "#d9f7ff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
  }

  // -------------------------------------------------------------------------
  // Tela principal: 20 cartas, como um deck de verdade
  // -------------------------------------------------------------------------
  renderizarDeck() {
    this.telaAtual = "deck";
    this.desenharFundo(
      "CYBERDUEL DECK",
      "Toque em uma carta para abrir a ficha completa",
      "◆",
    );
    this.desenharResumo(242);
    this.desenharSecao(326, "DECK PRINCIPAL  •  20 CARTAS");

    const cards = this.expandirDeck();
    for (let index = 0; index < 20; index++) {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = 120 + column * 210;
      const y = 535 + row * 290;
      const card = cards[index];

      if (!card) {
        this.desenharSlotVazio(x, y, index + 1, 188, 264);
        continue;
      }

      const visual = this.desenharCarta(card, x, y, 188, 264, "deck");
      this.criarZonaCarta(
        x,
        y,
        188,
        264,
        visual,
        () => this.abrirDetalhe(card),
      );
    }

    const valid = this.builder.isValid(this.deck);
    this.add.rectangle(
      GW / 2,
      1638,
      1020,
      88,
      valid ? 0x0b392a : 0x352319,
      0.96,
    ).setStrokeStyle(3, valid ? 0x3ce69a : 0xffa24c, 0.9);
    this.add.text(
      GW / 2,
      1638,
      valid
        ? "✓  DECK SALVO E PRONTO PARA JOGAR"
        : "MONTE 20 CARTAS E CUMPRA OS REQUISITOS",
      {
        fontSize: "29px",
        color: valid ? "#76ffc0" : "#ffc27c",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);

    this.criarBotao(
      GW / 2,
      1780,
      1020,
      142,
      valid ? "EDITAR MEU DECK" : "COMEÇAR A MONTAR",
      0x075eaa,
      () => {
        this.deckAntesDaEdicao = this.deck.map((entry) => ({ ...entry }));
        this.filtro = "todos";
        this.pagina = 0;
        this.agendarRender("renderizarEditor");
      },
      { fontSize: 40, icon: "✎" },
    );

    this.criarBotao(
      145,
      2030,
      235,
      120,
      "VOLTAR",
      0x26374f,
      () => this.scene.start("CenaTitulo"),
      { fontSize: 30, icon: "←" },
    );
    this.add.text(
      GW - 42,
      2030,
      valid
        ? "Deck salvo neste dispositivo"
        : "Nenhuma carta é adicionada automaticamente",
      {
        fontSize: "23px",
        color: valid ? "#8195ad" : "#d79b64",
      },
    ).setOrigin(1, 0.5);
  }

  // -------------------------------------------------------------------------
  // Editor: coleção paginada, controles sem sobreposição
  // -------------------------------------------------------------------------
  ordenarCatalogo(cards) {
    const ordemTipo = { monstro: 0, efeito: 1, terreno: 2 };
    const ordemNivel = { baixa: 0, media: 1, alta: 2, lendaria: 3 };
    const direcao = this.ordemNivel === "decrescente" ? -1 : 1;

    return [...cards].sort((a, b) => {
      const porTipo = (ordemTipo[a.tipo] ?? 99) - (ordemTipo[b.tipo] ?? 99);
      if (porTipo) return porTipo;

      if (a.tipo === "monstro") {
        const porNivel =
          ((ordemNivel[a.nivel] ?? 99) - (ordemNivel[b.nivel] ?? 99)) *
          direcao;
        if (porNivel) return porNivel;

        const porPoder = ((a.poder || 0) - (b.poder || 0)) * direcao;
        if (porPoder) return porPoder;
      }

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }

  renderizarEditor() {
    this.telaAtual = "editor";
    this.desenharFundo(
      "EDITAR DECK",
      "Toque na carta para inspecionar • use − e + para alterar",
      "✎",
    );
    this.desenharResumo(242);

    const filtros = [
      ["todos", "TODAS"],
      ["monstro", "PERSONAGENS"],
      ["efeito", "EFEITOS"],
      ["terreno", "TERRENOS"],
    ];
    filtros.forEach(([value, label], index) => {
      const active = this.filtro === value;
      this.criarBotao(
        145 + index * 263,
        350,
        238,
        100,
        label,
        active ? 0x087dbb : 0x15263a,
        () => {
          this.filtro = value;
          this.pagina = 0;
          this.agendarRender("renderizarEditor");
        },
        { fontSize: label === "PERSONAGENS" ? 30 : 36, active },
      );
    });

    // A coleção respeita sempre a hierarquia visual do jogo: personagens,
    // efeitos e, por último, terrenos. A direção afeta apenas personagens.
    const filtradas = this.ordenarCatalogo(
      this.catalogo.filter(
        (card) => this.filtro === "todos" || card.tipo === this.filtro,
      ),
    );

    this.add.rectangle(GW / 2, 485, GW - 70, 104, 0x071829, 0.98)
      .setStrokeStyle(3, 0x1b789d, 0.9);
    this.add.text(70, 465, "ORDEM POR NÍVEL", {
      fontSize: "24px",
      color: "#78cfe4",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.criarBotao(
      600,
      485,
      260,
      70,
      "BAIXO → LENDÁRIO",
      this.ordemNivel === "crescente" ? 0x087dbb : 0x15263a,
      () => {
        this.ordemNivel = "crescente";
        this.pagina = 0;
        this.agendarRender("renderizarEditor");
      },
      { fontSize: 19, active: this.ordemNivel === "crescente" },
    );
    this.criarBotao(
      885,
      485,
      260,
      70,
      "LENDÁRIO → BAIXO",
      this.ordemNivel === "decrescente" ? 0x8a4cc2 : 0x15263a,
      () => {
        this.ordemNivel = "decrescente";
        this.pagina = 0;
        this.agendarRender("renderizarEditor");
      },
      { fontSize: 19, active: this.ordemNivel === "decrescente" },
    );

    this.add.rectangle(GW / 2, 565, GW - 110, 42, 0x0b2638, 0.95)
      .setStrokeStyle(2, 0x1d6d89, 0.7);
    this.add.text(75, 565, "PERSONAGENS  ›  EFEITOS  ›  TERRENOS", {
      fontSize: "22px",
      color: "#a9eeff",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.add.text(GW - 75, 565, `${filtradas.length} CARTAS`, {
      fontSize: "21px",
      color: "#6fb5ca",
      fontStyle: "bold",
    }).setOrigin(1, 0.5);
    const paginas = Math.max(
      1,
      Math.ceil(filtradas.length / this.cartasPorPagina),
    );
    this.pagina = Phaser.Math.Clamp(this.pagina, 0, paginas - 1);
    const visiveis = filtradas.slice(
      this.pagina * this.cartasPorPagina,
      (this.pagina + 1) * this.cartasPorPagina,
    );
    const quantities = this.obterQuantidades();

    visiveis.forEach((card, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 180 + column * 360;
      const y = 800 + row * 580;
      this.desenharItemColecao(
        card,
        x,
        y,
        quantities.get(card.key) || 0,
      );
    });

    this.criarBotao(
      190,
      1800,
      280,
      132,
      "ANTERIOR",
      0x223a55,
      () => {
        this.pagina--;
        this.agendarRender("renderizarEditor");
      },
      { fontSize: 29, icon: "◀", disabled: this.pagina === 0 },
    );
    this.add.text(GW / 2, 1800, `${this.pagina + 1} / ${paginas}`, {
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.criarBotao(
      890,
      1800,
      280,
      132,
      "PRÓXIMA",
      0x223a55,
      () => {
        this.pagina++;
        this.agendarRender("renderizarEditor");
      },
      {
        fontSize: 29,
        icon: "▶",
        iconAfter: true,
        disabled: this.pagina >= paginas - 1,
      },
    );

    const valid = this.builder.isValid(this.deck);
    this.criarBotao(
      175,
      2000,
      310,
      132,
      "LIMPAR DECK",
      0x762e3d,
      () => {
        this.deck = [];
        this.agendarRender("renderizarEditor");
      },
      { fontSize: 28, icon: "⌫", disabled: this.deck.length === 0 },
    );

    this.criarBotao(
      520,
      2000,
      340,
      132,
      "CANCELAR",
      0x354053,
      () => {
        this.deck = this.deckAntesDaEdicao
          ? this.deckAntesDaEdicao.map((entry) => ({ ...entry }))
          : this.builder.getDeckForMatch();
        this.agendarRender("renderizarDeck");
      },
      { fontSize: 29, icon: "×" },
    );

    this.criarBotao(
      885,
      2000,
      350,
      132,
      valid ? "SALVAR DECK" : "DECK INVÁLIDO",
      valid ? 0x087a4c : 0x493841,
      () => {
        if (!valid) return;
        this.builder.saveDeck(this.deck);
        this.deckAntesDaEdicao = null;
        this.agendarRender("renderizarDeck");
      },
      { fontSize: 29, icon: valid ? "✓" : "!", disabled: !valid },
    );
  }

  desenharItemColecao(card, x, y, quantity) {
    const width = 292;
    const height = 410;
    const visual = this.desenharCarta(card, x, y, width, height, "colecao");

    // A carta inteira abre a ficha; a faixa de quantidade começa depois
    // dela, com um vão real entre as duas áreas interativas.
    this.criarZonaCarta(
      x,
      y,
      width,
      height,
      visual,
      () => this.abrirDetalhe(card),
    );

    const color = quantity > 0 ? 0x00a86b : 0x132238;
    this.add.circle(x + 119, y - 170, 36, color, 1)
      .setStrokeStyle(3, quantity > 0 ? 0x77ffc0 : 0x58708d)
      .setDepth(120);
    this.add.text(x + 119, y - 170, `${quantity}/${card.limite}`, {
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(121);

    const total = this.builder.total(this.deck);
    this.add.rectangle(
      x,
      y + 280,
      width,
      132,
      quantity > 0 ? 0x082c24 : 0x071525,
      0.98,
    ).setStrokeStyle(2, quantity > 0 ? 0x24c887 : 0x225b7d, 0.8)
      .setDepth(150);
    this.criarBotao(
      x - 80,
      y + 280,
      132,
      132,
      "−",
      0x8d3444,
      () => this.alterarQuantidade(card, -1),
      { fontSize: 50, disabled: quantity <= 0, depth: 160 },
    );
    this.add.text(x, y + 280, String(quantity), {
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(160);
    this.criarBotao(
      x + 80,
      y + 280,
      132,
      132,
      "+",
      0x157b4e,
      () => this.alterarQuantidade(card, 1),
      {
        fontSize: 46,
        disabled:
          quantity >= card.limite || total >= this.builder.maxCards,
        depth: 160,
      },
    );
  }

  alterarQuantidade(card, delta) {
    if (this.modalAberto) return;
    const quantities = this.obterQuantidades();
    const current = quantities.get(card.key) || 0;
    const total = this.builder.total(this.deck);
    if (
      delta > 0 &&
      (current >= card.limite || total >= this.builder.maxCards)
    )
      return;
    quantities.set(
      card.key,
      Phaser.Math.Clamp(current + delta, 0, card.limite),
    );
    this.definirQuantidades(quantities);
    this.agendarRender("renderizarEditor");
  }

  // -------------------------------------------------------------------------
  // Card visual e hit areas
  // -------------------------------------------------------------------------
  desenharCarta(card, x, y, width, height, variant) {
    const color = this.corNivel(card);
    const container = this.add.container(x, y).setDepth(100);
    const shadow = this.add.rectangle(7, 10, width, height, 0x000000, 0.58);
    const frame = this.add.rectangle(0, 0, width, height, 0x07111d, 1)
      .setStrokeStyle(card.lendaria ? 7 : 4, color, 1);

    const footerHeight = variant === "colecao" ? 74 : 64;
    const artHeight = height - footerHeight - 12;
    const texture = card.imagem && this.textures.exists(card.imagem)
      ? card.imagem
      : "fundoCarta";
    const image = this.add.image(0, -footerHeight / 2 + 2, texture);
    this.aplicarCover(
      image,
      width - 12,
      artHeight,
      card.foco || { x: 0.5, y: 0.5 },
    );

    const footerY = height / 2 - footerHeight / 2 - 5;
    const footer = this.add.rectangle(
      0,
      footerY,
      width - 10,
      footerHeight,
      0x02060d,
      0.95,
    );
    const name = this.add.text(0, footerY - 5, this.encurtar(card.nome, variant === "colecao" ? 25 : 18), {
      fontSize: variant === "colecao" ? "22px" : "18px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: width - 22 },
    }).setOrigin(0.5);
    const type = this.add.text(0, footerY + footerHeight / 2 - 11, this.rotuloTipo(card.tipo), {
      fontSize: variant === "colecao" ? "16px" : "13px",
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: "bold",
    }).setOrigin(0.5, 1);

    const paCircle = this.add.circle(
      -width / 2 + 27,
      -height / 2 + 28,
      variant === "colecao" ? 25 : 22,
      0x02060d,
      0.98,
    ).setStrokeStyle(3, color);
    const pa = this.add.text(
      -width / 2 + 27,
      -height / 2 + 28,
      String(card.poder),
      {
        fontSize: variant === "colecao" ? "22px" : "19px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);

    container.add([shadow, frame, image, footer, name, type, paCircle, pa]);
    return container;
  }

  criarZonaCarta(x, y, width, height, visual, callback) {
    const zone = this.add.zone(x, y, width, height).setDepth(145);
    this.configurarToque(zone, callback);
    zone.on("pointerover", () => {
      if (this.modalAberto) return;
      this.tweens.add({ targets: visual, scale: 1.045, duration: 100 });
    });
    zone.on("pointerout", () => {
      this.tweens.add({ targets: visual, scale: 1, duration: 100 });
    });
    return zone;
  }

  desenharSlotVazio(x, y, number, width, height) {
    this.add.rectangle(x, y, width, height, 0x050d19, 0.88)
      .setStrokeStyle(3, 0x17496d, 0.85);
    this.add.circle(x, y, 38, 0x071a2d, 1)
      .setStrokeStyle(3, 0x1b6590);
    this.add.text(x, y, String(number), {
      fontSize: "32px",
      color: "#32769d",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  aplicarCover(image, targetWidth, targetHeight, focus) {
    image.setCrop();
    const centerX = image.x;
    const centerY = image.y;
    const nativeWidth = image.width;
    const nativeHeight = image.height;
    const scale = Math.max(
      targetWidth / nativeWidth,
      targetHeight / nativeHeight,
    );
    const cropWidth = Math.min(nativeWidth, targetWidth / scale);
    const cropHeight = Math.min(nativeHeight, targetHeight / scale);
    const maxX = nativeWidth - cropWidth;
    const maxY = nativeHeight - cropHeight;
    const cropX = Phaser.Math.Clamp((focus.x ?? 0.5) * maxX, 0, maxX);
    const cropY = Phaser.Math.Clamp((focus.y ?? 0.5) * maxY, 0, maxY);
    image.setCrop(cropX, cropY, cropWidth, cropHeight);
    image.setScale(scale);
    // setCrop mantém a origem baseada na textura inteira. O deslocamento
    // abaixo recentraliza exatamente o pedaço visível dentro da moldura.
    image.x =
      centerX + (nativeWidth * scale) / 2 - cropX * scale - targetWidth / 2;
    image.y =
      centerY + (nativeHeight * scale) / 2 - cropY * scale - targetHeight / 2;
  }

  // -------------------------------------------------------------------------
  // Visualização avançada: usa diretamente o renderer oficial do jogo.
  // O deck adiciona apenas a faixa de quantidade abaixo da carta.
  // -------------------------------------------------------------------------
  abrirDetalhe(card) {
    if (this.modalAberto) return;

    this.cartaEmDetalhe = card;
    this.deckAlteradoNoDetalhe = false;
    this.travado = false;
    this.zoomAberto = false;
    this.zoomBloqueadoAte = 0;
    this.partida = { partidaEncerrada: true };
    this.somPop = this.somPop || { play() {} };

    const cartaDoJogo = {
      ...card,
      partesDescricao: () =>
        Array.isArray(card.partesDescricao) && card.partesDescricao.length
          ? card.partesDescricao
          : [{ tipo: "flavor", texto: card.descricao }],
    };

    // Esta é a implementação do jogo.js, não uma reprodução do layout.
    CenaJogo.prototype.mostrarDetalheCarta.call(this, cartaDoJogo);
    this.criarControlesDetalheDeck(card);
    this.fecharModal = () => this.fecharDetalheCarta(true);
  }

  mostrarDetalheCartaLendaria(card) {
    return CenaJogo.prototype.mostrarDetalheCartaLendaria.call(this, card);
  }

  obterCorPorId(id) {
    return CenaJogo.prototype.obterCorPorId.call(this, id);
  }

  aplicarRecorteCover(image, width, height, focus) {
    return CenaJogo.prototype.aplicarRecorteCover.call(
      this,
      image,
      width,
      height,
      focus,
    );
  }

  criarSeloEstat(x, y, value, color, radius) {
    return CenaJogo.prototype.criarSeloEstat.call(
      this,
      x,
      y,
      value,
      color,
      radius,
    );
  }

  habilitarScrollDescricao(...args) {
    return CenaJogo.prototype.habilitarScrollDescricao.call(this, ...args);
  }

  // O zoom por hover é uma interação própria do tabuleiro. No editor a arte
  // já abre na ficha oficial e os toques ficam reservados aos controles.
  abrirZoomCarta() {}

  criarControlesDetalheDeck(card) {
    const depth = 10020;
    const y = card.lendaria ? 2040 : 1850;
    const panelWidth = card.lendaria ? 960 : 840;
    const panel = this.add.rectangle(
      GW / 2,
      y,
      panelWidth,
      150,
      0x0b1320,
      0.99,
    ).setStrokeStyle(4, card.lendaria ? 0xffd966 : 0xffffff, 0.95)
      .setDepth(depth);
    const label = this.add.text(GW / 2, y - 53, "QUANTIDADE NO DECK", {
      fontSize: "22px",
      color: card.lendaria ? "#ffd966" : "#9be7ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(depth + 1);
    this.controlesDetalheDeck = [panel, label];

    const render = () => {
      if (!this.modalAberto) return;
      this.controlesDetalheDinamicos?.forEach((object) => object.destroy());
      const quantities = this.obterQuantidades();
      const quantity = quantities.get(card.key) || 0;
      const total = this.builder.total(this.deck);
      const buttonY = y + 18;
      const minus = this.criarBotao(
        GW / 2 - 265,
        buttonY,
        270,
        88,
        "REMOVER",
        0x8d3444,
        () => change(-1),
        {
          fontSize: 25,
          icon: "−",
          disabled: quantity <= 0,
          depth: depth + 2,
        },
      );
      const plus = this.criarBotao(
        GW / 2 + 265,
        buttonY,
        270,
        88,
        "ADICIONAR",
        0x157b4e,
        () => change(1),
        {
          fontSize: 25,
          icon: "+",
          disabled:
            quantity >= card.limite || total >= this.builder.maxCards,
          depth: depth + 2,
        },
      );
      const quantityText = this.add.text(
        GW / 2,
        buttonY - 4,
        `${quantity}/${card.limite}`,
        {
          fontSize: "43px",
          color: quantity > 0 ? "#72ffbb" : "#ffffff",
          fontStyle: "bold",
        },
      ).setOrigin(0.5).setDepth(depth + 3);
      const totalText = this.add.text(GW / 2, buttonY + 39, `TOTAL ${total}/20`, {
        fontSize: "18px",
        color: "#9aa9ba",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(depth + 3);
      this.controlesDetalheDinamicos = [minus, plus, quantityText, totalText];
    };

    const change = (delta) => {
      const quantities = this.obterQuantidades();
      const current = quantities.get(card.key) || 0;
      const total = this.builder.total(this.deck);
      if (
        (delta < 0 && current <= 0) ||
        (delta > 0 &&
          (current >= card.limite || total >= this.builder.maxCards))
      )
        return;
      quantities.set(
        card.key,
        Phaser.Math.Clamp(current + delta, 0, card.limite),
      );
      this.definirQuantidades(quantities);
      this.deckAlteradoNoDetalhe = true;
      this.time.delayedCall(0, render);
    };

    render();
  }

  fecharDetalheCarta(imediato = false) {
    if (!this.modalAberto) return;
    const changed = this.deckAlteradoNoDetalhe;

    this.tweensLendariaAtual?.forEach((tween) => tween.stop());
    this.tweensLendariaAtual = null;
    if (this.handlersScrollDescAtual) {
      const handlers = this.handlersScrollDescAtual;
      this.input.off("pointermove", handlers.handlerMove);
      this.input.off("pointerup", handlers.handlerUp);
      this.input.off("pointerupoutside", handlers.handlerUp);
      this.input.off("wheel", handlers.handlerWheel);
      this.handlersScrollDescAtual = null;
    }

    const finish = () => {
      this.painelDetalheAtual?.destroy();
      this.overlayDetalheAtual?.destroy();
      this.mascaraGraphicsAtual?.destroy();
      this.controlesDetalheDinamicos?.forEach((object) => object.destroy());
      this.controlesDetalheDeck?.forEach((object) => object.destroy());
      this.painelDetalheAtual = null;
      this.overlayDetalheAtual = null;
      this.mascaraGraphicsAtual = null;
      this.controlesDetalheDinamicos = null;
      this.controlesDetalheDeck = null;
      this.cartaEmDetalhe = null;
      this.fecharModal = null;
      this.modalAberto = false;
      this.travado = false;
      if (changed && !imediato)
        this.agendarRender(
          this.telaAtual === "editor" ? "renderizarEditor" : "renderizarDeck",
        );
    };

    if (imediato || !this.painelDetalheAtual) {
      finish();
      return;
    }
    this.tweens.add({
      targets: this.painelDetalheAtual,
      scale: 0.8,
      alpha: 0,
      duration: 150,
      ease: "Sine.easeIn",
      onComplete: finish,
    });
  }

  // Implementação anterior mantida temporariamente apenas como referência
  // de migração. A interface ativa acima usa exclusivamente o jogo.js.
  abrirDetalheAnterior(card) {
    if (this.modalAberto) return;
    this.modalAberto = true;
    this.cartaEmDetalhe = card;

    const depth = 10000;
    const panelCenterY = 930;
    const panelWidth = 900;
    const panelHeight = 1480;
    const artWidth = 800;
    const artHeight = 580;
    const panelTop = panelCenterY - panelHeight / 2;
    const panelBottom = panelCenterY + panelHeight / 2;
    const borderColor = card.lendaria ? 0xffd966 : 0xffffff;
    const typeColor =
      card.tipo === "terreno"
        ? "#a3e635"
        : card.tipo === "efeito"
          ? "#ffe066"
          : card.lendaria
            ? "#ffd966"
            : "#9be7ff";

    let closed = false;
    let deckChanged = false;
    let dynamicControls = [];
    const objects = [];

    const blocker = this.add.rectangle(
      GW / 2,
      GH / 2,
      GW,
      GH,
      0x000000,
      0.82,
    ).setDepth(depth);
    const panel = this.add.rectangle(
      GW / 2,
      panelCenterY,
      panelWidth,
      panelHeight,
      0x14141c,
      1,
    ).setStrokeStyle(card.lendaria ? 14 : 9, borderColor).setDepth(depth + 1);
    const panelInner = this.add.rectangle(
      GW / 2,
      panelCenterY,
      panelWidth - 24,
      panelHeight - 24,
      0x000000,
      0,
    ).setStrokeStyle(2, borderColor, 0.55).setDepth(depth + 2);
    this.configurarToque(panel, () => {}, { modal: true });
    objects.push(blocker, panel, panelInner);

    const typeLabel =
      card.lendaria
        ? "✦ CARTA LENDÁRIA ✦"
        : card.tipo === "terreno"
          ? "CARTA DE TERRENO"
          : card.tipo === "efeito"
            ? "CARTA DE EFEITO"
            : `CARTA ${this.rotuloNivel(card.nivel).toUpperCase()}`;
    const type = this.add.text(
      GW / 2,
      panelTop + 58,
      typeLabel,
      {
      fontSize: "36px",
      color: typeColor,
      fontStyle: "bold",
      align: "center",
      },
    ).setOrigin(0.5).setDepth(depth + 5);
    objects.push(type);

    const artY = panelTop + 405;
    const artBackground = this.add.rectangle(
      GW / 2,
      artY,
      artWidth,
      artHeight,
      this.corNivel(card),
      0.72,
    ).setDepth(depth + 2);
    objects.push(artBackground);

    if (card.imagem && this.textures.exists(card.imagem)) {
      const image = this.add.image(GW / 2, artY, card.imagem).setDepth(depth + 3);
      this.aplicarCover(
        image,
        artWidth,
        artHeight,
        card.foco || { x: 0.5, y: 0.5 },
      );
      objects.push(image);
    } else {
      const icon = this.add.text(
        GW / 2,
        artY,
        card.tipo === "terreno" ? "⛰" : card.tipo === "efeito" ? "⚡" : "⚔",
        { fontSize: "156px", color: "#ffffff" },
      ).setOrigin(0.5).setDepth(depth + 3);
      objects.push(icon);
    }

    const artFrame = this.add.rectangle(
      GW / 2,
      artY,
      artWidth,
      artHeight,
      0x000000,
      0,
    ).setStrokeStyle(6, borderColor).setDepth(depth + 4);
    objects.push(artFrame);

    if (card.tipo === "monstro") {
      const powerBackground = this.add.circle(
        GW / 2 - panelWidth / 2 + 70,
        panelTop + 58,
        46,
        0xff5555,
        1,
      ).setStrokeStyle(4, 0xffffff).setDepth(depth + 4);
      const power = this.add.text(
        GW / 2 - panelWidth / 2 + 70,
        panelTop + 58,
        String(card.poder),
        {
          fontSize: "38px",
          color: "#ffffff",
          fontStyle: "bold",
        },
      ).setOrigin(0.5).setDepth(depth + 5);
      objects.push(powerBackground, power);
    }

    if (card.lendaria) {
      const titlePlate = this.add.rectangle(
        GW / 2,
        panelTop + 805,
        800,
        150,
        0x000000,
        0.68,
      ).setStrokeStyle(2, 0xffd966, 0.65).setDepth(depth + 4);
      objects.push(titlePlate);
    }

    const title = this.add.text(
      GW / 2,
      panelTop + 750,
      card.nome,
      {
      fontSize: card.lendaria ? "52px" : "48px",
      color: card.lendaria ? "#fff1c4" : "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 780 },
      },
    ).setOrigin(0.5, 0).setDepth(depth + 5);
    objects.push(title);

    const descriptionTop = Math.max(panelTop + 880, title.y + title.height + 24);
    const descriptionBottom = panelBottom - 40;
    const descriptionWidth = 760;
    const descriptionHeight = Math.max(180, descriptionBottom - descriptionTop);
    const parts =
      Array.isArray(card.partesDescricao) && card.partesDescricao.length
        ? card.partesDescricao
        : [{ tipo: "flavor", texto: card.descricao }];

    const descriptionPlate = this.add.rectangle(
      GW / 2,
      descriptionTop + descriptionHeight / 2,
      820,
      descriptionHeight,
      0x050914,
      0.94,
    ).setStrokeStyle(2, borderColor, card.lendaria ? 0.6 : 0.28)
      .setDepth(depth + 4);
    objects.push(descriptionPlate);

    const descriptionItems = [];
    let partY = 0;
    parts.forEach((part) => {
      const text = this.add.text(0, partY, part.texto, {
        fontSize: "26px",
        color: part.tipo === "efeito" ? "#ffd966" : "#dddddd",
        fontStyle: part.tipo === "efeito" ? "bold" : "normal",
        align: "justify",
        wordWrap: { width: descriptionWidth },
        lineSpacing: 7,
      }).setOrigin(0.5, 0);
      descriptionItems.push(text);
      partY += text.height + 12;
    });
    // Ajusta a tipografia ao espaço disponível. O conteúdo permanece inteiro,
    // sem máscara: isso funciona igualmente em Canvas e WebGL.
    let fontSize = 26;
    let totalDescriptionHeight = Math.max(0, partY - 12);
    while (totalDescriptionHeight > descriptionHeight - 28 && fontSize > 18) {
      fontSize -= 1;
      partY = 0;
      descriptionItems.forEach((text) => {
        text.setPosition(0, partY);
        text.setFontSize(fontSize);
        text.setLineSpacing(Math.max(2, fontSize - 19));
        partY += text.height + 12;
      });
      totalDescriptionHeight = Math.max(0, partY - 12);
    }
    const description = this.add.container(
      GW / 2,
      descriptionTop,
      descriptionItems,
    ).setDepth(depth + 5);
    objects.push(description);

    const closeBackground = this.add.circle(0, 0, 52, 0x2a2a2a, 1)
      .setStrokeStyle(4, borderColor);
    const closeText = this.add.text(0, 0, "✕", {
      fontSize: "50px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    const closeButton = this.add.container(
      GW / 2 + panelWidth / 2 - 64,
      panelTop + 58,
      [closeBackground, closeText],
    ).setDepth(depth + 8);
    closeButton.setSize(112, 112);
    objects.push(closeButton);

    const controlsPanel = this.add.rectangle(
      GW / 2,
      1810,
      panelWidth,
      200,
      0x0b1320,
      0.99,
    ).setStrokeStyle(4, borderColor, 0.9).setDepth(depth + 2);
    const controlsTitle = this.add.text(GW / 2, 1732, "QUANTIDADE NO DECK", {
      fontSize: "25px",
      color: "#9be7ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(depth + 4);
    const unsaved = this.add.text(
      GW / 2,
      1950,
      "ALTERAÇÕES SERÃO SALVAS PELO BOTÃO SALVAR DECK",
      {
        fontSize: "22px",
        color: "#8897aa",
        fontStyle: "bold",
      },
    ).setOrigin(0.5).setDepth(depth + 4);
    objects.push(controlsPanel, controlsTitle, unsaved);

    const quantitiesFor = () => this.obterQuantidades();
    const renderQuantityControls = () => {
      dynamicControls.forEach((object) => object.destroy());
      dynamicControls = [];

      const quantities = quantitiesFor();
      const quantity = quantities.get(card.key) || 0;
      const total = this.builder.total(this.deck);
      const canRemove = quantity > 0;
      const canAdd =
        quantity < card.limite && total < this.builder.maxCards;

      const minus = this.criarBotao(
        290,
        1815,
        270,
        104,
        "REMOVER",
        0x8d3444,
        () => changeQuantity(-1),
        {
          fontSize: 28,
          icon: "−",
          disabled: !canRemove,
          depth: depth + 7,
        },
      );
      const plus = this.criarBotao(
        790,
        1815,
        270,
        104,
        "ADICIONAR",
        0x157b4e,
        () => changeQuantity(1),
        {
          fontSize: 28,
          icon: "+",
          disabled: !canAdd,
          depth: depth + 7,
        },
      );
      const quantityText = this.add.text(
        GW / 2,
        1808,
        `${quantity}/${card.limite}`,
        {
          fontSize: "47px",
          color: quantity > 0 ? "#72ffbb" : "#ffffff",
          fontStyle: "bold",
        },
      ).setOrigin(0.5).setDepth(depth + 7);
      const totalText = this.add.text(
        GW / 2,
        1870,
        `TOTAL ${total}/20`,
        {
          fontSize: "23px",
          color: total === 20 ? "#ffbd67" : "#9aa9ba",
          fontStyle: "bold",
        },
      ).setOrigin(0.5).setDepth(depth + 7);
      dynamicControls.push(minus, plus, quantityText, totalText);
    };

    const changeQuantity = (delta) => {
      const quantities = quantitiesFor();
      const current = quantities.get(card.key) || 0;
      const total = this.builder.total(this.deck);
      if (
        (delta < 0 && current <= 0) ||
        (delta > 0 &&
          (current >= card.limite || total >= this.builder.maxCards))
      )
        return;
      quantities.set(
        card.key,
        Phaser.Math.Clamp(current + delta, 0, card.limite),
      );
      this.definirQuantidades(quantities);
      deckChanged = true;
      this.time.delayedCall(0, renderQuantityControls);
    };

    const closeDetail = () => {
      if (closed) return;
      closed = true;
      dynamicControls.forEach((object) => object.destroy());
      objects.forEach((object) => object.destroy());
      this.fecharModal = null;
      this.cartaEmDetalhe = null;
      this.modalAberto = false;
      if (deckChanged)
        this.agendarRender(
          this.telaAtual === "editor" ? "renderizarEditor" : "renderizarDeck",
        );
    };

    this.configurarToque(closeButton, closeDetail, { modal: true });
    this.configurarToque(blocker, closeDetail, { modal: true });
    this.fecharModal = closeDetail;
    renderQuantityControls();
  }

  // -------------------------------------------------------------------------
  // Botões e dados do deck
  // -------------------------------------------------------------------------
  criarBotao(x, y, width, height, label, color, callback, options = {}) {
    const disabled = !!options.disabled;
    const depth = options.depth || 300;
    const background = this.add.rectangle(
      0,
      0,
      width,
      height,
      color,
      disabled ? 0.48 : 1,
    ).setStrokeStyle(
      options.active ? 4 : 3,
      disabled ? 0x536070 : options.active ? 0x9ff3ff : 0x6edfff,
      disabled ? 0.55 : 0.9,
    );
    const fullLabel = options.icon
      ? options.iconAfter
        ? `${label}  ${options.icon}`
        : `${options.icon}  ${label}`
      : label;
    const text = this.add.text(0, 0, fullLabel, {
      fontSize: `${options.fontSize || 28}px`,
      color: disabled ? "#83909f" : "#ffffff",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [background, text]).setDepth(depth);
    button.setSize(width, height);

    this.configurarToque(button, disabled ? () => {} : callback, {
      disabled,
      modal: depth >= 10000,
    });

    if (!disabled) {
      button.on("pointerover", () => {
        if (this.modalAberto && depth < 10000) return;
        this.tweens.add({ targets: button, scale: 1.035, duration: 90 });
      });
      button.on("pointerout", () =>
        this.tweens.add({ targets: button, scale: 1, duration: 90 }),
      );
    }
    return button;
  }

  configurarToque(target, callback, options = {}) {
    const disabled = !!options.disabled;
    let press = null;
    target.setInteractive({ useHandCursor: !disabled });
    target.on("pointerdown", (pointer, localX, localY, event) => {
      event?.stopPropagation();
      if (disabled || (this.modalAberto && !options.modal)) return;
      press = { id: pointer.id, x: pointer.x, y: pointer.y };
    });
    target.on("pointerup", (pointer, localX, localY, event) => {
      event?.stopPropagation();
      const startedHere =
        press &&
        press.id === pointer.id &&
        Phaser.Math.Distance.Between(press.x, press.y, pointer.x, pointer.y) <= 48;
      press = null;
      if (
        !startedHere ||
        disabled ||
        (this.modalAberto && !options.modal)
      )
        return;
      callback();
    });
    target.on("pointerout", () => {
      press = null;
    });
    return target;
  }

  obterQuantidades() {
    return new Map(
      this.deck.map((entry) => [
        `${entry.tipo}:${entry.nome}`,
        entry.quantidade,
      ]),
    );
  }

  definirQuantidades(quantities) {
    this.deck = this.catalogo
      .filter((card) => (quantities.get(card.key) || 0) > 0)
      .map((card) => ({
        tipo: card.tipo,
        nome: card.nome,
        quantidade: quantities.get(card.key),
      }));
  }

  expandirDeck() {
    const catalog = new Map(this.catalogo.map((card) => [card.key, card]));
    const result = [];
    this.deck.forEach((entry) => {
      const card = catalog.get(`${entry.tipo}:${entry.nome}`);
      for (let copy = 0; card && copy < entry.quantidade; copy++)
        result.push(card);
    });
    return result;
  }

  corNivel(card) {
    return (
      {
        baixa: 0x42bfff,
        media: 0xba6cff,
        alta: 0xffa928,
        lendaria: 0xffdf55,
        efeito: 0x36e4a0,
        terreno: 0xcf72ff,
      }[card.nivel] || 0x7c98b2
    );
  }

  rotuloTipo(tipo) {
    return (
      { monstro: "Personagem", efeito: "Efeito", terreno: "Terreno" }[
        tipo
      ] || tipo
    );
  }

  rotuloNivel(nivel) {
    return (
      {
        baixa: "Baixa",
        media: "Média",
        alta: "Alta",
        lendaria: "Lendária",
        efeito: "Efeito",
        terreno: "Terreno",
      }[nivel] || nivel
    );
  }

  ajustarImagem(image, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    image.setScale(scale);
  }

  encurtar(text, maximum) {
    return text.length <= maximum
      ? text
      : `${text.slice(0, maximum - 1)}…`;
  }
}
