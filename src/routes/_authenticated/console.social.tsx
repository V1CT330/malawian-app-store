import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Newspaper, Users } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/social")({
  component: SocialPage,
});

function SocialPage() {
  useRequireDeveloper();

  const features = [
    {
      icon: Newspaper,
      title: "Feed and posts",
      description: "Share updates, ideas, photos, and projects with the MAS community.",
    },
    {
      icon: MessageCircle,
      title: "Messages",
      description: "Connect and have private conversations with other members.",
    },
    {
      icon: Users,
      title: "Groups and collaboration",
      description: "Find people with shared interests and work together on projects.",
    },
  ];

  return (
    <ConsoleShell
      title="Social"
      description="Connect with people, share what you're building, and collaborate across the MAS community."
    >
      <section className="surface-card p-5 sm:p-6">
        <p className="text-sm font-semibold">Your community starts here</p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Social is being prepared. Posts, messaging, groups, and collaboration are planned for this space;
          these features are not available yet.
        </p>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <section key={title} className="surface-card p-4">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <span className="mt-3 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Coming soon
            </span>
          </section>
        ))}
      </div>
    </ConsoleShell>
  );
}
