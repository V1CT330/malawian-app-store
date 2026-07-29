import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Gamepad2, LayoutDashboard, Search, Upload, User } from "lucide-react";
import type { ReactNode } from "react";

import { useProfile } from "@/hooks/useSession";
import { SOCIAL_LINKS } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Apps", icon: Gamepad2 },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Account", icon: User },
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
  const { profile } = useProfile();
  const initial = (profile?.display_name || profile?.developer_name || "U").slice(0, 1).toUpperCase();

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
            <Link
              to="/settings"
              aria-label="Account"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initial}
            </Link>
          </div>
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
          {NAV.map((item) => {
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
                    "flex h-7 w-16 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
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
