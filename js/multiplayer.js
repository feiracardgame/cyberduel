// Camada multiplayer do Cyberduel. O servidor controla a sala e de quem é
// a vez; o estado completo da partida viaja entre os clientes ao passar a vez.
class CyberduelMultiplayer {
  constructor() {
    this.socket = null;
    this.room = null;
    this.player = null;
    this.active = false;
    this.activePlayer = 1;
    this.phase = "colocar";
    this.step = 0;
    this.round = 1;
    this.starter = 1;
    this.spectator = false;
    this.initialized = false;
    this.deadline = null;
    this.clockOffset = 0;
    try { this.resumeToken = window.sessionStorage?.getItem("cyberduel.resume") || null; } catch {}
    this.scene = null;
    this.pendingUpdate = null;
    this.onStatus = null;
    this.onReady = null;
    this.localDeck = [];
    this.opponentDeck = [];
    this.localUsername = null;
    this.opponentUsername = null;
    this.lastLiveState = null;
    this.lastTurnTime = null;
  }

  connect() {
    if (this.socket) return this.socket;
    if (typeof io === "undefined") throw new Error("Socket.IO não carregou.");
    const serverUrl = this.resolveServerUrl();
    this.socket = io(serverUrl, {
      timeout: 6000,
      reconnectionAttempts: 4,
    });
    this.socket.on("connect", () => {
      this.status("Conectado ao servidor.");
      if (this.active && this.resumeToken && !this.spectator) this.resumeMatch((response) => {
        if (!response.ok) this.status(response.error);
      });
    });
    this.socket.on("connect_error", () => {
      const destino = serverUrl || location.origin;
      this.status(`Servidor multiplayer indisponível em ${destino}.`);
    });
    this.socket.on("match-ready", ({ room, decks, usernames, ...phase }) => {
      this.applyPhase(phase);
      this.initialized = false;
      this.spectator = false;
      this.room = room;
      this.active = true;
      this.localDeck = decks?.[this.player] || this.localDeck;
      this.opponentDeck = decks?.[this.player === 1 ? 2 : 1] || [];
      this.localUsername = usernames?.[this.player] || null;
      this.opponentUsername =
        usernames?.[this.player === 1 ? 2 : 1] || "INIMIGO";
      if (this.onReady) this.onReady();
    });
    this.socket.on("state-update", (update) => this.receiveUpdate(update));
    this.socket.on("turn-time", ({ activePlayer, remainingMs, running }) => {
      if (this.activePlayer !== activePlayer) return;
      if (this.scene && activePlayer !== this.player) {
        this.scene.receberTempoOponente(remainingMs, running);
      }
    });
    this.socket.on("opponent-surrendered", (payload) => {
      if (this.scene) this.scene.oponenteDesistiuMultiplayer(payload?.player);
    });
    this.socket.on("opponent-offline", () => this.status("Oponente desconectado. A partida permanece disponível para retorno."));
    this.socket.on("opponent-online", () => this.status("Oponente reconectado."));
    this.socket.on("opponent-left", () => {
      this.status("O oponente saiu da sala.");
      if (this.scene) this.scene.oponenteSaiuMultiplayer();
    });
    return this.socket;
  }

  resolveServerUrl() {
    const parametro = new URLSearchParams(location.search).get("server");
    const configurado = window.CYBERDUEL_SERVER_URL || parametro;
    if (configurado && /^https?:\/\//i.test(configurado)) {
      return configurado.replace(/\/$/, "");
    }

    // Live Server/Vite servem apenas arquivos estáticos. Neste projeto o
    // Docker publica o Socket.IO pelo nginx na porta HTTP padrão do mesmo
    // host, enquanto a página estática costuma estar em :5500/:5173.
    const portasEstaticas = new Set(["4173", "5173", "5500", "5501"]);
    if (portasEstaticas.has(location.port)) {
      return `${location.protocol}//${location.hostname}`;
    }

    // npm start, Docker/nginx e produção usam o mesmo origin da página.
    return undefined;
  }

  status(message) {
    if (this.onStatus) this.onStatus(message);
  }

  createRoom(callback) {
    this.localDeck = window.cyberduelDeckBuilder.getDeckForMatch();
    this.connect().emit(
      "create-room",
      {
        deck: this.localDeck,
        accountToken: window.cyberduelAccount?.token || null,
        inviteBase: `${location.origin}${location.pathname}`,
      },
      (response) => {
        if (!response.ok) return callback(response);
        this.room = response.room.code;
        this.player = response.player;
        this.saveResumeToken(response.resumeToken);
        callback(response);
      },
    );
  }

  joinRoom(code, callback) {
    this.localDeck = window.cyberduelDeckBuilder.getDeckForMatch();
    this.connect().emit("join-room", {
      code,
      deck: this.localDeck,
      accountToken: window.cyberduelAccount?.token || null,
    }, (response) => {
      if (!response.ok) return callback(response);
      this.room = response.room.code;
      this.player = response.player;
      this.saveResumeToken(response.resumeToken);
      callback(response);
    });
  }

  saveResumeToken(token) {
    this.resumeToken = token || null;
    try {
      if (token) window.sessionStorage?.setItem("cyberduel.resume", token);
      else window.sessionStorage?.removeItem("cyberduel.resume");
    } catch {}
  }

  applyPhase(update) {
    this.activePlayer = update.activePlayer ?? this.activePlayer;
    this.phase = update.phase || this.phase;
    this.step = update.step ?? this.step;
    this.round = update.round ?? this.round;
    this.starter = update.starter ?? this.starter;
    if (update.serverNow) this.clockOffset = update.serverNow - Date.now();
    if (update.deadline) this.deadline = update.deadline;
  }

  remainingMs() { return Math.max(0, (this.deadline || 0) - Date.now() - this.clockOffset); }

  findActiveMatch(callback) {
    this.connect().emit("find-active-match", {
      resumeToken: this.resumeToken, accountToken: window.cyberduelAccount?.token,
    }, callback);
  }

  resumeMatch(callback = () => {}) {
    this.connect().emit("resume-match", {
      resumeToken: this.resumeToken, accountToken: window.cyberduelAccount?.token,
    }, (response) => {
      if (response.ok) {
        this.player = response.player; this.spectator = false;
        this.saveResumeToken(response.resumeToken);
        this.enterExisting(response);
      }
      callback(response);
    });
  }

  spectateRoom(code, callback) {
    this.connect().emit("spectate-room", { code }, (response) => {
      if (response.ok) {
        this.player = null; this.spectator = true;
        this.enterExisting(response);
      }
      callback?.(response);
    });
  }

  enterExisting(response) {
    this.room = response.room.code; this.active = true; this.initialized = true;
    this.localDeck = response.decks?.[this.player] || [];
    this.opponentDeck = response.decks?.[this.player === 2 ? 1 : 2] || [];
    this.localUsername = response.usernames?.[this.player === 2 ? 2 : 1];
    this.opponentUsername = response.usernames?.[this.player === 2 ? 1 : 2];
    this.receiveUpdate(response.update);
    if (!this.scene) this.onReady?.();
  }

  leaveRoom() {
    this.socket?.emit("leave-room");
    this.active = false; this.initialized = false; this.pendingUpdate = null;
    this.spectator = false; this.lastLiveState = null; this.saveResumeToken(null);
  }

  attachScene(scene) {
    this.scene = scene;
    if (this.pendingUpdate) {
      const update = this.pendingUpdate;
      this.pendingUpdate = null;
      this.receiveUpdate(update);
    }
  }

  detachScene(scene) {
    if (this.scene === scene) this.scene = null;
  }

  sendInitialState(partida) {
    if (this.player !== 1 || this.initialized) return;
    this.socket.emit("initial-state", { state: this.canonicalSnapshot(partida) });
  }

  finishTurn(partida, result) {
    const payload = {
      state: this.canonicalSnapshot(partida),
      step: this.step, round: this.round,
    };
    this.socket.emit("finish-turn", payload, (response) => {
      if (!response.ok) this.status(response.error || "A jogada foi recusada.");
      else this.applyPhase(response);
    });
  }

  sendLiveState(partida) {
    if (
      !this.active ||
      !this.socket || !this.initialized || this.spectator ||
      this.activePlayer !== this.player ||
      partida.partidaEncerrada
    )
      return;
    const state = this.canonicalSnapshot(partida);
    const fingerprint = JSON.stringify(state);
    if (fingerprint === this.lastLiveState) return;
    this.lastLiveState = fingerprint;
    this.socket.emit("live-state", { state, step: this.step, round: this.round }, (response) => {
      if (response?.ok && response.step === this.step && response.round === this.round) this.applyPhase(response);
    });
  }

  sendTurnTime(remainingMs, running) {
    if (
      !this.active ||
      !this.socket ||
      this.activePlayer !== this.player
    )
      return;
    const clamped = Math.max(0, Math.min(40_000, Number(remainingMs) || 0));
    const fingerprint = `${Math.ceil(clamped / 1000)}:${running ? 1 : 0}`;
    if (fingerprint === this.lastTurnTime) return;
    this.lastTurnTime = fingerprint;
    this.socket.emit("turn-time", { remainingMs: clamped, running: !!running });
  }

  surrender() {
    if (this.socket) this.socket.emit("surrender");
  }

