import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, SectionCard } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { submissionRequirements, readinessScore } from "@/lib/console";
import { useMyListings } from "@/lib/console.queries";
import { asoReport } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/console/quality")({
  head: () => ({
    meta: [
      { title: "Quality, Developer Console" },
      {
        name: "description",
        content:
          "Listing readiness and store optimisation checks for every product you publish on the Malawian App Store.",
      },
      { property: "og:title", content: "Quality, Developer Console" },
      { property: "og:description", content: "Readiness and store optimisation checks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QualityPage,
});

function QualityPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const listingsQuery = useMyListings(userId);
  const listings = listingsQuery.data ?? [];

  return (
    <ConsoleShell
      title="Quality"
      description="How complete and discoverable each listing is right now."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Quality" }]}
    >
      {listingsQuery.isLoading ? (
        <RowSkeletons count={3} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No products to check yet"
          description="Once you create a listing, its readiness and optimisation checks appear here."
          action={
            <Button asChild>
              <Link to="/upload">Start a listing</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((l) => {
            const readiness = readinessScore(l);
            const aso = asoReport(l);
            const missing = submissionRequirements(l).filter((r) => !r.ok);
            return (
              <SectionCard
                key={l.id}
                title={l.name}
                action={
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/console/products/$id" params={{ id: l.id }}>
                      Open
                    </Link>
                  </Button>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Listing readiness</span>
                      <span className="tabular-nums">{readiness}%</span>
                    </div>
                    <Progress value={readiness} className="mt-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Store optimisation</span>
                      <span className="tabular-nums">{aso.score}%</span>
                    </div>
                    <Progress value={aso.score} className="mt-1.5" />
                  </div>
                  {missing.length > 0 && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {missing.slice(0, 4).map((m) => (
                        <li key={m.label}>
                          {m.label}: {m.hint}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </ConsoleShell>
  );
}
