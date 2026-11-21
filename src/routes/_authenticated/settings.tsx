import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ChevronRight,
  LogOut,
  Moon,
  Palette,
  Store,
} from "lucide-react";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DEVELOPER_TERMS_VERSION, DeveloperTermsDialog } from "@/components/DeveloperTerms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useMode, useProfile, useSignedUrl } from "@/hooks/useSession";
import { ACCENT_PRESETS, useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { formatMwk, uploadAsset } from "@/lib/store";
import { PRO_NAME, PRO_ANNUAL_PRICE_MWK } from "@/lib/pro";
import { hasProAccess } from "@/lib/pro-access";
import { startDeveloperTrial } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings · Malawian App Store" },
      {
        name: "description",
        content: "Manage your account, profile, appearance, workspace and account preferences.",
      },
      { property: "og:title", content: "Account settings · Malawian App Store" },
      { property: "og:description", content: "Manage your Malawian App Store account." },
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
  const avatar = useSignedUrl(profile?.avatar_url);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const cover = useSignedUrl(profile?.cover_image_url);
  const [termsOpen, setTermsOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["account-auth-details", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { email: data.user?.email ?? null, provider: data.user?.app_metadata?.provider ?? "email" };
    },
    staleTime: 5 * 60 * 1000,
  });

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId && mode === "developer"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
      queryClient.invalidateQueries({ queryKey: ["account-auth-details", userId] }),
      queryClient.invalidateQueries({ queryKey: ["social", "profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["developer", userId] }),
    ]);
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      const nextDisplayName = (displayName ?? profile?.display_name ?? "").trim();
      const nextDeveloperName = (profile?.developer_name ?? "").trim();
      const nextBio = (bio ?? profile?.bio ?? "").trim();
      if (nextDisplayName.length > 80) throw new Error("Display name must be 80 characters or fewer");
      if (nextDeveloperName.length > 100) throw new Error("Developer name must be 100 characters or fewer");
      if (nextBio.length > 300) throw new Error("Bio must be 300 characters or fewer");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: nextDisplayName || null,
          developer_name: nextDeveloperName || null,
          bio: nextBio || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile saved");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Could not save profile"),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Sign in required");
      if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
      if (file.size > 5 * 1024 * 1024) throw new Error("Profile images must be 5 MB or smaller");
      const path = await uploadAsset(userId, file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile photo updated");
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["signed-url"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not upload profile photo"),
  });

  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Sign in required");
      if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
      if (file.size > 8 * 1024 * 1024) throw new Error("Cover images must be 8 MB or smaller");
      const path = await uploadAsset(userId, file, "profile-covers");
      const { error } = await supabase.from("profiles").update({ cover_image_url: path }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cover picture updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
        queryClient.invalidateQueries({ queryKey: ["social", "profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["signed-url"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Could not upload cover picture"),
  });

  const beginDeveloperTrial = useServerFn(startDeveloperTrial);
  // Retain the previous workspace only for rollback if developer activation fails.
  const previousWorkspaceRef = useRef({ mode, isDeveloper: profile?.is_developer ?? false });

  const setMode = useMutation({
    onMutate: () => {
      previousWorkspaceRef.current = { mode, isDeveloper: profile?.is_developer ?? false };
    },
    mutationFn: async ({
      next,
      acceptTerms,
    }: {
      next: "developer" | "user";
      acceptTerms?: boolean;
    }) => {
      if (!userId) throw new Error("Sign in required");
      const { error } = await supabase
        .from("profiles")
        .update({
          mode: next,
          is_developer: next === "developer" ? true : (profile?.is_developer ?? false),
          ...(acceptTerms ? { developer_terms_accepted_at: new Date().toISOString(), developer_terms_version: DEVELOPER_TERMS_VERSION } : {}),
        })
        .eq("id", userId);
      if (error) throw error;
      if (next === "developer") await beginDeveloperTrial();
      return next;
    },
    onSuccess: (next, variables) => {
      setTermsOpen(false);
      // Update the cached source of truth immediately so the destination route
      // sees the new mode without waiting for a profile refetch.
      queryClient.setQueryData(["profile", userId], (current: typeof profile) =>
        current
          ? {
              ...current,
              mode: next,
              is_developer: next === "developer" ? true : current.is_developer,
              ...(variables.acceptTerms
                ? { developer_terms_accepted_at: new Date().toISOString(), developer_terms_version: DEVELOPER_TERMS_VERSION }
                : {}),
            }
          : current,
      );
      // Reconcile with the server in the background rather than blocking navigation.
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/console" : "/" });
    },
    onError: async (error: Error, variables) => {
      if (variables.next === "developer" && userId) {
        const previous = previousWorkspaceRef.current;
        const { error: rollbackError } = await supabase
          .from("profiles")
          .update({ mode: previous.mode, is_developer: previous.isDeveloper })
          .eq("id", userId);
        queryClient.setQueryData(["profile", userId], (current: typeof profile) =>
          current ? { ...current, mode: previous.mode, is_developer: previous.isDeveloper } : current,
        );
        if (rollbackError) console.error("Could not roll back failed Developer Mode activation:", rollbackError.message);
      }
      toast.error(error.message);
    },
  });

  const settingsMode = mode;

  function toggleDeveloper(on: boolean) {
    if (!on) {
      setMode.mutate({ next: "user" });
      return;
    }
    if (!profile?.developer_terms_accepted_at || profile.developer_terms_version !== DEVELOPER_TERMS_VERSION) {
      setTermsOpen(true);
      return;
    }
    setMode.mutate({ next: "developer" });
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message || "Could not sign out. Please try again.");
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (profile?.display_name || profile?.developer_name || account.data?.email || "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <AppShell>
      <main className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-3 py-6 sm:px-6 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-8 -z-10 h-56 w-2/3 rounded-[3rem] bg-sky-100/70 blur-3xl dark:bg-sky-950/30" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[28rem] -z-10 h-48 w-1/2 rounded-[2.5rem] bg-blue-100/50 blur-3xl dark:bg-blue-950/20" />
        <header className="mb-8">
          <p className="text-sm font-medium text-sky-700 dark:text-sky-300">Malawian App Store · {settingsMode === "developer" ? "Developer account" : "Your account"}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage your account, personal details, appearance and workspace preferences.</p>
        </header>
        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
          <aside className="h-fit rounded-3xl border border-sky-100 bg-sky-50/70 p-3 dark:border-sky-900/50 dark:bg-sky-950/20 lg:sticky lg:top-24">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-sky-800/70 dark:text-sky-200/70">Settings menu</p>
            <nav aria-label="Settings navigation" className="grid grid-cols-2 gap-1 lg:grid-cols-1">
              <a href="#profile" className="rounded-2xl px-3 py-3 text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-900/70">Profile</a>
              <a href="#appearance" className="rounded-2xl px-3 py-3 text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-900/70">Appearance</a>
              <a href="#workspace" className="rounded-2xl px-3 py-3 text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-900/70">Workspace</a>
              <a href="#account" className="rounded-2xl px-3 py-3 text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-900/70">Account</a>
            </nav>
          </aside>
          <div className="min-w-0 space-y-6">
            <section id="profile" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7">
              <div className="mb-6"><h2 className="text-xl font-semibold tracking-tight">Personal information</h2><p className="mt-1 text-sm text-muted-foreground">Manage the information shown on your MAS profile.</p></div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 text-2xl font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">{avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <span>{initial}</span>}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{profile?.display_name || "Your name"}</p><p className="mt-1 break-all text-sm text-muted-foreground">{account.data?.email ?? "Loading account email…"}</p>
                  {profile?.is_developer ? <Link to="/console/store" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">Manage public developer profile <ChevronRight className="h-4 w-4" /></Link> : <><button type="button" onClick={() => avatarInput.current?.click()} disabled={uploadAvatar.isPending} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-300"><Camera className="h-4 w-4" />{uploadAvatar.isPending ? "Uploading photo…" : "Change profile photo"}</button><input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label="Choose profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAvatar.mutate(file); event.currentTarget.value = ""; }} /><p className="mt-1 text-xs text-muted-foreground">Images up to 5 MB.</p></>}
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="space-y-2"><p className="text-sm font-medium">Cover picture</p><div className="relative h-28 overflow-hidden rounded-2xl bg-sky-50 dark:bg-sky-950/40 sm:h-36">{cover ? <img src={cover} alt="Your profile cover" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No cover picture selected</div>}</div><button type="button" onClick={() => coverInput.current?.click()} disabled={uploadCover.isPending} className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:underline disabled:opacity-50 dark:text-sky-300"><Camera className="h-4 w-4" />{uploadCover.isPending ? "Uploading cover…" : cover ? "Change cover picture" : "Add cover picture"}</button><input ref={coverInput} type="file" accept="image/*" className="sr-only" aria-label="Choose profile cover picture" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadCover.mutate(file); event.currentTarget.value = ""; }} /><p className="text-xs text-muted-foreground">Wide images up to 8 MB.</p></div>
                <div className="grid gap-2"><Label htmlFor="display" className="text-sm">Display name</Label><input id="display" value={displayName ?? profile?.display_name ?? ""} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="How should we call you?" className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15" /><p className="text-xs text-muted-foreground">Up to 80 characters.</p></div>
                {profile?.is_developer ? <p className="text-sm leading-6 text-muted-foreground">Your developer name, professional bio and public links are managed in your developer profile so they stay consistent across MAS.</p> : <div className="grid gap-2"><Label htmlFor="bio" className="text-sm">Bio</Label><Textarea id="bio" rows={4} maxLength={300} value={bio ?? profile?.bio ?? ""} onChange={(event) => setBio(event.target.value)} placeholder="A little about yourself…" className="min-h-24 resize-y rounded-xl border-border" /><p className="text-right text-xs text-muted-foreground">{(bio ?? profile?.bio ?? "").length}/300</p></div>}
                <Button className="rounded-full bg-sky-700 px-6 text-white hover:bg-sky-800" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>{saveProfile.isPending ? "Saving…" : "Save profile"}</Button>
              </div>
            </section>
            <section id="appearance" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7">
              <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight">Appearance</h2><p className="mt-1 text-sm text-muted-foreground">Choose how MAS looks on this device.</p></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/40 p-4"><div className="flex items-start gap-3"><Moon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Dark theme</p><p className="mt-1 text-sm text-muted-foreground">Use a darker interface in low light.</p></div></div><Switch aria-label="Toggle dark theme" checked={dark} onCheckedChange={setTheme} /></div>
              <div className="mt-5 flex items-start gap-3"><Palette className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Accent color</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Customize the highlight color across the store and Developer Mode. Your choice is saved on this device.</p><div className="mt-4 flex flex-wrap gap-2">{ACCENT_PRESETS.map((preset) => <button key={preset.value} type="button" onClick={() => setAccent(preset.value)} aria-label={`Use ${preset.name} accent color`} aria-pressed={accent.toLowerCase() === preset.value.toLowerCase()} title={preset.name} className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${accent.toLowerCase() === preset.value.toLowerCase() ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50" : "border-border hover:bg-muted/60"}`}><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.value }} />{preset.name}</button>)}</div><div className="mt-4 flex flex-wrap items-center gap-3"><label className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"><span className="text-muted-foreground">Custom color</span><input aria-label="Choose custom accent color" type="color" value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#168447"} onChange={(event) => setAccent(event.target.value)} className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" /></label><span className="font-mono text-xs uppercase text-muted-foreground">{accent}</span></div></div></div>
            </section>
            <section id="workspace" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7">
              <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight">Workspace</h2><p className="mt-1 text-sm text-muted-foreground">Choose how you use Malawian App Store.</p></div>
              <div className="flex flex-col gap-4 rounded-2xl bg-sky-50/70 p-4 dark:bg-sky-950/20 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><Store className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" /><div><p className="text-sm font-semibold">{setMode.isPending ? "Switching workspace…" : settingsMode === "developer" ? "Developer workspace" : "User mode"}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{settingsMode === "developer" ? "Manage published products and developer tools." : "Discover apps, save products and manage your library."}</p></div></div><Button className="rounded-full bg-sky-700 text-white hover:bg-sky-800" disabled={setMode.isPending} onClick={() => { if (settingsMode === "developer") navigate({ to: "/console" }); else toggleDeveloper(true); }}>{setMode.isPending ? "Switching…" : settingsMode === "developer" ? "Open Developer Console" : "Enable Developer Mode"}</Button></div>
              <div className="mt-4 divide-y divide-border">{settingsMode === "developer" ? <><Link to="/console" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">Developer console</p><p className="mt-1 text-xs text-muted-foreground">Products and publishing</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link><Link to="/console/store" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">Public developer profile</p><p className="mt-1 text-xs text-muted-foreground">Your public presence</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link><Link to="/console/verification" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">Identity verification</p><p className="mt-1 text-xs text-muted-foreground">Verification status</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link><Link to="/console/subscription" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">{PRO_NAME}</p><p className="mt-1 text-xs text-muted-foreground">{hasProAccess(subscription.data) ? `Active · ${formatMwk(PRO_ANNUAL_PRICE_MWK)} yearly` : "Manage your plan"}</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>{isAdmin && <Link to="/admin" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">Administration dashboard</p><p className="mt-1 text-xs text-muted-foreground">Review submissions and manage MAS</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>}</> : <><Link to="/" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">Browse apps and websites</p><p className="mt-1 text-xs text-muted-foreground">Discover products on MAS.</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link><Link to="/library" className="flex items-center gap-3 py-4 hover:text-sky-700 dark:hover:text-sky-300"><span className="min-w-0 flex-1"><p className="text-sm font-medium">My library</p><p className="mt-1 text-xs text-muted-foreground">Saved, installed and recently opened products.</p></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link></>}</div>
            </section>
            <section id="account" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7"><div className="mb-4"><h2 className="text-xl font-semibold tracking-tight">Account</h2><p className="mt-1 text-sm text-muted-foreground">Your sign-in details and account access.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">Signed-in email</p><p className="mt-1 break-all text-sm text-muted-foreground">{account.data?.email ?? "Loading account email…"}</p></div><Button variant="outline" className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></section>
          </div>
        </div>
      </main>
      <DeveloperTermsDialog open={termsOpen} onOpenChange={setTermsOpen} pending={setMode.isPending} onAccept={() => setMode.mutate({ next: "developer", acceptTerms: true })} />
    </AppShell>
  );
}
