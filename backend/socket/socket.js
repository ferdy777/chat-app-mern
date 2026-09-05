const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Maps userId -> Set of socketIds. A user can be connected from more than
// one device/tab at once (laptop open + phone open on the same account) —
// storing just a single socketId meant the second device to connect
// silently overwrote the first, so the first device stopped receiving any
// real-time events (new chats, messages, accepted requests, etc.) until it
// was manually refreshed.
const userSocketMap = {};

let io;

function addSocket(userId, socketId) {
  if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
  userSocketMap[userId].add(socketId);
}

function removeSocket(userId, socketId) {
  userSocketMap[userId]?.delete(socketId);
  if (userSocketMap[userId]?.size === 0) {
    delete userSocketMap[userId];
  }
}

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

    const wasAlreadyOnline = !!userSocketMap[userId];
    addSocket(userId, socket.id);

    // Only flip to "online" + reset away/busy on this user's FIRST active
    // connection. If they're already connected elsewhere, leave their
    // chosen status alone instead of stomping it every time a 2nd tab opens.
    if (!wasAlreadyOnline) {
      await User.findByIdAndUpdate(userId, { isOnline: true, status: "online" });
      io.emit("userStatusChanged", { userId, status: "online" });
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

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

      // Emit to the room (covers group chats + multi-device joins)
      socket.to(conversationId).emit("newMessage", message);

      // Also emit directly to every socket each receiver has open, in case
      // they haven't joined the room yet (or have it open on another device).
      receiverIds.forEach((rId) => {
        userSocketMap[rId]?.forEach((socketId) => {
          io.to(socketId).emit("newMessage", message);
        });
      });
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        userSocketMap[rId]?.forEach((socketId) => {
          io.to(socketId).emit("userTyping", { conversationId, userId });
        });
      });
    });

    socket.on("stopTyping", ({ conversationId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        userSocketMap[rId]?.forEach((socketId) => {
          io.to(socketId).emit("userStopTyping", { conversationId, userId });
        });
      });
    });

    // Read receipts (blue ticks)
    socket.on("messageRead", ({ conversationId, messageIds, readerId, receiverIds = [] }) => {
      receiverIds.forEach((rId) => {
        userSocketMap[rId]?.forEach((socketId) => {
          io.to(socketId).emit("messagesRead", { conversationId, messageIds, readerId });
        });
      });
    });

    // Manual presence change while connected (away/busy/online — not offline, that's disconnect-only)
    socket.on("setStatus", async (status) => {
      if (!["online", "away", "busy"].includes(status)) return;
      await User.findByIdAndUpdate(userId, { status });
      io.emit("userStatusChanged", { userId, status });
    });

    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: user ${userId} (${socket.id})`);
      removeSocket(userId, socket.id);

      const stillConnectedElsewhere = !!userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));

      // Only mark them offline once their LAST connection drops — otherwise
      // closing one tab/device would wrongly show them offline everywhere,
      // and would wipe presence for the device that's still open.
      if (!stillConnectedElsewhere) {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          status: "offline",
          lastSeen: new Date(),
        });
        io.emit("userStatusChanged", { userId, status: "offline" });
      }
    });
  });

  return io;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getReceiverSocketIds(userId) {
  return userSocketMap[userId] ? Array.from(userSocketMap[userId]) : [];
}

module.exports = { initSocket, getReceiverSocketIds, getIO: () => io };