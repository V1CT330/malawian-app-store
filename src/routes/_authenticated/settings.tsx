import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  LogOut,
  Moon,
  Store,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DeveloperTermsDialog } from "@/components/DeveloperTerms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMode, useProfile, useSignedUrl } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { formatMwk, uploadAsset } from "@/lib/store";
import { PRO_NAME, PRO_PRICE_MWK } from "@/lib/pro";

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
  const { dark, setTheme } = useTheme();
  const avatar = useSignedUrl(profile?.avatar_url);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [developerName, setDeveloperName] = useState<string | null>(null);
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
        .select("status")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    await queryClient.invalidateQueries({ queryKey: ["account-auth-details", userId] });
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      const nextDisplayName = (displayName ?? profile?.display_name ?? "").trim();
      const nextDeveloperName = (developerName ?? profile?.developer_name ?? "").trim();
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

  const setMode = useMutation({
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
          ...(acceptTerms ? { developer_terms_accepted_at: new Date().toISOString() } : {}),
        })
        .eq("id", userId);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      setTermsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/console" : "/" });
    },
    onError: (error: Error) => toast.error(error.message),
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
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b border-border pb-5 pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your account</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage your profile, preferences and how you use Malawian App Store.
          </p>
          <nav aria-label="Settings sections" className="mt-5 flex max-w-full gap-5 overflow-x-auto border-b border-border text-sm">
            <a href="#profile" className="shrink-0 border-b-2 border-primary pb-3 font-medium">Profile</a>
            <a href="#preferences" className="shrink-0 border-b-2 border-transparent pb-3 text-muted-foreground hover:text-foreground">Appearance</a>
            <a href="#workspace" className="shrink-0 border-b-2 border-transparent pb-3 text-muted-foreground hover:text-foreground">Workspace</a>
            <a href="#notifications" className="shrink-0 border-b-2 border-transparent pb-3 text-muted-foreground hover:text-foreground">Notifications</a>
          </nav>
        </header>

        <section id="profile" className="scroll-mt-24 border-b border-border py-7 sm:py-8">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
            <div>
              <h2 className="font-display text-lg font-semibold">Profile</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">The details people see when they discover you.</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-4 border-b border-border pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-xl font-semibold">
                  {avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <span>{initial}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{profile?.display_name || "Your name"}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{account.data?.email ?? "Loading account email…"}</p>
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploadAvatar.isPending}
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" /> {uploadAvatar.isPending ? "Uploading photo…" : "Change profile photo"}
                  </button>
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Choose profile photo"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadAvatar.mutate(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Images up to 5 MB.</p>
                </div>
              </div>

              <div className="grid gap-5 py-5">
                <div className="grid gap-2">
                  <Label htmlFor="display" className="text-sm">Display name</Label>
                  <input
                    id="display"
                    value={displayName ?? profile?.display_name ?? ""}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    placeholder="How should we call you?"
                    className="h-11 w-full border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">Up to 80 characters.</p>
                </div>
                {profile?.is_developer && (
                  <div className="grid gap-2">
                    <Label htmlFor="devname" className="text-sm">Developer or studio name</Label>
                    <input
                      id="devname"
                      value={developerName ?? profile?.developer_name ?? ""}
                      onChange={(event) => setDeveloperName(event.target.value)}
                      maxLength={100}
                      placeholder="Your studio or developer name"
                      className="h-11 w-full border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="bio" className="text-sm">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={4}
                    maxLength={300}
                    value={bio ?? profile?.bio ?? ""}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="A little about yourself…"
                    className="min-h-24 resize-y rounded-none border-border"
                  />
                  <p className="text-right text-xs text-muted-foreground">{(bio ?? profile?.bio ?? "").length}/300</p>
                </div>
                <div>
                  <Button
                    className="rounded-none px-5"
                    disabled={saveProfile.isPending}
                    onClick={() => saveProfile.mutate()}
                  >
                    {saveProfile.isPending ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="preferences" className="scroll-mt-24 border-b border-border py-7 sm:py-8">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
            <div>
              <h2 className="font-display text-lg font-semibold">Appearance</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Make the store feel comfortable to use.</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4 border-b border-border py-4 first:pt-0">
                <div className="flex items-start gap-3">
                  <Moon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div><p className="text-sm font-medium">Dark theme</p><p className="mt-1 text-sm text-muted-foreground">Use a darker interface in low light.</p></div>
                </div>
                <Switch aria-label="Toggle dark theme" checked={dark} onCheckedChange={setTheme} />
              </div>
            </div>
          </div>
        </section>

        <section id="workspace" className="scroll-mt-24 border-b border-border py-7 sm:py-8">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
            <div>
              <h2 className="font-display text-lg font-semibold">Workspace</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Choose how you use the platform.</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                <div className="flex items-start gap-3">
                  <Store className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{mode === "developer" ? "Developer workspace" : "Shopping mode"}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {mode === "developer" ? "Manage your published products and developer tools." : "Discover apps, save products and manage your library."}
                    </p>
                  </div>
                </div>
                <Switch
                  aria-label="Switch between user and developer mode"
                  checked={mode === "developer"}
                  disabled={setMode.isPending}
                  onCheckedChange={toggleDeveloper}
                />
              </div>
              {mode === "developer" ? (
                <div className="divide-y divide-border">
                  {[
                    { to: "/console", label: "Developer console", detail: "Products and publishing" },
                    { to: "/console/store", label: "Public developer profile", detail: "Your public presence" },
                    { to: "/console/verification", label: "Identity verification", detail: "Verification status" },
                    { to: "/console/subscription", label: PRO_NAME, detail: subscription.data?.status === "active" ? `Active · ${formatMwk(PRO_PRICE_MWK)} monthly` : "Manage your plan" },
                  ].map((item) => (
                    <Link key={item.to} to={item.to} className="group flex items-center gap-3 py-4 hover:text-primary">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <Link to="/" className="group flex items-center gap-3 py-4 hover:text-primary">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">Browse apps and websites</p><p className="mt-1 text-xs text-muted-foreground">Discover products on MAS.</p></div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <Link to="/library" className="group flex items-center gap-3 py-4 hover:text-primary">
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">My library</p><p className="mt-1 text-xs text-muted-foreground">Saved, installed and recently opened products.</p></div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="notifications" className="scroll-mt-24 border-b border-border py-7 sm:py-8">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
            <div>
              <h2 className="font-display text-lg font-semibold">Notifications</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">View updates and messages about your account.</p>
            </div>
            <div className="min-w-0 divide-y divide-border">
              <Link to="/notifications" className="group flex items-center gap-3 py-4 first:pt-0 hover:text-primary">
                <Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">Notifications</p><p className="mt-1 text-xs text-muted-foreground">Store updates, review decisions and account messages.</p></div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">Your account settings are saved to your profile or device as appropriate.</p>
          <Button variant="outline" className="w-full rounded-none border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <DeveloperTermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        pending={setMode.isPending}
        onAccept={() => setMode.mutate({ next: "developer", acceptTerms: true })}
      />
    </AppShell>
  );
}
