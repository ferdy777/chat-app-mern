import { useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import api from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AccountSettingsModal = ({ onClose }) => {
  const { authUser, setAuthUser, logout } = useAuth();
  const [tab, setTab] = useState("password"); // "password" | "email" | "delete"

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  // Delete
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setPwSaving(true);
    try {
      await api.put("/users/change-password", { currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update password");
    } finally {
      setPwSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast.error("Enter a new email");
      return;
    }
    setEmailSaving(true);
    try {
      const { data } = await api.put("/users/change-email", {
        newEmail: newEmail.trim(),
        password: emailPassword,
      });
      setAuthUser(data);
      toast.success("Email updated");
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update email");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Enter your password to confirm");
      return;
    }
    setDeleting(true);
    try {
      await api.delete("/users/account", { data: { password: deletePassword } });
      toast.success("Account deleted");
      logout();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border px-6 gap-4 shrink-0">
          {[
            { key: "password", label: "Password" },
            { key: "email", label: "Email" },
            { key: "delete", label: "Delete" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm py-2.5 border-b-2 transition-colors ${
                tab === t.key
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {tab === "password" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Current password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleChangePassword} disabled={pwSaving} className="w-full">
                {pwSaving ? "Updating..." : "Update password"}
              </Button>
            </>
          )}

          {tab === "email" && (
            <>
              <p className="text-xs text-muted-foreground">
                Current: <span className="text-foreground">{authUser.email}</span>
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">New email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm password</Label>
                <div className="relative">
                  <Input
                    type={showEmailPw ? "text" : "password"}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowEmailPw((v) => !v)}
                  >
                    {showEmailPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleChangeEmail} disabled={emailSaving} className="w-full">
                {emailSaving ? "Updating..." : "Update email"}
              </Button>
            </>
          )}

          {tab === "delete" && (
            <>
              <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-sm rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  This permanently deletes your account. Your messages stay in other people's
                  chats but show as [deleted account]. This can't be undone.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm password</Label>
                <div className="relative">
                  <Input
                    type={showDeletePw ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowDeletePw((v) => !v)}
                  >
                    {showDeletePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(e) => setConfirmDelete(e.target.checked)}
                />
                I understand this can't be undone
              </label>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!confirmDelete || deleting}
                className="w-full"
              >
                {deleting ? "Deleting..." : "Delete my account"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSettingsModal;