import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, History } from "lucide-react";
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
        content: "Your wishlist and download history of Malawian apps and websites.",
      },
      { property: "og:title", content: "My Library — Malawian App Store" },
      { property: "og:description", content: "Wishlist and download history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const wishlist = useQuery({
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

  const history = useQuery({
    queryKey: ["install-history", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("install_events")
        .select("id, created_at, listings(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as { id: string; created_at: string; listings: Listing | null }[];
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
      toast.success("Removed from wishlist");
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">My library</h1>
      <Tabs defaultValue="wishlist" className="mt-4">
        <TabsList>
          <TabsTrigger value="wishlist" className="gap-1.5">
            <Heart className="h-4 w-4" /> Wishlist
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wishlist" className="mt-4 space-y-3">
          {wishlist.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : wishlist.data?.length ? (
            wishlist.data.map(
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
              Tap the heart on any listing to save it here.
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
