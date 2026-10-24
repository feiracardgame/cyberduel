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
account.applyAuth({ username: 'Jogador', clubGames: 4, clubWins: 2, clubUnlocked: true, councilMember: true });
assert.equal(account.snapshot().clubGames, 4); assert.equal(account.snapshot().clubWins, 2);
assert.equal(account.snapshot().councilMember, true);
account.applyAuth({ username: 'Jogador', councilMember: false });
assert.equal(account.councilMember, false);
account.applyAuth({ username: 'Jogador', councilMember: true });
account.clear(); assert.equal(account.clubGames, 0); assert.equal(account.clubWins, 0);
assert.equal(account.councilMember, false);
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
    assert.notEqual(options.auth, false);
    assert.equal(options.headers, undefined);
    assert.equal(options.body.amount, 200);
    return { added: 200, account: { username: "Gabriel", currency: 700, collection: account.collection } };
  };
  await account.grantCurrency("Gabriel", 200);
  assert.equal(account.currency, 700);
  account.request = async () => ({ added: 200, account: { username: "Outro", currency: 900 } });
  await account.grantCurrency("Outro", 200);
  assert.equal(account.currency, 700, "Creditar outra conta não altera a conta atual.");
  account.request = async (route, options) => {
    assert.equal(route, "/api/admin/accounts/grant-rating");
    assert.equal(options.method, "POST");
    assert.equal(options.body.username, "Gabriel");
    assert.equal(options.body.amount, 500);
    return { added: 500, account: { username: "Gabriel", councilMember: true } };
  };
  await account.grantRating("Gabriel", 500);
  assert.equal(account.councilMember, true);
  account.request = async (route, options) => {
    assert.equal(route, '/api/admin/accounts/reset-rating');
    assert.equal(options.method, 'POST');
    return { count: 2, account: { username: 'Gabriel', rating: 1000, councilMember: false } };
  };
  const resetRating = await account.resetLeaderboardRating();
  assert.equal(resetRating.count, 2);
  assert.equal(resetRating.account.rating, 1000);
  assert.equal(account.councilMember, false);
  account.request = async route => {
    assert.equal(route, '/api/admin/accounts');
    return { accounts: [{ username: 'Gabriel', clubUnlocked: true, councilMember: true }] };
  };
  assert.equal((await account.listAdminAccounts())[0].username, 'Gabriel');
  let rendered = 0, stoppedSolo = 0;
  const builder = context.window.cyberduelDeckBuilder;
  builder.getCatalog = () => [];
  builder.isCardAllowed = card => ['echossystem', 'raspcorp'].includes(card.booster);
  const player = { deck: { cartas: [{ booster: 'humbanet' }] }, mao: { cartas: [] }, campo: { cartas: [] }, descarte: [] };
  const editor = { scene: { isActive: () => true }, deckBuilderUI: { render() { rendered++; } } };
  const duel = { scene: { isActive: () => true, start(key) { assert.equal(key, 'CenaTitulo'); stoppedSolo++; } },
    partida: { jogador: player, inimigo: player }, multiplayerAtivo: false };
  context.window.cyberduelGame = { scene: { getScene: key => key === 'CenaDeckBuilder' ? editor : duel } };
  account.applyDemoMode(true);
  account.applyDemoMode(true);
  assert.equal(stoppedSolo, 1, 'Encerra solo incompatível uma vez ao ativar.');
  assert.equal(account.snapshot().demoMode, true);
  account.applyDemoMode(false);
  assert.equal(rendered, 2, 'Editor acompanha ativação e desativação sem perder o rascunho.');
  assert.equal(stoppedSolo, 1);
  context.window.cyberduelGame = null;
  function offlineFixture() {
    const key = 'cyberduel.account.token.v1', storage = new Map([[key, 'token-antigo']]);
    let requests = 0, writes = 0, notifications = 0;
    const offlineContext = vm.createContext({
      localStorage: { getItem: key => storage.get(key) || null,
        setItem(key, value) { writes++; storage.set(key, value); }, removeItem: key => storage.delete(key) },
      fetch() { requests++; throw Error('O perfil offline não deve acessar a rede.'); },
      window: { cyberduelServerUrl: () => 'http://localhost:3000' },
    });
    vm.runInContext(fs.readFileSync('js/account.js', 'utf8'), offlineContext);
    const account = offlineContext.window.cyberduelAccount;
    account.onChange(() => notifications++);
    return { account, storage, key, get requests() { return requests; },
      get writes() { return writes; }, get notifications() { return notifications; } };
  }
  {
    const f = offlineFixture(), offline = f.account.useOfflineAdmin();
    assert.equal(offline.user, 'Admin'); assert.equal(offline.nickname, 'Admin');
    assert.equal(offline.authProvider, 'offline'); assert.equal(offline.isAdmin, true);
    assert.equal(f.account.token, null); assert.equal(f.storage.has(f.key), false);
    assert.equal(f.requests, 0); assert.equal(f.writes, 0); assert.equal(f.notifications, 1);
  }
  for (const isAdmin of [false, true]) {
    const f = offlineFixture();
    f.account.applyAuth({ username: 'ContaAtual', nickname: 'Atual', token: 'sessao-atual', isAdmin,
      collection: { 'monstro:O Rato': 2 } });
    const before = f.account.snapshot(), notifications = f.notifications;
    assert.deepEqual(f.account.useOfflineAdmin(), before, 'Perfil offline preserva a conta já conectada.');
    assert.equal(f.account.token, 'sessao-atual'); assert.equal(f.storage.get(f.key), 'sessao-atual');
    assert.equal(f.notifications, notifications); assert.equal(f.writes, 1); assert.equal(f.requests, 0);
  }
  for (const succeeds of [true, false]) {
    const f = offlineFixture(), routes = [];
    let finish, sessionStarted;
    const started = new Promise(resolve => { sessionStarted = resolve; });
    f.account.request = route => {
      routes.push(route);
      return route === '/api/config' ? Promise.resolve({ demoMode: false }) :
        new Promise((resolve, reject) => {
          finish = () => succeeds
            ? resolve({ username: 'ContaAntiga', token: 'token-antigo', isAdmin: false })
            : reject(Error('Sessão antiga expirada'));
          sessionStarted();
        });
    };
    const restore = f.account.restore();
    await started;
    assert.equal(typeof finish, 'function', 'A sessão antiga já está em voo.');
    const notificationsBeforeOffline = f.notifications;
    f.account.useOfflineAdmin(); finish();
    const restored = await restore;
    assert.equal(restored.user, 'Admin'); assert.equal(restored.authProvider, 'offline');
    assert.equal(restored.isAdmin, true); assert.equal(f.account.token, null);
    assert.equal(f.storage.has(f.key), false); assert.equal(f.writes, 0);
    assert.equal(f.notifications, notificationsBeforeOffline + 1,
      'A resposta antiga não substitui nem limpa o perfil offline.');
    assert.deepEqual(routes, ['/api/config', '/api/auth/session']);
  }
  console.log("Coleção administrativa sincronizada com o Deck Forge.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
