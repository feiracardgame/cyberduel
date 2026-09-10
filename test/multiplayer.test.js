const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { io } = require("socket.io-client");

const port = 31987;
const url = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-multiplayer-test-"));
const server = spawn(process.execPath, ["server/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
  stdio: ["ignore", "pipe", "inherit"],
});

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (payload === undefined) socket.emit(event, resolve);
    else socket.emit(event, payload, resolve);
  });
}

async function connect() {
  const socket = io(url, { transports: ["websocket"], forceNew: true });
  await once(socket, "connect");
  return socket;
}

async function run() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Servidor não iniciou.")), 5000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("ouvindo")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const page = await new Promise((resolve, reject) => {
    http
      .get(url, { agent: false }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body }));
      })
      .on("error", reject);
  });
  assert.equal(page.status, 200);
  assert.match(page.body, /<!doctype html>/i);

  const register = async (username) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "senha-forte" }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).token;
  };
  const token1 = await register("Gabriel");
  const token2 = await register("Dante");

  const cachedAsset = await new Promise((resolve, reject) => {
    const request = http.request(
      `${url}/assets/cartas/O_rato.png`,
      { method: "HEAD", agent: false },
      (response) => resolve(response),
    );
    request.on("error", reject);
    request.end();
  });
  assert.equal(cachedAsset.statusCode, 200);
  assert.match(cachedAsset.headers["cache-control"], /immutable/);

  const player1 = await connect();
  const player2 = await connect();
  const intruder = await connect();
  const deck1 = [{ tipo: "monstro", nome: "Deck P1", quantidade: 3 }];
  const deck2 = [{ tipo: "efeito", nome: "Deck P2", quantidade: 2 }];
  const created = await emitAck(player1, "create-room", {
    deck: deck1,
    accountToken: token1,
    inviteBase: url,
  });
  assert.equal(created.ok, true);
  assert.equal(created.player, 1);
  assert.match(created.inviteUrl, new RegExp(`room=${created.room.code}`));
  assert.match(created.qrCode, /^data:image\/png;base64,/);

  const ready1 = once(player1, "match-ready");
  const ready2 = once(player2, "match-ready");
  const joined = await emitAck(player2, "join-room", {
    code: created.room.code,
    deck: deck2,
    accountToken: token2,
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.player, 2);
  const [match1, match2] = await Promise.all([ready1, ready2]);
  assert.deepEqual(match1.decks[1], deck1);
  assert.deepEqual(match2.decks[2], deck2);
  assert.deepEqual(match1.usernames, { 1: "Gabriel", 2: "Dante" });
  assert.deepEqual(match2.usernames, { 1: "Gabriel", 2: "Dante" });

  const rejected = await emitAck(intruder, "join-room", {
    code: created.room.code,
    deck: [],
  });
  assert.equal(rejected.ok, false);

  const emptyPlayer = () => ({
    deck: [], hand: [], field: Array(10).fill(null), discard: [], lostCards: 0,
    traps: [], victories: 0, recentlyDrawn: [],
  });
  let state = { jogador: emptyPlayer(), inimigo: emptyPlayer(), turno: 1,
    maxTurnos: 7, rodadasParaVencer: 4, rodadasJogador: 0, rodadasInimigo: 0,
    partidaEncerrada: false, historico: [] };
  state.jogador.hand.push({ id: 700, tipo: "monstro", nome: "Segredo", poder: 4, poderBase: 4 });
  state.jogador.traps = [3];
  state.sequenciaEfeito = 1;
  state.eventosEfeito = [{ id: 1, lado: "jogador", momento: "invocacao", fonte: {
    id: 777, nome: "Personagem secreto", imagem: "segredo", indice: 2, oculto: true,
  }, alvos: [{ lado: "jogador", id: 778, indice: 3, nome: "Alvo secreto", oculto: true, delta: 3 }] }];
  const initialUpdate = once(player2, "state-update");
  const initialAck = await emitAck(player1, "initial-state", { state });
  assert.equal(initialAck.ok, true);
  let update = await initialUpdate;
  assert.equal(update.initial, true);
  assert.ok([1, 2].includes(update.starter));
  assert.equal(update.activePlayer, update.starter);
  assert.equal(update.phase, "colocar");
  assert.ok(update.deadline - update.serverNow <= 40_000);
  assert.ok(update.deadline - update.serverNow > 39_000);
  const starter = update.starter;
  const sockets = { 1: player1, 2: player2 };

  const spectated = await emitAck(intruder, "spectate-room", { code: created.room.code });
  assert.equal(spectated.ok, true);
  assert.equal(spectated.update.state.jogador.hand[0].nome, "Carta oculta");
  assert.deepEqual(spectated.update.state.jogador.traps, []);
  assert.equal(spectated.update.state.eventosEfeito[0].fonte.nome, "Carta oculta");
  assert.equal(spectated.update.state.eventosEfeito[0].alvos[0].nome, "Carta oculta");
  assert.equal(spectated.update.state.eventosEfeito[0].alvos[0].delta, undefined);
  assert.equal((await emitAck(intruder, "finish-turn", { state, step: 0, round: 1 })).ok, false);
  assert.equal((await emitAck(intruder, "live-state", { state, step: 0, round: 1 })).ok, false);

  const active = sockets[update.activePlayer];
  const other = sockets[3 - update.activePlayer];
  const liveUpdate = once(other, "state-update");
  const liveAck = await emitAck(active, "live-state", { state, step: 0, round: 1 });
  assert.equal(liveAck.ok, true);
  assert.equal((await liveUpdate).live, true);
  const opponentTimer = once(other, "turn-time");
  active.emit("turn-time", { remainingMs: 999_999, running: false });
  const clock = await opponentTimer;
  assert.equal(clock.running, true, "Menus não pausam o relógio do servidor.");
  assert.ok(clock.remainingMs <= 40_000);

  for (let step = 0; step < 4; step++) {
    assert.equal(update.step, step);
    assert.equal(update.phase, step < 2 ? "colocar" : "habilidades");
    assert.equal(update.activePlayer, step % 2 === 0 ? starter : 3 - starter);
    const actor = sockets[update.activePlayer];
    const listener = once(sockets[3 - update.activePlayer], "state-update");
    const finished = await emitAck(actor, "finish-turn", { state, step, round: 1 });
    assert.equal(finished.ok, true);
    update = await listener;
    state = update.state;
    const stale = await emitAck(actor, "finish-turn", { state, step, round: 1 });
    assert.equal(stale.ok, false);
  }
  assert.equal(update.round, 2);
  assert.equal(update.starter, 3 - starter, "A ordem deve inverter na rodada seguinte.");
  assert.equal(state.turno, 2);

  const oldDeadline = update.deadline;
  player1.disconnect();
  const reconnected = await connect();
  sockets[1] = reconnected;
  const found = await emitAck(reconnected, "find-active-match", { resumeToken: created.resumeToken });
  assert.equal(found.room, created.room.code);
  const deniedResume = await emitAck(reconnected, "resume-match", { resumeToken: "invalido" });
  assert.equal(deniedResume.ok, false);
  const resumed = await emitAck(reconnected, "resume-match", { resumeToken: created.resumeToken });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.player, 1);
  assert.equal(resumed.update.deadline, oldDeadline, "Recarregar não renova o tempo da fase.");
  assert.equal(resumed.update.state.turno, 2);

  // Três NeoAnalistas reduzem ambas as fases ao piso de 20 segundos.
  const foe = update.activePlayer === 1 ? state.inimigo : state.jogador;
  for (let i = 0; i < 3; i++) foe.field[i] = {
    id: 800 + i, nome: "NeoAnalista de Suporte Nível Alpha", tipo: "monstro", poder: 4, poderBase: 4,
    efeito: { tipo: "reduzir_tempo_oponente", valor: 15, minimo: 20 },
  };
  const timed = await emitAck(sockets[update.activePlayer], "live-state", { state, step: 0, round: 2 });
  assert.equal(timed.ok, true);
  assert.ok(timed.deadline - timed.serverNow <= 20_000);
  const expired = once(sockets[3 - update.activePlayer], "state-update");
  // Fecha o ator: o prazo continua correndo mesmo sem o cliente conectado.
  sockets[update.activePlayer].disconnect();
  const timedUpdate = await Promise.race([expired,
    new Promise((_, reject) => { const t = setTimeout(() => reject(Error("Timeout não avançou a fase")), 22_000); t.unref(); })]);
  assert.equal(timedUpdate.step, 1);
  for (const socket of [player1, player2, intruder, reconnected]) socket.disconnect();
  console.log("Fluxo multiplayer validado.");
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
