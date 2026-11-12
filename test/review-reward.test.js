const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-review-'));
const users = require('./account-fixture')(dir, ['ReviewRasp', 'ReviewEcho']);
let server;
async function start() {
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: '32150', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Servidor não iniciou.')), 5000);
    server.stdout.on('data', chunk => {
      if (String(chunk).includes('ouvindo')) { clearTimeout(timer); resolve(); }
    });
    server.once('error', reject);
  });
}
async function stop() {
  if (!server) return;
  const exited = once(server, 'exit'); server.kill(); await exited; server = null;
}
async function api(user, route, body) {
  const response = await fetch(`http://127.0.0.1:32150/api/${route}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
async function play(user, result) {
  const start = await api(user, 'account/match-start', { mode: 'solo' });
  assert.equal(start.status, 200);
  const body = { matchId: start.body.matchId, result };
  const finished = await api(user, 'account/match-complete', body);
  assert.equal(finished.status, 200);
  assert.deepEqual(await api(user, 'account/match-complete', body), finished, 'Repetição não conta outra partida.');
  return finished.body;
}

(async () => {
  await start();
  assert.equal((await api(null, 'account/review', { action: 'claim' })).status, 401);
  assert.equal((await api(users[0], 'account/review', { action: 'claim' })).status, 409);
  assert.equal((await api(users[0], 'account/review', { action: 'invalid' })).status, 400);
  for (const [index, faction] of ['raspcorp', 'echossystem'].entries()) {
    const user = users[index];
    const initial = (await api(user, 'account/faction', { faction })).body;
    assert.equal(initial.review.due, false);
    assert.equal((await play(user, 'jogador')).review.due, false);
    assert.equal((await api(user, 'account/review', { action: 'claim' })).status, 409);
    assert.equal((await play(user, 'inimigo')).review.due, true, 'Vitória e derrota contam igualmente.');
    const skipped = await api(user, 'account/review', { action: 'dismiss' });
    assert.equal(skipped.status, 200);
    assert.equal(skipped.body.review.due, false);
    await stop(); await start();
    assert.equal((await api(user, 'auth/session')).body.review.due, false, 'Adiamento persiste no servidor.');
    assert.equal((await play(user, 'inimigo')).review.due, false);
    const before = await play(user, 'jogador');
    assert.equal(before.review.due, true, 'O convite volta após mais duas partidas.');
    const blocked = path.join(dir, `accounts.json.${server.pid}.tmp`);
    fs.mkdirSync(blocked);
    assert.equal((await api(user, 'account/review', { action: 'claim' })).status, 500);
    const failed = (await api(user, 'auth/session')).body;
    assert.equal(failed.review.clicked, false);
    assert.deepEqual(failed.boosters, before.boosters, 'Falha de gravação desfaz o prêmio em memória.');
    fs.rmdirSync(blocked);
    const claims = await Promise.all([api(user, 'account/review', { action: 'claim' }), api(user, 'account/review', { action: 'claim' })]);
    assert.deepEqual(claims[0], claims[1], 'Duas abas recebem a mesma confirmação.');
    const claimed = claims[0].body;
    assert.equal(claims[0].status, 200);
    assert.deepEqual(claimed.review, { clicked: true, due: false });
    assert.equal(claimed.currency, before.currency, 'O prêmio não cobra tijolinhos.');
    assert.deepEqual(claimed.collection, before.collection);
    assert.equal(claimed.boosters.length, before.boosters.length + 1);
    const pack = claimed.boosters.find(pack => pack.id.startsWith('review-'));
    assert.equal(pack.faction, faction === 'raspcorp' ? 'echossystem' : 'raspcorp');
    assert.equal(pack.cards, undefined, 'Cartas fechadas não são expostas.');
    await stop(); await start();
    assert.equal((await api(user, 'auth/session')).body.review.clicked, true);
    assert.equal((await play(user, 'inimigo')).review.due, false);
    assert.equal((await play(user, 'jogador')).review.due, false, 'Não convida novamente após o clique.');
    const opened = await api(user, 'boosters/open', { packId: pack.id });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.cards.length, 5);
    assert.equal((await api(user, 'account/review', { action: 'claim' })).body.boosters.length, before.boosters.length,
      'Abrir o pacote não permite resgatá-lo novamente.');
    assert.deepEqual((await api(user, 'boosters/open', { packId: pack.id })).body.collection, opened.body.collection);
  }
  console.log('Avaliação: duas partidas, adiamento, duas facções, prêmio único, concorrência, persistência e falha de gravação validados.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await stop(); fs.rmSync(dir, { recursive: true, force: true });
});
