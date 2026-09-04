import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "../utils/axios";

const GuestBotWidget = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hey! Send a message to see the chat in action — no sign up needed." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { sender: "me", text }]);
    setInput("");
    setSending(true);

    try {
      const res = await api.post("/bot/chat", { text });
      setMessages((prev) => [...prev, { sender: "bot", text: res.data.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Oops, couldn't reach the server. Try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg hover:opacity-90 transition"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium">Try the chat</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
        <span className="text-sm font-semibold">ChatApp Bot (guest demo)</span>
        <button onClick={() => setOpen(false)} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 max-h-80 overflow-y-auto px-3 py-3 space-y-2 bg-background">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-lg px-3 py-1.5 text-sm max-w-[80%] ${
                m.sender === "me"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 p-2 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};

export default GuestBotWidget;