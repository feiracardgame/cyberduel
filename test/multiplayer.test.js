const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { io } = require("socket.io-client");

const port = 31987;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
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
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.player, 2);
  const [match1, match2] = await Promise.all([ready1, ready2]);
  assert.deepEqual(match1.decks[1], deck1);
  assert.deepEqual(match2.decks[2], deck2);

  const rejected = await emitAck(intruder, "join-room", {
    code: created.room.code,
    deck: [],
  });
  assert.equal(rejected.ok, false);

  const initialUpdate = once(player2, "state-update");
  const initialAck = await emitAck(player1, "initial-state", {
    state: { turno: 1 },
  });
  assert.equal(initialAck.ok, true);
  assert.equal((await initialUpdate).initial, true);

  const liveUpdate = once(player2, "state-update");
  const liveAck = await emitAck(player1, "live-state", {
    state: { turno: 1, jogada: "carta-colocada" },
  });
  assert.equal(liveAck.ok, true);
  assert.equal((await liveUpdate).live, true);

  const update2 = once(player2, "state-update");
  const turn1 = await emitAck(player1, "finish-turn", {
    state: { turno: 1 },
  });
  assert.equal(turn1.activePlayer, 2);
  assert.equal((await update2).activePlayer, 2);

  const repeated = await emitAck(player1, "finish-turn", {
    state: { turno: 1 },
  });
  assert.equal(repeated.ok, false);

  const update1 = once(player1, "state-update");
  const turn2 = await emitAck(player2, "finish-turn", {
    state: { turno: 2 },
    result: { resultadoRodada: { vencedor: "jogador" } },
  });
  assert.equal(turn2.activePlayer, 1);
  assert.equal((await update1).activePlayer, 1);

  player1.disconnect();
  player2.disconnect();
  intruder.disconnect();
  console.log("Fluxo multiplayer validado.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.kill("SIGTERM"));
