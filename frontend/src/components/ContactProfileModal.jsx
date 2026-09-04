import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const ContactProfileModal = ({
  conversation,
  currentUserId,
  onlineUsers = [],
  userStatuses = {},
  onClose,
}) => {
  const [showFullAvatar, setShowFullAvatar] = useState(false);

  const isGroup = conversation.isGroup;
  const otherParticipant = isGroup
    ? null
    : conversation.participants.find((p) => p._id !== currentUserId);

  const displayName = isGroup ? conversation.groupName : otherParticipant?.fullName;
  const avatarSrc = isGroup
    ? conversation.groupAvatar ||
      `https://ui-avatars.com/api/?name=${conversation.groupName}&background=2a3942&color=fff`
    : otherParticipant?.avatar ||
      `https://ui-avatars.com/api/?name=${otherParticipant?.fullName}&background=2a3942&color=fff`;

  const isOnline =
    !isGroup && (onlineUsers.includes(otherParticipant?._id) || otherParticipant?.username === "chatapp_bot");

  const lastSeenHidden = otherParticipant?.privacy?.lastSeenVisible === false;

  const lastSeenText =
    otherParticipant?.lastSeen && otherParticipant?.username !== "chatapp_bot" && !lastSeenHidden
      ? `last seen ${formatDistanceToNow(new Date(otherParticipant.lastSeen), { addSuffix: true })}`
      : "offline";

  const otherStatus = otherParticipant ? userStatuses[otherParticipant._id] : null;
  const onlineStatusText =
    otherStatus === "away" ? "away" : otherStatus === "busy" ? "busy" : "online";

  const statusText = isOnline ? onlineStatusText : lastSeenText;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isGroup ? "Group info" : "Contact info"}</DialogTitle>
          </DialogHeader>

          <div className="p-6 flex flex-col items-center overflow-y-auto">
            <Avatar
              className="w-28 h-28 cursor-pointer"
              onClick={() => setShowFullAvatar(true)}
            >
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="text-3xl bg-primary/15 text-primary">
                {displayName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <h2 className="text-lg font-semibold text-card-foreground mt-4">{displayName}</h2>

            {!isGroup && (
              <p className="text-sm text-muted-foreground mt-1">{statusText}</p>
            )}

            {isGroup ? (
              <div className="w-full mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {conversation.participants.length} members
                </div>
                <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                  {conversation.participants.map((p) => (
                    <div key={p._id} className="flex items-center gap-3 px-3 py-2">
                      <img
                        src={
                          p.avatar ||
                          `https://ui-avatars.com/api/?name=${p.fullName}&background=2a3942&color=fff`
                        }
                        alt={p.fullName}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <span className="text-sm text-foreground truncate">
                        {p._id === currentUserId ? "You" : p.fullName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full mt-6 space-y-4">
                {otherParticipant?.bio && (
                  <div>
                    <p className="text-xs text-primary mb-1">About</p>
                    <p className="text-sm text-foreground">{otherParticipant.bio}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  @{otherParticipant?.username}
                  {otherParticipant?.email ? ` · ${otherParticipant.email}` : ""}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showFullAvatar &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullAvatar(false)}
          >
            <button
              className="absolute top-4 right-4 z-[101] bg-black/50 hover:bg-black/70 rounded-full p-2 text-white"
              onClick={() => setShowFullAvatar(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={avatarSrc}
              alt={displayName}
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default ContactProfileModal;