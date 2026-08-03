import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PortalTabs } from "@/components/PortalTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, TEAM_ROLES } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team Collaboration — Malawian App Store" },
      {
        name: "description",
        content: "Invite team members, set role based permissions and review the shared activity log.",
      },
      { property: "og:title", content: "Team Collaboration — Malawian App Store" },
      { property: "og:description", content: "Invite members and track workspace activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

type ActivityRow = { id: string; action: string; target: string | null; created_at: string };

function TeamPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");

  const members = useQuery({
    queryKey: ["team", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,email,role,status,created_at")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const activity = useQuery({
    queryKey: ["activity", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id,action,target,created_at")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Enter a valid email address");
      const { error } = await supabase
        .from("team_members")
        .insert({ owner_id: userId, email: clean, role, status: "invited" });
      if (error) throw error;
      await logActivity({ ownerId: userId, actorId: userId, action: `Invited ${clean} as ${role}` });
    },
    onSuccess: () => {
      toast.success("Invitation recorded");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["team", userId] });
      queryClient.invalidateQueries({ queryKey: ["activity", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { role?: string; status?: string } }) => {
      const { error } = await supabase.from("team_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share your workspace with collaborators and keep an audit trail.
      </p>
      <div className="mt-4">
        <PortalTabs />
      </div>

      <section className="surface-card p-4">
        <h2 className="font-display text-base font-semibold">Invite a member</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              value={email}
              maxLength={255}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.mw"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="self-end" disabled={invite.isPending} onClick={() => invite.mutate()}>
            Invite
          </Button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {TEAM_ROLES.map((r) => (
            <li key={r.value}>
              {r.label}: {r.hint}
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-3 font-display text-base font-semibold">Members</h2>
        {members.data?.length ? (
          <ul className="space-y-3">
            {members.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="mr-auto">
                  <p className="text-sm font-medium">{m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {m.status}
                </Badge>
                <Select value={m.role} onValueChange={(value) => updateMember.mutate({ id: m.id, patch: { role: value } })}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {m.status !== "active" && (
                  <Button size="sm" variant="outline" onClick={() => updateMember.mutate({ id: m.id, patch: { status: "active" } })}>
                    Activate
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeMember.mutate(m.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        )}
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-3 font-display text-base font-semibold">Activity log</h2>
        {activity.data?.length ? (
          <ul className="space-y-2 text-sm">
            {activity.data.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>
                  {a.action}
                  {a.target ? ` — ${a.target}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
      </section>
    </AppShell>
  );
}
