import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, SectionCard, StatusPill } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { readinessScore } from "@/lib/console";
import { useMyListings } from "@/lib/console.queries";
import { kindLabel } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/console/publishing")({
  head: () => ({
    meta: [
      { title: "Publishing, Developer Console" },
      {
        name: "description",
        content:
          "Track every product through draft, review and live on the Malawian App Store publishing pipeline.",
      },
      { property: "og:title", content: "Publishing, Developer Console" },
      { property: "og:description", content: "Your review and release pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublishingPage,
});

const STAGES = [
  { key: "draft", label: "Drafts", hint: "Complete the checklist, then submit." },
  { key: "pending", label: "In review", hint: "With the store review team." },
  { key: "published", label: "Live", hint: "Visible to everyone in the store." },
  { key: "rejected", label: "Needs changes", hint: "Fix the issues and resubmit." },
] as const;

function PublishingPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const listingsQuery = useMyListings(userId);
  const listings = listingsQuery.data ?? [];

  return (
    <ConsoleShell
      title="Publishing"
      description="Every product, grouped by where it sits in the review pipeline."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Publishing" }]}
      actions={
        <Button asChild>
          <Link to="/upload">New product</Link>
        </Button>
      }
    >
      {listingsQuery.isLoading ? (
        <RowSkeletons count={4} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nothing in the pipeline yet"
          description="Start a listing and it will appear here as it moves through review."
          action={
            <Button asChild>
              <Link to="/upload">Start a listing</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {STAGES.map((stage) => {
            const rows = listings.filter((l) => l.status === stage.key);
            return (
              <SectionCard key={stage.key} title={`${stage.label} (${rows.length})`}>
                <p className="-mt-1 mb-3 text-sm text-muted-foreground">{stage.hint}</p>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products at this stage.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {rows.map((l) => (
                      <li key={l.id}>
                        <Link
                          to="/console/products/$id"
                          params={{ id: l.id }}
                          className="flex items-center gap-3 py-3"
                        >
                          <img
                            src={l.icon_url ?? "/favicon.png"}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{l.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {kindLabel(l.kind)} · {readinessScore(l)}% ready
                            </p>
                          </div>
                          <StatusPill status={l.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </ConsoleShell>
  );
}
