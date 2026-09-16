const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function clients(page, configured) {
  const context = vm.createContext({
    window: { CYBERDUEL_SERVER_URL: configured },
    location: new URL(page),
    URLSearchParams,
    localStorage: { getItem: () => null },
  });
  for (const file of ["server-url", "account", "multiplayer"]) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`, "utf8"), context);
  }
  return context.window;
}

for (const [page, configured, expected] of [
  ["http://localhost:5500", null, "http://localhost:3000"],
  ["http://127.0.0.1:5501", null, "http://127.0.0.1:3000"],
  ["http://192.168.1.10:8080", null, "http://192.168.1.10:3000"],
  ["http://[::1]:5500", null, "http://[::1]:3000"],
  ["http://localhost:3000", null, "http://localhost:3000"],
  ["https://cyberduel.example", null, "https://cyberduel.example"],
  ["http://localhost", null, "http://localhost"],
  ["http://localhost:5502/?server=http://localhost:3100/", null, "http://localhost:3100"],
  ["http://localhost:5500/?server=http://localhost:3100", "http://localhost:3200/", "http://localhost:3200"],
]) {
  const client = clients(page, configured);
  assert.equal(client.cyberduelAccount.baseUrl(), expected);
  assert.equal(client.cyberduelMultiplayer.resolveServerUrl(), expected);
}
console.log("API e multiplayer usam o mesmo backend no Live Server, Node e Docker.");
