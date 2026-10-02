import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYCHANGU_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const body = await request.text();
        const sig = Buffer.from(request.headers.get("signature") ?? "");
        const exp = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }
        let txRef: unknown;
        try {
          const p = JSON.parse(body) as { tx_ref?: unknown; data?: { tx_ref?: unknown } };
          txRef = p.tx_ref ?? p.data?.tx_ref;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        if (typeof txRef !== "string" || !/^mas_[a-f0-9]{32}$/.test(txRef)) {
          return new Response("ok");
        }
        const { settlePayment } = await import("@/lib/payments.server");
        await settlePayment(txRef);
        return new Response("ok");
      },
    },
  },
});
