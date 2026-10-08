import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, Star } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, MetricTile, RowSkeletons, SectionCard } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { useMyListings } from "@/lib/console.queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews, Developer Console" },
      {
        name: "description",
        content:
          "Ratings and written reviews across all of your Malawian App Store products, with reply status.",
      },
      { property: "og:title", content: "Reviews, Developer Console" },
      { property: "og:description", content: "Ratings and reviews across your products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewsPage,
});

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground",
          )}
        />
      ))}
    </span>
  );
}

function ReviewsPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const listingsQuery = useMyListings(userId);
  const listings = listingsQuery.data ?? [];
  const ids = listings.map((l) => l.id);

  const reviewsQuery = useQuery({
    queryKey: ["console-reviews", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,rating,body,developer_reply,listing_id,created_at")
        .in("listing_id", ids)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviews = reviewsQuery.data ?? [];
  const unanswered = reviews.filter((r) => !r.developer_reply).length;
  const average = reviews.length
    ? (reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length).toFixed(1)
    : "N/A";
  const nameOf = (id: string) => listings.find((l) => l.id === id)?.name ?? "Product";

  return (
    <ConsoleShell
      title="Reviews"
      description="What people say about your products, newest first."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Reviews" }]}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Reviews" value={reviews.length} />
          <MetricTile label="Average rating" value={average} />
          <MetricTile label="Awaiting reply" value={unanswered} />
          <MetricTile label="Products" value={listings.length} />
        </div>

        <SectionCard title="Latest reviews">
          {listingsQuery.isLoading || reviewsQuery.isLoading ? (
            <RowSkeletons count={3} />
          ) : reviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No reviews yet"
              description="Reviews appear here as soon as people rate your products."
              action={
                <Button asChild variant="outline">
                  <Link to="/console/products">View products</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={Number(r.rating)} />
                    <span className="text-xs text-muted-foreground">
                      {nameOf(r.listing_id)} · {String(r.created_at).slice(0, 10)}
                    </span>
                  </div>
                  {r.body && <p className="mt-1.5 text-sm">{r.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.developer_reply ? "Replied" : "No reply yet"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </ConsoleShell>
  );
}
