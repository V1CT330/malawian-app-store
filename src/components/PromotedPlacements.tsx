import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ListingTile } from "@/components/ListingCard";
import type { Listing } from "@/lib/store";

type Promotion = {
  id: string;
  kind: string;
  listing_id: string;
  cost_per_click_mwk: number;
  listing: Listing;
};

async function recordEvent(promotionId: string, eventType: "impression" | "click") {
  try {
    await supabase.rpc("record_promotion_event", {
      _promotion_id: promotionId,
      _event_type: eventType,
      _event_id: crypto.randomUUID(),
    });
  } catch {
    // Ad tracking must never interrupt browsing or app navigation.
  }
}

function SponsoredCard({ promotion }: { promotion: Promotion }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let sent = false;
    const observer = new IntersectionObserver((entries) => {
      if (!sent && entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        sent = true;
        void recordEvent(promotion.id, "impression");
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [promotion.id]);

  return (
    <div ref={ref} className="relative min-w-0">
      <Badge variant="secondary" className="absolute right-2 top-2 z-10">Sponsored</Badge>
      <div onClick={() => void recordEvent(promotion.id, "click")}>
        <ListingTile listing={promotion.listing} />
      </div>
    </div>
  );
}

export function PromotedPlacements() {
  const promotions = useQuery({
    queryKey: ["live-promotions"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("promotions")
        .select("id,kind,listing_id,cost_per_click_mwk,starts_at,ends_at")
        .eq("status", "active")
        .eq("payment_status", "paid")
        .lte("starts_at", now)
        .order("starts_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const live = (data ?? []).filter((campaign) =>
        !campaign.ends_at || Date.parse(campaign.ends_at) > Date.now()
      );
      if (!live.length) return [] as Promotion[];
      const { data: listings, error: listingError } = await supabase
        .from("listings")
        .select("id,developer_id,slug,name,tagline,description,category,kind,icon_url,downloads,rating_avg,rating_count,created_at,status")
        .in("id", live.map((campaign) => campaign.listing_id))
        .eq("status", "published");
      if (listingError) throw listingError;
      const byId = new Map((listings ?? []).map((listing) => [listing.id, listing]));
      return live.flatMap((campaign) => {
        const listing = byId.get(campaign.listing_id);
        return listing ? [{
          id: campaign.id,
          kind: campaign.kind,
          listing_id: campaign.listing_id,
          cost_per_click_mwk: campaign.cost_per_click_mwk,
          listing: listing as unknown as Listing,
        }] : [];
      });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = promotions.data ?? [];
  const featured = items.filter((item) => item.kind === "featured" || item.kind === "banner");
  if (!featured.length) return null;

  return (
    <section className="mb-6" aria-label="Sponsored apps and websites">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-semibold leading-tight">Promoted by developers</h2>
          <p className="text-xs text-muted-foreground">Sponsored placements support the MAS ecosystem</p>
        </div>
        <Badge variant="outline">Sponsored</Badge>
      </div>
      <div className="-mx-3 flex gap-4 overflow-x-auto px-3 pb-1">
        {featured.map((promotion) => (
          <SponsoredCard key={promotion.id} promotion={promotion} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Advertisers pay MK{items[0]?.cost_per_click_mwk ?? 50} per click; impressions are free.
      </p>
    </section>
  );
}
