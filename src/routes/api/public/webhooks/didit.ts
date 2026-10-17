import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Sorted-key, compact, Unicode-preserving JSON (Didit X-Signature-V2 canonical form). */
function canonical(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k] as Json)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function hmac(secret: string, msg: string) {
  return createHmac("sha256", secret).update(msg, "utf8").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const KYC_MAP: Record<string, "approved" | "rejected" | "pending" | "none"> = {
  Approved: "approved",
  Declined: "rejected",
  "In Review": "pending",
  "In Progress": "pending",
  Resubmitted: "pending",
  Expired: "none",
  "KYC Expired": "none",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/webhooks/didit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DIDIT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const ts = Number(request.headers.get("x-timestamp"));
        if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
          return new Response("Stale timestamp", { status: 401 });
        }

        let body: Record<string, Json>;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const v2 = request.headers.get("x-signature-v2");
        const v1 = request.headers.get("x-signature");
        const simple = request.headers.get("x-signature-simple");
        const valid =
          (v2 && safeEqual(v2, hmac(secret, canonical(body)))) ||
          (v1 && safeEqual(v1, hmac(secret, raw))) ||
          (simple &&
            safeEqual(
              simple,
              hmac(
                secret,
                `${request.headers.get("x-timestamp")}:${body.session_id ?? ""}:${body.status ?? ""}:${body.webhook_type ?? ""}`,
              ),
            ));
        if (!valid) {
          console.error("Didit signature mismatch");
          return new Response("Invalid signature", { status: 401 });
        }

        const type = String(body.webhook_type ?? "unknown");
        const status = typeof body.status === "string" ? body.status : null;
        const sessionId = typeof body.session_id === "string" ? body.session_id : null;
        const vendor =
          typeof body.vendor_data === "string" && UUID.test(body.vendor_data)
            ? body.vendor_data
            : null;
        const eventKey =
          typeof body.event_id === "string"
            ? body.event_id
            : `${sessionId}:${status}:${type}:${body.timestamp ?? ts}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: dup } = await supabaseAdmin.from("identity_verification_events").insert({
          event_key: eventKey,
          webhook_type: type,
          session_id: sessionId,
          status,
          user_id: vendor,
          payload: body,
        });
        if (dup) {
          // Unique violation = already processed; anything else should be retried.
          return dup.code === "23505" ? new Response("ok") : new Response("Retry", { status: 500 });
        }

        // Only session status changes affect a developer's verification badge.
        if (
          type === "status.updated" &&
          vendor &&
          status &&
          KYC_MAP[status] &&
          body.session_kind !== "business"
        ) {
          const kyc = KYC_MAP[status];
          await supabaseAdmin.from("profiles").update({ kyc_status: kyc }).eq("id", vendor);
          await supabaseAdmin.from("notifications").insert({
            user_id: vendor,
            title: "Identity verification update",
            body: `Your identity verification status is now: ${status}.`,
          });
        }
        return new Response("ok");
      },
    },
  },
});
