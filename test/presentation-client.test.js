const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {}, calls = [], storage = new Map(), persistent = new Map();
const socket = {
  on(name, callback) { listeners[name] = callback; },
  timeout() { return this; },
  emit(name, payload, callback) { calls.push({ name, payload, callback }); },
};
const context = vm.createContext({
  URLSearchParams, location: { origin: 'https://duelo.example', search: '?room=123456&seat=2&ticket=invitation' },
  io: () => socket,
  window: { cyberduelServerUrl: () => 'https://duelo.example', cyberduelDeckBuilder: { getDeckForMatch: () => [] },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } },
});
context.window.localStorage = { getItem: key => persistent.get(key), setItem: (key, value) => persistent.set(key, value), removeItem: key => persistent.delete(key) };
vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8'), context);
const multi = context.window.cyberduelMultiplayer;
let waiting = 0, ready = 0;
multi.onReady = () => ready++;
multi.createPresentation(() => waiting++);
listeners.connect();
assert.equal(calls.filter(call => call.name === 'create-presentation').length, 1, 'Conexão inicial não cria duas arenas.');
const response = { ok: true, room: { code: '123456' }, displayKey: 'private-key', invitations: [], seats: [] };
calls[0].callback(null, response);
assert.equal(waiting, 1); assert.equal(ready, 0);
listeners.connect();
assert.equal(calls.at(-1).payload.displayKey, 'private-key');
assert.equal(calls.at(-1).payload.code, '123456');
listeners['presentation-room']({ ...response, ranked: true, update: { state: { jogador: {}, inimigo: {} }, activePlayer: 1 } });
assert.equal(multi.presentation, true); assert.equal(multi.spectator, true); assert.equal(multi.player, null);
assert.equal(multi.ranked, true, 'A tela da mesa recebe a modalidade ranqueada.');
assert.equal(ready, 1);
assert.equal(multi.pendingUpdate.activePlayer, 1);
multi.leaveRoom();
assert.equal(multi.room, null); assert.equal(multi.presentation, false);
assert.equal(storage.has('cyberduel.presentationRoom'), false);
assert.equal(storage.has('cyberduel.presentationKey'), false);
assert.equal(persistent.has('cyberduel.presentationKey'), false);
multi.joinRoom('123456', () => {});
assert.equal(calls.at(-1).payload.seat, '2'); assert.equal(calls.at(-1).payload.ticket, 'invitation');

multi.joinRoom('456789', () => {}, 3, 2);
assert.equal(calls.at(-1).payload.table, 3);
assert.equal(calls.at(-1).payload.seat, 2);
calls.at(-1).callback({ ok: true, waiting: true, player: 1, room: { code: '456789' }, resumeToken: 'player-token' });
listeners.connect();
assert.equal(calls.at(-1).payload.table, 3, 'Reconectar preserva a mesa escolhida.');
assert.equal(calls.at(-1).payload.seat, 2, 'Reconectar preserva o jogador escolhido.');
multi.leaveRoom();
context.window.CYBERDUEL_TABLE = 2;
const tableMulti = vm.runInContext('new CyberduelMultiplayer()', context);
tableMulti.createPresentation(() => {});
assert.equal(calls.at(-1).payload.table, 2);
assert.equal(calls.at(-1).payload.code, undefined, 'A Mesa 2 não restaura a apresentação comum.');
calls.at(-1).callback(null, { ...response, room: { code: '222222' } });
assert.equal(storage.get('cyberduel.presentationRoom:2'), '222222');
assert.equal(storage.has('cyberduel.presentationRoom'), false);
storage.clear();
const primaryIo = context.io;
context.io = () => ({ ...socket, on() {} });
const reopened = vm.runInContext('new CyberduelMultiplayer()', context);
reopened.createPresentation(() => {});
assert.equal(calls.at(-1).payload.code, '222222', 'Uma nova aba recupera a apresentação pelo armazenamento persistente.');
assert.equal(calls.at(-1).payload.displayKey, 'private-key');
context.io = primaryIo;
tableMulti.leaveRoom();
assert.equal(storage.has('cyberduel.presentationRoom:2'), false);
assert.equal(persistent.has('cyberduel.presentationRoom:2'), false);
let tableUpdates = 0;
tableMulti.watchClubTables(() => { tableUpdates++; });
calls.at(-1).callback(null, { ok: true, tables: [] });
listeners['club-tables']({ ok: true, tables: [] });
assert.equal(tableUpdates, 2);
tableMulti.requestClubCode(4, response => assert.equal(response.ok, true));
assert.equal(calls.at(-1).name, 'request-club-code');
assert.equal(calls.at(-1).payload.table, 4);
calls.at(-1).callback(null, { ok: true });
tableMulti.reserveClubSeat(4, 2, response => assert.equal(response.expiresAt, 60_000));
assert.equal(calls.at(-1).name, 'reserve-club-seat');
assert.equal(calls.at(-1).payload.table, 4); assert.equal(calls.at(-1).payload.seat, 2);
calls.at(-1).callback(null, { ok: true, expiresAt: 60_000 });
tableMulti.releaseClubSeat(4);
assert.equal(calls.at(-1).name, 'release-club-seat'); assert.equal(calls.at(-1).payload.table, 4);
listeners.connect();
assert.equal(calls.at(-1).name, 'watch-club-tables');
tableMulti.unwatchClubTables();
listeners['club-tables']({ ok: true, tables: [] });
assert.equal(tableUpdates, 2);
console.log('Cliente: criação única, espera, reconexão da tela, início, limpeza e convite por lugar validados.');

listeners['match-ready']({ room: '555555', table: 5, player: 1 });
assert.equal(tableMulti.table, 5);
tableMulti.enterExisting({ room: { code: '555555', table: 5 }, update: { state: {} } });
assert.equal(tableMulti.table, 5, 'Reconexão e espectadores preservam a mesa.');
tableMulti.leaveRoom();
assert.equal(tableMulti.table, null, 'O tema do Conselho não vaza para o próximo solo.');
listeners['match-ready']({ room: '111111', player: 1 });
assert.equal(tableMulti.table, null, 'Partida aleatória não herda a mesa anterior.');

let returnedToMenu = 0;
tableMulti.room = '777777'; tableMulti.active = true;
tableMulti.scene = { scene: { start(key) { assert.equal(key, 'CenaTitulo'); returnedToMenu++; } } };
listeners['room-cleared']({ code: '000000', message: 'antiga' });
assert.equal(tableMulti.room, '777777', 'Um evento antigo não encerra uma sala nova.');
listeners['room-cleared']({ code: '777777', message: 'Sala liberada.' });
assert.equal(tableMulti.room, null); assert.equal(tableMulti.active, false);
assert.equal(returnedToMenu, 1);
