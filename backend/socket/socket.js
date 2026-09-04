const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Maps userId -> socketId (supports multiple tabs by storing an array, kept simple here as single socket)
const userSocketMap = {};

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Authenticate every socket connection using the same JWT cookie the REST API uses
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = parseCookie(cookieHeader, "jwt");

      if (!token) return next(new Error("Authentication error: no token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return next(new Error("Authentication error: user not found"));

      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: user ${userId} (${socket.id})`);

    userSocketMap[userId] = socket.id;

    // Mark user online, reset any stale away/busy from their last session, tell everyone
    await User.findByIdAndUpdate(userId, { isOnline: true, status: "online" });
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    io.emit("userStatusChanged", { userId, status: "online" });

    // Join a conversation "room" so events only go to participants
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leaveConversation", (conversationId) => {
      socket.leave(conversationId);
    });

    // Real-time message send: server persists via REST controller,
    // this event is for pushing the saved message to the other participant(s) instantly.
    socket.on("sendMessage", (message) => {
      // message: { conversationId, receiverIds: [...], ...savedMessageDoc }
      const { conversationId, receiverIds = [] } = message;

      // Emit to the room (covers group chats + multi-device)
      socket.to(conversationId).emit("newMessage", message);

      // Also emit directly to each receiver's socket in case they haven't joined the room yet
      receiverIds.forEach((rId) => {
        const receiverSocketId = userSocketMap[rId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newMessage", message);
        }
      });
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        const receiverSocketId = userSocketMap[rId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("userTyping", { conversationId, userId });
        }
      });
    });

    socket.on("stopTyping", ({ conversationId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        const receiverSocketId = userSocketMap[rId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("userStopTyping", { conversationId, userId });
        }
      });
    });

    // Read receipts (blue ticks)
    socket.on("messageRead", ({ conversationId, messageIds, readerId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        const receiverSocketId = userSocketMap[rId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messagesRead", { conversationId, messageIds, readerId });
        }
      });
    });

    // Manual presence change while connected (away/busy/online — not offline, that's disconnect-only)
    socket.on("setStatus", async (status) => {
      if (!["online", "away", "busy"].includes(status)) return;
      await User.findByIdAndUpdate(userId, { status });
      io.emit("userStatusChanged", { userId, status });
    });

    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: user ${userId}`);
      delete userSocketMap[userId];
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        status: "offline",
        lastSeen: new Date(),
      });
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      io.emit("userStatusChanged", { userId, status: "offline" });
    });
  });

  return io;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

module.exports = { initSocket, getReceiverSocketId, getIO: () => io };