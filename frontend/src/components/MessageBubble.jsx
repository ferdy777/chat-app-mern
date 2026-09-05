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
const MENU_WIDTH = 180;
const MENU_ROW_HEIGHT = 40;
const MENU_PADDING = 8;

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
  onEditingChange,
  onReactionsChange,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [pickerPosition, setPickerPosition] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [showActions, setShowActions] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const time = message.createdAt ? format(new Date(message.createdAt), "HH:mm") : "";
  const bubbleRef = useRef(null);
  const menuRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const editTextareaRef = useRef(null);
  const hasReactions = message.reactions?.length > 0;

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const gestureRef = useRef(null); // null | "swipe" | "scroll"
  const suppressClickRef = useRef(false);
  const hasVibratedRef = useRef(false);

  const canEdit = isOwn && !message.image;
  const canDelete = isOwn;
  // Reply + React are always available; Edit/Delete only for your own
  // messages — used both to size the menu and to decide what to render.
  const menuItemCount = 2 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0);

  const updateMenuPosition = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuHeight = menuItemCount * MENU_ROW_HEIGHT + MENU_PADDING;

    let left = isOwn ? rect.right - MENU_WIDTH : rect.left;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN);

    let top = rect.top - menuHeight - 6;
    if (top < VIEWPORT_MARGIN) {
      top = rect.bottom + 6;
    }

    setMenuPosition({ top, left });
  };

  const updateReactionPickerPosition = () => {
    const rect = bubbleRef.current?.getBoundingClientRect();
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

  const toggleActions = () => {
    // A swipe that just finished shouldn't also pop the menu open —
    // suppressClickRef is set during the swipe and cleared shortly after
    // touchend, once the resulting synthetic click has been swallowed.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isEditing) return;
    if (!showActions) updateMenuPosition();
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
        return;
      }
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
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActions]);

  // Tell the parent (ChatWindow) whenever the reaction picker opens/closes
  // so it can hold off its own auto-scroll-to-bottom logic — same problem
  // the edit textarea had: something resizing the viewport while this is
  // open would otherwise yank the message list (and this picker along
  // with it, visually) away from where you tapped.
  useEffect(() => {
    onReactionsChange?.(showReactions);
    if (!showReactions) return;

    // Bring the bubble fully into view FIRST, then measure it — the picker
    // is a fixed-position overlay placed relative to the bubble's on-screen
    // rect, so if the bubble was only partially visible (near the top/
    // bottom edge) when tapped, computing position off that rect put the
    // picker somewhere that didn't line up with what you could actually see.
    // "auto" (instant, not "smooth") so the rect below reflects the final,
    // settled position rather than mid-animation.
    bubbleRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    updateReactionPickerPosition();

    const handleClickOutside = (e) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
        setShowReactions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateReactionPickerPosition, true);
    window.addEventListener("resize", updateReactionPickerPosition);
    // Recompute position on keyboard show/hide too, not just plain resize —
    // this is the actual fix for "have to scroll up to see the picker".
    window.visualViewport?.addEventListener("resize", updateReactionPickerPosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateReactionPickerPosition, true);
      window.removeEventListener("resize", updateReactionPickerPosition);
      window.visualViewport?.removeEventListener("resize", updateReactionPickerPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReactions]);

  // Auto-grow the edit textarea to fit its content (up to a sane cap) so
  // the WHOLE message is visible while editing instead of a tiny one-line
  // box you had to scroll/drag through to see the rest of the text.
  //
  // Also tell the parent (ChatWindow) that we're editing so it can hold
  // off its own "resize -> scroll to bottom" logic, and scroll THIS bubble
  // into view ourselves instead of letting that logic carry the viewport
  // down to the last message.
  useEffect(() => {
    onEditingChange?.(isEditing);
    if (!isEditing) return;
    const ta = editTextareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    bubbleRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Let the parent know editing/reacting has ended even if this bubble
  // unmounts (e.g. message deleted by someone else mid-edit).
  useEffect(() => {
    return () => {
      onEditingChange?.(false);
      onReactionsChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditTextChange = (e) => {
    setEditText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

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

  const handleCancelEdit = () => {
    setEditText(message.text || "");
    setIsEditing(false);
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

  const handleReactClick = () => {
    setShowActions(false);
    setShowReactions(true);
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
    ? "bg-blue-600 dark:bg-blue-500 text-white"
    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100";
  const timeColor = isOwn ? "text-blue-100/85" : "text-muted-foreground";
  const quoteBg = isOwn ? "bg-black/15" : "bg-black/5 dark:bg-white/5";

  return (
    <div
      id={`message-${message._id}`}
      className={`group relative flex ${isOwn ? "justify-end" : "justify-start"} px-4 py-0.5 ${
        hasReactions ? "mb-2.5" : ""
      }`}
    >
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ opacity: swipeProgress }}
      >
        <div
          className={`rounded-full p-2 transition-colors ${
            swipeArmed ? "bg-blue-600 text-white" : "bg-secondary text-muted-foreground"
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
          <div className="min-w-[220px] max-w-[280px]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] uppercase tracking-wide opacity-70 mb-1">Editing message</p>
            <textarea
              ref={editTextareaRef}
              value={editText}
              onChange={handleEditTextChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
              rows={1}
              className="w-full resize-none bg-background/80 text-foreground text-[15px] leading-snug rounded-md px-2.5 py-2 outline-none"
            />
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={handleCancelEdit}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleSaveEdit}
                className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          message.text && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words pr-12">
              {message.text}
            </p>
          )
        )}

        {!isEditing && (
          <span className={`text-xs float-right mt-1 ml-2 flex items-center gap-1 ${timeColor}`}>
            {message.isEdited && <span className="italic">edited</span>}
            {time}
            {isOwn &&
              (message.status === "read" ? (
                <BsCheckAll size={16} className="text-amber-300" />
              ) : message.status === "delivered" ? (
                <BsCheckAll size={16} />
              ) : (
                <BsCheck size={16} />
              ))}
          </span>
        )}

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

      {/* Full labeled menu (icon + text) instead of icon-only buttons — much
          clearer for anyone who wouldn't otherwise recognize what a bare
          icon does. Same floating/portal approach as before, so it never
          causes the bubble row to reflow when it opens. */}
      {showActions &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 bg-card border border-border shadow-lg rounded-lg py-1 overflow-hidden"
            style={{ top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
          >
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
              onClick={handleReplyClick}
            >
              <Reply className="h-4 w-4 text-muted-foreground shrink-0" />
              Reply
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
              onClick={handleReactClick}
            >
              <SmilePlus className="h-4 w-4 text-muted-foreground shrink-0" />
              React
            </button>
            {canEdit && (
              <button
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground hover:bg-secondary text-left"
                onClick={handleEditClick}
              >
                <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-destructive hover:bg-secondary text-left"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete
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
            <EmojiPicker
              onEmojiClick={handleReact}
              theme="auto"
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
              // The library auto-focuses its internal search box by default,
              // which is what was popping the keyboard open on tap — this is
              // a quick reaction picker, not a place to type, so turn it off.
              autoFocusSearch={false}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default MessageBubble;