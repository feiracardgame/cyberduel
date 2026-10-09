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
  ui.account.clubUnlocked = true;
  let codeRequested;
  ui.callbacks.onRequestClubCode = (table, done) => { codeRequested = table; done({ ok: true }); };
  ui.callbacks.onWatchClubTables = listener => { updateTables = listener; return () => { stopped++; }; };
  ui.callbacks.onJoinClubTable = (table, code, seat, done) => { joinTable = { table, code, seat }; result = done; };
  ui.openSecretClub();
  assert.equal(ui.modal.children[0].attributes['aria-label'], 'Mesas do Clube secreto');
  assert.equal(byClass('club-tables').children.length, 4);
  assert.equal(byLabel('Mesa 1').disabled, true);
  const tables = [1, 2, 3, 4].map(table => ({ table, players: 0, available: true, locked: false }));
  updateTables({ ok: true, tables });
  byLabel('Mesa 2').click();
  assert.equal(codeRequested, 2);
  assert.equal(byClass('club-table-entry').hidden, false);
  assert.equal(byLabel('Código da Mesa 2').value, '');
  const form = byClass('club-table-entry');
  form.events.submit({ preventDefault() {} });
  assert.match(byClass('title-dialog__error').textContent, /6 números/);
  byLabel('Código da Mesa 2').value = '234567';
  form.events.submit({ preventDefault() {} });
  assert.match(byClass('title-dialog__error').textContent, /Escolha o jogador/);
  byLabel('Escolher jogador').value = '2';
  form.events.submit({ preventDefault() {} });
  assert.deepEqual(joinTable, { table: 2, code: '234567', seat: 2 });
  assert.equal(byLabel('Mesa 1').disabled, true, 'Bloquear novos envios enquanto conecta.');
  result({ ok: false, error: 'O código não pertence à mesa escolhida.' });
  assert.match(byClass('title-dialog__error').textContent, /mesa escolhida/);
  tables[1].players = 1;
  tables[1].occupiedSeats = [2];
  updateTables({ ok: true, tables });
  assert.equal(byLabel('Escolher jogador').children[2].disabled, true);
  assert.equal(byLabel('Escolher jogador').value, '', 'Limpar escolha se outro jogador ocupar o lugar.');
  assert.equal(byLabel('Mesa 2').children[1].textContent, 'Jogadores prontos: 1/2');
  tables[1].players = 2; tables[1].locked = true; tables[1].available = false;
  updateTables({ ok: true, tables });
  assert.equal(byLabel('Mesa 2').disabled, true);
  assert.match(byLabel('Mesa 2').children[2].textContent, /TRANCADA/);
  byLabel('Mesa 3').click();
  byLabel('Código da Mesa 3').value = '345678';
  byLabel('Escolher jogador').value = '1';
  form.events.submit({ preventDefault() {} });
  result({ ok: true });
  assert.equal(ui.modal, null); assert.equal(stopped, 1);
  ui.openSecretClub(); ui.closeModal(); assert.equal(stopped, 2);
  ui.callbacks.onRequestClubCode = (table, done) => done({ ok: false, error: 'Apresentação desconectada.' });
  ui.openSecretClub(); updateTables({ ok: true, tables }); byLabel('Mesa 1').click();
  assert.equal(byClass('club-table-entry').hidden, true);
  assert.equal(byClass('title-dialog__error').textContent, 'Apresentação desconectada.');
  ui.closeModal(); assert.equal(stopped, 3);
  ui.openSecretClub(); ui.destroy(); assert.equal(stopped, 4);
  ui.root = new Element('main');
  ui.account.clubUnlocked = false;
  ui.setStatus = message => { ui.lastStatus = message; };
  ui.openSecretClub();
  assert.equal(ui.modal, null);
  assert.match(ui.lastStatus, /3 vitórias/);
  ui.account.clubUnlocked = true;
  ui.openRoomDialog('join');
  assert.equal(byLabel('CRIAR SALA'), undefined, 'Entrada por código não exibe criação de sala.');
  ui.closeModal(true);
  ui.openRules();
  assert.equal(ui.modal.children[0].attributes['aria-label'], 'Regras do Cyberduel');
  assert.ok(byClass('title-rules-content').children.length > 0);
  ui.closeModal(true);

  const menu = new context.UI({ account: ui.account, callbacks: {} });
  menu.attachFanDrag = () => {};
  menu.renderCardMenu = () => {};
  menu.transitionCardMenu = change => change();
  menu.createCardMenu();
  assert.equal(Array.from(menu.menuCategories, category => category.id).join(','), 'partidas,cartas,ranking,tutorial');
  for (const category of menu.menuCategories) assert.ok(fs.existsSync(`assets/menus/${category.art}.png`));
  menu.openCategoryOptions('partidas');
  menu.cardMenuState.optionIndex = 2;
  menu.openCategoryOptions('privadas');
  assert.equal(menu.cardMenuState.currentKind, 'privadas');
  menu.closeCategoryOptions();
  assert.equal(menu.cardMenuState.currentKind, 'partidas');
  assert.equal(menu.cardMenuState.optionIndex, 2, 'Voltar retorna à carta da partida privada.');
  menu.closeCategoryOptions();
  assert.equal(menu.cardMenuState.mode, 'categories');
  let councilTick, now = Date.now(), released = 0;
  context.Date = class extends Date { static now() { return now; } };
  context.setInterval = fn => { councilTick = fn; return 22; };
  ui.account.councilMember = true;
  ui.openProfileScreen();
  assert.equal(byClass('player-id--council').classList.contains('player-id'), true);
  assert.match(byClass('player-id__council').textContent, /MEMBRO DO CONSELHO/);
  ui.closeModal(true);
  let councilRow = ui.getMenuSections().partidas.rows.find(([name]) => name === 'Partida do Conselho');
  assert.equal(typeof councilRow[3], 'function');
  ui.account.councilMember = false;
  councilRow = ui.getMenuSections().partidas.rows.find(([name]) => name === 'Partida do Conselho');
  assert.equal(councilRow[3], null);
  ui.openProfileScreen();
  assert.equal(byClass('player-id--council'), undefined);
  assert.equal(byClass('player-id__council'), undefined, 'Não exibe aviso do Conselho para quem não é membro.');
  ui.closeModal(true);
  ui.account.councilMember = true;
  ui.callbacks.onReserveCouncilSeat = (seat, done) => done({ ok: true, serverNow: now, expiresAt: now + 60_000 });
  ui.callbacks.onReleaseCouncilSeat = () => { released++; };
  ui.openCouncil();
  const councilState = { available: true, locked: false, occupiedSeats: [], reservations: [], serverNow: now };
  updateTables({ ok: true, council: councilState });
  byLabel('Reservar canto 1').click();
  assert.equal(byClass('club-table-entry').hidden, false);
  assert.match(byClass('club-tables-status').textContent, /60s/);
  const councilForm = byClass('club-table-entry');
  const councilInput = find(ui.modal, el => el.id === 'council-code');
  councilForm.events.submit({ preventDefault() {} });
  assert.match(byClass('title-dialog__error').textContent, /6 números/);
  councilInput.value = '123456';
  councilForm.events.submit({ preventDefault() {} });
  assert.deepEqual(joinTable, { table: 5, code: '123456', seat: 1 });
  result({ ok: false, error: 'Código incorreto.' });
  now += 60_000;
  councilTick();
  assert.equal(councilForm.hidden, true, 'Prazo vencido esconde a entrada.');
  councilState.locked = true; councilState.available = false;
  updateTables({ ok: true, council: councilState });
  assert.equal(byLabel('Reservar canto 1').disabled, true);
  assert.match(byClass('club-tables-status').textContent, /partida acontecendo/);
  ui.closeModal();
  assert.equal(released, 1);
  ui.openCouncil(); ui.destroy(); assert.equal(released, 2);
  ui.account.isAdmin = true;
  ui.root = new Element('main');
  ui.deckBuilder = { getCatalog: () => [] };
  const adminAccounts = [
    { username: 'Ana', nickname: 'Árvore', clubUnlocked: true, councilMember: false, rating: 1200 },
    { username: 'Bia', nickname: 'Conselheira', clubUnlocked: true, councilMember: true, rating: 1700, rankingPosition: 1,
      rank: 'Diamante', currency: 200, currencySpent: 300, marketSales: 2, unlockedCards: 8, totalCards: 100, statsTrackedSince: '2026-10-09T12:00:00Z' },
    { username: 'Caio', nickname: 'Novato', clubUnlocked: false, councilMember: false, rating: 1000 },
  ];
  ui.account.listAdminAccounts = async () => adminAccounts;
  ui.openAdminGrantDialog();
  await Promise.resolve();
  const list = byClass('title-admin-accounts');
  assert.equal(list.children.length, 3);
  assert.equal(byClass('title-admin-details').hidden, true);
  const search = byLabel('Pesquisar contas'), filter = byLabel('Filtrar acesso das contas'), order = byLabel('Ordenar contas');
  search.value = 'arvore'; search.events.input();
  assert.equal(list.children.length, 1); assert.equal(list.children[0].children[0].textContent, 'Ana');
  search.value = ''; search.events.input();
  filter.value = 'clubUnlocked'; filter.events.change(); assert.equal(list.children.length, 2);
  filter.value = 'councilMember'; filter.events.change(); assert.equal(list.children.length, 1);
  list.children[0].click();
  assert.equal(byLabel('Username da conta').value, 'Bia');
  const details = byClass('title-admin-details');
  assert.equal(details.hidden, false);
  assert.match(details.children.map(child => child.textContent).join(' '), /Tijolinhos gastos: 300.*8 de 100.*mercado: 2/);
  filter.value = 'all'; filter.events.change();
  order.value = 'ranking'; order.events.change(); assert.equal(list.children[0].children[0].textContent, 'Bia');
  order.value = 'ranking-asc'; order.events.change(); assert.equal(list.children[0].children[0].textContent, 'Caio');
  search.value = 'ausente'; search.events.input(); assert.equal(list.children.length, 0);
  assert.match(byClass('title-admin-note').textContent, /Nenhuma conta/);
  ui.closeModal();
  ui.account.listAdminAccounts = async () => { throw Error('Sem conexão'); };
  ui.openAdminGrantDialog();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(byClass('title-admin-note').textContent, 'Sem conexão');
  ui.closeModal();
  console.log('Admin: pesquisa por apelido, filtros de acesso, ordenação por ranking, detalhes e falha de carregamento validados.');
  console.log('Carteirinha: edição, fotos, estatísticas, acesso e falhas; salas: criar, entrar, validar e cancelar aprovados.');
  console.log('Clube: quatro mesas, escolha, código, contagem ao vivo, bloqueio e limpeza de assinaturas aprovados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
