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
      <section className="pb-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-primary"><Wallet className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet status</p>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Setup pending</span>
            </div>
            <h2 className="mt-1 font-display text-xl font-bold">Earnings ledger not connected</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Confirmed earnings will appear here after MAS connects marketplace and Social transactions to a secure ledger. No sample balance is shown as real money.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Wallet overview" className="grid grid-cols-1 border-y border-border sm:grid-cols-3">
        <div className="py-4 sm:pr-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4 text-muted-foreground" /> Available</div>
          <p className="mt-2 text-sm text-muted-foreground">Your verified, withdrawable balance will appear here.</p>
        </div>
        <div className="border-t border-border py-4 sm:border-l sm:border-t-0 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4 text-muted-foreground" /> Pending</div>
          <p className="mt-2 text-sm text-muted-foreground">Funds awaiting settlement or refund checks.</p>
        </div>
        <div className="border-t border-border py-4 sm:border-l sm:border-t-0 sm:pl-5">
          <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-muted-foreground" /> Transactions</div>
          <p className="mt-2 text-sm text-muted-foreground">A complete history of earnings, fees and payouts.</p>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="font-display text-lg font-bold">How earnings will work</h2>
        <div className="mt-2 divide-y divide-border">
          <article className="flex gap-3 py-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Payments</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">PayChangu already supports Developer Pro checkout. Marketplace purchases and Social creator payments still need their own verified transaction flows.</p>
              <Link to="/console/subscription" className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:underline">View Developer Pro <ArrowDownToLine className="ml-2 h-4 w-4" /></Link>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Payout protection</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Withdrawals should only open after identity and payout details are verified, funds are eligible, and payout support is confirmed.</p>
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><CircleAlert className="h-4 w-4" /> Withdrawals are not enabled</p>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Fair access</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">A subscription should unlock premium tools, not be required to withdraw legitimate earnings. Verification and fraud controls apply to everyone.</p>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <ArrowLeftRight className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">One shared ledger</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Marketplace sales and eligible Social earnings should share transaction records, commission rules, refunds and payout history.</p>
            </div>
          </article>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button asChild variant="outline"><Link to="/console">Back to dashboard</Link></Button>
        <Button asChild><Link to="/advertise">Manage promotions</Link></Button>
      </div>

    </ConsoleShell>
  );
}
