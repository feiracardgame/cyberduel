class CyberduelAccount {
  constructor() {
    this.storageKey = "cyberduel.account.token.v1";
    this.token = localStorage.getItem(this.storageKey) || null;
    this.user = null;
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.gamesPlayed = 0;
    this.boosterPrice = 100;
    this.listeners = new Set();
  }

  baseUrl() {
    if (window.CYBERDUEL_SERVER_URL)
      return String(window.CYBERDUEL_SERVER_URL).replace(/\/$/, "");
    // Live Server costuma usar 5500/5501, enquanto o Docker publica a API
    // real na porta HTTP padrão da mesma máquina.
    if (["5500", "5501", "8080"].includes(location.port))
      return `${location.protocol}//${location.hostname}`;
    return location.origin;
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
      deck: this.deck,
      faction: this.faction,
      currency: this.currency,
      collection: this.collection,
      gamesPlayed: this.gamesPlayed,
      boosterPrice: this.boosterPrice,
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
    this.deck = Array.isArray(payload.deck) ? payload.deck : null;
    this.faction = payload.faction || null;
    this.currency = Math.max(0, Number(payload.currency) || 0);
    this.collection =
      payload.collection && typeof payload.collection === "object"
        ? payload.collection
        : {};
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

  async login(username, password) {
    const payload = await this.request("/api/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    return this.applyAuth(payload);
  }

  async register(username, password) {
    const payload = await this.request("/api/auth/register", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
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

  async chooseFaction(faction) {
    const payload = await this.request("/api/account/faction", {
      method: "POST",
      body: { faction },
    });
    return this.applyAuth(payload);
  }

  async openBooster(faction) {
    const payload = await this.request("/api/boosters/open", {
      method: "POST",
      body: { faction },
    });
    this.applyAuth(payload, false);
    return payload.cards || [];
  }

  async grantCardsByUsername(username, cards, options = {}) {
    const adminToken = String(
      options.adminToken || window.CYBERDUEL_ADMIN_TOKEN || "",
    ).trim();
    const payload = await this.request("/api/admin/accounts/grant-cards", {
      method: "POST",
      body: {
        username,
        cards,
        fullDeck: options.fullDeck === true,
        allAvailable: options.allAvailable === true,
        faction: options.faction || null,
      },
      auth: false,
      headers: adminToken ? { "x-admin-token": adminToken } : {},
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
    const adminToken = String(
      options.adminToken || window.CYBERDUEL_ADMIN_TOKEN || "",
    ).trim();
    const payload = await this.request("/api/admin/accounts/give-card", {
      method: "POST",
      body: {
        conta,
        nomeDaCarta,
        quantidade: Math.max(1, Math.min(20, Number(options.quantidade) || 1)),
      },
      auth: false,
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    return payload;
  }

  async resetCollection(conta, options = {}) {
    const adminToken = String(
      options.adminToken || window.CYBERDUEL_ADMIN_TOKEN || "",
    ).trim();
    const payload = await this.request("/api/admin/accounts/reset-collection", {
      method: "POST",
      body: { conta, username: conta },
      auth: false,
      headers: adminToken ? { "x-admin-token": adminToken } : {},
    });
    return payload;
  }

  async recordMatch() {
    if (!this.user) return;
    const payload = await this.request("/api/account/match-complete", {
      method: "POST",
    });
    this.applyAuth(payload, false);
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
    this.deck = null;
    this.faction = null;
    this.currency = 0;
    this.collection = {};
    this.gamesPlayed = 0;
    localStorage.removeItem(this.storageKey);
    this.notify();
  }
}

window.cyberduelAccount = new CyberduelAccount();
