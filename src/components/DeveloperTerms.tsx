import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const TERMS = [
  {
    title: "1. Developer account",
    body: "You confirm that the information on your developer profile is accurate and that you are legally able to publish software in Malawi. One person or organisation per developer account.",
  },
  {
    title: "2. Publishing subscription",
    body: "Keeping listings live requires the MK5,000 monthly publishing subscription. Listings may be hidden if the subscription lapses.",
  },
  {
    title: "3. Verification",
    body: "You agree to complete KYC verification and WhatsApp phone verification when requested. Documents are stored privately and reviewed only by the store team.",
  },
  {
    title: "4. Content and ownership",
    body: "You own or are licensed to distribute everything you upload. No malware, misleading claims, stolen assets, illegal content or content that infringes another party's rights.",
  },
  {
    title: "5. Reviews and moderation",
    body: "The store team reviews every submission and update, and may reject, unpublish or archive a product that breaks these terms. You may reply publicly to user reviews but must not manipulate ratings.",
  },
  {
    title: "6. Support and updates",
    body: "You are responsible for supporting your users, publishing security fixes promptly and keeping release notes truthful.",
  },
  {
    title: "7. Data and privacy",
    body: "If your product collects personal data you must disclose it and handle it lawfully. The store shares only aggregated analytics with you.",
  },
  {
    title: "8. Ending developer mode",
    body: "You can switch back to shopping at any time. Published products stay live unless you archive or delete them.",
  },
];

export function DeveloperTermsDialog({
  open,
  onOpenChange,
  onAccept,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  pending?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAgreed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Developer terms of service</DialogTitle>
          <DialogDescription>
            Read and accept these terms before switching to the developer workspace.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64 rounded-xl border border-border p-3">
          <div className="space-y-3 pr-2">
            {TERMS.map((t) => (
              <div key={t.title}>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            aria-label="I agree to the developer terms of service"
            className="mt-0.5"
          />
          <span>I have read and agree to the Malawian App Store developer terms of service.</span>
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!agreed || pending} onClick={onAccept}>
            Agree and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
