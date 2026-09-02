class CyberduelTitleUI {
  constructor({ deckBuilder, callbacks }) {
    this.deckBuilder = deckBuilder;
    this.callbacks = callbacks;
    this.modal = null;
    this.handleKeydown = (event) => {
      if (event.key === "Escape") this.closeModal();
    };
  }

  element(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  button(className, label, handler, ariaLabel = label) {
    const button = this.element("button", className);
    button.type = "button";
    button.setAttribute("aria-label", ariaLabel);
    if (label) button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  deckSummary() {
    const deck = this.deckBuilder.getSavedDeck();
    const status = this.deckBuilder.status(deck || []);
    return { ...status, deckReady: Boolean(deck) };
  }

  sanitizeRoomCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 6);
  }

  mount() {
    document.body.classList.add("title-terminal-open");
    this.root = this.element("main", "title-terminal");
    this.root.setAttribute("aria-label", "Menu principal Cyberduel");

    const atmosphere = this.element("div", "title-atmosphere");
    atmosphere.setAttribute("aria-hidden", "true");
    atmosphere.append(
      this.element("div", "title-grid"),
      this.element("div", "title-scanlines"),
    );

    const shell = this.element("div", "title-shell");
    shell.append(
      this.createTopbar(),
      this.createHero(),
      this.createDeckTelemetry(),
      this.createActions(),
      this.createStatusBar(),
    );
    this.root.append(atmosphere, shell);
    document.body.appendChild(this.root);
    document.addEventListener("keydown", this.handleKeydown);
    requestAnimationFrame(() => this.root.classList.add("is-ready"));
    return this;
  }

  createTopbar() {
    const topbar = this.element("header", "title-topbar");
    const system = this.element("div", "title-system-id");
    system.append(
      this.element("span", "title-system-id__mark", "CD"),
      this.element("span", "", "NEOFLORIPA OS"),
    );
    const online = this.element("div", "title-online");
    online.append(
      this.element("span", "title-online__dot"),
      this.element("span", "", "REDE ATIVA"),
    );
    topbar.append(system, online);
    return topbar;
  }

  createHero() {
    const hero = this.element("section", "title-hero");
    hero.append(this.element("span", "title-kicker", "SIMULAÇÃO // 2067"));
    const logo = this.element("h1", "title-logo");
    logo.append(
      this.element("span", "title-logo__cyber", "CYBER"),
      this.element("span", "title-logo__duel", "DUEL"),
    );
    hero.append(
      logo,
      this.element("p", "title-manifesto", "AUDIÊNCIA É PODER"),
      this.element("div", "title-signal"),
    );
    return hero;
  }

  createDeckTelemetry() {
    const summary = this.deckSummary();
    const panel = this.element(
      "section",
      `title-loadout${summary.deckReady ? " is-ready" : " is-locked"}`,
    );
    const levels = this.element("div", "title-loadout__levels");
    if (summary.deckReady) {
      [["B", summary.composition.baixa], ["M", summary.composition.media], ["A", summary.composition.alta]].forEach(([label, value]) => {
        const level = this.element("span");
        level.append(this.element("small", "", label), this.element("strong", "", String(value)));
        levels.append(level);
      });
    } else {
      levels.append(this.element("span", "title-loadout__lock", "LOCKED"));
    }
    panel.append(levels);
    return panel;
  }

  createActions() {
    const summary = this.deckSummary();
    const actions = this.element("section", "title-actions");
    actions.append(this.createAction({
      className: "title-action title-action--solo",
      kicker: "BATALHA LOCAL",
      title: "JOGAR SOLO",
      description: "Enfrente a simulação tática",
      icon: "▶",
      disabled: !summary.deckReady,
      handler: this.callbacks.onSolo,
    }));

    const multiplayer = this.element("div", "title-multiplayer");
    multiplayer.append(
      this.createAction({
        className: "title-action title-action--compact",
        kicker: "HOSPEDAR",
        title: "CRIAR SALA",
        description: "Convide por QR",
        icon: "+",
        disabled: !summary.deckReady,
        handler: this.callbacks.onCreateRoom,
      }),
      this.createAction({
        className: "title-action title-action--compact",
        kicker: "CONECTAR",
        title: "ENTRAR",
        description: "Use um código",
        icon: "↗",
        disabled: !summary.deckReady,
        handler: () => this.openJoinDialog(this.callbacks.onJoinRoom),
      }),
    );
    actions.append(multiplayer);

    actions.append(this.createAction({
      className: "title-action title-action--deck",
      kicker: "LOADOUT",
      title: summary.deckReady ? "EDITAR MEU DECK" : "MONTAR MEU DECK",
      description: summary.deckReady ? "Ajuste sua estratégia" : "Obrigatório para entrar em combate",
      icon: "▦",
      handler: this.callbacks.onDeck,
    }));
    return actions;
  }

  createAction({ className, kicker, title, description, icon, disabled, handler }) {
    const button = this.button(className, "", handler, title);
    button.disabled = Boolean(disabled);
    const copy = this.element("span", "title-action__copy");
    copy.append(
      this.element("small", "", kicker),
      this.element("strong", "", title),
      this.element("span", "", description),
    );
    button.append(
      this.element("span", "title-action__icon", icon),
      copy,
      this.element("span", "title-action__arrow", "›"),
    );
    return button;
  }

  createStatusBar() {
    this.statusBar = this.element("footer", "title-status");
    this.statusBar.append(
      this.element("span", "title-status__pulse"),
      this.element("span", "title-status__label", "SISTEMA"),
    );
    this.statusText = this.element("span", "title-status__text", "Pronto para iniciar.");
    this.statusBar.append(this.statusText);
    return this.statusBar;
  }

  setStatus(message, tone = "info") {
    if (!this.statusText) return;
    this.statusText.textContent = String(message || "Pronto para iniciar.");
    this.statusBar.dataset.tone = tone;
  }

  openJoinDialog(onSubmit) {
    if (this.modal) return;
    const overlay = this.createModal("join");
    const dialog = this.element("section", "title-dialog title-join-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "LINK DE DUELO"),
      this.element("h2", "", "Entrar na sala"),
      this.element("p", "", "Digite os seis números enviados pelo outro duelista."),
    );
    const input = this.element("input", "title-room-input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "one-time-code";
    input.maxLength = 6;
    input.placeholder = "000000";
    input.setAttribute("aria-label", "Código da sala");
    const error = this.element("span", "title-dialog__error");
    input.addEventListener("input", () => {
      input.value = this.sanitizeRoomCode(input.value);
      error.textContent = "";
    });
    const actions = this.element("div", "title-dialog__actions");
    actions.append(
      this.button("title-dialog__cancel", "CANCELAR", () => this.closeModal()),
      this.button("title-dialog__confirm", "CONECTAR", () => {
        const code = this.sanitizeRoomCode(input.value);
        if (code.length !== 6) {
          error.textContent = "O código precisa ter 6 números.";
          input.focus();
          return;
        }
        this.closeModal();
        onSubmit(code);
      }),
    );
    dialog.append(input, error, actions);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    setTimeout(() => input.focus(), 50);
  }

  showRoom({ qrCode, code, invite }) {
    this.closeModal(true);
    const overlay = this.createModal("room");
    const dialog = this.element("section", "title-dialog title-room-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "SALA CRIADA"),
      this.element("h2", "", `CÓDIGO ${code}`),
      this.element("p", "", "Peça ao oponente para escanear o QR ou enviar o código."),
    );
    if (qrCode) {
      const image = this.element("img", "title-room-dialog__qr");
      image.src = qrCode;
      image.alt = `QR Code da sala ${code}`;
      dialog.append(image);
    }
    const codeDisplay = this.element("div", "title-room-dialog__code", code);
    const actions = this.element("div", "title-dialog__actions");
    const copy = this.button("title-dialog__cancel", "COPIAR LINK", async () => {
      try {
        await navigator.clipboard.writeText(invite);
        copy.textContent = "LINK COPIADO";
      } catch {
        copy.textContent = "USE O CÓDIGO";
      }
    });
    actions.append(copy, this.button("title-dialog__confirm", "FECHAR", () => this.closeModal()));
    dialog.append(codeDisplay, actions);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  createModal(kind) {
    const overlay = this.element("div", "title-modal");
    overlay.dataset.kind = kind;
    this.root.append(overlay);
    this.modal = overlay;
    return overlay;
  }

  closeModal(immediate = false) {
    if (!this.modal) return;
    const modal = this.modal;
    this.modal = null;
    modal.classList.remove("is-visible");
    if (immediate) modal.remove();
    else setTimeout(() => modal.remove(), 180);
  }

  destroy() {
    document.removeEventListener("keydown", this.handleKeydown);
    document.body.classList.remove("title-terminal-open");
    this.root?.remove();
    this.root = null;
    this.modal = null;
  }
}
