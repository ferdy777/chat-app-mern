// ChatWindow.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BsThreeDotsVertical, BsArrowLeft } from "react-icons/bs";
import { MessageCircle, User, Users, X, ShieldOff, Shield, Trash2, ArrowDown, Download } from "lucide-react";
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

const LOAD_MORE_THRESHOLD = 80;
const NEAR_BOTTOM_THRESHOLD = 200;

const ChatWindow = ({ conversation, setConversations, onBack, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const { authUser } = useAuth();
  const { socket, onlineUsers, userStatuses } = useSocket();
  const bottomRef = useRef(null);
  const messagesContentRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const pageRef = useRef(1);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  // True while any message bubble is in edit mode. Focusing the edit
  // textarea opens the on-screen keyboard, which fires BOTH a
  // ResizeObserver resize on the messages container AND a visualViewport
  // resize event — either of which would otherwise auto-scroll the whole
  // chat to the bottom mid-edit. This flag makes both skip that.
  const isEditingRef = useRef(false);

  const otherParticipant = conversation.isGroup
    ? null
    : conversation.participants.find((p) => p._id !== authUser._id);

  const receiverIds = conversation.participants
    .filter((p) => p._id !== authUser._id)
    .map((p) => p._id);

  const isPendingIncoming =
    !conversation.isGroup &&
    conversation.status === "pending" &&
    conversation.requestedBy !== authUser._id;

  const isPendingOutgoing =
    !conversation.isGroup &&
    conversation.status === "pending" &&
    conversation.requestedBy === authUser._id;

  const isGroupAdmin =
    conversation.isGroup &&
    conversation.admins?.some((a) => a === authUser._id || a._id === authUser._id);

  const scrollToBottom = (behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  const handleJumpToBottomClick = () => {
    scrollToBottom("smooth");
    setUnseenCount(0);
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoadingMessages(true);
      pageRef.current = 1;
      isInitialLoadRef.current = true;
      setUnseenCount(0);
      setShowScrollToBottom(false);
      isNearBottomRef.current = true;
      try {
        const { data } = await api.get(`/messages/${conversation._id}?page=1&limit=30`);
        setMessages(data.messages);
        setHasMore(data.hasMore);
        markIncomingAsRead(data.messages);
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

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    setLoadingOlder(true);
    const previousScrollHeight = container.scrollHeight;
    const nextPage = pageRef.current + 1;

    try {
      const { data } = await api.get(
        `/messages/${conversation._id}?page=${nextPage}&limit=30`
      );
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      pageRef.current = nextPage;

      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - previousScrollHeight;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < LOAD_MORE_THRESHOLD) {
        loadOlderMessages();
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
      isNearBottomRef.current = nearBottom;
      setShowScrollToBottom(!nearBottom);
      if (nearBottom) setUnseenCount(0);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation._id, hasMore, loadingOlder]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.conversation !== conversation._id) return;
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
      if (message.sender._id !== authUser._id) {
        markIncomingAsRead([message]);
        if (!isNearBottomRef.current) {
          setUnseenCount((prev) => prev + 1);
        }
      }
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

    const handleGroupDeleted = ({ conversationId }) => {
      if (conversationId !== conversation._id) return;
      toast("This group was deleted");
      onClose();
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("messageReacted", handleMessageReacted);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("userTyping", handleTyping);
    socket.on("userStopTyping", handleStopTyping);
    socket.on("groupDeleted", handleGroupDeleted);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messageReacted", handleMessageReacted);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("userTyping", handleTyping);
      socket.off("userStopTyping", handleStopTyping);
      socket.off("groupDeleted", handleGroupDeleted);
    };
  }, [socket, conversation._id]);

  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (loadingOlder) return;
      if (isInitialLoadRef.current) {
        scrollToBottom("auto");
        isInitialLoadRef.current = false;
        return;
      }
      if (isEditingRef.current) return;
      if (isNearBottomRef.current) scrollToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [loadingOlder]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleViewportResize = () => {
      if (isEditingRef.current) return;
      setTimeout(() => scrollToBottom("auto"), 100);
    };
    vv.addEventListener("resize", handleViewportResize);
    return () => vv.removeEventListener("resize", handleViewportResize);
  }, []);

  const handleInputFocus = () => {
    setTimeout(() => scrollToBottom("auto"), 100);
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [conversation._id]);

  const handleSend = async ({ text, imageBase64 }) => {
    try {
      const { data: savedMessage } = await api.post("/messages", {
        conversationId: conversation._id,
        text,
        imageBase64,
        replyTo: replyingTo?._id,
      });

      setMessages((prev) => (prev.some((m) => m._id === savedMessage._id) ? prev : [...prev, savedMessage]));
      setReplyingTo(null);

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

  const handleJumpToMessage = (messageId) => {
    const el = document.getElementById(`message-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash-highlight");
    setTimeout(() => el.classList.remove("flash-highlight"), 1500);
  };

  // Downloads the currently-viewed image. We fetch it as a blob rather than
  // just setting `download` on an <a href="cloudinary-url">, because the
  // `download` attribute is silently ignored by browsers for cross-origin
  // URLs (which Cloudinary always is) — it would just open the image in a
  // new tab instead of saving it. Fetching the bytes ourselves and handing
  // the browser a same-origin blob URL makes the save-to-device actually work.
  const handleDownloadImage = async () => {
    if (!viewingImage || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(viewingImage, { mode: "cors" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const extension = blob.type.split("/")[1]?.split("+")[0] || "jpg";
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `chatapp-image-${Date.now()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      // Fallback: at least open it in a new tab so the user can long-press
      // / right-click to save it manually if the fetch itself got blocked.
      window.open(viewingImage, "_blank", "noopener,noreferrer");
      toast.error("Couldn't auto-download — opened the image in a new tab instead");
    } finally {
      setDownloading(false);
    }
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

  const handleAcceptRequest = async () => {
    try {
      const { data } = await api.put(`/conversations/${conversation._id}/accept`);
      setConversations((prev) => prev.map((c) => (c._id === data._id ? data : c)));
      conversation.status = "accepted";
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not accept request");
    }
  };

  const handleDeclineRequest = async () => {
    try {
      await api.delete(`/conversations/${conversation._id}/decline`);
      setConversations((prev) => prev.filter((c) => c._id !== conversation._id));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not decline request");
    }
  };

  const handleRemoveChat = async () => {
    const confirmMsg = conversation.isGroup
      ? isGroupAdmin
        ? `Delete "${conversation.groupName}" for everyone? This can't be undone.`
        : `Leave "${conversation.groupName}"?`
      : `Delete this chat with ${otherParticipant?.fullName}? It stays on their side.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.post(`/conversations/${conversation._id}/remove`);
      setConversations((prev) => prev.filter((c) => c._id !== conversation._id));
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove chat");
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
              {!conversation.isGroup && (
                <DropdownMenuItem
                  onClick={handleRemoveChat}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete chat
                </DropdownMenuItem>
              )}
              {conversation.isGroup && (
                <DropdownMenuItem
                  onClick={handleRemoveChat}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {isGroupAdmin ? "Delete group" : "Leave group"}
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

      <div className="relative flex-1 min-h-0">
        <div ref={scrollContainerRef} className="h-full overflow-y-auto chat-bg py-3">
          {loadingOlder && (
            <div className="flex justify-center py-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
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
                onReply={setReplyingTo}
                onImageClick={setViewingImage}
                onJumpToMessage={handleJumpToMessage}
                onEditingChange={(editing) => {
                  isEditingRef.current = editing;
                }}
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

        {showScrollToBottom && (
          <button
            onClick={handleJumpToBottomClick}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-card border border-border shadow-lg rounded-full p-2.5 hover:bg-secondary transition-colors z-10"
            title="Jump to latest message"
          >
            <ArrowDown className="h-5 w-5 text-foreground" />
            {unseenCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            )}
          </button>
        )}
      </div>

      {isBlocked ? (
        <div className="bg-card border-t border-border px-4 py-3 text-center text-sm text-muted-foreground shrink-0">
          You've blocked {otherParticipant?.fullName}.{" "}
          <button onClick={handleToggleBlock} className="text-primary underline">
            Unblock
          </button>{" "}
          to send messages.
        </div>
      ) : isPendingIncoming ? (
        <div className="bg-card border-t border-border px-4 py-3 shrink-0">
          <p className="text-center text-sm text-muted-foreground mb-3">
            {otherParticipant?.fullName} wants to send you a message.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAcceptRequest}
              className="bg-primary text-primary-foreground text-sm font-medium px-5 py-2 rounded-full"
            >
              Accept
            </button>
            <button
              onClick={handleDeclineRequest}
              className="bg-secondary text-muted-foreground text-sm font-medium px-5 py-2 rounded-full"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <>
          {isPendingOutgoing && (
            <div className="bg-card border-t border-border px-4 py-2 text-center text-xs text-muted-foreground shrink-0">
              Message request sent — they'll see it once they accept.
            </div>
          )}
          <MessageInput
            onSend={handleSend}
            onTyping={emitTyping}
            onStopTyping={emitStopTyping}
            onFocusInput={handleInputFocus}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </>
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

      {viewingImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setViewingImage(null)}
          >
            <div className="absolute top-4 right-4 z-[101] flex items-center gap-2">
              <button
                className="bg-black/50 hover:bg-black/70 rounded-full p-2 text-white disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage();
                }}
                disabled={downloading}
                title="Download image"
              >
                <Download className="h-6 w-6" />
              </button>
              <button
                className="bg-black/50 hover:bg-black/70 rounded-full p-2 text-white"
                onClick={() => setViewingImage(null)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <img
              src={viewingImage}
              alt="Full size attachment"
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default ChatWindow;