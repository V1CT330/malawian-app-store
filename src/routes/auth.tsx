import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Malawian App Store" },
      {
        name: "description",
        content: "Sign in with Google or email to install apps, post reviews and publish your own listings.",
      },
      { property: "og:title", content: "Sign in — Malawian App Store" },
      { property: "og:description", content: "Sign in to install, review and publish apps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { userId, ready } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && userId) navigate({ to: safePath(search.redirect), replace: true });
  }, [ready, userId, navigate, search.redirect]);

  async function handleGoogle() {
    setBusy(true);
    try {
      sessionStorage.setItem("mas:redirect", safePath(search.redirect));
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-2xl font-bold">
          Welcome to the <span className="text-gradient-google">store</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to install apps, review them, and publish your own.
        </p>

        <Button className="mt-5 w-full" variant="outline" onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button className="w-full" onClick={handleEmail} disabled={busy || !email || password.length < 6}>
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <button
            className="w-full text-center text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "I already have an account" : "Create a new account"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
