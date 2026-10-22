function onlineRewards(room) {
  const accounts = [room.accounts.get(1), room.accounts.get(2)];
  const winner = room.result?.resultadoCombate?.resultado;
  if (room.debugFinal || !room.state?.partidaEncerrada || !room.result?.fimDeJogo ||
      !["jogador", "inimigo"].includes(winner) || !accounts.every(Boolean) ||
      accounts[0] === accounts[1] || (!room.ranked && !room.presentation)) return [0, 0];

  const identities = accounts.map(account => account.googleSub || account.username);
  if (identities[0] === identities[1]) return [0, 0];
  const [win, loss] = room.table === 5 ? [100, 50] : room.presentation ? [50, 25] : [20, 10];
  const rewards = winner === "jogador" ? [win, loss] : [loss, win];
  if ([1, 2].includes(room.surrenderedBy) && room.round >= 1 && room.round <= 3) {
    const index = room.surrenderedBy - 1;
    const history = accounts[index].earlySurrenders ||= [];
    let entry = history.find(match => match.opponent === identities[1 - index]);
    if (!entry) {
      entry = { opponent: identities[1 - index], count: 0 };
      history.push(entry);
    }
    const now = Date.now();
    if (!Number.isFinite(entry.lastSurrenderAt) || now - entry.lastSurrenderAt >= 30 * 60 * 1000) {
      entry.count = 0;
    }
    const divisor = 2 ** entry.count;
    entry.count++;
    entry.lastSurrenderAt = now;
    return rewards.map(amount => Math.floor(amount / divisor));
  }
  return rewards;
}

module.exports = { onlineRewards };
