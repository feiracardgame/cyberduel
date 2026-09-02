class CyberduelDeckBuilder {
  constructor() {
    // v3 começa sem o antigo deck automático. Só decks montados e salvos
    // manualmente pelo jogador passam a existir nesta versão.
    this.storageKey = "cyberduel.deck.v3";
    this.maxCards = 20;
    this.minimums = { baixa: 6, media: 4, alta: 2 };
  }

  getCatalog() {
    const entries = [
      ...POOL_CARTAS_MONSTRO.map((base) => ({ tipo: "monstro", base })),
      ...POOL_CARTAS_EFEITO.map((base) => ({ tipo: "efeito", base })),
      ...POOL_CARTAS_TERRENO.map((base) => ({ tipo: "terreno", base })),
    ];
    const unique = new Map();
    entries.forEach(({ tipo, base }) => {
      const key = `${tipo}:${base.nome}`;
      if (!unique.has(key)) {
        const modelo = new Carta(
          -1,
          tipo === "terreno" ? 0 : base.poder || 0,
          tipo,
          { ...base },
        );
        unique.set(key, {
          key,
          tipo,
          nome: base.nome,
          poder: tipo === "terreno" ? 0 : base.poder || 0,
          booster: base.booster || "neutro",
          lendaria: !!base.lendaria,
          nivel:
            tipo === "monstro"
              ? classificarNivelCarta(
                  base.nome,
                  base.poder || 0,
                  tipo,
                  !!base.lendaria,
                )
              : tipo,
          imagem: base.imagem || null,
          foco: base.foco || { x: 0.5, y: 0.5 },
          descricao: modelo.descricaoCompleta(),
          partesDescricao: modelo.partesDescricao(),
          limite: base.lendaria ? 1 : 3,
        });
      }
    });
    return [...unique.values()].sort((a, b) =>
      a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome),
    );
  }

  normalize(deck) {
    const catalog = new Map(this.getCatalog().map((card) => [card.key, card]));
    if (!Array.isArray(deck)) return null;
    const normalized = [];
    for (const entry of deck) {
      const key = `${entry?.tipo}:${entry?.nome}`;
      const card = catalog.get(key);
      if (!card) continue;
      const quantidade = Math.min(
        card.limite,
        Math.max(0, Math.floor(Number(entry.quantidade) || 0)),
      );
      if (quantidade)
        normalized.push({ tipo: card.tipo, nome: card.nome, quantidade });
    }
    return normalized;
  }

  total(deck) {
    return (deck || []).reduce((sum, entry) => sum + entry.quantidade, 0);
  }

  composition(deck) {
    const catalog = new Map(this.getCatalog().map((card) => [card.key, card]));
    const result = { baixa: 0, media: 0, alta: 0 };
    for (const entry of deck || []) {
      const card = catalog.get(`${entry.tipo}:${entry.nome}`);
      if (card && Object.hasOwn(result, card.nivel))
        result[card.nivel] += entry.quantidade;
    }
    return result;
  }

  isValid(deck) {
    if (this.total(deck) !== this.maxCards) return false;
    const composition = this.composition(deck);
    return Object.entries(this.minimums).every(
      ([level, minimum]) => composition[level] >= minimum,
    );
  }

  getSavedDeck() {
    try {
      const deck = this.normalize(JSON.parse(localStorage.getItem(this.storageKey)));
      return deck && this.isValid(deck) ? deck : null;
    } catch {
      return null;
    }
  }

  getStarterDeck() {
    const catalog = this.getCatalog();
    const quantities = new Map(catalog.map((card) => [card.key, 0]));
    let total = 0;

    const add = (card) => {
      if (!card || total >= this.maxCards) return false;
      const current = quantities.get(card.key);
      if (current >= card.limite) return false;
      quantities.set(card.key, current + 1);
      total++;
      return true;
    };

    for (const [level, minimum] of Object.entries(this.minimums)) {
      const candidates = catalog.filter((card) => card.nivel === level);
      let added = 0;
      while (added < minimum) {
        let progressed = false;
        for (const card of candidates) {
          if (added >= minimum) break;
          if (add(card)) {
            added++;
            progressed = true;
          }
        }
        if (!progressed) break;
      }
    }

    for (let copy = 0; total < this.maxCards && copy < 3; copy++)
      for (const card of catalog) {
        if (total >= this.maxCards) break;
        add(card);
      }

    return catalog
      .filter((card) => quantities.get(card.key) > 0)
      .map((card) => ({
        tipo: card.tipo,
        nome: card.nome,
        quantidade: quantities.get(card.key),
      }));
  }

  getRandomDeck(random = Math.random) {
    const catalog = this.getCatalog();
    const quantities = new Map(catalog.map((card) => [card.key, 0]));
    let total = 0;

    const pick = (candidates) => {
      const available = candidates.filter(
        (card) => quantities.get(card.key) < card.limite,
      );
      if (!available.length || total >= this.maxCards) return false;
      const roll = Number(random());
      const normalizedRoll = Number.isFinite(roll)
        ? Math.min(0.999999, Math.max(0, roll))
        : 0;
      const card = available[Math.floor(normalizedRoll * available.length)];
      quantities.set(card.key, quantities.get(card.key) + 1);
      total++;
      return true;
    };

    for (const [level, minimum] of Object.entries(this.minimums)) {
      const candidates = catalog.filter((card) => card.nivel === level);
      for (let added = 0; added < minimum; added++) {
        if (!pick(candidates)) break;
      }
    }

    while (total < this.maxCards && pick(catalog));

    return catalog
      .filter((card) => quantities.get(card.key) > 0)
      .map((card) => ({
        tipo: card.tipo,
        nome: card.nome,
        quantidade: quantities.get(card.key),
      }));
  }

  getDeckForMatch() {
    return this.getSavedDeck() || [];
  }

  saveDeck(deck) {
    const normalized = this.normalize(deck);
    if (!this.isValid(normalized)) return false;
    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
    return true;
  }

  quantity(deck, card) {
    const entry = (deck || []).find(
      (item) => item.tipo === card.tipo && item.nome === card.nome,
    );
    return entry?.quantidade || 0;
  }

  changeQuantity(deck, card, delta) {
    const normalized = this.normalize(deck) || [];
    const quantities = new Map(
      normalized.map((entry) => [`${entry.tipo}:${entry.nome}`, entry.quantidade]),
    );
    const current = quantities.get(card.key) || 0;
    const next = Math.min(card.limite, Math.max(0, current + delta));
    const totalWithoutCard = this.total(normalized) - current;
    quantities.set(card.key, Math.min(next, this.maxCards - totalWithoutCard));

    return this.getCatalog()
      .filter((catalogCard) => (quantities.get(catalogCard.key) || 0) > 0)
      .map((catalogCard) => ({
        tipo: catalogCard.tipo,
        nome: catalogCard.nome,
        quantidade: quantities.get(catalogCard.key),
      }));
  }

  status(deck) {
    const total = this.total(deck);
    const composition = this.composition(deck);
    const remaining = Object.fromEntries(
      Object.entries(this.minimums).map(([level, minimum]) => [
        level,
        Math.max(0, minimum - composition[level]),
      ]),
    );
    return {
      total,
      composition,
      remaining,
      slotsRemaining: Math.max(0, this.maxCards - total),
      valid: this.isValid(deck),
    };
  }

  filterCatalog(options = {}) {
    const filter = options.filter || "todos";
    const query = String(options.query || "").trim().toLocaleLowerCase("pt-BR");
    const direction = options.order === "decrescente" ? -1 : 1;
    const typeOrder = { monstro: 0, efeito: 1, terreno: 2 };
    const levelOrder = { baixa: 0, media: 1, alta: 2, lendaria: 3 };

    return this.getCatalog()
      .filter((card) => filter === "todos" || card.tipo === filter)
      .filter((card) => {
        if (!query) return true;
        return [card.nome, card.descricao, card.booster, card.nivel, card.tipo]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      })
      .sort((a, b) => {
        const byType = (typeOrder[a.tipo] ?? 99) - (typeOrder[b.tipo] ?? 99);
        if (byType) return byType;
        if (a.tipo === "monstro" && b.tipo === "monstro") {
          const byLevel =
            ((levelOrder[a.nivel] ?? 99) - (levelOrder[b.nivel] ?? 99)) *
            direction;
          if (byLevel) return byLevel;
          const byPower = ((a.poder || 0) - (b.poder || 0)) * direction;
          if (byPower) return byPower;
        }
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }

}

window.cyberduelDeckBuilder = new CyberduelDeckBuilder();
