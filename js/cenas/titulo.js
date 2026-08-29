// ============================================================================
// CENA DE TÍTULO
// ============================================================================
// Tela simples entre o preload e a partida: nome do jogo + um botão
// "JOGAR" que inicia a CenaJogo. Roda depois da CenaPreload (ver
// main.js), então todos os assets já estão carregados aqui — dá pra usar
// sons de UI (ex: somHover/somPop) se quiser, sem precisar carregar nada.
// ============================================================================
class CenaTitulo extends Phaser.Scene {
  constructor() {
    super("CenaTitulo");
  }

  create() {
    this.cameras.main.setBackgroundColor("#101018");

    let titulo = this.add
      .text(GW / 2, GH / 2 - 280, "CYBERDUEL", {
        fontSize: "116px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    let subtitulo = this.add
      .text(GW / 2, GH / 2 - 150, "Duelo tático de cartas", {
        fontSize: "36px",
        color: "#9be7ff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: titulo,
      alpha: 1,
      y: GH / 2 - 320,
      duration: 500,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: subtitulo,
      alpha: 1,
      duration: 500,
      delay: 150,
      ease: "Sine.easeOut",
    });

    this.multiplayer = window.cyberduelMultiplayer;
    this.deckPronto = !!window.cyberduelDeckBuilder.getSavedDeck();
    this.textoStatus = this.add
      .text(GW / 2, GH / 2 + 700, "", {
        fontSize: "30px",
        color: "#9be7ff",
        align: "center",
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5);

    this.multiplayer.onStatus = (mensagem) => this.atualizarStatus(mensagem);
    this.multiplayer.onReady = () => this.iniciarPartidaMultiplayer();
    this.events.once("shutdown", () => this.removerQrSala());

    this.criarBotaoJogar("JOGAR SOLO", GH / 2 + 20, () =>
      this.iniciarPartida(false),
      { disabled: !this.deckPronto },
    );
    this.criarBotaoJogar("CRIAR SALA", GH / 2 + 180, () =>
      this.criarSala(),
      { disabled: !this.deckPronto },
    );
    this.criarBotaoJogar("ENTRAR NA SALA", GH / 2 + 340, () =>
      this.entrarNaSala(),
      { disabled: !this.deckPronto },
    );
    this.criarBotaoJogar("MONTAR DECK", GH / 2 + 500, () =>
      this.scene.start("CenaDeckBuilder"),
    );

    if (!this.deckPronto) {
      this.textoStatus
        .setColor("#ffbd67")
        .setText("Monte e salve seu deck para liberar os modos de jogo.");
    }

    const salaDoLink = new URLSearchParams(location.search).get("room");
    if (salaDoLink) this.entrarNaSala(salaDoLink);
  }

  criarBotaoJogar(rotulo, y, aoClicar, options = {}) {
    const disabled = !!options.disabled;
    let bg = this.add
      .rectangle(0, 0, 440, 150, disabled ? 0x252b36 : 0xff5500)
      .setStrokeStyle(5, disabled ? 0x657083 : 0xffffff);
    let texto = this.add
      .text(0, 0, rotulo, {
        fontSize: "46px",
        color: disabled ? "#7f8998" : "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let btn = this.add.container(GW / 2, y, [bg, texto]);
    btn.setSize(440, 150);
    btn.setInteractive({ useHandCursor: !disabled });
    btn.setScale(0);

    this.tweens.add({
      targets: btn,
      scale: 1,
      duration: 420,
      delay: 300,
      ease: "Back.Out",
    });

    btn.on("pointerover", () => {
      if (disabled) return;
      this.tweens.add({ targets: btn, scale: 1.06, duration: 120 });
    });

    btn.on("pointerout", () => {
      if (disabled) return;
      this.tweens.add({ targets: btn, scale: 1, duration: 120 });
    });

    // Trava pra não disparar duas vezes se o jogador clicar/tocar rápido
    // demais enquanto a transição de cena já está rolando.
    let jaClicou = false;
    btn.on("pointerdown", () => {
      if (disabled || jaClicou) return;
      jaClicou = true;

      this.tweens.add({
        targets: btn,
        scale: 0.9,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => {
          jaClicou = false;
          aoClicar();
        },
      });
    });
    return btn;
  }

  atualizarStatus(mensagem) {
    if (this.textoStatus?.active) this.textoStatus.setText(mensagem);
  }

  iniciarPartida(multiplayer) {
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Monte e salve um deck válido antes de jogar.");
      return;
    }
    if (!multiplayer) this.multiplayer.active = false;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () =>
      this.scene.start("CenaTransicao"),
    );
  }

  iniciarPartidaMultiplayer() {
    if (this.scene.isActive()) this.iniciarPartida(true);
  }

  criarSala() {
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Monte e salve um deck válido antes de criar uma sala.");
      return;
    }
    try {
      this.atualizarStatus("Criando sala...");
      this.multiplayer.createRoom((resposta) => {
        if (!resposta.ok)
          return this.atualizarStatus(resposta.error || "Não foi possível criar a sala.");
        const convite =
          resposta.inviteUrl ||
          `${location.origin}${location.pathname}?room=${resposta.room.code}`;
        this.mostrarQrSala(
          resposta.qrCode,
          resposta.room.code,
          convite,
        );
        this.atualizarStatus(
          `Sala ${resposta.room.code}\nEnvie este link ao oponente:\n${convite}\nAguardando o segundo jogador...`,
        );
      });
    } catch (erro) {
      this.atualizarStatus(erro.message);
    }
  }

  mostrarQrSala(qrCode, codigo, convite) {
    this.removerQrSala();
    if (!qrCode) return;

    const painel = document.createElement("aside");
    painel.className = "room-qr-panel";
    const titulo = document.createElement("strong");
    titulo.textContent = "ESCANEIE PARA ENTRAR";
    const imagem = document.createElement("img");
    imagem.src = qrCode;
    imagem.alt = `QR Code da sala ${codigo}`;
    const codigoTexto = document.createElement("b");
    codigoTexto.textContent = `SALA ${codigo}`;
    const link = document.createElement("small");
    link.textContent = convite;
    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.textContent = "Fechar QR";
    fechar.addEventListener("click", () => this.removerQrSala());
    painel.append(titulo, imagem, codigoTexto, link, fechar);
    document.body.appendChild(painel);
    this.painelQrSala = painel;
  }

  removerQrSala() {
    if (this.painelQrSala) this.painelQrSala.remove();
    this.painelQrSala = null;
  }

  entrarNaSala(codigoInicial = null) {
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Monte e salve um deck válido antes de entrar em uma sala.");
      return;
    }
    const codigo = String(
      codigoInicial || window.prompt("Digite o código de 6 números da sala:") || "",
    ).replace(/\D/g, "");
    if (!codigo) return;
    try {
      this.atualizarStatus(`Entrando na sala ${codigo}...`);
      this.multiplayer.joinRoom(codigo, (resposta) => {
        if (!resposta.ok)
          return this.atualizarStatus(resposta.error || "Não foi possível entrar.");
        this.atualizarStatus("Oponente encontrado. Preparando o duelo...");
      });
    } catch (erro) {
      this.atualizarStatus(erro.message);
    }
  }
}
