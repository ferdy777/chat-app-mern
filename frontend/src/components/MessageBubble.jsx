import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { SmilePlus, Pencil, Trash2, X, Check, Reply, ImageOff } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import api from "../utils/axios";

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 400;
const VIEWPORT_MARGIN = 8;
const TOOLBAR_HEIGHT = 44;

// Swipe-to-reply tuning — matches the WhatsApp feel: a little travel to
// "arm" the icon, then a firm swipe to actually trigger it.
const SWIPE_TRIGGER_THRESHOLD = 60; // px dragged right before releasing replies
const SWIPE_MAX_DRAG = 80; // px — how far the bubble can visually travel
const DIRECTION_LOCK_DISTANCE = 8; // px of initial movement before we decide swipe vs scroll vs tap

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
  const [showActions, setShowActions] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  // How far the bubble is currently dragged right, for the swipe-to-reply
  // gesture. 0 when idle/snapped back.
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const time = message.createdAt ? format(new Date(message.createdAt), "HH:mm") : "";
  const reactionButtonRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const bubbleRef = useRef(null);
  const toolbarRef = useRef(null);
  const hasReactions = message.reactions?.length > 0;

  // Swipe gesture bookkeeping — refs so they don't trigger re-renders on
  // every touchmove; only dragX (for the visible transform) does that.
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const gestureRef = useRef(null); // null | "swipe" | "scroll"
  const suppressClickRef = useRef(false);
  const hasVibratedRef = useRef(false);

  const canEdit = isOwn && !message.image;
  const canDelete = isOwn;

  const updateToolbarPosition = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;

    let left = isOwn ? rect.right - 160 : rect.left;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - 160 - VIEWPORT_MARGIN);

    let top = rect.top - TOOLBAR_HEIGHT - 6;
    if (top < VIEWPORT_MARGIN) {
      top = rect.bottom + 6;
    }

    setToolbarPosition({ top, left });
  };

  const toggleActions = () => {
    // A swipe that just finished shouldn't also pop the toolbar open —
    // suppressClickRef is set during the swipe and cleared shortly after
    // touchend, once the resulting synthetic click has been swallowed.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isEditing) return;
    if (!showActions) updateToolbarPosition();
    setShowActions((v) => !v);
  };

  // ---- Swipe-to-reply ----

  const handleTouchStart = (e) => {
    if (isEditing) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    gestureRef.current = null;
    hasVibratedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (isEditing) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (gestureRef.current === null) {
      if (Math.abs(deltaX) < DIRECTION_LOCK_DISTANCE && Math.abs(deltaY) < DIRECTION_LOCK_DISTANCE) {
        return; // not enough movement yet to tell tap from swipe from scroll
      }
      // Lock in a direction based on whichever axis moved further first.
      // Only a rightward horizontal drag counts as a reply-swipe — leftward
      // drags and any vertical movement fall through to normal scrolling.
      gestureRef.current = Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0 ? "swipe" : "scroll";
    }

    if (gestureRef.current !== "swipe") return;

    const clamped = Math.max(0, Math.min(deltaX, SWIPE_MAX_DRAG));
    setDragX(clamped);
    suppressClickRef.current = true;

    if (clamped >= SWIPE_TRIGGER_THRESHOLD && !hasVibratedRef.current) {
      hasVibratedRef.current = true;
      navigator.vibrate?.(15);
    } else if (clamped < SWIPE_TRIGGER_THRESHOLD) {
      hasVibratedRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (gestureRef.current === "swipe" && dragX >= SWIPE_TRIGGER_THRESHOLD) {
      onReply?.(message);
    }
    setDragX(0);
    setIsDragging(false);

    // Keep the click-suppression active for a beat so the synthetic click
    // that follows touchend on mobile doesn't also open the tap toolbar.
    if (gestureRef.current === "swipe") {
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 300);
    }
    gestureRef.current = null;
  };

  useEffect(() => {
    if (!showActions) return;

    const handleClickOutside = (e) => {
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(e.target) &&
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target)
      ) {
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateToolbarPosition, true);
    window.addEventListener("resize", updateToolbarPosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateToolbarPosition, true);
      window.removeEventListener("resize", updateToolbarPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActions]);

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
    setShowActions(false);
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
    setShowActions(false);
    try {
      await api.delete(`/messages/${message._id}`);
      onDeleted?.(message._id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplyClick = () => {
    setShowActions(false);
    onReply?.(message);
  };

  const handleEditClick = () => {
    setShowActions(false);
    setIsEditing(true);
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
  const swipeProgress = Math.min(dragX / SWIPE_TRIGGER_THRESHOLD, 1);
  const swipeArmed = dragX >= SWIPE_TRIGGER_THRESHOLD;

  const bubbleColor = isOwn
    ? "bg-indigo-600 dark:bg-indigo-500 text-white"
    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100";
  const timeColor = isOwn ? "text-indigo-100/85" : "text-muted-foreground";
  const quoteBg = isOwn ? "bg-black/15" : "bg-black/5 dark:bg-white/5";

  return (
    <div
      id={`message-${message._id}`}
      className={`group relative flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5 ${
        hasReactions ? "mb-2.5" : ""
      }`}
    >
      {/* Reply icon revealed behind the bubble as it's dragged right —
          fixed near the left of the row regardless of whether the message
          itself is left- or right-aligned, matching the WhatsApp gesture. */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: swipeProgress }}
      >
        <div
          className={`rounded-full p-2 transition-colors ${
            swipeArmed ? "bg-indigo-600 text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Reply className="h-4 w-4" />
        </div>
      </div>

      <div
        ref={bubbleRef}
        onClick={toggleActions}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`max-w-[85%] sm:max-w-[65%] rounded-lg px-3 py-2 shadow relative cursor-pointer select-none ${bubbleColor}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        {reply && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJumpToMessage?.(reply._id);
            }}
            className={`block w-full text-left mb-1.5 pl-2 border-l-2 border-white/60 rounded-r px-2 py-1 ${quoteBg}`}
          >
            <p className="text-xs font-semibold truncate opacity-90">
              {reply.sender?.fullName || "Unknown"}
            </p>
            <p className="text-xs truncate opacity-75 flex items-center gap-1">
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
            className="rounded-md mb-1 max-h-64 object-cover"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick?.(message.image);
            }}
          />
        )}

        {isEditing ? (
          <div className="flex items-center gap-1 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              className="flex-1 bg-background/70 text-foreground text-sm rounded px-2 py-1 outline-none"
            />
            <Check className="h-4 w-4 cursor-pointer" onClick={handleSaveEdit} />
            <X className="h-4 w-4 cursor-pointer" onClick={() => setIsEditing(false)} />
          </div>
        ) : (
          message.text && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words pr-12">
              {message.text}
            </p>
          )
        )}

        <span className={`text-xs float-right mt-1 ml-2 flex items-center gap-1 ${timeColor}`}>
          {message.isEdited && <span className="italic">edited</span>}
          {time}
          {isOwn &&
            (message.status === "read" ? (
              <BsCheckAll size={16} className="text-sky-300" />
            ) : message.status === "delivered" ? (
              <BsCheckAll size={16} />
            ) : (
              <BsCheck size={16} />
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

      {showActions &&
        toolbarPosition &&
        createPortal(
          <div
            ref={toolbarRef}
            className="fixed z-50 bg-card border border-border shadow-lg rounded-full flex items-center gap-0.5 px-1 py-1"
            style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
          >
            <button className="p-2 rounded-full hover:bg-secondary" onClick={handleReplyClick} title="Reply">
              <Reply className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              ref={reactionButtonRef}
              className="p-2 rounded-full hover:bg-secondary"
              onClick={() => setShowReactions((v) => !v)}
              title="React"
            >
              <SmilePlus className="h-4 w-4 text-muted-foreground" />
            </button>
            {canEdit && (
              <button className="p-2 rounded-full hover:bg-secondary" onClick={handleEditClick} title="Edit">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {canDelete && (
              <button
                className="p-2 rounded-full hover:bg-secondary"
                onClick={handleDelete}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            )}
          </div>,
          document.body
        )}

      {showReactions &&
        pickerPosition &&
        createPortal(
          <div
            ref={reactionPickerRef}
            className="fixed z-50"
            style={{ top: pickerPosition.top, left: pickerPosition.left }}
          >
            <EmojiPicker onEmojiClick={handleReact} theme="auto" width={PICKER_WIDTH} height={PICKER_HEIGHT} />
          </div>,
          document.body
        )}
    </div>
  );
};

export default MessageBubble;