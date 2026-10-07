const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {};
    this.events = {}; this.className = ''; this.textContent = '';
    this.classList = {
      add: name => { this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(' ').filter(x => x !== name).join(' '); },
      contains: name => this.className.split(' ').includes(name),
    };
  }
  append(...items) { items.forEach(item => { item.remove(); item.parent = this; this.children.push(item); }); }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.events[name] = handler; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  focus() { this.focused = true; }
  click() { if (!this.disabled) return this.events.click?.(); }
}
const context = vm.createContext({
  console, document: { createElement: tag => new Element(tag), body: new Element('body'), removeEventListener() {} },
  requestAnimationFrame: fn => fn(), setTimeout: fn => fn(), clearTimeout() {}, clearInterval() {}, window: {},
});
vm.runInContext(fs.readFileSync('js/title-ui.js', 'utf8') + '\nglobalThis.UI = CyberduelTitleUI;', context);
const ui = new context.UI({ callbacks: {} });
ui.root = new Element('main');
function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) { const found = find(child, predicate); if (found) return found; }
}
const byClass = name => find(ui.modal, el => el.classList.contains(name));
const byLabel = label => find(ui.modal, el => el.attributes['aria-label'] === label);

(async () => {
  let auth = 0, registration = 0, saves = 0, notifications = 0;
  ui.openAuthDialog = () => { auth++; };
  ui.openRegistrationDialog = () => { registration++; };
  ui.openProfileScreen(); assert.equal(auth, 1);
  ui.account = { user: 'Duelista', needsRegistration: true };
  ui.openProfileScreen(); assert.equal(registration, 1);
  ui.account = {
    user: 'Duelista', nickname: 'Ana', avatar: '', faction: 'echossystem',
    profilePhotos: ['assets/fotosdeperfil/boi_icon.png'], gamesPlayed: 11,
    humanGames: 7, humanWins: 3, clubGames: 4, clubWins: 2, clubUnlocked: true,
    notify() { notifications++; },
    async updateProfile(nickname, avatar) { saves++; this.nickname = nickname; this.avatar = avatar; },
  };
  const shortcut = ui.createMenuShortcuts().children[0];
  assert.equal(shortcut.attributes['aria-label'], 'CARTEIRINHA');
  shortcut.click();
  assert.equal(ui.modal.children[0].attributes['aria-label'], 'Carteirinha do clube');
  assert.deepEqual(byClass('player-id__stats').children.map(el => el.children[1].textContent), ['7', '3', '4', '2']);
  assert.equal(byClass('player-id__faction').textContent, 'ECHOSSYSTEM');
  assert.equal(byClass('player-id__access').dataset.unlocked, 'true');
  assert.equal(byLabel('Fechar carteirinha').focused, true, 'Abrir a carteirinha pelo topo.');
  const nickname = byLabel('Apelido');
  assert.equal(byClass('profile-save'), undefined);
  nickname.value = '  ';
  await byLabel('Fechar carteirinha').click(); assert.equal(saves, 0);
  assert.match(byClass('title-dialog__error').textContent, /1 a 32/);
  nickname.value = '  Bia  '; nickname.events.input();
  assert.equal(byClass('player-id__name').textContent, 'Bia');
  const photo = byLabel('Trocar foto de perfil');
  photo.click(); assert.equal(byClass('profile-photo-picker').hidden, false);
  byClass('profile-photo-option').click();
  assert.equal(byClass('profile-photo-picker').hidden, true);
  const closing = byLabel('Fechar carteirinha').click();
  assert.equal(byLabel('Fechar carteirinha').disabled, true);
  ui.handleKeydown({ key: 'Escape' });
  await closing;
  assert.equal(saves, 1); assert.equal(ui.account.nickname, 'Bia');
  assert.equal(ui.account.avatar, ui.account.profilePhotos[0]);
  assert.equal(ui.modal, null); assert.equal(notifications, 1);
  ui.openProfileScreen();
  await ui.closeModal();
  assert.equal(saves, 1, 'Fechar sem alterações não envia outra gravação.');
  ui.openProfileScreen();
  byLabel('Apelido').value = 'Carol';
  ui.account.updateProfile = async () => { throw Error('Sem conexão'); };
  await ui.closeModal();
  assert.equal(byClass('title-dialog__error').textContent, 'Sem conexão');
  assert.equal(byLabel('Apelido').value, 'Carol', 'Falha mantém a edição para tentar novamente.');
  assert.equal(byLabel('Fechar carteirinha').disabled, false);
  assert.equal(ui.modalRequired, false);
  ui.account.updateProfile = async function(nickname, avatar) { saves++; this.nickname = nickname; this.avatar = avatar; };
  ui.handleKeydown({ key: 'Escape' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.modal, null); assert.equal(ui.account.nickname, 'Carol');
  assert.equal(saves, 2, 'Escape também salva as alterações.');
  Object.assign(ui.account, { faction: null, humanGames: 0, humanWins: 0, clubGames: 0, clubWins: 0, clubUnlocked: false });
  ui.openProfileScreen();
  assert.deepEqual(byClass('player-id__stats').children.map(el => el.children[1].textContent), ['0', '0', '0', '0']);
  assert.equal(byClass('player-id__access').dataset.unlocked, 'false');
  assert.match(byClass('player-id__note').textContent, /3 vitórias/);
  ui.closeModal(true);

  let created = 0, joined = '';
  ui.callbacks = { onCreateRoom() { created++; }, onJoinRoom(code) { joined = code; } };
  ui.openRoomDialog();
  byLabel('CRIAR SALA').click(); assert.equal(created, 1); assert.equal(ui.modal, null);
  ui.openRoomDialog();
  const code = byLabel('Código da sala');
  code.value = '12'; byLabel('ENTRAR NA SALA').click();
  assert.match(byClass('title-dialog__error').textContent, /6 números/);
  assert.equal(joined, ''); assert.ok(ui.modal);
  code.value = '12a34-5678'; code.events.input();
  assert.equal(code.value, '123456');
  byLabel('ENTRAR NA SALA').click();
  assert.equal(joined, '123456'); assert.equal(ui.modal, null);
  ui.openRoomDialog(); byLabel('CANCELAR').click();
  assert.equal(ui.modal, null); assert.equal(created, 1);

  let updateTables, stopped = 0, joinTable, result;
  ui.callbacks.onWatchClubTables = listener => { updateTables = listener; return () => { stopped++; }; };
  ui.callbacks.onJoinClubTable = (table, code, done) => { joinTable = { table, code }; result = done; };
  ui.openSecretClub();
  assert.equal(ui.modal.children[0].attributes['aria-label'], 'Mesas do Clube secreto');
  assert.equal(byClass('club-tables').children.length, 4);
  assert.equal(byLabel('Mesa 1').disabled, true);
  const tables = [1, 2, 3, 4].map(table => ({ table, players: 0, available: true, locked: false }));
  updateTables({ ok: true, tables });
  byLabel('Mesa 2').click();
  assert.equal(byClass('club-table-entry').hidden, false);
  assert.equal(byLabel('Código da Mesa 2').value, '');
  const form = byClass('club-table-entry');
  form.events.submit({ preventDefault() {} });
  assert.match(byClass('title-dialog__error').textContent, /6 números/);
  byLabel('Código da Mesa 2').value = '234567';
  form.events.submit({ preventDefault() {} });
  assert.deepEqual(joinTable, { table: 2, code: '234567' });
  assert.equal(byLabel('Mesa 1').disabled, true, 'Bloquear novos envios enquanto conecta.');
  result({ ok: false, error: 'O código não pertence à mesa escolhida.' });
  assert.match(byClass('title-dialog__error').textContent, /mesa escolhida/);
  tables[1].players = 1;
  updateTables({ ok: true, tables });
  assert.equal(byLabel('Mesa 2').children[1].textContent, 'Jogadores prontos: 1/2');
  tables[1].players = 2; tables[1].locked = true; tables[1].available = false;
  updateTables({ ok: true, tables });
  assert.equal(byLabel('Mesa 2').disabled, true);
  assert.match(byLabel('Mesa 2').children[2].textContent, /TRANCADA/);
  byLabel('Mesa 3').click();
  byLabel('Código da Mesa 3').value = '345678';
  form.events.submit({ preventDefault() {} });
  result({ ok: true });
  assert.equal(ui.modal, null); assert.equal(stopped, 1);
  ui.openSecretClub(); ui.closeModal(); assert.equal(stopped, 2);
  ui.openSecretClub(); ui.destroy(); assert.equal(stopped, 3);
  console.log('Carteirinha: edição, fotos, estatísticas, acesso e falhas; salas: criar, entrar, validar e cancelar aprovados.');
  console.log('Clube: quatro mesas, escolha, código, contagem ao vivo, bloqueio e limpeza de assinaturas aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
