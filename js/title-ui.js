class CyberduelTitleUI {
  constructor({ deckBuilder, account = null, settings = null, callbacks }) {
    this.deckBuilder = deckBuilder;
    this.account = account;
    this.settings = settings || window.cyberduelSettings || null;
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
    const identityReady = this.account
      ? Boolean(this.account.user && this.account.faction)
      : true;
    return { ...status, deckReady: Boolean(deck) && identityReady };
  }

  sanitizeRoomCode(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 6);
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
    const mountedRoot = this.root;
    requestAnimationFrame(() => {
      if (!mountedRoot || !mountedRoot.isConnected || this.root !== mountedRoot)
        return;
      mountedRoot.classList.add("is-ready");
    });
    this.settings?.queueDomTextUpdate(this.root);
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
    const accountButton = this.button(
      "title-account",
      this.account?.user
        ? `◉ ${this.account.user} // SAIR`
        : "IDENTIFICAR // ENTRAR",
      () => {
        if (this.account?.user) this.account.logout();
        else this.openAuthDialog();
      },
      this.account?.user ? "Sair da conta" : "Entrar ou criar conta",
    );
    const balance = this.element(
      "span",
      "title-balance",
      this.account?.user ? `▰ ${this.account.currency} TIJOLINHOS` : "",
    );
    const settingsButton = this.button(
      "title-settings-button",
      "⚙",
      () => this.openSettingsDialog(),
      "Abrir configurações",
    );
    topbar.append(system, online, balance, settingsButton, accountButton);
    return topbar;
  }

  openSettingsDialog() {
    if (this.modal || !this.settings) return;
    const overlay = this.createModal("settings");
    const dialog = this.element(
      "section",
      "title-dialog title-settings-dialog",
    );
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "PAINEL DO OPERADOR"),
      this.element("h2", "", "Configurações"),
      this.element(
        "p",
        "",
        "Ajustes salvos neste aparelho e aplicados automaticamente.",
      ),
    );

    const controls = this.element("div", "title-settings-controls");
    const createRange = ({ key, label, minimum = 0, maximum = 100 }) => {
      const row = this.element("label", "title-setting");
      const heading = this.element("span", "title-setting__heading");
      const value = this.element("strong", "title-setting__value");
      const input = this.element("input", "title-setting__range");
      input.type = "range";
      input.min = String(minimum);
      input.max = String(maximum);
      input.step = "1";
      input.value = String(Math.round(this.settings.get(key) * 100));
      const updateLabel = () => {
        value.textContent = `${input.value}%`;
      };
      updateLabel();
      input.addEventListener("input", () => {
        this.settings.set(key, Number(input.value) / 100);
        updateLabel();
        this.settings.applyDomTextScale(this.root);
      });
      heading.append(this.element("span", "", label), value);
      row.append(heading, input);
      controls.append(row);
      return input;
    };

    const ranges = [
      createRange({ key: "masterVolume", label: "VOLUME GERAL" }),
      createRange({ key: "musicVolume", label: "MÚSICA" }),
      createRange({ key: "effectsVolume", label: "EFEITOS" }),
      createRange({
        key: "textScale",
        label: "ESCALA DOS TEXTOS",
        minimum: 100,
        maximum: 135,
      }),
    ];
    const actions = this.element(
      "div",
      "title-dialog__actions title-dialog__actions--triple",
    );
    const adminButton = this.button(
      "title-dialog__cancel",
      "ADMIN CARTAS",
      () => {
        this.closeModal(true);
        this.openAdminGrantDialog();
      },
    );
    adminButton.disabled = !this.account?.user;
    actions.append(adminButton);
    actions.append(
      this.button("title-dialog__cancel", "RESTAURAR", () => {
        this.settings.reset();
        const keys = [
          "masterVolume",
          "musicVolume",
          "effectsVolume",
          "textScale",
        ];
        ranges.forEach((input, index) => {
          input.value = String(
            Math.round(this.settings.get(keys[index]) * 100),
          );
          input.dispatchEvent(new Event("input"));
        });
      }),
      this.button("title-dialog__confirm", "CONCLUIR", () => this.closeModal()),
    );
    dialog.append(controls, actions);
    overlay.append(dialog);
    this.settings.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  openAdminGrantDialog() {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("admin-grant");
    const dialog = this.element("section", "title-dialog title-admin-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "ADMIN // GERENCIAR COLECOES"),
      this.element("h2", "", "Conceder cartas"),
      this.element(
        "p",
        "",
        "Adicione cartas por username. Pode conceder deck completo por facção ou carta avulsa.",
      ),
    );

    const form = this.element("div", "title-admin-grid");
    const username = this.element("input", "title-auth-input");
    username.type = "text";
    username.placeholder = "USERNAME";
    username.value = this.account.user || "";
    username.maxLength = 24;
    username.setAttribute("aria-label", "Username da conta");

    const adminToken = this.element("input", "title-auth-input");
    adminToken.type = "text";
    adminToken.placeholder = "ADMIN TOKEN (OPCIONAL)";
    adminToken.value = String(window.CYBERDUEL_ADMIN_TOKEN || "");
    adminToken.maxLength = 256;
    adminToken.setAttribute("aria-label", "Token administrativo");

    const deckSection = this.element("section", "title-admin-section");
    deckSection.append(
      this.element("h3", "", "Deck completo por facção"),
      this.element(
        "p",
        "title-admin-note",
        "Concede 20 cartas da facção escolhida para o username.",
      ),
    );
    const faction = this.element("select", "title-auth-input");
    faction.setAttribute("aria-label", "Facção do deck concedido");
    [
      ["raspcorp", "RASPCORP"],
      ["echossystem", "ECHOSSYSTEM"],
      ["humbanet", "HUMBANET"],
      ["sindicato", "SINDICATO"],
      ["remanescentes", "REMANESCENTES"],
    ].forEach(([value, label]) => {
      const option = this.element("option", "", label);
      option.value = value;
      faction.append(option);
    });
    deckSection.append(faction);

    const cardSection = this.element("section", "title-admin-section");
    cardSection.append(
      this.element("h3", "", "Carta avulsa"),
      this.element(
        "p",
        "title-admin-note",
        "Concede uma carta específica com quantidade personalizada.",
      ),
    );
    const cardType = this.element("select", "title-auth-input");
    cardType.setAttribute("aria-label", "Tipo da carta");
    [
      ["monstro", "MONSTRO"],
      ["efeito", "EFEITO"],
      ["terreno", "TERRENO"],
    ].forEach(([value, label]) => {
      const option = this.element("option", "", label);
      option.value = value;
      cardType.append(option);
    });
    const cardName = this.element("input", "title-auth-input");
    cardName.type = "text";
    cardName.placeholder = "NOME EXATO DA CARTA";
    cardName.maxLength = 120;
    cardName.setAttribute("aria-label", "Nome da carta");
    const cardQuantity = this.element("input", "title-auth-input");
    cardQuantity.type = "number";
    cardQuantity.min = "1";
    cardQuantity.max = "20";
    cardQuantity.step = "1";
    cardQuantity.value = "1";
    cardQuantity.setAttribute("aria-label", "Quantidade");
    cardSection.append(cardType, cardName, cardQuantity);

    const error = this.element("span", "title-dialog__error");
    const result = this.element("p", "title-admin-result");
    const actionButtons = this.element(
      "div",
      "title-dialog__actions title-dialog__actions--triple",
    );

    const toggleBusy = (busy) => {
      [username, adminToken, faction, cardType, cardName, cardQuantity].forEach(
        (field) => (field.disabled = busy),
      );
      [...actionButtons.children].forEach((button) => (button.disabled = busy));
    };

    const withUsername = () => {
      const value = String(username.value || "").trim();
      if (!value) {
        error.textContent = "Informe o username da conta.";
        username.focus();
        return null;
      }
      return value;
    };

    const grantDeck = async () => {
      error.textContent = "";
      result.textContent = "";
      const target = withUsername();
      if (!target) return;
      toggleBusy(true);
      try {
        const payload = await this.account.grantCardsByUsername(target, [], {
          fullDeck: true,
          faction: faction.value,
          adminToken: adminToken.value,
        });
        const total = (payload.granted || []).reduce(
          (sum, entry) => sum + (Number(entry.quantidade) || 0),
          0,
        );
        result.textContent = `Deck concedido para ${target}: ${total} cartas.`;
      } catch (exception) {
        error.textContent = exception.message || "Falha ao conceder deck.";
      } finally {
        toggleBusy(false);
      }
    };

    const grantSingleCard = async () => {
      error.textContent = "";
      result.textContent = "";
      const target = withUsername();
      if (!target) return;
      const name = String(cardName.value || "").trim();
      if (!name) {
        error.textContent = "Informe o nome da carta.";
        cardName.focus();
        return;
      }
      const amount = Math.max(
        1,
        Math.min(20, Math.floor(Number(cardQuantity.value) || 0)),
      );
      toggleBusy(true);
      try {
        await this.account.grantCardsByUsername(
          target,
          [{ tipo: cardType.value, nome: name, quantidade: amount }],
          {
            adminToken: adminToken.value,
          },
        );
        result.textContent = `Carta concedida para ${target}: ${cardType.value} / ${name} x${amount}.`;
      } catch (exception) {
        error.textContent = exception.message || "Falha ao conceder carta.";
      } finally {
        toggleBusy(false);
      }
    };

    actionButtons.append(
      this.button("title-dialog__cancel", "DECK FACCAO", grantDeck),
      this.button("title-dialog__confirm", "CARTA AVULSA", grantSingleCard),
      this.button("title-dialog__cancel", "VOLTAR", () => this.closeModal()),
    );

    form.append(username, adminToken, deckSection, cardSection);
    dialog.append(form, result, error, actionButtons);
    overlay.append(dialog);
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    setTimeout(() => username.focus(), 50);
  }

  openAuthDialog() {
    if (this.modal || !this.account) return;
    const overlay = this.createModal("auth");
    const dialog = this.element("section", "title-dialog title-auth-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "IDENTIDADE DE REDE"),
      this.element("h2", "", "Acessar conta"),
      this.element(
        "p",
        "",
        "Seu deck fica salvo no servidor e acompanha você em qualquer dispositivo.",
      ),
    );
    const username = this.element("input", "title-auth-input");
    username.type = "text";
    username.autocomplete = "username";
    username.placeholder = "USUÁRIO";
    username.maxLength = 24;
    username.setAttribute("aria-label", "Usuário");
    const password = this.element("input", "title-auth-input");
    password.type = "password";
    password.autocomplete = "current-password";
    password.placeholder = "SENHA (MÍNIMO 6)";
    password.maxLength = 128;
    password.setAttribute("aria-label", "Senha");
    const error = this.element("span", "title-dialog__error");
    const actions = this.element("div", "title-dialog__actions");
    const submit = async (mode) => {
      error.textContent = "";
      if (username.value.trim().length < 3 || password.value.length < 6) {
        error.textContent =
          "Use um usuário com 3 caracteres e senha com pelo menos 6.";
        return;
      }
      [...actions.children].forEach((button) => (button.disabled = true));
      try {
        await this.account[mode](username.value.trim(), password.value);
        this.closeModal(true);
      } catch (exception) {
        error.textContent = exception.message || "Não foi possível autenticar.";
        [...actions.children].forEach((button) => (button.disabled = false));
      }
    };
    actions.append(
      this.button("title-dialog__cancel", "CRIAR CONTA", () =>
        submit("register"),
      ),
      this.button("title-dialog__confirm", "ENTRAR", () => submit("login")),
    );
    password.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit("login");
    });
    dialog.append(username, password, error, actions);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    setTimeout(() => username.focus(), 50);
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
      [
        ["B", summary.composition.baixa],
        ["M", summary.composition.media],
        ["A", summary.composition.alta],
      ].forEach(([label, value]) => {
        const level = this.element("span");
        level.append(
          this.element("small", "", label),
          this.element("strong", "", String(value)),
        );
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
    actions.append(
      this.createAction({
        className: "title-action title-action--solo",
        kicker: "BATALHA LOCAL",
        title: "JOGAR SOLO",
        description: "Enfrente a simulação tática",
        icon: "▶",
        disabled: !summary.deckReady,
        handler: this.callbacks.onSolo,
      }),
    );

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

    actions.append(
      this.createAction({
        className: "title-action title-action--booster",
        kicker: "MERCADO DE CARTAS",
        title: "ABRIR BOOSTERS",
        description: this.account?.user
          ? `${this.account.currency} tijolinhos disponíveis`
          : "Entre em uma conta para acessar",
        icon: "✦",
        disabled: !this.account?.user || !this.account?.faction,
        handler: () => this.openBoosterShop(),
      }),
    );

    actions.append(
      this.createAction({
        className: "title-action title-action--deck",
        kicker: "LOADOUT",
        title: summary.deckReady ? "EDITAR MEU DECK" : "MONTAR MEU DECK",
        description: !this.account?.user
          ? "Entre para acessar sua coleção"
          : summary.deckReady
            ? "Ajuste sua estratégia"
            : "Obrigatório para entrar em combate",
        icon: "▦",
        handler: () => {
          if (!this.account?.user) this.openAuthDialog();
          else if (!this.account.faction) this.openFactionDialog();
          else this.callbacks.onDeck();
        },
      }),
    );
    return actions;
  }

  createAction({
    className,
    kicker,
    title,
    description,
    icon,
    disabled,
    handler,
  }) {
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
    this.statusText = this.element(
      "span",
      "title-status__text",
      "Pronto para iniciar.",
    );
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
      this.element(
        "p",
        "",
        "Digite os seis números enviados pelo outro duelista.",
      ),
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

  openFactionDialog() {
    if (this.modal || !this.account?.user || this.account.faction) return;
    const overlay = this.createModal("faction");
    this.modalRequired = true;
    const dialog = this.element("section", "title-dialog title-faction-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "PROTOCOLO DE ALIANÇA"),
      this.element("h2", "", "Escolha sua facção inicial"),
      this.element(
        "p",
        "",
        "A escolha concede imediatamente o deck oficial completo da facção. Ela é permanente para esta conta.",
      ),
    );
    const error = this.element("span", "title-dialog__error");
    const choices = this.element("div", "title-faction-choices");
    const choose = async (faction) => {
      [...choices.children].forEach((button) => (button.disabled = true));
      try {
        await this.account.chooseFaction(faction);
      } catch (exception) {
        error.textContent =
          exception.message || "Não foi possível escolher a facção.";
        [...choices.children].forEach((button) => (button.disabled = false));
      }
    };
    choices.append(
      this.createFactionChoice(
        "raspcorp",
        "RASPCORP",
        "Crescimento, controle e construção de PA.",
        () => choose("raspcorp"),
      ),
      this.createFactionChoice(
        "echossystem",
        "ECHOSSYSTEM",
        "Infiltração, mobilidade e redução de PA.",
        () => choose("echossystem"),
      ),
    );
    dialog.append(choices, error);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  createFactionChoice(faction, title, description, handler) {
    const button = this.button(
      `title-faction title-faction--${faction}`,
      "",
      handler,
      `Escolher ${title}`,
    );
    button.append(
      this.element("strong", "", title),
      this.element("span", "", description),
      this.element("small", "", "RECEBER DECK DE 20 CARTAS  ›"),
    );
    return button;
  }

  openBoosterShop() {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("boosters");
    const dialog = this.element("section", "title-dialog title-booster-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const balance = this.element(
      "strong",
      "title-booster-balance",
      `${this.account.currency} TIJOLINHOS`,
    );
    dialog.append(
      this.element("span", "title-kicker", "MERCADO // BOOSTER VAULT"),
      this.element("h2", "", "Comprar booster"),
      this.element(
        "p",
        "",
        `Cada compra concede um deck completo de 20 cartas da facção escolhida e custa ${this.account.boosterPrice} tijolinhos.`,
      ),
      balance,
    );
    const results = this.element("div", "title-booster-results");
    const shop = this.element("div", "title-booster-shop");
    const error = this.element("span", "title-dialog__error");
    const buy = async (faction) => {
      [...shop.children].forEach((button) => (button.disabled = true));
      error.textContent = "";
      try {
        const cards = await this.account.openBooster(faction);
        balance.textContent = `${this.account.currency} TIJOLINHOS`;
        results.replaceChildren(
          ...cards.map((card) => this.createBoosterResult(card)),
        );
      } catch (exception) {
        error.textContent = exception.message || "Falha ao abrir booster.";
      } finally {
        [...shop.children].forEach((button) => {
          button.disabled = this.account.currency < this.account.boosterPrice;
        });
      }
    };
    shop.append(
      this.createFactionChoice(
        "raspcorp",
        "BOOSTER RASPCORP",
        "Deck completo da facção",
        () => buy("raspcorp"),
      ),
      this.createFactionChoice(
        "echossystem",
        "BOOSTER ECHOSSYSTEM",
        "Deck completo da facção",
        () => buy("echossystem"),
      ),
    );
    const close = this.button("title-dialog__confirm", "VOLTAR AO MENU", () => {
      this.closeModal(true);
      this.account.notify();
    });
    dialog.append(shop, results, error, close);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  createBoosterResult(card) {
    const model = this.deckBuilder
      .getCatalogByKey()
      .get(`${card.tipo}:${card.nome}`);
    const item = this.element("article", "title-booster-card");
    if (model?.imagem && window.CYBERDUEL_IMAGE_ASSETS?.[model.imagem]) {
      const image = this.element("img");
      image.src = window.CYBERDUEL_IMAGE_ASSETS[model.imagem];
      image.alt = card.nome;
      item.append(image);
    }
    item.append(
      this.element(
        "small",
        "",
        `${String(card.nivel || card.tipo).toUpperCase()} · x${Math.max(1, Number(card.quantidade) || 1)}`,
      ),
      this.element("strong", "", card.nome),
    );
    return item;
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
      this.element(
        "p",
        "",
        "Peça ao oponente para escanear o QR ou enviar o código.",
      ),
    );
    if (qrCode) {
      const image = this.element("img", "title-room-dialog__qr");
      image.src = qrCode;
      image.alt = `QR Code da sala ${code}`;
      dialog.append(image);
    }
    const codeDisplay = this.element("div", "title-room-dialog__code", code);
    const actions = this.element("div", "title-dialog__actions");
    const copy = this.button(
      "title-dialog__cancel",
      "COPIAR LINK",
      async () => {
        try {
          await navigator.clipboard.writeText(invite);
          copy.textContent = "LINK COPIADO";
        } catch {
          copy.textContent = "USE O CÓDIGO";
        }
      },
    );
    actions.append(
      copy,
      this.button("title-dialog__confirm", "FECHAR", () => this.closeModal()),
    );
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
    if (this.modalRequired && !immediate) return;
    const modal = this.modal;
    this.modal = null;
    this.modalRequired = false;
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
