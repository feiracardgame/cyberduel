const { createServer } = require("http");
const { createReadStream, stat } = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_ROOT = path.resolve(__dirname, "..");
const rooms = new Map();

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
};

function serveGame(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Requisição inválida.");
    return;
  }

  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  const allowed =
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/phaser.js" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/assets/");
  if (!allowed) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("404 Not Found");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_ROOT, relativePath);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  stat(filePath, (error, info) => {
    if (error || !info.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("404 Not Found");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "content-length": info.size,
      "cache-control":
        pathname.startsWith("/assets/") || pathname === "/phaser.js"
          ? "public, max-age=604800, immutable"
          : "no-cache",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  });
}

const httpServer = createServer(serveGame);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  maxHttpBufferSize: 2e6,
});

function generateRoomCode() {
  let code;
  do code = String(Math.floor(100000 + Math.random() * 900000));
  while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return { code: room.code, players: room.players.size, turn: room.turn };
}

function sanitizeDeck(deck) {
  if (!Array.isArray(deck)) return [];
  const sanitized = [];
  let remaining = 20;
  for (const entry of deck) {
    if (remaining <= 0) break;
    const card = {
      tipo: String(entry?.tipo || "").slice(0, 20),
      nome: String(entry?.nome || "").slice(0, 120),
      quantidade: Math.max(
        0,
        Math.min(
          3,
          remaining,
          Math.floor(Number(entry?.quantidade) || 0),
        ),
      ),
    };
    if (card.tipo && card.nome && card.quantidade) {
      sanitized.push(card);
      remaining -= card.quantidade;
    }
  }
  return sanitized;
}

function buildInviteUrl(base, code) {
  try {
    const url = new URL(base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.searchParams.set("room", code);
    return url.toString();
  } catch {
    return null;
  }
}

function removeFromRoom(socket) {
  const code = socket.data.room;
  const player = socket.data.player;
  if (!code || !rooms.has(code)) return;

  const room = rooms.get(code);
  room.players.delete(player);
  socket.to(code).emit("opponent-left");
  rooms.delete(code);
}

io.on("connection", (socket) => {
  socket.on("create-room", async (payload = {}, ack = () => {}) => {
    removeFromRoom(socket);
    const code = generateRoomCode();
    const room = {
      code,
      players: new Map([[1, socket.id]]),
      decks: new Map([[1, sanitizeDeck(payload.deck)]]),
      turn: 1,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    socket.data.player = 1;
    const inviteUrl = buildInviteUrl(
      payload.inviteBase || socket.handshake.headers.origin,
      code,
    );
    let qrCode = null;
    if (inviteUrl) {
      try {
        qrCode = await QRCode.toDataURL(inviteUrl, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#080b12", light: "#ffffff" },
        });
      } catch (error) {
        console.error("Falha ao gerar QR Code:", error.message);
      }
    }
    ack({
      ok: true,
      room: publicRoom(room),
      player: 1,
      inviteUrl,
      qrCode,
    });
  });

  socket.on("join-room", (payload = {}, ack = () => {}) => {
    const code = String(payload.code || "").replace(/\D/g, "").slice(0, 6);
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "Sala não encontrada." });
    if (room.players.size >= 2)
      return ack({ ok: false, error: "Esta sala já está cheia." });

    removeFromRoom(socket);
    room.players.set(2, socket.id);
    room.decks.set(2, sanitizeDeck(payload.deck));
    socket.join(code);
    socket.data.room = code;
    socket.data.player = 2;
    ack({ ok: true, room: publicRoom(room), player: 2 });
    io.to(code).emit("match-ready", {
      room: code,
      decks: { 1: room.decks.get(1), 2: room.decks.get(2) },
    });
  });

  socket.on("initial-state", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    if (!room || socket.data.player !== 1 || room.players.size !== 2)
      return ack({ ok: false });
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      activePlayer: 1,
      initial: true,
    });
    ack({ ok: true });
  });

  socket.on("finish-turn", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || room.players.size !== 2)
      return ack({ ok: false, error: "A partida não está completa." });
    if (room.turn !== player)
      return ack({ ok: false, error: "Não é a sua vez." });

    room.turn = player === 1 ? 2 : 1;
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      result: payload.result || null,
      activePlayer: room.turn,
      initial: false,
    });
    ack({ ok: true, activePlayer: room.turn });
  });

  socket.on("live-state", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.room);
    const player = socket.data.player;
    if (!room || room.players.size !== 2)
      return ack({ ok: false, error: "A partida não está completa." });
    if (room.turn !== player)
      return ack({ ok: false, error: "Não é a sua vez." });
    socket.to(room.code).emit("state-update", {
      state: payload.state,
      activePlayer: room.turn,
      live: true,
      initial: false,
    });
    ack({ ok: true });
  });

  socket.on("surrender", () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    socket.to(room.code).emit("opponent-surrendered");
  });

  socket.on("leave-room", () => {
    removeFromRoom(socket);
    socket.data.room = null;
    socket.data.player = null;
  });

  socket.on("disconnect", () => removeFromRoom(socket));
});

httpServer.listen(PORT, () => {
  console.log(`Cyberduel multiplayer ouvindo na porta ${PORT}`);
});
