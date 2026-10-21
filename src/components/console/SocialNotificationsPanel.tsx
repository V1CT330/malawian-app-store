import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// The table is added by supabase/migrations/20261021143000_social_invest_and_notifications.sql.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const socialDb = supabase as any;

export function SocialNotificationsPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["social", "notifications", userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; body: string; read: boolean; created_at: string }[];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["social", "notifications", userId] });
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await socialDb.from("social_notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message || "Could not update notification"),
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await socialDb.from("social_notifications").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message || "Could not dismiss notification"),
  });

  return <div className="w-full bg-background px-4 py-5 sm:px-6 lg:px-8">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Social notifications</h2><p className="mt-1 text-sm text-muted-foreground">Connection requests, reactions, comments and messages.</p></div>
      <Link to="/notifications" className="text-sm font-medium text-primary hover:underline">Store notifications</Link>
    </div>
    {list.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading social notifications…</p> : list.isError ? <div role="alert" className="border border-border p-4 text-sm"><p className="font-medium">Social notifications are not available yet.</p><p className="mt-1 text-muted-foreground">Apply the MAS Social database migration to the production Supabase project to enable this inbox.</p></div> : list.data?.length ? <div className="divide-y divide-border border-y border-border">
      {list.data.map((item) => <article key={item.id} className={cn("flex items-start gap-3 py-4", !item.read && "bg-primary/[0.04]")}>
        <Bell className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          <time className="mt-2 block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time>
          <div className="mt-2 flex gap-3">{!item.read && <button type="button" onClick={() => markRead.mutate(item.id)} className="text-xs font-medium text-primary hover:underline">Mark read</button>}<button type="button" onClick={() => dismiss.mutate(item.id)} className="text-xs text-muted-foreground hover:text-destructive">Dismiss</button></div>
        </div>
      </article>)}
    </div> : <div className="border-y border-border py-12 text-center"><Bell className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">New Social activity will appear here.</p></div>}
  </div>;
}
