import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// PayChangu test webhook receiver: validates and logs a safe summary only. No payment processing.
export const Route = createFileRoute("/api/public/paychangu/webhook/test")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, endpoint: "paychangu-test-webhook", method: "POST" }),
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!raw || raw.length > 100_000) return new Response("Invalid body", { status: 400 });

        const secret = process.env["PAYCHANGU_WEBHOOK_SECRET"];
        const signature = request.headers.get("signature");
        let signatureValid: boolean | null = null;
        if (secret && signature) {
          const a = Buffer.from(signature);
          const b = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
          signatureValid = a.length === b.length && timingSafeEqual(a, b);
          if (!signatureValid) return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
          payload = parsed as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const data = (payload.data ?? {}) as Record<string, unknown>;
        console.log("PayChangu test webhook", {
          event: payload.event_type ?? payload.type ?? null,
          status: payload.status ?? data.status ?? null,
          tx_ref: payload.tx_ref ?? data.tx_ref ?? null,
          currency: payload.currency ?? data.currency ?? null,
          signature: signatureValid === null ? "not checked" : "valid",
        });
        return Response.json({ received: true });
      },
    },
  },
});
