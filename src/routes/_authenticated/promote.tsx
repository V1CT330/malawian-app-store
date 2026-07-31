import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Ticket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/promote")({
  head: () => ({
    meta: [
      { title: "Promote your app — Malawian App Store" },
      {
        name: "description",
        content:
          "Sponsor listings, buy featured placement, run limited-time sales and create coupon and referral campaigns.",
      },
      { property: "og:title", content: "Promote your app — Malawian App Store" },
      { property: "og:description", content: "Sponsorships, featured placement and coupon campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PromotePage,
});

const CAMPAIGNS = [
  { key: "featured", label: "Featured placement", price: 15000, blurb: "Top shelf on the store home for 7 days." },
  { key: "sponsored", label: "Sponsored search", price: 9000, blurb: "Priority in search results for 7 days." },
  { key: "sale", label: "Limited-time sale", price: 0, blurb: "Highlight a discounted price for 7 days." },
  { key: "referral", label: "Referral program", price: 0, blurb: "Pay 5% to users who bring paying installs." },
] as const;

function PromotePage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [listingId, setListingId] = useState<string>("");
  const [campaign, setCampaign] = useState<string>("featured");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");

  const listings = useQuery({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,name")
        .eq("developer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = listingId || listings.data?.[0]?.id || "";

  const promotions = useQuery({
    queryKey: ["promotions", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const coupons = useQuery({
    queryKey: ["coupons", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const launch = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Publish a listing first.");
      const plan = CAMPAIGNS.find((c) => c.key === campaign)!;
      const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("promotions").insert({
        listing_id: selected,
        owner_id: userId!,
        kind: campaign,
        budget_mwk: plan.price,
        ends_at: ends,
        status: "active",
      });
      if (error) throw error;
      if (campaign === "featured" || campaign === "sponsored") {
        await supabase
          .from("listings")
          .update(campaign === "featured" ? { featured: true } : { sponsored: true })
          .eq("id", selected);
      }
    },
    onSuccess: () => {
      toast.success("Campaign launched");
      queryClient.invalidateQueries({ queryKey: ["promotions", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Publish a listing first.");
      const off = Number(percent);
      if (!Number.isFinite(off) || off < 1 || off > 90) throw new Error("Discount must be between 1% and 90%.");
      if (code.trim().length < 3) throw new Error("Use a code of at least 3 characters.");
      const { error } = await supabase.from("coupons").insert({
        listing_id: selected,
        owner_id: userId!,
        code: code.trim().toUpperCase(),
        percent_off: Math.round(off),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon created");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["coupons", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Megaphone className="h-6 w-6 text-primary" /> Promote
      </h1>

      <section className="surface-card mt-4 space-y-3 p-4">
        <Label htmlFor="listing">Listing</Label>
        <select
          id="listing"
          value={selected}
          onChange={(e) => setListingId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {listings.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <div className="grid gap-2 sm:grid-cols-2">
          {CAMPAIGNS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCampaign(c.key)}
              className={cn(
                "rounded-xl border p-3 text-left",
                campaign === c.key ? "border-primary bg-accent" : "border-border",
              )}
            >
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.blurb}</p>
              <p className="mt-1 text-xs font-semibold">{c.price ? formatAmount(c.price) : "Free"}</p>
            </button>
          ))}
        </div>
        <Button size="sm" disabled={launch.isPending} onClick={() => launch.mutate()}>
          Launch campaign
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Ticket className="h-4 w-4" /> Coupons & discount codes
        </h2>
        <div className="flex gap-2">
          <Input value={code} placeholder="MOYO20" maxLength={20} onChange={(e) => setCode(e.target.value)} />
          <Input
            className="w-24"
            value={percent}
            inputMode="numeric"
            onChange={(e) => setPercent(e.target.value)}
            aria-label="Percent off"
          />
          <Button size="sm" disabled={createCoupon.isPending} onClick={() => createCoupon.mutate()}>
            Add
          </Button>
        </div>
        <ul className="space-y-2">
          {coupons.data?.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="font-mono">{c.code}</span>
              <span className="text-muted-foreground">
                {c.percent_off}% off · {c.uses}/{c.max_uses} used
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-2 font-display text-base font-semibold">Active campaigns</h2>
        {promotions.data?.length ? (
          <ul className="space-y-2">
            {promotions.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                <span className="capitalize">{p.kind.replace("_", " ")}</span>
                <Badge variant="secondary" className="capitalize">
                  {p.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        )}
      </section>
    </AppShell>
  );
}
