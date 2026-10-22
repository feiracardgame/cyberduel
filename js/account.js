class CyberduelAccount {
  constructor() {
    this.storageKey = "cyberduel.account.token.v1";
    this.token = localStorage.getItem(this.storageKey) || null;
    this.user = null;
    this.nickname = "";
    this.authProvider = null;
    this.isAdmin = false;
    this.demoMode = false;
    this.segurancaX1 = false;
    this.needsRegistration = false;
    this.needsUsername = false;
    this.nameRestriction = null;
    this.avatar = "";
    this.profilePhotos = [];
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.starterCollection = {};
    this.gamesPlayed = 0;
    this.tutorial = null;
    this.humanGames = 0;
    this.humanWins = 0;
    this.clubGames = this.clubWins = 0;
    this.clubUnlocked = false;
    this.councilReached = false;
    this.councilMember = false;
    this.boosterPrice = 100;
    this.boosters = [];
    this.pendingBoosterPurchase = null;
    this.listeners = new Set();
  }

  baseUrl() {
    return window.cyberduelServerUrl();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.snapshot()));
  }

  snapshot() {
    return {
      user: this.user,
      nickname: this.nickname,
      authProvider: this.authProvider,
      isAdmin: this.isAdmin,
      demoMode: this.demoMode,
      segurancaX1: this.segurancaX1,
      needsRegistration: this.needsRegistration,
      needsUsername: this.needsUsername,
      nameRestriction: this.nameRestriction,
      avatar: this.avatar,
      deck: this.deck,
      faction: this.faction,
      currency: this.currency,
      collection: this.collection,
      starterCollection: this.starterCollection,
      gamesPlayed: this.gamesPlayed,
      tutorial: this.tutorial, humanGames: this.humanGames, humanWins: this.humanWins,
      clubGames: this.clubGames, clubWins: this.clubWins,
      clubUnlocked: this.clubUnlocked, councilReached: this.councilReached, councilMember: this.councilMember,
      boosterPrice: this.boosterPrice,
      boosters: this.boosters,
      authenticated: !!this.user,
    };
  }

  async request(
    path,
    { method = "GET", body, auth = true, headers: customHeaders = {} } = {},
  ) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    Object.assign(headers, customHeaders);
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (payload.code === "NAME_NOT_ALLOWED" && payload.requiresNameChange === true) {
        this.nameRestriction = payload.nameRestriction;
        window.cyberduelNameGuard?.sync(this.nameRestriction);
      }
      const error = new Error(payload.error || "Falha de comunicação com o servidor.");
      error.code = payload.code;
      error.requiresNameChange = payload.requiresNameChange === true;
      throw error;
    }
    return payload;
  }

  applyAuth(payload, shouldNotify = true) {
    if (typeof payload.demoMode === "boolean") this.applyDemoMode(payload.demoMode, false);
    if (payload.token) {
      this.token = payload.token;
      localStorage.setItem(this.storageKey, this.token);
    }
    this.user = payload.username || null;
    this.authProvider = payload.authProvider || "google";
    this.isAdmin = payload.isAdmin === true;
    this.segurancaX1 = this.isAdmin && payload.segurancaX1 === true;
    this.needsRegistration = payload.needsRegistration === true;
    this.needsUsername = payload.needsUsername === true;
    this.nameRestriction = payload.nameRestriction || null;
    this.nickname = typeof payload.nickname === "string" ? payload.nickname : (this.needsRegistration ? "" : this.user) || "";
    this.avatar = payload.avatar || "";
    this.profilePhotos = payload.profilePhotos || [];
    this.deck = Array.isArray(payload.deck) ? payload.deck : null;
    this.faction = payload.faction || null;
    this.currency = Math.max(0, Number(payload.currency) || 0);
    this.collection =
      payload.collection && typeof payload.collection === "object"
        ? payload.collection
        : {};
    this.boosters = Array.isArray(payload.boosters) ? payload.boosters : [];
    this.starterCollection = payload.starterCollection || {};
    this.gamesPlayed = Math.max(0, Number(payload.gamesPlayed) || 0);
    this.tutorial = payload.tutorial || null;
    this.humanGames = Math.max(0, Number(payload.humanGames) || 0);
    this.humanWins = Math.max(0, Number(payload.humanWins) || 0);
    this.clubGames = Math.max(0, Number(payload.clubGames) || 0);
    this.clubWins = Math.max(0, Number(payload.clubWins) || 0);
    this.clubUnlocked = payload.clubUnlocked === true;
    this.councilReached = payload.councilReached === true;
    this.councilMember = payload.councilMember === true;
    this.boosterPrice = Math.max(1, Number(payload.boosterPrice) || 100);
    window.cyberduelNameGuard?.sync(this.nameRestriction);
    if (shouldNotify) this.notify();
    return this.snapshot();
  }

  async restore() {
    try {
      const config = await this.request("/api/config", { auth: false });
      this.applyDemoMode(config.demoMode === true);
    } catch { /* Mantém a última configuração conhecida durante a reconexão. */ }
    if (!this.token) return this.snapshot();
    try {
      return this.applyAuth(await this.request("/api/auth/session"));
    } catch {
      this.clear();
      return this.snapshot();
    }
  }

  async localLogin(username) {
    return this.applyAuth(await this.request("/api/auth/local", {
      method: "POST", body: { username }, auth: false,
    }));
  }

  async googleLogin(credential, loginId) {
    const payload = await this.request("/api/auth/google", {
      method: "POST", body: { credential, loginId }, auth: false,
    });
    return this.applyAuth(payload);
  }

  async mountGoogleButton(container, onError) {
    try {
      const login = await this.request("/api/auth/google/start", { method: "POST", auth: false });
      if (!window.google?.accounts?.id) {
        if (!this.googleScript) this.googleScript = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          const timer = setTimeout(() => {
            script.remove();
            reject(new Error("O Google não respondeu. Verifique sua conexão e tente novamente."));
          }, 15000);
          script.src = "https://accounts.google.com/gsi/client?hl=pt-BR";
          script.async = true;
          script.onload = () => { clearTimeout(timer); resolve(); };
          script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            reject(new Error("Não foi possível carregar o login com Google."));
          };
          document.head.append(script);
        }).catch(error => { this.googleScript = null; throw error; });
        await this.googleScript;
      }
      if (!container.isConnected) return;
      const google = window.google.accounts.id;
      google.initialize({
        client_id: login.clientId, nonce: login.nonce, auto_select: false,
        callback: async ({ credential }) => {
          if (!container.isConnected) return;
          container.replaceChildren();
          container.textContent = "Entrando…";
          try {
            await this.googleLogin(credential, login.loginId);
          } catch (error) {
            if (!container.isConnected) return;
            onError(error);
            await this.mountGoogleButton(container, onError);
          }
        },
      });
      container.replaceChildren();
      google.renderButton(container, { type: "standard", theme: "outline", size: "large", text: "signin_with", locale: "pt-BR" });
    } catch (error) {
      if (!container.isConnected) return;
      container.replaceChildren();
      onError(error);
    }
  }

  async completeRegistration(username) {
    const payload = await this.request("/api/account/profile", {
      method: "PUT", body: { username },
    });
    const builds = localStorage.getItem(`cyberduel.builds.v1:${this.user}`);
    const buildsKey = `cyberduel.builds.v1:${payload.username}`;
    if (builds && this.user !== payload.username && !localStorage.getItem(buildsKey))
      localStorage.setItem(buildsKey, builds);
    return this.applyAuth(payload);
  }

  async updateProfile(nickname, avatar) {
    const payload = await this.request("/api/account/profile", {
      method: "PUT",
      body: { nickname, avatar },
    });
    return this.applyAuth(payload, false);
  }

  async correctName(fields) {
    const previousUser = this.user;
    const payload = await this.request("/api/account/profile", { method: "PUT", body: fields });
    const builds = localStorage.getItem(`cyberduel.builds.v1:${previousUser}`);
    const buildsKey = `cyberduel.builds.v1:${payload.username}`;
    if (builds && previousUser !== payload.username && !localStorage.getItem(buildsKey))
      localStorage.setItem(buildsKey, builds);
    return this.applyAuth(payload);
  }

  async saveDeck(deck) {
    if (!this.user) throw new Error("Faça login para salvar o deck na conta.");
    const payload = await this.request("/api/deck", {
      method: "PUT",
      body: { deck },
    });
    this.deck = payload.deck;
    this.notify();
    return this.deck;
  }

  async marketListings() {
    const payload = await this.request("/api/market/listings");
    this.applyAuth(payload, false);
    window.cyberduelDeckBuilder?.setAccountSession(this.user, this.deck, this.collection);
    return payload.listings;
  }

  async marketTrade(action, body) {
    const payload = await this.request(`/api/market/${action}`, { method: "POST", body });
    this.applyAuth(payload, false);
    window.cyberduelDeckBuilder?.setAccountSession(this.user, this.deck, this.collection);
    return payload;
  }

  async chooseFaction(faction) {
    const payload = await this.request("/api/account/faction", {
      method: "POST",
      body: { faction },
    });
    return this.applyAuth(payload);
  }

  async saveTutorial(progress) {
    return this.applyAuth(await this.request("/api/account/tutorial", {
      method: "PUT", body: progress,
    }), false);
  }

  async buyBooster(faction) {
    const purchaseKey = `${this.user}:${faction}`;
    if (this.pendingBoosterPurchase?.key !== purchaseKey) {
      this.pendingBoosterPurchase = { key: purchaseKey, id: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("") };
    }
    const payload = await this.request("/api/boosters/buy", {
      method: "POST",
      body: { faction, purchaseId: this.pendingBoosterPurchase.id },
    });
    this.pendingBoosterPurchase = null;
    this.applyAuth(payload, false);
    return this.boosters;
  }

  async openBooster(packId) {
    const debugLegendary = Boolean(this.user && this.debugLegendaryUser === this.user);
    const payload = await this.request("/api/boosters/open", {
      method: "POST",
      body: { packId, ...(debugLegendary ? { debugLegendary: true } : {}) },
    });
    if (debugLegendary) this.debugLegendaryUser = null;
    this.applyAuth(payload, false);
    window.cyberduelDeckBuilder?.setAccountSession(this.user, this.deck, this.collection);
    return payload.cards || [];
  }

  async listAdminAccounts() {
    const payload = await this.request("/api/admin/accounts");
    return payload.accounts;
  }

  async requireNameChange(username) {
    return this.request("/api/admin/accounts/require-name-change", { method: "POST", body: { username } });
  }

  async broadcastMessage(message) {
    return this.request("/api/admin/broadcast", { method: "POST", body: { message } });
  }

  applyDemoMode(enabled, shouldNotify = true) {
    if (this.demoMode === enabled && window.CYBERDUEL_DEMO_MODE === enabled) return;
    this.demoMode = enabled;
    window.CYBERDUEL_DEMO_MODE = enabled;
    const manager = window.cyberduelGame?.scene;
    if (manager) {
      const editor = manager.getScene("CenaDeckBuilder");
      if (editor?.scene.isActive()) {
        editor.deckBuilderUI.catalog = window.cyberduelDeckBuilder.getCatalog();
        editor.deckBuilderUI.render();
      }
      const duel = manager.getScene("CenaJogo");
      if (enabled && duel?.scene.isActive() && !duel.multiplayerAtivo &&
        [duel.partida.jogador, duel.partida.inimigo].some(player =>
          [...player.deck.cartas, ...player.mao.cartas, ...player.campo.cartas, ...player.descarte]
            .some(card => card && !window.cyberduelDeckBuilder.isCardAllowed(card))))
        duel.scene.start("CenaTitulo");
    }
    if (shouldNotify) this.notify();
  }

  async setDemoMode(enabled) {
    const payload = await this.request("/api/admin/demo-mode", { method: "POST", body: { enabled } });
    this.applyDemoMode(payload.demoMode);
    return payload;
  }

  async setSegurancaX1(enabled) {
    const payload = await this.request("/api/admin/seguranca-x1", { method: "POST", body: { enabled } });
    return this.applyAuth(payload, false);
  }

  async unlockLeaderboard(username) {
    const payload = await this.request("/api/admin/accounts/unlock-leaderboard", {
      method: "POST", body: { username },
    });
    if (payload.account?.username?.toLocaleLowerCase("pt-BR") === this.user?.toLocaleLowerCase("pt-BR"))
      this.applyAuth(payload.account);
    return payload;
  }

  async resetLeaderboardRating() {
    const payload = await this.request("/api/admin/accounts/reset-rating", { method: "POST" });
    this.applyAuth(payload.account);
    return payload;
  }

  async grantRating(username, amount) {
    const payload = await this.request("/api/admin/accounts/grant-rating", {
      method: "POST", body: { username, amount },
    });
    if (payload.account?.username?.toLocaleLowerCase("pt-BR") === this.user?.toLocaleLowerCase("pt-BR"))
      this.applyAuth(payload.account);
    return payload;
  }

  async removeRating(username, amount) {
    const payload = await this.request("/api/admin/accounts/remove-rating", {
      method: "POST", body: { username, amount },
    });
    if (payload.account?.username?.toLocaleLowerCase("pt-BR") === this.user?.toLocaleLowerCase("pt-BR"))
      this.applyAuth(payload.account);
    return payload;
  }

  async grantCurrency(username, amount) {
    const payload = await this.request("/api/admin/accounts/grant-currency", {
      method: "POST", body: { username, amount },
    });
    if (payload.account?.username?.toLocaleLowerCase("pt-BR") === this.user?.toLocaleLowerCase("pt-BR"))
      this.applyAuth(payload.account, false);
    return payload;
  }

  async grantCardsByUsername(username, cards, options = {}) {
    const payload = await this.request("/api/admin/accounts/grant-cards", {
      method: "POST",
      body: {
        username,
        cards,
        fullDeck: options.fullDeck === true,
        allAvailable: options.allAvailable === true,
        faction: options.faction || null,
      },
    });
    if (
      payload.account &&
      String(payload.account.username || "").toLocaleLowerCase("pt-BR") ===
        String(this.user || "").toLocaleLowerCase("pt-BR")
    ) {
      this.applyAuth(payload.account, false);
      window.cyberduelDeckBuilder?.setAccountSession(
        this.user,
        this.deck,
        this.collection,
      );
    }
    return payload;
  }

  async darCarta(conta, nomeDaCarta, options = {}) {
    const payload = await this.request("/api/admin/accounts/give-card", {
      method: "POST",
      body: {
        conta,
        nomeDaCarta,
        quantidade: Math.max(1, Math.min(20, Number(options.quantidade) || 1)),
      },
    });
    return payload;
  }

  async generateRedemptionCode(tipo, nome, availableAt = null) {
    return this.request("/api/admin/redemption-codes", { method: "POST", body: { tipo, nome, availableAt } });
  }

  async redeemCard(code) {
    const payload = await this.request("/api/account/redeem-card", { method: "POST", body: { code } });
    this.applyAuth(payload);
    window.cyberduelDeckBuilder?.setAccountSession(this.user, this.deck, this.collection);
    return payload;
  }

  async resetCollection(conta) {
    const payload = await this.request("/api/admin/accounts/reset-collection", {
      method: "POST",
      body: { conta, username: conta },
    });
    return payload;
  }

  async startSoloMatch() {
    if (!this.user) throw new Error("Entre na conta para registrar a partida solo.");
    const payload = await this.request("/api/account/match-start", {
      method: "POST", body: { mode: "solo" },
    });
    if (typeof payload.matchId !== "string" || !payload.matchId)
      throw new Error("O servidor não confirmou o início da partida solo.");
    return payload.matchId;
  }

  async recordMatch(matchId, result) {
    if (!this.user) throw new Error("Entre novamente na conta para receber a recompensa.");
    const payload = await this.request("/api/account/match-complete", {
      method: "POST", body: { matchId, result },
    });
    if (!Number.isSafeInteger(payload.reward) || payload.reward < 0)
      throw new Error("O servidor não confirmou o valor da recompensa.");
    this.applyAuth(payload);
    return payload.reward;
  }

  async logout() {
    try {
      if (this.token)
        await this.request("/api/auth/logout", { method: "POST" });
    } finally {
      this.clear();
    }
  }

  clear() {
    this.tutorial = null;
    this.humanGames = this.humanWins = 0;
    this.clubGames = this.clubWins = 0;
    this.clubUnlocked = this.councilReached = this.councilMember = false;
    this.token = null;
    this.user = null;
    this.nickname = "";
    this.authProvider = null;
    this.isAdmin = false;
    this.needsRegistration = false;
    this.needsUsername = false;
    this.nameRestriction = null;
    this.avatar = "";
    this.profilePhotos = [];
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.gamesPlayed = 0;
    this.boosters = [];
    this.starterCollection = {};
    this.pendingBoosterPurchase = null;
    this.debugLegendaryUser = null;
    this.segurancaX1 = false;
    localStorage.removeItem(this.storageKey);
    window.cyberduelNameGuard?.close();
    this.notify();
  }
}

window.cyberduelAccount = new CyberduelAccount();
