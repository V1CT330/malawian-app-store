import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, BadgeCheck, CircleAlert, Clock3, CreditCard, History, ShieldCheck, Wallet } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/console/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & earnings · Malawian App Store" },
      {
        name: "description",
        content: "Manage developer earnings, transaction history and payout readiness on Malawian App Store.",
      },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  useRequireDeveloper();

  return (
    <ConsoleShell
      title="Wallet & earnings"
      description="One place for your future app sales, subscriptions and eligible Social earnings."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Wallet & earnings" }]}
    >
      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Wallet className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet status</p>
            <h2 className="mt-1 font-display text-xl font-bold">Earnings ledger not connected</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This page will show your confirmed earnings after MAS connects real marketplace and Social transactions to a secure server-side ledger. We are deliberately not showing a sample balance as if it were real money.
            </p>
          </div>
          <span className="shrink-0 border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Setup pending</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4 text-muted-foreground" /> Available</div>
            <p className="mt-2 text-sm text-muted-foreground">Shown when verified ledger entries are available.</p>
          </div>
          <div className="border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4 text-muted-foreground" /> Pending</div>
            <p className="mt-2 text-sm text-muted-foreground">Clearing periods, refunds and payment checks will be reflected here.</p>
          </div>
          <div className="border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-muted-foreground" /> Transactions</div>
            <p className="mt-2 text-sm text-muted-foreground">A verified, auditable history of earnings, fees and payouts.</p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h3 className="font-semibold">Payments</h3></div>
          <p className="mt-2 text-sm text-muted-foreground">PayChangu already supports the Developer Pro checkout flow. Marketplace purchases, creator payments and seller earnings still need their own verified transaction flows.</p>
          <Link to="/console/subscription" className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline">View Developer Pro <ArrowDownToLine className="ml-2 h-4 w-4" /></Link>
        </article>
        <article className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-semibold">Payout protection</h3></div>
          <p className="mt-2 text-sm text-muted-foreground">Withdrawals should only be enabled after identity and payout details are verified, funds are eligible, and PayChangu payout access is confirmed.</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><CircleAlert className="h-4 w-4" /> Withdrawals are not enabled</p>
        </article>
        <article className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary" /><h3 className="font-semibold">Fair access</h3></div>
          <p className="mt-2 text-sm text-muted-foreground">A paid subscription should unlock premium tools, not be required to withdraw legitimate earnings. Verification and fraud controls apply to everyone.</p>
        </article>
        <article className="surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" /><h3 className="font-semibold">One shared ledger</h3></div>
          <p className="mt-2 text-sm text-muted-foreground">Marketplace sales and eligible Social earnings should use the same transaction record, commission rules, refund handling and payout history.</p>
        </article>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/console">Back to dashboard</Link></Button>
        <Button asChild><Link to="/advertise">Manage promotions</Link></Button>
      </div>
    </ConsoleShell>
  );
}
