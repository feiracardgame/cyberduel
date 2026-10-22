const assert = require('node:assert/strict');
const { onlineRewards } = require('../server/match-rewards');

const accounts = () => [{ username: 'One', googleSub: 'google-one' }, { username: 'Two', googleSub: 'google-two' }];
function match(players = accounts(), patch = {}) {
  return {
    accounts: new Map([[1, players[0]], [2, players[1]]]), ranked: true, round: 1,
    state: { partidaEncerrada: true },
    result: { fimDeJogo: true, resultadoCombate: { resultado: 'jogador' } }, ...patch,
  };
}

for (const [mode, expected] of [
  [{}, [20, 10]],
  [{ ranked: false, presentation: true }, [50, 25]],
  [{ ranked: true, presentation: true, table: 1 }, [50, 25]],
  [{ ranked: true, presentation: true, table: 5 }, [100, 50]],
]) {
  const players = accounts();
  for (let repetition = 0; repetition < 9; repetition++) {
    const expectedReward = expected.map(amount => Math.floor(amount / 2 ** repetition));
    assert.deepEqual(onlineRewards(match(players, { ...mode, surrenderedBy: 2 })), expectedReward);
  }
  assert.deepEqual(onlineRewards(match(players, mode)), expected, 'Combate normal paga integral, mesmo após zerar por desistências.');
  assert.deepEqual(onlineRewards(match(players, { ...mode, surrenderedBy: 2, round: 4 })), expected, 'Após o terceiro turno não há desconto.');
  assert.equal(players[1].earlySurrenders[0].count, 9, 'Combate normal e desistência tardia não alteram o contador.');
}

for (const round of [1, 2, 3]) {
  const players = accounts();
  assert.deepEqual(onlineRewards(match(players, { round, surrenderedBy: 2 })), [20, 10]);
  assert.deepEqual(onlineRewards(match(players, { round, surrenderedBy: 2 })), [10, 5], 'Os três primeiros turnos incluem o terceiro.');
}
for (const patch of [
  { debugFinal: true, surrenderedBy: 2 }, { ranked: false, surrenderedBy: 2 },
  { state: { partidaEncerrada: false } },
  { result: { fimDeJogo: true, resultadoCombate: { resultado: 'empate' } } },
]) {
  const players = accounts();
  assert.deepEqual(onlineRewards(match(players, patch)), [0, 0]);
  assert.ok(players.every(account => !account.earlySurrenders), 'Partida sem recompensa não registra desistência.');
}
const one = accounts()[0];
assert.deepEqual(onlineRewards(match([one, one])), [0, 0]);
assert.deepEqual(onlineRewards(match([{ ...one }, { ...one }])), [0, 0]);
assert.deepEqual(onlineRewards(match([one, undefined])), [0, 0]);

let players = accounts();
assert.deepEqual(onlineRewards(match(players, { surrenderedBy: 2, round: 4 })), [20, 10]);
assert.deepEqual(onlineRewards(match(players, { surrenderedBy: 2 })), [20, 10], 'Desistência tardia anterior não conta como repetição precoce.');
players = JSON.parse(JSON.stringify(players));
players[1].username = 'Renamed';
const reversed = match([...players].reverse(), { surrenderedBy: 1, presentation: true, table: 5 });
reversed.result.resultadoCombate.resultado = 'inimigo';
assert.deepEqual(onlineRewards(reversed), [25, 50], 'Repetição persiste entre modalidades, lugares, nomes e reinício.');
assert.deepEqual(onlineRewards(match(players, { surrenderedBy: 2 })), [5, 2], 'Cada repetição divide novamente, inclusive após trocar modalidade.');
assert.deepEqual(onlineRewards(match([players[0], { username: 'Three', googleSub: 'google-three' }], { surrenderedBy: 2 })), [20, 10], 'Outro adversário tem contador separado.');
const opposite = match(players, { surrenderedBy: 1 });
opposite.result.resultadoCombate.resultado = 'inimigo';
assert.deepEqual(onlineRewards(opposite), [10, 20], 'A primeira desistência da outra conta tem contador próprio.');
const realNow = Date.now;
let now = realNow();
Date.now = () => now;
try {
  const timedPlayers = accounts();
  const surrender = () => onlineRewards(match(timedPlayers, { surrenderedBy: 2 }));
  assert.deepEqual(surrender(), [20, 10]);
  now += 30 * 60 * 1000 - 1;
  assert.deepEqual(surrender(), [10, 5], 'Antes de 30 minutos a punição continua e renova o prazo.');
  const restored = JSON.parse(JSON.stringify(timedPlayers));
  now += 30 * 60 * 1000;
  assert.deepEqual(onlineRewards(match(restored, { surrenderedBy: 2 })), [20, 10], 'Após 30 minutos da última desistência a punição expira, inclusive depois de reiniciar.');
  assert.equal(restored[1].earlySurrenders[0].count, 1);
  restored[1].earlySurrenders = [{ opponent: restored[0].googleSub, count: 99 }];
  assert.deepEqual(onlineRewards(match(restored, { surrenderedBy: 2 })), [20, 10], 'Histórico antigo sem data não mantém punição permanente.');
} finally {
  Date.now = realNow;
}
console.log('Recompensas: redução sucessiva, expiração em 30 minutos, modalidades e persistência validadas.');
