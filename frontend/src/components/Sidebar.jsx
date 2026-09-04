import { useEffect, useState } from "react";
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
} from "lucide-react";
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
  const { authUser, logout } = useAuth();
  const { onlineUsers, userStatuses, setMyStatus } = useSocket();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get("/conversations");
        setConversations(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchConversations();
  }, []);

  useEffect(() => {
    subscribeToPush();
  }, []);

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

  const myStatus = userStatuses[authUser._id] || "online";
  const activeStatus = STATUS_OPTIONS.find((s) => s.value === myStatus) || STATUS_OPTIONS[0];

  return (
    <div
      className={`w-full sm:w-[380px] shrink-0 h-full bg-card flex-col border-r border-border ${
        selectedConversation ? "hidden sm:flex" : "flex"
      }`}
    >
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

              {/* Status options nested in a submenu */}
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

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8 text-center">
            <MessageCircle className="h-10 w-10 mb-3" />
            <p className="text-sm">No chats yet. Tap + to start a new conversation.</p>
          </div>
        )}
        {conversations.length > 0 && visibleConversations.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">
            No chats match &quot;{search}&quot;
          </p>
        )}
        {visibleConversations.map((conv) => {
          const other = getOtherParticipant(conv);
          const displayName = getDisplayName(conv);
          const avatar = conv.isGroup
            ? conv.groupAvatar ||
              `https://ui-avatars.com/api/?name=${conv.groupName}&background=2a3942&color=fff`
            : other?.avatar ||
              `https://ui-avatars.com/api/?name=${other?.fullName}&background=2a3942&color=fff`;
          const isOnline =
            !conv.isGroup && (onlineUsers.includes(other?._id) || other?.username === "chatapp_bot");
          const dotClass = !conv.isGroup ? getStatusDotClass(other?._id, isOnline) : "";
          const isSelected = selectedConversation?._id === conv._id;

          return (
            <div
              key={conv._id}
              onClick={() => setSelectedConversation(conv)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border hover:bg-secondary transition-colors ${
                isSelected ? "bg-secondary" : ""
              }`}
            >
              <div
                className="relative shrink-0"
                onClick={(e) => {
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
                    {conv.lastMessage?.text || (conv.lastMessage?.image ? "📷 Photo" : "Say hi 👋")}
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