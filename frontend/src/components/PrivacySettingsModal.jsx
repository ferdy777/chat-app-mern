import { useState } from "react";
import toast from "react-hot-toast";
import api from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const PrivacySettingsModal = ({ onClose }) => {
  const { authUser, setAuthUser } = useAuth();
  const [lastSeenVisible, setLastSeenVisible] = useState(
    authUser.privacy?.lastSeenVisible !== false
  );
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(
    authUser.privacy?.readReceiptsEnabled !== false
  );
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key, value, setter) => {
    setter(value); // optimistic
    setSaving(true);
    try {
      const { data } = await api.put("/users/privacy", { [key]: value });
      setAuthUser(data);
    } catch (err) {
      setter(!value); // revert on failure
      toast.error(err.response?.data?.message || "Could not update setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Privacy</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="lastSeen" className="text-sm font-medium">
                Last seen
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Let others see when you were last online. If off, you also won't see theirs.
              </p>
            </div>
            <Switch
              id="lastSeen"
              checked={lastSeenVisible}
              disabled={saving}
              onCheckedChange={(v) => handleToggle("lastSeenVisible", v, setLastSeenVisible)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="readReceipts" className="text-sm font-medium">
                Read receipts
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Show blue ticks when you've read a message. If off, you won't see others' either.
              </p>
            </div>
            <Switch
              id="readReceipts"
              checked={readReceiptsEnabled}
              disabled={saving}
              onCheckedChange={(v) => handleToggle("readReceiptsEnabled", v, setReadReceiptsEnabled)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacySettingsModal;