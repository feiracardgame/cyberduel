const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const { WebSocketServer } = require("ws");
const mqttPacket = require("mqtt-packet");
const { io } = require("socket.io-client");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-mqtt-api-"));
const [player, other] = require("./account-fixture")(directory, ["MqttBuyer", "MqttOther"]);
const accountsFile = path.join(directory, "accounts.json");
const initial = JSON.parse(fs.readFileSync(accountsFile));
initial.accounts[player.accountKey].googleEmail = "buyer@example.com";
fs.writeFileSync(accountsFile, JSON.stringify(initial));
const url = "http://127.0.0.1:32076";
let server, buyer, spectator, mqttSocket;
const broker = new WebSocketServer({ host: "127.0.0.1", port: 0 });
const subscriptions = [];
broker.on("connection", socket => {
  mqttSocket = socket;
  const parser = mqttPacket.parser();
  socket.on("message", chunk => parser.parse(chunk));
  parser.on("packet", packet => {
    if (packet.cmd === "connect") socket.send(mqttPacket.generate({ cmd: "connack", returnCode: 0, sessionPresent: false }));
    if (packet.cmd === "subscribe") {
      subscriptions.push(packet.subscriptions);
      socket.send(mqttPacket.generate({ cmd: "suback", messageId: packet.messageId, granted: [0] }));
    }
    if (packet.cmd === "pingreq") socket.send(mqttPacket.generate({ cmd: "pingresp" }));
  });
});
const purchase = { id: "cyberduel", email: "buyer@example.com", product: 102 };
function publish(message, retain = false) {
  mqttSocket.send(mqttPacket.generate({ cmd: "publish", topic: "vending/comando/cyberduel", qos: 0,
    retain, dup: false, payload: typeof message === "string" ? message : JSON.stringify(message) }));
}
async function profile(token) {
  const response = await fetch(`${url}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  return response.json();
}

(async () => {
  await once(broker, "listening");
  server = spawn(process.execPath, ["server/server.js"], {
    env: { ...process.env, PORT: "32076", DATA_DIR: directory, CYBERDUEL_LOCAL_LOGIN: "0",
      FEIRA_MQTT_ENABLED: "1", FEIRA_MQTT_URL: `ws://127.0.0.1:${broker.address().port}`,
      FEIRA_MQTT_USERNAME: "", FEIRA_MQTT_PASSWORD: "" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Assinante MQTT não iniciou.")), 7000);
    server.stdout.on("data", chunk => {
      if (chunk.toString().includes("Feira MQTT: assinando")) { clearTimeout(timer); resolve(); }
    });
    server.once("exit", () => { clearTimeout(timer); reject(Error("Servidor encerrou antes de assinar MQTT.")); });
  });
  assert.equal(subscriptions[0][0].topic, "vending/comando/#");
  buyer = io(url, { transports: ["websocket"], forceNew: true });
  spectator = io(url, { transports: ["websocket"], forceNew: true });
  await Promise.all([once(buyer, "connect"), once(spectator, "connect")]);
  for (const [socket, account] of [[buyer, player], [spectator, other]])
    assert.equal((await socket.timeout(5000).emitWithAck("identify-account", { accountToken: account.token })).ok, true);
  let leakedUpdates = 0;
  spectator.on("currency-updated", () => leakedUpdates++);
  const update = once(buyer, "currency-updated", { signal: AbortSignal.timeout(5000) });
  publish({ ...purchase, id: "outro-jogo" });
  publish(purchase, true);
  publish("{");
  publish({ ...purchase, product: 999 });
  publish({ ...purchase, email: "waiting@example.com" });
  publish(purchase);
  assert.deepEqual((await update)[0], { username: player.username, currency: 600 });
  assert.equal((await profile(player.token)).currency, 600);
  assert.equal((await profile(other.token)).currency, 500);
  assert.equal(leakedUpdates, 0, "Saldo só é enviado aos sockets autenticados da própria conta.");
  const saved = JSON.parse(fs.readFileSync(accountsFile));
  assert.equal(saved.feiraMqttPurchases.length, 2);
  assert.equal(saved.feiraMqttPurchases[0].status, "pending");
  assert.equal(saved.feiraMqttPurchases[1].status, "completed");
  assert.equal(saved.accounts[player.accountKey].currency, 600);
  assert.equal((await profile(player.token)).googleEmail, undefined);

  const events = {}, clientAccount = { user: player.username, currency: 500, notify() { this.notifications++; }, notifications: 0 };
  const context = vm.createContext({ window: { cyberduelAccount: clientAccount, cyberduelServerUrl: () => url },
    io: () => ({ on(event, handler) { events[event] = handler; } }) });
  vm.runInContext(fs.readFileSync("js/multiplayer.js", "utf8") + "\nglobalThis.multi = new CyberduelMultiplayer(); multi.connect();", context);
  events["currency-updated"]({ username: other.username, currency: 999 });
  events["currency-updated"]({ username: player.username, currency: -1 });
  assert.equal(clientAccount.currency, 500);
  events["currency-updated"]({ username: player.username, currency: 600 });
  assert.equal(clientAccount.currency, 600); assert.equal(clientAccount.notifications, 1);
  console.log("Feira MQTT integrado: broker WebSocket local, servidor real, crédito persistido, email privado e saldo ao vivo isolado por conta validados.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  buyer?.disconnect(); spectator?.disconnect();
  if (server && server.exitCode === null) { const ended = once(server, "exit"); server.kill(); await ended; }
  for (const socket of broker.clients) socket.terminate();
  await new Promise(resolve => broker.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});
