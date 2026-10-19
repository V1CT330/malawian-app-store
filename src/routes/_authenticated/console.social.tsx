import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  Home,
  MessageCircle,
  Menu,
  Search,
  Users,
} from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console/social")({
  component: SocialPage,
});

const sections = [
  { id: "Feed", icon: Home, description: "Updates from people and communities will appear here." },
  { id: "Friends", icon: Users, description: "Find people and build your network." },
  { id: "Messages", icon: MessageCircle, description: "Your conversations with other MAS members." },
  { id: "Notifications", icon: Bell, description: "Likes, comments, follows, and other activity." },
  { id: "Search", icon: Search, description: "Search for people, posts, and projects on MAS." },
] as const;

function SocialPage() {
  useRequireDeveloper();
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("Feed");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const ActiveIcon = active.icon;

  return (
    <ConsoleShell title="Social" hideTopBar hideTitleCard>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-3">
          <SheetTitle className="mb-4 px-2 font-semibold">Developer console</SheetTitle>
          <nav aria-label="Developer console menu" className="space-y-1">
            {[
              { label: "Dashboard", to: "/console" },
              { label: "Social", to: "/console/social" },
              { label: "Products", to: "/console/products" },
              { label: "Publishing", to: "/console/publishing" },
              { label: "Testing", to: "/console/testing" },
              { label: "Analytics", to: "/console/analytics" },
              { label: "Settings", to: "/console/settings" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className="block border-b border-border px-3 py-3 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <section className="border-y border-border bg-background">
        <h1 className="px-4 py-3 text-xl font-semibold sm:px-5">Social</h1>
        <nav
          aria-label="Social menu"
          className="flex w-full items-stretch justify-evenly border-b border-border px-1 sm:px-3"
        >
          {sections.map(({ id, icon: Icon }) => {
            const selected = activeSection === id;
            const sectionButton = (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                aria-label={id}
                title={id}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center border-b-2 px-2 py-3 transition-colors duration-200 sm:px-5",
                  selected
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              </button>
            );

            if (id !== "Search") return sectionButton;

            return (
              <div key={id} className="flex min-w-0 flex-1 flex-col items-stretch">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar menu"
                  title="Sidebar menu"
                  className="flex items-center justify-center px-2 py-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                {sectionButton}
              </div>
            );
          })}
        </nav>

        <main className="min-h-[220px] min-w-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">{activeSection}</h2>
            </div>
          </div>

          {activeSection === "Feed" ? (
            <section className="px-4 py-6 sm:px-5">
              <h3 className="text-sm font-semibold">Welcome to Social</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                A place for everyone on MAS to share updates, discover people, discuss ideas, and collaborate.
              </p>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-sm font-medium">Your feed is getting ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posts and community interactions will appear here when Social features are implemented.
                </p>
              </div>
            </section>
          ) : (
            <section className="px-4 py-7 sm:px-5">
              <h3 className="text-sm font-semibold">{activeSection} is coming soon</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{active.description}</p>
            </section>
          )}
        </main>
      </section>
    </ConsoleShell>
  );
}
