const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { Readable } = require("node:stream");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberduel-admin-feira-"));
const [admin, player, otherAdmin, local] = require("./account-fixture")(dir, ["GestorQA", "DuelistaQA", "OutroGestorQA", "LocalQA"]);
const file = path.join(dir, "accounts.json"), data = JSON.parse(fs.readFileSync(file));
for (const account of Object.values(data.accounts)) account.currency = 0;
data.accounts[local.accountKey].localAccount = true;
fs.writeFileSync(file, JSON.stringify(data));
let handleApi, context, creditCalls = 0, statementCalls = 0, creditBehavior, confirmation;
const route = "/api/admin/feira/credit";
const id = "admin-feira-grant-00001";
const token = "admin.google.jwt";
const current = () => JSON.parse(fs.readFileSync(file));

function start({ admins = "GestorQA,OutroGestorQA", credentials = true } = {}) {
  const realRequire = createRequire(path.resolve("server/server.js"));
  const adapter = { creditAvailable: true,
    async credit(order) {
      creditCalls++;
      assert.equal(order.tijolinhos, 500, "Valor fixado no servidor.");
      assert.equal(order.token, token, "Só usa o JWT validado da sessão do próprio admin.");
      return creditBehavior ? creditBehavior() : String(8000 + creditCalls);
    },
    async confirmCredit(order) { statementCalls++; return confirmation ? confirmation(order) : 500; },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync("server/cybercoins.js", "utf8"), {
    module, require: name => name === "./feira-payments" ? adapter : realRequire(name),
  });
  context = vm.createContext({
    require: name => name === "./cybercoins" ? module.exports : name === "http" ? { createServer: () => ({ listen() {} }) }
      : name === "socket.io" ? { Server: class { on() {} } } : realRequire(name),
    __dirname: path.resolve("server"), process: { env: { ...process.env, DATA_DIR: dir,
      ADMIN_USERNAMES: admins, CYBERDUEL_LOCAL_LOGIN: "1", CYBERDUEL_DEBUG: "1" }, pid: process.pid },
    console, Buffer, URL, URLSearchParams, setTimeout, clearTimeout, setInterval: () => ({ unref() {} }),
  });
  vm.runInContext(fs.readFileSync("server/server.js", "utf8") + `
    globalThis.handleApi = handleApi;
    if (${credentials}) for (const bearer of ${JSON.stringify([admin.token, player.token, otherAdmin.token, local.token])})
      sealGoogleCredential(sessions.get(sessionKey(bearer)), bearer, { token: "${token}", expiresAt: Date.now() + 60000 });
  `, context);
  handleApi = context.handleApi;
}

