import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { DemoPreview } from "@/components/DemoPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { fetchFoundingProgram } from "@/lib/pro";
import { formatMwk } from "@/lib/store";
import { startPromotionCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise your product · Malawian App Store" },
      {
        name: "description",
        content:
          "Create promotion campaigns for your apps and websites, set a budget in Kwacha and track impressions, clicks and spend.",
      },
      { property: "og:title", content: "Advertise your product · Malawian App Store" },
      { property: "og:description", content: "Promotion campaigns priced in Malawian Kwacha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvertisePage,
});

const PLACEMENTS = [
  { value: "featured", label: "Featured placement", detail: "Shown on the store home shelves" },
  {
    value: "search",
    label: "Search boost",
    detail: "Sponsored placement for matching text searches",
  },
  { value: "banner", label: "Store banner", detail: "Wide banner across browse pages" },
] as const;

function AdvertisePage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const queryClient = useQueryClient();

  const [listingId, setListingId] = useState("");
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState<string>("featured");
  const [budget, setBudget] = useState("10000");
  const [days, setDays] = useState("7");
  const startCheckout = useServerFn(startPromotionCheckout);

  const listings = useQuery({
    queryKey: ["advertise-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,name,status")
        .eq("developer_id", userId!)
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaigns = useQuery({
    queryKey: ["campaigns", userId],
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

  const founding = useQuery({ queryKey: ["founding-program"], queryFn: fetchFoundingProgram });

  const create = useMutation({
    mutationFn: async () => {
      if (!listingId) throw new Error("Choose which product to promote.");
      const amount = Number(budget);
      if (!Number.isFinite(amount) || amount < 1000)
        throw new Error("Set a budget of at least MK1,000.");
      const length = Math.max(1, Math.min(90, Number(days) || 7));
      const ends = new Date(Date.now() + length * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from("promotions").insert({
        owner_id: userId!,
        listing_id: listingId,
        name: name.trim() || "Promotion campaign",
        kind: placement,
        budget_mwk: amount,
        target_location: "All Malawi",
        starts_at: new Date().toISOString(),
        ends_at: ends.toISOString(),
        duration_days: length,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign submitted for review");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["campaigns", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkout = useMutation({
    mutationFn: (campaignId: string) => startCheckout({ data: { campaignId } }),
    onSuccess: (session) => { window.location.href = session.checkoutUrl; },
    onError: (e: Error) => toast.error(e.message),
  });

  const pause = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").update({ status: "paused" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsoleShell
      title="Advertise"
      description="Promote your products inside the store and reach people browsing for local software."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Advertise" }]}
    >
      {founding.data?.enabled && founding.data.promo_credit_mwk > 0 && (
        <section className="surface-card mb-4 border-l-4 border-l-brand-green p-4">
          <h2 className="font-display text-base font-semibold">Founding promotional credit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Founding developers are eligible for {formatMwk(founding.data.promo_credit_mwk)} in
            promotional credit toward their first campaigns. Credit is applied by the store team
            after review.
          </p>
        </section>
      )}

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Create a campaign</h2>
        <p className="text-xs text-muted-foreground">Targeting: All Malawi · MK50 per click · impressions are free.</p>

        <div>
          <Label htmlFor="campaign-product">Product</Label>
          <select
            id="campaign-product"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
          >
            <option value="">Select a product</option>
            {(listings.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            value={name}
            maxLength={60}
            placeholder="Launch week push"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label>Placement</Label>
          <div className="mt-1 grid gap-2">
            {PLACEMENTS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPlacement(p.value)}
                className={`rounded-xl border p-3 text-left text-sm ${
                  placement === p.value ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="campaign-budget">Budget in MWK</Label>
            <Input
              id="campaign-budget"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <Label htmlFor="campaign-days">Duration in days</Label>
            <Input
              id="campaign-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <Button size="sm" disabled={create.isPending} onClick={() => create.mutate()}>
          Submit campaign
        </Button>
      </section>

      {!campaigns.isLoading && !(campaigns.data ?? []).length && <DemoPreview title="Campaign performance preview" description="Illustrative results for a sample promotion. No campaign has been created or charged." items={[{ title: "Mlimi Connect launch", detail: "Featured placement · All Malawi", metric: "2,450 impressions · 186 clicks", status: "Example" }, { title: "Campus Hub search boost", detail: "Search placement · Lilongwe", metric: "1,120 impressions · 94 clicks", status: "Example" }]} />}
      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Your campaigns</h2>
        {campaigns.isLoading ? (
          <Skeleton className="mt-3 h-20 w-full rounded-xl" />
        ) : campaigns.data?.length ? (
          <ul className="mt-3 space-y-3">
            {campaigns.data.map((c) => (
              <li key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.name ?? "Promotion campaign"}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {c.kind} · {c.target_location ?? "All Malawi"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {c.status}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <p className="font-display text-sm font-bold">{c.impressions}</p>
                    <p className="text-muted-foreground">views</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold">{c.clicks}</p>
                    <p className="text-muted-foreground">clicks</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold">
                      {formatMwk(Number(c.spent_mwk))}
                    </p>
                    <p className="text-muted-foreground">spent</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold">
                      {formatMwk(Number(c.budget_mwk))}
                    </p>
                    <p className="text-muted-foreground">budget</p>
                  </div>
                </div>
                {c.status === "approved" && c.payment_status === "unpaid" && (
                  <Button size="sm" className="mt-3" disabled={checkout.isPending} onClick={() => checkout.mutate(c.id)}>
                    {checkout.isPending ? "Preparing checkout…" : `Pay budget · ${formatMwk(Number(c.budget_mwk))}`}
                  </Button>
                )}
                {c.status === "approved" && c.payment_status === "unpaid" && <p className="mt-2 text-xs text-muted-foreground">Approved. Pay the prepaid budget to start the campaign.</p>}
                {c.status !== "paused" && c.status !== "completed" && c.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={pause.isPending}
                    onClick={() => pause.mutate(c.id)}
                  >
                    Pause campaign
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No campaigns yet. Your first campaign can start the day your product goes live.
          </p>
        )}
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Notes on advertising</h2>
        <Textarea
          readOnly
          rows={4}
          className="mt-2 resize-none bg-secondary text-sm"
          value={
            "Campaigns are reviewed before payment. Approved campaigns require prepaid budgets through PayChangu. Impressions are free; each recorded click costs MK50. Campaigns stop when the budget is used or the campaign duration ends. Contact MAS support for billing disputes."
          }
        />
      </section>
    </ConsoleShell>
  );
}
