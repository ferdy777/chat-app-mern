import { useRef, useState, useEffect } from "react";
import { BsEmojiSmile, BsPaperclip } from "react-icons/bs";
import { Send } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Button } from "@/components/ui/button";

const TYPING_TIMER_LENGTH = 2000;

const MessageInput = ({ onSend, onTyping, onStopTyping, onFocusInput }) => {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

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
  };

  return (
    <div
      className="bg-card border-t border-border px-2 sm:px-4 py-2 sm:py-3 relative shrink-0"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
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
          <EmojiPicker onEmojiClick={handleEmojiClick} theme="auto" />
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
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default MessageInput;