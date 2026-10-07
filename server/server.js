const { createServer } = require("http");
const {
  createReadStream,
  stat,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
} = require("fs");
const {
  createHash,
  randomBytes,
  randomInt,
} = require("crypto");
const path = require("path");
const { runInNewContext } = require("node:vm");
const { Server } = require("socket.io");
const { OAuth2Client } = require("google-auth-library");
const QRCode = require("qrcode");
const { networkInterfaces } = require("node:os");
const ranking = require("./ranking");
const matchmaking = new Map();
const battleAnnouncements = require("../js/battle-announcements");

const PORT = Number(process.env.PORT) || 3000;
const LOCAL_LOGIN = process.env.CYBERDUEL_LOCAL_LOGIN === "1" && process.env.CYBERDUEL_DEBUG === "1";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const canAuthenticate = account => Boolean(account?.googleSub || (LOCAL_LOGIN && account?.localAccount === true));
const PUBLIC_URL = String(process.env.PUBLIC_URL || "").trim();
const PUBLIC_ROOT = path.resolve(__dirname, "..");
const PROFILE_PHOTOS = readdirSync(path.join(PUBLIC_ROOT, "assets/fotosdeperfil"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith("_icon.png"))
  .map((entry) => `assets/fotosdeperfil/${entry.name}`).sort();
const FACTION_PHOTOS = {
  raspcorp: "assets/fotosdeperfil/raspclay_icon.png",
  echossystem: "assets/fotosdeperfil/boi_icon.png",
};
const DATA_DIR = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, "data"),
);
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const rooms = new Map();
const sessions = new Map();
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const BOOSTER_PRICE = 100;
const INITIAL_CURRENCY = 500;
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const googleAuth = new OAuth2Client({ clientId: GOOGLE_CLIENT_ID, transporterOptions: { timeout: 10000 } });
// ponytail: tentativas em memória; armazenamento compartilhado se houver múltiplas instâncias.
const googleLogins = new Map();

function environmentInteger(name, fallback, minimum = 0, maximum = 100000) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

const BOOSTER_CONFIG = Object.freeze({
  cardsPerPack: 5,
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

// O catálogo administrativo usa apenas as cartas implementadas no jogo.
const ALL_AVAILABLE_CARDS = Object.freeze(
  runInNewContext(
    `${readFileSync(path.join(PUBLIC_ROOT, "js/cartas.js"), "utf8")}
    [
      ...POOL_CARTAS_MONSTRO.map((c) => ({ tipo: "monstro", nome: c.nome, booster: c.booster, nivel: classificarNivelCarta(c.nome, c.poder, "monstro", c.lendaria), quantidade: 1 })),
      ...POOL_CARTAS_EFEITO.map(({ nome, booster }) => ({ tipo: "efeito", nome, booster, nivel: "utilidade", quantidade: 1 })),
      ...POOL_CARTAS_TERRENO.map(({ nome, booster }) => ({ tipo: "terreno", nome, booster, nivel: "utilidade", quantidade: 1 })),
    ];`,
    { console: { log() {} } },
    { filename: "js/cartas.js", timeout: 1000 },
  ),
);

const BOOSTER_CARDS = Object.freeze(Object.fromEntries(
  [...new Set(ALL_AVAILABLE_CARDS.map((c) => c.booster))].map((faction) => [faction,
    ALL_AVAILABLE_CARDS.filter((c) => c.booster === faction).map((c) => [c.tipo, c.nome, c.nivel, 1])]),
));

const ADMIN_USERNAMES = new Set(String(process.env.ADMIN_USERNAMES || "")
  .split(",").map(name => name.trim().toLocaleLowerCase("pt-BR")).filter(Boolean));

function cardKey(tipo, nome) {
  return `${tipo}:${nome}`;
}

function ensureAccountDefaults(account) {
  if (!account || typeof account !== "object") return account;
  if (!Object.hasOwn(account, "faction")) account.faction = null;
  if (!Number.isFinite(account.currency)) account.currency = INITIAL_CURRENCY;
  if (!Number.isFinite(account.gamesPlayed)) account.gamesPlayed = 0;
  if (!Number.isFinite(account.rating)) account.rating = 1000;
  for (const key of ["rankedGames", "rankedWins", "rankedLosses"])
    if (!Number.isFinite(account[key])) account[key] = 0;
  if (!Number.isFinite(account.humanGames)) account.humanGames = account.rankedGames;
  if (!Number.isFinite(account.humanWins)) account.humanWins = account.rankedWins;
  for (const key of ["clubGames", "clubWins"])
    if (!Number.isFinite(account[key])) account[key] = 0;
  if (!account.tutorial || typeof account.tutorial !== "object") {
    const existing = Boolean(account.faction);
    account.tutorial = { introSeen: existing, named: existing, wantsTutorial: existing ? true : null,
      completed: existing, deckExplained: existing, farewellSeen: existing, seen: [] };
  }
  if (!account.collection || typeof account.collection !== "object")
    account.collection = {};
  if (!account.starterCollection || typeof account.starterCollection !== "object")
    account.starterCollection = Object.fromEntries(starterForFaction(account.faction).map(c => [cardKey(c.tipo, c.nome), c.quantidade]));
  if (!Array.isArray(account.boosters)) account.boosters = [];
  if (typeof account.nickname !== "string" || !account.nickname.trim()) account.nickname = account.googleSub ? "" : account.username;
  if (account.googleSub && !account.nickname) account.tutorial.named = false;
  if (!PROFILE_PHOTOS.includes(account.avatar)) account.avatar = FACTION_PHOTOS[account.faction] || "";
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

// Persistimos apenas hashes: o arquivo não contém tokens utilizáveis como Bearer.
try {
  const loaded = JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
  for (const [key, session] of Object.entries(loaded.sessions || {})) {
    if (/^[a-f0-9]{64}$/.test(key) && session &&
        Number.isFinite(session.expiresAt) && session.expiresAt > Date.now() &&
        canAuthenticate(accountStore.accounts[session.accountKey])) {
      sessions.set(key, session);
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") console.error("Falha ao carregar sessões:", error.message);
}

function sessionKey(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function saveSessions() {
  for (const [key, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(key);
  }
  writeFileSync(`${SESSIONS_FILE}.tmp`, JSON.stringify({ version: 1, sessions: Object.fromEntries(sessions) }), { mode: 0o600 });
  renameSync(`${SESSIONS_FILE}.tmp`, SESSIONS_FILE);
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

// Cartas reservadas e pagamentos ficam no mesmo arquivo, em uma única gravação.
function saveMarketTrade(accounts, change) {
  const listings = [...(accountStore.marketListings || [])];
  const previous = accounts.map(account => ({ account, collection: { ...account.collection }, currency: account.currency }));
  try {
    change();
    saveAccounts();
  } catch (error) {
    accountStore.marketListings = listings;
    previous.forEach(({ account, collection, currency }) => Object.assign(account, { collection, currency }));
    error.marketPersistence = true;
    throw error;
  }
}

// Anúncios antigos não podem manter cópias do kit inicial reservadas para venda.
let returnedStarterCards = false;
accountStore.marketListings = (accountStore.marketListings || []).filter(listing => {
  const seller = accountStore.accounts[listing.seller], key = cardKey(listing.tipo, listing.nome);
  if (seller && (seller.collection[key] || 0) < (seller.starterCollection[key] || 0)) {
    grantCards(seller, [listing]);
    returnedStarterCards = true;
    return false;
  }
  return true;
});
if (returnedStarterCards) saveAccounts();

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function validUsername(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{3,24}$/.test(value);
}

function accountByUsername(username) {
  const key = normalizeUsername(username);
  // ponytail: busca linear; índice por username se o volume de contas exigir.
  return Object.values(accountStore.accounts).find(account => normalizeUsername(account.username) === key);
}

function createSession(accountKey) {
  const token = randomBytes(32).toString("hex");
  sessions.set(sessionKey(token), {
    accountKey,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });
  saveSessions();
  return token;
}

function authenticatedSession(request) {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(
    String(request.headers.authorization || ""),
  );
  if (!match) return null;
  const session = sessions.get(sessionKey(match[1]));
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionKey(match[1]));
    return null;
  }
  const account = accountStore.accounts[session.accountKey];
  return canAuthenticate(account) ? { token: match[1], account } : null;
}

function accountFromToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ""))) return null;
  const session = sessions.get(sessionKey(token));
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionKey(token));
    return null;
  }
  const account = accountStore.accounts[session.accountKey];
  return canAuthenticate(account) && !needsRegistration(account) ? account : null;
}

