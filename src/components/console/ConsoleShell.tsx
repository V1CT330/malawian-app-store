import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FlaskConical,
  LayoutDashboard,
  LayoutList,
  LifeBuoy,
  LineChart,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import logo from "@/assets/logo-mark.png";
import { GeminiIcon } from "@/components/GeminiIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsAdmin, useProfile, useSignedUrl, useUnreadCount } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { CONSOLE_NAV } from "@/lib/console";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  social: MessageSquare,
  products: LayoutList,
  publishing: Rocket,
  testing: FlaskConical,
  quality: ClipboardCheck,
  analytics: LineChart,
  reviews: MessageSquare,
  advertise: Megaphone,
  spotlight: Sparkles,
  store: Store,
  manage: Users,
  settings: Settings,
  wallet: Wallet,
};

const navLinkClass =
  "group flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-colors";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Developer console" className="space-y-1">
      <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Console
      </p>
      {CONSOLE_NAV.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active =
          item.to === "/console" ? pathname === "/console" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              navLinkClass,
              active
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export type Crumb = { label: string; to?: string };

export function ConsoleShell({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  hideTopBar = false,
  hideTitleCard = false,
  fullWidth = false,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
  hideTopBar?: boolean;
  hideTitleCard?: boolean;
  fullWidth?: boolean;
}) {
  const { userId, profile } = useProfile();
  const isAdmin = useIsAdmin();
  const unread = useUnreadCount();
  const profileAvatar = useSignedUrl(profile?.avatar_url);
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);

  const initial = (profile?.developer_name || profile?.display_name || "D")
    .slice(0, 1)
    .toUpperCase();
  const verified = profile?.kyc_status === "approved";

  const leaveDeveloper = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ mode: "user" }).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  return (
    <div className="console-square flex min-h-screen bg-muted/40">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-4 py-5 xl:flex">
        <Link to="/console" className="mb-6 flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
          <img src={logo} alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-display text-sm font-bold leading-tight">
            Developer
            <span className="block text-xs font-medium text-muted-foreground">
              Malawian App Store
            </span>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><NavList /></div>
        <div className="mt-auto space-y-1 pt-4">
          <Link
            to="/console/assistant"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <GeminiIcon className="h-4 w-4" /> AI assistant
          </Link>
          <Link
            to="/console/resources"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LifeBuoy className="h-4 w-4" /> Help and resources
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!hideTopBar && <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-3 sm:px-6">
            <Sheet open={drawer} onOpenChange={setDrawer}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="xl:hidden"
                  aria-label="Open console menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto bg-sidebar p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetTitle className="mb-4 flex shrink-0 items-center gap-2 px-2 font-display text-sm">
                  <img src={logo} alt="" width={24} height={24} className="h-6 w-6" />
                  Developer console
                </SheetTitle>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><NavList onNavigate={() => setDrawer(false)} /></div>
                <div className="mt-4 space-y-1 border-t border-border pt-3">
                  <Link
                    to="/console/assistant"
                    onClick={() => setDrawer(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    <GeminiIcon className="h-4 w-4" /> AI assistant
                  </Link>
                  <Link
                    to="/console/resources"
                    onClick={() => setDrawer(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    <LifeBuoy className="h-4 w-4" /> Help and resources
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {profile?.developer_name || profile?.display_name || "Your developer account"}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {verified ? (
                  <>
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-green" /> Verified developer
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" /> Verification{" "}
                    {profile?.kyc_status ?? "none"}
                  </>
                )}
              </p>
            </div>

            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Help">
              <Link to="/console/resources">
                <CircleHelp className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative"
            >
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary text-xs font-semibold text-primary-foreground"
                >
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {profile?.display_name || "Developer"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/console/settings">Console settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/console/verification">Verification</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/console/subscription">Subscription</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Administration dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => leaveDeveloper.mutate()}>
                  Switch to user mode
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>}

        <main className={cn("w-full min-w-0 flex-1 pb-20", fullWidth ? "max-w-none overflow-x-clip px-0" : "mx-auto max-w-6xl px-3 sm:px-6", hideTopBar ? "pt-0" : "pt-5")}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <ol className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {c.to ? (
                    <Link to={c.to} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
                </li>
              ))}
            </ol>
          )}
          {!hideTitleCard && (
            <div className="console-hero mb-6 flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
                {description && (
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export function VerifiedBadge({ status }: { status: string | undefined }) {
  if (status === "approved") {
    return (
      <Badge className="gap-1">
        <BadgeCheck className="h-3.5 w-3.5" /> Verified
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="capitalize">
      KYC {status ?? "none"}
    </Badge>
  );
}
