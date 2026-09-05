import { useRef, useState, useEffect } from "react";
import { BsEmojiSmile, BsPaperclip } from "react-icons/bs";
import { Send, X, ImageOff } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Button } from "@/components/ui/button";

const TYPING_TIMER_LENGTH = 2000;

const MessageInput = ({ onSend, onTyping, onStopTyping, onFocusInput, replyingTo, onCancelReply }) => {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Focus the text field the moment a reply is picked, same as WhatsApp.
  useEffect(() => {
    if (replyingTo) textInputRef.current?.focus();
  }, [replyingTo]);

  const handleChange = (e) => {
    setText(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping();
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onStopTyping();
    }, TYPING_TIMER_LENGTH);
  };

  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    onSend({ text: text.trim(), imageBase64: imagePreview });

    setText("");
    setImageFile(null);
    setImagePreview(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    isTypingRef.current = false;
    onStopTyping();

    // Belt-and-suspenders: onMouseDown on the Send button (below) already
    // stops focus from leaving the input in the first place, but this
    // covers submits triggered other ways (e.g. hitting Enter on desktop
    // shouldn't need it, but some mobile keyboards' "send" action key can
    // still momentarily blur the field).
    textInputRef.current?.focus();
  };

  return (
    <div
      className="bg-card border-t border-border px-2 sm:px-4 py-2 sm:py-3 relative shrink-0"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {replyingTo && (
        <div className="flex items-center justify-between bg-secondary/60 border-l-2 border-primary rounded-md px-3 py-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary truncate">
              Replying to {replyingTo.sender?.fullName || "message"}
            </p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {replyingTo.image ? (
                <>
                  <ImageOff className="h-3 w-3 shrink-0" /> Photo
                </>
              ) : (
                replyingTo.text
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 p-1 rounded-full hover:bg-secondary ml-2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="relative inline-block mb-2">
          <img src={imagePreview} alt="preview" className="h-24 rounded-md" />
          <button
            onClick={() => {
              setImagePreview(null);
              setImageFile(null);
            }}
            className="absolute -top-2 -right-2 bg-foreground/80 text-background rounded-full w-5 h-5 text-xs"
          >
            ×
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-full left-2 sm:left-4 mb-2 z-20 max-w-[calc(100vw-1rem)]">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="auto"
            // Same fix as the reaction picker: the library auto-focuses its
            // search box by default, which pops the keyboard open the
            // moment you tap this button — shoving the picker (which sits
            // right above the text input) around right when you're trying
            // to browse it. Tapping the actual text field still opens the
            // keyboard normally; this just stops the picker itself from
            // triggering it.
            autoFocusSearch={false}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="shrink-0 p-1"
        >
          <BsEmojiSmile className="text-muted-foreground text-lg sm:text-xl cursor-pointer" />
        </button>
        <label className="cursor-pointer shrink-0 p-1">
          <BsPaperclip className="text-muted-foreground text-lg sm:text-xl" />
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImagePick} className="hidden" />
        </label>
        <input
          ref={textInputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onFocus={onFocusInput}
          placeholder="Type a message"
          className="flex-1 min-w-0 bg-secondary text-foreground text-sm rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full shrink-0 h-9 w-9 sm:h-10 sm:w-10 mr-0.5 sm:mr-0"
          disabled={!text.trim() && !imagePreview}
          // The real fix: without this, tapping Send shifts focus to the
          // button before the click/submit logic runs, and that focus
          // shift is exactly what closes the mobile keyboard — forcing you
          // to tap the text field again before every single message.
          // Blocking the default mousedown/touch behavior keeps focus on
          // the input the entire time, so the keyboard stays open and you
          // can keep typing straight after sending.
          onMouseDown={(e) => e.preventDefault()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default MessageInput;