function needsRegistration(account) {
  return Boolean(account.googleSub && !validUsername(account.username));
}

function allowedFrontend(origin, host) {
  try {
    const frontend = new URL(origin);
    const backend = new URL(`http://${host}`);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return /^https?:$/.test(frontend.protocol) && (
      frontend.hostname === backend.hostname ||
      (loopback.has(frontend.hostname) && loopback.has(backend.hostname))
    );
  } catch {
    return false;
  }
}

function registerCouncilEntries() {
  const newcomers = ranking.leaderboard(Object.values(accountStore.accounts)).slice(0, 10).filter(account => !account.councilReached);
  for (const account of newcomers) account.councilReached = true;
  return newcomers.length > 0;
}

function publicAccount(account) {
  ensureAccountDefaults(account);
  if (registerCouncilEntries()) saveAccounts();
  return {
    username: account.username,
    nickname: account.nickname,
    authProvider: account.localAccount ? "local" : account.googleSub ? "google" : "password",
    isAdmin: isAdminAccount(account),
    needsRegistration: needsRegistration(account),
    needsUsername: Boolean(account.googleSub && !validUsername(account.username)),
    avatar: account.avatar,
    profilePhotos: PROFILE_PHOTOS,
    rating: account.rating, rank: ranking.playerProfile(account).rank,
    rankedGames: account.rankedGames, rankedWins: account.rankedWins, rankedLosses: account.rankedLosses,
    deck: account.deck || null,
    faction: account.faction,
    currency: account.currency,
    gamesPlayed: account.gamesPlayed,
    humanGames: account.humanGames, humanWins: account.humanWins,
    clubGames: account.clubGames, clubWins: account.clubWins,
    tutorial: account.tutorial, councilReached: Boolean(account.councilReached),
    clubUnlocked: account.humanWins >= 3,
    collection: account.collection,
    starterCollection: account.starterCollection,
    boosterPrice: BOOSTER_PRICE,
    boosters: account.boosters.filter((pack) => !pack.openedAt).map(({ id, faction, purchasedAt }) => ({ id, faction, purchasedAt })),
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
  ALL_AVAILABLE_CARDS.map(({ tipo, nome }) => ({
    tipo, nome, lookup: normalizeText(nome),
  })),
);

function resolveCardByName(nomeDaCarta) {
  const lookup = normalizeText(nomeDaCarta);
  if (!lookup) return null;
  return ADMIN_CARD_INDEX.find((card) => card.lookup === lookup) || null;
}

function darCarta(conta, nomeDaCarta, quantidade = 1) {
  const account =
    typeof conta === "string"
      ? accountByUsername(conta)
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

function isAdminAccount(account) {
  return Boolean((LOCAL_LOGIN && account?.localAccount === true) || (account?.googleSub && !needsRegistration(account) &&
    ADMIN_USERNAMES.has(account.username.toLocaleLowerCase("pt-BR"))));
}

function rollBooster(faction, gamesPlayed) {
  const definitions = BOOSTER_CARDS[faction] || [];
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

function localLoginAllowed(request) {
  if (!LOCAL_LOGIN || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(`http://${request.headers.host}`).hostname) &&
      (!request.headers.origin || (LOOPBACK_HOSTS.has(new URL(request.headers.origin).hostname) && allowedFrontend(request.headers.origin, request.headers.host)));
  } catch { return false; }
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/options")
    return sendJson(response, 200, { ok: true, localLogin: localLoginAllowed(request) });

  if (request.method === "POST" && pathname === "/api/auth/local") {
    if (!localLoginAllowed(request))
      return sendJson(response, 403, { ok: false, error: "Acesso local disponível apenas com npm run dev nesta máquina." });
    const body = await readJson(request);
    const name = typeof body.username === "string" ? body.username.trim() : "";
    if (!validUsername(name) || name.length > 18)
      return sendJson(response, 400, { ok: false, error: "Use um nome local de 3 a 18 caracteres: letras, números, ponto, hífen ou sublinhado." });
    const username = `local_${name}`;
    const accountKey = normalizeUsername(username);
    let account = accountStore.accounts[accountKey];
    const existing = accountByUsername(username);
    if ((account && !account.localAccount) || (existing && existing !== account))
      return sendJson(response, 409, { ok: false, error: "Nome local já está em uso." });
    if (!account) {
      account = ensureAccountDefaults({ username, nickname: name, localAccount: true, createdAt: new Date().toISOString() });
      accountStore.accounts[accountKey] = account;
      saveAccounts();
    }
    return sendJson(response, 200, { ok: true, token: createSession(accountKey), ...publicAccount(account) });
  }

  if (["/api/auth/login", "/api/auth/register"].includes(pathname))
    return sendJson(response, 410, { ok: false, error: "O acesso por senha foi desativado. Entre com Google." });

  if (pathname.startsWith("/api/auth/google")) {
    if (!GOOGLE_CLIENT_ID)
      return sendJson(response, 503, { ok: false, error: "Login com Google ainda não configurado no servidor." });
    if (!allowedFrontend(request.headers.origin, request.headers.host))
      return sendJson(response, 403, { ok: false, error: "Origem de login não autorizada." });
  }

  if (request.method === "POST" && pathname === "/api/auth/google/start") {
    for (const [id, login] of googleLogins) {
      if (login.expiresAt <= Date.now()) googleLogins.delete(id);
    }
    if (googleLogins.size >= 1000)
      return sendJson(response, 429, { ok: false, error: "Muitas tentativas de login. Tente novamente em alguns minutos." });
    const loginId = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    googleLogins.set(sessionKey(loginId), { nonce, expiresAt: Date.now() + 10 * 60 * 1000 });
    return sendJson(response, 200, { ok: true, clientId: GOOGLE_CLIENT_ID, loginId, nonce });
  }

  if (request.method === "POST" && pathname === "/api/auth/google") {
    const body = await readJson(request);
    const key = sessionKey(body.loginId || "");
    const login = googleLogins.get(key);
    googleLogins.delete(key);
    if (!login || login.expiresAt <= Date.now() || typeof body.credential !== "string")
      return sendJson(response, 401, { ok: false, error: "Login expirado. Tente entrar com Google novamente." });
    let identity;
    try {
      const ticket = await googleAuth.verifyIdToken({ idToken: body.credential, audience: GOOGLE_CLIENT_ID });
      identity = ticket.getPayload();
      if (typeof identity?.sub !== "string" || !identity.sub || identity.nonce !== login.nonce) throw new Error("Invalid Google identity");
    } catch {
      return sendJson(response, 401, { ok: false, error: "Não foi possível validar sua conta Google. Tente novamente." });
    }
    // O sub identifica a conta; nome e email do Google não vinculam contas antigas.
    let entry = Object.entries(accountStore.accounts).find(([, account]) => account.googleSub === identity.sub);
    if (!entry) {
      const accountKey = `google_${randomBytes(16).toString("hex")}`;
      const account = ensureAccountDefaults({
        username: accountKey, googleSub: identity.sub, nickname: "", deck: null,
        createdAt: new Date().toISOString(),
      });
      accountStore.accounts[accountKey] = account;
      saveAccounts();
      entry = [accountKey, account];
    }
    return sendJson(response, 200, { ok: true, token: createSession(entry[0]), ...publicAccount(entry[1]) });
  }

  const pending = authenticatedSession(request);
  if (pending && needsRegistration(pending.account) && ![
    "/api/auth/session", "/api/auth/logout", "/api/account/profile",
  ].includes(pathname))
    return sendJson(response, 403, { ok: false, error: "Escolha seu nick único antes de continuar." });

  if (pathname.startsWith("/api/market/")) {
    if (!pending) return sendJson(response, 401, { ok: false, error: "Entre na sua conta para negociar cartas." });
    const account = pending.account;
    if (!account.faction) return sendJson(response, 403, { ok: false, error: "Escolha sua facção primeiro." });
    const listings = accountStore.marketListings || [];
    if (request.method === "GET" && pathname === "/api/market/listings") {
      const entries = listings.map(({ seller, ...listing }) => {
        const owner = accountStore.accounts[seller];
        return { ...listing, seller: owner?.username || "", nickname: owner?.nickname || "", mine: owner === account };
      });
      return sendJson(response, 200, { ok: true, listings: entries, ...publicAccount(account) });
    }
    if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: "Método inválido." });
    const body = await readJson(request);
    // Releitura após o await: outra compra pode ter encerrado o anúncio.
    if (!body || typeof body !== "object" || Array.isArray(body))
      return sendJson(response, 400, { ok: false, error: "Dados do anúncio inválidos." });
    const current = accountStore.marketListings || [];
    if (pathname === "/api/market/listings") {
      const card = ALL_AVAILABLE_CARDS.find(c => c.tipo === body.tipo && c.nome === body.nome);
      const quantity = body.quantidade, price = body.preco;
      if (!card || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 ||
          !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(price * quantity))
        return sendJson(response, 400, { ok: false, error: "Escolha uma carta, de 1 a 99 cópias e um preço inteiro positivo em tijolinhos." });
      const key = cardKey(card.tipo, card.nome);
      const deckCopies = (account.deck || []).filter(c => cardKey(c.tipo, c.nome) === key).reduce((n, c) => n + c.quantidade, 0);
      const protectedCopies = Math.max(deckCopies, account.starterCollection[key] || 0);
      if (quantity > (account.collection[key] || 0) - protectedCopies)
        return sendJson(response, 409, { ok: false, error: "Não há cópias vendáveis suficientes. O kit inicial não pode ser vendido, e cópias do deck salvo ficam protegidas." });
      const seller = Object.keys(accountStore.accounts).find(key => accountStore.accounts[key] === account);
      if (current.filter(l => l.seller === seller).length >= 100)
        return sendJson(response, 409, { ok: false, error: "Você já tem 100 anúncios ativos. Cancele ou venda algum primeiro." });
      const listing = { id: randomBytes(16).toString("hex"), seller, tipo: card.tipo, nome: card.nome,
        quantidade: quantity, preco: price, createdAt: new Date().toISOString() };
      saveMarketTrade([account], () => {
        account.collection[key] -= quantity;
        accountStore.marketListings = [listing, ...current];
      });
      return sendJson(response, 201, { ok: true, listingId: listing.id, ...publicAccount(account) });
    }
    const listing = current.find(l => l.id === body.id);
    if (!listing) return sendJson(response, 409, { ok: false, error: "Este anúncio já foi comprado ou cancelado. Atualize a lista." });
    const seller = accountStore.accounts[listing.seller];
    const cardCount = (account.collection[cardKey(listing.tipo, listing.nome)] || 0) + listing.quantidade;
    if (!Number.isSafeInteger(cardCount))
      return sendJson(response, 409, { ok: false, error: "Sua coleção atingiu o limite de cópias." });
    if (pathname === "/api/market/cancel") {
      if (seller !== account) return sendJson(response, 403, { ok: false, error: "Só o vendedor pode cancelar este anúncio." });
      saveMarketTrade([account], () => {
        grantCards(account, [listing]);
        accountStore.marketListings = current.filter(l => l !== listing);
      });
      return sendJson(response, 200, { ok: true, ...publicAccount(account) });
    }
    if (pathname === "/api/market/buy") {
      if (!seller || !canAuthenticate(seller) || seller === account)
        return sendJson(response, 403, { ok: false, error: "Você só pode comprar anúncios de outros jogadores ativos." });
      const total = listing.preco * listing.quantidade;
      const proceeds = Number(BigInt(total) * 4n / 5n);
      if (!Number.isSafeInteger(account.currency) || account.currency < total)
        return sendJson(response, 409, { ok: false, error: "Tijolinhos insuficientes para esta compra." });
      if (!Number.isSafeInteger(seller.currency + proceeds))
        return sendJson(response, 409, { ok: false, error: "O saldo do vendedor atingiu o limite." });
      saveMarketTrade([account, seller], () => {
        account.currency -= total;
        seller.currency += proceeds;
        grantCards(account, [listing]);
        accountStore.marketListings = current.filter(l => l !== listing);
      });
      return sendJson(response, 200, { ok: true, ...publicAccount(account) });
    }
    return sendJson(response, 404, { ok: false, error: "Ação do mercado não encontrada." });
  }

  if (pathname.startsWith("/api/admin/")) {
    if (!pending) return sendJson(response, 401, { ok: false, error: "Entre na sua conta primeiro." });
    if (!isAdminAccount(pending.account))
      return sendJson(response, 403, { ok: false, error: "Esta conta não é administradora." });
  }

  if (request.method === "GET" && pathname === "/api/leaderboard") {
    const entries = ranking.leaderboard(Object.values(accountStore.accounts))
      .slice(0, 20).map((account, index) => ({ position: index + 1, ...ranking.playerProfile(account),
        wins: account.rankedWins, losses: account.rankedLosses, games: account.rankedGames }));
    return sendJson(response, 200, { ok: true, entries });
  }

  if (request.method === "GET" && pathname === "/api/config") {
    return sendJson(response, 200, {
      ok: true,
      booster: {
        price: BOOSTER_PRICE,
        ...BOOSTER_CONFIG,
      },
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
    if (session) {
      sessions.delete(sessionKey(session.token));
      saveSessions();
    }
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "PUT" && pathname === "/api/account/profile") {
    const session = authenticatedSession(request);
    if (!session) return sendJson(response, 401, { ok: false, error: "Entre na conta para editar seu perfil." });
    const body = await readJson(request);
    const needsUsername = !validUsername(session.account.username);
    const username = needsUsername && typeof body.username === "string" ? body.username.trim() : session.account.username;
    if (!validUsername(username))
      return sendJson(response, 400, { ok: false, error: "Use um username de 3 a 24 caracteres: letras, números, ponto, hífen ou sublinhado." });
    const completingUsername = needsUsername && body.nickname === undefined;
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : completingUsername ? session.account.nickname || "" : "";
    if ((!nickname && !completingUsername) || Array.from(nickname).length > 32 || /[\u0000-\u001f\u007f]/.test(nickname))
      return sendJson(response, 400, { ok: false, error: "Use um apelido de 1 a 32 caracteres." });
    const avatar = body.avatar === undefined ? session.account.avatar : body.avatar;
    if (avatar !== "" && !PROFILE_PHOTOS.includes(avatar))
      return sendJson(response, 400, { ok: false, error: "Escolha uma das fotos de perfil disponíveis." });
    const owner = accountByUsername(username);
    if (owner && owner !== session.account)
      return sendJson(response, 409, { ok: false, error: "Esse username já está em uso. Escolha outro." });
    session.account.username = username;
    session.account.nickname = nickname;
    if (nickname && session.account.tutorial?.introSeen) session.account.tutorial.named = true;
    session.account.avatar = avatar || FACTION_PHOTOS[session.account.faction] || "";
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, { ok: true, ...publicAccount(session.account) });
  }

  if (request.method === "PUT" && pathname === "/api/account/tutorial") {
    const session = authenticatedSession(request);
    if (!session) return sendJson(response, 401, { ok: false, error: "Entre na conta para salvar o tutorial." });
    const body = await readJson(request);
    const account = session.account;
    ensureAccountDefaults(account);
    const flags = ["introSeen", "named", "wantsTutorial", "completed", "deckExplained", "farewellSeen"];
    if (!body || Array.isArray(body) || typeof body !== "object" || !Object.keys(body).length ||
        Object.keys(body).some(key => !flags.includes(key) && key !== "seen") ||
        flags.some(key => key in body && typeof body[key] !== "boolean"))
      return sendJson(response, 400, { ok: false, error: "Progresso de tutorial inválido." });
    const eligible = { three: account.gamesPlayed >= 3, ten: account.gamesPlayed >= 10,
      club: account.humanWins >= 3, council: Boolean(publicAccount(account).councilReached) && ranking.eligible(account) };
    if ("seen" in body && (typeof body.seen !== "string" || !Object.hasOwn(eligible, body.seen) || eligible[body.seen] !== true))
      return sendJson(response, 400, { ok: false, error: "Este diálogo ainda não foi liberado." });
    if ("wantsTutorial" in body && account.tutorial.wantsTutorial !== null && body.wantsTutorial !== account.tutorial.wantsTutorial)
      return sendJson(response, 409, { ok: false, error: "A escolha inicial já foi registrada." });
    for (const flag of flags) if (flag in body)
      account.tutorial[flag] = flag === "wantsTutorial" ? body[flag] : account.tutorial[flag] || body[flag];
    if (body.seen && !account.tutorial.seen.includes(body.seen)) account.tutorial.seen.push(body.seen);
    account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, { ok: true, ...publicAccount(account) });
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
    session.account.avatar = FACTION_PHOTOS[faction];
    session.account.deck = starterDeck;
    session.account.starterCollection = Object.fromEntries(starterDeck.map(c => [cardKey(c.tipo, c.nome), c.quantidade]));
    grantCards(session.account, starterDeck);
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      ...publicAccount(session.account),
    });
  }

  if (request.method === "POST" && ["/api/boosters/open", "/api/boosters/buy"].includes(pathname)) {
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
    if (pathname === "/api/boosters/open" && body.packId) {
      const pack = session.account.boosters.find((entry) => entry.id === body.packId);
      if (!pack) return sendJson(response, 404, { ok: false, error: "Pacote não encontrado no seu inventário." });
      if (!pack.openedAt) {
        if (body.debugLegendary === true) {
          if (process.env.CYBERDUEL_DEBUG !== "1" || !isAdminAccount(session.account))
            return sendJson(response, 403, { ok: false, error: "garantelendaria() exige uma conta admin e o servidor em modo de teste (npm run dev)." });
          const pool = BOOSTER_CARDS[pack.faction].filter((card) => card[2] === "lendaria");
          if (!pool.length)
            return sendJson(response, 400, { ok: false, error: "Esta facção não possui lendárias. Escolha outro pacote." });
          if (!pack.cards.some((card) => card.nivel === "lendaria")) {
            const [tipo, nome, nivel] = pool[randomInt(pool.length)];
            pack.cards[pack.cards.length - 1] = { tipo, nome, nivel, quantidade: 1 };
          }
        }
        grantCards(session.account, pack.cards);
        pack.openedAt = new Date().toISOString();
        session.account.updatedAt = pack.openedAt;
        saveAccounts();
      }
      return sendJson(response, 200, { ok: true, cards: pack.cards, ...publicAccount(session.account) });
    }
    // Clientes antigos ainda podem comprar e abrir em uma única chamada.
    if (pathname === "/api/boosters/buy") {
      if (typeof body.purchaseId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.purchaseId))
        return sendJson(response, 400, { ok: false, error: "Identificador de compra inválido." });
      const previous = session.account.boosters.find((entry) => entry.id === body.purchaseId);
      if (previous) return sendJson(response, 200, { ok: true, ...publicAccount(session.account) });
    }
    const faction = String(body.faction || "").toLowerCase();
    if (!BOOSTER_CARDS[faction])
      return sendJson(response, 400, { ok: false, error: "Booster inválido." });
    if (session.account.currency < BOOSTER_PRICE)
      return sendJson(response, 400, {
        ok: false,
        error: "Tijolinhos insuficientes.",
      });
    let guaranteedLegendary = null;
    if (body.debugLegendary === true) {
      if (process.env.CYBERDUEL_DEBUG !== "1" || !isAdminAccount(session.account))
        return sendJson(response, 403, { ok: false, error: "garantelendaria() exige uma conta admin e o servidor em modo de teste (npm run dev)." });
      const pool = BOOSTER_CARDS[faction].filter((card) => card[2] === "lendaria");
      if (!pool.length)
        return sendJson(response, 400, { ok: false, error: "Esta facção não possui lendárias. Escolha outro pacote." });
      const [tipo, nome, nivel] = pool[randomInt(pool.length)];
      guaranteedLegendary = { tipo, nome, nivel, quantidade: 1 };
    }
    const cards = rollBooster(faction, session.account.gamesPlayed);
    if (guaranteedLegendary) cards[cards.length - 1] = guaranteedLegendary;
    session.account.currency -= BOOSTER_PRICE;
    if (pathname === "/api/boosters/buy") {
      session.account.boosters.push({ id: body.purchaseId, faction, cards, purchasedAt: new Date().toISOString() });
    } else {
      grantCards(session.account, cards);
    }
    session.account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      ...(pathname === "/api/boosters/open" ? { cards } : {}),
      ...publicAccount(session.account),
    });
  }

  if (request.method === "POST" && pathname === "/api/admin/accounts/grant-currency") {
    const body = await readJson(request);
    const amount = body.amount;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000)
      return sendJson(response, 400, { ok: false, error: "Informe um valor inteiro entre 1 e 1.000.000." });
    const account = accountByUsername(body.username);
    if (!account) return sendJson(response, 404, { ok: false, error: "Conta não encontrada." });
    ensureAccountDefaults(account);
    if (!Number.isSafeInteger(account.currency + amount))
      return sendJson(response, 400, { ok: false, error: "O saldo atingiu o limite permitido." });
    account.currency += amount;
    account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, { ok: true, added: amount, account: publicAccount(account) });
  }

  if (
    request.method === "POST" &&
    pathname === "/api/admin/accounts/grant-cards"
  ) {

    const body = await readJson(request);
    const username = String(body.username || "").trim();
    const account = accountByUsername(username);
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
      if (!BOOSTER_CARDS[faction]) {
        return sendJson(response, 400, {
          ok: false,
          error: "Facção inválida para conceder deck completo.",
        });
      }
      granted.push(...(FACTION_CARDS[faction] ? starterForFaction(faction) : ALL_AVAILABLE_CARDS.filter((c) => c.booster === faction)));
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
      const account = accountByUsername(conta);
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

    const body = await readJson(request);
    const conta = String(body.conta || body.username || "").trim();
    if (!conta)
      return sendJson(response, 400, {
        ok: false,
        error: "Informe conta ou username.",
      });
    const account = accountByUsername(conta);
    if (!account)
      return sendJson(response, 404, {
        ok: false,
        error: "Conta não encontrada.",
      });
    ensureAccountDefaults(account);
    account.collection = {};
    account.starterCollection = {};
    account.deck = null;
    account.updatedAt = new Date().toISOString();
    saveAccounts();
    return sendJson(response, 200, {
      ok: true,
      account: publicAccount(account),
    });
  }

  if (request.method === "POST" && ["/api/account/match-start", "/api/account/match-complete"].includes(pathname)) {
    const session = authenticatedSession(request);
    if (!session) return sendJson(response, 401, { ok: false, error: "Sessão expirada." });
    const account = ensureAccountDefaults(session.account);
    const body = await readJson(request);
    if (pathname.endsWith("match-start")) {
      if (body.mode !== "solo") return sendJson(response, 400, { ok: false, error: "Modo de partida inválido." });
      const match = { id: randomBytes(16).toString("hex") };
      // ponytail: últimos 100 solos por conta; IDs removidos são recusados, nunca pagos novamente.
      account.soloMatches = [...(account.soloMatches || []).slice(-99), match];
      saveAccounts();
      return sendJson(response, 200, { ok: true, matchId: match.id });
    }
    if (!["jogador", "inimigo", "empate"].includes(body.result))
      return sendJson(response, 400, { ok: false, error: "Resultado inválido." });
    const match = account.soloMatches?.find(entry => entry.id === body.matchId);
    if (!match) return sendJson(response, 404, { ok: false, error: "Partida solo não encontrada nesta conta." });
    if (match.result && match.result !== body.result)
      return sendJson(response, 409, { ok: false, error: "Esta partida já tem outro resultado." });
    if (!match.result) {
      // ponytail: o motor solo ainda roda no navegador; validar o combate exige levá-lo ao servidor.
      const reward = body.result === "jogador" ? 1000 : body.result === "inimigo" ? 200 : 0;
      if (!Number.isSafeInteger(account.currency + reward))
        return sendJson(response, 400, { ok: false, error: "O saldo atingiu o limite permitido." });
      match.result = body.result;
      match.reward = reward;
      account.currency += reward;
      account.gamesPlayed += 1;
      account.updatedAt = new Date().toISOString();
      saveAccounts();
    }
    return sendJson(response, 200, { ok: true, reward: match.reward, ...publicAccount(account) });
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

  if (["/apresentação", "/apresentação/", "/apresentacao/"].includes(pathname)) {
    response.writeHead(302, { location: "/apresentacao" });
    response.end();
    return;
  }

  const tableRoute = /^\/apresentacao([1-4])$/.exec(pathname);
  const tableRedirect = /^\/apresenta(?:ção|cao)([1-4])\/?$/.exec(pathname);
  if (!tableRoute && tableRedirect) {
    response.writeHead(302, { location: `/apresentacao${tableRedirect[1]}` });
    response.end();
    return;
  }
  if (pathname === "/apresentacao" || tableRoute) {
    const html = readFileSync(path.join(PUBLIC_ROOT, "index.html"), "utf8")
      .replace("<head>", `<head><base href="/"><script>window.CYBERDUEL_PRESENTATION=true;window.CYBERDUEL_TABLE=${tableRoute ? tableRoute[1] : "null"};</script>`);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-frame-options": "DENY" });
    response.end(html);
    return;
  }

  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (pathname.startsWith("/api/")) {
    // Permite o frontend local em outra porta (Live Server).
    const origin = request.headers.origin;
    if (origin) {
      response.setHeader("Vary", "Origin");
      if (allowedFrontend(origin, request.headers.host)) {
        const frontend = new URL(origin);
        response.setHeader("Access-Control-Allow-Origin", frontend.origin);
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      }
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    handleApi(request, response, pathname).catch((error) => {
      console.error("Falha na API:", error.message);
      if (!response.headersSent)
        sendJson(response, error.marketPersistence ? 500 : error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
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
  return { code: room.code, players: room.players.size, turn: room.turn, club: !!room.presentation, table: room.table || null };
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

function phaseInfo(room) {
  return { activePlayer: room.turn, phase: room.step < 2 ? "colocar" : "habilidades",
    step: room.step, starter: room.starter, round: room.round,
    deadline: room.deadline, serverNow: Date.now(),
    announcementAt: room.announcementAt, introUntil: room.introUntil, phaseStartsAt: room.phaseStartedAt,
    effectsPaused: !!room.effects, effectsSequence: room.effects?.sequence || 0,
    effectsRemaining: room.effects?.remaining ?? null };
}

function spectatorState(snapshot) {
  if (!snapshot) return null;
  const copy = JSON.parse(JSON.stringify(snapshot));
  const hidden = (card, i) => card ? { id: card.id ?? i, nome: "Carta oculta", tipo: "monstro", poder: 0, poderBase: 0 } : null;
  for (const player of [copy.jogador, copy.inimigo]) {
    player.deck = player.deck.map(hidden);
    player.hand = player.hand.map(hidden);
    player.field = player.field.map((card, i) => card?.ocultadaPelaToca && !card.revelada ?
      { ...hidden(card, i), ocultadaPelaToca: true, revelada: false } : card);
    player.traps = [];
    player.contribuicoesEfeito = {};
    player.recentlyDrawn = [];
  }
  for (const evento of copy.eventosEfeito || []) {
    if (evento.fonte.oculto) evento.fonte = { id: evento.fonte.id, nome: "Carta oculta", indice: evento.fonte.indice, oculto: true };
    evento.alvos = (evento.alvos || []).map((alvo) => alvo.oculto ? { lado: alvo.lado, indice: alvo.indice, id: alvo.id, nome: "Carta oculta", oculto: true, mudouEstado: true } : alvo);
  }
  return copy;
}

function presentationState(snapshot) {
  const state = spectatorState(snapshot);
  if (!state) return null;
  for (const player of [state.jogador, state.inimigo]) {
    player.hand = [];
    player.deck = [];
  }
  return state;
}

function presentationInfo(room) {
  return { ok: true, room: publicRoom(room), displayKey: room.displayKey, invitations: room.invitations,
    showCode: !!room.codeRequested,
    nicknames: Object.fromEntries(room.nicknames),
    seats: [1, 2].map(player => ({ player, connected: !!room.players.get(player) })),
    ...(room.state ? { update: { state: presentationState(room.state), ...phaseInfo(room), initial: true } } : {}) };
}

function notifyPresentation(room) {
  if (room.presentationHost) io.to(room.presentationHost).emit("presentation-room", presentationInfo(room));
  if (room.table) notifyClubTables();
}

function clubTableRoom(table) {
  return [...rooms.values()].find(room => room.table === table);
}

function clubTables() {
  return [1, 2, 3, 4].map(table => {
    const room = clubTableRoom(table);
    return { table, players: room ? [...room.players.values()].filter(Boolean).length : 0,
      occupiedSeats: room ? [...room.players.keys()] : [],
      available: !!room?.presentationHost && !room.state,
      locked: !!room?.state };
  });
}

function notifyClubTables() {
  io.to("club-tables").emit("club-tables", { ok: true, tables: clubTables() });
}

function broadcastState(room, extra = {}, except = null) {
  settleMatch(room);
  const update = { state: room.state, ...phaseInfo(room), ...extra };
  for (const id of room.players.values()) if (id && id !== except) io.to(id).emit("state-update", update);
  for (const id of room.spectators) io.to(id).emit("state-update", { ...update, state: spectatorState(room.state) });
  if (room.presentationHost) io.to(room.presentationHost).emit("state-update", { ...update, state: presentationState(room.state) });
}

function phaseDuration(room) {
  const enemy = room.turn === 1 ? room.state?.inimigo : room.state?.jogador;
  const analysts = (enemy?.field || []).filter((c) => c?.efeito?.tipo === "reduzir_tempo_oponente");
  const reduction = analysts.reduce((sum, c) => sum + Math.max(0, Number(c.efeito.valor) || 0), 0);
  const floor = Math.max(15, ...analysts.map((c) => Number(c.efeito.minimo) || 0));
  return Math.max(floor, 40 - reduction) * 1000;
}

function armPhaseClock(room, reset = true, initial = false) {
  clearTimeout(room.timer);
  if (room.effects) return;
  if (reset) {
    room.announcementAt = Math.max(Date.now(), room.startsAt || 0);
    room.introUntil = room.announcementAt + (initial ? battleAnnouncements.inicio.duracao : 0);
    room.phaseStartedAt = room.introUntil + battleAnnouncements[room.step < 2 ? "colocar" : "habilidades"].duracao;
  }
  room.deadline = room.phaseStartedAt + phaseDuration(room);
  if (room.state?.partidaEncerrada) return;
  room.timer = setTimeout(() => advancePhase(room), Math.max(0, room.deadline - Date.now()));
  room.timer.unref();
}

// A pausa pertence ao lote de eventos aceito, nunca ao tempo informado pelo cliente.
function pauseForEffects(room) {
  const events = (room.state?.eventosEfeito || []).filter(e => Number.isSafeInteger(e.id) && e.id > (room.lastEffectsSequence || 0));
  if (!events.length || room.state.partidaEncerrada) return;
  const sequence = Math.max(...events.map(e => e.id));
  room.lastEffectsSequence = sequence;
  const previous = room.effects;
  clearTimeout(previous?.timeout);
  clearTimeout(room.timer);
  room.effects = { sequence, startedAt: previous?.startedAt || Date.now(),
    remaining: previous?.remaining ?? Math.min(phaseDuration(room), Math.max(0, room.deadline - Date.now())),
    pending: new Set([...room.players].filter(([, id]) => id).map(([player]) => player)) };
  // Um cliente fechado não pode prender a sala indefinidamente.
  // Os novos áudios chegam a 5,2 s; reserva também o voo da carta e a conclusão visual.
  room.effects.timeout = setTimeout(() => resumeAfterEffects(room), Math.min(90000, events.length * 6500 + 5000));
  room.effects.timeout.unref();
}

function resumeAfterEffects(room) {
  if (!room.effects) return;
  clearTimeout(room.effects.timeout);
  const paused = Date.now() - room.effects.startedAt;
  room.phaseStartedAt += paused;
  room.announcementAt += paused;
  room.introUntil += paused;
  room.effects = null;
  if (!rooms.has(room.code) || room.state?.partidaEncerrada) return;
  armPhaseClock(room, false);
  io.to(room.code).emit("phase-clock", phaseInfo(room));
}

function advancePhase(room) {
  if (!room.state || room.state.partidaEncerrada || !rooms.has(room.code)) return;
  let result = null;
  if (room.step === 3) {
    const resolved = require("./duel-runtime").closeRound(room.state);
    room.state = resolved.state;
    room.result = result = resolved.result;
    room.round++;
    room.starter = 3 - room.starter;
    room.step = 0;
  } else room.step++;
  room.turn = room.step % 2 === 0 ? room.starter : 3 - room.starter;
  // A proteção termina no início da próxima fase de colocação do dono.
  if (room.step < 2) {
    const owner = room.turn === 1 ? room.state.jogador : room.state.inimigo;
    owner.field.forEach((c) => { if (c) c.protegidaPA = false; });
  }
  armPhaseClock(room);
  pauseForEffects(room);
  broadcastState(room, { result, phaseChanged: true });
  return result;
}

function removeFromRoom(socket, disconnect = false) {
  matchmaking.delete(socket.id);
  const code = socket.data.room;
  const room = rooms.get(code);
  if (!room) return;
  if (room.presentationHost === socket.id) {
    room.presentationHost = null;
    if (!disconnect) {
      clearTimeout(room.timer);
      socket.to(code).emit("opponent-left");
      rooms.delete(code);
    }
  } else if (!socket.data.player) {
    room.spectators.delete(socket.id);
  } else if (room.players.get(socket.data.player) === socket.id) {
    if (room.presentation && !room.state) {
      for (const key of ["players", "decks", "usernames", "nicknames", "accounts", "profiles", "resumeTokens"])
        room[key].delete(socket.data.player);
      notifyPresentation(room);
    } else if (disconnect) {
      room.players.set(socket.data.player, null);
      room.effects?.pending.delete(socket.data.player);
      if (room.effects && !room.effects.pending.size) resumeAfterEffects(room);
      notifyPresentation(room);
      socket.to(code).emit("opponent-offline");
    } else {
      if (room.ranked && !room.state?.partidaEncerrada) surrenderRoom(room, socket.data.player);
      clearTimeout(room.timer);
      socket.to(code).emit("opponent-left");
      rooms.delete(code);
    }
  }
  socket.leave(code);
  socket.data.room = null;
  socket.data.player = null;
  if (room.table) notifyClubTables();
}

function findResumable(payload) {
  const username = accountFromToken(payload.accountToken)?.username;
  for (const room of rooms.values()) {
    if (!room.state || room.state.partidaEncerrada) continue;
    for (const player of [1, 2]) {
      if ((payload.resumeToken && room.resumeTokens.get(player) === payload.resumeToken) ||
          (username && room.usernames.get(player) === username)) return { room, player };
    }
  }
  return null;
}

function createRoomRecord(socket, deck, account) {
  const code = generateRoomCode();
  const room = {
    code, players: new Map([[1, socket.id]]), decks: new Map([[1, deck]]),
    usernames: new Map([[1, account?.username || "Duelista 1"]]),
    nicknames: new Map([[1, account?.nickname || "Duelista 1"]]),
    profiles: new Map([[1, ranking.playerProfile(account)]]),
    accounts: new Map(account ? [[1, account]] : []),
    turn: 1, starter: 1, step: 0, round: 1, state: null,
    spectators: new Set(), resumeTokens: new Map([[1, randomBytes(32).toString("hex")]]),
    createdAt: Date.now(), deadline: null,
  };
  rooms.set(code, room);
  socket.join(code); socket.data.room = code; socket.data.player = 1;
  return room;
}

function emitMatchReady(room) {
  for (const [player, id] of room.players) io.to(id).emit("match-ready", {
    room: room.code, player, resumeToken: room.resumeTokens.get(player), ranked: !!room.ranked, arena: !!room.presentation,
    profiles: Object.fromEntries(room.profiles), ...phaseInfo(room),
    decks: Object.fromEntries(room.decks), usernames: Object.fromEntries(room.usernames),
    nicknames: Object.fromEntries(room.nicknames),
    ...(room.state ? { update: { state: room.state, ...phaseInfo(room), initial: true } } : {}),
  });
}

function settleMatch(room) {
  if (room.matchSettled || !room.state?.partidaEncerrada || !room.result?.fimDeJogo) return;
  const winner = room.result.resultadoCombate?.resultado;
  if (!["jogador", "inimigo", "empate"].includes(winner)) return;
  const accounts = [1, 2].map(player => room.accounts.get(player));
  if (room.ranked && accounts.every(Boolean)) ranking.applyResult(...accounts, winner);
  if (!room.debugFinal) [...new Set(accounts.filter(Boolean))].forEach(account => {
    ensureAccountDefaults(account);
    const player = accounts.indexOf(account) + 1;
    const winnerPlayer = winner === "jogador" ? 1 : winner === "inimigo" ? 2 : 0;
    const reward = !winnerPlayer || accounts[0] === accounts[1] ? 0 : player === winnerPlayer ? 2000 : 400;
    account.currency = Math.min(Number.MAX_SAFE_INTEGER, account.currency + reward);
    account.gamesPlayed += 1;
    if (accounts.every(Boolean) && accounts[0] !== accounts[1]) {
      account.humanGames += 1;
      if (player === winnerPlayer) account.humanWins += 1;
      if (room.presentation) {
        account.clubGames += 1;
        if (player === winnerPlayer) account.clubWins += 1;
      }
    }
    account.updatedAt = new Date().toISOString();
  });
  registerCouncilEntries();
  saveAccounts();
  room.matchSettled = true;
}

function surrenderRoom(room, player) {
  if (!room.state || room.state.partidaEncerrada) return;
  const resolved = require("./duel-runtime").finishBySurrender(room.state, player);
  clearTimeout(room.timer); room.deadline = null;
  room.state = resolved.state; room.result = resolved.result;
  room.resumeTokens.clear();
  broadcastState(room, { result: room.result });
}

function acceptClientState(room, state) {
  if (room.ranked) for (const key of ["turno", "maxTurnos", "rodadasParaVencer", "rodadasJogador", "rodadasInimigo", "partidaEncerrada"])
    state[key] = room.state[key];
  return state;
}

function accountHasMatch(username) {
  return [...rooms.values()].some(room => (!room.state || !room.state.partidaEncerrada) &&
    [...room.usernames.values()].includes(username));
}

function matchQueuedPlayers() {
  for (const entry of [...matchmaking.values()]) {
    if (!entry.socket.connected || !accountFromToken(entry.token) || accountHasMatch(entry.username)) {
      matchmaking.delete(entry.socket.id);
      entry.socket.emit("matchmaking-stopped", { error: "Busca encerrada. Verifique sua sessão ou partida ativa." });
    }
  }
  for (const entry of [...matchmaking.values()]) {
    if (!matchmaking.has(entry.socket.id)) continue;
    const opponent = ranking.chooseOpponent(entry, [...matchmaking.values()]);
    if (!opponent) continue;
    matchmaking.delete(entry.socket.id); matchmaking.delete(opponent.socket.id);
    const first = accountFromToken(entry.token), second = accountFromToken(opponent.token);
    const room = createRoomRecord(entry.socket, entry.deck, first);
    room.ranked = true;
    room.players.set(2, opponent.socket.id); room.decks.set(2, opponent.deck);
    room.usernames.set(2, second.username); room.nicknames.set(2, second.nickname);
    room.profiles.set(2, ranking.playerProfile(second));
    room.accounts.set(2, second);
    room.resumeTokens.set(2, randomBytes(32).toString("hex"));
    opponent.socket.join(room.code); opponent.socket.data.room = room.code; opponent.socket.data.player = 2;
    room.starter = room.turn = randomInt(1, 3);
    room.state = require("./duel-runtime").createMatch(entry.deck, opponent.deck);
    room.startsAt = Date.now() + 4000;
    armPhaseClock(room, true, true);
    emitMatchReady(room);
  }
}

const matchmakingClock = setInterval(matchQueuedPlayers, 1000);
matchmakingClock.unref();

const roomCleanup = setInterval(() => {
  for (const room of rooms.values()) if (Date.now() - room.createdAt > 6 * 60 * 60 * 1000) {
    clearTimeout(room.timer); io.to(room.code).emit("opponent-left"); rooms.delete(room.code);
    if (room.table) notifyClubTables();
  }
}, 60_000);
roomCleanup.unref();

io.on("connection", (socket) => {
  socket.on("watch-club-tables", (payload = {}, ack = () => {}) => {
    socket.join("club-tables");
    ack({ ok: true, tables: clubTables() });
  });
  socket.on("unwatch-club-tables", () => socket.leave("club-tables"));

  socket.on("request-club-code", (payload = {}, ack = () => {}) => {
    if (!accountFromToken(payload.accountToken))
      return ack({ ok: false, error: "Entre na conta antes de escolher uma mesa." });
    const room = clubTableRoom(Number(payload.table));
    if (!room?.presentationHost || room.state)
      return ack({ ok: false, error: "Esta mesa está indisponível." });
    room.codeRequested = true;
    notifyPresentation(room);
    ack({ ok: true });
  });

  socket.on("create-presentation", async (payload = {}, ack = () => {}) => {
    const table = payload.table == null ? null : Number(payload.table);
    if (table !== null && ![1, 2, 3, 4].includes(table))
      return ack({ ok: false, error: "Mesa inválida." });
    const previous = rooms.get(payload.code) || (table && clubTableRoom(table));
    if (previous?.presentation) {
      if ((previous.table || null) !== table)
        return ack({ ok: false, error: "Esta apresentação pertence a outra mesa." });
      if (payload.displayKey !== previous.displayKey)
        return ack({ ok: false, error: "Esta apresentação pertence a outra tela." });
      if (previous.presentationHost && previous.presentationHost !== socket.id)
        return ack({ ok: false, error: "A apresentação já está aberta em outra tela." });
      socket.join(previous.code); socket.data.room = previous.code; socket.data.player = null;
      previous.presentationHost = socket.id;
      if (previous.table) notifyClubTables();
      return ack(presentationInfo(previous));
    }
    if (rooms.has(socket.data.room)) return ack({ ok: false, error: "Encerre a sala atual antes de criar outra." });
    let base = PUBLIC_URL || payload.inviteBase || socket.handshake.headers.origin;
    if (!base || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base)) {
      const address = Object.values(networkInterfaces()).flat().find(entry => entry.family === "IPv4" && !entry.internal)?.address;
      if (address) base = `http://${address}:${PORT}/`;
    }
    const invite = buildInviteUrl(base, "000000");
    if (!table && (!invite || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(invite).hostname)))
      return ack({ ok: false, error: "Configure PUBLIC_URL com um endereço acessível pelos celulares." });
    const room = createRoomRecord(socket, [], null);
    room.presentation = true;
    room.table = table;
    room.displayKey = randomBytes(32).toString("hex");
    room.presentationHost = socket.id;
    for (const key of ["players", "decks", "usernames", "nicknames", "profiles", "resumeTokens"]) room[key].clear();
    socket.data.player = null;
    room.seatTokens = new Map([1, 2].map(player => [player, randomBytes(32).toString("hex")]));
    try {
      room.invitations = table ? [1, 2].map(player => ({ player })) : await Promise.all([1, 2].map(async player => {
        const url = new URL(buildInviteUrl(base, room.code));
        url.searchParams.set("seat", String(player));
        url.searchParams.set("ticket", room.seatTokens.get(player));
        return { player, url: url.toString(), qrCode: await QRCode.toDataURL(url.toString(), { width: 360, margin: 2 }) };
      }));
      if (!socket.connected || !rooms.has(room.code)) { rooms.delete(room.code); return; }
      ack(presentationInfo(room));
      if (room.table) notifyClubTables();
    } catch {
      removeFromRoom(socket);
      ack({ ok: false, error: "Não foi possível gerar os QR codes." });
    }
  });

  socket.on("join-matchmaking", (payload = {}, ack = () => {}) => {
    const account = accountFromToken(payload.accountToken);
    if (!account) return ack({ ok: false, code: "AUTH_REQUIRED", error: "Sua sessão expirou. Entre novamente na conta para buscar uma partida." });
    ensureAccountDefaults(account);
    if (socket.data.room || accountHasMatch(account.username))
      return ack({ ok: false, error: "Você já tem uma sala ou partida ativa. Retorne ou desista antes de buscar." });
    const duplicate = [...matchmaking.values()].find(entry => entry.username === account.username);
    if (duplicate && duplicate.socket.id !== socket.id)
      return ack({ ok: false, error: "Sua conta já está buscando em outra aba." });
    const deck = sanitizeDeck(account.deck);
    const quantities = new Map();
    for (const card of deck) quantities.set(cardKey(card.tipo, card.nome), (quantities.get(cardKey(card.tipo, card.nome)) || 0) + card.quantidade);
    if (!account.faction || !require("./duel-runtime").validDeck(deck) || deck.reduce((sum, card) => sum + card.quantidade, 0) !== 20 ||
        [...quantities].some(([key, quantity]) => quantity > (account.collection[key] || 0)))
      return ack({ ok: false, error: "Salve um deck de 20 cartas da sua coleção antes de buscar." });
    if (!duplicate) matchmaking.set(socket.id, { socket, token: payload.accountToken, username: account.username,
      rating: account.rating, deck, since: Date.now() });
    ack({ ok: true, profile: ranking.playerProfile(account) });
    matchQueuedPlayers();
  });
  socket.on("cancel-matchmaking", (_payload, ack = () => {}) => {
    if (socket.data.room && rooms.get(socket.data.room)?.ranked)
      return ack({ ok: false, error: "O adversário já foi encontrado." });
    matchmaking.delete(socket.id); ack({ ok: true });
  });

  socket.on("create-room", async (payload = {}, ack = () => {}) => {
    const active = findResumable(payload);
    if (active?.room.ranked) return ack({ ok: false, error: "Conclua sua partida ranqueada antes de criar uma sala." });
    const account = accountFromToken(payload.accountToken);
    removeFromRoom(socket);
    const room = createRoomRecord(socket, sanitizeDeck(payload.deck), account);
    const code = room.code;
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
      resumeToken: room.resumeTokens.get(1),
      inviteUrl,
      qrCode,
    });
  });

  socket.on("join-room", (payload = {}, ack = () => {}) => {
    const active = findResumable(payload);
    if (active?.room.ranked) return ack({ ok: false, error: "Conclua sua partida ranqueada antes de entrar em outra sala." });
    const code = String(payload.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "Sala não encontrada." });
    if (payload.table != null && (!room.presentation || Number(payload.table) !== room.table))
      return ack({ ok: false, error: "O código não pertence à mesa escolhida." });
    if (room.presentation) {
      const fromTable = payload.table != null;
      if (fromTable && !room.presentationHost)
        return ack({ ok: false, error: "A apresentação desta mesa está desconectada." });
      const player = Number(payload.seat);
      if (fromTable && ![1, 2].includes(player))
        return ack({ ok: false, error: "Escolha o jogador 1 ou 2." });
      if (!fromTable && (![1, 2].includes(player) || payload.ticket !== room.seatTokens.get(player)))
        return ack({ ok: false, error: "Escaneie o QR code do seu lugar na tela de apresentação." });
      if (room.state || !player || room.players.has(player))
        return ack({ ok: false, error: "Este lugar já está ocupado. Use o retorno à partida para reconectar." });
      if (socket.data.room) return ack({ ok: false, error: "Saia da sala atual antes de entrar." });
      const account = accountFromToken(payload.accountToken);
      if (!account?.faction) return ack({ ok: false, error: "Entre na conta e escolha sua facção." });
      if (accountHasMatch(account.username))
        return ack({ ok: false, error: "Conclua sua partida atual antes de entrar em outra mesa." });
      if ([...room.usernames.values()].includes(account.username))
        return ack({ ok: false, error: "Cada jogador precisa usar sua própria conta." });
      const deck = sanitizeDeck(account.deck);
      if (!require("./duel-runtime").validDeck(deck))
        return ack({ ok: false, error: "Sele um deck válido antes de entrar." });
      matchmaking.delete(socket.id);
      room.players.set(player, socket.id); room.decks.set(player, deck);
      room.usernames.set(player, account.username); room.nicknames.set(player, account.nickname || account.username);
      room.profiles.set(player, ranking.playerProfile(account));
      room.accounts.set(player, account);
      room.resumeTokens.set(player, randomBytes(32).toString("hex"));
      socket.join(code); socket.data.room = code; socket.data.player = player;
      if (fromTable) room.codeRequested = false;
      ack({ ok: true, waiting: room.players.size < 2, room: publicRoom(room), player, resumeToken: room.resumeTokens.get(player) });
      if (room.players.size === 2) {
        room.starter = room.turn = randomInt(1, 3);
        room.state = require("./duel-runtime").createMatch(room.decks.get(1), room.decks.get(2));
        room.startsAt = Date.now() + 4000;
        armPhaseClock(room, true, true);
        emitMatchReady(room);
      }
      notifyPresentation(room);
      return;
    }
    if (room.players.size >= 2)
      return ack({ ok: false, error: "Esta sala já está cheia." });

    removeFromRoom(socket);
    room.players.set(2, socket.id);
    room.resumeTokens.set(2, randomBytes(32).toString("hex"));
    room.starter = randomInt(1, 3);
    room.turn = room.starter;
    room.decks.set(2, sanitizeDeck(payload.deck));
    room.usernames.set(
      2,
      accountFromToken(payload.accountToken)?.username || "Duelista 2",
    );
    room.nicknames.set(2, accountFromToken(payload.accountToken)?.nickname || "Duelista 2");
    const account = accountFromToken(payload.accountToken);
    room.profiles.set(2, ranking.playerProfile(account));
    if (account) room.accounts.set(2, account);
    socket.join(code);
    socket.data.room = code;
    socket.data.player = 2;
    ack({ ok: true, room: publicRoom(room), player: 2, resumeToken: room.resumeTokens.get(2) });
    emitMatchReady(room);
  });

  socket.on("find-active-match", (payload = {}, ack = () => {}) => {
    const found = findResumable(payload);
    ack({ ok: true, room: found?.room.code || null });
  });

  socket.on("decline-match", (payload = {}, ack = () => {}) => {
    const found = findResumable(payload);
    if (!found || found.room.code !== payload.room)
      return ack({ ok: false, error: "Nenhuma partida ativa encontrada." });
    const { room, player } = found;
    surrenderRoom(room, player);
    ack({ ok: true });
  });

  socket.on("resume-match", (payload = {}, ack = () => {}) => {
    const found = findResumable(payload);
    if (!found) return ack({ ok: false, error: "Nenhuma partida ativa encontrada." });
    const { room, player } = found;
    const previous = room.players.get(player);
    if (previous && previous !== socket.id) {
      const old = io.sockets.sockets.get(previous);
      if (old) { old.leave(room.code); old.data.room = null; old.data.player = null; }
    }
    socket.join(room.code); socket.data.room = room.code; socket.data.player = player;
    room.players.set(player, socket.id);
    ack({ ok: true, room: publicRoom(room), player, resumeToken: room.resumeTokens.get(player),
      decks: Object.fromEntries(room.decks), usernames: Object.fromEntries(room.usernames), nicknames: Object.fromEntries(room.nicknames), ranked: !!room.ranked, arena: !!room.presentation, profiles: Object.fromEntries(room.profiles),
      update: { state: room.state, ...phaseInfo(room), initial: true } });
    socket.to(room.code).emit("opponent-online");
    if (room.table) notifyPresentation(room);
  });

  socket.on("spectate-room", (payload = {}, ack = () => {}) => {
    const room = rooms.get(String(payload.code || "").replace(/\D/g, "").slice(0, 6));
    if (!room?.state) return ack({ ok: false, error: "Esta sala ainda não iniciou uma partida." });
    if (socket.data.player) return ack({ ok: false, error: "Saia da sua partida antes de espectar." });
    removeFromRoom(socket);
    socket.join(room.code); socket.data.room = room.code; socket.data.player = null;
    room.spectators.add(socket.id);
    ack({ ok: true, room: publicRoom(room), usernames: Object.fromEntries(room.usernames), nicknames: Object.fromEntries(room.nicknames), ranked: !!room.ranked, arena: !!room.presentation, profiles: Object.fromEntries(room.profiles),
      update: { state: spectatorState(room.state), ...phaseInfo(room), initial: true } });
  });

  const validState = (state) => state && [state.jogador, state.inimigo].every((p) =>
    p && Array.isArray(p.field) && p.field.length === 10 && Array.isArray(p.hand) && Array.isArray(p.deck));

  socket.on("initial-state", (payload = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || socket.data.player !== 1 || room.players.size !== 2 || room.state || !validState(payload.state))
      return ack({ ok: false });
    room.state = payload.state;
    room.lastEffectsSequence = Math.max(0, ...(room.state.eventosEfeito || []).map(e => Number(e.id) || 0));
    armPhaseClock(room, true, true);
    broadcastState(room, { initial: true });
    ack({ ok: true, ...phaseInfo(room) });
  });

  socket.on("skip-battle-announcement", (payload = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room), player = socket.data.player;
    const now = Date.now();
    if (!room?.state || room.state.partidaEncerrada || room.effects ||
        !player || room.players.get(player) !== socket.id || room.turn !== player ||
        payload.step !== room.step || payload.round !== room.round || now < room.announcementAt)
      return ack({ ok: false });
    if (room.phaseStartedAt > now) {
      room.introUntil = Math.min(room.introUntil, now);
      room.phaseStartedAt = now;
      armPhaseClock(room, false);
      io.to(room.code).emit("phase-clock", phaseInfo(room));
    }
    ack({ ok: true, ...phaseInfo(room) });
  });

  socket.on("finish-turn", (payload = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room?.state || room.state.partidaEncerrada || room.phaseStartedAt > Date.now() || room.effects || room.turn !== socket.data.player)
      return ack({ ok: false, error: "Não é a sua vez." });
    if (payload.step !== room.step || payload.round !== room.round)
      return ack({ ok: false, error: "Esta fase já terminou." });
    if (!validState(payload.state)) return ack({ ok: false, error: "Estado inválido." });
    room.state = acceptClientState(room, payload.state);
    const result = advancePhase(room);
    ack({ ok: true, ...phaseInfo(room), update: { state: room.state, ...phaseInfo(room), result, phaseChanged: true } });
  });

  socket.on("live-state", (payload = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room?.state || room.state.partidaEncerrada || room.phaseStartedAt > Date.now() || room.turn !== socket.data.player ||
        payload.step !== room.step || payload.round !== room.round || !validState(payload.state))
      return ack({ ok: false, error: "A fase não permite esta atualização." });
    room.state = acceptClientState(room, payload.state);
    armPhaseClock(room, false);
    pauseForEffects(room);
    broadcastState(room, { live: true }, socket.id);
    ack({ ok: true, ...phaseInfo(room) });
  });

  socket.on("effects-ready", (payload = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.room), player = socket.data.player;
    if (!room?.effects || !player || room.players.get(player) !== socket.id ||
        payload.sequence !== room.effects.sequence || payload.step !== room.step || payload.round !== room.round)
      return ack({ ok: false });
    room.effects.pending.delete(player);
    if (!room.effects.pending.size) resumeAfterEffects(room);
    ack({ ok: true, ...phaseInfo(room) });
  });

  socket.on("turn-time", () => {
    const room = rooms.get(socket.data.room);
    if (!room?.state || room.turn !== socket.data.player) return;
    socket.to(room.code).emit("turn-time", { activePlayer: room.turn,
      remainingMs: room.effects?.remaining ?? Math.min(phaseDuration(room), Math.max(0, room.deadline - Date.now())), running: !room.effects && room.phaseStartedAt <= Date.now(), ...phaseInfo(room) });
  });

  socket.on("debug-finish-match", (payload = {}, ack = () => {}) => {
    if (rooms.get(socket.data.room)?.ranked) return ack({ ok: false, error: "Atalhos indisponíveis em partidas ranqueadas." });
    if (process.env.CYBERDUEL_DEBUG !== "1")
      return ack({ ok: false, error: "Atalho online desativado. Inicie o servidor com npm run dev." });
    if (!isAdminAccount(accountFromToken(payload.accountToken)))
      return ack({ ok: false, error: "Esta conta não é administradora." });
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room?.state || !player || room.players.get(player) !== socket.id)
      return ack({ ok: false, error: "Entre em uma partida como jogador primeiro." });
    if (room.state.partidaEncerrada)
      return ack({ ok: false, error: "A partida já terminou." });
    if (!["vitoria", "derrota", "empate"].includes(payload.resultado))
      return ack({ ok: false, error: "Use vitoria, derrota ou empate." });
    const winner = payload.resultado === "empate" ? "empate" :
      (payload.resultado === "vitoria" ? player : 3 - player) === 1 ? "jogador" : "inimigo";
    const resolved = require("./duel-runtime").finishForDebug(room.state, winner);
    clearTimeout(room.timer);
    room.deadline = null;
    room.state = resolved.state;
    room.result = resolved.result;
    room.debugFinal = true;
    broadcastState(room, { result: room.result, debugFinal: true });
    ack({ ok: true });
  });

  socket.on("surrender", () => {
    const room = rooms.get(socket.data.room);
    if (!room || !socket.data.player) return;
    if (!room.state || room.state.partidaEncerrada) return;
    surrenderRoom(room, socket.data.player);
    if (room.ranked) return;
    socket.to(room.code).emit("opponent-surrendered", { player: socket.data.player });
  });

  socket.on("leave-room", () => {
    removeFromRoom(socket);
    socket.data.room = null;
    socket.data.player = null;
  });

  socket.on("disconnect", () => removeFromRoom(socket, true));
});

httpServer.listen(PORT, LOCAL_LOGIN ? "127.0.0.1" : undefined, () => {
  console.log(`Cyberduel multiplayer ouvindo na porta ${PORT}`);
});
