import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  Home,
  MessageCircle,
  Search,
  Users,
  UserRound,
  UsersRound,
} from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console/social")({
  component: SocialPage,
});

const sections = [
  { id: "Feed", icon: Home, description: "Updates from people and communities will appear here." },
  { id: "Friends", icon: Users, description: "Find people and build your network." },
  { id: "Groups", icon: UsersRound, description: "Communities for shared interests and collaboration." },
  { id: "Messages", icon: MessageCircle, description: "Your conversations with other MAS members." },
  { id: "Notifications", icon: Bell, description: "Likes, comments, follows, and other activity." },
  { id: "Saved", icon: Bookmark, description: "Keep posts and projects you want to revisit." },
  { id: "My profile", icon: UserRound, description: "Your public profile, posts, and published products." },
] as const;

function SocialPage() {
  useRequireDeveloper();
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("Feed");
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const ActiveIcon = active.icon;

  return (
    <ConsoleShell title="Social" hideTopBar hideTitleCard>
      <section className="border-y border-border bg-background">
        <h1 className="px-4 py-3 text-xl font-semibold sm:px-5">Social</h1>
        <nav
          aria-label="Social menu"
          className="flex items-stretch gap-1 overflow-x-auto border-b border-border px-2 sm:px-3"
        >
          {sections.map(({ id, icon: Icon }) => {
            const selected = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors duration-200 sm:px-4",
                  selected
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{id}</span>
              </button>
            );
          })}
        </nav>

        <main className="min-h-[220px] min-w-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-base font-semibold">{activeSection}</h2>
            </div>
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
