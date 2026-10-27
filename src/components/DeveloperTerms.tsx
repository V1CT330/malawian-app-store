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

export const DEVELOPER_TERMS_VERSION = "2026-10-27";

const TERMS = [
  {
    title: "1. Parties and authority",
    body: "This Developer Agreement is between you (the individual developer or organisation you are authorised to represent) and the operator of Malawian App Store (MAS). You must have legal capacity to agree. If you act for an organisation, you confirm you have authority to bind it. Anyone who needs a parent or guardian's consent under applicable law must obtain it before accepting.",
  },
  {
    title: "2. Account accuracy and verification",
    body: "Provide truthful, current account, contact, business and product information; keep it updated; protect your credentials; and report suspected account compromise. You agree to complete identity, phone or product-ownership checks reasonably required for safety, payments or legal compliance. Verification is not a guarantee that a product is safe, endorsed or approved.",
  },
  {
    title: "3. Developer Pro, billing and cancellation",
    body: "Developer Pro is currently priced at MK5,000 per month for the benefits described on the subscription page. It does not guarantee approval, downloads, rankings, sales or income. Before paying, review the checkout total and any payment-provider fees. Renewal and billing frequency must be as disclosed at checkout. You may cancel renewal through subscription controls; paid benefits should continue only through the paid period, unless applicable law or a payment correction requires otherwise. Refunds, failed payments and billing disputes are handled under the refund terms shown by MAS and applicable law. Basic browsing and installing publicly available products are not made paid merely because you are a developer.",
  },
  {
    title: "4. Ownership and third-party rights",
    body: "You retain ownership of your software, name, branding, designs, documentation and other intellectual property. You confirm you own or have permission to upload, market, distribute and license each product and its included assets. Comply with third-party and open-source licences, and disclose material restrictions or third-party components where relevant. This agreement does not transfer ownership of your product to MAS.",
  },
  {
    title: "5. Licence to operate MAS",
    body: "You grant MAS a non-exclusive, worldwide, royalty-free licence, for as long as reasonably needed to operate the marketplace, to host, reproduce, display, test, review, distribute and promote your submitted listing and product through MAS. This includes displaying its name, icon, screenshots, description and developer name. The licence is limited to operating, securing and marketing the marketplace; it does not make MAS the owner of your product. You may withdraw a listing, subject to existing user needs, legal duties, security and reasonable archival requirements.",
  },
  {
    title: "6. Product standards and prohibited conduct",
    body: "Do not submit malware, spyware, deceptive products, stolen or infringing material, fraudulent claims, unlawful content, hidden charges, undisclosed tracking or products that misuse personal data. Do not manipulate ratings, installs or analytics; impersonate another person; bypass verification or review; or interfere with MAS, developers or users. Describe functionality, permissions, data collection, pricing, subscriptions and material limitations accurately. You are responsible for required licences and permissions.",
  },
  {
    title: "7. Review, publication and enforcement",
    body: "Submission does not guarantee publication. MAS may run automated checks and human review, request evidence or changes, delay or reject a submission, suspend distribution, remove a listing or restrict an account when reasonably necessary for safety, rights, policy or legal compliance. MAS will provide a reason where reasonably practicable and may offer an appeal or resubmission route. A Pro subscription or verification badge does not bypass review requirements.",
  },
  {
    title: "8. Developer responsibilities to users",
    body: "You are responsible for your product's functionality, support, truthful release notes, maintenance, security patches, pricing and promises you make to users. Do not imply that MAS endorses your product beyond any explicit written designation. If you stop maintaining a product or discover a material security issue, take reasonable steps to inform affected users and MAS.",
  },
  {
    title: "9. Privacy and personal data",
    body: "Collect only personal data you need, explain your practices, obtain consent where required, protect data, honour applicable privacy rights and delete data when no longer needed unless retention is legally required. Do not send MAS personal data you have no right to share. Accurately disclose what your product collects, why, who receives it, retention periods and how users can exercise their rights. MAS's own handling of account and verification data should be explained in its Privacy Notice.",
  },
  {
    title: "10. Security and incidents",
    body: "Do not distribute compromised builds or conceal harmful changes. Keep signing keys and credentials secure, provide accurate version information and cooperate with reasonable security investigations. Promptly notify MAS about a vulnerability, compromise or data incident affecting your product or users. MAS may retain submission, version, moderation and security records as reasonably needed to operate the service and meet legal obligations.",
  },
  {
    title: "11. Fees, availability and liability",
    body: "MAS may change future prices or features with reasonable notice and will show applicable charges before a purchase. MAS does not promise uninterrupted availability, a minimum number of users, rankings, sales or earnings. To the extent permitted by law, MAS is not responsible for indirect losses arising from a developer's product or interruptions beyond its reasonable control. Nothing here excludes liability or rights that cannot lawfully be excluded, or excuses fraud, wilful misconduct or other non-excludable liability.",
  },
  {
    title: "12. Suspension, termination and removal",
    body: "You may stop using developer features and request removal of your listings. MAS may suspend or terminate developer access for material breach, unlawful activity, security risk, fraud or repeated policy violations. Where appropriate, MAS will provide notice and a chance to remedy or appeal. Termination does not transfer your intellectual property to MAS or erase earlier obligations. Copies retained for security, legal, dispute or backup purposes may remain for a reasonable period.",
  },
  {
    title: "13. Complaints and governing law",
    body: "Contact MAS through the support channel published on the platform to raise a complaint or request review of a decision. Both parties should first try in good faith to resolve disputes informally. This agreement is intended to be governed by the laws of Malawi, subject to mandatory laws and rights that apply. Nothing here removes the right to approach a competent regulator or court.",
  },
  {
    title: "14. Changes and related policies",
    body: "MAS may update this agreement for service, security or legal changes. Material changes should be presented for renewed acceptance where required. If a provision is unenforceable, the remaining provisions continue to the extent permitted by law. This Developer Agreement does not replace the platform's user Terms of Service, Privacy Notice, Acceptable Use and Content Policy, Copyright/Takedown Policy or Refund Policy. Those documents must be made available separately and must not contradict this agreement.",
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">MAS Developer Agreement</DialogTitle>
          <DialogDescription>
            Version {DEVELOPER_TERMS_VERSION}. Read the terms before enabling the developer workspace.
            They cover developer participation, publishing, intellectual property, payments,
            privacy responsibilities and enforcement.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[min(55vh,440px)] rounded-xl border border-border p-3">
          <div className="space-y-4 pr-2">
            {TERMS.map((t) => (
              <section key={t.title}>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.body}</p>
              </section>
            ))}
          </div>
        </ScrollArea>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            aria-label="I agree to the MAS Developer Agreement"
            className="mt-0.5"
          />
          <span>
            I have read and agree to the MAS Developer Agreement, version {DEVELOPER_TERMS_VERSION}. I confirm
            that I have authority to accept it, have the rights needed to distribute my products,
            and understand that publication and Pro benefits are not guaranteed.
          </span>
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!agreed || pending} onClick={onAccept}>
            {pending ? "Saving agreement…" : "Agree and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
