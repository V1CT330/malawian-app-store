import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, LayoutDashboard, Settings, Upload } from "lucide-react";
import type { ReactNode } from "react";

import { SOCIAL_LINKS } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Store", icon: Compass },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-base font-bold tracking-tight">
            Malawian <span className="text-gradient-google">App Store</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary",
                  pathname === item.to && "bg-accent text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 sm:pb-12">{children}</main>

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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
