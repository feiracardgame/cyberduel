const { randomInt } = require('node:crypto');

function rankName(rating) {
  return rating >= 1600 ? 'Diamante' : rating >= 1400 ? 'Ouro' : rating >= 1200 ? 'Prata' : 'Bronze';
}

function playerProfile(account) {
  const rating = account?.rating ?? 1000;
  return { nickname: account?.nickname || account?.username || 'Duelista', avatar: account?.avatar || '',
    rating, rank: rankName(rating) };
}

function chooseOpponent(entry, entries, now = Date.now(), draw = randomInt) {
  const candidates = entries.filter(other => other.username !== entry.username &&
    Math.abs(other.rating - entry.rating) <= 200 + Math.floor((now - Math.min(entry.since, other.since)) / 15000) * 100);
  return candidates.length ? candidates[draw(candidates.length)] : null;
}

function applyResult(first, second, winner) {
  const expected = 1 / (1 + 10 ** ((second.rating - first.rating) / 400));
  const score = winner === 'empate' ? 0.5 : winner === 'jogador' ? 1 : 0;
  const delta = Math.round(32 * (score - expected));
  first.rating = Math.max(0, first.rating + delta);
  second.rating = Math.max(0, second.rating - delta);
  for (const [account, side] of [[first, 'jogador'], [second, 'inimigo']]) {
    account.rankedGames++;
    if (winner === side) account.rankedWins++;
    else if (winner !== 'empate') account.rankedLosses++;
  }
}

module.exports = { playerProfile, chooseOpponent, applyResult };
