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
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });

    newSocket.on("userStatusChanged", ({ userId, status }) => {
      setUserStatuses((prev) => ({ ...prev, [userId]: status }));
    });

    return () => {
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