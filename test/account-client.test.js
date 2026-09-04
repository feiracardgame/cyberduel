const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const updates = [];
const context = vm.createContext({
  console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { origin: "http://localhost", port: "80" },
  window: {
    cyberduelDeckBuilder: {
      setAccountSession: (...args) => updates.push(args),
    },
  },
});
vm.runInContext(fs.readFileSync("js/account.js", "utf8"), context);

const account = context.window.cyberduelAccount;
account.user = "Gabriel";
account.request = async () => ({
  ok: true,
  granted: [{ tipo: "monstro", nome: "Povo da Areia", quantidade: 1 }],
  account: {
    username: "Gabriel",
    collection: { "monstro:Povo da Areia": 1 },
    currency: 500,
  },
});

(async () => {
  await account.grantCardsByUsername("Gabriel", [], { allAvailable: true });
  assert.equal(account.collection["monstro:Povo da Areia"], 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0][2]["monstro:Povo da Areia"], 1);
  console.log("Coleção administrativa sincronizada com o Deck Forge.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