async function api({ user = admin, method = "POST", body = { purchaseId: id }, url = route, bearer = user?.token } = {}) {
  const request = Readable.from(method === "GET" ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method; request.url = url;
  request.headers = { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
  let result;
  const response = { writeHead(status) { this.status = status; }, end(value) { result = { status: this.status, body: JSON.parse(value) }; } };
  await handleApi(request, response, url);
  return result;
}

(async () => {
  try {
    start({ credentials: false });
    for (const method of ["GET", "POST"]) {
      assert.equal((await api({ user: null, method })).status, 401);
      assert.equal((await api({ user: player, method, body: { purchaseId: id, isAdmin: true, username: admin.username } })).status, 403);
      assert.equal((await api({ method, bearer: "forged-session-token" })).status, 401);
      assert.equal((await api({ user: local, method })).status, 403, "Admin local de desenvolvimento não pode movimentar o banco da feira.");
    }
    assert.equal((await api({ method: "GET" })).body.needsGoogleLogin, true);
    assert.equal((await api()).body.code, "FEIRA_LOGIN_REQUIRED");
    assert.equal(creditCalls, 0);

    start();
    for (const purchaseId of [null, "bad", {}, "__proto__"]) {
      assert.equal((await api({ body: { purchaseId } })).status, 400);
    }
    const credited = await api({ body: { purchaseId: id, amount: 999999, value: 999999, tijolinhos: 1,
      username: player.username, to: 123, product: 1, feiraToken: "forged.google.jwt", isAdmin: true } });
    assert.equal(credited.status, 200);
    assert.equal(credited.body.tijolinhos, 500);
    assert.equal(credited.body.requestedTijolinhos, 500);
    assert.equal(creditCalls, 1);
    assert.equal(current().accounts[admin.accountKey].currency, 0, "Admin não precisa de Cybercoins e não recebe saldo fictício.");
    assert.equal(current().accounts[player.accountKey].currency, 0);
    const order = current().cybercoinPurchases[id];
    assert.equal(order.accountKey, admin.accountKey);
    assert.equal(order.direction, "admin-grant");
    assert.equal(order.cybercoins, 0);
    assert.equal(order.spentCybercoins, 0);
    assert.ok(!JSON.stringify(current()).includes(token));
    assert.equal((await api({ user: otherAdmin })).status, 409, "Outro admin não reutiliza uma operação alheia.");
    start();
    assert.equal((await api()).status, 200);
    assert.equal(creditCalls, 1, "Reiniciar/repetir não duplica o crédito.");
    assert.equal((await api({ url: "/api/cybercoins/resume" })).status, 403, "Rota pública de consulta não processa crédito administrativo.");
    assert.equal((await api({ user: player, url: "/api/cybercoins/withdraw", body: {
      purchaseId: "forged-admin-free-001", bundleId: "cybercoins-500", adminGrant: true, direction: "admin-grant", cybercoins: 0,
    } })).body.code, "INSUFFICIENT_CYBERCOINS", "Campos do navegador não habilitam crédito gratuito.");

    let release;
    creditBehavior = () => new Promise(resolve => { release = () => resolve("8800"); });
    const pendingId = "admin-concurrent-0001";
    const first = api({ body: { purchaseId: pendingId } });
    await new Promise(setImmediate);
    assert.equal((await api({ body: { purchaseId: pendingId } })).body.code, "PAYMENT_PENDING");
    assert.equal((await api({ body: { purchaseId: "admin-concurrent-0002" } })).body.code, "PAYMENT_PENDING");
    release(); assert.equal((await first).status, 200);
    creditBehavior = null;

    confirmation = () => null;
    const waitingId = "admin-waiting-000001";
    assert.equal((await api({ body: { purchaseId: waitingId } })).body.code, "PAYMENT_PENDING");
    const sent = creditCalls, checked = statementCalls;
    assert.equal((await api({ method: "GET" })).body.pendingGrant.id, waitingId);
    assert.equal(creditCalls, sent); assert.equal(statementCalls, checked, "Abrir o painel não movimenta nem consulta o banco externo.");
    start({ admins: "OutroGestorQA" });
    assert.equal((await api({ body: { purchaseId: waitingId } })).status, 403, "Admin revogado perde acesso imediatamente nas novas requisições.");
    assert.equal(creditCalls, sent);
    start();
    confirmation = () => 100;
    const partial = await api({ body: { purchaseId: waitingId } });
    assert.equal(partial.status, 200); assert.equal(partial.body.tijolinhos, 100);
    assert.equal(partial.body.requestedTijolinhos, 500, "Não afirma que recebeu 500 quando o preço fixo da feira pagou 100.");
    assert.equal(creditCalls, sent, "Consulta comprovante salvo sem reenviar crédito.");
    assert.equal(current().accounts[admin.accountKey].currency, 0);

    confirmation = null;
    creditBehavior = () => { throw Error("timeout após enviar"); };
    const unknownId = "admin-unknown-000001";
    assert.equal((await api({ body: { purchaseId: unknownId } })).body.code, "PAYMENT_PENDING");
    const before = creditCalls;
    start();
    assert.equal((await api({ body: { purchaseId: unknownId } })).body.code, "PAYMENT_REVIEW_REQUIRED");
    assert.equal(creditCalls, before, "Crédito com resposta perdida não é reenviado após reiniciar.");
    start({ admins: "" });
    assert.equal((await api()).status, 403, "Lista de administradores vazia bloqueia contas Google.");
    console.log("Crédito admin da feira: autorização no servidor, valor fixo 500, JWT da própria sessão, custo zero, isolamento, revogação, concorrência e consultas sem duplicação validados.");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
