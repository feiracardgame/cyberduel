const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

// Prepara contas Google e sessões no diretório temporário, sem abrir uma rota de teste no servidor.
module.exports = function seedAccounts(directory, usernames) {
  const accounts = {}, sessions = {};
  const users = usernames.map(username => {
    const token = randomBytes(32).toString('hex');
    const accountKey = `fixture_${username.toLocaleLowerCase('pt-BR')}`;
    accounts[accountKey] = { username, nickname: username, googleSub: `test-${accountKey}` };
    sessions[createHash('sha256').update(token).digest('hex')] = {
      accountKey, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    return { username, token, accountKey };
  });
  fs.writeFileSync(path.join(directory, 'accounts.json'), JSON.stringify({ version: 1, accounts }));
  fs.writeFileSync(path.join(directory, 'sessions.json'), JSON.stringify({ version: 1, sessions }));
  return users;
};
