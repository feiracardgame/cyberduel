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
    this.root = this.element("main", "title-terminal title-terminal--cards");
    this.root.setAttribute("aria-label", "Menu principal Cyberduel");

    const atmosphere = this.element("div", "title-atmosphere");
    atmosphere.setAttribute("aria-hidden", "true");
    atmosphere.append(
      this.element("div", "title-grid"),
      this.element("div", "title-scanlines"),
    );

    const shell = this.element("div", "title-shell");
    shell.dataset.responsiveText = "true";
    shell.append(
      this.createTopbar(),
      this.createHero(),
      this.createCardMenu(),
      this.createMenuShortcuts(),
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

  createCardMenu() {
    const categories = [
      {
        id: "partidas",
        title: "PARTIDAS",
        art: "menu_de_partida",
        kicker: "A ARENA DE NEOFLORIPA",
        description: "Escolha sua batalha. Escreva sua história.",
        action: "ESCOLHER PARTIDA",
      },
      {
        id: "cartas",
        title: "CARTAS",
        art: "montar_deck",
        kicker: "SUA PRÓXIMA JOGADA",
        description: "Monte seu deck. Descubra novas possibilidades.",
        action: "EXPLORAR COLEÇÃO",
      },
      {
        id: "mercado",
        title: "MERCADO",
        art: "menu_de_compras",
        kicker: "O PREÇO DO PODER",
        description: "Abra pacotes e amplie sua coleção.",
        action: "VISITAR MERCADO",
      },
      {
        id: "ranking",
        title: "LEADERBOARD",
        art: "leaderboard",
        kicker: "OS NOMES DE NEOFLORIPA",
        description: "Veja quem domina a arena.",
        action: "VER RANKING",
      },
    ];
    this.menuCategories = categories;
    this.menuCategory = categories[0].id;

    const section = this.element("section", "card-menu");
    section.setAttribute("aria-label", "Escolha uma seção do jogo");
    const fan = this.element("div", "card-menu__fan");
    const title = this.element("strong", "card-menu__title");
    const caption = this.element("div", "card-menu__caption");
    const kicker = this.element("small", "");
    const description = this.element("p", "");
    const dots = this.element("div", "card-menu__tabs");
    const backRow = this.element("div", "card-menu__backrow");
    const back = this.button("card-menu__back", "‹ VOLTAR", () =>
      this.closeCategoryOptions(),
    );
    const counter = this.element("span", "card-menu__counter");
    backRow.append(back, counter);
    const action = this.button("card-menu__enter", "", () =>
      this.handleCardMenuAction(),
    );
    const cards = [],
      tabs = [];

    const makeCard = (isGhost) => {
      const card = this.button(
        "menu-art-card" + (isGhost ? " menu-art-card--ghost" : ""),
        "",
        () => this.handleCardClick(card),
      );
      const art = this.element("img", "menu-art-card__image");
      art.alt = "";
      art.draggable = false;
      art.decoding = "async";
      card.append(art, this.element("span", "menu-art-card__frame"));
      fan.append(card);
      return card;
    };
    for (let i = 0; i < 3; i++) cards.push(makeCard(false));
    // Two extra cards, always present but parked off-screen (offset ±2,
    // invisible via the --ghost class) so the drag can rotate a real,
    // already-painted card into view instead of popping new artwork in.
    const ghosts = { left: makeCard(true), right: makeCard(true) };
    categories.forEach((category, index) => {
      const tab = this.button("card-menu__tab", category.title, () =>
        this.selectCategory(index),
      );
      tabs.push(tab);
      dots.append(tab);
    });

    caption.append(kicker, description, action);
    section.append(backRow, fan, title, dots, caption);

    this.cardMenuEls = {
      section,
      fan,
      cards,
      ghosts,
      tabs,
      dots,
      backRow,
      counter,
      title,
      kicker,
      description,
      action,
    };
    this.cardMenuState = {
      mode: "categories",
      categoryIndex: 0,
      optionIndex: 0,
      currentKind: null,
      items: categories,
    };
    this.cardMenuTransitioning = false;
    this.cardMenuDragged = false;
    this.attachFanDrag(fan);
    this.renderCardMenu();
    return section;
  }

  // Resting geometry for a card at a given (possibly fractional) offset
  // from the centered card: -1 = left, 0 = center, 1 = right, ±2 = the
  // hidden cards waiting just off-screen. Used to animate a smooth
  // hand-off during drag: interpolating between these keyframes makes the
  // old card slide left, the incoming one slide into the middle, and the
  // next one fade in from the right (or the mirror, dragging the other way).
  static CARD_KEYFRAMES = {
    "-2": {
      x: -140,
      y: 20,
      rot: -30,
      scale: 0.65,
      bright: 0.3,
      sat: 0.4,
      opacity: 0,
      z: 0,
    },
    "-1": {
      x: -91,
      y: 5,
      rot: -12,
      scale: 0.85,
      bright: 0.54,
      sat: 0.6,
      opacity: 1,
      z: 1,
    },
    0: { x: -50, y: 0, rot: 0, scale: 1, bright: 1, sat: 1, opacity: 1, z: 3 },
    1: {
      x: -9,
      y: 5,
      rot: 12,
      scale: 0.85,
      bright: 0.54,
      sat: 0.6,
      opacity: 1,
      z: 2,
    },
    2: {
      x: 40,
      y: 20,
      rot: 30,
      scale: 0.65,
      bright: 0.3,
      sat: 0.4,
      opacity: 0,
      z: 0,
    },
  };

  cardStyleForOffset(offset) {
    const e = Math.max(-2, Math.min(2, offset));
    const lo = Math.floor(e);
    const hi = Math.ceil(e);
    const frac = e - lo;
    const a = CyberduelTitleUI.CARD_KEYFRAMES[String(lo)];
    const b = CyberduelTitleUI.CARD_KEYFRAMES[String(hi)];
    const lerp = (key) => a[key] + (b[key] - a[key]) * frac;
    return {
      transform: `translateX(${lerp("x")}%) translateY(${lerp("y")}cqw) rotate(${lerp("rot")}deg) scale(${lerp("scale")})`,
      filter: `brightness(${lerp("bright")}) saturate(${lerp("sat")})`,
      opacity: String(lerp("opacity")),
      zIndex: String(Math.round(lerp("z"))),
    };
  }

  getMenuSections() {
    return {
      partidas: {
        title: "Escolha sua partida",
        rows: [
          [
            "Jogar solo",
            "Contra o bot",
            "menu_de_partida",
            () => this.callbacks.onSolo(),
            "deck",
          ],
          ["Partida aleatória", "Encontre um oponente", "partida_aleatória"],
          [
            "Criar sala",
            "Convide um amigo por código ou QR",
            "partida_codigo",
            () => this.callbacks.onCreateRoom(),
            "deck",
          ],
          [
            "Entrar por código",
            "Entre na sala de um amigo",
            "qr_code",
            () => this.openJoinDialog(this.callbacks.onJoinRoom),
            "deck",
          ],
          ["Sala híbrida", "Celular e mesa compartilhada", "sala_hibrida"],
          [
            "Espectar sala",
            "Acompanhe uma batalha pelo código",
            "partida_codigo",
            () => this.openJoinDialog(this.callbacks.onSpectate),
            "none",
          ],
        ],
      },
      cartas: {
        title: "Suas cartas",
        rows: [
          [
            "Montar meu deck",
            "Sua coleção, sua estratégia",
            "montar_deck",
            () => this.callbacks.onDeck(),
          ],
          [
            "Abrir boosters",
            "Descubra cinco novas cartas",
            "abrir_boosters",
            () => this.openBoosterShop(),
          ],
        ],
      },
      mercado: {
        title: "Mercado de cartas",
        rows: [
          [
            "Comprar boosters",
            "Pacotes para sua coleção",
            "abrir_boosters",
            () => this.openBoosterShop(),
          ],
          [
            "Anunciar cartas",
            "Negocie com outros duelistas",
            "anunciar_cartas",
          ],
          [
            "Visualizar anúncios",
            "Encontre sua próxima carta",
            "visualizar_anuncios",
          ],
        ],
      },
      ranking: {
        title: "Leaderboard",
        rows: [
          [
            "Ranking de duelistas",
            "Os nomes que dominam NeoFloripa",
            "leaderboard",
          ],
        ],
      },
      perfil: {
        title: this.account?.user || "Meu perfil",
        rows: [
          [
            this.account?.user ? "Minha coleção" : "Entrar ou criar conta",
            this.account?.user
              ? `${this.account.currency} tijolinhos`
              : "Escolha sua facção e comece a jogar",
            "montar_deck",
            () =>
              this.account?.user
                ? this.callbacks.onDeck()
                : this.openAuthDialog(),
            this.account?.user ? "account" : "none",
          ],
        ],
      },
    };
  }

  paintCard(card, item, idx, mode) {
    card.dataset.itemIndex = String(idx);
    card.querySelector(".menu-art-card__image").src =
      `assets/menus/${item.art}.png`;
    card.setAttribute("aria-label", item.title);
    const locked = mode === "options" && !item.handler;
    // Stay enabled (not `disabled`) even when locked: a disabled button
    // suppresses pointer events in most browsers, which would break a
    // drag gesture that starts on top of it. triggerOptionAction() already
    // no-ops when there's no handler.
    card.setAttribute("aria-disabled", String(locked));
    card.classList.toggle("is-locked", locked);
  }

  resolveMenuItem(offset) {
    const state = this.cardMenuState;
    const items = state.items;
    const total = items.length;
    const loop = state.mode === "categories";
    const index =
      state.mode === "categories" ? state.categoryIndex : state.optionIndex;
    let i = index + offset;
    if (loop) i = ((i % total) + total) % total;
    if (i < 0 || i >= total) return null;
    return { item: items[i], idx: i };
  }

  renderCardMenu() {
    const ring = [
      { el: this.cardMenuEls.ghosts.left, offset: -2 },
      { el: this.cardMenuEls.cards[0], offset: -1 },
      { el: this.cardMenuEls.cards[1], offset: 0 },
      { el: this.cardMenuEls.cards[2], offset: 1 },
      { el: this.cardMenuEls.ghosts.right, offset: 2 },
    ];
    ring.forEach((entry) => {
      entry.el.style.transform = "";
      entry.el.style.filter = "";
      entry.el.style.opacity = "";
      entry.el.style.zIndex = "";
      entry.el.classList.toggle(
        "menu-art-card--ghost",
        Math.abs(entry.offset) === 2,
      );
      const data = this.resolveMenuItem(entry.offset);
      if (!data) {
        entry.el.hidden = true;
        return;
      }
      entry.el.hidden = false;
      this.paintCard(entry.el, data.item, data.idx, this.cardMenuState.mode);
      entry.el.dataset.position =
        entry.offset === -1
          ? "left"
          : entry.offset === 0
            ? "center"
            : entry.offset === 1
              ? "right"
              : "";
      entry.el.setAttribute("aria-pressed", String(entry.offset === 0));
      entry.el.setAttribute("aria-hidden", String(Math.abs(entry.offset) === 2));
    });
    this.cardMenuRing = ring;
    this.updateCaption();
  }

  updateCaption() {
    const { title, kicker, description, action, dots, backRow, tabs, counter } =
      this.cardMenuEls;
    const state = this.cardMenuState;
    const index =
      state.mode === "categories" ? state.categoryIndex : state.optionIndex;
    const item = state.items[index];
    if (state.mode === "categories") {
      dots.hidden = false;
      backRow.hidden = true;
      title.textContent = item.title;
      kicker.textContent = item.kicker;
      description.textContent = item.description;
      action.textContent = item.action + "  ›";
      action.disabled = false;
      tabs.forEach((tab, i) =>
        tab.setAttribute("aria-pressed", String(i === index)),
      );
    } else {
      dots.hidden = true;
      backRow.hidden = false;
      counter.textContent = `${index + 1} / ${state.items.length}`;
      title.textContent = item.title;
      kicker.textContent = "";
      description.textContent = item.description;
      action.textContent = item.handler ? "ABRIR  ›" : "EM BREVE";
      action.disabled = !item.handler;
    }
    this.fitMenuTitle(title);
  }

  // Two-word titles like "Visualizar anúncios" wrap onto a second line;
  // shrink the font once that happens rather than letting it dominate the
  // caption. Retries a couple of frames if not laid out yet.
  fitMenuTitle(titleEl, attemptsLeft = 4) {
    titleEl.classList.remove("card-menu__title--wrap");
    const lineHeight = parseFloat(getComputedStyle(titleEl).lineHeight);
    if (!lineHeight) {
      if (attemptsLeft > 0) {
        requestAnimationFrame(() =>
          this.fitMenuTitle(titleEl, attemptsLeft - 1),
        );
      }
      return;
    }
    if (titleEl.scrollHeight > lineHeight * 1.5) {
      titleEl.classList.add("card-menu__title--wrap");
    }
  }

  selectCategory(index) {
    if (this.cardMenuState.mode !== "categories" || this.cardMenuTransitioning)
      return;
    this.cardMenuState.categoryIndex = index;
    this.menuCategory = this.menuCategories[index].id;
    this.renderCardMenu();
  }

  navigateCardMenu(direction) {
    const state = this.cardMenuState;
    const total = state.items.length;
    if (state.mode === "categories") {
      state.categoryIndex =
        (((state.categoryIndex + direction) % total) + total) % total;
      this.menuCategory = this.menuCategories[state.categoryIndex].id;
    } else {
      const next = state.optionIndex + direction;
      if (next < 0 || next >= total) return false;
      state.optionIndex = next;
    }
    this.renderCardMenu();
    return true;
  }

  handleCardClick(card) {
    if (this.cardMenuDragged || this.cardMenuTransitioning) return;
    const position = card.dataset.position;
    if (position === "left") return this.navigateCardMenu(-1);
    if (position === "right") return this.navigateCardMenu(1);
    const state = this.cardMenuState;
    const idx = Number(card.dataset.itemIndex);
    if (state.mode === "categories")
      this.openCategoryOptions(state.items[idx].id);
    else this.triggerOptionAction(state.items[idx]);
  }

  handleCardMenuAction() {
    const state = this.cardMenuState;
    if (state.mode === "categories")
      this.openCategoryOptions(this.menuCategory);
    else this.triggerOptionAction(state.items[state.optionIndex]);
  }

  triggerOptionAction(item) {
    if (!item?.handler) return;
    this.runMenuAction(item.handler, item.requirement);
  }

  openCategoryOptions(kind) {
    if (this.cardMenuState.mode === "options" || this.cardMenuTransitioning)
      return;
    const sectionData = this.getMenuSections()[kind];
    if (!sectionData) return;
    const items = sectionData.rows.map(
      ([title, description, art, handler, requirement]) => ({
        title,
        description,
        art,
        handler,
        requirement,
      }),
    );
    this.transitionCardMenu(() => {
      this.cardMenuState = {
        mode: "options",
        optionIndex: 0,
        currentKind: kind,
        sectionTitle: sectionData.title,
        items,
      };
    });
  }

  closeCategoryOptions() {
    if (this.cardMenuState.mode !== "options" || this.cardMenuTransitioning)
      return;
    const categoryIndex = Math.max(
      0,
      this.menuCategories.findIndex(
        (c) => c.id === this.cardMenuState.currentKind,
      ),
    );
    this.transitionCardMenu(() => {
      this.cardMenuState = {
        mode: "categories",
        categoryIndex,
        optionIndex: 0,
        currentKind: null,
        items: this.menuCategories,
      };
      this.menuCategory = this.menuCategories[categoryIndex].id;
    });
  }

  transitionCardMenu(applyStateChange) {
    this.cardMenuTransitioning = true;
    const { cards } = this.cardMenuEls;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const visibleCards = cards.filter((card) => !card.hidden);
    visibleCards.forEach((card) => card.classList.add("is-discarding"));
    const wait = reducedMotion ? 0 : 380;
    setTimeout(() => {
      applyStateChange();
      cards.forEach((card) => {
        card.classList.remove("is-discarding");
        card.classList.add("is-dealing");
      });
      this.renderCardMenu();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          cards.forEach((card) => card.classList.remove("is-dealing"));
          this.cardMenuTransitioning = false;
        }),
      );
    }, wait);
  }

  applyCardDragStyle(el, offset, t) {
    if (!el || el.hidden) return;
    const style = this.cardStyleForOffset(offset - t);
    el.style.transform = style.transform;
    el.style.filter = style.filter;
    el.style.opacity = style.opacity;
    el.style.zIndex = style.zIndex;
  }

  // Advances the ring one step in `direction`, keeping every card's
  // painted content attached to its element as it slides to a new slot —
  // only the card rotating off the far edge gets repainted, and it's
  // always invisible (offset ±2) when that happens.
  commitRingDrag(direction) {
    const state = this.cardMenuState;
    const total = state.items.length;
    if (state.mode === "categories") {
      state.categoryIndex =
        (((state.categoryIndex + direction) % total) + total) % total;
      this.menuCategory = this.menuCategories[state.categoryIndex].id;
    } else {
      const next = state.optionIndex + direction;
      if (next < 0 || next >= total) return false;
      state.optionIndex = next;
    }

    const ring = this.cardMenuRing;
    const outgoingOffset = direction === 1 ? -3 : 3;
    ring.forEach((entry) => {
      entry.offset -= direction;
    });
    const exiting = ring.find((entry) => entry.offset === outgoingOffset);
    if (exiting) {
      exiting.offset = direction === 1 ? 2 : -2;
      const data = this.resolveMenuItem(exiting.offset);
      if (data) {
        exiting.el.hidden = false;
        this.paintCard(exiting.el, data.item, data.idx, state.mode);
      } else {
        exiting.el.hidden = true;
      }
    }
    ring.forEach((entry) => this.applyCardDragStyle(entry.el, entry.offset, 0));

    const byOffset = new Map(ring.map((entry) => [entry.offset, entry.el]));
    ring.forEach((entry) => {
      entry.el.dataset.position =
        entry.offset === -1
          ? "left"
          : entry.offset === 0
            ? "center"
            : entry.offset === 1
              ? "right"
              : "";
      entry.el.setAttribute("aria-pressed", String(entry.offset === 0));
      entry.el.setAttribute(
        "aria-hidden",
        String(Math.abs(entry.offset) === 2),
      );
      entry.el.classList.toggle(
        "menu-art-card--ghost",
        Math.abs(entry.offset) === 2,
      );
    });
    // Keep the plain (non-drag) accessors pointing at whichever elements
    // now hold each role, so clicks and the open/close transition keep
    // working once the ring settles back into ordinary rest styling.
    this.cardMenuEls.cards = [
      byOffset.get(-1),
      byOffset.get(0),
      byOffset.get(1),
    ];
    this.cardMenuEls.ghosts = { left: byOffset.get(-2), right: byOffset.get(2) };
    this.updateCaption();
    return true;
  }

  attachFanDrag(fan) {
    const threshold = 0.28; // fraction of the fan's width needed to commit to a swipe
    let dragging = false;
    let moved = false;
    let startX = 0;
    let fanWidth = 1;
    let pendingT = 0;
    let frameQueued = false;

    // Pointer/touch can deliver several move events per animation frame.
    // Writing transform/filter/opacity to 5 cards on every single one of
    // those is wasted work the browser never gets to paint anyway — so we
    // just remember the latest position and apply it once per frame.
    const flush = () => {
      frameQueued = false;
      if (!dragging) return;
      this.cardMenuRing.forEach((entry) =>
        this.applyCardDragStyle(entry.el, entry.offset, pendingT),
      );
    };

    const onMove = (event) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 6) moved = true;
      pendingT = Math.max(-1, Math.min(1, -delta / fanWidth));
      if (!frameQueued) {
        frameQueued = true;
        requestAnimationFrame(flush);
      }
    };

    // Once every card is back at an integer offset, drop the inline
    // styles so the plain dataset.position CSS (which mirrors the exact
    // same values) takes back over.
    const settle = () => {
      this.cardMenuRing.forEach((entry) => {
        entry.el.style.transform = "";
        entry.el.style.filter = "";
        entry.el.style.opacity = "";
        entry.el.style.zIndex = "";
      });
    };

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      frameQueued = false;
      fan.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);

      const delta = event.clientX - startX;
      const t = -delta / fanWidth;
      const direction =
        moved && Math.abs(t) > threshold ? (t > 0 ? 1 : -1) : 0;
      let committed = false;
      if (direction) {
        this.cardMenuDragged = true;
        setTimeout(() => {
          this.cardMenuDragged = false;
        }, 60);
        committed = this.commitRingDrag(direction);
      }
      // Whether committed or cancelled, every card already knows its
      // resting offset — just ease it there from wherever the drag left
      // it. Same motion, no pop. (commitRingDrag already applied the
      // target style for the committed case.)
      if (!committed) {
        this.cardMenuRing.forEach((entry) =>
          this.applyCardDragStyle(entry.el, entry.offset, 0),
        );
      }
      clearTimeout(this.ringSettleTimer);
      this.ringSettleTimer = setTimeout(settle, 460);
    };

    fan.addEventListener("pointerdown", (event) => {
      if (this.cardMenuTransitioning) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      fanWidth = fan.getBoundingClientRect().width || 1;
      clearTimeout(this.ringSettleTimer);
      fan.classList.add("is-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    });
  }

  createMenuShortcuts() {
    const nav = this.element("nav", "card-menu__shortcuts");
    nav.setAttribute("aria-label", "Mais opções");
    for (const [icon, label, handler] of [
      ["◇", "PERFIL", () => this.openMenuSection("perfil")],
      ["⚙", "AJUSTES", () => this.openSettingsDialog()],
    ]) {
      const button = this.button("card-menu__shortcut", "", handler, label);
      button.append(
        this.element("span", "", icon),
        this.element("small", "", label),
      );
      nav.append(button);
    }
    return nav;
  }

  runMenuAction(handler, requirement = "account") {
    this.closeModal(true);
    if (requirement !== "none" && !this.account?.user)
      return this.openAuthDialog();
    if (requirement !== "none" && !this.account?.faction)
      return this.openFactionDialog();
    if (requirement === "deck" && !this.deckSummary().deckReady) {
      this.setStatus("Monte e salve seu deck antes de jogar.", "warning");
      return this.callbacks.onDeck();
    }
    handler();
  }

  openMenuSection(kind) {
    if (this.modal) return;
    const section = this.getMenuSections()[kind];
    const overlay = this.createModal("menu-" + kind);
    const dialog = this.element("section", "title-dialog card-menu-dialog");
    dialog.dataset.responsiveText = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", section.title);
    const heading = this.element("div", "card-menu-dialog__heading");
    heading.append(
      this.element("h2", "", section.title),
      this.button(
        "card-menu-dialog__close",
        "×",
        () => this.closeModal(),
        "Fechar menu",
      ),
    );
    dialog.append(
      this.element(
        "small",
        "card-menu-dialog__eyebrow",
        "CYBERDUEL / NEOFLORIPA",
      ),
      heading,
    );
    const list = this.element("div", "card-menu-dialog__list");
    section.rows.forEach(([title, description, art, handler, requirement]) => {
      const row = this.button(
        "card-menu-option",
        "",
        () => this.runMenuAction(handler, requirement),
        title,
      );
      const image = this.element("img", "");
      image.src = `assets/menus/${art}.png`;
      image.alt = "";
      const copy = this.element("span", "");
      copy.append(
        this.element("strong", "", title),
        this.element("small", "", description),
      );
      row.append(
        image,
        copy,
        this.element(
          "span",
          "card-menu-option__state",
          handler ? "›" : "EM BREVE",
        ),
      );
      row.disabled = !handler;
      list.append(row);
    });
    dialog.append(list);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
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
    const adminButton = this.button("title-dialog__cancel", "ADMIN", () => {
      this.closeModal(true);
      this.openAdminGrantDialog();
    });
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

  openAdminGrantDialog(focusCurrency = false) {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("admin-grant");
    const dialog = this.element("section", "title-dialog title-admin-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.append(
      this.element("span", "title-kicker", "ADMIN // CONTAS E COLEÇÃO"),
      this.element("h2", "", "Central administrativa"),
      this.element("p", "", "Adicione tijolinhos ou cartas à conta informada."),
    );

    const form = this.element("div", "title-admin-grid");
    const username = this.element("input", "title-auth-input");
    username.type = "text";
    username.placeholder = "USERNAME";
    username.value = this.account.user || "";
    username.maxLength = 24;
    username.setAttribute("aria-label", "Username da conta");

    const adminToken = this.element("input", "title-auth-input");
    adminToken.type = "password";
    adminToken.placeholder = "ADMIN TOKEN (OPCIONAL)";
    adminToken.value = String(window.CYBERDUEL_ADMIN_TOKEN || "");
    adminToken.maxLength = 256;
    adminToken.setAttribute("aria-label", "Token administrativo");

    const deckSection = this.element("section", "title-admin-section");
    deckSection.append(
      this.element("h3", "", "Cartas por facção"),
      this.element(
        "p",
        "title-admin-note",
        "Concede as cartas da facção escolhida para o username.",
      ),
    );
    const faction = this.element("select", "title-auth-input");
    faction.setAttribute("aria-label", "Facção das cartas concedidas");
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
    const cardSuggestions = this.element("datalist", "");
    cardSuggestions.id = "admin-card-catalog";
    cardName.setAttribute("list", cardSuggestions.id);
    const catalog = this.deckBuilder.getCatalog();
    catalog.forEach((card) => {
      const option = this.element("option", "");
      option.value = card.nome;
      option.label = `${card.booster} / ${card.tipo}`;
      cardSuggestions.append(option);
    });
    cardName.addEventListener("change", () => {
      const card = catalog.find(
        (entry) => entry.nome === cardName.value.trim(),
      );
      if (card) cardType.value = card.tipo;
    });
    const cardQuantity = this.element("input", "title-auth-input");
    cardQuantity.type = "number";
    cardQuantity.min = "1";
    cardQuantity.max = "20";
    cardQuantity.step = "1";
    cardQuantity.value = "1";
    cardQuantity.setAttribute("aria-label", "Quantidade");
    cardSection.append(cardType, cardName, cardSuggestions, cardQuantity);

    const currencySection = this.element("section", "title-admin-section");
    currencySection.append(
      this.element("h3", "", "Adicionar dinheiro"),
      this.element(
        "p",
        "title-admin-note",
        "Credita tijolinhos na conta acima, sem alterar sua coleção.",
      ),
    );
    const currencyAmount = this.element("input", "title-auth-input");
    currencyAmount.type = "number";
    currencyAmount.min = "1";
    currencyAmount.max = "1000000";
    currencyAmount.step = "1";
    currencyAmount.value = "500";
    currencyAmount.setAttribute("aria-label", "Quantidade de tijolinhos");
    const currencyButton = this.button(
      "title-dialog__confirm title-admin-currency",
      "＋ ADICIONAR DINHEIRO",
      async () => {
        error.textContent = "";
        result.textContent = "";
        const target = withUsername();
        if (!target) return;
        const amount = Number(currencyAmount.value);
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) {
          error.textContent = "Informe um valor inteiro entre 1 e 1.000.000.";
          currencyAmount.focus();
          return;
        }
        toggleBusy(true);
        this.modalRequired = true;
        try {
          const payload = await this.account.grantCurrency(target, amount, {
            adminToken: adminToken.value,
          });
          result.textContent = `+${payload.added.toLocaleString("pt-BR")} tijolinhos para ${payload.account.username}. Saldo: ${payload.account.currency.toLocaleString("pt-BR")}.`;
        } catch (exception) {
          error.textContent =
            exception.message || "Falha ao adicionar dinheiro.";
        } finally {
          this.modalRequired = false;
          toggleBusy(false);
        }
      },
    );
    currencySection.append(currencyAmount, currencyButton);
    this.modalAfterClose = () => this.account.notify();

    const error = this.element("span", "title-dialog__error");
    const result = this.element("p", "title-admin-result");
    const actionButtons = this.element(
      "div",
      "title-dialog__actions title-dialog__actions--triple",
    );

    const toggleBusy = (busy) => {
      [
        username,
        adminToken,
        faction,
        cardType,
        cardName,
        cardQuantity,
        currencyAmount,
        currencyButton,
      ].forEach((field) => (field.disabled = busy));
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
        result.textContent = `Cartas concedidas para ${target}: ${total}.`;
      } catch (exception) {
        error.textContent =
          exception.message || "Falha ao conceder cartas da facção.";
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

    const grantAllCards = async () => {
      error.textContent = "";
      result.textContent = "";
      const target = withUsername();
      if (!target) return;
      toggleBusy(true);
      try {
        const payload = await this.account.grantCardsByUsername(target, [], {
          allAvailable: true,
          adminToken: adminToken.value,
        });
        result.textContent = `Coleção completa concedida para ${target}: ${payload.granted.length} cartas.`;
      } catch (exception) {
        error.textContent =
          exception.message || "Falha ao conceder coleção completa.";
      } finally {
        toggleBusy(false);
      }
    };

    const resetCollection = async () => {
      error.textContent = "";
      result.textContent = "";
      const target = withUsername();
      if (!target) return;
      toggleBusy(true);
      try {
        await this.account.resetCollection(target, {
          adminToken: adminToken.value,
        });
        result.textContent = `Coleção resetada para ${target}.`;
      } catch (exception) {
        error.textContent = exception.message || "Falha ao resetar coleção.";
      } finally {
        toggleBusy(false);
      }
    };

    actionButtons.append(
      this.button("title-dialog__cancel", "CARTAS DA FACCAO", grantDeck),
      this.button("title-dialog__confirm", "CARTA AVULSA", grantSingleCard),
      this.button("title-dialog__cancel", "TODAS AS CARTAS", grantAllCards),
      this.button("title-dialog__confirm", "RESETAR COLEÇÃO", resetCollection),
      this.button("title-dialog__cancel", "VOLTAR", () => this.closeModal()),
    );

    form.append(
      username,
      adminToken,
      currencySection,
      deckSection,
      cardSection,
    );
    dialog.append(form, result, error, actionButtons);
    overlay.append(dialog);
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    setTimeout(() => (focusCurrency ? currencyAmount : username).focus(), 50);
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
        className: "title-action title-action--compact",
        kicker: "ASSISTIR",
        title: "ESPECTAR SALA",
        description: "Acompanhe pelo código",
        icon: "◉",
        handler: () => this.openJoinDialog(this.callbacks.onSpectate),
      }),
    );

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

  showResumeMatch(code, resume) {
    const target = this.root || this.statusBar?.parentElement;
    if (!target || target.querySelector(".title-resume-match")) return;
    const button = this.button(
      "title-action title-resume-match",
      `VOLTAR À PARTIDA ${code}`,
      resume,
    );
    target.prepend(button);
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

  createFactionChoice(
    faction,
    title,
    description,
    handler,
    action = "RECEBER DECK DE 20 CARTAS  ›",
  ) {
    const button = this.button(
      `title-faction title-faction--${faction}`,
      "",
      handler,
      `Escolher ${title}`,
    );
    button.append(
      this.element("strong", "", title),
      this.element("span", "", description),
      this.element("small", "", action),
    );
    return button;
  }

  openBoosterShop() {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("boosters");
    const dialog = this.element("section", "title-dialog title-booster-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Mercado de boosters");
    this.modalAfterClose = () => this.account.notify();
    const factions = [
      [
        "raspcorp",
        "RaspCorp",
        "O poder tem um preço.",
        "#36dfff",
        "RaspClay MonteCorp",
      ],
      [
        "echossystem",
        "EchoSsystem",
        "Faça o sistema ouvir você.",
        "#ff667e",
        "A Aranha",
      ],
      [
        "humbanet",
        "HumbaNet",
        "Conectados, somos mais fortes.",
        "#65efb7",
        "HumbaBrain",
      ],
      [
        "remanescentes",
        "Remanescentes",
        "O futuro pertence a quem resiste.",
        "#ffd17a",
        "Povo da Areia",
      ],
      ["sindicato", "Sindicato", "Ninguém vence sozinho.", "#bf94ff", null],
    ];
    let selected =
      factions.find((f) => f[0] === this.account.faction) || factions[0];
    let busy = false;
    let opened = false;
    const header = this.element("header", "booster-header");
    const heading = this.element("div");
    heading.append(
      this.element("span", "title-kicker", "MERCADO / COLEÇÃO"),
      this.element("h2", "", "Booster Vault"),
    );
    const close = this.button(
      "booster-close",
      "×",
      () => this.closeModal(),
      "Fechar loja de boosters",
    );
    header.append(heading, close);
    const wallet = this.element("div", "booster-wallet");
    const balance = this.element("strong", "title-booster-balance");
    const admin = this.button("booster-admin", "ADMIN · ＋ SALDO", () => {
      this.modalAfterClose = null;
      this.closeModal(true);
      this.openAdminGrantDialog(true);
    });
    wallet.append(balance, admin);
    const tabs = this.element("div", "booster-factions");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Facção do pacote");
    const stage = this.element("div", "booster-stage");
    const pack = this.element("div", "booster-pack");
    pack.setAttribute("aria-hidden", "true");
    const artwork = this.element("img", "booster-pack-art");
    artwork.alt = "";
    const foil = this.element("div", "booster-pack-foil");
    const packBrand = this.element(
      "span",
      "booster-pack-brand",
      "CYBER / DUEL",
    );
    const packName = this.element("strong", "booster-pack-name");
    const seal = this.element("span", "booster-pack-seal", "05 / CARTAS");
    pack.append(artwork, foil, packBrand, packName, seal);
    const flash = this.element("div", "booster-flash");
    flash.setAttribute("aria-hidden", "true");
    stage.append(pack, flash);
    const intro = this.element("div", "booster-intro");
    const title = this.element("h3");
    const subtitle = this.element("p");
    intro.append(title, subtitle);
    const status = this.element(
      "p",
      "booster-status",
      "5 cartas por pacote. Qual será a próxima da sua coleção?",
    );
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = this.element("div", "title-booster-results");
    results.hidden = true;
    const error = this.element("span", "title-dialog__error");
    error.setAttribute("role", "alert");
    const buy = this.button("booster-buy", "", async () => {
      if (busy) return;
      if (opened) {
        reset();
        return;
      }
      if (this.account.currency < this.account.boosterPrice) return;
      busy = true;
      this.modalRequired = true;
      refresh();
      error.textContent = "";
      status.textContent = "Preparando seu pacote…";
      try {
        const cards = await this.account.openBooster(selected[0]);
        if (this.modal !== overlay) {
          this.account.notify();
          return;
        }
        const revealed = cards.flatMap((card) =>
          Array.from({ length: card.quantidade || 1 }, () => ({
            ...card,
            quantidade: 1,
          })),
        );
        dialog.classList.add("is-opening");
        status.textContent = "Rompendo o lacre…";
        balance.textContent = `${this.account.currency.toLocaleString("pt-BR")} TIJOLINHOS`;
        const reducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        await new Promise((resolve) =>
          setTimeout(resolve, reducedMotion ? 0 : 1100),
        );
        if (this.modal !== overlay) {
          this.account.notify();
          return;
        }
        results.replaceChildren(
          ...revealed.map((card, index) => {
            const item = this.createBoosterResult(card);
            item.style.setProperty("--reveal-index", index);
            return item;
          }),
        );
        results.hidden = false;
        dialog.classList.remove("is-opening");
        dialog.classList.add("is-revealed");
        stage.hidden = true;
        intro.hidden = true;
        status.textContent = `${revealed.length} cartas adicionadas à sua coleção.`;
        opened = true;
      } catch (exception) {
        if (this.modal === overlay) {
          error.textContent = exception.message || "Falha ao abrir booster.";
          status.textContent =
            "Não foi possível abrir o pacote. Tente novamente.";
          dialog.classList.remove("is-opening");
        }
      } finally {
        busy = false;
        if (this.modal === overlay) {
          this.modalRequired = false;
          refresh();
        }
      }
    });
    const refresh = () => {
      balance.textContent = `${this.account.currency.toLocaleString("pt-BR")} TIJOLINHOS`;
      close.disabled = admin.disabled = busy;
      for (const button of tabs.children) {
        button.disabled = busy;
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.faction === selected[0]),
        );
      }
      buy.disabled =
        busy || (!opened && this.account.currency < this.account.boosterPrice);
      buy.textContent = busy
        ? "ABRINDO…"
        : opened
          ? "ESCOLHER OUTRO PACOTE"
          : this.account.currency < this.account.boosterPrice
            ? "SALDO INSUFICIENTE"
            : `ABRIR PACOTE · ${this.account.boosterPrice} TIJOLINHOS`;
    };
    const reset = () => {
      opened = false;
      dialog.classList.remove("is-revealed", "is-opening");
      dialog.style.setProperty("--pack-color", selected[3]);
      results.hidden = true;
      results.replaceChildren();
      stage.hidden = false;
      intro.hidden = false;
      title.textContent = selected[1];
      subtitle.textContent = selected[2];
      packName.textContent = selected[1];
      const catalog = this.deckBuilder.getCatalog();
      const model =
        catalog.find((c) => c.nome === selected[4]) ||
        catalog.find((c) => c.booster === selected[0] && c.imagem);
      const source = window.CYBERDUEL_IMAGE_ASSETS?.[model?.imagem];
      if (source) {
        artwork.src = source;
        artwork.hidden = false;
      } else {
        artwork.removeAttribute("src");
        artwork.hidden = true;
      }
      error.textContent = "";
      status.textContent =
        "5 cartas por pacote. Qual será a próxima da sua coleção?";
      refresh();
    };
    for (const faction of factions) {
      const button = this.button("booster-faction", faction[1], () => {
        if (busy) return;
        selected = faction;
        reset();
      });
      button.dataset.faction = faction[0];
      tabs.append(button);
    }
    dialog.append(
      header,
      wallet,
      tabs,
      stage,
      intro,
      status,
      results,
      error,
      buy,
    );
    overlay.append(dialog);
    reset();
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  createBoosterResult(card) {
    const model = this.deckBuilder
      .getCatalogByKey()
      .get(`${card.tipo}:${card.nome}`);
    const item = this.element("article", "title-booster-card");
    item.dataset.rarity = card.nivel || model?.nivel || "utilidade";
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
    const afterClose = this.modalAfterClose;
    this.modalAfterClose = null;
    this.modal = null;
    this.modalRequired = false;
    modal.classList.remove("is-visible");
    if (immediate) modal.remove();
    else setTimeout(() => modal.remove(), 180);
    afterClose?.();
  }

  destroy() {
    document.removeEventListener("keydown", this.handleKeydown);
    document.body.classList.remove("title-terminal-open");
    this.root?.remove();
    this.root = null;
    this.modal = null;
    this.modalAfterClose = null;
    this.modalRequired = false;
  }
}
