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
      ? Boolean(
          this.account.user &&
          !this.account.needsRegistration &&
          this.account.faction,
        )
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
    this.root.append(atmosphere, this.createMatrixRain(), shell);
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

  createMatrixRain() {
    clearInterval(this.matrixTimer);
    const streams = [];
    const rain = this.element("div", "title-matrix");
    rain.setAttribute("aria-hidden", "true");
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZアイウエオカキクケコ";
    for (let column = 0; column < 24; column++) {
      const stream = this.element("div", "title-matrix-stream");
      stream.style.left = `${((column + 0.5) * 100) / 24}%`;
      stream.style.animationDuration = `${10 + Math.random() * 12}s`;
      stream.style.animationDelay = `${-Math.random() * 22}s`;
      const characters = Array.from(
        { length: 8 + Math.floor(Math.random() * 9) },
        () => alphabet[Math.floor(Math.random() * alphabet.length)],
      );
      stream.append(
        this.element("span", "title-matrix-trail", characters.join("\n")),
        this.element("span", "title-matrix-head", characters.at(-1)),
      );
      rain.append(stream);
      streams.push({
        characters,
        trail: stream.children[0],
        head: stream.children[1],
      });
    }
    this.matrixTimer = setInterval(() => {
      if (
        document.hidden ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      )
        return;
      for (const { characters, trail, head } of streams) {
        const index = Math.floor(Math.random() * characters.length);
        const offset = 1 + Math.floor(Math.random() * (alphabet.length - 1));
        characters[index] =
          alphabet[
            (alphabet.indexOf(characters[index]) + offset) % alphabet.length
          ];
        trail.textContent = characters.join("\n");
        head.textContent =
          alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }, 180);
    return rain;
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
        art: "menu_cartas",
        kicker: "SUA PRÓXIMA JOGADA",
        description: "Monte seu deck. Descubra novas possibilidades.",
        action: "EXPLORAR COLEÇÃO",
      },
      {
        id: "ranking",
        title: "LEADERBOARD",
        art: "leaderboard",
        kicker: "OS NOMES DE NEOFLORIPA",
        description: "Veja quem domina a arena.",
        action: "VER RANKING",
      },
      {
        id: "tutorial",
        title: "TUTORIAL E REGRAS",
        art: "tutoriais_regras",
        kicker: "APRENDA A DUELAR",
        description: "Consulte as regras ou treine com a ElenAI.",
        action: "EXPLORAR TUTORIAL E REGRAS",
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
    // Cartas extras ficam fora da tela para entrar no arraste sem piscar.
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

  // Offsets -1, 0 e 1 são visíveis; ±2 aguardam fora da tela.
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
          [
            "Partida aleatória",
            "Ranqueada · adversário por pontuação",
            "partida_aleatoria",
            () => this.callbacks.onMatchmaking(),
            "deck",
          ],
          [
            "Partida privada",
            "Crie uma sala ou entre pelo código de um amigo. Não rende tijolinhos.",
            "partida_privada",
            () => this.openCategoryOptions("privadas"),
            "none",
          ],
          [
            "Clube secreto",
            this.account?.clubUnlocked ? "Escolha uma das quatro mesas e insira o código da apresentação" : "BLOQUEADO · Conquiste 3 vitórias contra jogadores",
            "clube_secreto",
            this.account?.clubUnlocked ? () => this.openSecretClub() : null,
            "account",
          ],
          [
            "Partida do Conselho",
            this.account?.councilMember ? "Reserve um canto da mesa por 1 minuto e insira o código" : "BLOQUEADO · Entre no top 10 do ranking para fazer parte do Conselho",
            "conselho",
            this.account?.councilMember ? () => this.openCouncil() : null,
            "account",
          ],
        ],
      },
      cartas: {
        title: "Suas cartas",
        rows: [
          [
            "Deck Builder",
            "Sua coleção, sua estratégia",
            "montar_deck",
            () => this.callbacks.onDeck(),
          ],
          [
            "Abrir boosters",
            "Abra os pacotes do seu inventário",
            "abrir_boosters",
            () => this.openBoosterInventory(),
          ],
          [
            "Comprar boosters",
            "Pacotes para sua coleção",
            "comprar_booster",
            () => this.openBoosterShop(),
          ],
          [
            "Anunciar cartas",
            "Negocie com outros duelistas",
            "anunciar_cartas",
            () => this.openPlayerMarket("sell"),
          ],
          [
            "Visualizar anúncios de cartas",
            "Encontre sua próxima carta",
            "visualizar_anuncios",
            () => this.openPlayerMarket(),
          ],
        ],
      },
      privadas: {
        title: "Partida privada",
        rows: [
          ["Criar sala", "Gere um convite por código ou QR", "partida_privada", () => this.callbacks.onCreateRoom(), "deck"],
          ["Entrar por código", "Use o código de seis números de uma sala", "entrar_codigo", () => this.openRoomDialog("join"), "deck"],
        ],
      },
      tutorial: {
        title: "Tutorial e regras",
        rows: [
          ["Visualizar Regras", "Entenda o deck, as rodadas e os modos de jogo", "visualizar_regras", () => this.openRules(), "none"],
          ["Repetir tutorial", "Treine com a ElenAI", "repetir_tutorial", () => this.callbacks.onTutorial?.(), "none"],
        ],
      },
      ranking: {
        title: "Leaderboard",
        rows: [
          [
            "Ranking de duelistas",
            "Os nomes que dominam NeoFloripa",
            "leaderboard",
            () => this.openLeaderboard(),
            "none",
          ],
        ],
      },
      perfil: {
        title: this.account?.nickname || this.account?.user || "Meu perfil",
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
    // Não desabilite o botão: ele precisa receber eventos de arraste.
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
      entry.el.setAttribute(
        "aria-hidden",
        String(Math.abs(entry.offset) === 2),
      );
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
      action.textContent = item.handler ? "ABRIR  ›" : ["conselho", "clube_secreto"].includes(item.art) ? "BLOQUEADO" : "EM BREVE";
      action.disabled = !item.handler;
    }
    this.fitMenuTitle(title);
  }

  // Reduz títulos quebrados em duas linhas após o layout.
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

  playMenuClick() {
    const volume = this.settings?.effects(0.5) ?? 0.5;
    if (!volume) return;
    this.menuClickAudio ||= new Audio("assets/sons/clique-menu.mp3");
    this.menuClickAudio.volume = volume;
    this.menuClickAudio.currentTime = 0;
    this.menuClickAudio.play().catch(() => {});
  }

  playMenuSwipe() {
    const volume = this.settings?.effects(0.5) ?? 0.5;
    if (!volume || typeof Audio === "undefined") return;
    this.menuSwipeAudio ||= new Audio("assets/sons/swipe-menu.mp3");
    this.menuSwipeAudio.volume = volume;
    this.menuSwipeAudio.currentTime = 0;
    this.menuSwipeAudio.play().catch(() => {});
  }

  selectCategory(index) {
    if (this.cardMenuState.mode !== "categories" || this.cardMenuTransitioning)
      return;
    if (this.cardMenuState.categoryIndex === index) return;
    this.playMenuSwipe();
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
    this.playMenuSwipe();
    return true;
  }

  handleCardClick(card) {
    if (this.cardMenuDragged || this.cardMenuTransitioning) return;
    const position = card.dataset.position;
    if (position === "left") return this.navigateCardMenu(-1);
    if (position === "right") return this.navigateCardMenu(1);
    this.playMenuClick();
    const state = this.cardMenuState;
    const idx = Number(card.dataset.itemIndex);
    if (state.mode === "categories")
      this.openCategoryOptions(state.items[idx].id);
    else this.triggerOptionAction(state.items[idx]);
  }

  handleCardMenuAction() {
    if (this.cardMenuTransitioning) return;
    this.playMenuClick();
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
    if (this.cardMenuTransitioning) return;
    if (kind === "ranking") return this.runMenuAction(() => this.openLeaderboard(), "none");
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
    const parentState = this.cardMenuState.mode === "options" ? this.cardMenuState : null;
    this.transitionCardMenu(() => {
      this.cardMenuState = {
        mode: "options",
        parentState,
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
    if (this.cardMenuState.parentState) {
      const parentState = this.cardMenuState.parentState;
      this.transitionCardMenu(() => { this.cardMenuState = parentState; });
      return;
    }
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

  // Gira o carrossel e repinta apenas a carta que saiu da tela.
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
    // Atualiza as referências dos botões após girar o carrossel.
    this.cardMenuEls.cards = [
      byOffset.get(-1),
      byOffset.get(0),
      byOffset.get(1),
    ];
    this.cardMenuEls.ghosts = {
      left: byOffset.get(-2),
      right: byOffset.get(2),
    };
    this.updateCaption();
    this.playMenuSwipe();
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

    // Aplica apenas a posição mais recente do arraste a cada frame.
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

    // Remove os estilos de arraste ao voltar às posições definidas no CSS.
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
      const direction = moved && Math.abs(t) > threshold ? (t > 0 ? 1 : -1) : 0;
      let committed = false;
      if (direction) {
        this.cardMenuDragged = true;
        setTimeout(() => {
          this.cardMenuDragged = false;
        }, 60);
        committed = this.commitRingDrag(direction);
      }
      // Finaliza o arraste na posição de repouso, mesmo ao cancelar.
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
      ["◇", "CARTEIRINHA", () => this.openProfileScreen()],
      ["⚙", "AJUSTES", () => this.openSettingsDialog()],
    ]) {
      const button = this.button("card-menu__shortcut", "", handler, label);
      const mark = this.element("span", "", icon);
      if (label === "CARTEIRINHA" && this.account?.avatar) {
        const image = this.element("img", "profile-shortcut-avatar");
        image.src = this.account.avatar;
        image.alt = "";
        mark.replaceChildren(image);
      }
      button.append(
        mark,
        this.element(
          "small",
          "",
          label === "CARTEIRINHA" && this.account?.user
            ? this.account.nickname || this.account.user
            : label,
        ),
      );
      nav.append(button);
    }
    return nav;
  }

  runMenuAction(handler, requirement = "account") {
    this.closeModal(true);
    if (requirement !== "none" && !this.account?.user)
      return this.openAuthDialog();
    if (this.account?.needsRegistration) return this.openRegistrationDialog();
    if (requirement !== "none" && !this.account?.faction)
      return this.openFactionDialog();
    if (requirement === "deck" && !this.deckSummary().deckReady) {
      this.setStatus("Monte e salve seu deck antes de jogar.", "warning");
      return this.callbacks.onDeck();
    }
    handler();
  }

  openCouncil() {
    if (this.modal) return;
    if (!this.account?.councilMember) {
      this.setStatus("Entre no top 10 do ranking para fazer parte do Conselho.", "warning");
      return;
    }
    const overlay = this.createModal("council");
    const dialog = this.element("section", "title-dialog title-club-dialog council-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Mesa do Conselho");
    const status = this.element("p", "club-tables-status", "Carregando mesa…");
    status.setAttribute("role", "status");
    const error = this.element("p", "title-dialog__error");
    error.setAttribute("role", "alert");
    const table = this.element("div", "council-table");
    table.append(this.element("strong", "council-table__name", "CONSELHO"));
    const form = this.element("form", "club-table-entry");
    form.hidden = true;
    const label = this.element("label", "title-room-label", "Código exibido na apresentação do Conselho");
    label.htmlFor = "council-code";
    const input = this.element("input", "title-room-input");
    input.id = "council-code";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.autocomplete = "one-time-code";
    input.placeholder = "000000";
    input.required = true;
    const submit = this.element("button", "title-dialog__confirm", "ENTRAR NA MESA");
    submit.type = "submit";
    form.append(label, input, submit);
    const close = this.button("title-dialog__cancel", "VOLTAR", () => this.closeModal());
    let current = null, selected = null, expiresAt = 0, offset = 0, busy = false;
    const render = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now() - offset) / 1000));
      if (selected && (!remaining || current?.locked || current?.occupiedSeats.includes(selected))) {
        selected = null;
        form.hidden = true;
        input.value = "";
      }
      buttons.forEach((button, index) => {
        const seat = index + 1;
        const occupied = current?.occupiedSeats.includes(seat);
        const reserved = current?.reservations.some(r => r.seat === seat && r.expiresAt > Date.now() + offset);
        button.disabled = busy || !current?.available || occupied || reserved;
        button.textContent = `CANTO ${seat} · ${occupied ? "OCUPADO" : selected === seat ? "SEU LUGAR RESERVADO" : reserved ? "RESERVADO" : "RESERVAR"}`;
      });
      submit.disabled = busy || !selected || !current?.available;
      input.disabled = busy;
      if (selected) status.textContent = `Seu canto está reservado por ${remaining}s. Insira o código da apresentação.`;
      else status.textContent = current?.locked ? "Já existe uma partida acontecendo na mesa do Conselho." : current?.available ? "Escolha um canto. Você terá 1 minuto para inserir o código." : "A apresentação do Conselho está offline.";
    };
    const buttons = [1, 2].map(seat => {
      const button = this.button("club-table council-table__seat", `CANTO ${seat}`, () => {
        if (busy) return;
        busy = true;
        error.textContent = "";
        render();
        this.callbacks.onReserveCouncilSeat(seat, response => {
          if (this.modal !== overlay) {
            if (response.ok) this.callbacks.onReleaseCouncilSeat();
            return;
          }
          busy = false;
          if (response.ok) {
            selected = seat;
            expiresAt = response.expiresAt;
            offset = response.serverNow - Date.now();
            form.hidden = false;
            input.value = "";
            input.focus();
          } else error.textContent = response.error;
          render();
        });
      }, `Reservar canto ${seat}`);
      table.append(button);
      return button;
    });
    input.addEventListener("input", () => { input.value = this.sanitizeRoomCode(input.value); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      render();
      if (submit.disabled) return;
      const code = this.sanitizeRoomCode(input.value);
      if (code.length !== 6) { error.textContent = "O código precisa ter 6 números."; return; }
      busy = true;
      error.textContent = "";
      render();
      this.modalRequired = true;
      this.callbacks.onJoinClubTable(5, code, selected, response => {
        this.modalRequired = false;
        if (this.modal !== overlay) return;
        busy = false;
        if (response.ok) return this.closeModal(true);
        error.textContent = response.error;
        render();
      });
    });
    dialog.append(this.element("h2", "", "Partida do Conselho"), table, form, error, status, close);
    overlay.append(dialog);
    const unwatch = this.callbacks.onWatchClubTables(response => {
      if (this.modal !== overlay) return;
      if (!response.ok) { error.textContent = response.error; return; }
      current = response.council;
      if (current) offset = current.serverNow - Date.now();
      render();
    });
    const timer = setInterval(render, 250);
    this.councilCleanup = () => {
      clearInterval(timer);
      unwatch?.();
      this.callbacks.onReleaseCouncilSeat();
      this.councilCleanup = null;
    };
    this.modalAfterClose = this.councilCleanup;
    render();
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => { overlay.classList.add("is-visible"); close.focus(); });
  }

  openSecretClub() {
    if (this.modal) return;
    if (!this.account?.user) return this.openAuthDialog();
    if (!this.account.clubUnlocked) {
      this.setStatus("Conquiste 3 vitórias contra jogadores para entrar no Clube secreto.", "warning");
      return;
    }
    const overlay = this.createModal("secret-club");
    const dialog = this.element("section", "title-dialog title-club-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Mesas do Clube secreto");
    const close = this.button("title-dialog__cancel", "VOLTAR", () => this.closeModal());
    const list = this.element("div", "club-tables");
    const form = this.element("form", "club-table-entry");
    form.hidden = true;
    const label = this.element("label", "title-room-label");
    label.htmlFor = "club-table-code";
    const input = this.element("input", "title-room-input");
    input.id = "club-table-code";
    input.inputMode = "numeric";
    input.maxLength = 6;
    input.placeholder = "000000";
    input.autocomplete = "one-time-code";
    const seatLabel = this.element("label", "title-room-label", "Qual jogador você quer ser?");
    seatLabel.htmlFor = "club-table-player";
    const seat = this.element("select", "title-auth-input");
    seat.id = "club-table-player";
    seat.setAttribute("aria-label", "Escolher jogador");
    seat.required = true;
    const placeholder = this.element("option", "", "Escolha o jogador");
    placeholder.value = "";
    placeholder.disabled = true;
    seat.append(placeholder);
    const seatOptions = [1, 2].map(player => {
      const option = this.element("option", "", `Jogador ${player}`);
      option.value = String(player);
      seat.append(option);
      return option;
    });
    const submit = this.element("button", "title-dialog__confirm title-room-create", "ENTRAR COMO JOGADOR");
    submit.type = "submit";
    form.append(seatLabel, seat, label, input, submit);
    const error = this.element("p", "title-dialog__error");
    error.setAttribute("role", "alert");
    const status = this.element("p", "club-tables-status", "Carregando mesas…");
    status.setAttribute("role", "status");
    let selected = null, busy = false;
    let tables = [1, 2, 3, 4].map(table => ({ table, players: 0, available: false, locked: false }));
    const buttons = tables.map(({ table }) => {
      const button = this.button("club-table", "", () => {
        if (busy) return;
        selected = table;
        busy = true;
        form.hidden = true;
        label.textContent = `Código exibido na apresentação da Mesa ${table}`;
        input.setAttribute("aria-label", `Código da Mesa ${table}`);
        input.value = "";
        seat.value = "";
        error.textContent = "";
        render();
        status.textContent = "Solicitando o código na apresentação…";
        this.callbacks.onRequestClubCode(table, response => {
          if (this.modal !== overlay) return;
          busy = false;
          if (response.ok) form.hidden = false;
          else error.textContent = response.error || "Não foi possível exibir o código.";
          status.textContent = "Escolha seu jogador e confira o código na apresentação.";
          render();
          if (response.ok) seat.focus();
        });
      }, `Mesa ${table}`);
      button.append(this.element("strong", "", `MESA ${table}`), this.element("span"), this.element("small"));
      button.disabled = true;
      list.append(button);
      return button;
    });
    const render = () => {
      tables.forEach((table, index) => {
        const button = buttons[index];
        button.disabled = busy || !table.available || table.locked;
        button.setAttribute("aria-pressed", String(selected === table.table));
        button.children[1].textContent = `Jogadores prontos: ${table.players}/2`;
        button.children[2].textContent = table.locked ? "TRANCADA · EM PARTIDA" : table.available ? "ENTRAR NA MESA" : "APRESENTAÇÃO OFFLINE";
      });
      submit.disabled = busy || !tables.find(table => table.table === selected)?.available;
      const occupied = tables.find(table => table.table === selected)?.occupiedSeats || [];
      seatOptions.forEach((option, index) => { option.disabled = occupied.includes(index + 1); });
      if (occupied.includes(Number(seat.value))) seat.value = "";
      close.disabled = input.disabled = seat.disabled = busy;
      this.modalRequired = busy;
    };
    input.addEventListener("input", () => {
      input.value = this.sanitizeRoomCode(input.value);
      error.textContent = "";
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (submit.disabled) return;
      const code = this.sanitizeRoomCode(input.value);
      if (code.length !== 6) {
        error.textContent = "O código precisa ter 6 números.";
        input.focus();
        return;
      }
      const player = Number(seat.value);
      if (![1, 2].includes(player)) {
        error.textContent = "Escolha o jogador 1 ou 2.";
        seat.focus();
        return;
      }
      busy = true;
      error.textContent = "";
      status.textContent = `Entrando na Mesa ${selected}…`;
      render();
      this.callbacks.onJoinClubTable(selected, code, player, response => {
        if (this.modal !== overlay) return;
        busy = false;
        if (response.ok) return this.closeModal(true);
        error.textContent = response.error || "Não foi possível entrar na mesa.";
        status.textContent = "Confira o código na apresentação da mesa escolhida.";
        render();
      });
    });
    dialog.append(
      this.element("small", "player-id__brand", "CYBERDUEL / NEOFLORIPA"),
      this.element("h2", "", "Clube secreto"),
      this.element("p", "", "Escolha sua mesa e digite o código exibido na apresentação correspondente."),
      list, form, error, status, close,
    );
    overlay.append(dialog);
    render();
    this.clubTablesCleanup = this.callbacks.onWatchClubTables(response => {
      if (this.modal !== overlay) return;
      if (!response.ok) { status.textContent = response.error; return; }
      tables = response.tables;
      status.textContent = "O duelo começa automaticamente com dois jogadores.";
      render();
    });
    this.modalAfterClose = () => {
      this.clubTablesCleanup?.();
      this.clubTablesCleanup = null;
    };
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => { overlay.classList.add("is-visible"); close.focus(); });
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
          handler ? "›" : ["conselho", "clube_secreto"].includes(art) ? "BLOQUEADO" : "EM BREVE",
        ),
      );
      row.disabled = !handler;
      list.append(row);
    });
    dialog.append(list);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  openProfileScreen() {
    if (this.modal) return;
    if (!this.account?.user) return this.openAuthDialog();
    if (this.account.needsRegistration) return this.openRegistrationDialog();
    const overlay = this.createModal("profile");
    overlay.classList.add("profile-screen");
    document.body.append(overlay);
    this.modalAfterClose = () => this.account.notify();
    const dialog = this.element("section", "profile-panel player-id" + (this.account.councilMember ? " player-id--council" : ""));
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Carteirinha do clube");
    const header = this.element("header", "profile-header");
    const close = this.button(
      "profile-close",
      "×",
      () => this.closeModal(),
      "Fechar carteirinha",
    );
    header.append(this.element("h2", "", "Carteirinha do clube"), close);
    const avatar = this.button(
      "profile-avatar",
      "",
      () => {
        picker.hidden = !picker.hidden;
        avatar.setAttribute("aria-expanded", String(!picker.hidden));
      },
      "Trocar foto de perfil",
    );
    avatar.setAttribute("aria-expanded", "false");
    avatar.setAttribute("aria-controls", "profile-photo-picker");
    const preview = this.element("img");
    preview.alt = "Prévia da foto de perfil";
    const initials = this.element("span");
    const name = this.element("strong", "player-id__name");
    avatar.append(preview, initials);
    let photo = this.account.avatar || "";
    const nicknameLabel = this.element("label", "profile-field", "APELIDO");
    const nickname = this.element("input", "title-auth-input");
    nickname.value = this.account.nickname || this.account.user;
    nickname.maxLength = 32;
    nickname.autocomplete = "nickname";
    nickname.setAttribute("aria-label", "Apelido");
    nicknameLabel.append(nickname);
    const identity = this.element(
      "p",
      "profile-identity",
      `@${this.account.user}`,
    );
    const userHint = this.element(
      "p",
      "profile-note",
      this.account.authProvider === "local"
        ? "Conta local de desenvolvimento."
        : "Seu username é único e não muda. Use sua conta Google para entrar.",
    );
    const stats = this.element("dl", "player-id__stats");
    for (const [label, value] of [
      ["Partidas contra jogadores", this.account.humanGames],
      ["Vitórias contra jogadores", this.account.humanWins],
      ["Partidas no Clube", this.account.clubGames],
      ["Vitórias no Clube", this.account.clubWins],
    ]) {
      const stat = this.element("div");
      stat.append(
        this.element("dt", "", label),
        this.element("dd", "", String(value || 0)),
      );
      stats.append(stat);
    }
    const access = this.element(
      "p",
      "player-id__access",
      this.account.clubUnlocked
        ? "ACESSO AO CLUBE LIBERADO"
        : "ACESSO AO CLUBE BLOQUEADO",
    );
    access.dataset.unlocked = String(!!this.account.clubUnlocked);
    const picker = this.element("div", "profile-photo-picker");
    picker.id = "profile-photo-picker";
    picker.hidden = true;
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Escolher foto de perfil");
    const options = (this.account.profilePhotos || []).map((src) => {
      const name = src
        .split("/")
        .pop()
        .replace("_icon.png", "")
        .replaceAll("_", " ");
      const option = this.button(
        "profile-photo-option",
        "",
        () => {
          if (busy) return;
          photo = src;
          picker.hidden = true;
          avatar.setAttribute("aria-expanded", "false");
          avatar.focus();
          status.textContent = "As alterações serão salvas ao fechar.";
          renderPreview();
        },
        `Usar foto: ${name}`,
      );
      const image = this.element("img");
      image.src = src;
      image.alt = name;
      option.append(image);
      picker.append(option);
      return option;
    });
    const status = this.element("p", "profile-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const error = this.element("p", "title-dialog__error");
    error.setAttribute("role", "alert");
    let busy = false;
    const refresh = () => {
      avatar.disabled =
        close.disabled =
        nickname.disabled =
          busy;
      options.forEach((option) => {
        option.disabled = busy;
      });
      this.modalRequired = busy;
    };
    const renderPreview = () => {
      name.textContent = nickname.value.trim() || this.account.user;
      preview.hidden = !photo;
      initials.hidden = Boolean(photo);
      if (photo) preview.src = photo;
      else preview.removeAttribute("src");
      initials.textContent = Array.from(
        nickname.value.trim() || this.account.user,
      )
        .slice(0, 2)
        .join("")
        .toUpperCase();
      options.forEach((option, index) =>
        option.setAttribute(
          "aria-pressed",
          String(this.account.profilePhotos[index] === photo),
        ),
      );
    };
    nickname.addEventListener("input", () => {
      status.textContent = "";
      renderPreview();
    });
    this.modalBeforeClose = async () => {
      if (busy) return;
      const value = nickname.value.trim();
      if (!value || Array.from(value).length > 32) {
        error.textContent = "Use um apelido de 1 a 32 caracteres.";
        nickname.focus();
        return;
      }
      if (value === (this.account.nickname || this.account.user) && photo === (this.account.avatar || "")) {
        this.closeModal(true);
        return;
      }
      busy = true;
      refresh();
      error.textContent = "";
      status.textContent = "Salvando…";
      try {
        await this.account.updateProfile(value, photo);
        if (this.modal !== overlay) return;
        this.closeModal(true);
      } catch (exception) {
        error.textContent =
          exception.message || "Não foi possível salvar o perfil.";
        status.textContent = "";
      } finally {
        busy = false;
        if (this.modal === overlay) refresh();
      }
    };
    dialog.append(
      this.element("small", "player-id__brand", "CYBERDUEL / NEOFLORIPA"),
      header,
      avatar,
      name,
      this.element("p", "player-id__faction", this.account.faction?.toUpperCase() || "SEM FACÇÃO"),
      this.element("p", "profile-note", "Clique na foto para trocar."),
      picker,
      identity,
      userHint,
      this.element("p", "profile-note", `${this.account.gamesPlayed || 0} partidas no total`),
      stats,
      ...(this.account.councilMember ? [this.element("p", "player-id__council", "✦ MEMBRO DO CONSELHO · TOP 10 ✦")] : []),
      access,
      this.element(
        "p",
        "player-id__note",
        this.account.clubUnlocked
          ? "Apresente esta carteirinha ao segurança."
          : "Conquiste 3 vitórias contra jogadores para liberar o acesso. Partidas contra o bot não contam.",
      ),
      nicknameLabel,
      this.element(
        "p",
        "profile-note",
        "Até 32 caracteres. Seu apelido pode ser igual ao de outros jogadores.",
      ),
      error,
      status,
      this.element("p", "profile-note", "Apelido e foto são salvos automaticamente ao fechar."),
    );
    overlay.append(dialog);
    renderPreview();
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      close.focus();
    });
  }

  createTopbar() {
    const topbar = this.element("header", "title-topbar");
    const system = this.element("div", "title-system-id");
    system.append(
      this.element("span", "title-system-id__mark", "v1.0.0"),
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
        ? `◉ ${this.account.nickname || (this.account.needsRegistration ? "COMPLETAR CADASTRO" : this.account.user)} // SAIR`
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
    const backgroundRow = this.element(
      "label",
      "title-setting title-setting--toggle",
    );
    const background = this.element("input");
    background.type = "checkbox";
    background.checked = this.settings.get("animatedBackground") !== 0;
    background.addEventListener("change", () => {
      this.settings.set("animatedBackground", background.checked);
    });
    backgroundRow.append(
      background,
      this.element("span", "", "FUNDO ANIMADO DA PARTIDA"),
    );
    controls.append(backgroundRow);
    const skipRow = this.element(
      "label",
      "title-setting title-setting--toggle",
    );
    const skip = this.element("input");
    skip.type = "checkbox";
    skip.checked = this.settings.get("skipBattleAnnouncements") === 1;
    skip.addEventListener("change", () =>
      this.settings.set("skipBattleAnnouncements", skip.checked),
    );
    skipRow.append(
      skip,
      this.element("span", "", "PULAR AVISOS DE INÍCIO E DE TURNO"),
    );
    controls.append(skipRow);
    const actions = this.element(
      "div",
      "title-dialog__actions title-dialog__actions--triple",
    );
    const adminButton = this.button("title-dialog__cancel", "ADMIN", () => {
      this.closeModal(true);
      this.openAdminGrantDialog();
    });
    if (this.account?.isAdmin) actions.append(adminButton);
    actions.append(
      this.button("title-dialog__cancel", "RESTAURAR", () => {
        this.settings.reset();
        background.checked = true;
        skip.checked = false;
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
    if (this.modal || !this.account?.isAdmin) return;
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
          const payload = await this.account.grantCurrency(target, amount);
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
        await this.account.grantCardsByUsername(target, [
          { tipo: cardType.value, nome: name, quantidade: amount },
        ]);
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
        await this.account.resetCollection(target);
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

    form.append(username, currencySection, deckSection, cardSection);
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
    const error = this.element("span", "title-dialog__error");
    error.setAttribute("role", "alert");
    const googleButton = this.element(
      "div",
      "title-google-login",
      "Carregando login com Google…",
    );
    const retry = this.button(
      "title-small-button",
      "TENTAR GOOGLE NOVAMENTE",
      () => loadGoogle(),
    );
    retry.hidden = true;
    const loadGoogle = () => {
      error.textContent = "";
      retry.hidden = true;
      googleButton.textContent = "Carregando login com Google…";
      this.account.mountGoogleButton(googleButton, (exception) => {
        error.textContent = exception.message;
        retry.hidden = false;
      });
    };
    dialog.append(googleButton, retry, error);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    this.account
      .request("/api/auth/options", { auth: false })
      .then((options) => {
        if (this.modal !== overlay) return;
        if (!options.localLogin) return loadGoogle();
        googleButton.hidden = true;
        const form = this.element("form", "title-auth-form");
        const label = this.element("label", "", "NOME PARA TESTE LOCAL");
        const username = this.element("input", "title-auth-input");
        Object.assign(username, {
          name: "username",
          type: "text",
          value: "dev",
          required: true,
          minLength: 3,
          maxLength: 18,
        });
        username.setAttribute("aria-label", "Nome para teste local");
        label.append(username);
        const enter = this.element(
          "button",
          "title-dialog__confirm",
          "ENTRAR LOCALMENTE",
        );
        enter.type = "submit";
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          enter.disabled = true;
          error.textContent = "";
          try {
            await this.account.localLogin(username.value);
            this.closeModal(true);
          } catch (exception) {
            error.textContent = exception.message;
          } finally {
            enter.disabled = false;
          }
        });
        form.append(label, enter);
        dialog.append(
          this.element(
            "p",
            "",
            "Conta de desenvolvimento nesta máquina. Não precisa de Google.",
          ),
          form,
        );
        username.focus();
      })
      .catch(() => loadGoogle());
  }

  openRegistrationDialog() {
    if (this.modal || !this.account?.needsRegistration) return;
    const overlay = this.createModal("registration");
    this.modalRequired = true;
    const dialog = this.element("form", "title-dialog title-auth-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Escolha seu nick único");
    const usernameLabel = this.element("label", "", "NICK (ÚNICO)");
    const username = this.element("input", "title-auth-input");
    username.type = "text";
    username.name = "username";
    username.autocomplete = "username";
    username.placeholder = "SEU NICK";
    username.required = true;
    username.minLength = 3;
    username.maxLength = 24;
    username.pattern = "[a-zA-Z0-9_.\\-]{3,24}";
    username.readOnly = !this.account.needsUsername;
    username.value = this.account.needsUsername ? "" : this.account.user;
    username.setAttribute("aria-label", "Nick único");
    usernameLabel.append(username);
    const error = this.element("span", "title-dialog__error");
    error.setAttribute("role", "alert");
    const save = this.element("button", "title-dialog__confirm", "CONTINUAR");
    save.type = "submit";
    const actions = this.element("div", "title-dialog__actions");
    actions.append(
      this.button("title-dialog__cancel", "SAIR DA CONTA", () =>
        this.account.logout(),
      ),
      save,
    );
    dialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (save.disabled) return;
      const handle = username.value.trim();
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(handle)) {
        error.textContent =
          "Use um nick de 3 a 24 caracteres: letras, números, ponto, hífen ou sublinhado.";
        username.focus();
        return;
      }
      save.disabled = true;
      error.textContent = "";
      try {
        await this.account.completeRegistration(handle);
      } catch (exception) {
        error.textContent =
          exception.message || "Não foi possível concluir o cadastro.";
        save.disabled = false;
      }
    });
    dialog.append(
      this.element("h2", "", "Complete seu cadastro"),
      this.element(
        "p",
        "",
        "Escolha seu nick único para identificar a conta. A ElenAI vai pedir seu apelido durante o tutorial.",
      ),
      usernameLabel,
      this.element(
        "p",
        "",
        "Nick: 3 a 24 caracteres, sem espaços. Letras, números, ponto, hífen ou sublinhado. Não poderá ser alterado depois.",
      ),
      error,
      actions,
    );
    overlay.append(dialog);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      username.focus();
    });
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

    actions.append(
      this.createAction({
        className: "title-action title-action--compact",
        kicker: "DUELO COM AMIGOS",
        title: "CRIAR OU ENTRAR EM SALA",
        description: "Convide por QR ou use um código",
        icon: "+",
        disabled: !summary.deckReady,
        handler: () => this.openRoomDialog(),
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

  playerPresentation(profile = {}) {
    const card = this.element("article", "versus-player");
    if (profile.avatar) {
      const photo = this.element("img", "versus-avatar");
      photo.src = profile.avatar;
      photo.alt = `Foto de ${profile.nickname || "Duelista"}`;
      card.append(photo);
    } else
      card.append(
        this.element(
          "div",
          "versus-avatar versus-initials",
          Array.from(profile.nickname || "?")
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        ),
      );
    card.append(
      this.element("h3", "", profile.nickname || "Duelista"),
      this.element(
        "p",
        "versus-rank",
        `${profile.rank || "Bronze"} · ${profile.rating ?? 1000} pontos`,
      ),
    );
    return card;
  }

  showVersus(profiles, player, done) {
    this.closeModal(true);
    const overlay = this.createModal("versus");
    this.modalRequired = true;
    const dialog = this.element("section", "title-dialog versus-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Apresentação da partida");
    dialog.append(this.element("h2", "", "DUELO ENCONTRADO"));
    const matchup = this.element("div", "versus-matchup");
    matchup.append(
      this.playerPresentation(profiles?.[player]),
      this.element("strong", "versus-mark", "VS"),
      this.playerPresentation(profiles?.[3 - player]),
    );
    dialog.append(matchup, this.element("p", "", "Preparando a arena…"));
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    clearTimeout(this.versusTimer);
    this.versusTimer = setTimeout(() => {
      if (this.modal !== overlay) return;
      this.closeModal(true);
      done();
    }, 4000);
  }

  openMatchmaking(multiplayer) {
    if (this.modal) return;
    const overlay = this.createModal("matchmaking");
    this.modalRequired = true;
    const dialog = this.element("section", "title-dialog matchmaking-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Buscar partida ranqueada");
    const status = this.element("p", "", "Entrando na fila…");
    status.setAttribute("role", "status");
    const cancel = this.button("title-small-button", "CANCELAR BUSCA", () => {
      cancel.disabled = true;
      multiplayer.cancelMatchmaking((result) => {
        if (this.modal !== overlay) return;
        if (result.ok) this.closeModal(true);
        else {
          status.textContent = result.error;
          cancel.disabled = false;
        }
      });
    });
    dialog.append(
      this.element("h2", "", "Buscando adversário"),
      status,
      this.element(
        "p",
        "",
        "Sorteamos um jogador com rank próximo. A faixa aumenta conforme a espera.",
      ),
      cancel,
    );
    overlay.append(dialog);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      cancel.focus();
    });
    multiplayer.joinMatchmaking((result) => {
      if (this.modal !== overlay) return;
      if (result.ok)
        status.textContent = `${result.profile.rank} · ${result.profile.rating} pontos — aguardando outro duelista…`;
      else {
        this.closeModal(true);
        this.setStatus(
          result.error || "Não foi possível entrar na fila.",
          "error",
        );
      }
    });
  }

  async openLeaderboard() {
    if (this.modal) return;
    const overlay = this.createModal("leaderboard");
    const dialog = this.element("section", "title-dialog leaderboard-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Leaderboard");
    const status = this.element("p", "", "Carregando ranking…");
    status.setAttribute("role", "status");
    const close = this.button("title-small-button", "FECHAR", () =>
      this.closeModal(),
    );
    dialog.append(
      this.element("h2", "", "TOP 20 DUELISTAS"),
      this.element(
        "p",
        "",
        "Para entrar no ranking: 5 partidas e 3 vitórias contra jogadores. O top 10 forma o Conselho. Partidas contra o bot não contam.",
      ),
      status,
      close,
    );
    overlay.append(dialog);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      close.focus();
    });
    try {
      const response = await this.account.request("/api/leaderboard", {
        auth: false,
      });
      if (this.modal !== overlay) return;
      status.textContent = response.entries.length
        ? "Classificação por pontos nas partidas aleatórias."
        : "Nenhum cyberduelista cumpriu os requisitos do ranking ainda.";
      if (!response.entries.length) return;
      const table = this.element("table", "leaderboard-table");
      const head = this.element("tr", "");
      for (const label of ["#", "Apelido", "Rank", "Pontos", "V / D"])
        head.append(this.element("th", "", label));
      const thead = this.element("thead", "");
      thead.append(head);
      table.append(thead);
      const body = this.element("tbody", "");
      for (const entry of response.entries) {
        const row = this.element("tr", "");
        row.append(this.element("td", "", String(entry.position)));
        const player = this.element("td", "");
        const identity = this.element("div", "leaderboard-player");
        const avatar = this.element(
          entry.avatar ? "img" : "span",
          "leaderboard-avatar",
        );
        if (entry.avatar) {
          avatar.src = entry.avatar;
          avatar.alt = "";
        } else {
          avatar.textContent = Array.from(entry.nickname || "?")
            .slice(0, 2)
            .join("")
            .toUpperCase();
          avatar.setAttribute("aria-hidden", "true");
        }
        identity.append(avatar, this.element("span", "", entry.nickname));
        player.append(identity);
        row.append(player);
        for (const value of [
          entry.rank,
          entry.rating,
          `${entry.wins} / ${entry.losses}`,
        ])
          row.append(this.element("td", "", String(value)));
        body.append(row);
      }
      table.append(body);
      dialog.append(table);
    } catch (error) {
      if (this.modal === overlay)
        status.textContent =
          error.message || "Não foi possível carregar o ranking.";
    }
  }

  showResumeMatch(code, resume, decline) {
    if (!this.root || this.modal?.dataset.kind === "resume") return;
    this.closeModal(true);
    const overlay = this.createModal("resume");
    this.modalRequired = true;
    const dialog = this.element("section", "title-dialog title-resume-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Voltar à partida");
    const error = this.element("p", "title-auth-error");
    error.setAttribute("role", "alert");
    const choose = (action) => {
      yes.disabled = no.disabled = true;
      error.textContent = "";
      action((result) => {
        if (this.modal !== overlay) return;
        if (result.ok) this.closeModal(true);
        else {
          error.textContent =
            result.error || "Não foi possível concluir. Tente novamente.";
          yes.disabled = no.disabled = false;
        }
      });
    };
    const yes = this.button("title-small-button", "SIM", () => choose(resume));
    const no = this.button("title-small-button", "NÃO", () => choose(decline));
    const actions = this.element("div", "title-dialog__actions");
    actions.append(yes, no);
    dialog.append(
      this.element("h2", "", "Voltar à partida?"),
      this.element(
        "p",
        "",
        `A partida ${code} está em andamento. Ao escolher Não, você perde automaticamente e não poderá voltar.`,
      ),
      error,
      actions,
    );
    overlay.append(dialog);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      yes.focus();
    });
  }

  openRules() {
    if (this.modal) return;
    const overlay = this.createModal("rules");
    const dialog = this.element("section", "title-dialog title-rules-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Regras do Cyberduel");
    const content = this.element("div", "title-rules-content");
    for (const [title, text] of [
      ["Monte seu deck", "Salve um deck de 20 cartas da sua coleção: pelo menos 6 monstros de nível baixo, 4 de nível médio e 2 de nível alto. Cada carta permite até 3 cópias; lendárias permitem 1."],
      ["Jogue suas cartas", "Use as fases de colocação para montar seu campo e as fases de habilidades para ativar os efeitos das cartas. Confira a descrição de cada carta para conhecer seus alvos e condições."],
      ["Vença as rodadas", "O poder total de cada campo define o vencedor da rodada. Empates não pontuam. A partida termina com 4 rodadas vencidas ou após 7 rodadas; vence quem tiver mais rodadas ganhas. Resultados iguais terminam em empate."],
      ["Escolha sua partida", "Jogue solo contra o bot, procure um adversário em Partida aleatória ou convide amigos em Partida privada. Partidas privadas não rendem tijolinhos."],
      ["Entre no Clube secreto", "Conquiste 3 vitórias contra jogadores para liberar as quatro mesas. Escolha uma mesa e insira o código exibido na apresentação correspondente."],
      ["Leaderboard e Conselho", "São necessárias 5 partidas e 3 vitórias contra jogadores para entrar na leaderboard. O top 10 atual forma o Conselho. Na mesa do Conselho, cada canto pode ser reservado por 1 minuto para inserir o código. Partidas contra o bot não contam para esses requisitos."],
      ["Pratique com a ElenAI", "Use Repetir tutorial para aprender os controles e jogar um treino guiado."],
    ]) content.append(this.element("h3", "", title), this.element("p", "", text));
    const close = this.button("title-dialog__cancel", "VOLTAR", () => this.closeModal());
    dialog.append(this.element("h2", "", "Regras do Cyberduel"), content, close);
    overlay.append(dialog);
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => { overlay.classList.add("is-visible"); close.focus(); });
  }

  openRoomDialog(mode = "both") {
    if (this.modal) return;
    const overlay = this.createModal("room-options");
    const dialog = this.element("section", "title-dialog title-join-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Criar ou entrar em sala");
    const label = this.element("label", "title-room-label", "Já tem um convite? Digite o código:");
    label.htmlFor = "title-room-code";
    dialog.append(
      this.element("span", "title-kicker", "DUELO COM AMIGOS"),
      this.element("h2", "", mode === "join" ? "Entrar por código" : "Criar ou entrar em sala"),
      this.element("p", "", "Convide um amigo por código ou QR, ou entre na sala dele. Estas partidas não rendem tijolinhos."),
      ...(mode === "join" ? [] : [this.button("title-dialog__confirm title-room-create", "CRIAR SALA", () => {
        this.closeModal(true);
        this.callbacks.onCreateRoom();
      })]),
      label,
    );
    const input = this.element("input", "title-room-input");
    input.id = "title-room-code";
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
      this.button("title-dialog__confirm", "ENTRAR NA SALA", () => {
        const code = this.sanitizeRoomCode(input.value);
        if (code.length !== 6) {
          error.textContent = "O código precisa ter 6 números.";
          input.focus();
          return;
        }
        this.closeModal(true);
        this.callbacks.onJoinRoom(code);
      }),
    );
    dialog.append(input, error, actions);
    overlay.append(dialog);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    setTimeout(() => input.focus(), 50);
  }

  openFactionDialog() {
    if (this.account?.needsRegistration) return this.openRegistrationDialog();
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

  openPlayerMarket(initialView = "browse") {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("player-market");
    document.body.append(overlay);
    this.modalAfterClose = () => this.account.notify();
    const dialog = this.element("section", "title-dialog player-market");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Mercado entre jogadores");
    const header = this.element("header", "player-market__header");
    const identity = this.element("div", "player-market__identity");
    const title = this.element("h2", "");
    title.append(
      this.element("span", "", "MERCADO"),
      this.element("span", "player-market__accent", "DE CARTAS"),
    );
    identity.append(
      this.element("span", "forge-overline", "CYBERDUEL / ENTRE DUELISTAS"),
      title,
      this.element("p", "", "Sua próxima carta está aqui."),
    );
    const balance = this.element("strong", "");
    const wallet = this.element("div", "player-market__wallet");
    wallet.append(this.element("span", "forge-kicker", "SEU SALDO"), balance);
    header.append(
      this.button(
        "booster-close",
        "←",
        () => this.closeModal(),
        "Fechar mercado",
      ),
      identity,
      wallet,
    );
    const tabs = this.element("nav", "player-market__tabs");
    tabs.setAttribute("aria-label", "Seções do mercado");
    const content = this.element("div", "player-market__content");
    const status = this.element("p", "player-market__status");
    status.setAttribute("role", "status");
    const error = this.element("p", "title-dialog__error");
    error.setAttribute("role", "alert");
    let view = initialView,
      listings = [],
      busy = false,
      loaded = false,
      selectedKey = null;
    const catalog = this.deckBuilder.getCatalog();
    const setBusy = (value) => {
      busy = value;
      dialog.setAttribute("aria-busy", String(value));
      dialog
        .querySelectorAll("button:not(.booster-close), input, select")
        .forEach((control) => {
          control.disabled = value || control.dataset.unavailable === "true";
        });
    };
    const load = async () => {
      listings = await this.account.marketListings();
      loaded = true;
    };
    const act = async (action, body) => {
      if (busy) return;
      error.textContent = "";
      setBusy(true);
      try {
        await this.account.marketTrade(action, body);
        status.textContent =
          action === "listings"
            ? "Anúncio publicado. Suas cartas estão reservadas."
            : action === "cancel"
              ? "Anúncio cancelado. Cartas devolvidas à coleção."
              : "Compra concluída. Cartas adicionadas à coleção.";
        if (action === "listings") {
          view = "mine";
          selectedKey = null;
        }
        await load();
      } catch (exception) {
        error.textContent = exception.message;
        try {
          await load();
        } catch {
          /* Mantém o erro da operação original. */
        }
      } finally {
        if (this.modal === overlay) {
          render();
          setBusy(false);
        }
      }
    };
    const render = () => {
      balance.textContent = `${this.account.currency.toLocaleString("pt-BR")} tijolinhos`;
      tabs.replaceChildren();
      for (const [id, label] of [
        ["browse", "Comprar cartas"],
        ["sell", "Anunciar carta"],
        ["mine", "Meus anúncios"],
      ]) {
        const tab = this.button("title-dialog__cancel", label, () => {
          if (!busy) {
            view = id;
            status.textContent = "";
            error.textContent = "";
            render();
          }
        });
        tab.setAttribute("aria-pressed", String(view === id));
        tabs.append(tab);
      }
      content.replaceChildren();
      if (!loaded) {
        content.append(
          this.element("p", "player-market__empty", "Carregando anúncios…"),
        );
        return;
      }
      if (view === "sell") {
        const choices = catalog
          .map((card) => {
            const owned = this.account.collection[card.key] || 0;
            const inDeck = (this.account.deck || [])
              .filter((c) => `${c.tipo}:${c.nome}` === card.key)
              .reduce((sum, c) => sum + c.quantidade, 0);
            const initial = this.account.starterCollection?.[card.key] || 0;
            return {
              card,
              owned,
              initial,
              available: Math.max(0, owned - Math.max(inDeck, initial)),
            };
          })
          .filter((c) => c.owned > 0);
        if (!choices.some((c) => c.card.key === selectedKey && c.available > 0))
          selectedKey = null;
        if (!selectedKey) {
          const heading = this.element(
            "div",
            "player-market__section-heading player-market__selection-heading",
          );
          heading.append(
            this.element("span", "forge-kicker", "SUA COLEÇÃO"),
            this.element("h3", "", "Escolha uma carta para anunciar"),
          );
          const note = this.element(
            "p",
            "player-market__note",
            "As cópias do kit inicial não podem ser vendidas. Cópias extras ficam disponíveis quando não estão no deck salvo.",
          );
          const search = this.element("input", "title-auth-input");
          search.type = "search";
          search.placeholder = "Buscar na coleção";
          search.setAttribute("aria-label", "Buscar na coleção");
          const grid = this.element(
            "div",
            "player-market__grid player-market__selection",
          );
          const draw = () => {
            grid.replaceChildren();
            const matches = choices.filter((c) =>
              c.card.nome
                .toLocaleLowerCase("pt-BR")
                .includes(search.value.trim().toLocaleLowerCase("pt-BR")),
            );
            for (const choice of matches) {
              const button = this.button(
                "player-market__pick",
                "",
                () => {
                  if (busy || !choice.available) return;
                  selectedKey = choice.card.key;
                  render();
                  dialog.querySelector("#market-quantity")?.focus();
                },
                `Selecionar ${choice.card.nome}`,
              );
              const art = this.element("div", "player-market__art");
              const source =
                window.CYBERDUEL_IMAGE_ASSETS?.[choice.card.imagem];
              if (source) {
                const image = this.element("img", "");
                image.src = source;
                image.alt = choice.card.nome;
                image.loading = "lazy";
                art.append(image);
              }
              art.append(
                this.element(
                  "span",
                  "player-market__badge",
                  `${choice.owned}×`,
                ),
              );
              const details = this.element("div", "player-market__details");
              details.append(
                this.element("strong", "", choice.card.nome),
                this.element(
                  "small",
                  "",
                  choice.available
                    ? `${choice.available} cópias vendáveis`
                    : choice.initial
                      ? "Kit inicial protegido"
                      : "Cópias no deck salvo",
                ),
                this.element(
                  "span",
                  "player-market__pick-action",
                  choice.available
                    ? "Selecionar carta →"
                    : "Indisponível para venda",
                ),
              );
              if (!choice.available) {
                button.disabled = true;
                button.dataset.unavailable = "true";
              }
              button.append(art, details);
              grid.append(button);
            }
            if (!matches.length)
              grid.append(
                this.element(
                  "p",
                  "player-market__empty",
                  "Nenhuma carta encontrada na coleção.",
                ),
              );
          };
          search.addEventListener("input", draw);
          draw();
          content.append(heading, note, search, grid);
          return;
        }
        const workspace = this.element("div", "player-market__sell-workspace");
        const artwork = this.element("aside", "player-market__preview");
        const image = this.element("img", "");
        const cardName = this.element("h3", "");
        const freeCopies = this.element("p", "");
        artwork.append(
          this.element("span", "forge-kicker", "DA SUA COLEÇÃO"),
          image,
          cardName,
          freeCopies,
        );
        const form = this.element("form", "player-market__form");
        form.append(
          this.element("span", "forge-kicker", "NOVO ANÚNCIO"),
          this.element("h3", "", "Defina sua oferta"),
          this.element(
            "p",
            "player-market__note",
            "As cópias ficam reservadas até vender ou cancelar. Ao vender, você recebe 80% do total; 20% ficam como taxa do mercado.",
          ),
          this.button("title-dialog__cancel", "← Trocar carta", () => {
            selectedKey = null;
            render();
          }),
        );
        const quantity = this.element("input", "title-auth-input");
        Object.assign(quantity, {
          id: "market-quantity",
          type: "number",
          min: "1",
          max: "99",
          step: "1",
          value: "1",
          required: true,
        });
        const price = this.element("input", "title-auth-input");
        Object.assign(price, {
          id: "market-price",
          type: "number",
          min: "1",
          max: String(Number.MAX_SAFE_INTEGER),
          step: "1",
          required: true,
        });
        const preview = this.element("p", "player-market__total", "");
        const update = () => {
          const selected = choices.find((c) => c.card.key === selectedKey);
          quantity.max = String(Math.min(99, selected?.available || 1));
          const source = window.CYBERDUEL_IMAGE_ASSETS?.[selected?.card.imagem];
          image.hidden = !source;
          if (source) {
            image.src = source;
            image.alt = selected.card.nome;
          }
          cardName.textContent = selected?.card.nome || "Sua coleção";
          freeCopies.textContent = selected
            ? `${selected.available} cópias livres para anunciar`
            : "Cópias do deck salvo ficam protegidas.";
          const total = Number(quantity.value) * Number(price.value);
          const valid = Number.isSafeInteger(total) && total >= 0;
          const proceeds = valid ? Number((BigInt(total) * 4n) / 5n) : 0;
          preview.replaceChildren(
            this.element(
              "span",
              "",
              `Total do anúncio: ${valid ? total.toLocaleString("pt-BR") : "—"} tijolinhos`,
            ),
            this.element(
              "strong",
              "",
              `Você recebe: ${valid ? proceeds.toLocaleString("pt-BR") : "—"} tijolinhos (80%)`,
            ),
            this.element(
              "small",
              "",
              "Valores fracionados são arredondados para baixo.",
            ),
          );
        };
        for (const [labelText, control] of [
          ["Quantidade", quantity],
          ["Preço por cópia (tijolinhos)", price],
        ]) {
          const label = this.element("label", "", labelText);
          label.htmlFor = control.id;
          form.append(label, control);
          control.addEventListener("input", update);
        }
        const publish = this.button(
          "title-dialog__confirm",
          "PUBLICAR ANÚNCIO",
          () => {},
        );
        publish.type = "submit";
        if (!choices.length) {
          publish.disabled = true;
          publish.dataset.unavailable = "true";
          form.append(
            this.element(
              "p",
              "player-market__note",
              "Nenhuma cópia livre para venda. Ajuste seu deck ou obtenha mais cartas.",
            ),
          );
        }
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const card = choices.find((c) => c.card.key === selectedKey)?.card;
          if (card)
            act("listings", {
              tipo: card.tipo,
              nome: card.nome,
              quantidade: Number(quantity.value),
              preco: Number(price.value),
            });
        });
        update();
        form.append(preview, publish);
        workspace.append(artwork, form);
        content.append(workspace);
        return;
      }
      const controls = this.element("div", "player-market__filters");
      const heading = this.element("div", "player-market__section-heading");
      heading.append(
        this.element(
          "span",
          "forge-kicker",
          view === "mine" ? "SUAS OFERTAS" : "CARTAS DISPONÍVEIS",
        ),
        this.element(
          "h3",
          "",
          view === "mine" ? "Meus anúncios" : "Encontre sua próxima jogada",
        ),
      );
      const count = this.element("span", "player-market__count");
      heading.append(count);
      content.append(heading);
      const search = this.element("input", "title-auth-input");
      search.type = "search";
      search.placeholder = "Buscar carta ou vendedor";
      search.setAttribute("aria-label", "Buscar carta ou vendedor");
      const refresh = this.button(
        "title-dialog__cancel",
        "ATUALIZAR",
        async () => {
          if (busy) return;
          setBusy(true);
          error.textContent = "";
          try {
            await load();
          } catch (exception) {
            error.textContent = exception.message;
          } finally {
            if (this.modal === overlay) {
              render();
              setBusy(false);
            }
          }
        },
      );
      controls.append(search, refresh);
      content.append(controls);
      const grid = this.element("div", "player-market__grid");
      const draw = () => {
        grid.replaceChildren();
        const query = search.value.trim().toLocaleLowerCase("pt-BR");
        const matches = listings.filter(
          (l) =>
            (view === "mine" ? l.mine : !l.mine) &&
            `${l.nome} ${l.seller} ${l.nickname}`
              .toLocaleLowerCase("pt-BR")
              .includes(query),
        );
        for (const listing of matches) {
          const item = this.element("article", "player-market__listing");
          const model = catalog.find(
            (c) => c.key === `${listing.tipo}:${listing.nome}`,
          );
          const art = this.element("div", "player-market__art");
          art.append(
            this.element(
              "span",
              "player-market__badge",
              `${listing.quantidade}×`,
            ),
            this.element(
              "span",
              "player-market__type",
              model?.nivel || listing.tipo,
            ),
          );
          const source = window.CYBERDUEL_IMAGE_ASSETS?.[model?.imagem];
          if (source) {
            const image = this.element("img", "");
            image.src = source;
            image.alt = listing.nome;
            image.loading = "lazy";
            art.append(image);
          }
          const details = this.element("div", "player-market__details");
          details.append(
            this.element("h3", "", listing.nome),
            this.element(
              "small",
              "player-market__seller",
              `@${listing.seller}`,
            ),
            this.element(
              "p",
              "player-market__unit-price",
              `${listing.preco.toLocaleString("pt-BR")} tijolinhos / cópia`,
            ),
          );
          const total = listing.preco * listing.quantidade;
          details.append(
            this.element(
              "strong",
              "player-market__price",
              `${total.toLocaleString("pt-BR")} tijolinhos`,
            ),
          );
          if (listing.mine)
            details.append(
              this.element(
                "small",
                "player-market__unit-price",
                `Você recebe ${Number((BigInt(total) * 4n) / 5n).toLocaleString("pt-BR")} tijolinhos (80%)`,
              ),
            );
          const button = this.button(
            "title-dialog__confirm",
            listing.mine
              ? "CANCELAR ANÚNCIO"
              : `COMPRAR · ${total.toLocaleString("pt-BR")} TIJOLINHOS`,
            () => act(listing.mine ? "cancel" : "buy", { id: listing.id }),
          );
          if (!listing.mine && this.account.currency < total) {
            button.disabled = true;
            button.dataset.unavailable = "true";
            details.append(this.element("small", "", "Saldo insuficiente"));
          }
          details.append(button);
          item.append(art, details);
          grid.append(item);
        }
        count.textContent = `${matches.length} anúncio${matches.length === 1 ? "" : "s"}`;
        if (!matches.length)
          grid.append(
            this.element(
              "p",
              "player-market__empty",
              view === "mine"
                ? "Você não tem anúncios ativos."
                : "Nenhum anúncio encontrado.",
            ),
          );
      };
      search.addEventListener("input", draw);
      draw();
      content.append(grid);
    };
    dialog.append(header, tabs, status, error, content);
    overlay.append(dialog);
    render();
    setBusy(true);
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      dialog.querySelector("button")?.focus();
    });
    load()
      .catch((exception) => {
        loaded = true;
        error.textContent = exception.message;
      })
      .finally(() => {
        if (this.modal === overlay) {
          render();
          setBusy(false);
        }
      });
  }

  boosterFactions() {
    return [
      [
        "raspcorp",
        "RaspCorp",
        "O poder tem um preço.",
        "#4da6ff",
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
  }

  switchBoosterView(show) {
    this.modalAfterClose = null;
    this.closeModal(true);
    show();
  }

  openBoosterInventory() {
    if (this.modal || !this.account?.user) return;
    const overlay = this.createModal("booster-inventory");
    const dialog = this.element(
      "section",
      "title-dialog title-booster-dialog booster-inventory",
    );
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Inventário de boosters");
    this.modalAfterClose = () => this.account.notify();
    const header = this.element("header", "booster-header");
    header.append(
      this.element("h2", "", "Seus boosters"),
      this.button(
        "booster-close",
        "×",
        () => this.closeModal(),
        "Fechar inventário",
      ),
    );
    const list = this.element("div", "booster-inventory-list");
    const packs = this.account.boosters || [];
    for (const faction of this.boosterFactions()) {
      const owned = packs.filter((pack) => pack.faction === faction[0]);
      if (!owned.length) continue;
      const row = this.element("article", "booster-inventory-item");
      row.style.setProperty("--pack-color", faction[3]);
      const label = this.element("div");
      label.append(
        this.element("strong", "", faction[1]),
        this.element(
          "small",
          "",
          `${owned.length} pacote${owned.length === 1 ? "" : "s"} · 5 cartas cada`,
        ),
      );
      row.append(
        label,
        this.button("booster-buy", "ABRIR BOOSTER", () =>
          this.switchBoosterView(() => this.openBoosterOpening(owned[0])),
        ),
      );
      list.append(row);
    }
    if (!packs.length)
      list.append(
        this.element(
          "p",
          "booster-status",
          "Nenhum booster guardado. Compre um pacote para abrir aqui.",
        ),
      );
    dialog.append(
      header,
      list,
      this.button("booster-buy", "COMPRAR BOOSTERS", () =>
        this.switchBoosterView(() => this.openBoosterShop()),
      ),
    );
    overlay.append(dialog);
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  openBoosterShop() {
    this.renderBoosterView();
  }

  openBoosterOpening(pack) {
    this.renderBoosterView(pack);
  }

  renderBoosterView(ownedPack = null) {
    if (this.modal || !this.account?.user) return;
    const opening = Boolean(ownedPack);
    const overlay = this.createModal(opening ? "booster-opening" : "boosters");
    if (opening) {
      overlay.classList.add("booster-fullscreen");
      document.body.append(overlay);
    }
    const dialog = this.element("section", "title-dialog title-booster-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute(
      "aria-label",
      opening ? "Abertura de booster" : "Mercado de boosters",
    );
    this.modalAfterClose = () => this.account.notify();
    const factions = this.boosterFactions();
    let selected =
      factions.find(
        (f) => f[0] === (ownedPack?.faction || this.account.faction),
      ) || factions[0];
    let busy = false;
    let opened = false;
    const header = this.element("header", "booster-header");
    const heading = this.element("div");
    heading.append(
      this.element(
        "span",
        "title-kicker",
        opening ? "SEU PACOTE" : "MERCADO / COLEÇÃO",
      ),
      this.element("h2", "", opening ? "Abra seu booster" : "Booster Vault"),
    );
    const close = this.button(
      "booster-close",
      "×",
      () =>
        opening
          ? this.switchBoosterView(() => this.openBoosterInventory())
          : this.closeModal(),
      opening ? "Voltar ao inventário" : "Fechar loja de boosters",
    );
    header.append(heading, close);
    const wallet = this.element("div", "booster-wallet");
    const balance = this.element("strong", "title-booster-balance");
    const admin = this.button("booster-admin", "ADMIN · ＋ SALDO", () => {
      this.modalAfterClose = null;
      this.closeModal(true);
      this.openAdminGrantDialog(true);
    });
    wallet.append(balance);
    if (this.account?.isAdmin) wallet.append(admin);
    wallet.hidden = opening;
    const tabs = this.element("div", "booster-factions");
    tabs.hidden = opening;
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
    const scratch = this.button(
      "booster-scratch",
      "RISQUE AQUI PARA ABRIR →",
      () => {},
    );
    scratch.setAttribute(
      "aria-label",
      "Abrir pacote. Arraste horizontalmente ou pressione Enter.",
    );
    scratch.hidden = !opening;
    pack.append(scratch);
    pack.removeAttribute("aria-hidden");
    stage.append(pack, flash);
    const intro = this.element("div", "booster-intro");
    const title = this.element("h3");
    const subtitle = this.element("p");
    intro.append(title, subtitle);
    const status = this.element(
      "p",
      "booster-status",
      "Risque o lacre para abrir · 5 cartas, das comuns às lendárias.",
    );
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = this.element("div", "title-booster-results");
    results.hidden = true;
    const error = this.element("span", "title-dialog__error");
    error.setAttribute("role", "alert");
    let queue = [];
    let position = 0;
    let revealing = false;
    let generation = 0;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pause = (ms) =>
      new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));
    const cutin = this.element("div", "booster-cutin");
    cutin.hidden = true;
    const revealNext = async () => {
      if (revealing || !opened || position >= queue.length) return;
      revealing = true;
      refresh();
      const currentGeneration = generation;
      const alive = () =>
        this.modal === overlay && currentGeneration === generation;
      const previous = results.querySelector(".is-front");
      if (previous) {
        previous.classList.add("is-leaving");
        await pause(350);
        if (!alive()) return;
        previous.remove();
      }
      const card = queue[position];
      const item = results.children[0];
      if (card.nivel === "lendaria") {
        cutin.replaceChildren(
          this.element("strong", "", "LENDÁRIA!"),
          this.element("span", "", card.nome),
        );
        const source = window.CYBERDUEL_LEGENDARY_CUTINS?.[card.nome];
        if (source) {
          const art = this.element("img");
          art.src = source;
          art.alt = "";
          cutin.prepend(art);
        }
        cutin.hidden = false;
        status.textContent = "Uma lendária está chegando…";
        await pause(1600);
        if (!alive()) return;
        cutin.hidden = true;
      }
      item.classList.add("is-front");
      item.removeAttribute("aria-hidden");
      await pause(450);
      if (!alive()) return;
      if (position === 0 && queue.length > 1) {
        item.prepend(
          this.element("span", "booster-swipe-hint", "↑ arraste para cima"),
        );
      }
      position++;
      revealing = false;
      status.textContent = `${position} / ${queue.length} · ${card.nome}. ${position < queue.length ? "Deslize para cima para revelar a próxima." : "Todas as cartas estão na sua coleção!"}`;
      refresh();
    };
    const buy = this.button("booster-buy", "", async () => {
      if (opened && position < queue.length) {
        await revealNext();
        return;
      }
      if (busy) return;
      if (opened) {
        this.switchBoosterView(() => this.openBoosterInventory());
        return;
      }
      if (!opening && this.account.currency < this.account.boosterPrice) return;
      busy = true;
      this.modalRequired = true;
      refresh();
      error.textContent = "";
      status.textContent = "Preparando seu pacote…";
      try {
        if (!opening) {
          await this.account.buyBooster(selected[0]);
          if (this.modal === overlay) {
            status.textContent =
              "Pacote guardado no inventário. Abra quando quiser.";
            inventory.textContent = `VER INVENTÁRIO · ${this.account.boosters.length}`;
          }
          return;
        }
        const cards = await this.account.openBooster(ownedPack.id);
        if (this.modal !== overlay) {
          this.account.notify();
          return;
        }
        const revealed = cards
          .flatMap((card) =>
            Array.from({ length: card.quantidade || 1 }, () => ({
              ...card,
              nivel:
                card.nivel ||
                this.deckBuilder
                  .getCatalogByKey()
                  .get(`${card.tipo}:${card.nome}`)?.nivel ||
                "utilidade",
              quantidade: 1,
            })),
          )
          .sort(
            (a, b) => this.boosterRevealOrder(a) - this.boosterRevealOrder(b),
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
            item.style.setProperty("--stack-index", index);
            item.style.zIndex = revealed.length - index;
            item.setAttribute("aria-hidden", "true");
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
        queue = revealed;
        position = 0;
        await pause(450);
        if (this.modal === overlay) await revealNext();
      } catch (exception) {
        if (this.modal === overlay) {
          error.textContent =
            exception.message || "Falha ao processar booster.";
          status.textContent = opening
            ? "Não foi possível abrir o pacote. Tente novamente."
            : "Não foi possível comprar. Tente novamente.";
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
      close.disabled = admin.disabled = inventory.disabled = busy || revealing;
      for (const button of tabs.children) {
        button.disabled = busy || revealing;
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.faction === selected[0]),
        );
      }
      buy.disabled =
        busy ||
        revealing ||
        (!opening && this.account.currency < this.account.boosterPrice);
      scratch.disabled = busy || opened;
      buy.textContent = busy
        ? opening
          ? "ABRINDO…"
          : "COMPRANDO…"
        : opened
          ? position < queue.length
            ? "PRÓXIMA CARTA ↑"
            : "VOLTAR AO INVENTÁRIO"
          : opening
            ? "ABRIR PACOTE"
            : this.account.currency < this.account.boosterPrice
              ? "SALDO INSUFICIENTE"
              : `COMPRAR PACOTE · ${this.account.boosterPrice} TIJOLINHOS`;
      buy.setAttribute("aria-label", buy.textContent);
    };
    const reset = () => {
      generation++;
      queue = [];
      position = 0;
      revealing = false;
      cutin.hidden = true;
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
      status.textContent = opening
        ? "Arraste sobre o lacre para abrir."
        : "O pacote ficará guardado no seu inventário.";
      refresh();
    };
    let scratchStart = null;
    scratch.addEventListener("pointerdown", (event) => {
      if (scratch.disabled) return;
      scratchStart = { id: event.pointerId, x: event.clientX };
      scratch.setPointerCapture(event.pointerId);
    });
    scratch.addEventListener("pointermove", (event) => {
      if (!scratchStart || event.pointerId !== scratchStart.id) return;
      const distance = Math.abs(event.clientX - scratchStart.x);
      scratch.style.setProperty(
        "--scratch",
        `${Math.min(100, (distance / scratch.clientWidth) * 100)}%`,
      );
      if (distance >= scratch.clientWidth * 0.55) {
        scratchStart = null;
        buy.click();
      }
    });
    const cancelScratch = () => {
      scratchStart = null;
      scratch.style.removeProperty("--scratch");
    };
    scratch.addEventListener("pointerup", cancelScratch);
    scratch.addEventListener("pointercancel", cancelScratch);
    scratch.addEventListener("click", (event) => {
      if (event.detail === 0) buy.click();
    });
    let swipeStart = null;
    results.addEventListener("pointerdown", (event) => {
      swipeStart = { id: event.pointerId, y: event.clientY };
      results.setPointerCapture(event.pointerId);
    });
    results.addEventListener("pointerup", (event) => {
      if (
        swipeStart?.id === event.pointerId &&
        swipeStart.y - event.clientY > 45
      )
        revealNext();
      swipeStart = null;
    });
    results.addEventListener("pointercancel", () => {
      swipeStart = null;
    });
    results.addEventListener(
      "wheel",
      (event) => {
        if (opened && position < queue.length) {
          event.preventDefault();
          if (event.deltaY < -15) revealNext();
        }
      },
      { passive: false },
    );
    for (const faction of factions) {
      const button = this.button("booster-faction", faction[1], () => {
        if (busy) return;
        selected = faction;
        reset();
      });
      button.dataset.faction = faction[0];
      tabs.append(button);
    }
    const inventory = this.button(
      "booster-inventory-link",
      `VER INVENTÁRIO · ${(this.account.boosters || []).length}`,
      () => this.switchBoosterView(() => this.openBoosterInventory()),
    );
    inventory.hidden = opening;
    dialog.append(
      header,
      wallet,
      tabs,
      stage,
      intro,
      status,
      results,
      cutin,
      error,
      buy,
      inventory,
    );
    overlay.append(dialog);
    reset();
    this.settings?.applyDomTextScale(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
  }

  boosterRevealOrder(card) {
    if (card.tipo === "terreno") return 10;
    if (card.tipo === "efeito") return 11;
    return { baixa: 1, media: 2, alta: 3, lendaria: 4 }[card.nivel] || 0;
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
      image.draggable = false;
      item.append(image);
    }
    item.append(
      this.element(
        "small",
        "",
        `${String(card.tipo === "monstro" ? card.nivel : card.tipo).toUpperCase()} · x${Math.max(1, Number(card.quantidade) || 1)}`,
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
    if (this.modalBeforeClose && !immediate) return this.modalBeforeClose();
    this.modalBeforeClose = null;
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
    this.councilCleanup?.();
    this.clubTablesCleanup?.();
    this.clubTablesCleanup = null;
    this.menuClickAudio?.pause();
    this.menuClickAudio = null;
    this.menuSwipeAudio?.pause();
    this.menuSwipeAudio = null;
    clearInterval(this.matrixTimer);
    this.matrixTimer = null;
    clearTimeout(this.versusTimer);
    document.removeEventListener("keydown", this.handleKeydown);
    document.body.classList.remove("title-terminal-open");
    this.modal?.remove();
    this.root?.remove();
    this.root = null;
    this.modal = null;
    this.modalAfterClose = null;
    this.modalBeforeClose = null;
    this.modalRequired = false;
  }
}
