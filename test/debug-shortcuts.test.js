const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const runtime = require('../server/duel-runtime');
const player = () => ({ deck: [], hand: [], field: Array(10).fill(null), discard: [], traps: [], recentlyDrawn: [], victories: 0 });
for (const winner of ['jogador', 'inimigo', 'empate']) {
  const finished = runtime.finishForDebug({ jogador: player(), inimigo: player(), turno: 1, historico: [] }, winner);
  assert.equal(finished.state.partidaEncerrada, true);
  assert.equal(finished.result.fimDeJogo, true);
  assert.equal(finished.result.resultadoCombate.resultado, winner);
}
const scene = {
  partida: { finalizarParaTeste(winner) { return { resultado: winner }; } },
  mostrarFinalParaTeste(result) { this.result = result; },
};
const manager = { isActive: key => key === 'CenaJogo', getScene: () => scene };
const context = vm.createContext({ window: {}, game: { scene: manager } });
vm.runInContext(fs.readFileSync('js/debug.js', 'utf8'), context);
(async () => {
  await context.window.irParaFinal('vitória');
  assert.equal(scene.result.resultado, 'jogador');
  await context.window.irParaFinal('derrota');
  assert.equal(scene.result.resultado, 'inimigo');
  await assert.rejects(context.window.irParaFinal('x'), /Use vitoria/);
  manager.isActive = () => false;
  await assert.rejects(context.window.irParaFinal(), /Abra uma partida/);
  manager.isActive = () => true;
  scene.multiplayerAtivo = true;
  scene.multiplayer = { spectator: true };
  await assert.rejects(context.window.irParaFinal(), /Espectadores/);
  scene.multiplayer = { initialized: false };
  await assert.rejects(context.window.irParaFinal(), /sincronização/);
  scene.multiplayer = { initialized: true, socket: { connected: true,
    timeout() { return this; }, emit(event, payload, ack) {
      assert.equal(event, 'debug-finish-match');
      assert.equal(payload.resultado, 'empate');
      ack(null, { ok: false, error: 'Atalho desativado' });
    },
  } };
  await assert.rejects(context.window.irParaFinal('empate'), /Atalho desativado/);
  // O servidor normal recusa o comando mesmo que seja enviado diretamente por Socket.IO.
  const { spawn } = require('node:child_process');
  const os = require('node:os');
  const path = require('node:path');
  const { io } = require('socket.io-client');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cyberduel-debug-disabled-'));
  const server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: '31989', DATA_DIR: dataDir, CYBERDUEL_DEBUG: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let socket;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Servidor não iniciou')), 5000);
      server.stdout.on('data', chunk => {
        if (chunk.toString().includes('ouvindo')) { clearTimeout(timer); resolve(); }
      });
    });
    socket = io('http://127.0.0.1:31989', { transports: ['websocket'], reconnection: false });
    const response = await new Promise((resolve, reject) => {
      socket.timeout(5000).emit('debug-finish-match', { resultado: 'vitoria' }, (error, reply) => error ? reject(error) : resolve(reply));
    });
    assert.equal(response.ok, false);
    assert.match(response.error, /npm run dev/);
  } finally {
    socket?.disconnect();
    server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  console.log('Atalhos: três resultados, validação de argumentos, cena, conexão, espectador e recusa do servidor validados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
