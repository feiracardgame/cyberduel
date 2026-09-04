const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const port = 31988;
const url = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "cyberduel-account-test-"),
);
const server = spawn(process.execPath, ["server/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    BOOSTER_WEIGHT_ALTA: "37",
    BOOSTER_WEIGHT_EFEITO: "8",
  },
  stdio: ["ignore", "pipe", "inherit"],
});

async function api(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${url}${route}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: response.status, payload: await response.json() };
}

async function run() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Servidor de contas não iniciou.")),
      5000,
    );
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const configuration = await api("/api/config");
  assert.equal(configuration.status, 200);
  assert.equal(configuration.payload.booster.levelWeights.alta, 37);
  assert.equal(configuration.payload.booster.utilityTypeWeights.efeito, 8);

  const created = await api("/api/auth/register", {
    method: "POST",
    body: { username: "Gabriel", password: "aura-maxima" },
  });
  assert.equal(created.status, 201);
  assert.match(created.payload.token, /^[a-f0-9]{64}$/);
  assert.equal(created.payload.username, "Gabriel");
  assert.equal(created.payload.faction, null);
  assert.equal(created.payload.currency, 500);

  const duplicate = await api("/api/auth/register", {
    method: "POST",
    body: { username: "gabriel", password: "outra-senha" },
  });
  assert.equal(
    duplicate.status,
    409,
    "Nomes de usuário não diferenciam maiúsculas.",
  );

  const invalidLogin = await api("/api/auth/login", {
    method: "POST",
    body: { username: "Gabriel", password: "senha-errada" },
  });
  assert.equal(invalidLogin.status, 401);

  const faction = await api("/api/account/faction", {
    method: "POST",
    token: created.payload.token,
    body: { faction: "echossystem" },
  });
  assert.equal(faction.status, 200);
  assert.equal(faction.payload.faction, "echossystem");
  assert.equal(
    faction.payload.deck.reduce((total, card) => total + card.quantidade, 0),
    20,
  );
  assert.ok(Object.keys(faction.payload.collection).length >= 10);

  const booster = await api("/api/boosters/open", {
    method: "POST",
    token: created.payload.token,
    body: { faction: "raspcorp" },
  });
  assert.equal(booster.status, 200);
  assert.equal(
    booster.payload.cards.reduce(
      (total, card) => total + (card.quantidade || 0),
      0,
    ),
    20,
  );
  assert.equal(booster.payload.currency, 400);

  const grantByUsername = await api("/api/admin/accounts/grant-cards", {
    method: "POST",
    body: {
      username: "Gabriel",
      cards: [{ tipo: "monstro", nome: "Carta de Teste", quantidade: 2 }],
    },
  });
  assert.equal(grantByUsername.status, 200);
  assert.equal(
    grantByUsername.payload.account.collection["monstro:Carta de Teste"],
    2,
  );

  const giveSingleCard = await api("/api/admin/accounts/give-card", {
    method: "POST",
    body: {
      conta: "Gabriel",
      nomeDaCarta: "O Rato",
      quantidade: 2,
    },
  });
  assert.equal(giveSingleCard.status, 200);
  assert.equal(giveSingleCard.payload.account.collection["monstro:O Rato"], 4);

  const grantAllCards = await api("/api/admin/accounts/grant-cards", {
    method: "POST",
    body: { username: "Gabriel", cards: [], allAvailable: true },
  });
  assert.equal(grantAllCards.status, 200);
  assert.ok(grantAllCards.payload.granted.length >= 30);
  assert.equal(
    grantAllCards.payload.account.collection["monstro:Povo da Areia"],
    1,
  );
  assert.equal(
    grantAllCards.payload.account.collection["efeito:Reciclagem"],
    1,
  );

  const deck = faction.payload.deck;
  const saved = await api("/api/deck", {
    method: "PUT",
    token: created.payload.token,
    body: { deck },
  });
  assert.equal(saved.status, 200);
  assert.equal(
    saved.payload.deck.reduce((total, card) => total + card.quantidade, 0),
    20,
  );

  const session = await api("/api/auth/session", {
    token: created.payload.token,
  });
  assert.equal(session.status, 200);
  assert.deepEqual(session.payload.deck, saved.payload.deck);

  const resetCollection = await api("/api/admin/accounts/reset-collection", {
    method: "POST",
    body: { conta: "Gabriel" },
  });
  assert.equal(resetCollection.status, 200);
  assert.deepEqual(resetCollection.payload.account.collection, {});
  assert.equal(resetCollection.payload.account.deck, null);

  const persisted = fs.readFileSync(
    path.join(dataDir, "accounts.json"),
    "utf8",
  );
  assert.doesNotMatch(
    persisted,
    /aura-maxima/,
    "Senha nunca deve ser salva em texto puro.",
  );
  assert.match(persisted, /passwordHash/);
  console.log("Contas, senha derivada e deck persistente validados.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill("SIGTERM");
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
