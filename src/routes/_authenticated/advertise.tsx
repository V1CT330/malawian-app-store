import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { formatMwk } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({
    meta: [
      { title: "Ads Manager · Malawian App Store" },
      { name: "description", content: "Create, submit and monitor advertising campaigns on MAS." },
    ],
  }),
  component: AdvertisePage,
});

type Campaign = {
  id: string;
  advertiser_id: string;
  name: string;
  headline: string;
  body: string | null;
  image_url: string | null;
  destination_url: string;
  placements: string[];
  duration_days: number;
  budget_mwk: number;
  status: string;
  review_notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

function AdvertisePage() {
  const { userId } = useProfile();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [budget, setBudget] = useState("5000");
  const [days, setDays] = useState("7");
  const [placements, setPlacements] = useState<string[]>(["social_feed"]);

  const campaigns = useQuery({
    queryKey: ["ad-campaigns", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_campaigns")
        .select("*")
        .eq("advertiser_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const eventStats = useQuery({
    queryKey: ["ad-event-stats", campaigns.data?.map((c) => c.id).join(",")],
    enabled: Boolean(campaigns.data?.length),
    queryFn: async () => {
      const ids = (campaigns.data ?? []).map((c) => c.id);
      const { data, error } = await supabase
        .from("ad_events")
        .select("campaign_id,event_type")
        .in("campaign_id", ids);
      if (error) throw error;
      const totals = new Map<string, { impressions: number; clicks: number }>();
      for (const row of data ?? []) {
        const current = totals.get(row.campaign_id) ?? { impressions: 0, clicks: 0 };
        if (row.event_type === "impression") current.impressions += 1;
        if (row.event_type === "click") current.clicks += 1;
        totals.set(row.campaign_id, current);
      }
      return totals;
    },
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to create a campaign.");
      if (name.trim().length < 3) throw new Error("Campaign name must be at least 3 characters.");
      if (headline.trim().length < 3) throw new Error("Add an advert headline.");
      if (!/^https:\/\/.+/.test(destinationUrl.trim())) throw new Error("Destination must be a secure https:// URL.");
      if (imageUrl.trim() && !/^https:\/\/.+/.test(imageUrl.trim())) throw new Error("Image URL must start with https://.");
      const amount = Number(budget);
      const duration = Number(days);
      if (!Number.isInteger(amount) || amount < 1000) throw new Error("Minimum proposed budget is MK1,000.");
      if (!Number.isInteger(duration) || duration < 1 || duration > 90) throw new Error("Campaign duration must be 1–90 days.");
      if (!placements.length) throw new Error("Choose at least one placement.");
      const { error } = await supabase.from("ad_campaigns").insert({
        advertiser_id: userId,
        name: name.trim(),
        headline: headline.trim(),
        body: body.trim() || null,
        image_url: imageUrl.trim() || null,
        destination_url: destinationUrl.trim(),
        placements,
        duration_days: duration,
        budget_mwk: amount,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Campaign submitted for MAS review.");
      setName(""); setHeadline(""); setBody(""); setImageUrl(""); setDestinationUrl("");
      await queryClient.invalidateQueries({ queryKey: ["ad-campaigns", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pauseCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_campaigns").update({ status: "paused" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Campaign paused.");
      await queryClient.invalidateQueries({ queryKey: ["ad-campaigns", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeCount = useMemo(
    () => (campaigns.data ?? []).filter((campaign) => campaign.status === "approved").length,
    [campaigns.data],
  );

  function togglePlacement(value: string) {
    setPlacements((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  return (
    <ConsoleShell
      title="Ads Manager"
      description="Create campaigns, submit adverts for review and monitor their performance."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Ads Manager" }]}
    >
      <section className="mb-4 border border-amber-500/40 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold">Pilot mode — no payment is collected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Campaigns are submitted for manual approval. Budgets are proposed amounts, not charges.
          Checkout, verified delivery and billing are not connected yet.
        </p>
      </section>

      <section className="space-y-4 border border-border bg-background p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Create an advert</h2>
          <p className="text-sm text-muted-foreground">All campaigns are reviewed before they can appear on MAS.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ad-campaign-name">Campaign name</Label>
            <Input id="ad-campaign-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Product launch campaign" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ad-headline">Advert headline</Label>
            <Input id="ad-headline" maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What should people notice?" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ad-body">Description</Label>
          <Textarea id="ad-body" rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Explain what you are promoting." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ad-image">Image URL (optional)</Label>
            <Input id="ad-image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ad-destination">Destination URL</Label>
            <Input id="ad-destination" type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://example.com" />
          </div>
        </div>
        <div>
          <Label>Placements</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              { value: "social_feed", label: "Social feed", detail: "Sponsored content in the Social feed" },
              { value: "store", label: "Store discovery", detail: "Sponsored listings in store discovery" },
            ].map((item) => (
              <label key={item.value} className="flex cursor-pointer items-start gap-3 border border-border p-3">
                <input type="checkbox" checked={placements.includes(item.value)} onChange={() => togglePlacement(item.value)} className="mt-1" />
                <span><span className="block text-sm font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.detail}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ad-budget">Proposed budget (MWK)</Label>
            <Input id="ad-budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ad-days">Duration (days)</Label>
            <Input id="ad-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        <Button disabled={createCampaign.isPending} onClick={() => createCampaign.mutate()}>
          {createCampaign.isPending ? "Submitting…" : "Submit for approval"}
        </Button>
      </section>

      <section className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Your campaigns</h2>
          <Badge variant="secondary">{activeCount} approved</Badge>
        </div>
        {campaigns.isLoading ? <Skeleton className="h-24 w-full" /> : campaigns.isError ? (
          <p role="alert" className="border border-destructive/30 p-4 text-sm text-destructive">Campaigns could not be loaded. Check your connection and try again.</p>
        ) : campaigns.data?.length ? campaigns.data.map((campaign) => {
          const stats = eventStats.data?.get(campaign.id) ?? { impressions: 0, clicks: 0 };
          return (
            <article key={campaign.id} className="border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{campaign.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{campaign.placements.join(" · ")} · {campaign.duration_days} days</p>
                </div>
                <Badge variant={campaign.status === "approved" ? "default" : campaign.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{campaign.status}</Badge>
              </div>
              {campaign.review_notes && <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm text-muted-foreground">Review note: {campaign.review_notes}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div><p className="text-lg font-semibold tabular-nums">{stats.impressions.toLocaleString()}</p><p className="text-xs text-muted-foreground">Impressions</p></div>
                <div><p className="text-lg font-semibold tabular-nums">{stats.clicks.toLocaleString()}</p><p className="text-xs text-muted-foreground">Clicks</p></div>
                <div><p className="text-lg font-semibold tabular-nums">{formatMwk(campaign.budget_mwk)}</p><p className="text-xs text-muted-foreground">Proposed budget</p></div>
                <div><p className="text-lg font-semibold tabular-nums">{campaign.duration_days}</p><p className="text-xs text-muted-foreground">Days</p></div>
              </div>
              {campaign.status === "approved" && <Button className="mt-3" size="sm" variant="outline" disabled={pauseCampaign.isPending} onClick={() => pauseCampaign.mutate(campaign.id)}>Pause campaign</Button>}
            </article>
          );
        }) : <p className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No campaigns yet. Your submitted campaigns will appear here.</p>}
      </section>
    </ConsoleShell>
  );
}
