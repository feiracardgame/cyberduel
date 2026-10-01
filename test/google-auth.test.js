const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { generateKeyPairSync, sign, scryptSync } = require("node:crypto");
const { io } = require("socket.io-client");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-google-"));
const [legacy] = require("./account-fixture")(directory, ["SenhaAntiga"]);
const legacyStore = JSON.parse(fs.readFileSync(path.join(directory, "accounts.json"), "utf8"));
const oldAccount = legacyStore.accounts[legacy.accountKey];
delete oldAccount.googleSub;
oldAccount.salt = "test-legacy-salt";
oldAccount.passwordHash = scryptSync("senha-antiga-123", oldAccount.salt, 64).toString("hex");
oldAccount.collection = { "monstro:O Rato": 2 };
oldAccount.currency = 123;
const previousKey = `google_${"b".repeat(32)}`;
legacyStore.accounts[previousKey] = {
  username: previousKey, googleSub: "previous-google-player", nickname: "Apelido existente",
  currency: 765, rating: 1250, collection: { "monstro:O Rato": 3 },
  faction: "echossystem", deck: [{ tipo: "monstro", nome: "O Rato", quantidade: 3 }],
};
fs.writeFileSync(path.join(directory, "accounts.json"), JSON.stringify(legacyStore));
const origin = "http://localhost:5500";
const base = "http://127.0.0.1:32042";
const clientId = "cyberduel-test.apps.googleusercontent.com";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const preload = path.join(directory, "certificates.cjs");
const clock = path.join(directory, "clock.txt");
fs.writeFileSync(clock, "0");
// Só o download dos certificados é substituído: a biblioteca valida o JWT real.
fs.writeFileSync(preload, `
  const { OAuth2Client } = require(${JSON.stringify(require.resolve("google-auth-library"))});
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({
    certs: { test: ${JSON.stringify(keys.publicKey.export({ type: "spki", format: "pem" }))} }
  });
  const now = Date.now;
  Date.now = () => now() + Number(require("node:fs").readFileSync(${JSON.stringify(clock)}, "utf8"));
`);
let server;
let token;

