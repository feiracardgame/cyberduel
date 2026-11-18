const { randomUUID } = require("node:crypto");

const products = Object.freeze({
  102: Object.freeze({ tijolinhos: 100, cybercoins: 100 }),
});
const shopUrl = "https://feira-de-jogos.dev.br/";
const topic = "vending/comando/#";

function settle(store, receipt, save) {
  const matches = Object.entries(store.accounts).filter(([, account]) =>
    account.googleSub && account.googleEmail === receipt.email);
  if (receipt.status !== "pending" || matches.length !== 1) return null;
  const [accountKey, account] = matches[0];
  if (account.banned || !Number.isSafeInteger(account.currency) || account.currency < 0 ||
      !Number.isSafeInteger(account.currency + receipt.cybercoins)) return null;
  const previousBalance = account.currency;
  account.currency += receipt.cybercoins;
  Object.assign(receipt, { accountKey, status: "completed", completedAt: new Date().toISOString() });
  try { save(); } catch (error) {
    account.currency = previousBalance;
    receipt.status = "pending";
    delete receipt.accountKey;
    delete receipt.completedAt;
    throw error;
  }
  return account;
}

function receive(store, message, save) {
  if (message?.id !== "cyberduel") return null;
  if (!Number.isSafeInteger(message.product) || !Object.hasOwn(products, message.product))
    throw new Error("Produto MQTT do Cyberduel desconhecido.");
  if (typeof message.email !== "string" || message.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.email.trim()))
    throw new Error("Email MQTT inválido.");
  // shortcut: o evento não tem ID de compra; exigir um da feira para deduplicar sem descartar compras legítimas iguais.
  const receipt = { id: randomUUID(), email: message.email.trim().toLowerCase(), product: message.product,
    ...products[message.product], status: "pending", createdAt: new Date().toISOString() };
  const receipts = store.feiraMqttPurchases ||= [];
  receipts.push(receipt);
  try { save(); } catch (error) { receipts.pop(); throw error; }
  return settle(store, receipt, save);
}

function resume(store, email, save) {
  for (const receipt of store.feiraMqttPurchases || [])
    if (receipt.status === "pending" && receipt.email === email) settle(store, receipt, save);
}

function start(store, save, onCredit, env = process.env) {
  const client = require("mqtt").connect(env.FEIRA_MQTT_URL || "wss://mqtt.feira-de-jogos.dev.br", {
    reconnectPeriod: 5000, connectTimeout: 10000,
    ...(env.FEIRA_MQTT_USERNAME ? { username: env.FEIRA_MQTT_USERNAME, password: env.FEIRA_MQTT_PASSWORD } : {}),
  });
  client.on("connect", () => client.subscribe(topic, { qos: 0 }, (error, granted) => {
    if (error || !granted?.length || granted.some(entry => entry.qos === 128))
      console.error("Feira MQTT: falha ao assinar comandos.");
    else console.log("Feira MQTT: assinando vending/comando/#.");
  }));
  client.on("error", error => console.error("Feira MQTT:", error.message));
  client.on("message", (receivedTopic, payload, packet) => {
    if (!(receivedTopic === "vending/comando" || receivedTopic.startsWith("vending/comando/")) || packet?.retain) return;
    try {
      if (payload.length > 8192) throw new Error("Comando MQTT muito grande.");
      const account = receive(store, JSON.parse(payload.toString()), save);
      if (account) onCredit(account);
    } catch (error) { console.error("Feira MQTT: comando não processado:", error.message); }
  });
  return client;
}

module.exports = { products, shopUrl, receive, resume, start };
