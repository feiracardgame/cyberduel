function requireAdminAccount() {
  if (!window.cyberduelAccount?.user) throw new Error("Entre na sua conta primeiro.");
  if (!window.cyberduelAccount.isAdmin) throw new Error("Esta conta não é administradora.");
}

// Console: adicionarPontos("username", quantidade) credita pontos do ranking.
window.adicionarPontos = async (username, amount) => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim() || !Number.isSafeInteger(amount) || amount < 1)
    throw new Error('Use adicionarPontos("username", quantidadeInteiraPositiva).');
  const payload = await window.cyberduelAccount.grantRating(username.trim(), amount);
  return `+${payload.added} pontos para ${payload.account.username}. Total: ${payload.account.rating}.`;
};

// Atalhos do console, disponíveis desde o menu e resolvidos na cena atual.
window.liberarLeaderboard = async (username = window.cyberduelAccount?.user) => {
  requireAdminAccount();
  if (typeof username !== "string" || !username.trim()) throw new Error('Use liberarLeaderboard("username").');
  const payload = await window.cyberduelAccount.unlockLeaderboard(username.trim());
  return `${payload.account.username} elegível na leaderboard: ${payload.account.humanGames} partidas e ${payload.account.humanWins} vitórias contra jogadores.`;
};

window.irParaX1 = () => {
  requireAdminAccount();
  if (!game.scene.isActive("CenaTitulo") && !game.scene.isActive("CenaJogo") &&
      !game.scene.isActive("CenaDeckBuilder") && !game.scene.isActive("CenaTransicao"))
    throw new Error("Aguarde o carregamento inicial do jogo.");
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
