const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const feira = require("../server/feira-mqtt");

const message = { id: "cyberduel", email: "etorresini@ifsc.edu.br", product: 102 };
const store = () => ({ accounts: { player: { googleSub: "google-player", googleEmail: message.email, currency: 500 } } });
let data = store(), durable, writes = 0;
const save = () => { durable = JSON.stringify(data); writes++; };
assert.equal(feira.receive(data, { ...message, id: "outro-jogo" }, save), null);
assert.equal(writes, 0);
for (const value of [null, {}, { ...message, product: 86 }, { ...message, product: "102" },
  { ...message, product: 999 }, { ...message, email: "invalid" }, { ...message, email: {} }]) {
  if (value?.id === "cyberduel") assert.throws(() => feira.receive(data, value, save));
  else assert.equal(feira.receive(data, value, save), null);
}
assert.equal(data.accounts.player.currency, 500);
assert.equal(feira.receive(data, { ...message, email: " ETorresini@IFSC.edu.br ", cybercoins: 999999 }, save), data.accounts.player);
assert.equal(data.accounts.player.currency, 600);
assert.equal(data.feiraMqttPurchases[0].product, 102);
assert.equal(data.feiraMqttPurchases[0].status, "completed");
assert.equal(JSON.parse(durable).accounts.player.currency, 600);
feira.receive(data, message, save);
assert.equal(data.accounts.player.currency, 700, "Duas compras iguais são legítimas: o protocolo não fornece ID único.");
assert.notEqual(data.feiraMqttPurchases[0].id, data.feiraMqttPurchases[1].id);
feira.resume(data, message.email, save);
assert.equal(data.accounts.player.currency, 700, "Reprocessar recibos concluídos não duplica crédito.");

data = { accounts: {} };
assert.equal(feira.receive(data, message, save), null);
assert.equal(JSON.parse(durable).feiraMqttPurchases[0].status, "pending");
data = JSON.parse(durable);
data.accounts.player = store().accounts.player;
feira.resume(data, message.email, save);
assert.equal(data.accounts.player.currency, 600, "Compra anterior ao primeiro login sobrevive ao reinício.");
feira.resume(data, message.email, save);
assert.equal(data.accounts.player.currency, 600);

for (const change of [{ googleSub: undefined }, { googleEmail: undefined }, { banned: true },
  { currency: Number.MAX_SAFE_INTEGER }, { currency: -1 }, { currency: 1.5 }]) {
  data = store(); Object.assign(data.accounts.player, change);
  const balance = data.accounts.player.currency;
  assert.equal(feira.receive(data, message, save), null);
  assert.equal(data.accounts.player.currency, balance);
  assert.equal(data.feiraMqttPurchases[0].status, "pending");
}
data = store(); data.accounts.other = { ...data.accounts.player };
assert.equal(feira.receive(data, message, save), null, "Email ambíguo não escolhe uma conta arbitrariamente.");
assert.equal(data.accounts.player.currency, 500);

data = store();
assert.throws(() => feira.receive(data, message, () => { throw Error("disk"); }), /disk/);
assert.equal(data.accounts.player.currency, 500);
assert.equal(data.feiraMqttPurchases.length, 0);
data = store(); let saves = 0;
assert.throws(() => feira.receive(data, message, () => { if (++saves === 2) throw Error("disk"); save(); }), /disk/);
assert.equal(data.accounts.player.currency, 500);
assert.equal(data.feiraMqttPurchases[0].status, "pending");
data = JSON.parse(durable);
feira.resume(data, message.email, save);
assert.equal(data.accounts.player.currency, 600, "Falha ao gravar saldo conserva recibo recuperável sem crédito em memória.");

// Exercita o assinante sem publicar mensagens no broker real.
const client = new EventEmitter(), logs = [], moduleMock = { exports: {} };
let connects = 0, subscribes = 0, credits = 0;
client.subscribe = (topic, options, callback) => {
  assert.equal(topic, "vending/comando/#"); assert.equal(options.qos, 0); subscribes++;
  callback(null, [{ topic, qos: 0 }]);
};
vm.runInNewContext(fs.readFileSync("server/feira-mqtt.js", "utf8"), {
  module: moduleMock, require: name => name === "mqtt" ? { connect(url, options) {
    assert.equal(url, "wss://mqtt.feira-de-jogos.dev.br"); assert.equal(options.reconnectPeriod, 5000);
    assert.equal(options.username, "subscriber"); assert.equal(options.password, "password"); connects++; return client;
  } } : require(name), console: { log() {}, error(...values) { logs.push(values); } },
});
data = store();
moduleMock.exports.start(data, save, account => { assert.equal(account, data.accounts.player); credits++; },
  { FEIRA_MQTT_USERNAME: "subscriber", FEIRA_MQTT_PASSWORD: "password" });
client.emit("connect"); client.emit("connect");
assert.equal(connects, 1); assert.equal(subscribes, 2, "Reconexão restaura a assinatura.");
const payload = Buffer.from(JSON.stringify(message));
client.emit("message", "vending/comando/cyberduel", payload, { retain: true });
client.emit("message", "outro/topico", payload, {});
client.emit("message", "vending/comando/cyberduel", Buffer.from("{"), {});
client.emit("message", "vending/comando/cyberduel", Buffer.alloc(8193), {});
client.emit("message", "vending/comando/outro", Buffer.from(JSON.stringify({ ...message, id: "outro" })), {});
assert.equal(data.accounts.player.currency, 500);
client.emit("message", "vending/comando/cyberduel", payload, {});
assert.equal(data.accounts.player.currency, 600); assert.equal(credits, 1);
client.emit("error", Error("offline"));
assert.equal(logs.length, 3, "Mensagens inválidas e erros de conexão são registrados sem derrubar o jogo.");
console.log("Feira MQTT: filtro por jogo, produto 102, email Google, persistência, pendências, rollback, retenção e reconexão validados.");
