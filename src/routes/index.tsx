import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, ExternalLink, Megaphone, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { AppIcon, ListingCard, ListingTile } from "@/components/ListingCard";
import { useSignedUrl } from "@/hooks/useSession";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Listing } from "@/lib/store";
import { matchesSearch, matchesListingFilters, topByNumber } from "@/shared/mas-core";
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

function SponsoredBannerImage({ path, className }: { path: string | null; className: string }) {
  const signedUrl = useSignedUrl(path && !/^https?:\/\//i.test(path) ? path : null);
  const src = path && /^https?:\/\//i.test(path) ? path : signedUrl;
  if (!src) return null;
  return <img src={src} alt="" loading="lazy" className={className} />;
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

  const sponsoredStoreAds = useQuery({
    queryKey: ["store", "sponsored-ad-creatives"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("active_ad_creatives")
        .select("id,headline,body,image_url,destination_url,placements,creative_type,listing_id,listing_name,listing_slug,listing_icon_url,listing_banner_url,listing_website_url,listing_kind,listing_status")
        .contains("placements", ["store"])
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const storeAds = useMemo(() => ((sponsoredStoreAds.data ?? []) as Array<{
    id: string; headline: string; body: string | null; image_url: string | null;
    destination_url: string; placements: string[]; creative_type: string;
    listing_id: string | null; listing_name: string | null; listing_slug: string | null;
    listing_icon_url: string | null; listing_banner_url: string | null;
    listing_website_url: string | null; listing_kind: string | null; listing_status: string | null;
  }>).filter((ad) => ad.creative_type === "app_listing" || ad.creative_type === "website_banner"), [sponsoredStoreAds.data]);
  const sponsoredApps = storeAds.filter((ad) => ad.creative_type === "app_listing" && ad.listing_kind === "app");
  const sponsoredWebsites = storeAds.filter((ad) => ad.creative_type === "website_banner" && (!ad.listing_kind || ad.listing_kind === "website"));
  const trackedStoreImpressions = useRef(new Set<string>());
  const storeAdIds = storeAds.map((ad) => ad.id).join(",");
  const recordStoreAdClick = (campaignId: string) => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void (supabase as any).from("ad_events").insert({ campaign_id: campaignId, event_type: "click", viewer_id: data.user.id });
    });
  };

  const normalizedSearch = search.trim().toLowerCase();
  const listings = useMemo(
    () =>
      (data ?? []).filter((l) => {
        const matchesText = matchesSearch(
          [l.name, l.tagline, l.description, l.category, l.kind, l.developer?.developer_name, l.developer?.display_name],
          normalizedSearch,
        );
        return matchesText && matchesListingFilters(l, { kind, category });
      }),
    [data, normalizedSearch, kind, category],
  );

  const hasFilters = normalizedSearch !== "" || kind !== "all" || category !== "All";
  const browsing = !hasFilters;
  useEffect(() => {
    if (!browsing) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      for (const campaignId of storeAdIds.split(",").filter(Boolean)) {
        if (trackedStoreImpressions.current.has(campaignId)) continue;
        trackedStoreImpressions.current.add(campaignId);
        void (supabase as any).from("ad_events").insert({ campaign_id: campaignId, event_type: "impression", viewer_id: data.user.id })
          .then(({ error }: { error: { code?: string } | null }) => {
            if (error && error.code !== "23505") trackedStoreImpressions.current.delete(campaignId);
          });
      }
    });
  }, [browsing, storeAdIds]);
  const topCharts = useMemo(
    () => topByNumber(listings, (listing) => listing.downloads),
    [listings],
  );
  const topRated = useMemo(
    () => topByNumber(listings, (listing) => listing.rating_avg * listing.rating_count),
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
      <div className="-mx-3 mb-3 bg-background px-3">
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
      ) : listings.length === 0 && sponsoredApps.length === 0 && sponsoredWebsites.length === 0 && !sponsoredStoreAds.isLoading ? (
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
          {browsing && sponsoredApps.length > 0 && (
            <section className="mb-5" aria-label="Sponsored apps">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Megaphone className="h-4 w-4" /> Sponsored apps</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {sponsoredApps.map((ad) => {
                  const content = <div className="flex min-w-0 items-center gap-3 border border-border bg-background p-3 transition-colors hover:border-primary/50">
                    <AppIcon path={ad.listing_icon_url} name={ad.listing_name || ad.headline} className="h-14 w-14 rounded-2xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{ad.listing_name || ad.headline}</p>
                      {ad.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ad.body}</p>}
                      <div className="mt-1 flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sponsored</span>{ad.listing_status !== "published" && <span className="text-[10px] font-semibold text-primary">Coming Soon</span>}</div>
                    </div>
                  </div>;
                  return ad.listing_status === "published" && ad.listing_slug
                    ? <Link key={ad.id} to="/apps/$slug" params={{ slug: ad.listing_slug }} onClick={() => recordStoreAdClick(ad.id)}>{content}</Link>
                    : <div key={ad.id}>{content}</div>;
                })}
              </div>
            </section>
          )}
          {browsing && sponsoredWebsites.length > 0 && <section className="mb-5 space-y-3" aria-label="Sponsored websites">
            {sponsoredWebsites.map((ad) => <a key={ad.id} href={ad.destination_url} target="_blank" rel="noreferrer noopener" onClick={() => recordStoreAdClick(ad.id)} className="block overflow-hidden border border-border bg-background transition-colors hover:border-primary/50">
              <SponsoredBannerImage path={ad.image_url || ad.listing_banner_url || ad.listing_icon_url} className="max-h-52 w-full object-cover" />
              <div className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="font-semibold">{ad.listing_name || ad.headline}</p>{ad.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ad.body}</p>}<span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sponsored website</span></div><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" /></div>
            </a>)}
          </section>}
          {browsing ? <><Shelf title="Recommended for you" subtitle="Fresh from Malawian developers" items={fresh} /><Shelf title="Top charts" subtitle="Most popular this week" items={topCharts} /><Shelf title="Top rated" subtitle="Loved by reviewers" items={topRated} /></> : null}
          {listings.length > 0 && <section className="mb-2" aria-live="polite" aria-atomic="false">
            <h2 className="mb-2 font-display text-[17px] font-semibold">{browsing ? "All listings" : `${listings.length} result${listings.length === 1 ? "" : "s"}`}</h2>
            <div className="space-y-1">{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
          </section>}
        </div>
      )}
    </AppShell>
  );
}
