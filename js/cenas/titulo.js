class CenaTitulo extends Phaser.Scene {
  constructor() {
    super("CenaTitulo");
  }

  create() {
    configurarCameraLogica(this);
    this.cameras.main.setBackgroundColor("#020409");
    this.multiplayer = window.cyberduelMultiplayer;
    this.account = window.cyberduelAccount;
    window.cyberduelDeckBuilder.setAccountSession(
      this.account?.user,
      this.account?.deck,
      this.account?.collection,
    );
    this.montarInterfaceTitulo();

    this.removerListenerConta = this.account?.onChange(({ user, deck, collection, faction }) => {
      window.cyberduelDeckBuilder.setAccountSession(user, deck, collection);
      if (!this.scene.isActive()) return;
      this.titleUI?.destroy();
      this.montarInterfaceTitulo();
      this.atualizarStatus(
        user
          ? `Conta ${user} conectada. Deck sincronizado com o servidor.`
          : "Sessão local ativa. Entre para sincronizar seu deck.",
        user ? "success" : "info",
      );
      if (user && !faction)
        this.time.delayedCall(0, () => this.titleUI?.openFactionDialog());
    });
    this.account?.restore().then(() => {
      const roomFromLink = new URLSearchParams(location.search).get("room");
      if (roomFromLink && this.scene.isActive()) this.entrarNaSala(roomFromLink);
    });

    this.multiplayer.onStatus = (message) => this.atualizarStatus(message);
    this.multiplayer.onReady = () => this.iniciarPartidaMultiplayer();
    this.events.once("shutdown", () => {
      this.removerListenerConta?.();
      this.titleUI?.destroy();
      this.titleUI = null;
    });

    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus(
        this.account?.user
          ? "Monte e sele seu deck para liberar os modos de combate."
          : "Entre ou crie uma conta para receber sua coleção inicial.",
        "warning",
      );
    }

  }

  montarInterfaceTitulo() {
    this.titleUI = new CyberduelTitleUI({
      deckBuilder: window.cyberduelDeckBuilder,
      account: this.account,
      settings: window.cyberduelSettings,
      callbacks: {
        onSolo: () => this.iniciarPartida(false),
        onCreateRoom: () => this.criarSala(),
        onJoinRoom: (code) => this.entrarNaSala(code),
        onDeck: () => this.scene.start("CenaDeckBuilder"),
      },
    }).mount();
  }

  atualizarStatus(message, tone = "info") {
    this.titleUI?.setStatus(message, tone);
  }

  iniciarPartida(multiplayer) {
    if (!this.account?.user || !this.account?.faction) {
      this.atualizarStatus("Entre e escolha sua facção antes de jogar.", "warning");
      return;
    }
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Um deck válido é obrigatório para jogar.", "warning");
      return;
    }
    if (!multiplayer) this.multiplayer.active = false;
    this.titleUI?.destroy();
    this.titleUI = null;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () =>
      this.scene.start("CenaTransicao"),
    );
  }

  iniciarPartidaMultiplayer() {
    if (this.scene.isActive()) this.iniciarPartida(true);
  }

  criarSala() {
    if (!this.account?.user || !this.account?.faction) {
      this.atualizarStatus("Entre e escolha sua facção antes de criar uma sala.", "warning");
      return;
    }
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Sele um deck antes de criar uma sala.", "warning");
      return;
    }
    try {
      this.atualizarStatus("Gerando link seguro da sala...");
      this.multiplayer.createRoom((response) => {
        if (!response.ok) {
          this.atualizarStatus(
            response.error || "Não foi possível criar a sala.",
            "error",
          );
          return;
        }
        const invite =
          response.inviteUrl ||
          `${location.origin}${location.pathname}?room=${response.room.code}`;
        this.titleUI?.showRoom({
          qrCode: response.qrCode,
          code: response.room.code,
          invite,
        });
        this.atualizarStatus(
          `Sala ${response.room.code} ativa. Aguardando oponente...`,
          "success",
        );
      });
    } catch (error) {
      this.atualizarStatus(error.message, "error");
    }
  }

  entrarNaSala(initialCode) {
    if (!this.account?.user || !this.account?.faction) {
      this.atualizarStatus("Entre e escolha sua facção antes de entrar na sala.", "warning");
      return;
    }
    if (!window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Sele um deck antes de entrar em uma sala.", "warning");
      return;
    }
    const code = this.titleUI
      ? this.titleUI.sanitizeRoomCode(initialCode)
      : String(initialCode || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      this.atualizarStatus("Código de sala inválido.", "error");
      return;
    }
    try {
      this.atualizarStatus(`Conectando à sala ${code}...`);
      this.multiplayer.joinRoom(code, (response) => {
        if (!response.ok) {
          this.atualizarStatus(
            response.error || "Não foi possível entrar na sala.",
            "error",
          );
          return;
        }
        this.atualizarStatus(
          "Oponente encontrado. Preparando o duelo...",
          "success",
        );
      });
    } catch (error) {
      this.atualizarStatus(error.message, "error");
    }
  }
}
