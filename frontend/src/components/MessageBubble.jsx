import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { SmilePlus, MoreVertical, Pencil, Trash2, X, Check, Reply, ImageOff } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import api from "../utils/axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 400;
const VIEWPORT_MARGIN = 8;

const MessageBubble = ({
  message,
  isOwn,
  onUpdated,
  onDeleted,
  onReply,
  onImageClick,
  onJumpToMessage,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [pickerPosition, setPickerPosition] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const time = message.createdAt ? format(new Date(message.createdAt), "HH:mm") : "";
  const reactionButtonRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const hasReactions = message.reactions?.length > 0;

  useEffect(() => {
    if (!showReactions) return;
    const handleClickOutside = (e) => {
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target) &&
        !reactionButtonRef.current.contains(e.target)
      ) {
        setShowReactions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReactions]);

  useEffect(() => {
    if (!showReactions) return;

    const updatePosition = () => {
      const rect = reactionButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      let left = isOwn ? rect.right - PICKER_WIDTH : rect.left;
      left = Math.min(
        Math.max(left, VIEWPORT_MARGIN),
        window.innerWidth - PICKER_WIDTH - VIEWPORT_MARGIN
      );

      let top = rect.bottom + 4;
      if (top + PICKER_HEIGHT > window.innerHeight - VIEWPORT_MARGIN) {
        top = rect.top - PICKER_HEIGHT - 4;
      }

      setPickerPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showReactions, isOwn]);

  const handleReact = async (emojiData) => {
    setShowReactions(false);
    try {
      const { data } = await api.post(`/messages/${message._id}/react`, { emoji: emojiData.emoji });
      onUpdated?.(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      const { data } = await api.put(`/messages/${message._id}`, { text: editText.trim() });
      onUpdated?.(data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/messages/${message._id}`);
      onDeleted?.(message._id);
    } catch (err) {
      console.error(err);
    }
  };

  if (message.isDeleted) {
    return (
      <div
        id={`message-${message._id}`}
        className={`flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5`}
      >
        <div className="max-w-[85%] sm:max-w-[65%] rounded-lg px-3 py-2 bg-muted/50 italic text-muted-foreground text-sm">
          This message was deleted
        </div>
      </div>
    );
  }

  const reply = message.replyTo;

  return (
    <div
      id={`message-${message._id}`}
      className={`group flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5 ${
        hasReactions ? "mb-2.5" : ""
      }`}
    >
      <div className={`flex items-center gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
        <div
          className={`max-w-[85%] sm:max-w-[65%] rounded-lg px-3 py-2 shadow relative text-foreground ${
            isOwn ? "bg-wa-bubbleOut" : "bg-wa-bubbleIn"
          }`}
        >
          {reply && (
            <button
              type="button"
              onClick={() => onJumpToMessage?.(reply._id)}
              className="block w-full text-left mb-1.5 pl-2 border-l-2 border-primary/70 bg-black/10 dark:bg-white/5 rounded-r px-2 py-1"
            >
              <p className="text-xs font-medium text-primary truncate">
                {reply.sender?.fullName || "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                {reply.isDeleted ? (
                  "This message was deleted"
                ) : reply.image ? (
                  <>
                    <ImageOff className="h-3 w-3 shrink-0" /> Photo
                  </>
                ) : (
                  reply.text
                )}
              </p>
            </button>
          )}

          {message.image && (
            <img
              src={message.image}
              alt="attachment"
              className="rounded-md mb-1 max-h-64 object-cover cursor-pointer"
              onClick={() => onImageClick?.(message.image)}
            />
          )}

          {isEditing ? (
            <div className="flex items-center gap-1 min-w-[180px]">
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                className="flex-1 bg-background/60 text-sm rounded px-2 py-1 outline-none"
              />
              <Check className="h-4 w-4 cursor-pointer text-primary" onClick={handleSaveEdit} />
              <X className="h-4 w-4 cursor-pointer" onClick={() => setIsEditing(false)} />
            </div>
          ) : (
            message.text && <p className="text-sm whitespace-pre-wrap break-words pr-12">{message.text}</p>
          )}

          <span className="text-[10px] text-muted-foreground float-right mt-1 ml-2 flex items-center gap-1">
            {message.isEdited && <span className="italic">edited</span>}
            {time}
            {isOwn &&
              (message.status === "read" ? (
                <BsCheckAll className="text-blue-500" />
              ) : message.status === "delivered" ? (
                <BsCheckAll />
              ) : (
                <BsCheck />
              ))}
          </span>

          {hasReactions && (
            <div className="absolute -bottom-3 right-2 z-10 bg-card border border-border rounded-full px-1.5 py-0.5 text-xs shadow flex gap-0.5">
              {[...new Set(message.reactions.map((r) => r.emoji))].map((emoji) => (
                <span key={emoji}>{emoji}</span>
              ))}
              {message.reactions.length > 1 && (
                <span className="text-muted-foreground">{message.reactions.length}</span>
              )}
            </div>
          )}
        </div>

        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 relative">
          <button
            className="p-1 rounded-full hover:bg-secondary"
            onClick={() => onReply?.(message)}
            title="Reply"
          >
            <Reply className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            ref={reactionButtonRef}
            className="p-1 rounded-full hover:bg-secondary"
            onClick={() => setShowReactions((v) => !v)}
          >
            <SmilePlus className="h-4 w-4 text-muted-foreground" />
          </button>

          {showReactions &&
            pickerPosition &&
            createPortal(
              <div
                ref={reactionPickerRef}
                className="fixed z-50"
                style={{ top: pickerPosition.top, left: pickerPosition.left }}
              >
                <EmojiPicker
                  onEmojiClick={handleReact}
                  theme="auto"
                  width={PICKER_WIDTH}
                  height={PICKER_HEIGHT}
                />
              </div>,
              document.body
            )}

          {isOwn && !message.image && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-full hover:bg-secondary">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;