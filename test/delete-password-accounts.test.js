const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-delete-'));
const run = () => spawnSync(process.execPath, ['server/delete-password-accounts.js'], {
  env: { ...process.env, DATA_DIR: directory }, encoding: 'utf8',
});
try {
  const [google, legacy] = require('./account-fixture')(directory, ['Google', 'Senha']);
  const accountsFile = path.join(directory, 'accounts.json');
  const sessionsFile = path.join(directory, 'sessions.json');
  const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
  delete accounts.accounts[legacy.accountKey].googleSub;
  accounts.accounts[legacy.accountKey].passwordHash = 'hash-antigo';
  accounts.accounts[google.accountKey].collection = { 'monstro:O Rato': 2 };
  accounts.accounts[google.accountKey].deck = [{ tipo: 'monstro', nome: 'O Rato', quantidade: 2 }];
  accounts.accounts[google.accountKey].currency = 321;
  accounts.accounts[google.accountKey].rating = 1234;
  fs.writeFileSync(accountsFile, JSON.stringify(accounts));
  const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  const hash = token => createHash('sha256').update(token).digest('hex');
  const googleSession = sessions.sessions[hash(google.token)];
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 contas de senha e 1 sessões/);
  assert.deepEqual(JSON.parse(fs.readFileSync(accountsFile, 'utf8')).accounts, { [google.accountKey]: accounts.accounts[google.accountKey] });
  assert.deepEqual(JSON.parse(fs.readFileSync(sessionsFile, 'utf8')).sessions, { [hash(google.token)]: googleSession });
  assert.equal(JSON.parse(fs.readFileSync(sessionsFile, 'utf8')).sessions[hash(legacy.token)], undefined);
  const saved = fs.readFileSync(accountsFile, 'utf8');
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(accountsFile, 'utf8'), saved, 'Repetir o comando preserva os dados.');
  fs.writeFileSync(sessionsFile, '{invalido');
  assert.notEqual(run().status, 0);
  assert.equal(fs.readFileSync(accountsFile, 'utf8'), saved, 'Arquivo inválido não deve causar gravação parcial.');
  console.log('Exclusão manual: contas/sessões de senha removidas, progresso Google preservado e repetição segura.');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
