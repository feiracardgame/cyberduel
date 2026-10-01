const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const accountsFile = path.join(directory, 'accounts.json');
const sessionsFile = path.join(directory, 'sessions.json');
const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
const sessions = fs.existsSync(sessionsFile)
  ? JSON.parse(fs.readFileSync(sessionsFile, 'utf8'))
  : { version: 1, sessions: {} };

for (const [store, key] of [[accounts, 'accounts'], [sessions, 'sessions']]) {
  if (!store[key] || typeof store[key] !== 'object' || Array.isArray(store[key]) ||
      Object.values(store[key]).some(value => !value || typeof value !== 'object' || Array.isArray(value)))
    throw new Error(`Arquivo de ${key} inválido; nenhum dado foi alterado.`);
}

const legacy = Object.keys(accounts.accounts).filter(key => !accounts.accounts[key].googleSub);
for (const key of legacy) delete accounts.accounts[key];
let removedSessions = 0;
for (const [key, session] of Object.entries(sessions.sessions)) {
  if (!Object.hasOwn(accounts.accounts, session.accountKey)) {
    delete sessions.sessions[key];
    removedSessions++;
  }
}

// Execute com o backend parado para não concorrer com a gravação de contas e sessões.
for (const [file, store, changed] of [[accountsFile, accounts, legacy.length], [sessionsFile, sessions, removedSessions]]) {
  if (!changed) continue;
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
console.log(`Removidas ${legacy.length} contas de senha e ${removedSessions} sessões. Contas Google preservadas.`);
