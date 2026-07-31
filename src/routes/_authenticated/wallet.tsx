import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, Plus, Trash2, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { requestPayout } from "@/lib/payments.functions";
import { PAYOUT_METHODS } from "@/lib/payments";
import { formatAmount } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Developer wallet — Malawian App Store" },
      {
        name: "description",
        content:
          "Track app earnings, view your transaction ledger and withdraw to Airtel Money, TNM Mpamba, your bank or a crypto wallet.",
      },
      { property: "og:title", content: "Developer wallet — Malawian App Store" },
      { property: "og:description", content: "Earnings, transactions and withdrawals for Malawian developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [methodKind, setMethodKind] = useState<string>("airtel_money");
  const [destination, setDestination] = useState("");

  const wallet = useQuery({
    queryKey: ["wallet", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: createError } = await supabase
        .from("wallets")
        .insert({ user_id: userId! })
        .select("*")
        .single();
      if (createError) throw createError;
      return created;
    },
  });

  const transactions = useQuery({
    queryKey: ["wallet-tx", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const payouts = useQuery({
    queryKey: ["payouts", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const methods = useQuery({
    queryKey: ["payout-methods", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMethod = useMutation({
    mutationFn: async () => {
      if (destination.trim().length < 4) throw new Error("Enter the number, account or wallet address.");
      const { error } = await supabase.from("payout_methods").insert({
        user_id: userId!,
        kind: methodKind,
        destination: destination.trim(),
        label: PAYOUT_METHODS.find((m) => m.key === methodKind)?.label ?? methodKind,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout method saved");
      setDestination("");
      queryClient.invalidateQueries({ queryKey: ["payout-methods", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payout_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payout-methods", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      const dest = methods.data?.find((m) => m.kind === methodKind)?.destination ?? destination.trim();
      if (!Number.isFinite(value) || value < 1000) throw new Error("Minimum withdrawal is MK1,000.");
      if (dest.length < 4) throw new Error("Add a payout destination first.");
      await requestPayout({ data: { amountMwk: Math.round(value), method: methodKind, destination: dest } });
    },
    onSuccess: () => {
      toast.success("Withdrawal requested");
      setAmount("");
      wallet.refetch();
      transactions.refetch();
      payouts.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = Number(wallet.data?.balance_mwk ?? 0);
  const pending = Number(wallet.data?.pending_mwk ?? 0);
  const lifetime = Number(wallet.data?.lifetime_mwk ?? 0);

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <WalletIcon className="h-6 w-6 text-primary" /> Wallet
      </h1>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="surface-card p-3">
          <p className="font-display text-lg font-bold">{formatAmount(balance)}</p>
          <p className="text-xs text-muted-foreground">available</p>
        </div>
        <div className="surface-card p-3">
          <p className="font-display text-lg font-bold">{formatAmount(pending)}</p>
          <p className="text-xs text-muted-foreground">pending payout</p>
        </div>
        <div className="surface-card p-3">
          <p className="font-display text-lg font-bold">{formatAmount(lifetime)}</p>
          <p className="text-xs text-muted-foreground">lifetime</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        See revenue trends, refunds and tax reports in your{" "}
        <Link to="/business" className="text-primary underline">
          business dashboard
        </Link>
        .
      </p>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Payout methods</h2>
        <div className="flex flex-wrap gap-2">
          {PAYOUT_METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethodKind(m.key)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium",
                methodKind === m.key ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={destination}
            placeholder={PAYOUT_METHODS.find((m) => m.key === methodKind)?.hint}
            onChange={(e) => setDestination(e.target.value)}
          />
          <Button size="sm" disabled={addMethod.isPending} onClick={() => addMethod.mutate()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-2">
          {methods.data?.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{m.label}</span> · {m.destination}
              </span>
              <button aria-label="Remove payout method" onClick={() => removeMethod.mutate(m.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Withdraw funds</h2>
        <div>
          <Label htmlFor="amount">Amount (MWK)</Label>
          <Input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
          <ArrowDownToLine className="mr-2 h-4 w-4" /> Request withdrawal
        </Button>
        <ul className="space-y-2">
          {payouts.data?.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span>
                {formatAmount(Number(p.amount_mwk))} → {p.destination}
              </span>
              <Badge variant="secondary" className="capitalize">
                {p.status}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-2 font-display text-base font-semibold">Transactions</h2>
        {transactions.data?.length ? (
          <ul className="divide-y divide-border">
            {transactions.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium capitalize">{t.kind}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.description ?? t.reference ?? ""} · {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </span>
                <span className={cn("shrink-0 font-medium", Number(t.amount_mwk) < 0 ? "text-destructive" : "text-google-green")}>
                  {Number(t.amount_mwk) < 0 ? "-" : "+"}
                  {formatAmount(Math.abs(Number(t.amount_mwk)))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No transactions yet — earnings from sales appear here.</p>
        )}
      </section>
    </AppShell>
  );
}
