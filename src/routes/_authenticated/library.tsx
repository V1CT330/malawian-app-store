import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Download, History } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "My Library — Malawian App Store" },
      {
        name: "description",
        content: "Your installed apps, saved listings and download history on the Malawian App Store.",
      },
      { property: "og:title", content: "My Library — Malawian App Store" },
      { property: "og:description", content: "Installed apps, saved listings and download history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["install-history", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("install_events")
        .select("id, created_at, listings(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as { id: string; created_at: string; listings: Listing | null }[];
    },
  });

  /** Unique listings the user has installed, newest first. */
  const installed = (() => {
    const seen = new Set<string>();
    const rows: { listing: Listing; created_at: string }[] = [];
    for (const row of history.data ?? []) {
      if (!row.listings || seen.has(row.listings.id)) continue;
      seen.add(row.listings.id);
      rows.push({ listing: row.listings, created_at: row.created_at });
    }
    return rows;
  })();

  const saved = useQuery({
    queryKey: ["wishlist", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("listing_id, created_at, listings(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { listing_id: string; listings: Listing | null }[];
    },
  });

  const remove = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", userId!)
        .eq("listing_id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from saved");
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">My library</h1>
      <Tabs defaultValue="installed" className="mt-4">
        <TabsList>
          <TabsTrigger value="installed" className="gap-1.5">
            <Download className="h-4 w-4" /> Installed
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5">
            <Bookmark className="h-4 w-4" /> Saved
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="mt-4 space-y-3">
          {history.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : installed.length ? (
            installed.map((row) => (
              <div key={row.listing.id} className="space-y-1">
                <ListingCard listing={row.listing} />
                <p className="px-1 text-xs text-muted-foreground">
                  Installed {new Date(row.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          ) : (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              Apps and websites you install will appear here.
            </p>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4 space-y-3">
          {saved.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : saved.data?.length ? (
            saved.data.map(
              (row) =>
                row.listings && (
                  <div key={row.listing_id} className="space-y-1">
                    <ListingCard listing={row.listings} />
                    <div className="px-1">
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(row.listing_id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ),
            )
          ) : (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              Save any listing to find it here later.
            </p>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {history.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : history.data?.length ? (
            history.data.map(
              (row) =>
                row.listings && (
                  <div key={row.id} className="space-y-1">
                    <ListingCard listing={row.listings} />
                    <p className="px-1 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                ),
            )
          ) : (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              Downloads you make will show up here.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
