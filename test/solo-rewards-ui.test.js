const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Game = vm.runInContext('CenaJogo', context);
const flush = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  let payments = 0;
  context.window.cyberduelAccount = {
    async recordMatch(id, result) { payments++; assert.equal(id, 'solo-id'); assert.equal(result, 'jogador'); return 10; },
  };
  const result = { fimDeJogo: true, resultadoCombate: { resultado: 'jogador' }, resultadoRodada: { vencedor: 'jogador' } };
  const scene = Object.assign(Object.create(Game.prototype), {
    soloMatchStart: Promise.resolve({ matchId: 'solo-id' }), soloStep: 3, soloStarter: 1,
    partida: { fimTurno: () => result },
    apresentarEventosEfeito() {}, efeitosOponentePendentes: () => false,
    mostrarBannerRodada() {},
    desenharInterface() { throw Error('A interface não pode controlar o crédito.'); },
  });
  scene.avancarFaseSolo();
  await flush();
  assert.equal(payments, 1, 'Paga mesmo sem a animação da rodada terminar ou a tela final abrir.');
  assert.equal(scene.recompensaRecebida, 10);
  assert.equal(scene.partidaRegistradaNaConta, true);
  assert.equal(await scene.registrarRecompensaSolo(result.resultadoCombate), 10);
  assert.equal(payments, 1, 'Abrir a tela final não registra nem paga uma segunda vez.');

  let finish;
  context.window.cyberduelAccount.recordMatch = () => new Promise(resolve => { finish = resolve; payments++; });
  const concurrent = Object.assign(Object.create(Game.prototype), { soloMatchStart: Promise.resolve({ matchId: 'solo-id' }) });
  const first = concurrent.registrarRecompensaSolo(result.resultadoCombate);
  const second = concurrent.registrarRecompensaSolo(result.resultadoCombate);
  await flush();
  assert.equal(first, second, 'Duas chamadas compartilham o mesmo pagamento pendente.');
  finish(10); await first;
  assert.equal(payments, 2);

  let starts = 0, attempts = 0;
  context.window.cyberduelAccount.startSoloMatch = async () => { starts++; return 'retry-id'; };
  context.window.cyberduelAccount.recordMatch = async id => {
    assert.equal(id, 'retry-id');
    if (++attempts === 1) throw Error('Servidor indisponível');
    return 0;
  };
  const retry = Object.assign(Object.create(Game.prototype), { soloMatchStart: Promise.resolve({ error: Error('Sem rede') }) });
  await assert.rejects(retry.registrarRecompensaSolo({ resultado: 'inimigo' }), /Servidor indisponível/);
  assert.notEqual(retry.partidaRegistradaNaConta, true);
  assert.equal(await retry.registrarRecompensaSolo({ resultado: 'inimigo' }), 0);
  assert.equal(starts, 1, 'Repetir o pagamento reutiliza o ID e não cria outra partida.');
  assert.equal(await retry.registrarRecompensaSolo({ resultado: 'inimigo' }), 0);
  assert.equal(attempts, 2);

  const excluded = Object.assign(Object.create(Game.prototype), {
    soloMatchStart: Promise.resolve({ matchId: 'solo-id' }), partidaRegistradaNaConta: true,
  });
  assert.equal(await excluded.registrarRecompensaSolo(result.resultadoCombate), null, 'Atalhos de teste continuam sem recompensa.');
  const cards = [];
  context.document = {
    createElement: () => ({ children: [], style: { setProperty() {} }, setAttribute() {},
      append(...items) { this.children.push(...items); }, remove() { cards.splice(cards.indexOf(this), 1); } }),
    body: { append(card) { cards.push(card); } },
  };
  context.window.cyberduelAccount.currency = 777;
  let cleanup;
  const animation = Object.assign(Object.create(Game.prototype), { events: { once(name, callback) { cleanup = callback; } } });
  animation.mostrarAnimacaoRecompensa(67, 24);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].children[1].children[1].textContent, '+67 tijolinhos');
  assert.equal(cards[0].children[1].children[2].textContent, '+24 pontos de influência');
  assert.equal(cards[0].children[1].children[3].textContent, 'Saldo: 777');
  animation.mostrarAnimacaoRecompensa(67);
  assert.equal(cards.length, 1, 'A confirmação repetida não duplica a animação.');
  cleanup(); assert.equal(cards.length, 0);
  animation.recompensaMostrada = false;
  animation.mostrarAnimacaoRecompensa(0, -16);
  assert.equal(cards[0].children[1].children[2].textContent, '-16 pontos de influência');
  cleanup();
  console.log('Solo: crédito antes da interface, concorrência, repetição, falha, reutilização do ID, derrota e exclusão de testes validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
