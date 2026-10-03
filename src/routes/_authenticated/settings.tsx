import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, LogOut, Moon, Palette, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DeveloperTermsDialog } from "@/components/DeveloperTerms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useMode, useProfile } from "@/hooks/useSession";
import { ACCENT_PRESETS, useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { PRO_NAME, PRO_PRICE_MWK } from "@/lib/pro";
import { formatMwk } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Malawian App Store" },
      {
        name: "description",
        content:
          "Manage your profile, switch between shopping and developer mode, choose your theme and reach your developer tools.",
      },
      { property: "og:title", content: "Settings · Malawian App Store" },
      { property: "og:description", content: "Profile, developer mode and theme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mode = useMode();
  const isAdmin = useIsAdmin();
  const { dark, setTheme, accent, setAccent } = useTheme();
  const [termsOpen, setTermsOpen] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [developerName, setDeveloperName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile", userId] });

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName ?? profile?.display_name ?? null,
          developer_name: developerName ?? profile?.developer_name ?? null,
          bio: bio ?? profile?.bio ?? null,
        })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMode = useMutation({
    mutationFn: async ({ next, acceptTerms }: { next: "developer" | "user"; acceptTerms?: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          mode: next,
          is_developer: next === "developer" ? true : profile?.is_developer ?? false,
          ...(acceptTerms ? { developer_terms_accepted_at: new Date().toISOString() } : {}),
        })
        .eq("id", userId!);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      setTermsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/console" : "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDeveloper(on: boolean) {
    if (!on) {
      setMode.mutate({ next: "user" });
      return;
    }
    if (!profile?.developer_terms_accepted_at) {
      setTermsOpen(true);
      return;
    }
    setMode.mutate({ next: "developer" });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <section className="surface-card mt-5 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Profile</h2>
        <div>
          <Label htmlFor="display">Display name</Label>
          <Input
            id="display"
            value={displayName ?? profile?.display_name ?? ""}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={3}
            maxLength={300}
            value={bio ?? profile?.bio ?? ""}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Save profile
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Developer mode</h2>
            <p className="text-xs text-muted-foreground">Switch between shopping and publishing.</p>
          </div>
          <Switch
            aria-label="Switch between user and developer mode"
            checked={mode === "developer"}
            onCheckedChange={(v) => toggleDeveloper(v)}
          />
        </div>
        {profile?.is_developer && (
          <div>
            <Label htmlFor="devname">Developer or studio name</Label>
            <Input
              id="devname"
              value={developerName ?? profile?.developer_name ?? ""}
              onChange={(e) => setDeveloperName(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2"
              disabled={saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
            >
              Save
            </Button>
          </div>
        )}
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-display text-base font-semibold">Accent color</h2>
            <p className="text-xs text-muted-foreground">Choose the color used for actions and highlights.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              aria-label={`Use ${preset.name}`}
              aria-pressed={accent === preset.value}
              onClick={() => setAccent(preset.value)}
              className="relative h-10 w-10 rounded-full border-2 border-background shadow-sm ring-1 ring-border"
              style={{ backgroundColor: preset.value }}
            >
              {accent === preset.value && <Check className="absolute inset-0 m-auto h-5 w-5 text-primary-foreground" />}
            </button>
          ))}
          <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-secondary" title="Custom color">
            <Palette className="h-4 w-4" />
            <input
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              aria-label="Choose a custom accent color"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="font-display text-base font-semibold">Dark theme</h2>
              <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
            </div>
          </div>
          <Switch aria-label="Toggle dark theme" checked={dark} onCheckedChange={(v) => setTheme(v)} />
        </div>
      </section>

      {isAdmin && (
        <section className="surface-card mt-4 flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Admin panel</h2>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Open</Link>
          </Button>
        </section>
      )}

      {mode === "developer" && (
        <section className="surface-card mt-4 space-y-3 p-4">
          <h2 className="font-display text-base font-semibold">Developer tools</h2>
          <p className="text-xs text-muted-foreground">
            Your public profile, social pages, verification and plan live in the developer section.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { to: "/console", label: "Developer console" },
              { to: "/console/store", label: "My public profile" },
              { to: "/console/verification", label: "Verification" },
              { to: "/console/subscription", label: PRO_NAME },
            ].map((l) => (
              <Button key={l.to} asChild size="sm" variant="outline">
                <Link to={l.to}>{l.label}</Link>
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Plan:{" "}
            {subscription.data?.status === "active"
              ? `Active · ${formatMwk(PRO_PRICE_MWK)} monthly`
              : "Not subscribed"}
          </p>
        </section>
      )}

      <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>

      <DeveloperTermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        pending={setMode.isPending}
        onAccept={() => setMode.mutate({ next: "developer", acceptTerms: true })}
      />
    </AppShell>
  );
}
