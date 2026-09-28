const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {}, calls = [], storage = new Map();
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
listeners['presentation-room']({ ...response, update: { state: { jogador: {}, inimigo: {} }, activePlayer: 1 } });
assert.equal(multi.presentation, true); assert.equal(multi.spectator, true); assert.equal(multi.player, null);
assert.equal(ready, 1);
assert.equal(multi.pendingUpdate.activePlayer, 1);
multi.leaveRoom();
assert.equal(multi.room, null); assert.equal(multi.presentation, false);
assert.equal(storage.has('cyberduel.presentationRoom'), false);
assert.equal(storage.has('cyberduel.presentationKey'), false);
multi.joinRoom('123456', () => {});
assert.equal(calls.at(-1).payload.seat, '2'); assert.equal(calls.at(-1).payload.ticket, 'invitation');
console.log('Cliente: criação única, espera, reconexão da tela, início, limpeza e convite por lugar validados.');
