import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingCard, ListingTile } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Listing } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q.slice(0, 120) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Malawian App Store — Apps & Websites Built in Malawi" },
      {
        name: "description",
        content:
          "Discover, install and review apps and websites made by Malawian developers. Publish your own app with a verified developer account.",
      },
      { property: "og:title", content: "Malawian App Store — Apps & Websites Built in Malawi" },
      {
        property: "og:description",
        content: "Discover, install and review apps and websites made by Malawian developers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

const TABS = [
  { key: "all", label: "For you" },
  { key: "app", label: "Apps" },
  { key: "website", label: "Websites" },
] as const;

function Shelf({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Listing[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
      <div className="-mx-3 flex gap-4 overflow-x-auto px-3 pb-1">
        {items.map((l) => (
          <ListingTile key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}

function StorePage() {
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState(routeSearch.q ?? "");
  const [kind, setKind] = useState<"all" | "app" | "website">("all");
  const [category, setCategory] = useState<string>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["listings", "published"],
    queryFn: async () => {
      const [listingsResult, profilesResult] = await Promise.all([
        supabase.from("listings").select("*").eq("status", "published").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,developer_name,display_name"),
      ]);
      if (listingsResult.error) throw listingsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      const developers = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
      return (listingsResult.data ?? []).map((listing) => ({
        ...(listing as Listing),
        developer: developers.get(listing.developer_id) ?? null,
      }));
    },
  });

  const listings = (data ?? []).filter((l) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      (l.tagline ?? "").toLowerCase().includes(q) ||
      (l.description ?? "").toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.kind.toLowerCase().includes(q) ||
      (l.developer?.developer_name ?? l.developer?.display_name ?? "").toLowerCase().includes(q);
    const matchesKind = kind === "all" || l.kind === kind;
    const matchesCategory = category === "All" || l.category === category;
    return matchesSearch && matchesKind && matchesCategory;
  });

  const browsing = search === "" && category === "All";
  const topCharts = [...listings].sort((a, b) => b.downloads - a.downloads).slice(0, 8);
  const topRated = [...listings]
    .sort((a, b) => b.rating_avg * b.rating_count - a.rating_avg * a.rating_count)
    .slice(0, 8);
  const fresh = listings.slice(0, 8);

  return (
    <AppShell search={search} onSearchChange={setSearch}>
      <div className="sticky top-[64px] z-20 -mx-3 mb-3 bg-background px-3">
        <div className="flex gap-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setKind(t.key)}
              className={cn(
                "relative -mb-px pb-2.5 pt-1 text-sm font-medium transition-colors",
                kind === t.key
                  ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary"
                  : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              category === c
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[104px] shrink-0 space-y-2">
              <Skeleton className="h-[104px] w-[104px] rounded-[22px]" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center">
          <h2 className="font-display text-lg font-semibold">{search ? "No matching products" : "Nothing here yet"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search ? "Try another app name, developer, category, or keyword." : "Be the first developer to publish on the Malawian App Store."}
          </p>
        </div>
      ) : (
        <div>
          {browsing ? (
            <>
              <Shelf title="Recommended for you" subtitle="Fresh from Malawian developers" items={fresh} />
              <Shelf title="Top charts" subtitle="Most popular this week" items={topCharts} />
              <Shelf title="Top rated" subtitle="Loved by reviewers" items={topRated} />
            </>
          ) : null}

          <section className="mb-2">
            <h2 className="mb-2 font-display text-[17px] font-semibold">
              {browsing ? "All listings" : `${listings.length} result${listings.length === 1 ? "" : "s"}`}
            </h2>
            <div className="divide-y divide-border">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
