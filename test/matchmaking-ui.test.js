const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag, cls, text) { this.tag = tag; this.className = cls; this.textContent = text; this.children = []; this.dataset = {}; this.attributes = {}; this.classList = { add() {}, remove() {} }; }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() {}
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
let timer;
const context = vm.createContext({ window: {}, requestAnimationFrame: fn => fn(), setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = null; } });
vm.runInContext(fs.readFileSync('js/title-ui.js', 'utf8') + '\nglobalThis.UI = CyberduelTitleUI;', context);
const ui = Object.create(context.UI.prototype);
ui.root = new Element('main');
ui.element = (tag, cls, text) => new Element(tag, cls, text);
ui.button = (cls, text, action) => Object.assign(ui.element('button', cls, text), { click() { if (!this.disabled) action(); } });
ui.setStatus = message => { ui.message = message; };
const profiles = { 1: { nickname: '<b>Ana</b>', avatar: 'data:image/jpeg;base64,photo', rank: 'Prata', rating: 1220 },
  2: { nickname: 'Beto', avatar: '', rank: 'Bronze', rating: 1100 } };
let joined, cancelled, started = 0;
const multi = { joinMatchmaking: cb => { joined = cb; }, cancelMatchmaking: cb => { cancelled = cb; } };
ui.openMatchmaking(multi);
const queue = ui.modal;
joined({ ok: true, profile: profiles[2] });
assert.match(queue.children[0].children[1].textContent, /1100 pontos/);
ui.closeModal(); assert.equal(ui.modal, queue);
const cancel = queue.children[0].children.at(-1);
cancel.click(); assert.equal(cancel.disabled, true);
cancelled({ ok: true }); assert.equal(ui.modal, null);
ui.openMatchmaking(multi); joined({ ok: false, error: 'Sessão expirada' });
assert.equal(ui.modal, null); assert.equal(ui.message, 'Sessão expirada');
ui.openMatchmaking(multi);
const staleJoined = joined;
ui.showVersus(profiles, 2, () => { started++; });
staleJoined({ ok: false, error: 'Resposta atrasada' });
assert.equal(ui.modal.dataset.kind, 'versus');
const matchup = ui.modal.children[0].children[1];
assert.equal(matchup.children[0].children[1].textContent, 'Beto');
assert.equal(matchup.children[1].textContent, 'VS');
assert.equal(matchup.children[2].children[0].src, profiles[1].avatar);
assert.equal(matchup.children[2].children[1].textContent, '<b>Ana</b>', 'Apelido é texto, não HTML.');
assert.equal(started, 0); timer(); assert.equal(started, 1); assert.equal(ui.modal, null);
(async () => {
  ui.account = { request: async () => ({ entries: [] }) };
  await ui.openLeaderboard();
  assert.match(ui.modal.children[0].children[1].textContent, /Nenhuma partida/);
  ui.closeModal(true);
  ui.account.request = async () => ({ entries: [{ position: 1, nickname: 'Beto', rank: 'Bronze', rating: 1100, wins: 2, losses: 1 }] });
  await ui.openLeaderboard();
  const table = ui.modal.children[0].children.at(-1);
  assert.equal(table.tag, 'table');
  assert.equal(table.children[1].children[0].children[1].textContent, 'Beto');
  ui.closeModal(true);
  ui.account.request = async () => { throw Error('Sem conexão'); };
  await ui.openLeaderboard(); assert.equal(ui.modal.children[0].children[1].textContent, 'Sem conexão');
  console.log('Interface: fila, cancelamento, falhas, VS, foto, apelido, rank e leaderboard validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });

vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8') + '\nglobalThis.Multi = CyberduelMultiplayer;', context);
const connection = new context.Multi();
connection.connect = () => ({ timeout() { return this; }, emit(name, payload, callback) { callback(Error('timeout')); } });
for (const method of ['joinMatchmaking', 'cancelMatchmaking']) connection[method](result => {
  assert.equal(result.ok, false); assert.ok(result.error);
});

let cleared = 0, response = { ok: true }, message;
context.window.cyberduelAccount = { token: 'current-token', clear() { cleared++; } };
connection.onStatus = value => { message = value; };
connection.connect = () => ({ timeout() { return this; }, emit(name, payload, callback) {
  assert.equal(payload.accountToken, 'current-token');
  callback(null, response);
} });
connection.joinMatchmaking(result => assert.equal(result.ok, true));
assert.equal(cleared, 0);
response = { ok: false, error: 'Deck inválido' };
connection.joinMatchmaking(() => {});
assert.equal(cleared, 0, 'Falha de deck não desconecta a conta.');
response = { ok: false, code: 'AUTH_REQUIRED', error: 'Sua sessão expirou.' };
connection.joinMatchmaking(() => {});
assert.equal(cleared, 1, 'Sessão inválida deixa de aparecer conectada.');
assert.equal(message, response.error);
connection.connect = () => ({ timeout() { return this; }, emit(name, payload, callback) { callback(Error('timeout')); } });
connection.joinMatchmaking(() => {});
assert.equal(cleared, 1, 'Timeout não apaga a sessão.');
