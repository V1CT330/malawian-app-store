import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  Compass,
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
  { id: "Discover", icon: Compass, description: "Discover people, posts, and projects across MAS." },
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
    <ConsoleShell title="Social" description="Connect with people across Malawian App Store.">
      <div className="-mx-3 -mt-2 border-y border-border bg-background sm:-mx-6">
        <div className="grid min-h-[calc(100vh-11rem)] grid-cols-[54px_minmax(0,1fr)] md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_240px]">
          <aside className="border-r border-border bg-background py-3">
            <nav aria-label="Social menu" className="sticky top-[5rem] space-y-1 px-1.5 md:px-3">
              {sections.map(({ id, icon: Icon }) => {
                const selected = activeSection === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSection(id)}
                    aria-current={selected ? "page" : undefined}
                    title={id}
                    className={cn(
                      "flex w-full items-center justify-center gap-3 border-l-2 px-2 py-3 text-sm transition-colors duration-200 md:justify-start md:px-3",
                      selected
                        ? "border-primary bg-muted font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="hidden md:inline">{id}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 border-r border-border">
            <div className="sticky top-[4.5rem] z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
              <div className="flex items-center gap-3">
                <ActiveIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold">{activeSection}</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">MAS community</span>
                <Search className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            {activeSection === "Feed" ? (
              <>
                <section className="border-b border-border px-4 py-5 sm:px-6">
                  <h3 className="text-base font-semibold">Welcome to Social</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    A place for everyone on MAS to share updates, discover people, discuss ideas, and collaborate.
                  </p>
                </section>
                <section className="px-4 py-10 text-center sm:px-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center border border-border bg-muted">
                    <Home className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">Your feed is getting ready</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Posts and community interactions will appear here when Social features are implemented.
                  </p>
                </section>
              </>
            ) : (
              <section className="px-4 py-12 text-center sm:px-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center border border-border bg-muted">
                  <ActiveIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold">{activeSection} is coming soon</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{active.description}</p>
              </section>
            )}
          </main>

          <aside className="hidden min-w-0 bg-background xl:block">
            <div className="border-b border-border px-4 py-4">
              <h2 className="text-sm font-semibold">About Social</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Connect with members, follow developers, and discover products from the MAS community.
              </p>
            </div>
            <div className="px-4 py-4">
              <h2 className="text-sm font-semibold">Coming to Social</h2>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                <li className="border-b border-border pb-3">Posts, photos, and updates</li>
                <li className="border-b border-border pb-3">Profiles and following</li>
                <li className="border-b border-border pb-3">Private messaging</li>
                <li className="pb-1">Groups and collaboration</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </ConsoleShell>
  );
}
