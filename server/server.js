const { createServer } = require("http");
const {
  createReadStream,
  stat,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} = require("fs");
const {
  randomBytes,
  randomInt,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require("crypto");
const { promisify } = require("util");
const path = require("path");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_URL = String(process.env.PUBLIC_URL || "").trim();
const PUBLIC_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, "data"),
);
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const scrypt = promisify(scryptCallback);
const rooms = new Map();
const sessions = new Map();
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const BOOSTER_PRICE = 100;
const INITIAL_CURRENCY = 500;

function environmentInteger(name, fallback, minimum = 0, maximum = 100000) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

const BOOSTER_CONFIG = Object.freeze({
  cardsPerPack: 20,
  legendaryMinGames: environmentInteger("BOOSTER_LEGENDARY_MIN_GAMES", 10),
  levelWeights: Object.freeze({
    baixa: environmentInteger("BOOSTER_WEIGHT_BAIXA", 20),
    media: environmentInteger("BOOSTER_WEIGHT_MEDIA", 12),
    utilidade: environmentInteger("BOOSTER_WEIGHT_UTILIDADE", 10),
    alta: environmentInteger("BOOSTER_WEIGHT_ALTA", 10),
    lendaria: environmentInteger("BOOSTER_WEIGHT_LENDARIA", 4),
  }),
  utilityTypeWeights: Object.freeze({
    efeito: environmentInteger("BOOSTER_WEIGHT_EFEITO", 10),
    terreno: environmentInteger("BOOSTER_WEIGHT_TERRENO", 10),
  }),
});

const FACTION_CARDS = Object.freeze({
  raspcorp: [
    ["monstro", "CyberVendedor da RaspCorp", "baixa", 2],
    ["monstro", "Estagiário de Machine Learning", "baixa", 2],
    ["monstro", "NeoAnalista de Suporte Nível Alpha", "baixa", 2],
    ["monstro", "Advogado Corporativo", "media", 2],
    ["monstro", "Gestor de Recursos Predominantemente Humanos", "media", 2],
    ["monstro", "CryptoAcionistas", "alta", 2],
    ["monstro", "Agente da DIPSP", "alta", 2],
    ["monstro", "RaspClay MonteCorp", "lendaria", 1],
    ["efeito", "Sugestão Algorítmica", "utilidade", 2],
    ["terreno", "Torre MonteCorp", "utilidade", 1],
    ["terreno", "Beira-mar norte de NeoFloripa", "utilidade", 1],
    ["terreno", "Nexus de Dados Global", "utilidade", 1],
  ],
  echossystem: [
    ["monstro", "O Rato", "baixa", 2],
    ["monstro", "A Cabra", "baixa", 2],
    ["monstro", "O Cão", "baixa", 2],
    ["monstro", "O Porco", "media", 2],
    ["monstro", "A Cobra", "media", 2],
    ["monstro", "O Tigre", "alta", 2],
    ["monstro", "A Aranha", "alta", 1],
    ["monstro", "O Boi", "lendaria", 1],
    ["efeito", "O Trotar do Cavalo", "utilidade", 2],
    ["efeito", "O Canto do Galo", "utilidade", 2],
    ["efeito", "A Travessura do Macaco", "utilidade", 1],
    ["terreno", "A Toca do Coelho", "utilidade", 1],
  ],
});

const EXTRA_GAME_CARDS = Object.freeze([
  ["monstro", 'UCC "Juggernaut"'],
  ["monstro", 'resenha games"'],
  ["monstro", "HumbaBrain"],
  ["efeito", "Você Parece Sozinho"],
  ["monstro", "Dieh'Go, o Xerife"],
  ["monstro", "Povo da Areia"],
  ["monstro", "A Ferreira"],
  ["monstro", "Tuh'Coh, O Feio"],
  ["monstro", "Sen'Tenzhah, O Mau"],
  ["monstro", "O Bom"],
  ["efeito", "Reciclagem"],
  ["efeito", "Vento dos Ermos"],
  ["terreno", "Terras Desertas"],
  ["terreno", "Saloon"],
]);

const ALL_AVAILABLE_CARDS = Object.freeze(
  [...Object.values(FACTION_CARDS).flat(), ...EXTRA_GAME_CARDS].map(
    ([tipo, nome]) => ({ tipo, nome, quantidade: 1 }),
  ),
);

const ADMIN_API_TOKEN = String(process.env.ADMIN_API_TOKEN || "").trim();

