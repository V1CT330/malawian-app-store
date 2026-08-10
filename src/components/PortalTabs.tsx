import { Link } from "@tanstack/react-router";

const TABS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analytics", label: "Growth" },
  { to: "/advertise", label: "Advertise" },
  { to: "/spotlight", label: "Spotlight" },
  { to: "/profile", label: "My Profile" },
  { to: "/verification", label: "Verification" },
  { to: "/pro", label: "Developer Pro" },
  { to: "/team", label: "Team" },
  { to: "/security", label: "Security" },
  { to: "/resources", label: "Resources" },
] as const;

export function PortalTabs() {
  return (
    <nav aria-label="Developer portal" className="-mx-3 mb-4 overflow-x-auto px-3">
      <ul className="flex w-max gap-2">
        {TABS.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              className="block rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "border-primary bg-accent text-accent-foreground" }}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
