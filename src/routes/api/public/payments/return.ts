import { createFileRoute } from "@tanstack/react-router";

// Customer lands here after paying; we re-verify with PayChangu before activating.
export const Route = createFileRoute("/api/public/payments/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const txRef = url.searchParams.get("tx_ref") ?? "";
        let result = "failed";
        if (/^mas_[a-f0-9]{32}$/.test(txRef)) {
          const { settlePayment } = await import("@/lib/payments.server");
          const r = await settlePayment(txRef).catch(() => ({ ok: false }));
          result = r.ok ? "success" : "pending";
          const destination = typeof r.purpose === "string" && r.purpose.startsWith("ad_campaign:")
            ? "/console/advertise" : "/console/subscription";
          return Response.redirect(`${url.origin}${destination}?payment=${result}`, 302);
        }
        return Response.redirect(`${url.origin}/console/subscription?payment=${result}`, 302);
      },
    },
  },
});
