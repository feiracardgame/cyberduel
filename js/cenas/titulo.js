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
    if (window.CYBERDUEL_PRESENTATION) {
      this.montarApresentacao();
      return;
    }
    this.montarInterfaceTitulo();

    this.restaurandoConta = true;
    this.removerListenerConta = this.account?.onChange(({ user, nickname, needsRegistration, deck, collection, faction }) => {
      window.cyberduelDeckBuilder.setAccountSession(user, deck, collection);
      if (!this.scene.isActive()) return;
      this.titleUI?.destroy();
      this.montarInterfaceTitulo();
      this.atualizarStatus(
        user
          ? `Conta ${nickname || "Google"} conectada. Deck sincronizado com o servidor.`
          : "Sessão local ativa. Entre para sincronizar seu deck.",
        user ? "success" : "info",
      );
      if (user && !needsRegistration && faction && new URLSearchParams(location.search).get("ticket"))
        this.time.delayedCall(0, () => this.tentarConviteApresentacao());
      if (needsRegistration)
        this.time.delayedCall(0, () => this.titleUI?.openRegistrationDialog());

    });
    this.account?.restore().then(() => {
      this.restaurandoConta = false;
      const roomFromLink = new URLSearchParams(location.search).get("room");
      if (roomFromLink && this.scene.isActive()) {
        if (new URLSearchParams(location.search).get("ticket")) {
          this.tentarConviteApresentacao();
          return;
        }
        this.entrarNaSala(roomFromLink);
      }
      this.multiplayer.findActiveMatch((response) => {
        if (response.room && this.scene.isActive()) this.titleUI?.showResumeMatch(response.room,
          (done) => this.multiplayer.resumeMatch(done),
          (done) => this.multiplayer.declineMatch(response.room, (result) => {
            if (result.ok) this.atualizarStatus("Você recusou o retorno e perdeu a partida.", "warning");
            done(result);
          }));
      });
    });

    this.multiplayer.onStatus = (message) => this.atualizarStatus(message);
    this.multiplayer.onReady = () => this.iniciarPartidaMultiplayer();
    this.multiplayer.onMatchmakingStopped = (message) => {
      if (this.titleUI?.modal?.dataset.kind === "matchmaking") {
        this.titleUI.closeModal(true);
        this.atualizarStatus(message, "warning");
      }
    };
    this.events.once("shutdown", () => {
      this.telaEsperaArena?.remove();
      this.telaEsperaArena = null;
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

  montarApresentacao() {
    const root = document.createElement("div");
    root.className = "presentation-screen";
    const heading = document.createElement("h1"); heading.textContent = "CYBERDUEL · ARENA";
    const status = document.createElement("p"); status.textContent = "Abra a arena para receber os jogadores.";
    const seats = document.createElement("div"); seats.className = "presentation-seats";
    const start = document.createElement("button"); start.textContent = "ABRIR ARENA";
    const center = document.createElement("header"); center.className = "presentation-center";
    center.append(heading, status, start);
    root.append(seats, center); document.body.append(root);
    const show = response => {
      if (!this.scene.isActive()) return;
      start.disabled = false;
      if (!response.ok) { status.textContent = response.error; start.hidden = false; return; }
      start.hidden = true;
      status.textContent = response.update ? "Duelo iniciado" : "Cada jogador escaneia um QR code e entra com sua conta e seu deck.";
      seats.replaceChildren();
      for (const invite of response.invitations || []) {
        const card = document.createElement("section");
        card.dataset.player = String(invite.player);
        const label = document.createElement("h2");
        const connected = response.seats.find(seat => seat.player === invite.player)?.connected;
        label.textContent = `JOGADOR ${invite.player} · ${connected ? "CONECTADO" : "AGUARDANDO"}`;
        card.append(label);
        if (connected) {
          const name = document.createElement("p"); name.textContent = `${response.nicknames[invite.player]} · Aguardando o outro jogador…`; card.append(name);
        } else {
          const image = document.createElement("img"); image.src = invite.qrCode; image.alt = `QR code do jogador ${invite.player}`;
          const link = document.createElement("a"); link.href = invite.url; link.textContent = invite.url;
          card.append(image, link);
        }
        seats.append(card);
      }
    };
    this.multiplayer.onReady = () => { if (this.scene.isActive()) this.scene.start("CenaJogo"); };
    this.multiplayer.onStatus = message => { status.textContent = message; };
    start.onclick = () => {
      start.disabled = true;
      document.documentElement.requestFullscreen?.().catch(() => {});
      this.multiplayer.createPresentation(show);
    };
    this.events.once("shutdown", () => { root.remove(); });
    try {
      if (window.sessionStorage?.getItem("cyberduel.presentationRoom")) this.multiplayer.createPresentation(show);
    } catch {}
  }

  tentarConviteApresentacao() {
    if (!this.scene.isActive() || this.restaurandoConta || this.entrandoPorConvite || this.multiplayer.room) return;
    const code = new URLSearchParams(location.search).get("room");
    if (!code) return;
    if (this.account?.needsRegistration || !this.account?.faction || !window.cyberduelDeckBuilder.getSavedDeck()) {
      this.atualizarStatus("Entre na conta, escolha sua facção e sele um deck para entrar na arena.", "warning");
      return;
    }
    this.entrandoPorConvite = true;
    this.multiplayer.findActiveMatch(response => {
      this.entrandoPorConvite = false;
      if (!this.scene.isActive()) return;
      if (response.room === code) this.multiplayer.resumeMatch(result => {
        if (!result.ok) this.atualizarStatus(result.error, "error");
      });
      else this.entrarNaSala(code);
    });
  }

  montarInterfaceTitulo() {
    this.titleUI = new CyberduelTitleUI({
      deckBuilder: window.cyberduelDeckBuilder,
      account: this.account,
      settings: window.cyberduelSettings,
      callbacks: {
        onSolo: () => this.iniciarPartida(false),
        onMatchmaking: () => this.titleUI.openMatchmaking(this.multiplayer),
        onCreateRoom: () => this.criarSala(),
        onJoinRoom: (code) => this.entrarNaSala(code),
        onSpectate: (code) => this.multiplayer.spectateRoom(code, (response) => {
          if (!response.ok) this.atualizarStatus(response.error, "error");
        }),
        onDeck: () => this.scene.start("CenaDeckBuilder"),
      },
    }).mount();
  }

  atualizarStatus(message, tone = "info") {
    this.titleUI?.setStatus(message, tone);
  }

  iniciarPartida(multiplayer) {
    if (multiplayer && this.multiplayer.initialized) {
      this.titleUI?.destroy(); this.titleUI = null;
      this.scene.start((this.multiplayer.ranked || this.multiplayer.arena) ? "CenaJogo" : "CenaTransicao");
      return;
    }
    if (!this.account?.user || this.account.needsRegistration || !this.account?.faction) {
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
    if (!this.scene.isActive()) return;
    this.telaEsperaArena?.remove();
    this.telaEsperaArena = null;
    if (this.multiplayer.needsIntroduction) {
      this.multiplayer.needsIntroduction = false;
      this.titleUI.showVersus(this.multiplayer.profiles, this.multiplayer.player, () => {
        if (this.scene.isActive()) this.iniciarPartida(true);
      });
    } else this.iniciarPartida(true);
  }

  criarSala() {
    if (!this.account?.user || this.account.needsRegistration || !this.account?.faction) {
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

  mostrarEsperaArena(player) {
    this.telaEsperaArena?.remove();
    const root = document.createElement("section"); root.className = "arena-waiting";
    root.setAttribute("role", "status"); root.setAttribute("aria-live", "polite");
    const title = document.createElement("h1"); title.textContent = "CONECTADO";
    const seat = document.createElement("p"); seat.textContent = `Você é o jogador ${player}`;
    const message = document.createElement("h2"); message.textContent = "Aguardando o outro jogador…";
    const note = document.createElement("p"); note.textContent = "O duelo começa automaticamente quando os dois estiverem conectados.";
    const leave = document.createElement("button"); leave.textContent = "SAIR DA SALA";
    leave.onclick = () => {
      this.multiplayer.leaveRoom(); root.remove(); this.telaEsperaArena = null;
      this.atualizarStatus("Você saiu da arena.");
    };
    root.append(title, seat, message, note, leave); document.body.append(root);
    this.telaEsperaArena = root;
  }

  entrarNaSala(initialCode) {
    if (!this.account?.user || this.account.needsRegistration || !this.account?.faction) {
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
      this.entrandoPorConvite = true;
      this.multiplayer.joinRoom(code, (response) => {
        this.entrandoPorConvite = false;
        if (!response.ok) {
          this.atualizarStatus(
            response.error || "Não foi possível entrar na sala.",
            "error",
          );
          return;
        }
        if (response.waiting) this.mostrarEsperaArena(response.player);
        this.atualizarStatus(
          response.waiting ? "Você está conectado. Aguardando o outro jogador..." : "Oponente encontrado. Preparando o duelo...",
          "success",
        );
      });
    } catch (error) {
      this.atualizarStatus(error.message, "error");
    }
  }
}
