import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Download, History, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { signedAssetUrl, type Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "My Library, Malawian App Store" },
      {
        name: "description",
        content:
          "Your installed apps, saved listings and download history on the Malawian App Store.",
      },
      { property: "og:title", content: "My Library, Malawian App Store" },
      {
        property: "og:description",
        content: "Installed apps, saved listings and download history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [downloadedUpdates, setDownloadedUpdates] = useState<Record<string, string>>({});

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

  const installed = useQuery({
    queryKey: ["installed-apps", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installed_apps")
        .select(
          "id,listing_id,installed_version_id,installed_at,updated_at,listings(*,listing_versions(*))",
        )
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const uninstall = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("installed_apps")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("App uninstalled");
      queryClient.invalidateQueries({ queryKey: ["installed-apps", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateApp = useMutation({
    mutationFn: async ({
      listingId,
      fileUrl,
    }: {
      id: string;
      listingId: string;
      versionId: string;
      fileUrl: string | null;
    }) => {
      if (!fileUrl) throw new Error("This release has no downloadable package.");
      const url = await signedAssetUrl(fileUrl);
      if (!url) throw new Error("Could not create a download link. Try again later.");
      window.open(url, "_blank", "noopener,noreferrer");

      const { error: eventError } = await supabase.rpc("register_install", {
        _listing_id: listingId,
        _device: navigator.platform,
      });
      if (eventError) throw eventError;
    },
    onSuccess: (_result, variables) => {
      setDownloadedUpdates((current) => ({ ...current, [variables.id]: variables.versionId }));
      toast.success("Update package opened. Install it on Android, then confirm below.");
      queryClient.invalidateQueries({ queryKey: ["install-history", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmUpdate = useMutation({
    mutationFn: async ({ id, versionId }: { id: string; versionId: string }) => {
      const { error } = await supabase
        .from("installed_apps")
        .update({ installed_version_id: versionId })
        .eq("id", id)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      setDownloadedUpdates((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      toast.success("Library version updated.");
      queryClient.invalidateQueries({ queryKey: ["installed-apps", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function openApp(fileUrl: string | null) {
    if (!fileUrl) {
      toast.info("The developer has not published a download file yet.");
      return;
    }
    const url = await signedAssetUrl(fileUrl);
    if (url) window.open(url, "_blank", "noopener");
  }

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
          {installed.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : installed.data?.length ? (
            installed.data.map((row) => {
              const listing = row.listings as
                | (Listing & {
                    listing_versions?: Array<{
                      id: string;
                      file_url: string | null;
                      created_at: string;
                      status: string;
                    }>;
                  })
                | null;
              if (!listing) return null;
              const latest = [...(listing.listing_versions ?? [])]
                .filter((version) => version.status === "released" || version.status === "published")
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              const updateAvailable = Boolean(latest && latest.id !== row.installed_version_id);
              return (
                <div key={row.id} className="surface-card p-3">
                  <ListingCard listing={listing} />
                  <p className="px-1 text-xs text-muted-foreground">
                    Installed {new Date(row.installed_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 px-1">
                    {updateAvailable && latest ? (
                      <>
                        <Button
                          size="sm"
                          disabled={updateApp.isPending}
                          onClick={() =>
                            updateApp.mutate({
                              id: row.id,
                              listingId: row.listing_id,
                              versionId: latest.id,
                              fileUrl: latest.file_url,
                            })
                          }
                        >
                          <RefreshCw className="mr-1.5 h-4 w-4" /> Download update
                        </Button>
                        {downloadedUpdates[row.id] === latest.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={confirmUpdate.isPending}
                            onClick={() => confirmUpdate.mutate({ id: row.id, versionId: latest.id })}
                          >
                            I installed it
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openApp(latest?.file_url ?? null)}
                      >
                        <Download className="mr-1.5 h-4 w-4" /> Download again
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={uninstall.isPending}
                      onClick={() => uninstall.mutate(row.id)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Uninstall
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              Apps you install will appear here.
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(row.listing_id)}
                      >
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
