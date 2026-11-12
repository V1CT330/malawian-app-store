import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, BadgeCheck, CircleAlert, Clock3, CreditCard, History, ShieldCheck, Wallet } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
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

function formatMwk(value: number | null | undefined) {
  return new Intl.NumberFormat("en-MW", { maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function WalletPage() {
  useRequireDeveloper();
  const { userId } = useProfile();

  const walletQuery = useQuery({
    queryKey: ["developer-wallet", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) throw new Error("Sign in to view your wallet.");
      const [{ data: wallet, error: walletError }, { data: transactions, error: transactionError }] = await Promise.all([
        supabase
          .from("wallets")
          .select("id,user_id,balance_mwk,pending_mwk,lifetime_mwk,updated_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("wallet_transactions")
          .select("id,kind,amount_mwk,status,method,reference,description,listing_id,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (walletError) throw walletError;
      if (transactionError) throw transactionError;
      return { wallet, transactions: transactions ?? [] };
    },
  });

  const wallet = walletQuery.data?.wallet;
  const transactions = walletQuery.data?.transactions ?? [];

  return (
    <ConsoleShell
      title="Wallet & earnings"
      description="Your developer earnings ledger, transaction history and payout readiness."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Wallet & earnings" }]}
    >
      <section className="pb-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-primary"><Wallet className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet status</p>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {wallet ? "Ledger connected" : walletQuery.isLoading ? "Loading ledger" : "No ledger record"}
              </span>
            </div>
            <h2 className="mt-1 font-display text-xl font-bold">
              {wallet ? "Developer wallet" : "Earnings ledger not connected"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {wallet
                ? "These figures come from your saved MAS wallet record. Earnings appear only when a trusted payment flow records a transaction."
                : "Your balance will appear after a trusted MAS payment flow creates a wallet record. We do not invent sample balances or count unconfirmed payments as earnings."}
            </p>
          </div>
        </div>
        {walletQuery.isError && (
          <p role="alert" className="mt-4 border-l-2 border-destructive pl-3 text-sm text-destructive">
            Could not load wallet data. Refresh the page or try again later.
          </p>
        )}
      </section>

      <section aria-label="Wallet overview" className="grid grid-cols-1 border-y border-border sm:grid-cols-3">
        <div className="py-4 sm:pr-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4 text-muted-foreground" /> Available balance</div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">
            {walletQuery.isLoading ? "—" : wallet ? `MK ${formatMwk(wallet.balance_mwk)}` : "MK 0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Withdrawable only after payout eligibility checks are implemented.</p>
        </div>
        <div className="border-t border-border py-4 sm:border-l sm:border-t-0 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4 text-muted-foreground" /> Pending</div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">
            {walletQuery.isLoading ? "—" : wallet ? `MK ${formatMwk(wallet.pending_mwk)}` : "MK 0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Funds awaiting settlement or refund checks.</p>
        </div>
        <div className="border-t border-border py-4 sm:border-l sm:border-t-0 sm:pl-5">
          <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-muted-foreground" /> Lifetime earnings</div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">
            {walletQuery.isLoading ? "—" : wallet ? `MK ${formatMwk(wallet.lifetime_mwk)}` : "MK 0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Recorded lifetime earnings, not projected revenue.</p>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Recent transactions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your latest recorded wallet activity.</p>
          </div>
          <span className="text-xs text-muted-foreground">{transactions.length} shown · newest first</span>
        </div>
        <div className="mt-3 border-y border-border">
          {walletQuery.isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading your transactions…</p>
          ) : transactions.length ? (
            transactions.map((transaction) => (
              <article key={transaction.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-4 last:border-b-0">
                <div className="flex min-w-0 items-start gap-3">
                  <ArrowLeftRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{transaction.description || transaction.kind.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      {transaction.method ? ` · ${transaction.method.replaceAll("_", " ")}` : ""}
                    </p>
                    {transaction.reference && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">Ref: {transaction.reference}</p>}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="whitespace-nowrap text-sm font-semibold tabular-nums">MK {formatMwk(transaction.amount_mwk)}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">{transaction.status}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="py-7">
              <p className="text-sm font-medium">No transactions recorded yet</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                This is an honest empty state. Marketplace sales and Social creator earnings will appear here after checkout, payment verification, and settlement are connected.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="font-display text-lg font-bold">Payments and withdrawals</h2>
        <div className="mt-2 divide-y divide-border">
          <article className="flex gap-3 py-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Developer Pro payments</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">PayChangu is connected to the Developer Pro subscription flow. Subscription payments are not developer earnings and are not added to this wallet.</p>
              <Link to="/console/subscription" className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:underline">View Developer Pro <ArrowDownToLine className="ml-2 h-4 w-4" /></Link>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Payout protection</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Withdrawals require verified identity, approved payout details, available settled funds, fraud checks and a trusted payout integration.</p>
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><CircleAlert className="h-4 w-4" /> Withdrawals are not enabled</p>
            </div>
          </article>
          <article className="flex gap-3 py-4">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Verified developer sales</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Paid listings must belong to approved, active developers. Sales stay unavailable until trusted checkout and settlement are ready.</p>
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