function cardKey(tipo, nome) {
  return `${tipo}:${nome}`;
}

function ensureAccountDefaults(account) {
  if (!account || typeof account !== "object") return account;
  if (!Object.hasOwn(account, "faction")) account.faction = null;
  if (!Number.isFinite(account.currency)) account.currency = INITIAL_CURRENCY;
  if (!Number.isFinite(account.gamesPlayed)) account.gamesPlayed = 0;
  if (!account.collection || typeof account.collection !== "object")
    account.collection = {};
  return account;
}

mkdirSync(DATA_DIR, { recursive: true });
let accountStore = { version: 1, accounts: {} };
try {
  const loaded = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
  if (loaded?.accounts && typeof loaded.accounts === "object") {
    accountStore = loaded;
    Object.values(accountStore.accounts).forEach(ensureAccountDefaults);
  }
} catch (error) {
  if (error.code !== "ENOENT")
    console.error("Falha ao carregar contas:", error.message);
}

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    request.on("error", reject);
  });
}

function saveAccounts() {
  const temporary = `${ACCOUNTS_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(accountStore, null, 2), {
    mode: 0o600,
  });
  renameSync(temporary, ACCOUNTS_FILE);
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function validCredentials(username, password) {
  return (
    /^[a-zA-Z0-9_.-]{3,24}$/.test(username) &&
    typeof password === "string" &&
    password.length >= 6 &&
    password.length <= 128
  );
}

async function passwordHash(password, salt) {
  return (await scrypt(password, salt, 64)).toString("hex");
}

function createSession(accountKey) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, {
    accountKey,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });
  return token;
}

function authenticatedSession(request) {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(
    String(request.headers.authorization || ""),
  );
  if (!match) return null;
  const session = sessions.get(match[1]);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(match[1]);
    return null;
  }
  const account = accountStore.accounts[session.accountKey];
  return account ? { token: match[1], account } : null;
}

function accountFromToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ""))) return null;
  const session = sessions.get(String(token));
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(String(token));
    return null;
  }
  return accountStore.accounts[session.accountKey] || null;
}

function publicAccount(account) {
  ensureAccountDefaults(account);
  return {
    username: account.username,
    deck: account.deck || null,
    faction: account.faction,
    currency: account.currency,
    gamesPlayed: account.gamesPlayed,
    collection: account.collection,
    boosterPrice: BOOSTER_PRICE,
  };
}

function starterForFaction(faction) {
  return (FACTION_CARDS[faction] || []).map(([tipo, nome, , quantidade]) => ({
    tipo,
    nome,
    quantidade,
  }));
}

function grantCards(account, cards) {
  ensureAccountDefaults(account);
  cards.forEach(({ tipo, nome, quantidade = 1 }) => {
    const key = cardKey(tipo, nome);
    account.collection[key] =
      Math.max(0, Number(account.collection[key]) || 0) + quantidade;
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const ADMIN_CARD_INDEX = Object.freeze(
  Object.values(FACTION_CARDS)
    .flat()
    .map(([tipo, nome]) => ({ tipo, nome, lookup: normalizeText(nome) })),
);

function resolveCardByName(nomeDaCarta) {
  const lookup = normalizeText(nomeDaCarta);
  if (!lookup) return null;
  return ADMIN_CARD_INDEX.find((card) => card.lookup === lookup) || null;
}

function darCarta(conta, nomeDaCarta, quantidade = 1) {
  const account =
    typeof conta === "string"
      ? accountStore.accounts[normalizeUsername(conta)]
      : conta;
  if (!account || typeof account !== "object") {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  const card = resolveCardByName(nomeDaCarta);
  if (!card) throw new Error("CARD_NOT_FOUND");

  grantCards(account, [
    {
      tipo: card.tipo,
      nome: card.nome,
      quantidade: Math.max(
        1,
        Math.min(20, Math.floor(Number(quantidade) || 1)),
      ),
    },
  ]);

  account.updatedAt = new Date().toISOString();
  saveAccounts();
  return { tipo: card.tipo, nome: card.nome };
}

function sanitizeGrantedCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .map((entry) => ({
      tipo: String(entry?.tipo || "")
        .trim()
        .slice(0, 20),
      nome: String(entry?.nome || "")
        .trim()
        .slice(0, 120),
      quantidade: Math.max(
        1,
        Math.min(20, Math.floor(Number(entry?.quantidade) || 0)),
      ),
    }))
    .filter((entry) => entry.tipo && entry.nome && entry.quantidade > 0);
}

function hasAdminAccess(request) {
  if (!ADMIN_API_TOKEN) return true;
  return String(request.headers["x-admin-token"] || "") === ADMIN_API_TOKEN;
}

function rollBooster(faction, gamesPlayed) {
  const definitions = FACTION_CARDS[faction] || [];
  const configuredWeights = Object.entries(BOOSTER_CONFIG.levelWeights).filter(
    ([level]) =>
      level !== "lendaria" || gamesPlayed >= BOOSTER_CONFIG.legendaryMinGames,
  );
  return Array.from({ length: BOOSTER_CONFIG.cardsPerPack }, () => {
    let available = configuredWeights.filter(
      ([level, weight]) =>
        weight > 0 && definitions.some((entry) => entry[2] === level),
    );
    if (!available.length) {
      available = [...new Set(definitions.map((entry) => entry[2]))]
        .filter(
          (level) =>
            level !== "lendaria" ||
            gamesPlayed >= BOOSTER_CONFIG.legendaryMinGames,
        )
        .map((level) => [level, 1]);
    }
    const totalWeight = available.reduce((sum, entry) => sum + entry[1], 0);
    let roll = randomInt(totalWeight);
    let selectedLevel = available[0][0];
    for (const [level, weight] of available) {
      if (roll < weight) {
        selectedLevel = level;
        break;
      }
      roll -= weight;
    }
    let pool = definitions.filter((entry) => entry[2] === selectedLevel);
    if (selectedLevel === "utilidade") {
      let typeWeights = Object.entries(
        BOOSTER_CONFIG.utilityTypeWeights,
      ).filter(
        ([tipo, weight]) =>
          weight > 0 && pool.some((entry) => entry[0] === tipo),
      );
      if (!typeWeights.length) {
        typeWeights = [...new Set(pool.map((entry) => entry[0]))].map(
          (tipo) => [tipo, 1],
        );
      }
      let typeRoll = randomInt(
        typeWeights.reduce((sum, entry) => sum + entry[1], 0),
      );
      let selectedType = typeWeights[0][0];
      for (const [tipo, weight] of typeWeights) {
        if (typeRoll < weight) {
          selectedType = tipo;
          break;
        }
        typeRoll -= weight;
      }
      pool = pool.filter((entry) => entry[0] === selectedType);
    }
    const [tipo, nome, nivel] = pool[randomInt(pool.length)];
    return { tipo, nome, nivel, quantidade: 1 };
  });
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/config") {
    return sendJson(response, 200, {
      ok: true,
      booster: {
        price: BOOSTER_PRICE,
        ...BOOSTER_CONFIG,
      },
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(request);
    const username = String(body.username || "").trim();
    const password = body.password;
    if (!validCredentials(username, password)) {
      return sendJson(response, 400, {
        ok: false,
        error: "Usuário: 3–24 letras/números. Senha: mínimo de 6 caracteres.",
      });
    }
    const key = normalizeUsername(username);
    if (accountStore.accounts[key])
      return sendJson(response, 409, {
        ok: false,
        error: "Esse usuário já existe.",
      });
    const salt = randomBytes(16).toString("hex");
    accountStore.accounts[key] = {
      username,
      salt,
      passwordHash: await passwordHash(password, salt),
      deck: null,
      faction: null,
      currency: INITIAL_CURRENCY,
      gamesPlayed: 0,
      collection: {},
      createdAt: new Date().toISOString(),
    };
    saveAccounts();
    const token = createSession(key);
    return sendJson(response, 201, {
      ok: true,
      token,
      ...publicAccount(accountStore.accounts[key]),
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(request);
    const key = normalizeUsername(body.username);
    const account = accountStore.accounts[key];
    if (!account || typeof body.password !== "string")
      return sendJson(response, 401, {
        ok: false,
        error: "Usuário ou senha inválidos.",
      });
    const candidate = Buffer.from(
      await passwordHash(body.password, account.salt),
      "hex",
    );
    const expected = Buffer.from(account.passwordHash, "hex");
    if (
      candidate.length !== expected.length ||
      !timingSafeEqual(candidate, expected)
    )
      return sendJson(response, 401, {
        ok: false,
        error: "Usuário ou senha inválidos.",
      });
    const token = createSession(key);
    return sendJson(response, 200, {
      ok: true,
      token,
      ...publicAccount(account),
    });
  }

  if (request.method === "GET" && pathname === "/api/auth/session") {
    const session = authenticatedSession(request);
    if (!session)
      return sendJson(response, 401, { ok: false, error: "Sessão expirada." });
    return sendJson(response, 200, {
      ok: true,
      ...publicAccount(session.account),
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const session = authenticatedSession(request);
    if (session) sessions.delete(session.token);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "PUT" && pathname === "/api/deck") {
    const session = authenticatedSession(request);
    if (!session)
      return sendJson(response, 401, {
        ok: false,
        error: "Faça login para salvar este deck.",
      });
    const body = await readJson(request);
    const deck = sanitizeDeck(body.deck);
    const total = deck.reduce((sum, entry) => sum + entry.quantidade, 0);
    if (total !== 20)
      return sendJson(response, 400, {
        ok: false,
        error: "O deck precisa ter exatamente 20 cartas.",
      });
    ensureAccountDefaults(session.account);
    const requested = new Map();
    for (const entry of deck) {
      const key = cardKey(entry.tipo, entry.nome);
      requested.set(key, (requested.get(key) || 0) + entry.quantidade);
    }
    const exceedsCollection = [...requested].some(
      ([key, quantity]) =>
        quantity > (Number(session.account.collection[key]) || 0),
    );
    if (exceedsCollection)
      return sendJson(response, 400, {
        ok: false,
        error: "O deck contém cartas que não pertencem à sua coleção.",
      });
    session.account.deck = deck;
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, { ok: true, deck });
  }

  if (request.method === "POST" && pathname === "/api/account/faction") {
    const session = authenticatedSession(request);
    if (!session)
      return sendJson(response, 401, {
        ok: false,
        error: "Faça login para escolher uma facção.",
      });
    ensureAccountDefaults(session.account);
    if (session.account.faction)
      return sendJson(response, 409, {
        ok: false,
        error: "A facção inicial já foi escolhida.",
      });
    const body = await readJson(request);
    const faction = String(body.faction || "").toLowerCase();
    if (!FACTION_CARDS[faction])
      return sendJson(response, 400, { ok: false, error: "Facção inválida." });
    const starterDeck = starterForFaction(faction);
    session.account.faction = faction;
    session.account.deck = starterDeck;
    grantCards(session.account, starterDeck);
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      ...publicAccount(session.account),
    });
  }

  if (request.method === "POST" && pathname === "/api/boosters/open") {
    const session = authenticatedSession(request);
    if (!session)
      return sendJson(response, 401, {
        ok: false,
        error: "Faça login para comprar boosters.",
      });
    ensureAccountDefaults(session.account);
    if (!session.account.faction)
      return sendJson(response, 400, {
        ok: false,
        error: "Escolha sua facção inicial primeiro.",
      });
    const body = await readJson(request);
    const faction = String(body.faction || "").toLowerCase();
    if (!FACTION_CARDS[faction])
      return sendJson(response, 400, { ok: false, error: "Booster inválido." });
    if (session.account.currency < BOOSTER_PRICE)
      return sendJson(response, 400, {
        ok: false,
        error: "Tijolinhos insuficientes.",
      });
    const cards = starterForFaction(faction).map((entry) => ({
      ...entry,
      nivel: "deck",
    }));
    session.account.currency -= BOOSTER_PRICE;
    grantCards(session.account, cards);
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      cards,
      ...publicAccount(session.account),
    });
  }

  if (
    request.method === "POST" &&
    pathname === "/api/admin/accounts/grant-cards"
  ) {
    if (!hasAdminAccess(request))
      return sendJson(response, 401, {
        ok: false,
        error: "Acesso administrativo negado.",
      });

    const body = await readJson(request);
    const username = String(body.username || "").trim();
    const key = normalizeUsername(username);
    const account = accountStore.accounts[key];
    if (!account)
      return sendJson(response, 404, {
        ok: false,
        error: "Conta não encontrada.",
      });

    const granted = sanitizeGrantedCards(body.cards);
    if (body.allAvailable === true) {
      granted.length = 0;
      granted.push(...ALL_AVAILABLE_CARDS);
    }
    if (body.fullDeck === true) {
      const faction = String(
        body.faction || account.faction || "",
      ).toLowerCase();
      if (!FACTION_CARDS[faction]) {
        return sendJson(response, 400, {
          ok: false,
          error: "Facção inválida para conceder deck completo.",
        });
      }
      granted.push(...starterForFaction(faction));
    }

    if (!granted.length)
      return sendJson(response, 400, {
        ok: false,
        error: "Nenhuma carta válida para conceder.",
      });

    grantCards(account, granted);
    account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      granted,
      account: publicAccount(account),
    });
  }

  if (
    request.method === "POST" &&
    pathname === "/api/admin/accounts/give-card"
  ) {
    if (!hasAdminAccess(request))
      return sendJson(response, 401, {
        ok: false,
        error: "Acesso administrativo negado.",
      });

    const body = await readJson(request);

    const conta = String(body.conta || body.username || "").trim();
    const nomeDaCarta = String(body.nomeDaCarta || body.cardName || "").trim();
    const quantidade = Math.max(
      1,
      Math.min(20, Math.floor(Number(body.quantidade) || 1)),
    );

    if (!conta || !nomeDaCarta) {
      return sendJson(response, 400, {
        ok: false,
        error: "Informe conta e nomeDaCarta.",
      });
    }

    try {
      const grantedCard = darCarta(conta, nomeDaCarta, quantidade);
      const account = accountStore.accounts[normalizeUsername(conta)];
      return sendJson(response, 200, {
        ok: true,
        granted: [
          {
            ...grantedCard,
            quantidade,
          },
        ],
        account: publicAccount(account),
      });
    } catch (error) {
      if (error.message === "ACCOUNT_NOT_FOUND") {
        return sendJson(response, 404, {
          ok: false,
          error: "Conta não encontrada.",
        });
      }
      if (error.message === "CARD_NOT_FOUND") {
        return sendJson(response, 404, {
          ok: false,
          error: "Carta não encontrada no catálogo administrativo.",
        });
      }
      throw error;
    }
  }

  if (
    request.method === "POST" &&
    pathname === "/api/admin/accounts/reset-collection"
  ) {
    if (!hasAdminAccess(request))
      return sendJson(response, 401, {
        ok: false,
        error: "Acesso administrativo negado.",
      });

    const body = await readJson(request);
    const conta = String(body.conta || body.username || "").trim();
    if (!conta)
      return sendJson(response, 400, {
        ok: false,
        error: "Informe conta ou username.",
      });
    const account = accountStore.accounts[normalizeUsername(conta)];
    if (!account)
      return sendJson(response, 404, {
        ok: false,
        error: "Conta não encontrada.",
      });
    ensureAccountDefaults(account);
    account.collection = {};
    account.deck = null;
    account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      account: publicAccount(account),
    });
  }

  if (request.method === "POST" && pathname === "/api/account/match-complete") {
    const session = authenticatedSession(request);
    if (!session)
      return sendJson(response, 401, { ok: false, error: "Sessão expirada." });
    ensureAccountDefaults(session.account);
    session.account.gamesPlayed += 1;
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      ...publicAccount(session.account),
    });
  }

  return sendJson(response, 404, { ok: false, error: "Rota não encontrada." });
}

function serveGame(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400);
    response.end("Requisição inválida.");
    return;
  }

  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (pathname.startsWith("/api/")) {
    handleApi(request, response, pathname).catch((error) => {
      console.error("Falha na API:", error.message);
      if (!response.headersSent)
        sendJson(response, error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
          ok: false,
          error: "Não foi possível processar a requisição.",
        });
    });
    return;
  }

  const allowed =
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/phaser.js" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/");
  if (!allowed) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("404 Not Found");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_ROOT, relativePath);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  stat(filePath, (error, info) => {
    if (error || !info.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("404 Not Found");
      return;
    }
    response.writeHead(200, {
      "content-type":
        CONTENT_TYPES[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "content-length": info.size,
      "cache-control":
        pathname.startsWith("/assets/") || pathname === "/phaser.js"
          ? "public, max-age=604800, immutable"
          : "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  });
}

const httpServer = createServer(serveGame);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  maxHttpBufferSize: 2e6,
});

function generateRoomCode() {
  let code;
  do code = String(Math.floor(100000 + Math.random() * 900000));
  while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return { code: room.code, players: room.players.size, turn: room.turn };
}

function sanitizeDeck(deck) {
  if (!Array.isArray(deck)) return [];
  const sanitized = [];
  let remaining = 20;
  for (const entry of deck) {
    if (remaining <= 0) break;
    const card = {
      tipo: String(entry?.tipo || "").slice(0, 20),
      nome: String(entry?.nome || "").slice(0, 120),
      quantidade: Math.max(
        0,
        Math.min(3, remaining, Math.floor(Number(entry?.quantidade) || 0)),
      ),
    };
    if (card.tipo && card.nome && card.quantidade) {
      sanitized.push(card);
      remaining -= card.quantidade;
    }
  }
  return sanitized;
}

function buildInviteUrl(base, code) {
  try {
    const url = new URL(base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.searchParams.set("room", code);
    return url.toString();
  } catch {
    return null;
  }
}

function removeFromRoom(socket) {
  const code = socket.data.room;
  const player = socket.data.player;
  if (!code || !rooms.has(code)) return;

  const room = rooms.get(code);
  room.players.delete(player);
  socket.to(code).emit("opponent-left");
  rooms.delete(code);
}

io.on("connection", (socket) => {
  socket.on("create-room", async (payload = {}, ack = () => {}) => {
    removeFromRoom(socket);
    const code = generateRoomCode();
    const room = {
      code,
      players: new Map([[1, socket.id]]),
      decks: new Map([[1, sanitizeDeck(payload.deck)]]),
      usernames: new Map([
        [1, accountFromToken(payload.accountToken)?.username || "Duelista 1"],
      ]),
      turn: 1,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    socket.data.player = 1;
    const inviteUrl = buildInviteUrl(
      PUBLIC_URL || payload.inviteBase || socket.handshake.headers.origin,
      code,
    );
    let qrCode = null;
    if (inviteUrl) {
      try {
        qrCode = await QRCode.toDataURL(inviteUrl, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#080b12", light: "#ffffff" },
        });
      } catch (error) {
        console.error("Falha ao gerar QR Code:", error.message);
      }
    }
    ack({
      ok: true,
      room: publicRoom(room),
      player: 1,
      inviteUrl,
      qrCode,
    });
  });

  socket.on("join-room", (payload = {}, ack = () => {}) => {
    const code = String(payload.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "Sala não encontrada." });
    if (room.players.size >= 2)
      return ack({ ok: false, error: "Esta sala já está cheia." });

    removeFromRoom(socket);
    room.players.set(2, socket.id);
    room.decks.set(2, sanitizeDeck(payload.deck));
    room.usernames.set(
      2,
      accountFromToken(payload.accountToken)?.username || "Duelista 2",
    );
    socket.join(code);
    socket.data.room = code;
    socket.data.player = 2;
    ack({ ok: true, room: publicRoom(room), player: 2 });
    io.to(code).emit("match-ready", {
      room: code,
      decks: { 1: room.decks.get(1), 2: room.decks.get(2) },
      usernames: { 1: room.usernames.get(1), 2: room.usernames.get(2) },
    });
  });

  socket.on("initial-state", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || socket.data.player !== 1 || room.players.size !== 2)
      return ack({ ok: false });
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      activePlayer: 1,
      initial: true,
    });
    ack({ ok: true });
  });

  socket.on("finish-turn", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || room.players.size !== 2)
      return ack({ ok: false, error: "A partida não está completa." });
    if (room.turn !== player)
      return ack({ ok: false, error: "Não é a sua vez." });

    room.turn = player === 1 ? 2 : 1;
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      result: payload.result || null,
      activePlayer: room.turn,
      initial: false,
    });
    ack({ ok: true, activePlayer: room.turn });
  });

  socket.on("live-state", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || room.players.size !== 2)
      return ack({ ok: false, error: "A partida não está completa." });
    if (room.turn !== player)
      return ack({ ok: false, error: "Não é a sua vez." });
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      activePlayer: room.turn,
      live: true,
      initial: false,
    });
    ack({ ok: true });
  });

  // Sincroniza apenas a exibição do relógio no cliente adversário. A
  // autoridade para encerrar o turno continua no jogador ativo; o servidor
  // valida a sala e a vez para um cliente nunca poder falsificar o timer do
  // outro lado.
  socket.on("turn-time", (payload = {}) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || room.players.size !== 2 || room.turn !== player) return;
    const remainingMs = Math.max(
      0,
      Math.min(60_000, Number(payload.remainingMs) || 0),
    );
    socket.to(room.code).emit("turn-time", {
      activePlayer: player,
      remainingMs,
      running: payload.running !== false,
    });
  });

  socket.on("surrender", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    socket.to(room.code).emit("opponent-surrendered");
  });

  socket.on("leave-room", () => {
    removeFromRoom(socket);
    socket.data.room = null;
    socket.data.player = null;
  });

  socket.on("disconnect", () => removeFromRoom(socket));
});

httpServer.listen(PORT, () => {
  console.log(`Cyberduel multiplayer ouvindo na porta ${PORT}`);
});
