import { useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ProfileModal = ({ onClose }) => {
  const { authUser, setAuthUser } = useAuth();
  const [fullName, setFullName] = useState(authUser.fullName);
  const [bio, setBio] = useState(authUser.bio || "");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showFullAvatar, setShowFullAvatar] = useState(false);

  const currentAvatarSrc = avatarPreview || authUser.avatar;

  const handleAvatarPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/users/profile", {
        fullName,
        bio,
        avatarBase64: avatarPreview || undefined,
      });
      setAuthUser(data);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>

          <div className="p-6 flex flex-col items-center overflow-y-auto">
            <div className="relative">
              <Avatar
                className={`w-28 h-28 ${currentAvatarSrc ? "cursor-pointer" : ""}`}
                onClick={() => currentAvatarSrc && setShowFullAvatar(true)}
              >
                <AvatarImage src={currentAvatarSrc} alt={authUser.fullName} />
                <AvatarFallback className="text-3xl bg-primary/15 text-primary">
                  {authUser.fullName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                className="absolute bottom-0 right-0 bg-primary rounded-full w-9 h-9 flex items-center justify-center cursor-pointer border-2 border-card"
                onClick={(e) => e.stopPropagation()}
              >
                <Camera className="text-primary-foreground h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
              </label>
            </div>

            <div className="w-full mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-primary text-xs">
                  Your name
                </Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-primary text-xs">
                  About
                </Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} />
              </div>

              <p className="text-xs text-muted-foreground">
                @{authUser.username} · {authUser.email}
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full mt-6">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showFullAvatar &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullAvatar(false)}
          >
            <button
              className="absolute top-4 right-4 z-[101] bg-black/50 hover:bg-black/70 rounded-full p-2 text-white"
              onClick={() => setShowFullAvatar(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={currentAvatarSrc}
              alt={authUser.fullName}
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default ProfileModal;