  receiveUpdate(update) {
    if (this.activePlayer !== update.activePlayer) this.lastTurnTime = null;
    this.applyPhase(update);
    this.initialized = true;
    if (!this.scene) {
      this.pendingUpdate = update;
      return;
    }
    const state = this.localSnapshot(update.state);
    const result = update.result ? this.localResult(update.result) : null;
    this.scene.receberEstadoMultiplayer(state, result, update);
  }

  canonicalSnapshot(partida) {
    const snapshot = this.serializeMatch(partida);
    return this.player === 2 ? this.swapSnapshot(snapshot) : snapshot;
  }

  localSnapshot(snapshot) {
    const copy = JSON.parse(JSON.stringify(snapshot));
    return this.player === 2 ? this.swapSnapshot(copy) : copy;
  }

  canonicalResult(result) {
    const copy = JSON.parse(JSON.stringify(result));
    return this.player === 2 ? this.swapTurnResult(copy) : copy;
  }

  localResult(result) {
    const copy = JSON.parse(JSON.stringify(result));
    return this.player === 2 ? this.swapTurnResult(copy) : copy;
  }

  swapTurnResult(result) {
    if (result.resultadoCombate)
      result.resultadoCombate = this.swapResult(result.resultadoCombate);
    if (result.resultadoRodada)
      result.resultadoRodada = this.swapResult(result.resultadoRodada);
    return result;
  }

  swapResult(result) {
    [result.poderJogador, result.poderInimigo] = [
      result.poderInimigo,
      result.poderJogador,
    ];
    [result.rodadasJogador, result.rodadasInimigo] = [
      result.rodadasInimigo,
      result.rodadasJogador,
    ];
    if (result.resultado === "jogador") result.resultado = "inimigo";
    else if (result.resultado === "inimigo") result.resultado = "jogador";
    if (result.vencedor === "jogador") result.vencedor = "inimigo";
    else if (result.vencedor === "inimigo") result.vencedor = "jogador";
    return result;
  }

  swapSnapshot(snapshot) {
    [snapshot.jogador, snapshot.inimigo] = [snapshot.inimigo, snapshot.jogador];
    [snapshot.rodadasJogador, snapshot.rodadasInimigo] = [
      snapshot.rodadasInimigo,
      snapshot.rodadasJogador,
    ];
    (snapshot.eventosEfeito || []).forEach((event) => {
      event.lado = event.lado === "jogador" ? "inimigo" : "jogador";
      event.alvos.forEach((alvo) => { alvo.lado = alvo.lado === "jogador" ? "inimigo" : "jogador"; });
    });
    snapshot.historico.forEach((entry) => {
      entry.quem = entry.quem === "jogador" ? "inimigo" : "jogador";
    });
    for (const player of [snapshot.jogador, snapshot.inimigo]) {
      player.contribuicoesEfeito = Object.fromEntries(Object.entries(player.contribuicoesEfeito || {}).map(([chave, entry]) => {
        const inverter = (key) => key.replace(/^(jogador|inimigo):/, (lado) => lado === "jogador:" ? "inimigo:" : "jogador:");
        entry.lado = entry.lado === "jogador" ? "inimigo" : "jogador";
        entry.alvos = Object.fromEntries(Object.entries(entry.alvos).map(([key, value]) => [inverter(key), value]));
        return [inverter(chave), entry];
      }));
      for (const card of [...player.deck, ...player.hand, ...player.field]) {
        if (!card || !card.__capturedBy) continue;
        card.__capturedBy =
          card.__capturedBy === "jogador" ? "inimigo" : "jogador";
      }
    }
    return snapshot;
  }

  serializeMatch(partida) {
    const serializeCard = (card) => {
      if (!card) return null;
      const plain = {};
      for (const [key, value] of Object.entries(card)) {
        if (key === "capturadaPor" || key === "capturadaPorAranha") continue;
        plain[key] = value;
      }
      if (card.capturadaPor)
        plain.__capturedBy =
          card.capturadaPor === partida.jogador ? "jogador" : "inimigo";
      if (card.capturadaPorAranha)
        plain.__capturedBySpiderId = card.capturadaPorAranha.id;
      return JSON.parse(JSON.stringify(plain));
    };
    const serializePlayer = (player) => ({
      deck: player.deck.cartas.map(serializeCard),
      hand: player.mao.cartas.map(serializeCard),
      field: player.campo.cartas.map(serializeCard),
      discard: player.descarte.map(serializeCard),
      lostCards: player.cartasPerdidas,
      efeitosUtilizados: player.efeitosUtilizados || 0,
      penalidadesInvocacao: JSON.parse(JSON.stringify(player.penalidadesInvocacao || [])),
      contribuicoesEfeito: JSON.parse(JSON.stringify(player.contribuicoesEfeito || {})),
      traps: [...player.campo.armadilhas],
      victories: player.vitorias,
      recentlyDrawn: player.cartasRecemCompradas.map((card) => card.id),
    });
    return {
      jogador: serializePlayer(partida.jogador),
      inimigo: serializePlayer(partida.inimigo),
      turno: partida.turno,
      maxTurnos: partida.maxTurnos,
      rodadasParaVencer: partida.rodadasParaVencer,
      rodadasJogador: partida.rodadasJogador,
      rodadasInimigo: partida.rodadasInimigo,
      partidaEncerrada: partida.partidaEncerrada,
      sequenciaEfeito: partida.sequenciaEfeito || 0,
      eventosEfeito: JSON.parse(JSON.stringify(partida.eventosEfeito || [])),
      historico: partida.historico.map((entry) => ({
        turno: entry.turno,
        quem: entry.quem,
        carta: serializeCard(entry.carta),
      })),
    };
  }

