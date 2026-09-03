import { createFileRoute, Link } from "@tanstack/react-router";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { SectionCard } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/settings")({
  head: () => ({
    meta: [
      { title: "Console Settings — Malawian App Store" },
      {
        name: "description",
        content:
          "Developer account settings: profile, verification, subscription and store listing preferences.",
      },
      { property: "og:title", content: "Console Settings — Malawian App Store" },
      { property: "og:description", content: "Developer account and console preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsoleSettingsPage,
});

function ConsoleSettingsPage() {
  useRequireDeveloper();
  const { profile } = useProfile();

  return (
    <ConsoleShell
      title="Settings"
      description="Your developer account, verification and subscription."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Settings" }]}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Developer account">
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Name: {profile?.developer_name || profile?.display_name || "Not set"}</li>
            <li>Verification: {profile?.kyc_status ?? "none"}</li>
            <li>Phone verified: {profile?.phone_verified ? "yes" : "no"}</li>
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/settings">Open account settings</Link>
          </Button>
        </SectionCard>

        <SectionCard title="Verification">
          <p className="text-sm text-muted-foreground">
            Complete identity checks to earn the verified developer badge.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/console/verification">Manage verification</Link>
          </Button>
        </SectionCard>

        <SectionCard title="Subscription">
          <p className="text-sm text-muted-foreground">
            Developer Pro is MK5,000 per month and unlocks priority review and advanced tools.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/console/subscription">Manage subscription</Link>
          </Button>
        </SectionCard>

        <SectionCard title="Store presence">
          <p className="text-sm text-muted-foreground">
            Edit your public developer page and the details shoppers see in the store.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/console/store">Open store listing</Link>
          </Button>
        </SectionCard>
      </div>
    </ConsoleShell>
  );
}
