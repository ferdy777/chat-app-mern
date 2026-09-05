import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  Search,
  MoreVertical,
  Plus,
  Users,
  User,
  LogOut,
  X,
  Shield,
  Settings,
  HelpCircle,
  Circle,
  Minus,
  Clock,
  Check,
  Inbox,
  Trash2,
  CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { subscribeToPush } from "../utils/push";
import NewChatModal from "./NewChatModal";
import CreateGroupModal from "./CreateGroupModal";
import ProfileModal from "./ProfileModal";
import PrivacySettingsModal from "./PrivacySettingsModal";
import AccountSettingsModal from "./AccountSettingsModal";
import BlockedUsersModal from "./BlockedUsersModal";
import HelpAboutModal from "./HelpAboutModal";
import ThemeToggle from "./ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

const STATUS_OPTIONS = [
  { value: "online", label: "Online", color: "text-primary", icon: Circle },
  { value: "away", label: "Away", color: "text-yellow-500", icon: Clock },
  { value: "busy", label: "Busy", color: "text-red-500", icon: Minus },
];

const STATUS_DOT_COLOR = {
  online: "bg-primary",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "",
};

const LONG_PRESS_MS = 450;

const Sidebar = ({
  conversations,
  setConversations,
  selectedConversation,
  setSelectedConversation,
  unreadCounts = {},
}) => {
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [search, setSearch] = useState("");
  const [viewingAvatar, setViewingAvatar] = useState(null);
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "requests"
  const [requests, setRequests] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const longPressTimer = useRef(null);
  // Set true the instant a long-press fires select mode. The header/search/
  // tabs collapse right away when that happens, shifting every row up — the
  // "ghost click" browsers fire ~shortly after touchend then lands on
  // whatever row ended up under that point, toggling a SECOND chat we never
  // meant to touch. This flag lets us swallow that one stray click.
  const suppressClickRef = useRef(false);
  const { authUser, logout } = useAuth();
  const { socket, onlineUsers, userStatuses, setMyStatus } = useSocket();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get("/conversations");
        setConversations(data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchRequests = async () => {
      try {
        const { data } = await api.get("/conversations/requests");
        setRequests(data);
      } catch (err) {
        console.error(err);
      }
    };

    const refreshAll = () => {
      fetchConversations();
      fetchRequests();
    };

    refreshAll();

    // Mobile browsers routinely suspend or fully kill a backgrounded tab.
    // Re-pull both lists whenever we come back to the foreground so a chat
    // created/accepted on another device (or a missed socket event) doesn't
    // leave this sidebar stuck showing a stale list.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshAll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refreshAll);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refreshAll);
    };
  }, []);

  useEffect(() => {
    subscribeToPush();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // A reconnect (after a dropped connection, network blip, etc.) can mean
    // we missed events entirely — pull a fresh list whenever the socket
    // (re)establishes so nothing stays silently out of sync.
    const handleConnect = () => {
      api
        .get("/conversations")
        .then(({ data }) => setConversations(data))
        .catch((err) => console.error(err));
      api
        .get("/conversations/requests")
        .then(({ data }) => setRequests(data))
        .catch((err) => console.error(err));
    };

    const handleNewRequest = (conversation) => {
      setRequests((prev) =>
        prev.some((r) => r._id === conversation._id) ? prev : [conversation, ...prev]
      );
    };

    const handleRequestAccepted = (conversation) => {
      setRequests((prev) => prev.filter((r) => r._id !== conversation._id));
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversation._id);
        return exists
          ? prev.map((c) => (c._id === conversation._id ? conversation : c))
          : [conversation, ...prev];
      });
    };

    const handleConversationDeleted = ({ conversationId }) => {
      setRequests((prev) => prev.filter((r) => r._id !== conversationId));
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      if (selectedConversation?._id === conversationId) setSelectedConversation(null);
    };

    socket.on("connect", handleConnect);
    socket.on("newMessageRequest", handleNewRequest);
    socket.on("conversationRequestAccepted", handleRequestAccepted);
    socket.on("conversationDeleted", handleConversationDeleted);
    socket.on("groupDeleted", handleConversationDeleted);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("newMessageRequest", handleNewRequest);
      socket.off("conversationRequestAccepted", handleRequestAccepted);
      socket.off("conversationDeleted", handleConversationDeleted);
      socket.off("groupDeleted", handleConversationDeleted);
    };
  }, [socket, selectedConversation]);

  const getOtherParticipant = (conv) =>
    conv.isGroup ? null : conv.participants.find((p) => p._id !== authUser._id);

  const getDisplayName = (conv) => {
    const other = getOtherParticipant(conv);
    return conv.isGroup ? conv.groupName : other?.fullName || "";
  };

  const getStatusDotClass = (userId, isOnline) => {
    if (!isOnline) return "";
    const status = userStatuses[userId] || "online";
    return STATUS_DOT_COLOR[status] || STATUS_DOT_COLOR.online;
  };

  const visibleConversations = conversations.filter((conv) =>
    getDisplayName(conv).toLowerCase().includes(search.toLowerCase())
  );

  const handleConversationUpsert = (conv) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c._id === conv._id);
      return exists ? prev.map((c) => (c._id === conv._id ? conv : c)) : [conv, ...prev];
    });
    setSelectedConversation(conv);
  };

  const handleStatusChange = async (status) => {
    setMyStatus(status);
    try {
      await api.put("/users/status", { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptRequest = async (conversationId, e) => {
    e.stopPropagation();
    try {
      const { data } = await api.put(`/conversations/${conversationId}/accept`);
      setRequests((prev) => prev.filter((r) => r._id !== conversationId));
      setConversations((prev) => [data, ...prev.filter((c) => c._id !== conversationId)]);
      setActiveTab("chats");
      setSelectedConversation(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not accept request");
    }
  };

  const handleDeclineRequest = async (conversationId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/conversations/${conversationId}/decline`);
      setRequests((prev) => prev.filter((r) => r._id !== conversationId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not decline request");
    }
  };

  // ---- Select mode (long-press / right-click a chat to delete without opening it) ----

  const enterSelectMode = (convId) => {
    setSelectMode(true);
    setSelectedIds(new Set([convId]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (convId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const handleItemClick = (conv) => {
    // Swallow the one ghost click that follows a long-press-triggered
    // select-mode entry — see suppressClickRef above.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectMode) {
      toggleSelect(conv._id);
    } else {
      setSelectedConversation(conv);
    }
  };

  const handleLongPressStart = (convId) => {
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      enterSelectMode(convId);
    }, LONG_PRESS_MS);
  };

  const handleLongPressEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (suppressClickRef.current) {
      // Stops the browser's synthetic click from firing at all, on top of
      // the handleItemClick guard above (belt and suspenders — some
      // browsers still dispatch it regardless).
      if (e?.cancelable) e.preventDefault();
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 400);
    }
  };

  const handleContextMenu = (e, convId) => {
    e.preventDefault();
    if (!selectMode) {
      enterSelectMode(convId);
    } else {
      toggleSelect(convId);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const label = ids.length === 1 ? "this chat" : `these ${ids.length} chats`;
    const confirmed = window.confirm(
      `Remove ${label}? Groups you admin will be deleted for everyone; groups you're just a member of will be left.`
    );
    if (!confirmed) return;

    try {
      await Promise.all(ids.map((id) => api.post(`/conversations/${id}/remove`)));
      setConversations((prev) => prev.filter((c) => !selectedIds.has(c._id)));
      if (selectedConversation && selectedIds.has(selectedConversation._id)) {
        setSelectedConversation(null);
      }
      exitSelectMode();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove some chats");
    }
  };

  const myStatus = userStatuses[authUser._id] || "online";
  const activeStatus = STATUS_OPTIONS.find((s) => s.value === myStatus) || STATUS_OPTIONS[0];

  return (
    <div
      className={`w-full sm:w-[380px] shrink-0 h-full bg-card flex-col border-r border-border ${
        selectedConversation ? "hidden sm:flex" : "flex"
      }`}
    >
      {selectMode ? (
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button
            onClick={exitSelectMode}
            className="p-2 -ml-2 rounded-full hover:bg-secondary text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0}
            className="p-2 -mr-2 rounded-full hover:bg-secondary text-destructive disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={
                authUser.avatar ||
                `https://ui-avatars.com/api/?name=${authUser.fullName}&background=00a884&color=fff`
              }
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${authUser.fullName}&background=00a884&color=fff`;
              }}
              alt="me"
              className="w-10 h-10 rounded-full object-cover cursor-pointer shrink-0"
              onClick={() => setShowProfile(true)}
            />
            <span className="font-semibold text-foreground truncate">ChatApp</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-secondary hover:text-foreground transition-colors"
                  title="New chat or group"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowNewChat(true)}>
                  <MessageCircle className="h-4 w-4" /> New chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowNewGroup(true)}>
                  <Users className="h-4 w-4" /> New group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-full hover:bg-secondary hover:text-foreground transition-colors"
                  title="Menu"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowProfile(true)}>
                  <User className="h-4 w-4" /> Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <activeStatus.icon className={`h-4 w-4 ${activeStatus.color}`} />
                    Status: {activeStatus.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {STATUS_OPTIONS.map(({ value, label, color, icon: Icon }) => (
                        <DropdownMenuItem key={value} onClick={() => handleStatusChange(value)}>
                          <Icon className={`h-4 w-4 ${color}`} />
                          {label}
                          {myStatus === value && (
                            <span className="ml-auto text-xs text-muted-foreground">✓</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {activeTab === "chats" && conversations.length > 0 && (
                  <DropdownMenuItem onClick={() => setSelectMode(true)}>
                    <CheckSquare className="h-4 w-4" /> Select chats
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowPrivacy(true)}>
                  <Shield className="h-4 w-4" /> Privacy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBlocked(true)}>
                  <X className="h-4 w-4" /> Blocked users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAccount(true)}>
                  <Settings className="h-4 w-4" /> Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowHelp(true)}>
                  <HelpCircle className="h-4 w-4" /> Help & about
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {!selectMode && (
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "chats"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "requests"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
                {requests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {!selectMode && activeTab === "chats" && (
        <div className="px-3 py-2">
          <div className="flex items-center bg-secondary rounded-lg px-3 py-1.5">
            <Search className="text-muted-foreground h-4 w-4 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search or start a new chat"
              className="bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <X
                className="text-muted-foreground h-4 w-4 cursor-pointer shrink-0"
                onClick={() => setSearch("")}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {(selectMode || activeTab === "chats") && (
          <>
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8 text-center">
                <MessageCircle className="h-10 w-10 mb-3" />
                <p className="text-sm">No chats yet. Tap + to start a new conversation.</p>
              </div>
            )}
            {conversations.length > 0 && visibleConversations.length === 0 && !selectMode && (
              <p className="text-center text-muted-foreground text-sm py-6">
                No chats match &quot;{search}&quot;
              </p>
            )}
            {(selectMode ? conversations : visibleConversations).map((conv) => {
              const other = getOtherParticipant(conv);
              const displayName = getDisplayName(conv);
              const avatar = conv.isGroup
                ? conv.groupAvatar ||
                  `https://ui-avatars.com/api/?name=${conv.groupName}&background=2a3942&color=fff`
                : other?.avatar ||
                  `https://ui-avatars.com/api/?name=${other?.fullName}&background=2a3942&color=fff`;
              const isOnline =
                !conv.isGroup &&
                (onlineUsers.includes(other?._id) || other?.username === "chatapp_bot");
              const dotClass = !conv.isGroup ? getStatusDotClass(other?._id, isOnline) : "";
              const isOpen = selectedConversation?._id === conv._id;
              const isChecked = selectedIds.has(conv._id);
              const isWaitingReply = !conv.isGroup && conv.status === "pending";

              return (
                <div
                  key={conv._id}
                  onClick={() => handleItemClick(conv)}
                  onContextMenu={(e) => handleContextMenu(e, conv._id)}
                  onTouchStart={() => handleLongPressStart(conv._id)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border hover:bg-secondary transition-colors select-none ${
                    isOpen || isChecked ? "bg-secondary" : ""
                  }`}
                >
                  {selectMode && (
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked
                          ? "bg-primary border-primary"
                          : "border-muted-foreground bg-transparent"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}

                  <div
                    className="relative shrink-0"
                    onClick={(e) => {
                      if (selectMode) return;
                      e.stopPropagation();
                      setViewingAvatar({ src: avatar, name: displayName });
                    }}
                  >
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${displayName}&background=2a3942&color=fff`;
                      }}
                    />
                    {dotClass && (
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${dotClass}`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-foreground font-medium truncate">{displayName}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.lastMessage?.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {conv.isGroup && <Users className="text-muted-foreground h-3 w-3" />}
                      </div>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-muted-foreground text-sm truncate">
                        {isWaitingReply
                          ? "Waiting for them to accept..."
                          : conv.lastMessage?.text || (conv.lastMessage?.image ? "📷 Photo" : "Say hi 👋")}
                      </p>
                      {unreadCounts[conv._id] > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0">
                          {unreadCounts[conv._id]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!selectMode && activeTab === "requests" && (
          <>
            {requests.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8 text-center">
                <Inbox className="h-10 w-10 mb-3" />
                <p className="text-sm">No message requests right now.</p>
              </div>
            )}
            {requests.map((conv) => {
              const other = getOtherParticipant(conv);
              const avatar =
                other?.avatar ||
                `https://ui-avatars.com/api/?name=${other?.fullName}&background=2a3942&color=fff`;
              return (
                <div
                  key={conv._id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border"
                >
                  <img
                    src={avatar}
                    alt={other?.fullName}
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{other?.fullName}</p>
                    <p className="text-muted-foreground text-sm truncate">
                      {conv.lastMessage?.text || "wants to send you a message"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => handleAcceptRequest(conv._id, e)}
                        className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button
                        onClick={(e) => handleDeclineRequest(conv._id, e)}
                        className="flex items-center gap-1 bg-secondary text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-full"
                      >
                        <X className="h-3 w-3" /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(conv) => {
            handleConversationUpsert(conv);
            setShowNewChat(false);
          }}
        />
      )}

      {showNewGroup && (
        <CreateGroupModal
          onClose={() => setShowNewGroup(false)}
          onGroupCreated={(conv) => {
            handleConversationUpsert(conv);
            setShowNewGroup(false);
          }}
        />
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showPrivacy && <PrivacySettingsModal onClose={() => setShowPrivacy(false)} />}
      {showAccount && <AccountSettingsModal onClose={() => setShowAccount(false)} />}
      {showBlocked && <BlockedUsersModal onClose={() => setShowBlocked(false)} />}
      {showHelp && <HelpAboutModal onClose={() => setShowHelp(false)} />}

      {viewingAvatar &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setViewingAvatar(null)}
          >
            <button
              className="absolute top-4 right-4 z-[101] bg-black/50 hover:bg-black/70 rounded-full p-2 text-white"
              onClick={() => setViewingAvatar(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={viewingAvatar.src}
              alt={viewingAvatar.name}
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default Sidebar;