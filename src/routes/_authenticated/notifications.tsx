import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useUnreadCount } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications, Malawian App Store" },
      { name: "description", content: "Your mode-specific Malawian App Store alerts." },
      { property: "og:title", content: "Notifications, Malawian App Store" },
      { property: "og:description", content: "Your mode-specific alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId, profile, isLoading: profileLoading } = useProfile();
  const scope = profile?.mode === "developer" ? "developer" : "user";
  const queryClient = useQueryClient();
  const unread = useUnreadCount(scope);

  const list = useQuery({
    queryKey: ["notifications", scope, userId],
    enabled: Boolean(userId) && Boolean(profile),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .eq("scope", scope)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications", scope, userId] }),
      queryClient.invalidateQueries({ queryKey: ["unread", scope, userId] }),
    ]);
  };

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId!)
        .eq("scope", scope)
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
        .eq("user_id", userId!)
        .eq("scope", scope);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {scope === "developer" ? "Developer notifications" : "Notifications"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "developer"
              ? "Publishing, verification, product reviews and developer account alerts."
              : "Store, account and marketplace alerts."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={markAll.isPending || unread === 0}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {markAll.isPending ? "Marking…" : "Mark all read"}
        </Button>
      </div>

      <div className="space-y-3">
        {profileLoading || list.isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : list.isError ? (
          <div role="alert" className="surface-card flex flex-col items-start gap-3 p-4 text-sm">
            <p className="text-destructive">Could not load notifications.</p>
            <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : list.data?.length ? (
          list.data.map((notification) => (
            <article key={notification.id} className="surface-card flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{notification.title}</p>
                {notification.body && <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.created_at).toLocaleString()}
                  {!notification.read && " · new"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(notification.id)}
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
    </div>
  );

  if (scope === "developer") {
    return (
      <ConsoleShell title="Developer notifications" description="Alerts for your developer account." hideTitleCard>
        {content}
      </ConsoleShell>
    );
  }

  return <AppShell>{content}</AppShell>;
}