  hydrateMatch(snapshot) {
    const hydrateCard = (plain) => {
      if (!plain) return null;
      const card = Object.assign(Object.create(Carta.prototype), plain);
      delete card.__capturedBy;
      delete card.__capturedBySpiderId;
      return card;
    };
    const hydratePlayer = (plain) => {
      const player = Object.create(Jogador.prototype);
      player.deck = Object.assign(Object.create(Deck.prototype), {
        cartas: plain.deck.map(hydrateCard),
        limite: 20,
      });
      player.mao = Object.assign(Object.create(Mao.prototype), {
        cartas: plain.hand.map(hydrateCard),
      });
      player.campo = Object.assign(Object.create(Campo.prototype), {
        cartas: plain.field.map(hydrateCard),
        limite: 10,
        armadilhas: new Set(plain.traps || []),
      });
      player.campo.dono = player;
      player.descarte = (plain.discard || []).map(hydrateCard);
      player.contribuicoesEfeito = JSON.parse(JSON.stringify(plain.contribuicoesEfeito || {}));
      player.efeitosUtilizados = plain.efeitosUtilizados || 0;
      player.penalidadesInvocacao = JSON.parse(JSON.stringify(plain.penalidadesInvocacao || []));
      player.cartasPerdidas = Math.max(0, Number(plain.lostCards) || 0);
      player.vitorias = plain.victories || 0;
      player.cartasRecemCompradas = (plain.recentlyDrawn || [])
        .map((id) => player.mao.cartas.find((card) => card.id === id))
        .filter(Boolean);
      return player;
    };

    const match = Object.create(Partida.prototype);
    match.jogador = hydratePlayer(snapshot.jogador);
    match.inimigo = hydratePlayer(snapshot.inimigo);
    match.turno = snapshot.turno;
    match.maxTurnos = snapshot.maxTurnos;
    match.rodadasParaVencer = snapshot.rodadasParaVencer;
    match.rodadasJogador = snapshot.rodadasJogador;
    match.rodadasInimigo = snapshot.rodadasInimigo;
    match.partidaEncerrada = snapshot.partidaEncerrada;
    match.sequenciaEfeito = snapshot.sequenciaEfeito || 0;
    match.eventosEfeito = JSON.parse(JSON.stringify(snapshot.eventosEfeito || []));
    match.cartaSelecionada = null;
    match.efeitosDeTurno = [];
    match.efeitoInimigoTurno = null;
    match.jogadasCampoInimigoTurno = [];
    match.ultimaRevelacaoFaro = null;
    match.historico = (snapshot.historico || []).map((entry) => ({
      turno: entry.turno,
      quem: entry.quem,
      carta: hydrateCard(entry.carta),
    }));

    const pairs = [
      [snapshot.jogador, match.jogador],
      [snapshot.inimigo, match.inimigo],
    ];
    pairs.forEach(([plainPlayer, player]) => {
      const plainCards = [
        ...plainPlayer.deck,
        ...plainPlayer.hand,
        ...plainPlayer.field,
        ...(plainPlayer.discard || []),
      ];
      const cards = [
        ...player.deck.cartas,
        ...player.mao.cartas,
        ...player.campo.cartas,
        ...player.descarte,
      ];
      plainCards.forEach((plainCard, index) => {
        if (!plainCard || !cards[index] || (!plainCard.__capturedBy && plainCard.__capturedBySpiderId == null)) return;
        const ownerSide = plainCard.__capturedBy || (player === match.jogador ? "inimigo" : "jogador");
        const owner = ownerSide === "jogador" ? match.jogador : match.inimigo;
        cards[index].capturadaPor = plainCard.__capturedBy ? owner : null;
        cards[index].capturadaPorAranha = owner.campo.cartas.find(
          (card) => card && card.id === plainCard.__capturedBySpiderId,
        );
      });
    });
    return match;
  }
}

window.cyberduelMultiplayer = new CyberduelMultiplayer();
