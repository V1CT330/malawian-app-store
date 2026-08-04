import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Gamepad2,
  LayoutDashboard,
  LayoutGrid,
  Search,
  Upload,
  User,
} from "lucide-react";
import { type ReactNode } from "react";

import logo from "@/assets/logo-mark.png";
import { GeminiIcon } from "@/components/GeminiIcon";
import { useMode, useProfile, useUnreadCount } from "@/hooks/useSession";
import { SOCIAL_LINKS } from "@/lib/store";
import { cn } from "@/lib/utils";

const USER_NAV = [
  { to: "/", label: "Apps", icon: Gamepad2 },
  { to: "/library", label: "Library", icon: LayoutGrid },

  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Account", icon: User },
] as const;

const DEV_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/assistant", label: "AI", icon: GeminiIcon },
] as const;

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
  const unread = useUnreadCount();
  const initial = (profile?.display_name || profile?.developer_name || "U").slice(0, 1).toUpperCase();
  const nav = mode === "developer" ? DEV_NAV : USER_NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 bg-background px-3 pb-2 pt-3">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center gap-3 rounded-full bg-secondary px-3 py-2 shadow-soft">
            <Link to="/" aria-label="Malawian App Store home" className="shrink-0">
              <img src={logo} alt="Malawian App Store logo" width={28} height={28} className="h-7 w-7" />
            </Link>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search ?? ""}
              onChange={(e) => (onSearchChange ? onSearchChange(e.target.value) : navigate({ to: "/" }))}
              onFocus={() => {
                if (!onSearchChange) navigate({ to: "/" });
              }}
              placeholder="Search apps & websites"
              aria-label="Search apps and websites"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Link
              to={userId ? "/settings" : "/auth"}
              aria-label="Account"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initial}
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 pb-28 pt-1 sm:pb-12">{children}</main>

      <footer className="border-t border-border px-4 py-8 pb-28 sm:pb-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-display font-semibold text-foreground">
            <img src={logo} alt="" width={20} height={20} loading="lazy" className="h-5 w-5" />
            Malawian App Store
          </p>
          <p>Discover and publish apps and websites built in Malawi.</p>
          <div className="flex flex-wrap gap-4">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener" className="hover:text-primary">
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
