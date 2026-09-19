const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.classList = { add() {}, remove() {} }; }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() { this.focused = true; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
const storage = new Map([['cyberduel.resume', 'secret']]);
const context = vm.createContext({ window: { sessionStorage: {
  getItem: key => storage.get(key), removeItem: key => storage.delete(key), setItem: (key, value) => storage.set(key, value),
}, cyberduelAccount: { token: 'account-token' } }, requestAnimationFrame: f => f(), setTimeout });
vm.runInContext(fs.readFileSync('js/title-ui.js', 'utf8') + '\nglobalThis.UI = CyberduelTitleUI;', context);
vm.runInContext(fs.readFileSync('js/multiplayer.js', 'utf8') + '\nglobalThis.Multi = CyberduelMultiplayer;', context);
const ui = Object.create(context.UI.prototype);
ui.root = new Element();
ui.element = (_tag, _cls, text) => Object.assign(new Element(), { textContent: text });
ui.button = (cls, text, handler) => Object.assign(ui.element('button', cls, text), { click() { if (!this.disabled) handler(); } });
let resumeCalls = 0, declineCalls = 0, done;
ui.showResumeMatch('123456', cb => { resumeCalls++; done = cb; }, cb => { declineCalls++; done = cb; });
const overlay = ui.modal;
assert.equal(overlay.dataset.kind, 'resume');
assert.equal(overlay.children[0].attributes['aria-modal'], 'true');
const [yes, no] = overlay.children[0].children.at(-1).children;
assert.equal(yes.textContent, 'SIM'); assert.equal(no.textContent, 'NÃO');
assert.equal(yes.focused, true);
ui.closeModal(); assert.equal(ui.modal, overlay, 'Modal exige uma escolha.');
yes.click(); no.click();
assert.equal(resumeCalls, 1); assert.equal(declineCalls, 0, 'Impede decisões simultâneas.');
done({ ok: false, error: 'Falha de conexão' });
assert.equal(overlay.children[0].children[2].textContent, 'Falha de conexão');
assert.equal(no.disabled, false);
no.click(); assert.equal(declineCalls, 1);
done({ ok: true }); assert.equal(ui.modal, null);
ui.showResumeMatch('123456', cb => cb({ ok: true }), () => {});
ui.modal.children[0].children.at(-1).children[0].click();
assert.equal(ui.modal, null);
const multi = new context.Multi();
multi.connect = () => ({ emit(event, payload, callback) {
  assert.equal(event, 'decline-match'); assert.equal(payload.resumeToken, 'secret');
  assert.equal(payload.accountToken, 'account-token'); assert.equal(payload.room, '123456');
  callback({ ok: true });
} });
multi.declineMatch('123456', result => assert.equal(result.ok, true));
assert.equal(multi.resumeToken, null); assert.equal(storage.has('cyberduel.resume'), false);
multi.receiveUpdate = () => {};
for (const player of [1, 2, null]) {
  multi.player = player;
  multi.enterExisting({ room: { code: '123456' }, usernames: { 1: 'login1', 2: 'login2' }, nicknames: { 1: 'Apelido', 2: 'Apelido' } });
  assert.equal(multi.localNickname, 'Apelido'); assert.equal(multi.opponentNickname, 'Apelido');
  assert.equal(multi.localUsername, player === 2 ? 'login2' : 'login1');
  assert.equal(multi.opponentUsername, player === 2 ? 'login1' : 'login2');
}
console.log('Modal de retorno, escolhas, falha, limpeza do token e apelidos separados da identidade validados.');
