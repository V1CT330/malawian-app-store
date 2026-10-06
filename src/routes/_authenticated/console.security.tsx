import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { clientContext } from "@/lib/store";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/security")({
  head: () => ({
    meta: [
      { title: "Account Security — Malawian App Store" },
      {
        name: "description",
        content:
          "Two factor authentication, backup codes, login history, active sessions and account recovery.",
      },
      { property: "og:title", content: "Account Security — Malawian App Store" },
      { property: "og:description", content: "Protect your developer account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityPage,
});

type Settings = {
  two_factor_enabled: boolean;
  backup_codes: string[] | null;
  recovery_email: string | null;
};

type LoginEvent = {
  id: string;
  device: string | null;
  platform: string | null;
  country: string | null;
  session_active: boolean;
  created_at: string;
};

function makeCodes() {
  return Array.from(
    { length: 8 },
    () => Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6),
  );
}

function SecurityPage() {
  useRequireDeveloper();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [recovery, setRecovery] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["security", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_settings")
        .select("two_factor_enabled,backup_codes,recovery_email")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Settings | null;
    },
  });

  const events = useQuery({
    queryKey: ["login-events", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_events")
        .select("id,device,platform,country,session_active,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LoginEvent[];
    },
  });

  // Record this sign-in once per session so login history and devices stay useful.
  useEffect(() => {
    if (!userId) return;
    const key = `mas-login-logged-${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const ctx = clientContext();
    void supabase
      .from("login_events")
      .insert({
        user_id: userId,
        device: ctx.device,
        country: ctx.country,
        platform: navigator.platform || "web",
        session_active: true,
      })
      .then(() => queryClient.invalidateQueries({ queryKey: ["login-events", userId] }));
  }, [userId, queryClient]);

  const save = useMutation({
    mutationFn: async (patch: {
      two_factor_enabled?: boolean;
      backup_codes?: string[];
      recovery_email?: string | null;
    }) => {
      if (!userId) throw new Error("Sign in required");
      const { error } = await supabase
        .from("security_settings")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Security settings saved");
      queryClient.invalidateQueries({ queryKey: ["security", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("login_events")
        .update({ session_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session signed out");
      queryClient.invalidateQueries({ queryKey: ["login-events", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const twoFactor = settings.data?.two_factor_enabled ?? false;
  const codes = settings.data?.backup_codes ?? [];

  return (
    <ConsoleShell title="Security">
      <h1 className="font-display text-2xl font-bold">Security</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Keep your developer account and products protected.
      </p>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Two factor authentication</h2>
            <p className="text-sm text-muted-foreground">
              Require a second step with your recovery email when signing in on a new device.
            </p>
          </div>
          <Switch
            checked={twoFactor}
            onCheckedChange={(checked) => save.mutate({ two_factor_enabled: checked })}
            aria-label="Two factor authentication"
          />
        </div>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Backup codes</h2>
        <p className="text-sm text-muted-foreground">
          Store these safely. Each code can be used once.
        </p>
        {codes.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            {codes.map((c) => (
              <span key={c} className="rounded-lg bg-secondary px-2 py-1 text-center">
                {c}
              </span>
            ))}
          </div>
        )}
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => save.mutate({ backup_codes: makeCodes() })}
        >
          {codes.length ? "Regenerate codes" : "Generate codes"}
        </Button>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Account recovery</h2>
        <Label htmlFor="recovery" className="mt-3 block">
          Recovery email
        </Label>
        <Input
          id="recovery"
          value={recovery ?? settings.data?.recovery_email ?? ""}
          maxLength={255}
          onChange={(e) => setRecovery(e.target.value)}
          placeholder="backup@example.mw"
        />
        <Button
          className="mt-3"
          size="sm"
          onClick={() => save.mutate({ recovery_email: (recovery ?? "").trim() || null })}
        >
          Save recovery email
        </Button>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-3 font-display text-base font-semibold">Login history and devices</h2>
        {events.data?.length ? (
          <ul className="space-y-3">
            {events.data.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="mr-auto">
                  <p className="text-sm font-medium capitalize">
                    {e.device ?? "Unknown device"} · {e.platform ?? "web"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.country ?? "Unknown"} · {new Date(e.created_at).toLocaleString()}
                  </p>
                </div>
                {e.session_active ? (
                  <>
                    <Badge>Active</Badge>
                    <Button size="sm" variant="outline" onClick={() => endSession.mutate(e.id)}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary">Ended</Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>
        )}
      </section>
    </ConsoleShell>
  );
}
