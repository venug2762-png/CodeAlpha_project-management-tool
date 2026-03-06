const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

const initSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── Connection ───────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[socket] connected  user=${socket.userId}  sid=${socket.id}`);

    socket.on("joinProject", (projectId) => {
      if (typeof projectId !== "string" || projectId.length > 64) return;
      socket.join(projectId);
      console.log(
        `[socket] user=${socket.userId} joined  project=${projectId}`,
      );
    });

    socket.on("leaveProject", (projectId) => {
      if (typeof projectId !== "string") return;
      socket.leave(projectId);
      console.log(
        `[socket] user=${socket.userId} left    project=${projectId}`,
      );
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `[socket] disconnected  user=${socket.userId}  reason=${reason}`,
      );
    });

    socket.on("error", (err) => {
      console.error(`[socket] error  user=${socket.userId}:`, err.message);
    });
  });

  return io;
};

module.exports = initSocket;
