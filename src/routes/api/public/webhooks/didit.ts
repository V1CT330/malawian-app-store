import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPPORTED_EVENTS = new Set([
  "status.updated", "data.updated", "user.status.updated", "user.data.updated",
  "business.status.updated", "business.data.updated", "activity.created",
  "transaction.created", "transaction.status.updated", "travel_rule.status.updated",
]);

/** Didit V2 canonical JSON: compact, recursively sorted keys, Unicode preserved. */
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) =>
      Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")),
    );
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function signature(secret: string, data: string | Uint8Array): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeHexEqual(received: string | null, expected: string): boolean {
  if (!received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const actualBytes = Buffer.from(received, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function objectPayload(value: Json): value is { [key: string]: Json } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableEventKey(body: Record<string, Json>): string | null {
  if (typeof body.event_id === "string" && body.event_id.length > 0) return body.event_id;
  // The timestamp is intentionally excluded because Didit refreshes it on retries.
  const resource = body.session_id ?? body.business_session_id ?? body.vendor_user_id ??
    body.vendor_business_id ?? body.transaction_id ?? body.txn_id;
  if (typeof resource !== "string" || !resource) return null;
  return [resource, body.status ?? "", body.webhook_type ?? ""].join(":");
}

export const Route = createFileRoute("/api/public/webhooks/didit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DIDIT_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("Didit webhook is not configured: DIDIT_WEBHOOK_SECRET is missing.");
          return new Response("Webhook not configured", { status: 503 });
        }

        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (declaredLength > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

        let rawBytes: Uint8Array;
        let raw: string;
        try {
          rawBytes = new Uint8Array(await request.arrayBuffer());
          if (rawBytes.byteLength > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
          raw = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
        } catch {
          return new Response("Invalid UTF-8 payload", { status: 400 });
        }

        // Parsing is only used to calculate V2 canonical JSON; no event is trusted
        // or processed until a signature has passed verification.
        let parsed: Json;
        try {
          parsed = JSON.parse(raw) as Json;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!objectPayload(parsed)) return new Response("Expected a JSON object", { status: 400 });
        const body = parsed;

        const v2 = request.headers.get("x-signature-v2");
        const v1 = request.headers.get("x-signature");
        const validV2 = safeHexEqual(v2, signature(secret, canonical(body)));
        const validV1 = !validV2 && safeHexEqual(v1, signature(secret, rawBytes));

        // X-Signature-Simple is deliberately not accepted: it does not authenticate
        // decision/vendor_data fields, which must never authorize KYC changes.
        if (!validV2 && !validV1) {
          // Decisions can contain sensitive identity data; log a digest rather than
          // duplicating raw ID/decision content into long-retention deployment logs.
          console.error("Didit signature mismatch", {
            body_sha256: createHash("sha256").update(rawBytes).digest("hex"),
            body_bytes: rawBytes.byteLength,
            has_v2_signature: Boolean(v2),
            has_v1_signature: Boolean(v1),
          });
          return new Response("Invalid signature", { status: 401 });
        }

        // Freshness is based on the SIGNED payload timestamp, never X-Timestamp.
        const timestamp = body.timestamp;
        if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) ||
            timestamp <= 0 || Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
          return new Response("Stale or invalid signed timestamp", { status: 401 });
        }

        const type = typeof body.webhook_type === "string" ? body.webhook_type : "";
        if (!SUPPORTED_EVENTS.has(type)) return new Response("Unsupported webhook type", { status: 400 });

        const eventKey = stableEventKey(body);
        if (!eventKey) return new Response("Missing event identifier", { status: 400 });

        const status = typeof body.status === "string" ? body.status : null;
        const sessionId = typeof body.session_id === "string" ? body.session_id :
          typeof body.business_session_id === "string" ? body.business_session_id : null;
        const vendor = typeof body.vendor_data === "string" && UUID.test(body.vendor_data) ?
          body.vendor_data : null;
        const isBusinessSession = body.session_kind === "business";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // A single SQL transaction inserts/deduplicates the event and applies KYC
          // changes; errors roll back both so Didit's retry can safely try again.
          const rpc = supabaseAdmin.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: boolean | null; error: { code?: string; message: string } | null }>;
          const { data: inserted, error } = await rpc("process_didit_webhook", {
            _event_key: eventKey,
            _webhook_type: type,
            _session_id: sessionId,
            _status: status,
            _user_id: vendor,
            _is_business_session: isBusinessSession,
            _payload: body,
          });

          if (error) {
            console.error("Didit webhook persistence failed", {
              event_key: eventKey, code: error.code, message: error.message,
            });
            return new Response("Webhook processing failed", { status: 500 });
          }
          return new Response(inserted ? "accepted" : "duplicate", { status: 200 });
        } catch (error) {
          console.error("Didit webhook handler failed", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
