import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { SPOTLIGHT_NOTE, SPOTLIGHT_OPPORTUNITIES } from "@/lib/pro";

export const Route = createFileRoute("/_authenticated/spotlight")({
  head: () => ({
    meta: [
      { title: "Developer Spotlight · Malawian App Store" },
      {
        name: "description",
        content:
          "Apply for App Spotlight, Developer Spotlight, Project Spotlight, podcast features and Made in Malawi features.",
      },
      { property: "og:title", content: "Developer Spotlight · Malawian App Store" },
      { property: "og:description", content: "Feature opportunities for Malawian developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpotlightPage,
});

function SpotlightPage() {
  useRequireDeveloper();
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const [opportunity, setOpportunity] = useState<string>(SPOTLIGHT_OPPORTUNITIES[0].title);
  const [listingId, setListingId] = useState("");
  const [pitch, setPitch] = useState("");

  const listings = useQuery({
    queryKey: ["spotlight-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,name")
        .eq("developer_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const applications = useQuery({
    queryKey: ["spotlight-applications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spotlight_applications")
        .select("*")
        .eq("developer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (pitch.trim().length < 30) throw new Error("Tell us a little more, at least 30 characters.");
      const { error } = await supabase.from("spotlight_applications").insert({
        developer_id: userId!,
        listing_id: listingId || null,
        opportunity,
        pitch: pitch.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application submitted");
      setPitch("");
      queryClient.invalidateQueries({ queryKey: ["spotlight-applications", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verified = profile?.kyc_status === "approved";

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Spotlight</h1>
      <p className="text-sm text-muted-foreground">
        Feature opportunities for developers building for Malawi.
      </p>

      <div className="mt-4">
        <PortalTabs />
      </div>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Eligibility</h2>
          {verified ? (
            <Badge className="gap-1">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </Badge>
          ) : (
            <Badge variant="secondary">Not verified yet</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{SPOTLIGHT_NOTE}</p>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Opportunities</h2>
        <ul className="mt-3 grid gap-2">
          {SPOTLIGHT_OPPORTUNITIES.map((o) => (
            <li key={o.title}>
              <button
                type="button"
                onClick={() => setOpportunity(o.title)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${
                  opportunity === o.title ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <span className="font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Apply for {opportunity}</h2>
        <select
          aria-label="Product"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        >
          <option value="">No specific product</option>
          {(listings.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <Textarea
          rows={4}
          maxLength={800}
          value={pitch}
          placeholder="What are you building, who is it for in Malawi, and why should it be featured?"
          onChange={(e) => setPitch(e.target.value)}
        />
        <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate()}>
          Submit application
        </Button>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Your applications</h2>
        {applications.isLoading ? (
          <Skeleton className="mt-3 h-16 w-full rounded-xl" />
        ) : applications.data?.length ? (
          <ul className="mt-3 space-y-2">
            {applications.data.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{a.opportunity}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {a.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No applications yet.</p>
        )}
      </section>
    </AppShell>
  );
}
