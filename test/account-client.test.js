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
  account.request = async (route, options) => {
    assert.equal(route, "/api/admin/accounts/grant-currency");
    assert.equal(options.headers["x-admin-token"], "secret");
    assert.equal(options.body.amount, 200);
    return { added: 200, account: { username: "Gabriel", currency: 700, collection: account.collection } };
  };
  await account.grantCurrency("Gabriel", 200, { adminToken: "secret" });
  assert.equal(account.currency, 700);
  account.request = async () => ({ added: 200, account: { username: "Outro", currency: 900 } });
  await account.grantCurrency("Outro", 200);
  assert.equal(account.currency, 700, "Creditar outra conta não altera a conta atual.");
  console.log("Coleção administrativa sincronizada com o Deck Forge.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
