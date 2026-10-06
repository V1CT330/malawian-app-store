import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import {
  CORE_MESSAGE,
  CORE_SUPPORT,
  PRO_BENEFITS,
  PRO_CHECKLIST,
  PRO_NAME,
  PRO_PRICE_MWK,
  PRO_TAGLINE,
  WHY_PRO,
  WHY_PRO_CLOSING,
} from "@/lib/pro";
import { formatMwk } from "@/lib/store";
import { startProCheckout } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/console/subscription")({
  head: () => ({
    meta: [
      { title: "Developer Pro · Malawian App Store" },
      {
        name: "description",
        content:
          "Developer Pro at MK5,000 monthly: publish, promote, get featured, analytics, Kwacha payments and a Verified Developer badge.",
      },
      { property: "og:title", content: "Developer Pro · Malawian App Store" },
      {
        property: "og:description",
        content: "The professional toolkit for developers building Malawi's digital future.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProPage,
});

function ProPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const queryClient = useQueryClient();

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const active = subscription.data?.status === "active";

  const startCheckout = useServerFn(startProCheckout);
  const activate = useMutation({
    mutationFn: () => startCheckout(),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan cancelled. Access continues until the period ends.");
      queryClient.invalidateQueries({ queryKey: ["subscription", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsoleShell title="Subscription">
      <h1 className="font-display text-2xl font-bold">{PRO_NAME}</h1>
      <p className="text-sm text-muted-foreground">{PRO_TAGLINE}</p>

      <section className="surface-card p-5 text-center">
        <p className="font-display text-3xl font-bold">{formatMwk(PRO_PRICE_MWK)}</p>
        <p className="text-sm text-muted-foreground">per month</p>
        {active ? (
          <>
            <Badge className="mt-3">Active</Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              Renews{" "}
              {subscription.data?.current_period_end
                ? new Date(subscription.data.current_period_end).toLocaleDateString()
                : "monthly"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel plan
            </Button>
          </>
        ) : (
          <Button
            className="mt-4 w-full"
            disabled={activate.isPending}
            onClick={() => activate.mutate()}
          >
            Activate {PRO_NAME}
          </Button>
        )}
        <ul className="mt-4 space-y-2 text-left">
          {PRO_CHECKLIST.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">What you get</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {PRO_BENEFITS.map((b) => (
            <li key={b.title} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Why Developer Pro</h2>
        <ul className="mt-3 space-y-3">
          {WHY_PRO.map((w) => (
            <li key={w.title}>
              <p className="text-sm font-semibold">{w.title}</p>
              <p className="text-sm text-muted-foreground">{w.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">{WHY_PRO_CLOSING}</p>
      </section>

      <section className="surface-card mt-4 p-4 text-center">
        <p className="font-display text-base font-semibold">{CORE_MESSAGE}</p>
        <p className="text-sm text-muted-foreground">{CORE_SUPPORT}</p>
      </section>
    </ConsoleShell>
  );
}
