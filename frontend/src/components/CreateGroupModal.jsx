import { useEffect, useState } from "react";
import { Search, Check, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CreateGroupModal = ({ onClose, onGroupCreated }) => {
  const [step, setStep] = useState(1); // 1 = pick members, 2 = name the group
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const toggleUser = (user) => {
    setSelected((prev) =>
      prev.find((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length < 2) return;
    setCreating(true);
    try {
      const { data } = await api.post("/conversations/group", {
        groupName: groupName.trim(),
        participantIds: selected.map((u) => u._id),
      });
      onGroupCreated(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Add group members" : "Name your group"}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="p-3 shrink-0">
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selected.map((u) => (
                    <span
                      key={u._id}
                      onClick={() => toggleUser(u)}
                      className="bg-primary/15 text-primary text-xs px-2 py-1 rounded-full cursor-pointer"
                    >
                      {u.fullName} ×
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center bg-secondary rounded-lg px-3 py-2">
                <Search className="text-muted-foreground h-4 w-4 mr-3 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people to add"
                  className="bg-transparent outline-none text-sm text-foreground w-full placeholder:text-muted-foreground"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {users.map((u) => {
                const isSelected = selected.some((s) => s._id === u._id);
                return (
                  <div
                    key={u._id}
                    onClick={() => toggleUser(u)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary cursor-pointer transition-colors"
                  >
                    <img
                      src={u.avatar || `https://ui-avatars.com/api/?name=${u.fullName}&background=2a3942&color=fff`}
                      alt={u.fullName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-medium">{u.fullName}</p>
                      <p className="text-muted-foreground text-xs">@{u.username}</p>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="text-primary-foreground h-3 w-3" />
                      </span>
                    )}
                  </div>
                );
              })}
              {users.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-6">No users found</p>
              )}
            </div>

            <div className="p-3 shrink-0">
              <Button
                disabled={selected.length < 2}
                onClick={() => setStep(2)}
                className="w-full"
              >
                Next {selected.length > 0 && `(${selected.length})`}
              </Button>
              {selected.length === 1 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Pick at least 2 people for a group
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <div className="p-6 flex flex-col items-center flex-1 overflow-y-auto">
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-6">
              {groupName ? (
                <span className="text-4xl">{groupName[0].toUpperCase()}</span>
              ) : (
                <Users className="h-10 w-10" />
              )}
            </div>
            <Input
              autoFocus
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="text-center text-lg border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {selected.length} members: {selected.map((u) => u.fullName).join(", ")}
            </p>

            <div className="w-full mt-8 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!groupName.trim() || creating}
                className="flex-1"
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
