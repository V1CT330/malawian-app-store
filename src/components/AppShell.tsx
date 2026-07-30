import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Bot,
  Gamepad2,
  Heart,
  LayoutDashboard,
  Moon,
  Search,
  Shield,
  Sun,
  Upload,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useIsAdmin, useMode, useProfile, useUnreadCount } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_LINKS } from "@/lib/store";
import { cn } from "@/lib/utils";

const USER_NAV = [
  { to: "/", label: "Apps", icon: Gamepad2 },
  { to: "/library", label: "Library", icon: Heart },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Account", icon: User },
] as const;

const DEV_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/assistant", label: "AI", icon: Bot },
  { to: "/settings", label: "Account", icon: User },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("mas:theme");
    const next = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }, []);
  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("mas:theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };
  return { dark, toggle };
}

export function ModeSwitch() {
  const { userId, profile } = useProfile();
  const mode = useMode();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const setMode = useMutation({
    mutationFn: async (next: "developer" | "user") => {
      const { error } = await supabase
        .from("profiles")
        .update({ mode: next, is_developer: next === "developer" ? true : profile?.is_developer ?? false })
        .eq("id", userId!);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      navigate({ to: next === "developer" ? "/dashboard" : "/" });
      toast.success(next === "developer" ? "Developer workspace" : "Back to the store");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!userId) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={mode === "user" ? "text-foreground" : "text-muted-foreground"}>👤 User</span>
      <Switch
        aria-label="Switch between user and developer mode"
        checked={mode === "developer"}
        onCheckedChange={(v) => setMode.mutate(v ? "developer" : "user")}
      />
      <span className={mode === "developer" ? "text-foreground" : "text-muted-foreground"}>
        👨‍💻 Developer
      </span>
    </div>
  );
}

export function AppShell({
  children,
  search,
  onSearchChange,
}: {
  children: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { userId, profile } = useProfile();
  const mode = useMode();
  const isAdmin = useIsAdmin();
  const unread = useUnreadCount();
  const { dark, toggle } = useTheme();
  const initial = (profile?.display_name || profile?.developer_name || "U").slice(0, 1).toUpperCase();
  const nav = mode === "developer" ? DEV_NAV : USER_NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 bg-background px-3 pb-2 pt-3">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center gap-3 rounded-full bg-secondary px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search ?? ""}
              onChange={(e) =>
                onSearchChange ? onSearchChange(e.target.value) : navigate({ to: "/" })
              }
              onFocus={() => {
                if (!onSearchChange) navigate({ to: "/" });
              }}
              placeholder="Search apps & websites"
              aria-label="Search apps and websites"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {isAdmin && (
              <Link to="/admin" aria-label="Admin panel" className="shrink-0 text-muted-foreground hover:text-foreground">
                <Shield className="h-4 w-4" />
              </Link>
            )}
            <Link
              to={userId ? "/settings" : "/auth"}
              aria-label="Account"
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initial}
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
          {userId && (
            <div className="mt-2 flex justify-end">
              <ModeSwitch />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-28 pt-1 sm:pb-12">{children}</main>

      <footer className="border-t border-border px-4 py-8 pb-28 sm:pb-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-sm text-muted-foreground">
          <p className="font-display font-semibold text-foreground">Malawian App Store</p>
          <p>Discover and publish apps and websites built in Malawi.</p>
          <div className="flex flex-wrap gap-4">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-primary"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-stretch">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
              >
                <span
                  className={cn(
                    "relative flex h-7 w-16 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.to === "/notifications" && unread > 0 && (
                    <span className="absolute right-3 top-0 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </span>
                <span className={active ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
