import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_FIELDS, type Listing } from "@/lib/store";

export const Route = createFileRoute("/developers/$id")({
  head: () => ({
    meta: [
      { title: "Developer Profile, Malawian App Store" },
      { name: "description", content: "Apps and websites published by this Malawian developer." },
      { property: "og:title", content: "Developer Profile, Malawian App Store" },
      { property: "og:description", content: "Apps and websites by a Malawian developer." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const { id } = Route.useParams();

  const profile = useQuery({
    queryKey: ["developer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const listings = useQuery({
    queryKey: ["developer-listings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("developer_id", id)
        .eq("status", "published")
        .order("downloads", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const p = profile.data as Record<string, string | boolean | null> | null | undefined;

  return (
    <AppShell>
      {profile.isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <header className="surface-card p-5">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            {(p?.developer_name as string) || (p?.display_name as string) || "Developer"}
            {p?.kyc_status === "approved" && <BadgeCheck className="h-5 w-5 text-primary" />}
          </h1>
          {p?.bio && <p className="mt-2 text-sm text-muted-foreground">{p.bio as string}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {SOCIAL_FIELDS.map((f) =>
              p?.[f.key] ? (
                <a
                  key={f.key}
                  href={p[f.key] as string}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline"
                >
                  {f.label}
                </a>
              ) : null,
            )}
          </div>
        </header>
      )}

      <h2 className="mt-6 font-display text-lg font-semibold">Published listings</h2>
      <div className="mt-3 space-y-3">
        {listings.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : listings.data?.length ? (
          listings.data.map((l) => <ListingCard key={l.id} listing={l} />)
        ) : (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            No published listings yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
