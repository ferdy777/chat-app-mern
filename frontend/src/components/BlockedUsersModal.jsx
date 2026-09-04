import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UserX } from "lucide-react";
import api from "../utils/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const BlockedUsersModal = ({ onClose }) => {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    const fetchBlocked = async () => {
      try {
        const { data } = await api.get("/users/blocked");
        setBlocked(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlocked();
  }, []);

  const handleUnblock = async (userId) => {
    setUnblockingId(userId);
    try {
      await api.delete(`/users/block/${userId}`);
      setBlocked((prev) => prev.filter((u) => u._id !== userId));
      toast.success("User unblocked");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not unblock user");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blocked users</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto min-h-[120px]">
          {loading && <p className="text-center text-muted-foreground text-sm py-6">Loading...</p>}

          {!loading && blocked.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <UserX className="h-8 w-8 mb-2" />
              <p className="text-sm">No blocked users</p>
            </div>
          )}

          {blocked.map((u) => (
            <div key={u._id} className="flex items-center gap-3 px-4 py-2.5">
              <img
                src={u.avatar || `https://ui-avatars.com/api/?name=${u.fullName}&background=2a3942&color=fff`}
                alt={u.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-medium truncate">{u.fullName}</p>
                <p className="text-muted-foreground text-xs">@{u.username}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={unblockingId === u._id}
                onClick={() => handleUnblock(u._id)}
              >
                {unblockingId === u._id ? "..." : "Unblock"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedUsersModal;