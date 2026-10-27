import { createFileRoute } from "@tanstack/react-router";

// Customer lands here after paying; we re-verify with PayChangu before activating.
export const Route = createFileRoute("/api/public/payments/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const txRef = url.searchParams.get("tx_ref") ?? "";
        let result = "failed";
        let destination = "/console/subscription";
        if (/^mas_[a-f0-9]{32}$/.test(txRef)) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: session } = await supabaseAdmin.from("payment_sessions").select("purpose").eq("tx_ref", txRef).maybeSingle();
          if (session?.purpose?.startsWith("ad_campaign:")) destination = "/console/advertise";
          const { settlePayment } = await import("@/lib/payments.server");
          const r = await settlePayment(txRef).catch(() => ({ ok: false }));
          result = r.ok ? "success" : "pending";
        }
        return Response.redirect(`${url.origin}${destination}?payment=${result}`, 302);
      },
    },
  },
});
