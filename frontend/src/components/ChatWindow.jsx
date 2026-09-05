import { useEffect, useRef, useState } from "react";
import { BsThreeDotsVertical, BsArrowLeft } from "react-icons/bs";
import { MessageCircle, User, Users, X, ShieldOff, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import api from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import ContactProfileModal from "./ContactProfileModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ChatWindow = ({ conversation, setConversations, onBack, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const { authUser } = useAuth();
  const { socket, onlineUsers, userStatuses } = useSocket();
  const bottomRef = useRef(null);
  const messagesContentRef = useRef(null);

  const otherParticipant = conversation.isGroup
    ? null
    : conversation.participants.find((p) => p._id !== authUser._id);

  const receiverIds = conversation.participants
    .filter((p) => p._id !== authUser._id)
    .map((p) => p._id);

  const scrollToBottom = (behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data } = await api.get(`/messages/${conversation._id}`);
        setMessages(data);
        markIncomingAsRead(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();

    socket?.emit("joinConversation", conversation._id);
    return () => socket?.emit("leaveConversation", conversation._id);
  }, [conversation._id, socket]);

  useEffect(() => {
    if (conversation.isGroup || !otherParticipant) return;
    const checkBlocked = async () => {
      try {
        const { data } = await api.get("/users/blocked");
        setIsBlocked(data.some((u) => u._id === otherParticipant._id));
      } catch (err) {
        console.error(err);
      }
    };
    checkBlocked();
  }, [conversation._id]);

  const markIncomingAsRead = async (msgs) => {
    const unread = msgs.filter((m) => m.sender._id !== authUser._id && m.status !== "read");
    if (!unread.length) return;
    try {
      await api.put("/messages/read", {
        conversationId: conversation._id,
        messageIds: unread.map((m) => m._id),
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.conversation !== conversation._id) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
      if (message.sender._id !== authUser._id) markIncomingAsRead([message]);
    };

    const handleMessagesRead = ({ conversationId, messageIds }) => {
      if (conversationId !== conversation._id) return;
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m._id) ? { ...m, status: "read" } : m))
      );
    };

    const handleMessageEdited = (updated) => {
      if (updated.conversation !== conversation._id) return;
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    };

    const handleMessageReacted = (updated) => {
      if (updated.conversation !== conversation._id) return;
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    };

    const handleMessageDeleted = ({ conversationId, messageId }) => {
      if (conversationId !== conversation._id) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text: "", reactions: [] } : m))
      );
    };

    const handleTyping = ({ conversationId }) => {
      if (conversationId === conversation._id) setIsOtherTyping(true);
    };

    const handleStopTyping = ({ conversationId }) => {
      if (conversationId === conversation._id) setIsOtherTyping(false);
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("messageReacted", handleMessageReacted);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("userTyping", handleTyping);
    socket.on("userStopTyping", handleStopTyping);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messageReacted", handleMessageReacted);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("userTyping", handleTyping);
      socket.off("userStopTyping", handleStopTyping);
    };
  }, [socket, conversation._id]);

  // Single source of truth for "stay pinned to the bottom": watch the actual
  // rendered height of the message list. This fires on new messages, on the
  // typing indicator appearing/disappearing, AND on late-loading images
  // resizing the layout (which is what was causing the scroll to land on
  // the wrong message before) — so we don't need separate effects keyed off
  // messages/isOtherTyping anymore.
  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      scrollToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Scroll to the last message once the mobile keyboard opens/closes
  // (visualViewport resizing), since that changes the container's visible
  // height rather than the content's height and won't trigger the
  // ResizeObserver above.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleViewportResize = () => {
      // small delay so it fires after the keyboard has actually resized the layout
      setTimeout(() => scrollToBottom("auto"), 100);
    };
    vv.addEventListener("resize", handleViewportResize);
    return () => vv.removeEventListener("resize", handleViewportResize);
  }, []);

  const handleInputFocus = () => {
    setTimeout(() => scrollToBottom("auto"), 100);
  };

  useEffect(() => {
    // ensures we land on the last message whenever a new conversation is opened
    scrollToBottom("auto");
  }, [conversation._id]);

  const handleSend = async ({ text, imageBase64 }) => {
    try {
      const { data: savedMessage } = await api.post("/messages", {
        conversationId: conversation._id,
        text,
        imageBase64,
      });

      setMessages((prev) => (prev.some((m) => m._id === savedMessage._id) ? prev : [...prev, savedMessage]));

      socket?.emit("sendMessage", {
        ...savedMessage,
        conversation: conversation._id,
        conversationId: conversation._id,
        receiverIds,
      });

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c._id === conversation._id ? { ...c, lastMessage: savedMessage } : c
        );
        const target = updated.find((c) => c._id === conversation._id);
        return [target, ...updated.filter((c) => c._id !== conversation._id)];
      });
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error(err.response?.data?.message || "You can't message this user");
      } else {
        console.error(err);
      }
    }
  };

  const handleMessageUpdated = (updated) => {
    setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
  };

  const handleMessageDeletedLocal = (messageId) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, text: "", reactions: [] } : m))
    );
  };

  const emitTyping = () => socket?.emit("typing", { conversationId: conversation._id, receiverIds });
  const emitStopTyping = () =>
    socket?.emit("stopTyping", { conversationId: conversation._id, receiverIds });

  const handleToggleBlock = async () => {
    if (!otherParticipant) return;
    try {
      if (isBlocked) {
        await api.delete(`/users/block/${otherParticipant._id}`);
        setIsBlocked(false);
        toast.success(`Unblocked ${otherParticipant.fullName}`);
      } else {
        await api.post(`/users/block/${otherParticipant._id}`);
        setIsBlocked(true);
        toast.success(`Blocked ${otherParticipant.fullName}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  const displayName = conversation.isGroup ? conversation.groupName : otherParticipant?.fullName;
  const avatar = conversation.isGroup
    ? conversation.groupAvatar ||
      `https://ui-avatars.com/api/?name=${conversation.groupName}&background=2a3942&color=fff`
    : otherParticipant?.avatar ||
      `https://ui-avatars.com/api/?name=${otherParticipant?.fullName}&background=2a3942&color=fff`;

  const otherStatus = otherParticipant ? userStatuses[otherParticipant._id] : null;
  const isOnline =
    !conversation.isGroup &&
    (onlineUsers.includes(otherParticipant?._id) || otherParticipant?.username === "chatapp_bot");

  const lastSeenHidden = otherParticipant?.privacy?.lastSeenVisible === false;

  const lastSeenText =
    otherParticipant?.lastSeen && otherParticipant?.username !== "chatapp_bot" && !lastSeenHidden
      ? `last seen ${formatDistanceToNow(new Date(otherParticipant.lastSeen), { addSuffix: true })}`
      : "offline";

  const onlineStatusText =
    otherStatus === "away" ? "away" : otherStatus === "busy" ? "busy" : "online";

  const subtitle = conversation.isGroup
    ? `${conversation.participants.length} members`
    : isOtherTyping
    ? "typing..."
    : isOnline
    ? onlineStatusText
    : lastSeenText;

  return (
    <div className="w-full sm:flex-1 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BsArrowLeft
            className="text-muted-foreground text-xl cursor-pointer sm:hidden shrink-0"
            onClick={onBack}
          />
          <div
            className="flex items-center gap-2 sm:gap-3 min-w-0 cursor-pointer"
            onClick={() => setShowContactProfile(true)}
          >
            <img
              src={avatar}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover shrink-0"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${displayName}&background=2a3942&color=fff`;
              }}
            />
            <div className="min-w-0">
              <p className="text-card-foreground font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-full hover:bg-secondary transition-colors">
                <BsThreeDotsVertical className="text-muted-foreground text-lg" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowContactProfile(true)}>
                {conversation.isGroup ? (
                  <Users className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                {conversation.isGroup ? "Group info" : "Contact info"}
              </DropdownMenuItem>
              {!conversation.isGroup && otherParticipant?.username !== "chatapp_bot" && (
                <DropdownMenuItem
                  onClick={handleToggleBlock}
                  className={isBlocked ? "" : "text-destructive focus:text-destructive"}
                >
                  {isBlocked ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                  {isBlocked ? "Unblock" : "Block"} {otherParticipant?.fullName}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onClose}>
                <X className="h-4 w-4" /> Close chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="hidden sm:block p-2 rounded-full hover:bg-secondary transition-colors"
            onClick={onClose}
            title="Close chat"
          >
            <X className="text-muted-foreground text-lg" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto chat-bg py-3 min-h-0">
        <div ref={messagesContentRef}>
          {!loadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-10 h-10 mb-3" />
              <p className="text-sm">No messages yet. Say hi 👋</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isOwn={msg.sender._id === authUser._id}
              onUpdated={handleMessageUpdated}
              onDeleted={handleMessageDeletedLocal}
            />
          ))}
          {isOtherTyping && (
            <div className="px-4 py-1">
              <div className="bg-wa-bubbleIn text-muted-foreground text-xs inline-block px-3 py-2 rounded-lg">
                typing...
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {isBlocked ? (
        <div className="bg-card border-t border-border px-4 py-3 text-center text-sm text-muted-foreground shrink-0">
          You've blocked {otherParticipant?.fullName}.{" "}
          <button onClick={handleToggleBlock} className="text-primary underline">
            Unblock
          </button>{" "}
          to send messages.
        </div>
      ) : (
        <MessageInput
          onSend={handleSend}
          onTyping={emitTyping}
          onStopTyping={emitStopTyping}
          onFocusInput={handleInputFocus}
        />
      )}

      {showContactProfile && (
        <ContactProfileModal
          conversation={conversation}
          currentUserId={authUser._id}
          onlineUsers={onlineUsers}
          userStatuses={userStatuses}
          onClose={() => setShowContactProfile(false)}
        />
      )}
    </div>
  );
};

export default ChatWindow;