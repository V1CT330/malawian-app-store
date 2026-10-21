import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { DemoPreview } from "@/components/DemoPreview";
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
      { title: "Malawian App Store, Apps & Websites Built in Malawi" },
      {
        name: "description",
        content:
          "Discover, install and review apps and websites made by Malawian developers. Publish your own app with a verified developer account.",
      },
      { property: "og:title", content: "Malawian App Store, Apps & Websites Built in Malawi" },
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

function Shelf({ title, subtitle, items }: { title: string; subtitle?: string; items: Listing[] }) {
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
  const navigate = useNavigate();
  const [search, setSearch] = useState(routeSearch.q ?? "");
  const [kind, setKind] = useState<"all" | "app" | "website">("all");
  const [category, setCategory] = useState<string>("All");

  useEffect(() => {
    setSearch(routeSearch.q ?? "");
  }, [routeSearch.q]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["listings", "published"],
    queryFn: async () => {
      const [listingsResult, profilesResult] = await Promise.all([
        supabase
          .from("listings")
          .select("id,developer_id,slug,name,tagline,description,category,kind,icon_url,downloads,rating_avg,rating_count,created_at,status")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("public_profiles").select("id,developer_name,display_name"),
      ]);
      if (listingsResult.error) throw listingsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      const developers = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
      );
      return (listingsResult.data ?? []).map((listing) => ({
        ...(listing as unknown as Listing),
        developer: developers.get(listing.developer_id) ?? null,
      }));
    },
    // Refresh when returning to the tab or reconnecting, so newly published listings appear.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const normalizedSearch = search.trim().toLowerCase();
  const listings = useMemo(
    () =>
      (data ?? []).filter((l) => {
        const matchesSearch =
          !normalizedSearch ||
          l.name.toLowerCase().includes(normalizedSearch) ||
          (l.tagline ?? "").toLowerCase().includes(normalizedSearch) ||
          (l.description ?? "").toLowerCase().includes(normalizedSearch) ||
          l.category.toLowerCase().includes(normalizedSearch) ||
          l.kind.toLowerCase().includes(normalizedSearch) ||
          (l.developer?.developer_name ?? l.developer?.display_name ?? "")
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesKind = kind === "all" || l.kind === kind;
        const matchesCategory = category === "All" || l.category === category;
        return matchesSearch && matchesKind && matchesCategory;
      }),
    [data, normalizedSearch, kind, category],
  );

  const hasFilters = normalizedSearch !== "" || kind !== "all" || category !== "All";
  const browsing = !hasFilters;
  const topCharts = useMemo(
    () => [...listings].sort((a, b) => b.downloads - a.downloads).slice(0, 8),
    [listings],
  );
  const topRated = useMemo(
    () =>
      [...listings]
        .sort((a, b) => b.rating_avg * b.rating_count - a.rating_avg * a.rating_count)
        .slice(0, 8),
    [listings],
  );
  const fresh = useMemo(() => listings.slice(0, 8), [listings]);

  const updateSearch = (value: string) => {
    const next = value.slice(0, 120);
    setSearch(next);
    void navigate({
      to: "/",
      search: { q: next.trim() ? next : undefined },
      replace: true,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setKind("all");
    setCategory("All");
    void navigate({ to: "/", search: { q: undefined }, replace: true });
  };

  return (
    <AppShell search={search} onSearchChange={updateSearch}>
      <div className="sticky top-[64px] z-20 -mx-3 mb-3 bg-background px-3">
        <div className="flex gap-6 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              aria-pressed={kind === t.key}
              className={cn(
                "relative -mb-px min-h-11 pb-2.5 pt-1 text-sm font-medium transition-colors",
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
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "min-h-10 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              category === c
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {!isLoading && !isError && listings.length === 0 && !hasFilters && <DemoPreview title="Explore the MAS store · preview" description="Sample listings to illustrate how the store can look as developers publish products." items={[{ title: "Mlimi Connect", detail: "Agriculture · Tools for farm planning", metric: "4.8 ★ · Sample listing", status: "App" }, { title: "Campus Hub", detail: "Education · Student resources and campus updates", metric: "4.6 ★ · Sample listing", status: "Website" }, { title: "Dziko Weather", detail: "Utilities · Local forecasts and alerts", metric: "4.7 ★ · Sample listing", status: "App" }, { title: "Banja Budget", detail: "Finance · Personal budgeting in Kwacha", metric: "New sample listing", status: "App" }]} />}
      {isLoading ? (
        <div className="flex gap-4 overflow-hidden" aria-label="Loading published listings">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[104px] shrink-0 space-y-2">
              <Skeleton className="h-[104px] w-[104px] rounded-[22px]" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : isError && !data ? (
        <div role="alert" className="rounded-2xl border border-border p-6 text-center">
          <h2 className="font-display text-lg font-semibold">Couldn’t load the store</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again. Your search and filters will stay available.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center">
          <h2 className="font-display text-lg font-semibold">
            {hasFilters ? "No matching products" : "Nothing here yet"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? "Try another app name, developer, category, or product type."
              : "Be the first developer to publish on the Malawian App Store."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          {browsing ? (
            <>
              <Shelf
                title="Recommended for you"
                subtitle="Fresh from Malawian developers"
                items={fresh}
              />
              <Shelf title="Top charts" subtitle="Most popular this week" items={topCharts} />
              <Shelf title="Top rated" subtitle="Loved by reviewers" items={topRated} />
            </>
          ) : null}

          <section className="mb-2" aria-live="polite" aria-atomic="false">
            <h2 className="mb-2 font-display text-[17px] font-semibold">
              {browsing
                ? "All listings"
                : `${listings.length} result${listings.length === 1 ? "" : "s"}`}
            </h2>
            <div className="space-y-1">
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
