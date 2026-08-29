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

  getDeckForMatch() {
    return this.getSavedDeck() || [];
  }

  saveDeck(deck) {
    const normalized = this.normalize(deck);
    if (!this.isValid(normalized)) return false;
    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
    return true;
  }

}

window.cyberduelDeckBuilder = new CyberduelDeckBuilder();
