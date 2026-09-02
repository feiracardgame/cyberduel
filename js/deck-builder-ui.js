class CyberduelDeckBuilderUI {
  constructor({ scene, builder, onExit }) {
    this.scene = scene;
    this.builder = builder;
    this.onExit = onExit;
    this.catalog = builder.getCatalog();
    this.deck = (builder.getSavedDeck() || []).map((entry) => ({ ...entry }));
    this.filter = "todos";
    this.order = "crescente";
    this.query = "";
    this.mobileView = "collection";
    this.dirty = false;
    this.modal = null;
    this.handleKeydown = (event) => this.onKeydown(event);
  }

  element(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  button(className, label, handler, ariaLabel = label) {
    const button = this.element("button", className, label);
    button.type = "button";
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", handler);
    return button;
  }

  mount() {
    document.body.classList.add("deck-forge-open");
    this.root = this.element("main", "deck-forge");
    this.root.setAttribute("aria-label", "Montador de deck Cyberduel");

    const atmosphere = this.element("div", "forge-atmosphere");
    atmosphere.setAttribute("aria-hidden", "true");
    atmosphere.append(
      this.element("div", "forge-orb forge-orb--cyan"),
      this.element("div", "forge-orb forge-orb--violet"),
      this.element("div", "forge-grid"),
      this.element("div", "forge-scanlines"),
    );

    const shell = this.element("div", "forge-shell");
    shell.append(this.createHeader());
    shell.append(this.createMobileStatus());
    const workspace = this.element("div", "forge-workspace");
    this.collectionPanel = this.element("section", "forge-collection");
    this.collectionPanel.setAttribute("aria-label", "Coleção de cartas");
    this.collectionPanel.append(this.createCollectionToolbar());
    this.collectionGrid = this.element("div", "forge-card-grid");
    this.collectionGrid.setAttribute("aria-live", "polite");
    this.collectionPanel.append(this.collectionGrid);
    this.deckPanel = this.element("aside", "forge-deck-panel");
    this.deckPanel.setAttribute("aria-label", "Seu deck");
    workspace.append(this.collectionPanel, this.deckPanel);
    shell.append(workspace);
    this.root.append(atmosphere, shell, this.createMobileDock());
    document.body.appendChild(this.root);
    document.addEventListener("keydown", this.handleKeydown);
    requestAnimationFrame(() => this.root.classList.add("is-ready"));
    this.render();
  }

  createMobileStatus() {
    this.mobileStatus = this.element("section", "forge-mobile-status");
    this.mobileStatus.setAttribute("aria-label", "Resumo do deck");
    return this.mobileStatus;
  }

  createMobileDock() {
    const dock = this.element("nav", "forge-mobile-dock");
    dock.setAttribute("aria-label", "Navegação do montador");
    this.mobileCollectionButton = this.button(
      "forge-mobile-dock__button is-active",
      "",
      () => this.showMobileView("collection"),
      "Abrir coleção",
    );
    this.mobileCollectionButton.append(
      this.element("span", "forge-mobile-dock__icon", "▦"),
      this.element("strong", "", "CARTAS"),
    );
    this.mobileDeckButton = this.button(
      "forge-mobile-dock__button forge-mobile-dock__button--deck",
      "",
      () => this.showMobileView("deck"),
      "Abrir meu deck",
    );
    this.mobileDeckButton.append(
      this.element("span", "forge-mobile-dock__count", "0"),
      this.element("strong", "", "MEU DECK"),
    );
    dock.append(this.mobileCollectionButton, this.mobileDeckButton);
    return dock;
  }

  createHeader() {
    const header = this.element("header", "forge-header");
    const back = this.button("forge-icon-button forge-back", "←", () =>
      this.tryExit(), "Voltar ao menu");
    const identity = this.element("div", "forge-identity");
    const title = this.element("h1", "forge-title");
    title.append(
      this.element("span", "forge-title__main", "DECK"),
      this.element("span", "forge-title__accent", "FORGE"),
    );
    identity.append(
      this.element("span", "forge-overline", "CYBERDUEL // ARSENAL"),
      title,
      this.element("p", "forge-subtitle", "Construa sua estratégia. Domine a audiência."),
    );
    this.saveState = this.element("div", "forge-save-state");
    this.saveState.append(
      this.element("span", "forge-save-state__dot"),
      this.element("span", "forge-save-state__text", "Sincronizado"),
    );
    header.append(back, identity, this.saveState);
    return header;
  }

  createCollectionToolbar() {
    const toolbar = this.element("div", "forge-toolbar");
    const headingRow = this.element("div", "forge-toolbar__heading");
    const heading = this.element("div");
    heading.append(
      this.element("span", "forge-kicker", "BANCO DE DADOS"),
      this.element("h2", "forge-section-title", "Coleção"),
    );
    this.resultCount = this.element("span", "forge-result-count");
    headingRow.append(heading, this.resultCount);

    const searchWrap = this.element("label", "forge-search");
    searchWrap.append(this.element("span", "forge-search__icon", "⌕"));
    this.searchInput = this.element("input", "forge-search__input");
    this.searchInput.type = "search";
    this.searchInput.placeholder = "Buscar carta, efeito, facção...";
    this.searchInput.setAttribute("aria-label", "Buscar na coleção");
    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput.value;
      this.renderCollection();
    });
    searchWrap.append(this.searchInput);

    const controls = this.element("div", "forge-controls");
    this.filters = this.element("div", "forge-filters");
    this.filters.setAttribute("role", "group");
    this.filters.setAttribute("aria-label", "Filtrar tipo de carta");
    [
      ["todos", "Todas", "✦"],
      ["monstro", "Personagens", "◈"],
      ["efeito", "Efeitos", "ϟ"],
      ["terreno", "Terrenos", "⌂"],
    ].forEach(([value, label, icon]) => {
      const filterButton = this.button("forge-filter", `${icon} ${label}`, () => {
        this.filter = value;
        this.renderCollection();
      });
      filterButton.dataset.filter = value;
      this.filters.append(filterButton);
    });
    this.orderButton = this.button("forge-order", "Nível ↑", () => {
      this.order = this.order === "crescente" ? "decrescente" : "crescente";
      this.renderCollection();
    }, "Inverter ordem por nível");
    controls.append(this.filters, this.orderButton);
    toolbar.append(headingRow, searchWrap, controls);
    return toolbar;
  }

  render() {
    this.renderCollection();
    this.renderDeckPanel();
    this.renderSaveState();
    this.renderMobileChrome();
  }

  mobileSummary(status = this.builder.status(this.deck)) {
    return {
      count: `${status.total}/20`,
      progress: `${Math.min(100, (status.total / this.builder.maxCards) * 100)}%`,
      requirements: [
        ["B", status.composition.baixa, this.builder.minimums.baixa],
        ["M", status.composition.media, this.builder.minimums.media],
        ["A", status.composition.alta, this.builder.minimums.alta],
      ],
      ready: status.valid,
    };
  }

  renderMobileChrome() {
    if (!this.mobileStatus) return;
    const summary = this.mobileSummary();
    this.mobileStatus.replaceChildren();
    const count = this.element("button", "forge-mobile-status__count");
    count.type = "button";
    count.setAttribute("aria-label", "Abrir meu deck");
    count.addEventListener("click", () => this.showMobileView("deck"));
    count.append(
      this.element("span", "", "DECK"),
      this.element("strong", "", summary.count),
    );
    const progress = this.element("div", "forge-mobile-status__progress");
    const progressFill = this.element("span");
    progressFill.style.width = summary.progress;
    progress.append(progressFill);
    const requirements = this.element("div", "forge-mobile-status__requirements");
    summary.requirements.forEach(([label, current, minimum]) => {
      const item = this.element(
        "span",
        current >= minimum ? "is-complete" : "",
        `${label} ${current}/${minimum}`,
      );
      requirements.append(item);
    });
    const telemetry = this.element("div", "forge-mobile-status__telemetry");
    telemetry.append(progress, requirements);
    this.mobileStatus.append(count, telemetry);

    this.mobileDeckButton.querySelector(".forge-mobile-dock__count").textContent =
      String(this.builder.total(this.deck));
    this.mobileDeckButton.classList.toggle("is-ready", summary.ready);
    this.mobileCollectionButton.classList.toggle(
      "is-active",
      this.mobileView === "collection",
    );
    this.mobileDeckButton.classList.toggle("is-active", this.mobileView === "deck");
    this.mobileCollectionButton.setAttribute(
      "aria-current",
      this.mobileView === "collection" ? "page" : "false",
    );
    this.mobileDeckButton.setAttribute(
      "aria-current",
      this.mobileView === "deck" ? "page" : "false",
    );
    this.root.dataset.mobileView = this.mobileView;
  }

  showMobileView(view, options = {}) {
    if (view !== "collection" && view !== "deck") return;
    this.mobileView = view;
    this.renderMobileChrome();
    if (options.scroll !== false) this.root.scrollTo({ top: 0, behavior: "smooth" });
  }

  visibleCards() {
    return this.builder.filterCatalog({
      filter: this.filter,
      query: this.query,
      order: this.order,
    });
  }

  renderCollection() {
    if (!this.collectionGrid) return;
    const cards = this.visibleCards();
    this.resultCount.textContent = `${cards.length} ${cards.length === 1 ? "registro" : "registros"}`;
    this.orderButton.textContent = this.order === "crescente" ? "Nível ↑" : "Nível ↓";
    this.orderButton.classList.toggle("is-descending", this.order === "decrescente");
    this.filters.querySelectorAll(".forge-filter").forEach((button) => {
      const active = button.dataset.filter === this.filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.collectionGrid.replaceChildren();
    if (!cards.length) {
      const empty = this.element("div", "forge-empty-search");
      empty.append(
        this.element("span", "forge-empty-search__icon", "⌁"),
        this.element("strong", "", "Nenhum sinal encontrado"),
        this.element("p", "", "Tente outro termo ou remova os filtros."),
      );
      this.collectionGrid.append(empty);
      return;
    }
    cards.forEach((card, index) => {
      const cardElement = this.createCollectionCard(card);
      cardElement.style.setProperty("--enter-index", Math.min(index, 12));
      this.collectionGrid.append(cardElement);
    });
  }

  createCollectionCard(card) {
    const quantity = this.builder.quantity(this.deck, card);
    const total = this.builder.total(this.deck);
    const article = this.element(
      "article",
      `forge-card level-${card.nivel}${quantity ? " is-selected" : ""}`,
    );
    article.style.setProperty("--card-color", this.levelColor(card));
    const artButton = this.button("forge-card__art", "", () => this.openDetail(card));
    artButton.setAttribute("aria-label", `Ver detalhes de ${card.nome}`);
    const image = this.element("img", "forge-card__image");
    image.src = this.imageSource(card);
    image.alt = "";
    image.loading = "lazy";
    artButton.append(
      image,
      this.element("span", "forge-card__wash"),
      this.element("span", "forge-card__level", this.levelLabel(card)),
      this.element("span", "forge-card__power", card.tipo === "monstro" ? String(card.poder) : this.typeIcon(card.tipo)),
      this.element("span", "forge-card__inspect", "VER FICHA ↗"),
    );
    const body = this.element("div", "forge-card__body");
    body.append(
      this.element("span", "forge-card__type", this.typeLabel(card.tipo)),
      this.element("h3", "forge-card__name", card.nome),
      this.element("p", "forge-card__description", card.descricao),
    );
    const controls = this.element("div", "forge-card__controls");
    const minus = this.button("forge-qty-button", "−", () => this.change(card, -1), `Remover ${card.nome}`);
    minus.disabled = quantity === 0;
    const counter = this.element("div", "forge-card__counter");
    counter.append(this.element("strong", "", String(quantity)), this.element("span", "", `/ ${card.limite}`));
    const plus = this.button("forge-qty-button forge-qty-button--add", "+", () => this.change(card, 1), `Adicionar ${card.nome}`);
    plus.disabled = quantity >= card.limite || total >= this.builder.maxCards;
    controls.append(minus, counter, plus);
    article.append(artButton, body, controls);
    return article;
  }

  renderDeckPanel() {
    const status = this.builder.status(this.deck);
    this.deckPanel.replaceChildren();
    const summary = this.element("div", "forge-deck-summary");
    const titleBlock = this.element("div");
    titleBlock.append(this.element("span", "forge-kicker", "LOADOUT ATIVO"), this.element("h2", "forge-section-title", "Seu deck"));
    const deckActions = this.element("div", "forge-deck-actions");
    const randomDeck = this.button("forge-text-button forge-text-button--random", "ALEATÓRIO", () => {
      this.deck = this.builder.getRandomDeck();
      this.markDirty();
      this.render();
      this.toast("Novo deck aleatório gerado. Boa sorte, duelista.");
    });
    const autoBuild = this.button("forge-text-button", "AUTO-BUILD", () => {
      this.deck = this.builder.getStarterDeck();
      this.markDirty();
      this.render();
      this.toast("Deck tático gerado. Agora deixe com a sua cara.");
    });
    deckActions.append(randomDeck, autoBuild);
    summary.append(titleBlock, deckActions);
    const telemetry = this.element("div", "forge-telemetry");
    const ring = this.element("div", `forge-progress${status.valid ? " is-complete" : ""}`);
    ring.style.setProperty("--progress", `${Math.min(100, (status.total / 20) * 100)}%`);
    const ringInner = this.element("div", "forge-progress__inner");
    ringInner.append(
      this.element("strong", "", String(status.total).padStart(2, "0")),
      this.element("span", "", "/ 20"),
      this.element("small", "", status.valid ? "PRONTO" : "CARTAS"),
    );
    ring.append(ringInner);
    const requirements = this.element("div", "forge-requirements");
    [["baixa", "Baixas", 6], ["media", "Médias", 4], ["alta", "Altas", 2]].forEach(([level, label, minimum]) => {
      const value = status.composition[level];
      const complete = value >= minimum;
      const row = this.element("div", `forge-requirement${complete ? " is-complete" : ""}`);
      row.append(
        this.element("span", `forge-level-dot level-${level}`),
        this.element("span", "forge-requirement__label", label),
        this.element("strong", "", `${value}/${minimum}`),
        this.element("span", "forge-requirement__check", complete ? "✓" : String(minimum - value)),
      );
      requirements.append(row);
    });
    telemetry.append(ring, requirements);
    const deckListHeader = this.element("div", "forge-deck-list-header");
    deckListHeader.append(this.element("span", "", "MANIFESTO DO DECK"), this.button("forge-clear", "LIMPAR", () => this.confirmClear()));
    const deckList = this.element("div", "forge-deck-list");
    if (!this.deck.length) {
      const empty = this.element("div", "forge-empty-deck");
      empty.append(
        this.element("div", "forge-empty-deck__mark", "+"),
        this.element("strong", "", "Seu arsenal está vazio"),
        this.element("p", "", "Adicione cartas da coleção ou use o Auto-build."),
      );
      deckList.append(empty);
    } else {
      const cardsByKey = new Map(this.catalog.map((card) => [card.key, card]));
      this.deck.forEach((entry) => {
        const card = cardsByKey.get(`${entry.tipo}:${entry.nome}`);
        if (card) deckList.append(this.createDeckRow(card, entry.quantidade));
      });
    }
    const footer = this.element("div", "forge-deck-footer");
    this.validationMessage = this.element("p", "forge-validation", this.validationText(status));
    const save = this.button(`forge-save${status.valid ? " is-ready" : ""}`, status.valid ? "SELAR DECK" : `FALTAM ${status.slotsRemaining} CARTAS`, () => this.save());
    save.disabled = !status.valid;
    footer.append(this.validationMessage, save);
    this.deckPanel.append(summary, telemetry, deckListHeader, deckList, footer);
  }

  createDeckRow(card, quantity) {
    const row = this.element("div", "forge-deck-row");
    row.style.setProperty("--card-color", this.levelColor(card));
    const preview = this.button("forge-deck-row__preview", "", () => this.openDetail(card));
    const image = this.element("img");
    image.src = this.imageSource(card);
    image.alt = "";
    preview.append(image);
    const identity = this.element("div", "forge-deck-row__identity");
    identity.append(this.element("strong", "", card.nome), this.element("span", "", `${this.levelLabel(card)} · ${this.typeLabel(card.tipo)}`));
    const controls = this.element("div", "forge-deck-row__controls");
    controls.append(
      this.button("", "−", () => this.change(card, -1), `Remover ${card.nome}`),
      this.element("strong", "", String(quantity)),
      this.button("", "+", () => this.change(card, 1), `Adicionar ${card.nome}`),
    );
    controls.lastElementChild.disabled = quantity >= card.limite || this.builder.total(this.deck) >= 20;
    row.append(preview, identity, controls);
    return row;
  }

  validationText(status) {
    if (status.valid) return "Todos os protocolos atendidos. Deck pronto para combate.";
    if (status.total < 20) {
      const missing = Object.entries(status.remaining)
        .filter(([, value]) => value > 0)
        .map(([level, value]) => `${value} ${this.pluralLevel(level, value)}`);
      return missing.length ? `Prioridade: ${missing.join(", ")}.` : `${status.slotsRemaining} slots livres para sua estratégia.`;
    }
    return "A composição ainda não atende aos níveis mínimos.";
  }

  change(card, delta) {
    const next = this.builder.changeQuantity(this.deck, card, delta);
    if (JSON.stringify(next) === JSON.stringify(this.deck)) return;
    this.deck = next;
    this.markDirty();
    this.render();
    if (typeof navigator !== "undefined") navigator.vibrate?.(10);
    if (this.modal?.dataset.kind === "detail") this.openDetail(card, true);
  }

  markDirty() {
    this.dirty = true;
    this.renderSaveState();
  }

  renderSaveState() {
    if (!this.saveState) return;
    this.saveState.classList.toggle("is-dirty", this.dirty);
    this.saveState.querySelector(".forge-save-state__text").textContent = this.dirty ? "Alterações locais" : "Deck sincronizado";
  }

  save() {
    if (!this.builder.saveDeck(this.deck)) {
      this.toast("O deck ainda não passou na validação.", "error");
      return;
    }
    this.dirty = false;
    this.renderSaveState();
    this.toast("Deck selado. O duelo já pode começar.", "success");
    this.root.classList.add("forge-saved-flash");
    setTimeout(() => this.root?.classList.remove("forge-saved-flash"), 700);
  }

  confirmClear() {
    if (!this.deck.length) return;
    this.openConfirm({
      eyebrow: "RESET DE ARSENAL",
      title: "Limpar o deck inteiro?",
      message: "As cartas serão removidas do editor. O deck salvo continua intacto até você selar outro.",
      confirmLabel: "LIMPAR DECK",
      danger: true,
      onConfirm: () => {
        this.deck = [];
        this.markDirty();
        this.render();
      },
    });
  }

  tryExit() {
    if (!this.dirty) return this.onExit();
    this.openConfirm({
      eyebrow: "ALTERAÇÕES NÃO SALVAS",
      title: "Sair da forja?",
      message: "Seu deck salvo não será alterado, mas as mudanças desta sessão serão descartadas.",
      confirmLabel: "DESCARTAR E SAIR",
      danger: true,
      onConfirm: () => this.onExit(),
    });
  }

  openDetail(card, replace = false) {
    if (replace) this.closeModal(true);
    else if (this.modal) return;
    const quantity = this.builder.quantity(this.deck, card);
    const overlay = this.createModal("detail");
    const dialog = this.element("section", `forge-detail level-${card.nivel}`);
    dialog.style.setProperty("--card-color", this.levelColor(card));
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", card.nome);
    const close = this.button("forge-modal-close", "×", () => this.closeModal(), "Fechar ficha");
    const visual = this.element("div", "forge-detail__visual");
    const image = this.element("img");
    image.src = this.imageSource(card);
    image.alt = `Arte da carta ${card.nome}`;
    visual.append(image, this.element("div", "forge-detail__visual-wash"));
    if (card.tipo === "monstro") visual.append(this.element("strong", "forge-detail__power", String(card.poder)));
    const content = this.element("div", "forge-detail__content");
    content.append(this.element("span", "forge-kicker", `${this.typeLabel(card.tipo)} // ${this.levelLabel(card)}`), this.element("h2", "", card.nome));
    const description = this.element("div", "forge-detail__description");
    (card.partesDescricao || [{ tipo: "flavor", texto: card.descricao }]).forEach((part) => description.append(this.element("p", `is-${part.tipo}`, part.texto)));
    const quantityControls = this.element("div", "forge-detail__quantity");
    const minus = this.button("forge-qty-button", "−", () => this.change(card, -1));
    minus.disabled = quantity === 0;
    const count = this.element("div");
    count.append(this.element("span", "", "NO DECK"), this.element("strong", "", `${quantity} / ${card.limite}`));
    const plus = this.button("forge-qty-button forge-qty-button--add", "+", () => this.change(card, 1));
    plus.disabled = quantity >= card.limite || this.builder.total(this.deck) >= 20;
    quantityControls.append(minus, count, plus);
    content.append(this.element("span", "forge-detail__booster", `ORIGEM: ${String(card.booster).toUpperCase()}`), description, quantityControls);
    dialog.append(close, visual, content);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    close.focus();
  }

  openConfirm({ eyebrow, title, message, confirmLabel, danger, onConfirm }) {
    if (this.modal) return;
    const overlay = this.createModal("confirm");
    const dialog = this.element("section", "forge-confirm");
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "forge-kicker", eyebrow),
      this.element("div", "forge-confirm__icon", danger ? "!" : "?"),
      this.element("h2", "", title),
      this.element("p", "", message),
    );
    const actions = this.element("div", "forge-confirm__actions");
    const cancel = this.button("forge-confirm__cancel", "CANCELAR", () => this.closeModal());
    const confirm = this.button(`forge-confirm__accept${danger ? " is-danger" : ""}`, confirmLabel, () => {
      this.closeModal();
      onConfirm();
    });
    actions.append(cancel, confirm);
    dialog.append(actions);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    cancel.focus();
  }

  createModal(kind) {
    const overlay = this.element("div", "forge-modal");
    overlay.dataset.kind = kind;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay && kind === "detail") this.closeModal();
    });
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

  toast(message, type = "info") {
    this.root.querySelector(".forge-toast")?.remove();
    const toast = this.element("div", `forge-toast is-${type}`);
    toast.append(this.element("span", "forge-toast__icon", type === "error" ? "!" : "✓"), this.element("span", "", message));
    this.root.append(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  onKeydown(event) {
    if (event.key !== "Escape") return;
    if (this.modal) this.closeModal();
    else this.tryExit();
  }

  imageSource(card) {
    const texture = this.scene.textures.get(card.imagem || "fundoCarta");
    const source = texture?.getSourceImage?.();
    return source?.currentSrc || source?.src || "assets/fundo/fundo_carta_2.png";
  }

  levelColor(card) {
    return ({ baixa: "#17c9ff", media: "#a970ff", alta: "#ff9f43", lendaria: "#ffe16a", efeito: "#34e6a1", terreno: "#e66cff" })[card.nivel] || "#87a8bd";
  }

  levelLabel(card) {
    return ({ baixa: "NÍVEL BAIXO", media: "NÍVEL MÉDIO", alta: "NÍVEL ALTO", lendaria: "LENDÁRIA", efeito: "EFEITO", terreno: "TERRENO" })[card.nivel] || String(card.nivel).toUpperCase();
  }

  typeLabel(type) {
    return ({ monstro: "PERSONAGEM", efeito: "PROTOCOLO", terreno: "DOMÍNIO" })[type] || type;
  }

  typeIcon(type) {
    return ({ monstro: "◈", efeito: "ϟ", terreno: "⌂" })[type] || "✦";
  }

  pluralLevel(level, value) {
    return ({ baixa: value === 1 ? "baixa" : "baixas", media: value === 1 ? "média" : "médias", alta: value === 1 ? "alta" : "altas" })[level];
  }

  destroy() {
    document.removeEventListener("keydown", this.handleKeydown);
    document.body.classList.remove("deck-forge-open");
    this.root?.remove();
    this.root = null;
    this.modal = null;
  }
}