async function start(configured = true) {
  server = spawn(process.execPath, ["--require", preload, "server/server.js"], {
    env: { ...process.env, PORT: "32042", DATA_DIR: directory, GOOGLE_CLIENT_ID: configured ? clientId : "" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Servidor não iniciou.")), 5000);
    server.stdout.on("data", data => {
      if (String(data).includes("ouvindo")) { clearTimeout(timer); resolve(); }
    });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Servidor encerrou antes de iniciar.")); });
  });
}

async function stop() {
  if (!server) return;
  const ended = once(server, "exit");
  server.kill();
  await ended;
  server = null;
}

async function api(route, body, method = "POST", frontend = origin, accessToken = token) {
  const response = await fetch(`${base}/api/${route}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: frontend, ...(accessToken && route !== "auth/login" ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function credential(nonce, claims = {}, signingKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: clientId, sub: "google-player-123",
    iat: now, exp: now + 3600, nonce, name: "Nome do Google", email: "player@example.com", ...claims,
  })).toString("base64url");
  const signed = `${header}.${payload}`;
  return `${signed}.${sign("RSA-SHA256", Buffer.from(signed), signingKey).toString("base64url")}`;
}

async function login(claims) {
  const attempt = await api("auth/google/start");
  assert.equal(attempt.status, 200);
  assert.equal(attempt.body.clientId, clientId);
  assert.notEqual(attempt.body.loginId, attempt.body.nonce);
  const body = { loginId: attempt.body.loginId, credential: credential(attempt.body.nonce, claims) };
  return { attempt: attempt.body, body, result: await api("auth/google", body) };
}

async function checkClient(profile) {
  const storage = new Map();
  let config, rendered, notified = 0;
  const context = vm.createContext({
    console, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { google: { accounts: { id: {
      initialize: value => { config = value; }, renderButton: (node, options) => { rendered = { node, options }; },
    } } } },
  });
  vm.runInContext(fs.readFileSync("js/account.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("js/title-ui.js", "utf8"), context);
  const account = context.window.cyberduelAccount;
  const node = { isConnected: true, replaceChildren() {} };
  account.onChange(() => notified++);
  account.request = async (route, options) => {
    assert.equal(options.auth, false);
    if (route.endsWith("/start")) return { clientId, loginId: "login-id", nonce: "login-nonce" };
    assert.equal(options.body.credential, "google-token");
    assert.equal(options.body.loginId, "login-id");
    return { ...profile, username: "google_" + "a".repeat(32), nickname: "", needsUsername: true, needsRegistration: true, token: "session-token" };
  };
  await account.mountGoogleButton(node, error => { throw error; });
  assert.equal(config.client_id, clientId);
  assert.equal(config.nonce, "login-nonce");
  assert.equal(config.auto_select, false);
  assert.equal(rendered.node, node);
  await config.callback({ credential: "google-token" });
  assert.equal(account.nickname, "");
  assert.equal(account.snapshot().needsRegistration, true);
  assert.equal(storage.get(account.storageKey), "session-token");

  // O primeiro acesso separa username único e apelido, sem senha/foto/facção.
  const UI = vm.runInContext("CyberduelTitleUI", context);
  const ui = new UI({ account, callbacks: {} });
  function element(tag, className, text) {
    return { tag, className, text, children: [], events: {}, attributes: {}, dataset: {}, value: "",
      append(...items) { this.children.push(...items); }, setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, fn) { this.events[name] = fn; }, focus() {}, remove() {}, classList: { add() {}, remove() {} },
    };
  }
  ui.element = element;
  ui.root = element("main");
  context.requestAnimationFrame = fn => fn();
  let errorCallback;
  account.mountGoogleButton = (_, onError) => { errorCallback = onError; };
  ui.openAuthDialog();
  const children = node => [node, ...node.children.flatMap(children)];
  assert.ok(errorCallback, "A tela deve carregar o botão do Google.");
  assert.equal(children(ui.modal).filter(node => ["input", "details"].includes(node.tag)).length, 0);
  assert.equal(typeof account.login, "undefined");
  assert.equal(typeof account.register, "undefined");
  errorCallback(new Error("Google indisponível"));
  assert.equal(children(ui.modal).find(node => node.textContent === "TENTAR GOOGLE NOVAMENTE").hidden, false);
  assert.equal(children(ui.modal).filter(node => node.tag === "input").length, 0);
  ui.closeModal(true);
  ui.openRegistrationDialog();
  assert.equal(ui.modalRequired, true);
  const form = ui.modal.children[0];
  const fields = children(form).filter(child => child.tag === "input");
  assert.equal(fields.length, 2);
  const username = fields.find(child => child.name === "username");
  const input = fields.find(child => child.name === "nickname");
  assert.equal(username.readOnly, false);
  assert.equal(username.value, "");
  assert.equal(input.value, "");
  ui.closeModal();
  assert.ok(ui.modal, "Escape não pode pular o cadastro.");
  const savedBuilds = JSON.stringify([{ name: "Deck salvo", deck: [{ nome: "O Rato" }] }]);
  storage.set(`cyberduel.builds.v1:${account.user}`, savedBuilds);
  let duplicate = true;
  account.request = async (route, options) => {
    assert.equal(route, "/api/account/profile");
    assert.equal(options.body.username, "duelista_123");
    assert.equal(options.body.nickname, "Duelista");
    assert.equal(options.body.avatar, undefined);
    if (duplicate) { duplicate = false; throw new Error("Esse username já está em uso. Escolha outro."); }
    return { ...profile, username: "duelista_123", nickname: "Duelista", needsUsername: false, needsRegistration: false };
  };
  username.value = "a";
  input.value = "Duelista";
  await form.events.submit({ preventDefault() {} });
  assert.equal(account.needsUsername, true);
  username.value = " duelista_123 ";
  input.value = " ";
  await form.events.submit({ preventDefault() {} });
  assert.equal(account.needsRegistration, true);
  input.value = " Duelista ";
  await form.events.submit({ preventDefault() {} });
  assert.equal(account.needsRegistration, true);
  assert.equal(children(form).find(node => node.type === "submit").disabled, false);
  assert.match(children(form).find(node => node.attributes.role === "alert").textContent, /já está em uso/);
  assert.equal(username.value, " duelista_123 ");
  await form.events.submit({ preventDefault() {} });
  assert.equal(account.user, "duelista_123");
  assert.equal(storage.get("cyberduel.builds.v1:duelista_123"), savedBuilds);
  assert.equal(account.needsUsername, false);
  assert.equal(account.nickname, "Duelista");
  assert.equal(account.needsRegistration, false);
  assert.equal(notified, 2);
  account.clear();
  assert.equal(account.authProvider, null);
  assert.equal(account.needsRegistration, false);
}

(async () => {
  await start(false);
  assert.equal((await api("auth/google/start")).status, 503);
  for (const route of ["auth/login", "auth/register"])
    assert.equal((await api(route, { username: legacy.username, password: "senha-antiga-123" })).status, 410);
  token = legacy.token;
  assert.equal((await api("auth/session", undefined, "GET")).status, 401);
  assert.equal((await api("account/profile", { nickname: "Outro" }, "PUT")).status, 401);
  const socket = io(base, { transports: ["websocket"], forceNew: true });
  try {
    await once(socket, "connect");
    const result = await new Promise((resolve, reject) => socket.timeout(5000).emit("join-matchmaking",
      { accountToken: legacy.token }, (error, response) => error ? reject(error) : resolve(response)));
    assert.equal(result.code, "AUTH_REQUIRED");
  } finally { socket.disconnect(); }
  token = null;
  await stop();
  await start();
  assert.equal((await api("auth/google/start", undefined, "POST", "https://attacker.example")).status, 403);
  assert.equal((await api("auth/google", { loginId: "inexistente", credential: "forjado" })).status, 401);
  for (const claims of [{ aud: "outro-cliente" }, { iss: "https://attacker.example" }, { nonce: "outro-nonce" }, { sub: "" }, { exp: Math.floor(Date.now() / 1000) - 600 }]) {
    assert.equal((await login(claims)).result.status, 401);
  }
  const forgedAttempt = (await api("auth/google/start")).body;
  const forgedKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal((await api("auth/google", { loginId: forgedAttempt.loginId, credential: credential(forgedAttempt.nonce, {}, forgedKey) })).status, 401);
  const expired = (await api("auth/google/start")).body;
  fs.writeFileSync(clock, String(11 * 60 * 1000));
  assert.equal((await api("auth/google", { loginId: expired.loginId, credential: credential(expired.nonce) })).status, 401);
  fs.writeFileSync(clock, "0");

  const first = await login();
  assert.equal(first.result.status, 200);
  token = first.result.body.token;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(first.result.body.nickname, "");
  assert.equal(first.result.body.needsRegistration, true);
  assert.equal(first.result.body.needsUsername, true);
  assert.equal(first.result.body.authProvider, "google");
  assert.equal(first.result.body.faction, null);
  assert.equal((await api("auth/google", first.body)).status, 401, "A tentativa não pode ser reutilizada.");
  assert.equal((await api("auth/session", undefined, "GET")).body.needsRegistration, true);
  assert.equal((await api("account/faction", { faction: "raspcorp" })).status, 403);
  assert.equal((await api("account/match-complete")).status, 403);
  assert.equal((await api("auth/login", { username: first.result.body.username, password: "senha-falsa" })).status, 410);
  assert.equal((await api("auth/register", { username: "NovaSenha", password: "senha-falsa" })).status, 410);
  for (const nickname of ["", " ", "x".repeat(33), "A\nB"])
    assert.equal((await api("account/profile", { username: "duelista_123", nickname }, "PUT")).status, 400);
  assert.equal((await api("account/profile", { nickname: "Duelista" }, "PUT")).status, 400);
  for (const username of ["", " ", "ab", "x".repeat(25), "com espaço", "ácento", "<script>", 123, "A\nB"])
    assert.equal((await api("account/profile", { username, nickname: "Duelista" }, "PUT")).status, 400);
  const rejected = await api("account/profile", { username: "SENHAANTIGA", nickname: "Duelista" }, "PUT");
  assert.equal(rejected.status, 409, "Contas preservadas também reservam seu username.");
  const chosen = await api("account/profile", { username: "  duelista_123  ", nickname: "  Duelista 🌟  " }, "PUT");
  assert.equal(chosen.status, 200);
  assert.equal(chosen.body.username, "duelista_123");
  assert.equal(chosen.body.needsUsername, false);
  assert.equal(chosen.body.nickname, "Duelista 🌟");
  assert.equal(chosen.body.needsRegistration, false);
  assert.equal(chosen.body.faction, null, "Cadastro pede username e apelido; facção é separada.");
  const faction = await api("account/faction", { faction: "raspcorp" });
  assert.equal(faction.status, 200);
  await stop(); await start();
  assert.equal((await api("auth/session", undefined, "GET")).body.nickname, "Duelista 🌟");
  const returning = await login({ name: "Outro nome", email: "novo@example.com" });
  assert.equal(returning.result.body.username, chosen.body.username);
  assert.equal(returning.result.body.needsRegistration, false);
  assert.deepEqual(returning.result.body.collection, faction.body.collection);
  const another = await login({ sub: "outro-player" });
  assert.notEqual(another.result.body.username, chosen.body.username);
  assert.equal(another.result.body.needsRegistration, true);
  const primaryToken = token;
  token = another.result.body.token;
  const collision = await api("account/profile", { username: "DUELISTA_123", nickname: "Duelista 🌟" }, "PUT");
  assert.equal(collision.status, 409, "Username único sem distinguir maiúsculas.");
  assert.equal((await api("auth/session", undefined, "GET")).body.needsRegistration, true);
  const repeatedNickname = await api("account/profile", { username: "duelista-456", nickname: "Duelista 🌟" }, "PUT");
  assert.equal(repeatedNickname.status, 200);
  assert.equal(repeatedNickname.body.nickname, chosen.body.nickname, "O display name pode repetir.");
  const immutable = await api("account/profile", { username: "nao-pode-mudar", nickname: "Novo apelido" }, "PUT");
  assert.equal(immutable.body.username, "duelista-456");
  assert.equal(immutable.body.nickname, "Novo apelido", "Só o apelido muda após o cadastro.");

  const racers = await Promise.all([login({ sub: "race-one" }), login({ sub: "race-two" })]);
  const race = await Promise.all(racers.map(racer => api("account/profile", {
    username: "UsernameConcorrente", nickname: "Duelista",
  }, "PUT", origin, racer.result.body.token)));
  assert.deepEqual(race.map(result => result.status).sort(), [200, 409], "Duas requisições não podem reservar o mesmo username.");

  const previous = await login({ sub: "previous-google-player" });
  assert.equal(previous.result.body.needsUsername, true);
  assert.equal(previous.result.body.needsRegistration, true);
  assert.equal(previous.result.body.nickname, "Apelido existente");
  token = previous.result.body.token;
  assert.equal((await api("account/match-complete")).status, 403, "Apelido sem username ainda não libera o jogo.");
  const completed = await api("account/profile", { username: "antigo.google", nickname: "Apelido existente" }, "PUT");
  assert.equal(completed.status, 200);
  for (const key of ["collection", "currency", "deck", "rating", "faction"])
    assert.deepEqual(completed.body[key], previous.result.body[key], `Cadastro mantém ${key}.`);
  await stop(); await start();
  assert.equal((await api("auth/session", undefined, "GET")).body.username, "antigo.google");
  assert.equal((await login({ sub: "previous-google-player" })).result.body.needsRegistration, false);
  token = primaryToken;
  assert.equal((await api("auth/session", undefined, "GET")).body.username, "duelista_123", "Sessão original mantém a identidade.");
  const savedAccounts = JSON.parse(fs.readFileSync(path.join(directory, "accounts.json"), "utf8"));
  assert.equal(savedAccounts.accounts[previousKey].username, "antigo.google", "A chave interna não muda.");
  assert.equal(savedAccounts.accounts[legacy.accountKey].passwordHash, oldAccount.passwordHash, "A exclusão das contas é manual.");
  assert.deepEqual(savedAccounts.accounts[legacy.accountKey].collection, oldAccount.collection);
  assert.equal(savedAccounts.accounts[legacy.accountKey].currency, oldAccount.currency);
  assert.equal(savedAccounts.accounts.novasenha, undefined, "A rota antiga não cria uma conta.");
  const store = JSON.stringify(Object.values(savedAccounts.accounts).filter(account => account.googleSub));
  assert.doesNotMatch(store, /player@example.com|Nome do Google|passwordHash|credential/);
  assert.ok(!store.includes(first.body.credential));
  assert.ok(!fs.readFileSync(path.join(directory, "sessions.json"), "utf8").includes(token));
  await checkClient(chosen.body);
  assert.equal((await api("auth/logout")).status, 200);
  assert.equal((await api("auth/session", undefined, "GET")).status, 401);
  console.log("Google: username único, concorrência, apelido separado, cadastro existente, tokens, persistência e bloqueio de senha validados.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await stop();
  fs.rmSync(directory, { recursive: true, force: true });
});
