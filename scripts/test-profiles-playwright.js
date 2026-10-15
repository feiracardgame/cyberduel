const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-profiles-'));
const [fixture] = require('../test/account-fixture')(dataDir, ['ProfilesQA']);
const accountsPath = path.join(dataDir, 'accounts.json');
const accounts = JSON.parse(fs.readFileSync(accountsPath));
Object.assign(accounts.accounts[fixture.accountKey], {
  tutorial: { introSeen: true, named: true, wantsTutorial: false, farewellSeen: true, completed: true, seen: [] },
});
fs.writeFileSync(accountsPath, JSON.stringify(accounts));
const output = path.resolve('output/sindicato/profiles');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/dev-server.js'], {
  windowsHide: true, env: { ...process.env, PORT: '31976', DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
const errors = [], checks = [];

async function run() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', data => {
      if (String(data).includes('ouvindo')) { clearTimeout(timer); resolve(); }
    });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(Error(`Servidor encerrou: ${code}`)); });
  });
  browser = await chromium.launch({
    channel: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width === 390 });
    await context.addInitScript(token => localStorage.setItem('cyberduel.account.token.v1', token), fixture.token);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && /\/assets\/(profiles|fotosdeperfil)\//.test(response.url()))
        errors.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => {
      if (/\/assets\/(profiles|fotosdeperfil)\//.test(request.url()))
        errors.push(`${request.failure()?.errorText} ${request.url()}`);
    });
    await page.goto('http://127.0.0.1:31976', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof game !== 'undefined' && game.scene.isActive('CenaTitulo') &&
      window.cyberduelAccount?.user && !game.scene.getScene('CenaTitulo').restaurandoConta, null, { timeout: 120000 });
    if (!await page.evaluate(() => window.cyberduelAccount.faction)) {
      await page.locator('.title-faction--raspcorp').click();
      await page.waitForFunction(() => window.cyberduelAccount.faction === 'raspcorp' && !document.querySelector('.title-modal'));
    }
    console.log(`Navegador pronto: ${viewport.width}px`);
    const photos = await page.evaluate(() => window.cyberduelAccount.profilePhotos);
    const portraits = await page.evaluate(() => ({ ...PERSONAGENS_DUELO_POR_AVATAR }));
    // A galeria inteira precisa de bustos próprios, inclusive os arquivos com "profille".
    portraits['assets/fotosdeperfil/diego_icon.png'] = 'assets/profiles/diego_profille.png';
    portraits['assets/fotosdeperfil/advogado_icon.png'] = 'assets/profiles/advogado_profille.png';
    assert.deepEqual(Object.keys(portraits).sort(), [...photos].sort());
    const ordered = [...photos].sort((a, b) => Number(b.includes('diego')) - Number(a.includes('diego')));
    for (const avatar of ordered) {
      const name = path.basename(avatar, '_icon.png');
      await page.getByRole('button', { name: 'CARTEIRINHA', exact: true }).click();
      await page.getByRole('button', { name: 'Trocar foto de perfil', exact: true }).click();
      const option = page.getByRole('button', { name: `Usar foto: ${name.replaceAll('_', ' ')}`, exact: true });
      await option.click();
      await page.waitForFunction(avatar => {
        const image = document.querySelector('.profile-avatar img');
        return image?.getAttribute('src') === avatar && image.complete && image.naturalWidth > 0;
      }, avatar);
      await page.getByRole('button', { name: 'Fechar carteirinha', exact: true }).click();
      await page.waitForFunction(avatar => !document.querySelector('.profile-screen') && window.cyberduelAccount.avatar === avatar, avatar);
      const saved = await context.request.get('http://127.0.0.1:31976/api/auth/session', {
        headers: { Authorization: `Bearer ${fixture.token}` },
      });
      assert.equal(saved.ok(), true);
      assert.equal((await saved.json()).avatar, avatar, `${name}: persistência no servidor`);
      await page.evaluate(() => {
        window.cyberduelSettings.set('skipBattleAnnouncements', 1);
        game.scene.getScene('CenaTitulo').scene.start('CenaJogo', { debug: true });
      });
      await page.waitForFunction(expected => {
        const scene = game.scene.getScene('CenaJogo');
        const portrait = scene.children.list.find(object => object.name === 'personagem-jogador');
        return game.scene.isActive('CenaJogo') && portrait?.texture?.key === expected &&
          portrait.visible && scene.cameras.main.alpha === 1;
      }, `personagem:${portraits[avatar]}`);
      // Exercita os dois lugares do duelo usando o mesmo renderizador dos perfis remotos.
      for (const player of [1, 2]) {
        const rendered = await page.evaluate(({ avatar, player }) => {
          const scene = game.scene.getScene('CenaJogo');
          const original = { multiplayer: scene.multiplayer, multiplayerAtivo: scene.multiplayerAtivo };
          try {
            scene.multiplayerAtivo = true;
            scene.multiplayer = Object.assign(Object.create(scene.multiplayer), {
              player, profiles: { 1: { avatar }, 2: { avatar } },
            });
            scene.carregarRetratosDuelo();
            scene.desenharInterface();
            return ['jogador', 'inimigo'].map(side => {
              const image = scene.children.list.find(object => object.name === `personagem-${side}`);
              const source = image?.texture?.getSourceImage();
              return { key: image?.texture?.key, visible: image?.visible, width: source?.naturalWidth,
                height: source?.naturalHeight, displayWidth: image?.displayWidth };
            });
          } finally { Object.assign(scene, original); }
        }, { avatar, player });
        for (const image of rendered) {
          assert.equal(image.key, `personagem:${portraits[avatar]}`);
          assert.equal(image.visible, true);
          assert.ok(image.width > 0 && image.height > 0 && image.displayWidth > 0);
        }
      }
      await page.screenshot({ path: path.join(output, `${viewport.width}-${name}.png`) });
      checks.push({ viewport: viewport.width, avatar, portrait: portraits[avatar], saved: true, solo: true, remoteSlots: [1, 2] });
      console.log(`OK ${viewport.width}px: ${name} — galeria, gravação, solo e dois lugares remotos`);
      await page.evaluate(() => game.scene.getScene('CenaJogo').scene.start('CenaTitulo'));
      await page.waitForFunction(() => game.scene.isActive('CenaTitulo') && !game.scene.getScene('CenaTitulo').restaurandoConta);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(avatar => window.cyberduelAccount?.avatar === avatar && game.scene.isActive('CenaTitulo'), ordered.at(-1));
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(`${checks.length} verificações de perfil aprovadas; nenhum erro de JavaScript ou de assets de perfil.`);
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser?.close();
  server.kill();
});
