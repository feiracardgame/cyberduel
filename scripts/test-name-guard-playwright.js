const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-name-guard-'));
const users = require('../test/account-fixture')(dataDir, ['P_Diddy', 'Epstein123', 'DueloAntigo', 'TutorialNovo', 'RegistroNovo']);
const file = path.join(dataDir, 'accounts.json');
const store = JSON.parse(fs.readFileSync(file));
for (const [index, user] of users.entries()) Object.assign(store.accounts[user.accountKey], {
  nickname: index === 0 ? 'ɛpstein' : index === 1 ? 'εpstein' : index === 2 ? 'ᴇᴘꜱᴛᴇɪɴ' : '', currency: 875,
  tutorial: { introSeen: true, named: true, completed: true, wantsTutorial: false, farewellSeen: true, seen: [] },
});
store.accounts[users[3].accountKey].tutorial.named = false;
Object.assign(store.accounts[users[4].accountKey], { username: 'google_' + 'a'.repeat(32), nickname: '' });
const starter = [
  ['monstro', 'O Rato', 2], ['monstro', 'A Cabra', 2], ['monstro', 'O Cão', 2],
  ['monstro', 'O Porco', 2], ['monstro', 'A Cobra', 2], ['monstro', 'O Tigre', 2],
  ['monstro', 'A Aranha', 1], ['monstro', 'O Boi', 1], ['efeito', 'O Trotar do Cavalo', 2],
  ['efeito', 'O Canto do Galo', 2], ['efeito', 'A Travessura do Macaco', 1], ['terreno', 'A Toca do Coelho', 1],
].map(([tipo, nome, quantidade]) => ({ tipo, nome, quantidade }));
Object.assign(store.accounts[users[2].accountKey], { faction: 'echossystem', deck: starter,
  collection: Object.fromEntries(starter.map(card => [`${card.tipo}:${card.nome}`, card.quantidade])) });
fs.writeFileSync(file, JSON.stringify(store));
const port = process.env.NAME_GUARD_TEST_PORT || '31979';
const base = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.NAME_GUARD_TEST_OUTPUT || 'output/sindicato/name-guard');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], { windowsHide: true,
  env: { ...process.env, PORT: port, DATA_DIR: dataDir, ADMIN_USERNAMES: 'DuelistaNovo0' }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const errors = [], checks = [];
async function contextFor(user, viewport, extra = {}) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600, ...extra });
  if (user) await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), user.token);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}
