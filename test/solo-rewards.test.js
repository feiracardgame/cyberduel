const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-solo-rewards-"));
const [player, other] = require("./account-fixture")(dir, ["SoloPlayer", "OtherPlayer"]);
const url = "http://127.0.0.1:31996/api";
let server;
async function start(admins = "") {
  server = spawn(process.execPath, ["server/server.js"], {
    env: { ...process.env, PORT: "31996", DATA_DIR: dir, ADMIN_USERNAMES: admins },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Servidor não iniciou")), 5000);
    server.stdout.on("data", chunk => {
      if (String(chunk).includes("ouvindo")) { clearTimeout(timer); resolve(); }
    });
  });
}
async function stop() {
  if (!server) return;
  const exited = once(server, "exit"); server.kill(); await exited; server = null;
}
async function api(route, body, token = player.token) {
  const response = await fetch(`${url}/${route}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-admin-token": "legacy-secret",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
const begin = async () => {
  const response = await api("account/match-start", { mode: "solo" });
  assert.equal(response.status, 200); assert.match(response.body.matchId, /^[a-f0-9]{32}$/);
  return response.body.matchId;
};

(async () => {
  await start();
  assert.equal((await api("auth/session")).body.isAdmin, false);
  assert.equal((await api("admin/accounts/grant-currency", { username: player.username, amount: 10 })).status, 403,
    "Configuração vazia bloqueia admin, inclusive com o antigo cabeçalho de token.");
  assert.equal((await api("account/match-start", { mode: "solo" }, null)).status, 401);
  assert.equal((await api("account/match-start", { mode: "online" })).status, 400);
  assert.equal((await api("account/match-complete", { result: "jogador" })).status, 404);
  let games = 0, currency = 500;
  for (const [result, reward] of [["jogador", 1000], ["inimigo", 200], ["empate", 0]]) {
    const matchId = await begin();
    assert.equal((await api("account/match-complete", { matchId, result }, other.token)).status, 404);
    assert.equal((await api("account/match-complete", { matchId, result: "vitoria" })).status, 400);
    const body = { matchId, result, amount: 999999, reward: 999999 };
    const responses = await Promise.all([api("account/match-complete", body), api("account/match-complete", body)]);
    currency += reward; games++;
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.body.reward, reward);
      assert.equal(response.body.currency, currency);
      assert.equal(response.body.gamesPlayed, games);
    }
    assert.equal((await api("account/match-complete", { matchId, result: result === "jogador" ? "inimigo" : "jogador" })).status, 409);
    await stop(); await start("SoloPlayer");
    const replay = await api("account/match-complete", body);
    assert.equal(replay.body.currency, currency); assert.equal(replay.body.gamesPlayed, games);
  }
  assert.equal((await api("auth/session")).body.isAdmin, true);
  await stop(); await start();
  assert.equal((await api("auth/session")).body.isAdmin, false, "Remover username revoga o papel com a mesma sessão.");
  const pending = await begin();
  await stop();
  const file = path.join(dir, "accounts.json");
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  stored.accounts[player.accountKey].currency = Number.MAX_SAFE_INTEGER;
  fs.writeFileSync(file, JSON.stringify(stored));
  await start();
  assert.equal((await api("account/match-complete", { matchId: pending, result: "jogador" })).status, 400);
  assert.equal((await api("auth/session")).body.gamesPlayed, games, "Saldo inválido não registra nem paga a partida.");
  console.log("Solo: vitória/derrota/empate, valores fixos, autenticação, dono, concorrência, repetição, persistência e limite de saldo validados; admin vazio e revogação bloqueados.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await stop(); fs.rmSync(dir, { recursive: true, force: true });
});
