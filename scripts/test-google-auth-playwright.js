const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { generateKeyPairSync, sign } = require('node:crypto');
const { chromium } = require('playwright');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-mobile-auth-'));
const base = 'http://localhost:32148';
const clientId = 'mobile-test.apps.googleusercontent.com';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const preload = path.join(dataDir, 'certificates.cjs');
// Apenas os certificados e a tela do provedor são simulados; JWT, cookies e backend são reais.
fs.writeFileSync(preload, `const {OAuth2Client}=require(${JSON.stringify(require.resolve('google-auth-library'))});
OAuth2Client.prototype.getFederatedSignonCertsAsync=async()=>({certs:{test:${JSON.stringify(keys.publicKey.export({ type: 'spki', format: 'pem' }))}}});`);
const server = spawn(process.execPath, ['--require', preload, 'server/server.js'], {
  env: { ...process.env, PORT: '32148', DATA_DIR: dataDir, PUBLIC_URL: base, GOOGLE_CLIENT_ID: clientId },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const checks = [], errors = [];
let browser;

function credential(nonce, subject) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: clientId,
    sub: subject, iat: now, exp: now + 3600, nonce })).toString('base64url');
  const signed = `${header}.${payload}`;
  return `${signed}.${sign('RSA-SHA256', Buffer.from(signed), keys.privateKey).toString('base64url')}`;
}

(async () => {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 10000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
    server.once('exit', () => { clearTimeout(timer); reject(Error('Servidor encerrou')); });
  });
  browser = await chromium.launch();
  for (const [device, userAgent] of [
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'],
    ['Android', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'],
  ]) {
    const context = await browser.newContext({ userAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/js/')) responses.push({ route: url.pathname, status: response.status() });
    });
    await context.route(base + '/**', async route => {
      if (new URL(route.request().url()).pathname !== '/') return route.continue();
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body><div id="login"></div>
        <script>window.google={accounts:{id:{initialize(config){window.qaGoogleConfig=config},
          renderButton(node){document.cookie='g_csrf_token=qa-csrf; Secure; SameSite=None; Path=/';
            const button=document.createElement('button');button.textContent='Entrar com Google (QA)';
            button.onclick=()=>location.assign('https://accounts.google.com/cyberduel-qa');node.replaceChildren(button)}}}};</script>
        <script src="/js/server-url.js"></script><script src="/js/account.js"></script>
        <script>window.addEventListener('load',async()=>{await cyberduelAccount.restore();
          if(!cyberduelAccount.user)await cyberduelAccount.mountGoogleButton(document.getElementById('login'),error=>{throw error})});</script>
      </body></html>` });
    });
    const returnTo = base + '/?quality=mobile&room=123456&seat=2&ticket=convite';
    await page.goto(returnTo);
    const button = page.getByRole('button', { name: 'Entrar com Google (QA)' });
    await button.waitFor();
    const config = await page.evaluate(() => ({ mode: qaGoogleConfig.ux_mode, nonce: qaGoogleConfig.nonce, uri: qaGoogleConfig.login_uri }));
    assert.equal(config.mode, 'redirect');
    assert.equal(config.uri, base + '/api/auth/google/callback');
    const attempt = (await context.cookies()).find(cookie => cookie.name === 'cyberduel.google.login');
    assert.ok(attempt?.httpOnly && attempt.secure && attempt.sameSite === 'None');
    const token = credential(config.nonce, 'qa-' + device);
    await context.route('https://accounts.google.com/cyberduel-qa', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <form method="post" action="${config.uri}"><input name="credential" value="${token}"><input name="g_csrf_token" value="qa-csrf"></form>
      <script>document.forms[0].submit()</script>` }));
    // O retorno 303 carrega o jogo real; Playwright só roteia o início de uma cadeia de redirects.
    await context.unroute(base + '/**');
    await button.click();
    await page.waitForFunction(() => window.cyberduelAccount?.user && !sessionStorage.getItem('cyberduel.google.redirect'), null, { timeout: 120000 }).catch(async error => {
      console.error(device, responses, errors, await page.evaluate(() => ({
        url: location.href, state: document.readyState, scripts: [...document.scripts].map(s => s.src),
        accountLoaded: Boolean(window.cyberduelAccount), user: Boolean(window.cyberduelAccount?.user),
        text: document.body?.innerText,
      })));
      throw error;
    });
    assert.equal(page.url(), returnTo, 'Retorno preserva todos os parâmetros do convite.');
    assert.match(await page.evaluate(() => localStorage.getItem('cyberduel.account.token.v1')), /^[a-f0-9]{64}$/);
    assert.equal((await context.cookies()).some(cookie => cookie.name === 'cyberduel.google.login'), false);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.cyberduelAccount?.user), null, { timeout: 120000 });
    checks.push(device + ': POST de outra origem, cookies Secure/HttpOnly, CSRF, retorno à aba, sessão e recarga');
    console.log(checks.at(-1));
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Login móvel aprovado no Chromium com provedor simulado e validação real dos tokens.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  const ended = new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  server.kill(); await ended;
  fs.rmSync(dataDir, { recursive: true, force: true });
});
