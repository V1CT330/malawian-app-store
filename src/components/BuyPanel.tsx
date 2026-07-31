import { useMutation } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkout } from "@/lib/payments.functions";
import { PAYMENT_METHODS, PURCHASE_KINDS, type PurchaseKind } from "@/lib/payments";
import { clientContext, formatAmount, type Listing } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Local checkout: mobile money, cards, banks and crypto. */
export function BuyPanel({ listing, onPaid }: { listing: Listing; onPaid?: () => void }) {
  const options: { kind: PurchaseKind; label: string; amount: number }[] = [];
  if (listing.price_mwk > 0) options.push({ kind: "one_time", label: "Buy once", amount: listing.price_mwk });
  if ((listing.price_month_mwk ?? 0) > 0)
    options.push({ kind: "subscription_month", label: "Monthly", amount: listing.price_month_mwk! });
  if ((listing.price_year_mwk ?? 0) > 0)
    options.push({ kind: "subscription_year", label: "Yearly", amount: listing.price_year_mwk! });
  if (listing.monetization === "freemium" || listing.monetization === "iap")
    options.push({ kind: "iap", label: "In-app purchase", amount: 0 });
  if (listing.allow_donations || listing.monetization === "donations")
    options.push({ kind: "donation", label: "Tip the developer", amount: 0 });

  const [kind, setKind] = useState<PurchaseKind>(options[0]?.kind ?? "donation");
  const [method, setMethod] = useState<string>("airtel_money");
  const [custom, setCustom] = useState("1000");
  const [coupon, setCoupon] = useState("");

  const active = options.find((o) => o.kind === kind);
  const needsAmount = kind === "donation" || kind === "iap";

  const pay = useMutation({
    mutationFn: async () => {
      const amount = needsAmount ? Number(custom) : (active?.amount ?? 0);
      if (needsAmount && (!Number.isFinite(amount) || amount < 100)) throw new Error("Enter at least MK100.");
      return checkout({
        data: {
          listingId: listing.id,
          kind,
          amountMwk: Math.round(amount),
          method,
          couponCode: coupon.trim() ? coupon.trim().toUpperCase() : undefined,
          country: clientContext().country ?? undefined,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Payment confirmed · ${result.reference}`);
      setCoupon("");
      onPaid?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (options.length === 0) return null;

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold">
        <CreditCard className="h-4 w-4" /> Purchase & support
      </h2>

      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.kind}
            onClick={() => setKind(o.kind)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium",
              kind === o.kind ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
            )}
          >
            {o.label}
            {o.amount > 0 ? ` · ${formatAmount(o.amount)}` : ""}
          </button>
        ))}
      </div>

      {needsAmount && (
        <div>
          <Label htmlFor="custom-amount">Amount (MWK)</Label>
          <Input id="custom-amount" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
      )}

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Pay with</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                method === m.key ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={coupon}
          placeholder="Coupon code (optional)"
          maxLength={20}
          onChange={(e) => setCoupon(e.target.value)}
        />
        <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
          Pay
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Payments are encrypted and licence-verified. {PURCHASE_KINDS.find((k) => k.key === kind)?.label} ·{" "}
        {listing.crypto_address ? "crypto accepted" : "mobile money, cards and crypto supported"}.
      </p>
    </section>
  );
}
