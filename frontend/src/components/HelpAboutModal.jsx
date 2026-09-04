import { Mail, Github, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Bump this manually whenever you ship a meaningful change — no build tooling needed for it.
const APP_VERSION = "1.0.0";

const HelpAboutModal = ({ onClose }) => {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Help & about</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* App information */}
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              ChatApp
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Version {APP_VERSION}
            </p>
          </div>

          {/* Links */}
          <div className="space-y-1">
            {/* Contact Support */}
            <a
              href="mailto:support@example.com"
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary text-sm text-foreground"
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>Contact support</span>
            </a>

            {/* View Source */}
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary text-sm text-foreground"
            >
              <Github className="h-4 w-4 text-muted-foreground" />
              <span>View source</span>
            </a>

            {/* Terms & Privacy */}
            <a
              href="#"
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary text-sm text-foreground"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Terms & privacy policy</span>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpAboutModal;