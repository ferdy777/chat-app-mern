import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import api from "../utils/axios";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import useViewportHeight from "../hooks/useViewportHeight";

const SELECTED_CONVERSATION_KEY = "chatapp:selectedConversationId";

const ChatPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversationState] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const { socket } = useSocket();
  const { authUser } = useAuth();

  // Tracks whether the currently open chat pushed a history entry, so we
  // know whether closing it should call history.back() or just clear state.
  const chatOpenedViaHistory = useRef(false);

  useViewportHeight();

  const setSelectedConversation = (conv) => {
    setSelectedConversationState(conv);
    if (conv) {
      localStorage.setItem(SELECTED_CONVERSATION_KEY, conv._id);
    } else {
      localStorage.removeItem(SELECTED_CONVERSATION_KEY);
    }
  };

  const handleCloseChat = () => {
    if (chatOpenedViaHistory.current) {
      window.history.back();
    } else {
      setSelectedConversation(null);
    }
  };

  // Close chat (not the app) on Escape — routed through handleCloseChat so
  // it stays in sync with the back arrow / gesture / hardware back button.
  useEffect(() => {
    if (!selectedConversation) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") handleCloseChat();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedConversation]);

  // Mobile back button/gesture closes chat (not the app).
  // Only one listener for the lifetime of the page — popstate always means
  // "the chat's history entry was consumed", so always clear the chat.
  useEffect(() => {
    const handlePopState = () => {
      chatOpenedViaHistory.current = false;
      setSelectedConversation(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectConversation = (conv) => {
    // Only push a new history entry when opening a chat from the closed
    // list view. Switching directly between chats (possible on desktop,
    // where the sidebar stays visible) should not stack extra entries.
    if (!selectedConversation) {
      window.history.pushState({ chatOpen: true }, "");
      chatOpenedViaHistory.current = true;
    }
    setSelectedConversation(conv);
    setUnreadCounts((prev) => ({ ...prev, [conv._id]: 0 }));
  };

  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const { data } = await api.get("/messages/unread-counts");
        setUnreadCounts(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    if (selectedConversation || conversations.length === 0) return;
    const savedId = localStorage.getItem(SELECTED_CONVERSATION_KEY);
    if (!savedId) return;
    const match = conversations.find((c) => c._id === savedId);
    if (match) {
      window.history.pushState({ chatOpen: true }, "");
      chatOpenedViaHistory.current = true;
      setSelectedConversationState(match);
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === message.conversation);
        if (!exists) return prev;
        const updated = prev.map((c) =>
          c._id === message.conversation ? { ...c, lastMessage: message } : c
        );
        const target = updated.find((c) => c._id === message.conversation);
        return [target, ...updated.filter((c) => c._id !== message.conversation)];
      });

      if (message.sender._id === authUser._id) return;
      if (selectedConversation?._id === message.conversation) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [message.conversation]: (prev[message.conversation] || 0) + 1,
      }));
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [socket, selectedConversation, authUser._id]);

  return (
    <div
      className="w-screen flex bg-background overflow-hidden"
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        selectedConversation={selectedConversation}
        setSelectedConversation={handleSelectConversation}
        unreadCounts={unreadCounts}
      />

      {selectedConversation ? (
        <ChatWindow
          conversation={selectedConversation}
          setConversations={setConversations}
          onBack={handleCloseChat}
          onClose={handleCloseChat}
        />
      ) : (
        <div className="hidden sm:flex flex-1 flex-col items-center justify-center bg-card text-muted-foreground">
          <MessageCircle className="w-16 h-16 mb-4 text-primary" />
          <h2 className="text-xl text-foreground">ChatApp Web</h2>
          <p className="text-sm mt-2">Select a chat to start messaging</p>
        </div>
      )}
    </div>
  );
};

export default ChatPage;