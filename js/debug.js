function requireAdminAccount() {
  if (!window.cyberduelAccount?.user) throw new Error("Entre na sua conta primeiro.");
  if (!window.cyberduelAccount.isAdmin) throw new Error("Esta conta não é administradora.");
}

window.modoDemo = async (enabled = true) => {
  requireAdminAccount();
  if (typeof enabled !== "boolean") throw new Error("Use modoDemo(true) para ativar ou modoDemo(false) para desativar.");
  const result = await window.cyberduelAccount.setDemoMode(enabled);
  return result.demoMode ? "Modo demo ativado para todos: apenas Echossystem e RaspCorp." : "Modo demo desativado para todos.";
};

// Prévia somente nesta aba: não altera nomes, sessão ou dados no servidor.
window.testarNomeCensurado = () => {
  const guard = window.cyberduelNameGuard;
  if (!guard) throw new Error("Aguarde o carregamento do jogo.");
  if (window.cyberduelAccount?.nameRestriction || (guard.dialog && !guard.preview))
    throw new Error("Corrija o nome censurado antes de abrir uma prévia.");
  guard.show({ username: true, nickname: true }, { preview: true });
  return "Prévia local aberta. Use FECHAR TESTE ou Escape para sair; sua conta não será alterada.";
};

// Moderação real, restrita a administradores e direcionada pelo username da conta.
window.exigirTrocaDeNome = async username => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim())
    throw new Error('Use exigirTrocaDeNome("username").');
  const result = await window.cyberduelAccount.requireNameChange(username.trim());
  return `Troca de nome exigida para ${result.username}. O aviso permanece até a conta escolher outro apelido permitido.`;
};

window.enviarAvisoGeral = async message => {
  requireAdminAccount();
  if (typeof message !== "string" || !message.trim() || Array.from(message.trim()).length > 1000)
    throw new Error('Use enviarAvisoGeral("mensagem de até 1000 caracteres").');
  const result = await window.cyberduelAccount.broadcastMessage(message.trim());
  return `Aviso enviado para ${result.connections} conexão(ões) online.`;
};

window.resetarPontosLeaderboard = async () => {
  requireAdminAccount();
  const payload = await window.cyberduelAccount.resetLeaderboardRating();
  return `Pontos de influência de ${payload.count} conta(s) resetados para 1000 pontos de influência.`;
};

// Console: adicionarPontos("username", quantidade) credita pontos de influência.
window.adicionarPontos = async (username, amount) => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim() || !Number.isSafeInteger(amount) || amount < 1)
    throw new Error('Use adicionarPontos("username", quantidadeInteiraPositiva).');
  const payload = await window.cyberduelAccount.grantRating(username.trim(), amount);
  return `+${payload.added} pontos de influência para ${payload.account.username}. Total: ${payload.account.rating} pontos de influência.`;
};

window.diminuirPontos = async (username, amount) => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim() || !Number.isSafeInteger(amount) || amount < 1)
    throw new Error('Use diminuirPontos("username", quantidadeInteiraPositiva).');
  const payload = await window.cyberduelAccount.removeRating(username.trim(), amount);
  return `-${payload.removed} pontos de influência para ${payload.account.username}. Total: ${payload.account.rating} pontos de influência.`;
};

// Atalhos do console, disponíveis desde o menu e resolvidos na cena atual.
window.liberarLeaderboard = async (username = window.cyberduelAccount?.user) => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim()) throw new Error('Use liberarLeaderboard("username").');
  const payload = await window.cyberduelAccount.unlockLeaderboard(username.trim());
  return `${payload.account.username} elegível na leaderboard: ${payload.account.humanGames} partidas e ${payload.account.humanWins} vitórias contra jogadores.`;
};

window.irParaX1 = () => {
  if (!game.scene.isActive("CenaTitulo") && !game.scene.isActive("CenaJogo") &&
      !game.scene.isActive("CenaDeckBuilder") && !game.scene.isActive("CenaTransicao"))
    throw new Error("Aguarde o carregamento inicial do jogo.");
  if (!window.cyberduelAccount?.user)
    window.cyberduelAccount.useOfflineAdmin();
  requireAdminAccount();
  const builder = window.cyberduelDeckBuilder;
  const deckDebug = builder.getSavedDeck() || new CyberduelDeckBuilder().getStarterDeck();
  if (!builder.isValid(deckDebug)) throw new Error("Não foi possível montar o deck de teste.");
  window.cyberduelMultiplayer.leaveRoom();
  for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
  game.scene.start("CenaJogo", { debug: true, deckDebug });
  return "X1 de teste iniciado contra o bot.";
};

window.irParaFinal = async (resultado = "vitoria") => {
  requireAdminAccount();
  resultado = String(resultado).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const resultados = { vitoria: "jogador", derrota: "inimigo", empate: "empate" };
  if (!Object.hasOwn(resultados, resultado)) throw new Error("Use vitoria, derrota ou empate.");
  if (!game.scene.isActive("CenaJogo")) throw new Error("Abra uma partida primeiro. Para testar com o bot, use irParaX1().");
  const scene = game.scene.getScene("CenaJogo");
  if (scene.multiplayerAtivo) {
    const multiplayer = scene.multiplayer;
    if (multiplayer.spectator) throw new Error("Espectadores não podem encerrar a partida.");
    if (!multiplayer.socket?.connected || !multiplayer.initialized)
      throw new Error("Aguarde a conexão e a sincronização da partida.");
    return new Promise((resolve, reject) => {
      multiplayer.socket.timeout(5000).emit("debug-finish-match", { resultado, accountToken: window.cyberduelAccount.token }, (error, response) => {
        if (error) reject(new Error("O servidor não respondeu ao atalho de final."));
        else if (!response?.ok) reject(new Error(response?.error || "Não foi possível encerrar a partida."));
        else resolve("Partida de teste encerrada para os dois jogadores.");
      });
    });
  }
  const final = scene.partida.finalizarParaTeste(resultados[resultado]);
  scene.mostrarFinalParaTeste(final);
  return final;
};

// Garante uma lendária na próxima abertura bem-sucedida desta conta.
window.garantelendaria = () => {
  requireAdminAccount();
  const account = window.cyberduelAccount;
  if (!account?.user) throw new Error("Entre na sua conta primeiro.");
  account.debugLegendaryUser = account.user;
  return "Próximo booster que você ABRIR terá uma lendária, inclusive do inventário. O servidor precisa estar em modo de teste (npm run dev).";
};
