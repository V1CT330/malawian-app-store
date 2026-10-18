import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ExternalLink, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AppIcon, Stars } from "@/components/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession, useSignedUrl } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, type Listing } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/apps/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")}, Malawian App Store` },
      {
        name: "description",
        content: `Details, versions and reviews for ${params.slug.replace(/-/g, " ")} on the Malawian App Store.`,
      },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")}, Malawian App Store` },
      {
        property: "og:description",
        content: `Details, versions and reviews for ${params.slug.replace(/-/g, " ")}.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListingDetail,
});

function ListingDetail() {
  const { slug } = Route.useParams();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  const listingQuery = useQuery({
    queryKey: ["listing", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Listing | null;
    },
  });
  const listing = listingQuery.data ?? null;

  const versionsQuery = useQuery({
    queryKey: ["versions", listing?.id],
    enabled: Boolean(listing?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_versions")
        .select("*")
        .eq("listing_id", listing!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", listing?.id],
    enabled: Boolean(listing?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,user_id,rating,body,created_at")
        .eq("listing_id", listing!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latest = versionsQuery.data?.[0];
  const fileUrl = useSignedUrl(latest?.file_url ?? null);

  const installedQuery = useQuery({
    queryKey: ["installed-app", userId, listing?.id],
    enabled: Boolean(userId && listing?.id && listing?.kind === "app"),
    queryFn: async () => {
      if (!userId || !listing) return null;
      const { data, error } = await supabase
        .from("installed_apps")
        .select("id,installed_version_id")
        .eq("user_id", userId)
        .eq("listing_id", listing.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reviews")
        .upsert(
          { listing_id: listing!.id, user_id: userId!, rating, body: body.trim() || null },
          { onConflict: "listing_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review posted");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["reviews", listing?.id] });
      queryClient.invalidateQueries({ queryKey: ["listing", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const developerQuery = useQuery({
    queryKey: ["listing-developer", listing?.developer_id],
    enabled: Boolean(listing?.developer_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id, display_name, developer_name, kyc_status")
        .eq("id", listing!.developer_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saved = useQuery({
    queryKey: ["wishlist-item", userId, listing?.id],
    enabled: Boolean(userId && listing?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("id")
        .eq("user_id", userId!)
        .eq("listing_id", listing!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (saved.data) {
        const { error } = await supabase.from("wishlist").delete().eq("id", saved.data);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("wishlist")
        .insert({ user_id: userId!, listing_id: listing!.id });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      toast.success(added ? "Saved to your library" : "Removed from saved");
      queryClient.invalidateQueries({ queryKey: ["wishlist-item", userId, listing?.id] });
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const install = useMutation({
    mutationFn: async () => {
      if (!listing) throw new Error("Listing unavailable");
      const { error: eventError } = await supabase.rpc("register_install", {
        _listing_id: listing.id,
        _device: typeof navigator !== "undefined" ? navigator.platform : undefined,
      });
      if (eventError) throw eventError;
      if (listing.kind === "app" && userId) {
        const { error } = await supabase.from("installed_apps").upsert(
          {
            user_id: userId,
            listing_id: listing.id,
            installed_version_id: latest?.id ?? null,
          },
          { onConflict: "user_id,listing_id" },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", slug] });
      queryClient.invalidateQueries({ queryKey: ["install-history", userId] });
      queryClient.invalidateQueries({ queryKey: ["installed-app", userId, listing?.id] });
      queryClient.invalidateQueries({ queryKey: ["installed-apps", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleGet() {
    if (!listing) return;
    if (listing.kind === "website" && listing.website_url) {
      install.mutate();
      window.open(listing.website_url, "_blank", "noopener");
      return;
    }
    if (!userId) {
      window.location.href = `/auth?redirect=${encodeURIComponent(`/apps/${listing.slug}`)}`;
      return;
    }
    if (installedQuery.data && installedQuery.data.installed_version_id === latest?.id) {
      if (fileUrl) window.open(fileUrl, "_blank", "noopener");
      else toast.info("This app is installed, but no download file is available.");
      return;
    }
    install.mutate();
    if (fileUrl) {
      window.open(fileUrl, "_blank", "noopener");
      return;
    }
    toast.info("Added to your library. The developer has not published a download file yet.");
  }

  if (listingQuery.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (!listing) {
    return (
      <AppShell>
        <div className="surface-card p-8 text-center">
          <h1 className="font-display text-lg font-semibold">Listing not found</h1>
          <Button asChild className="mt-4">
            <Link to="/">Back to store</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <article className="space-y-5">
        <header className="surface-card flex gap-4 p-4">
          <AppIcon path={listing.icon_url} name={listing.name} className="h-20 w-20" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold leading-tight">{listing.name}</h1>
            <p className="text-sm text-muted-foreground">{listing.tagline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {listing.kind}
              </Badge>
              <Badge variant="outline">{listing.category}</Badge>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="surface-card p-3">
            <p className="font-display text-lg font-bold">{listing.rating_avg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{listing.rating_count} reviews</p>
          </div>
          <div className="surface-card p-3">
            <p className="font-display text-lg font-bold">{listing.downloads}</p>
            <p className="text-xs text-muted-foreground">
              {listing.kind === "website" ? "visits" : "installs"}
            </p>
          </div>
          <div className="surface-card p-3">
            <p className="font-display text-lg font-bold">{latest?.version ?? "N/A"}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(latest?.size_bytes)}</p>
          </div>
        </div>

        <Button className="w-full" size="lg" disabled={install.isPending} onClick={handleGet}>
          {listing.kind === "website" ? (
            <>
              <ExternalLink className="mr-2 h-4 w-4" /> Open website
            </>
          ) : (
            <>
              {installedQuery.data && installedQuery.data.installed_version_id !== latest?.id ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Update
                </>
              ) : installedQuery.data ? (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Install
                </>
              )}
            </>
          )}
        </Button>

        {userId && (
          <Button
            variant="outline"
            className="w-full"
            disabled={toggleSave.isPending}
            onClick={() => toggleSave.mutate()}
          >
            {saved.data ? "Remove from saved" : "Save to library"}
          </Button>
        )}

        {developerQuery.data && (
          <Link
            to="/developers/$id"
            params={{ id: developerQuery.data.id }}
            className="block text-sm text-primary underline"
          >
            More from{" "}
            {developerQuery.data.developer_name ??
              developerQuery.data.display_name ??
              "this developer"}
          </Link>
        )}

        {listing.description && (
          <section className="surface-card p-4">
            <h2 className="mb-2 font-display text-base font-semibold">About</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {listing.description}
            </p>
          </section>
        )}

        <section className="surface-card p-4">
          <h2 className="mb-2 font-display text-base font-semibold">What's new</h2>
          {versionsQuery.data?.length ? (
            <ul className="space-y-3">
              {versionsQuery.data.map((v) => (
                <li key={v.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium">Version {v.version}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()} · {formatBytes(v.size_bytes)}
                  </p>
                  {v.changelog && (
                    <p className="mt-1 text-sm text-muted-foreground">{v.changelog}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No versions published yet.</p>
          )}
        </section>

        <section className="surface-card p-4">
          <h2 className="mb-3 font-display text-base font-semibold">Reviews</h2>

          {userId ? (
            <div className="mb-4 rounded-xl bg-secondary p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Your rating</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`Rate ${n} stars`}
                      className="rounded-full p-0.5"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          n <= rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={600}
                placeholder="Share how this app works for you"
                className="mt-2 bg-background"
              />
              <Button
                className="mt-2"
                size="sm"
                disabled={submitReview.isPending}
                onClick={() => submitReview.mutate()}
              >
                Post review
              </Button>
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary underline">
                Sign in
              </Link>{" "}
              to leave a review.
            </p>
          )}

          {reviewsQuery.data?.length ? (
            <ul className="space-y-3">
              {reviewsQuery.data.map((r) => (
                <li key={r.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <Stars value={r.rating} />
                  {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          )}
        </section>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-google-green" />
          Listings are published by KYC verified Malawian developers.
        </p>
      </article>
    </AppShell>
  );
}
