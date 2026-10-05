class CyberduelAccount {
  constructor() {
    this.storageKey = "cyberduel.account.token.v1";
    this.token = localStorage.getItem(this.storageKey) || null;
    this.user = null;
    this.nickname = "";
    this.authProvider = null;
    this.isAdmin = false;
    this.needsRegistration = false;
    this.needsUsername = false;
    this.avatar = "";
    this.profilePhotos = [];
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.gamesPlayed = 0;
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
      needsRegistration: this.needsRegistration,
      needsUsername: this.needsUsername,
      avatar: this.avatar,
      deck: this.deck,
      faction: this.faction,
      currency: this.currency,
      collection: this.collection,
      gamesPlayed: this.gamesPlayed,
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
    if (!response.ok)
      throw new Error(payload.error || "Falha de comunicação com o servidor.");
    return payload;
  }

  applyAuth(payload, shouldNotify = true) {
    if (payload.token) {
      this.token = payload.token;
      localStorage.setItem(this.storageKey, this.token);
    }
    this.user = payload.username || null;
    this.authProvider = payload.authProvider || "google";
    this.isAdmin = payload.isAdmin === true;
    this.needsRegistration = payload.needsRegistration === true;
    this.needsUsername = payload.needsUsername === true;
    this.nickname = payload.nickname || (this.needsRegistration ? "" : this.user) || "";
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
    this.gamesPlayed = Math.max(0, Number(payload.gamesPlayed) || 0);
    this.boosterPrice = Math.max(1, Number(payload.boosterPrice) || 100);
    if (shouldNotify) this.notify();
    return this.snapshot();
  }

  async restore() {
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

  async completeRegistration(username, nickname) {
    const payload = await this.request("/api/account/profile", {
      method: "PUT", body: { username, nickname },
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

  async chooseFaction(faction) {
    const payload = await this.request("/api/account/faction", {
      method: "POST",
      body: { faction },
    });
    return this.applyAuth(payload);
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

  async resetCollection(conta) {
    const payload = await this.request("/api/admin/accounts/reset-collection", {
      method: "POST",
      body: { conta, username: conta },
    });
    return payload;
  }

  async startSoloMatch() {
    if (!this.user) return null;
    const payload = await this.request("/api/account/match-start", {
      method: "POST", body: { mode: "solo" },
    });
    return payload.matchId;
  }

  async recordMatch(matchId, result) {
    if (!this.user) return;
    const payload = await this.request("/api/account/match-complete", {
      method: "POST", body: { matchId, result },
    });
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
    this.token = null;
    this.user = null;
    this.nickname = "";
    this.authProvider = null;
    this.isAdmin = false;
    this.needsRegistration = false;
    this.needsUsername = false;
    this.avatar = "";
    this.profilePhotos = [];
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.gamesPlayed = 0;
    this.boosters = [];
    this.pendingBoosterPurchase = null;
    this.debugLegendaryUser = null;
    localStorage.removeItem(this.storageKey);
    this.notify();
  }
}

window.cyberduelAccount = new CyberduelAccount();
