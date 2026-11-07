import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications, Malawian App Store" },
      {
        name: "description",
        content: "Store updates, review decisions and messages from the team.",
      },
      { property: "og:title", content: "Notifications, Malawian App Store" },
      { property: "og:description", content: "Store updates and review decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
      queryClient.invalidateQueries({ queryKey: ["unread", userId] }),
    ]);
  };

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <Button
          size="sm"
          variant="outline"
          disabled={markAll.isPending || !(list.data ?? []).some((notification) => !notification.read)}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {markAll.isPending ? "Marking…" : "Mark all read"}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {list.isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : list.isError ? (
          <div role="alert" className="surface-card flex flex-col items-start gap-3 p-4 text-sm">
            <p className="text-destructive">Could not load notifications.</p>
            <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : list.data?.length ? (
          list.data.map((n) => (
            <article key={n.id} className="surface-card flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {!n.read && " · new"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(n.id)}
              >
                {dismiss.isPending ? "Dismissing…" : "Dismiss"}
              </Button>
            </article>
          ))
        ) : (
          <p className="surface-card flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <BellOff className="h-5 w-5" /> Nothing here yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
