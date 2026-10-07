const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const url = 'http://127.0.0.1:31997';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-presentation-'));
const sockets = [];
const fixtures = require('./account-fixture')(dataDir, ['ArenaOne', 'ArenaTwo', ...Array.from({ length: 8 }, (_, i) => `TablePlayer${i}`)]);
const server = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: '31997', DATA_DIR: dataDir, PUBLIC_URL: 'https://duelo.example/' }, stdio: ['ignore', 'pipe', 'inherit'] });
const event = (socket, name, matches = () => true) => new Promise((resolve, reject) => {
  const handler = value => { if (matches(value)) { clearTimeout(timer); socket.off(name, handler); resolve(value); } };
  const timer = setTimeout(() => { socket.off(name, handler); reject(Error(`Evento ausente: ${name}`)); }, 6000);
  socket.on(name, handler);
});
const ack = (socket, name, payload = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload, (error, response) => error ? reject(error) : resolve(response)));
async function connect() { const socket = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(socket); await event(socket, 'connect'); return socket; }
async function api(route, token, body) {
  const response = await fetch(url + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  assert.ok(response.ok, `${route}: ${response.status}`); return response.json();
}
async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('ouvindo')) { clearTimeout(timer); resolve(); } });
  });
  const page = await fetch(url + '/apresentacao', { headers: { 'X-Forwarded-For': '198.51.100.5' } });
  assert.equal(page.status, 200, 'Página funciona também atrás do servidor público.');
  for (const route of ['/apresentação', '/apresentação/', '/apresentacao/']) {
    const redirect = await fetch(url + route, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/apresentacao');
  }
  assert.match(await page.text(), /window.CYBERDUEL_PRESENTATION=true/);
  assert.doesNotMatch(await (await fetch(url + '/')).text(), /window.CYBERDUEL_PRESENTATION=true/);
  const screen = await connect(), one = await connect(), two = await connect(), outsider = await connect();
  const room = await ack(screen, 'create-presentation');
  assert.equal(room.ok, true); assert.equal(room.room.players, 0);
  assert.equal(room.room.club, true, 'A apresentação identifica uma sala do Clube no servidor.');
  assert.equal(room.invitations.length, 2);
  const invitations = room.invitations.map(invite => {
    assert.match(invite.qrCode, /^data:image\/png;base64,/);
    const link = new URL(invite.url); assert.equal(link.origin, 'https://duelo.example');
    return { code: link.searchParams.get('room'), seat: link.searchParams.get('seat'), ticket: link.searchParams.get('ticket') };
  });
  assert.notEqual(invitations[0].ticket, invitations[1].ticket);
  assert.equal((await ack(outsider, 'create-presentation', { code: room.room.code })).ok, false);
  assert.equal((await ack(one, 'join-room', { code: room.room.code })).ok, false);
  const accounts = [];
  for (const account of fixtures.slice(0, 2)) {
    await api('account/faction', account.token, { faction: 'echossystem' });
    accounts.push(account);
  }
  let ready = false; one.on('match-ready', () => { ready = true; });
  assert.equal((await ack(two, 'join-room', { ...invitations[1], accountToken: accounts[1].token })).waiting, true);
  assert.equal(ready, false, 'Não inicia antes dos dois jogadores.');
  assert.equal((await ack(outsider, 'join-room', { ...invitations[1], accountToken: accounts[0].token })).ok, false);
  const readyOne = event(one, 'match-ready'), readyTwo = event(two, 'match-ready'), display = event(screen, 'presentation-room');
  const joined = await ack(one, 'join-room', { ...invitations[0], accountToken: accounts[0].token });
  assert.equal(joined.ok, true);
  const [first, second, shown] = await Promise.all([readyOne, readyTwo, display]);
  assert.equal(first.player, 1); assert.equal(second.player, 2);
  for (const side of ['jogador', 'inimigo']) {
    assert.ok(first.update.state[side].hand.length > 0);
    assert.deepEqual(shown.update.state[side].hand, []);
    assert.deepEqual(shown.update.state[side].deck, []);
    assert.equal(shown.update.state[side].field.length, 10);
  }
  assert.equal(shown.decks, undefined);
  assert.equal((await ack(screen, 'finish-turn', { state: first.update.state, step: 0, round: 1 })).ok, false);
  const spectator = await ack(outsider, 'spectate-room', { code: room.room.code });
  assert.equal(spectator.ok, true);
  assert.ok(spectator.update.state.jogador.hand.length > 0);
  assert.ok(spectator.update.state.jogador.hand.every(card => card.nome === 'Carta oculta'));
  const reconnect = await connect();
  screen.disconnect(); await new Promise(resolve => setTimeout(resolve, 70));
  const resumed = await ack(reconnect, 'create-presentation', { code: room.room.code, displayKey: room.displayKey });
  assert.equal(resumed.ok, true); assert.deepEqual(resumed.update.state.jogador.hand, []);
  // Um estado novo mantém o campo e os efeitos, sem transmitir as mãos à apresentação.
  const card = first.update.state.jogador.hand.shift();
  first.update.state.jogador.field[0] = card;
  first.update.state.eventosEfeito = [{ id: 1, lado: 'jogador', momento: 'invocacao', fonte: { id: card.id, nome: card.nome, indice: 0 }, alvos: [] }];
  const actor = first.activePlayer === 1 ? one : two;
  assert.equal((await ack(actor, 'finish-turn', { state: first.update.state, step: first.step, round: first.round })).ok, false, 'Contagem de início ainda bloqueia jogadas.');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, first.phaseStartsAt - Date.now()) + 30));
  const update = event(reconnect, "state-update");
  assert.equal((await ack(actor, 'finish-turn', { state: first.update.state, step: first.step, round: first.round })).ok, true);
  const next = await update;
  assert.deepEqual(next.state.jogador.hand, []); assert.deepEqual(next.state.inimigo.hand, []);
  assert.equal(next.state.jogador.field[0].nome, card.nome);
  assert.equal(next.state.eventosEfeito[0].fonte.nome, card.nome);
  const final = event(two, 'state-update');
  assert.equal((await ack(one, 'decline-match', { room: room.room.code, accountToken: accounts[0].token })).ok, true);
  assert.equal((await final).state.partidaEncerrada, true);
  for (const [index, account] of accounts.entries()) {
    const response = await fetch(url + '/api/auth/session', { headers: { Authorization: `Bearer ${account.token}` } });
    const profile = await response.json();
    assert.equal(profile.clubGames, 1); assert.equal(profile.humanGames, 1);
    assert.equal(profile.clubWins, index); assert.equal(profile.humanWins, index);
  }
  one.emit('surrender');
  assert.equal((await ack(one, 'decline-match', { room: room.room.code, accountToken: accounts[0].token })).ok, false);
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'accounts.json'))).accounts;
  assert.equal(saved[accounts[0].accountKey].clubGames, 1);
  assert.equal(saved[accounts[1].accountKey].clubWins, 1, 'Estatísticas do Clube persistidas uma única vez.');
  const left = event(one, 'opponent-left');
  reconnect.emit('leave-room'); await left;

  const lobby = await connect();
  const initial = await ack(lobby, 'watch-club-tables');
  assert.equal(initial.tables.length, 4);
  assert.ok(initial.tables.every(table => !table.available && !table.locked && table.players === 0));
  const hosts = [], tables = [];
  for (const table of [1, 2, 3, 4]) {
    const page = await fetch(`${url}/apresentacao${table}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), new RegExp(`window.CYBERDUEL_TABLE=${table};`));
    const redirect = await fetch(`${url}/apresentação${table}/`, { redirect: 'manual' });
    assert.equal(redirect.headers.get('location'), `/apresentacao${table}`);
    const host = await connect(); hosts.push(host);
    const created = await ack(host, 'create-presentation', { table });
    assert.equal(created.ok, true); assert.equal(created.room.table, table);
    tables.push(created);
  }
  assert.equal(new Set(tables.map(table => table.room.code)).size, 4, 'Cada apresentação tem seu próprio código.');
  const available = await ack(lobby, 'watch-club-tables');
  assert.ok(available.tables.every(table => table.available && !table.locked));
  assert.ok(available.tables.every(table => !('code' in table)), 'O menu não divulga os códigos das apresentações.');
  const intruder = await connect();
  assert.equal((await ack(intruder, 'create-presentation', { table: 1 })).ok, false, 'Não substituir uma mesa aberta.');
  assert.equal((await ack(intruder, 'create-presentation', { table: 5 })).ok, false);
  assert.equal((await ack(intruder, 'join-room', { table: 2, code: tables[0].room.code, accountToken: accounts[0].token })).ok, false, 'Não aceitar código de outra mesa.');
  assert.equal((await ack(intruder, 'join-room', { table: 1, code: tables[0].room.code })).ok, false, 'Entrada exige conta.');
  const firstHostCode = tables[0].room.code;
  const offline = event(lobby, 'club-tables'); hosts[0].disconnect();
  assert.equal((await offline).tables[0].available, false);
  assert.equal((await ack(intruder, 'join-room', { table: 1, code: firstHostCode, accountToken: accounts[0].token })).ok, false);
  const restoredHost = await connect(); hosts[0] = restoredHost;
  assert.equal((await ack(restoredHost, 'create-presentation', { table: 1, code: firstHostCode, displayKey: tables[0].displayKey })).ok, true);
  const tableAccounts = fixtures.slice(2);
  for (const account of tableAccounts) await api('account/faction', account.token, { faction: 'echossystem' });
  for (const [index, table] of tables.entries()) {
    const firstPlayer = await connect(), secondPlayer = await connect();
    const firstPayload = { table: index + 1, code: table.room.code, accountToken: tableAccounts[index * 2].token };
    const changed = event(lobby, 'club-tables', response => response.tables[index].players === 1);
    const joined = await ack(firstPlayer, 'join-room', firstPayload);
    assert.equal(joined.waiting, true); assert.equal(joined.player, 1);
    assert.equal((await changed).tables[index].players, 1);
    if (index === 0) {
      const vacant = event(lobby, 'club-tables', response => response.tables[0].players === 0);
      firstPlayer.emit('leave-room');
      const remaining = (await vacant).tables[0];
      assert.equal(remaining.players, 0); assert.equal(remaining.available, true, 'Sair da espera mantém a apresentação aberta.');
      assert.equal((await ack(firstPlayer, 'join-room', firstPayload)).waiting, true);
    }
    const readyFirst = event(firstPlayer, 'match-ready'), readySecond = event(secondPlayer, 'match-ready');
    const locked = event(lobby, 'club-tables', response => response.tables[index].locked);
    const display = event(hosts[index], 'presentation-room', response => !!response.update);
    const joinedSecond = await ack(secondPlayer, 'join-room', { table: index + 1, code: table.room.code, accountToken: tableAccounts[index * 2 + 1].token });
    assert.equal(joinedSecond.ok, true); assert.equal(joinedSecond.waiting, false);
    const [firstMatch, secondMatch, lockState, shown] = await Promise.all([readyFirst, readySecond, locked, display]);
    assert.equal(firstMatch.room, table.room.code); assert.equal(secondMatch.room, table.room.code);
    assert.equal(firstMatch.arena, true); assert.equal(shown.room.table, index + 1);
    assert.deepEqual(shown.update.state.jogador.hand, [], 'A mesa mantém a privacidade da apresentação comum.');
    assert.equal(lockState.tables[index].players, 2);
    assert.equal(lockState.tables[index].locked, true); assert.equal(lockState.tables[index].available, false);
    assert.equal((await ack(intruder, 'join-room', { table: index + 1, code: table.room.code, accountToken: accounts[0].token })).ok, false, 'Mesa em jogo não aceita terceiros.');
  }
  const finalTables = await ack(lobby, 'watch-club-tables');
  assert.ok(finalTables.tables.every(table => table.locked && table.players === 2), 'Quatro partidas independentes ao mesmo tempo.');
  const released = event(lobby, 'club-tables');
  hosts[3].emit('leave-room');
  assert.equal((await released).tables[3].available, false);
  const replacement = await ack(hosts[3], 'create-presentation', { table: 4 });
  assert.equal(replacement.ok, true); assert.notEqual(replacement.room.code, tables[3].room.code);
  assert.equal((await ack(lobby, 'watch-club-tables')).tables[3].available, true);
  console.log('Clube: quatro rotas, códigos distintos, ocupação ao vivo, isolamento, espera, saída, reconexão e bloqueio de quatro partidas simultâneas aprovados.');
  console.log('Apresentação: página separada, QR codes, lugares, privacidade, reconexão, identificação do Clube e estatísticas persistidas validados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  sockets.forEach(socket => socket.disconnect()); server.kill(); fs.rmSync(dataDir, { recursive: true, force: true });
});
