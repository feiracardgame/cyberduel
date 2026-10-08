// O servidor controla a sala e sincroniza o estado da partida.
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
    this.presentation = false;
    this.presentationScope = window.CYBERDUEL_TABLE ? `:${window.CYBERDUEL_TABLE}` : "";
    this.spectator = false;
    this.initialized = false;
    this.deadline = null;
    this.clockOffset = 0;
    this.effectsPaused = false;
    this.effectsSequence = 0;
    this.effectsAck = null;
    try { this.resumeToken = window.sessionStorage?.getItem("cyberduel.resume") || null; } catch {}
    this.scene = null;
    this.pendingUpdate = null;
    this.onStatus = null;
    this.onReady = null;
    this.onMatchmakingStopped = null;
    this.ranked = false;
    this.profiles = {};
    this.needsIntroduction = false;
    this.localDeck = [];
    this.opponentDeck = [];
    this.localUsername = null;
    this.opponentUsername = null;
    this.localNickname = null;
    this.opponentNickname = null;
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
      if (this.onClubTables && this.clubTablesSubscribed) this.watchClubTables(this.onClubTables);
      if (this.presentation && this.room) return this.createPresentation(this.onPresentation);
      if (this.waitingInvitation) return this.joinRoom(this.waitingInvitation.code, () => {}, this.waitingInvitation.table, this.waitingInvitation.seat);
      if (this.active && this.resumeToken && !this.spectator) this.resumeMatch((response) => {
        if (!response.ok) this.status(response.error);
      });
    });
    this.socket.on("matchmaking-stopped", (payload) => this.onMatchmakingStopped?.(payload.error));
    this.socket.on("disconnect", () => this.onMatchmakingStopped?.("Conexão perdida. Inicie a busca novamente ao reconectar."));
    this.socket.on("connect_error", () => {
      const destino = serverUrl || location.origin;
      this.status(`Servidor multiplayer indisponível em ${destino}.`);
    });
    this.socket.on("match-ready", ({ room, player, resumeToken, ranked, arena, profiles, update, decks, usernames, nicknames, ...phase }) => {
      this.applyPhase(phase);
      if (player) this.player = player;
      if (resumeToken) this.saveResumeToken(resumeToken);
      this.ranked = !!ranked;
      this.arena = !!arena;
      this.profiles = profiles || {};
      this.needsIntroduction = true;
      this.initialized = false;
      this.spectator = false;
      this.presentation = false;
      this.waitingInvitation = null;
      this.room = room;
      this.active = true;
      this.localDeck = decks?.[this.player] || this.localDeck;
      this.opponentDeck = decks?.[this.player === 1 ? 2 : 1] || [];
      this.localUsername = usernames?.[this.player] || null;
      this.localNickname = nicknames?.[this.player] || this.localUsername;
      this.opponentUsername = usernames?.[this.player === 1 ? 2 : 1] || null;
      this.opponentNickname = nicknames?.[this.player === 1 ? 2 : 1] || this.opponentUsername || "INIMIGO";
      if (update) this.receiveUpdate(update);
      if (this.onReady) this.onReady();
    });
    this.socket.on("presentation-room", response => this.receivePresentation(response));
    this.socket.on("club-tables", response => this.onClubTables?.(response));
    this.socket.on("phase-clock", (update) => this.applyPhase(update));
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
      this.waitingInvitation = null;
      if (this.presentation) {
        this.active = false;
        this.room = null;
        try { window.sessionStorage?.removeItem("cyberduel.presentationRoom" + this.presentationScope); } catch {}
        this.onPresentation?.({ ok: false, error: "Sala encerrada. Crie uma nova apresentação." });
      }
      this.status("O oponente saiu da sala.");
      if (this.scene) this.scene.oponenteSaiuMultiplayer();
    });
    return this.socket;
  }

  resolveServerUrl() {
    return window.cyberduelServerUrl();
  }

  status(message) {
    if (this.onStatus) this.onStatus(message);
  }

  joinMatchmaking(callback) {
    this.connect().timeout(7000).emit("join-matchmaking", { accountToken: window.cyberduelAccount?.token }, (error, response) => {
      callback(error ? { ok: false, error: "Servidor indisponível. Tente buscar novamente." } : response);
      if (!error && response?.code === "AUTH_REQUIRED") {
        window.cyberduelAccount?.clear();
        this.status(response.error);
      }
    });
  }

  cancelMatchmaking(callback) {
    this.connect().timeout(7000).emit("cancel-matchmaking", {}, (error, response) => {
      callback(error ? { ok: false, error: "Não foi possível cancelar. Tente novamente." } : response);
    });
  }

  createPresentation(callback) {
    this.presentation = true;
    this.spectator = true;
    this.onPresentation = callback;
    let code = this.room;
    try { code ||= window.sessionStorage?.getItem("cyberduel.presentationRoom" + this.presentationScope); } catch {}
    let displayKey = this.displayKey;
    try { displayKey ||= window.sessionStorage?.getItem("cyberduel.presentationKey" + this.presentationScope); } catch {}
    this.connect().timeout(10000).emit("create-presentation", { code, displayKey, table: window.CYBERDUEL_TABLE || null, inviteBase: `${location.origin}/` }, (error, response) => {
      if (error) return callback?.({ ok: false, error: "Servidor indisponível. Tente abrir a arena novamente." });
      if (response.ok) this.receivePresentation(response);
      else callback?.(response);
    });
  }

  receivePresentation(response) {
    if (!this.presentation) return;
    this.player = null;
    this.spectator = true;
    this.room = response.room.code;
    this.displayKey = response.displayKey;
    try {
      window.sessionStorage?.setItem("cyberduel.presentationRoom" + this.presentationScope, this.room);
      window.sessionStorage?.setItem("cyberduel.presentationKey" + this.presentationScope, this.displayKey);
    } catch {}
    this.onPresentation?.(response);
    if (response.update) this.enterExisting(response);
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

  watchClubTables(callback) {
    this.onClubTables = callback;
    this.connect().timeout(5000).emit("watch-club-tables", {}, (error, response) => {
      if (this.onClubTables !== callback) return;
      this.clubTablesSubscribed = !error && response?.ok;
      callback(error ? { ok: false, error: "Não foi possível carregar as mesas." } : response);
    });
  }

  unwatchClubTables() {
    this.onClubTables = null;
    this.clubTablesSubscribed = false;
    this.socket?.emit("unwatch-club-tables");
  }

  reserveCouncilSeat(seat, callback) {
    this.connect().timeout(5000).emit("reserve-council-seat", { seat, accountToken: window.cyberduelAccount?.token }, (error, response) => {
      callback(error ? { ok: false, error: "Não foi possível reservar o canto." } : response);
    });
  }

  releaseCouncilSeat() {
    this.socket?.emit("release-council-seat", { accountToken: window.cyberduelAccount?.token });
  }

  requestClubCode(table, callback) {
    this.connect().timeout(5000).emit("request-club-code", { table, accountToken: window.cyberduelAccount?.token }, (error, response) => {
      callback(error ? { ok: false, error: "Não foi possível exibir o código. Tente novamente." } : response);
    });
  }

  joinRoom(code, callback, table = null, seat = null) {
    this.localDeck = window.cyberduelDeckBuilder.getDeckForMatch();
    const params = new URLSearchParams(location.search);
    const invitation = params.get("room") === code ? { seat: params.get("seat"), ticket: params.get("ticket") } : {};
    this.connect().emit("join-room", {
      code,
      ...invitation,
      ...(table !== null ? { table, seat } : {}),
      deck: this.localDeck,
      accountToken: window.cyberduelAccount?.token || null,
    }, (response) => {
      if (!response.ok) return callback(response);
      this.room = response.room.code;
      this.player = response.player;
      this.waitingInvitation = response.waiting ? { code, table, seat } : null;
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
    if (this.initialized && !update.initial && update.round != null && (update.round < this.round ||
        (update.round === this.round && update.step < this.step))) return;
    this.activePlayer = update.activePlayer ?? this.activePlayer;
    this.phase = update.phase || this.phase;
    this.step = update.step ?? this.step;
    this.round = update.round ?? this.round;
    this.starter = update.starter ?? this.starter;
    if (update.serverNow) this.clockOffset = update.serverNow - Date.now();
    if (Object.hasOwn(update, "deadline")) this.deadline = update.deadline;
    for (const key of ["announcementAt", "introUntil", "phaseStartsAt"])
      if (Object.hasOwn(update, key)) this[key] = update[key];
    if (Object.hasOwn(update, "effectsPaused")) {
      this.effectsPaused = update.effectsPaused;
      this.effectsSequence = update.effectsSequence || 0;
      this.effectsRemaining = update.effectsRemaining;
      if (!this.effectsPaused) this.effectsAck = null;
    }
  }

  announcementPending() { return this.phaseStartsAt > Date.now() + this.clockOffset; }

  skipAnnouncement() {
    const now = Date.now() + this.clockOffset;
    if (!this.socket || this.spectator || this.activePlayer !== this.player ||
        now < this.announcementAt || !this.announcementPending() || this.effectsPaused) return;
    const key = `${this.room}:${this.round}:${this.step}:${this.announcementAt}`;
    if (this.skippedAnnouncement === key) return;
    this.skippedAnnouncement = key;
    this.socket.emit("skip-battle-announcement", { round: this.round, step: this.step }, response => {
      if (response?.ok) this.applyPhase(response);
      else this.skippedAnnouncement = null;
    });
  }

  remainingMs() {
    if (this.effectsPaused) return Math.max(0, this.effectsRemaining || 0);
    if (this.announcementPending()) return Math.max(0, (this.deadline || 0) - this.phaseStartsAt);
    return Math.max(0, (this.deadline || 0) - Date.now() - this.clockOffset);
  }

  effectsReady(sequence) {
    if (!this.effectsPaused || this.spectator || !this.socket || sequence < this.effectsSequence) return;
    const key = `${this.round}:${this.step}:${this.effectsSequence}`;
    if (this.effectsAck === key) return;
    this.effectsAck = key;
    this.socket.timeout(5000).emit("effects-ready", { sequence: this.effectsSequence, step: this.step, round: this.round }, (error, response) => {
      if (this.effectsAck !== key) return;
      if (error || !response?.ok) this.effectsAck = null;
      else this.applyPhase(response);
    });
  }

  findActiveMatch(callback) {
    this.connect().emit("find-active-match", {
      resumeToken: this.resumeToken, accountToken: window.cyberduelAccount?.token,
    }, callback);
  }

  declineMatch(room, callback) {
    this.connect().emit("decline-match", {
      room, resumeToken: this.resumeToken, accountToken: window.cyberduelAccount?.token,
    }, (response) => {
      if (response.ok) {
        this.active = false;
        this.initialized = false;
        this.pendingUpdate = null;
        this.saveResumeToken(null);
      }
      callback(response);
    });
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
    this.arena = !!response.arena;
    this.ranked = !!response.ranked; this.profiles = response.profiles || {};
    this.needsIntroduction = false;
    this.localDeck = response.decks?.[this.player] || [];
    this.opponentDeck = response.decks?.[this.player === 2 ? 1 : 2] || [];
    this.localUsername = response.usernames?.[this.player === 2 ? 2 : 1];
    this.localNickname = response.nicknames?.[this.player === 2 ? 2 : 1] || this.localUsername;
    this.opponentUsername = response.usernames?.[this.player === 2 ? 1 : 2];
    this.opponentNickname = response.nicknames?.[this.player === 2 ? 1 : 2] || this.opponentUsername;
    this.receiveUpdate(response.update);
    if (!this.scene) this.onReady?.();
  }

  leaveRoom() {
    this.socket?.emit("leave-room");
    this.active = false; this.initialized = false; this.pendingUpdate = null;
    if (!this.presentation) this.saveResumeToken(null);
    this.presentation = false; this.waitingInvitation = null; this.displayKey = null; this.room = null;
    try { window.sessionStorage?.removeItem("cyberduel.presentationRoom" + this.presentationScope); window.sessionStorage?.removeItem("cyberduel.presentationKey" + this.presentationScope); } catch {}
    this.spectator = false; this.lastLiveState = null;
    this.effectsPaused = false; this.effectsAck = null;
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
    const scene = this.scene;
    const payload = {
      state: this.canonicalSnapshot(partida),
      step: this.step, round: this.round,
    };
    this.socket.timeout(5000).emit("finish-turn", payload, (error, response) => {
      if (error || !response?.ok) {
        this.status(response?.error || "Não foi possível confirmar a jogada. Tente novamente.");
        // Uma recusa não encerra a fase; permita tentar novamente na mesma vez.
        if (scene && this.scene === scene && this.step === payload.step &&
            this.round === payload.round && this.activePlayer === this.player &&
            !partida.partidaEncerrada) {
          scene.ehMeuTurno = true;
          scene.finalizandoJogada = false;
          scene.travado = false;
          scene.timerTurnoExpirado = false;
          scene.reiniciarTimerTurno();
        }
      } else if (response.update && scene === this.scene && scene?.finalizandoJogada &&
          this.step === payload.step && this.round === payload.round) this.receiveUpdate(response.update);
      else this.applyPhase(response);
    });
  }

  sendLiveState(partida) {
    if (
      !this.active ||
      !this.socket || !this.initialized || this.spectator || this.announcementPending() ||
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
