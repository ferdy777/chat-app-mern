import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import api from "../utils/axios";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NewChatModal = ({ onClose, onConversationCreated }) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get(query ? `/users/search?query=${query}` : "/users");
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [query]);

  const startConversation = async (userId) => {
    setLoading(true);
    try {
      const { data } = await api.post("/conversations", { receiverId: userId });
      onConversationCreated(data);
    } catch (err) {
      toast.error("Could not start conversation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
        </DialogHeader>

        <div className="p-3 shrink-0">
          <div className="flex items-center bg-secondary rounded-lg px-3 py-2">
            <Search className="text-muted-foreground h-4 w-4 mr-3 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search name, username or email"
              className="bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          {users.map((u) => (
            <div
              key={u._id}
              onClick={() => !loading && startConversation(u._id)}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary cursor-pointer transition-colors"
            >
              <img
                src={u.avatar || `https://ui-avatars.com/api/?name=${u.fullName}&background=2a3942&color=fff`}
                alt={u.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="text-foreground text-sm font-medium">{u.fullName}</p>
                <p className="text-muted-foreground text-xs">@{u.username}</p>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-6">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatModal;