async function checkDialog(page, viewport, name) {
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('heading', { level: 1 }).innerText().then(text => text.replace(/\s+/g, ' ').trim()), 'ESSE NOME NÃO É PERMITIDO');
  assert.equal(await dialog.locator('#name-guard-warning').textContent(), 'Infrações desse modo não serão toleradas, troque imediatamente.');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), true, 'Escape não contorna o bloqueio.');
  await page.waitForFunction(() => !game.input.enabled, null, { timeout: 120000 });
  const bounds = await dialog.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, height: node.clientHeight }));
  assert.ok(bounds.scrollWidth <= bounds.width + 1, 'Sem rolagem horizontal.');
  assert.ok(bounds.height >= viewport.height - 2, 'Tela inteira.');
  // Tab e Shift+Tab ficam no diálogo, inclusive depois da última ação.
  for (let index = 0; index < 9; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('.name-guard').contains(document.activeElement)), true);
  }
  await page.locator('.name-guard').evaluate(node => node.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, name + '.png') });
  checks.push(name);
}
(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => { if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
  });
  browser = await chromium.launch({ channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [index, viewport] of [{ width: 1366, height: 768 }, { width: 390, height: 844 }].entries()) {
    const { context, page } = await contextFor(users[index], viewport);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await checkDialog(page, viewport, `legacy-${viewport.width}`);
    await page.getByLabel('NOVO NICK ÚNICO', { exact: true }).fill('PuffDaddy');
    await page.getByLabel('NOVO APELIDO', { exact: true }).fill('Sean Combs');
    await page.getByRole('button', { name: 'CORRIGIR E CONTINUAR' }).click();
    await page.getByText('Esse nome também não é permitido. Escolha outro.').waitFor();
    await page.getByLabel('NOVO NICK ÚNICO', { exact: true }).fill(`DuelistaNovo${index}`);
    await page.getByLabel('NOVO APELIDO', { exact: true }).fill('Nome Permitido');
    await page.getByRole('button', { name: 'CORRIGIR E CONTINUAR' }).click();
    await page.waitForFunction(() => !document.querySelector('.name-guard') && game.input.enabled);
    const saved = await context.request.get(base + '/api/auth/session', { headers: { Authorization: `Bearer ${users[index].token}` } });
    const payload = await saved.json();
    assert.equal(payload.username, `DuelistaNovo${index}`);
    assert.equal(payload.nickname, 'Nome Permitido');
    assert.equal(payload.currency, 875);
    assert.equal(payload.nameRestriction, null);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.cyberduelAccount?.user && game.scene.isActive('CenaTitulo'));
    assert.equal(await page.locator('.name-guard').count(), 0, 'Correção persiste após reload.');
    const before = await page.evaluate(() => JSON.stringify(window.cyberduelAccount.snapshot()));
    const mutations = [];
    const capture = request => { if (request.method() !== 'GET' && /\/api\/(account\/profile|auth\/(local|logout))/.test(request.url())) mutations.push(request.url()); };
    page.on('request', capture);
    await page.evaluate(() => testarNomeCensurado());
    await page.getByRole('button', { name: 'FECHAR TESTE', exact: true }).click();
    await page.evaluate(() => testarNomeCensurado());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.name-guard').count(), 0);
    await page.evaluate(() => testarNomeCensurado());
    await page.getByLabel('NOVO NICK ÚNICO', { exact: true }).fill('NomeSimulado');
    await page.getByLabel('NOVO APELIDO', { exact: true }).fill('Nome Simulado');
    await page.getByRole('button', { name: 'SIMULAR CORREÇÃO' }).click();
    assert.equal(await page.locator('.name-guard').count(), 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.cyberduelAccount.snapshot())), before);
    assert.deepEqual(mutations, [], 'Prévia não altera perfil nem encerra a sessão.');
    page.off('request', capture);
    checks.push(`preview-${viewport.width}`);
    checks.push(`correction-${viewport.width}`);
    await page.evaluate(async () => {
      if (!window.cyberduelAccount.faction) await window.cyberduelAccount.chooseFaction('echossystem');
    });
    await page.getByRole('button', { name: 'CARTEIRINHA', exact: true }).click();
    await page.getByLabel('Apelido', { exact: true }).fill('ɛpstein');
    await page.getByRole('button', { name: 'Fechar carteirinha', exact: true }).click();
    await page.locator('.profile-screen').getByText('Nome inválido', { exact: true }).waitFor();
    assert.equal(await page.locator('.name-guard').count(), 0, 'Editar com nome inválido não abre a tela vermelha.');
    const unchanged = await context.request.get(base + '/api/auth/session', { headers: { Authorization: `Bearer ${users[index].token}` } });
    assert.equal((await unchanged.json()).nickname, 'Nome Permitido');
    await page.getByLabel('Apelido', { exact: true }).fill('Nome Permitido');
    await page.getByRole('button', { name: 'Fechar carteirinha', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.profile-screen'));
    checks.push(`profile-inline-error-${viewport.width}`);
    console.log(`OK ${viewport.width}px: bloqueio de conta antiga, novo nome recusado, correção e persistência.`);
    await context.close();
  }
  // Sessão antiga em memória: o servidor já aplica a nova política, o cliente ainda não verificou.
  const viewport = { width: 1366, height: 768 };
  const { context, page } = await contextFor(users[2], viewport, { reducedMotion: 'reduce' });
  await context.route('**/api/auth/session', async route => {
    const response = await route.fetch();
    const payload = await response.json();
    await route.fulfill({ response, json: { ...payload, nickname: 'Nome antigo em memória', nameRestriction: null } });
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.cyberduelAccount?.user && game.scene.isActive('CenaTitulo'), null, { timeout: 120000 });
  await page.evaluate(async () => {
    // Uma cena de duelo real, sem iniciar recompensas de uma partida de teste.
    window.cyberduelNameGuard.close();
    window.cyberduelAccount.nameRestriction = null;
    window.cyberduelSettings.set('skipBattleAnnouncements', 1);
    game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true });
  });
  await page.waitForFunction(() => game.scene.isActive('CenaJogo'));
  await context.unroute('**/api/auth/session');
  // Exercita o timer real usado também enquanto a partida está aberta.
  await page.waitForFunction(() => document.querySelector('.name-guard'), null, { timeout: 20000 });
  await checkDialog(page, viewport, 'active-duel');
  assert.equal(await page.locator('.name-guard').evaluate(node => getComputedStyle(node).animationName), 'none', 'Movimento reduzido respeitado.');
  assert.equal(await page.getByLabel('NOVO NICK ÚNICO', { exact: true }).count(), 0);
  await page.getByLabel('NOVO APELIDO', { exact: true }).fill('Duelista Regular');
  await page.getByRole('button', { name: 'CORRIGIR E CONTINUAR' }).click();
  await page.waitForFunction(() => !document.querySelector('.name-guard') && game.input.enabled);
  assert.equal(await page.evaluate(() => game.scene.isActive('CenaJogo')), true, 'Duelo continua após corrigir o apelido.');
  checks.push('active-duel-corrected');
  await context.close();
  // Tentativas novas inválidas só mostram erro embaixo do campo.
  const anonymous = await contextFor(null, { width: 390, height: 844 });
  await anonymous.page.goto(base, { waitUntil: 'domcontentloaded' });
  await anonymous.page.getByLabel('Nome para teste local').waitFor({ timeout: 120000 });
  await anonymous.page.getByLabel('Nome para teste local').fill('P_Diddy');
  await anonymous.page.getByRole('button', { name: 'ENTRAR LOCALMENTE' }).click();
  await anonymous.page.getByText('Nome inválido', { exact: true }).waitFor();
  assert.equal(await anonymous.page.locator('.name-guard').count(), 0);
  await anonymous.page.getByLabel('Nome para teste local').fill('NomeLocalNovo');
  await anonymous.page.getByRole('button', { name: 'ENTRAR LOCALMENTE' }).click();
  await anonymous.page.waitForFunction(() => !document.querySelector('.name-guard') && window.cyberduelAccount.user === 'local_NomeLocalNovo');
  checks.push('local-rejected-and-corrected');
  await anonymous.context.close();
  const tutorial = await contextFor(users[3], { width: 390, height: 844 });
  await tutorial.page.goto(base, { waitUntil: 'domcontentloaded' });
  await tutorial.page.getByLabel('Seu apelido', { exact: true }).waitFor({ timeout: 120000 });
  await tutorial.page.getByLabel('Seu apelido', { exact: true }).fill('ɛpstein');
  await tutorial.page.locator('.elenai-name-form button').click();
  await tutorial.page.getByText('Nome inválido', { exact: true }).waitFor();
  assert.equal(await tutorial.page.locator('.name-guard').count(), 0);
  const belowInput = await tutorial.page.evaluate(() => document.querySelector('.elenai-error').getBoundingClientRect().top >=
    document.querySelector('.elenai-name-form input').getBoundingClientRect().bottom);
  assert.equal(belowInput, true, 'Mensagem abaixo do campo.');
  await tutorial.page.getByLabel('Seu apelido', { exact: true }).fill('Aprendiz Novo');
  await tutorial.page.locator('.elenai-name-form button').click();
  await tutorial.page.waitForFunction(() => !document.querySelector('.name-guard') &&
    !document.querySelector('.elenai-name-form') && window.cyberduelAccount.tutorial.named);
  assert.equal(await tutorial.page.evaluate(() => window.cyberduelAccount.nickname), 'Aprendiz Novo');
  checks.push('tutorial-name-corrected');
  await tutorial.context.close();
  const registration = await contextFor(users[4], { width: 390, height: 844 });
  await registration.page.goto(base, { waitUntil: 'domcontentloaded' });
  await registration.page.getByLabel('Nick único', { exact: true }).waitFor({ timeout: 120000 });
  await registration.page.getByLabel('Nick único', { exact: true }).fill('zzEpsteinzz');
  await registration.page.locator('[data-kind="registration"]').getByRole('button', { name: 'CONTINUAR', exact: true }).click();
  await registration.page.getByText('Nome inválido', { exact: true }).waitFor();
  assert.equal(await registration.page.locator('.name-guard').count(), 0);
  await registration.page.getByLabel('Nick único', { exact: true }).fill('NovoCadastroQA');
  await registration.page.locator('[data-kind="registration"]').getByRole('button', { name: 'CONTINUAR', exact: true }).click();
  await registration.page.waitForFunction(() => window.cyberduelAccount.user === 'NovoCadastroQA');
  checks.push('registration-inline-error');
  await registration.context.close();
  // Duas contas distintas: o comando administrativo afeta apenas o destinatário.
  const admin = await contextFor(users[0], { width: 1366, height: 768 });
  const target = await contextFor(users[1], { width: 390, height: 844 });
  for (const client of [admin, target]) {
    await client.page.goto(base, { waitUntil: 'domcontentloaded' });
    await client.page.waitForFunction(() => window.cyberduelAccount?.user && game.scene.isActive('CenaTitulo'), null, { timeout: 120000 });
  }
  await target.page.evaluate(() => new Promise(resolve => window.cyberduelMultiplayer.findActiveMatch(resolve)));
  await target.page.evaluate(() => testarNomeCensurado());
  const result = await admin.page.evaluate(() => exigirTrocaDeNome('DuelistaNovo1'));
  assert.match(result, /DuelistaNovo1/);
  await target.page.waitForFunction(() => document.querySelector('.name-guard') && !window.cyberduelNameGuard.preview);
  assert.equal(await target.page.getByRole('button', { name: 'FECHAR TESTE', exact: true }).count(), 0);
  await target.page.keyboard.press('Escape');
  assert.equal(await target.page.getByRole('alertdialog').isVisible(), true);
  assert.equal(await admin.page.locator('.name-guard').count(), 0, 'Administrador não recebe a tela do alvo.');
  await target.page.getByLabel('NOVO APELIDO', { exact: true }).fill('Nome Permitido');
  await target.page.getByRole('button', { name: 'CORRIGIR E CONTINUAR' }).click();
  await target.page.getByText('Esse nome também não é permitido. Escolha outro.').waitFor();
  await target.page.getByLabel('NOVO APELIDO', { exact: true }).fill('Apelido Após Aviso');
  await target.page.getByRole('button', { name: 'CORRIGIR E CONTINUAR' }).click();
  await target.page.waitForFunction(() => !document.querySelector('.name-guard'));
  checks.push('admin-targeted-name-change');
  await admin.context.close();
  await target.context.close();
  assert.deepEqual(errors, []);
  console.log(`${checks.length} verificações de censura de nomes aprovadas; sem erros JavaScript.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  server.kill();
});
