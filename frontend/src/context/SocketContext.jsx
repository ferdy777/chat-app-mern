import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

export const SocketProvider = ({ children }) => {
  const { authUser } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  // userId -> "online" | "away" | "busy" | "offline"
  const [userStatuses, setUserStatuses] = useState({});

  useEffect(() => {
    if (!authUser) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const newSocket = io(API_URL, {
      withCredentials: true,
      // Explicit, so backgrounding a mobile tab (which drops the socket)
      // reliably reconnects on resume instead of leaving a dead connection
      // that the rest of the app thinks is still live.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });

    newSocket.on("userStatusChanged", ({ userId, status }) => {
      setUserStatuses((prev) => ({ ...prev, [userId]: status }));
    });

    // Auth on the socket handshake is cookie-based (see socket/socket.js).
    // If the cookie died while backgrounded, reconnect attempts will fail
    // auth over and over — that's a real dead session, so let AuthContext's
    // 401-driven flow handle it via the next API call rather than looping
    // silently here.
    newSocket.on("connect_error", (err) => {
      console.warn("Socket connect error:", err.message);
    });

    return () => {
      newSocket.off("getOnlineUsers");
      newSocket.off("userStatusChanged");
      newSocket.off("connect_error");
      newSocket.disconnect();
    };
  }, [authUser?._id]);

  const setMyStatus = (status) => {
    socketRef.current?.emit("setStatus", status);
  };

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, userStatuses, setMyStatus }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);