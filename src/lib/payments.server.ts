// Server-only PayChangu helpers. Never import from client code.
const API = "https://api.paychangu.com";

function secretKey() {
  const key = process.env["PAYCHANGU_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured yet.");
  return key;
}

export async function createPaychanguCheckout(input: {
  txRef: string;
  amount: number;
  email: string;
  name: string;
  callbackUrl: string;
  returnUrl: string;
}) {
  const res = await fetch(`${API}/payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: "MWK",
      email: input.email,
      first_name: input.name,
      tx_ref: input.txRef,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      customization: { title: "Developer Pro", description: "Malawian App Store monthly subscription" },
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { checkout_url?: string } } | null;
  const url = json?.data?.checkout_url;
  if (!res.ok || !url) throw new Error(`Payment provider error (${res.status})`);
  return url;
}

/** Confirms a transaction directly with PayChangu; never trust webhook bodies alone. */
export async function verifyPaychanguPayment(txRef: string) {
  const res = await fetch(`${API}/verify-payment/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey()}`, Accept: "application/json" },
  });
  const json = (await res.json().catch(() => null)) as {
    data?: { status?: string; amount?: number | string; currency?: string; reference?: string };
  } | null;
  const d = json?.data;
  return {
    paid: res.ok && d?.status === "success",
    amount: Number(d?.amount ?? 0),
    currency: d?.currency ?? "",
    reference: d?.reference ?? null,
  };
}

/** Marks the session paid and extends Developer Pro by 30 days. Idempotent. */
export async function settlePayment(txRef: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session } = await supabaseAdmin
    .from("payment_sessions")
    .select("*")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!session) return { ok: false, reason: "unknown" as const };
  if (session.status === "paid") return { ok: true, reason: "already" as const };

  const v = await verifyPaychanguPayment(txRef);
  if (!v.paid || v.currency !== "MWK" || v.amount < session.amount_mwk) {
    return { ok: false, reason: "unpaid" as const };
  }

  const { data: claimed } = await supabaseAdmin
    .from("payment_sessions")
    .update({ status: "paid", paid_at: new Date().toISOString(), provider_reference: v.reference })
    .eq("id", session.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { ok: true, reason: "already" as const };

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id,current_period_end")
    .eq("user_id", session.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = Date.now();
  const base = existing?.current_period_end ? Math.max(now, Date.parse(existing.current_period_end)) : now;
  const fields = {
    status: "active",
    plan: "pro",
    amount_mwk: session.amount_mwk,
    payment_reference: txRef,
    current_period_end: new Date(base + 30 * 864e5).toISOString(),
  };
  if (existing) await supabaseAdmin.from("subscriptions").update(fields).eq("id", existing.id);
  else await supabaseAdmin.from("subscriptions").insert({ ...fields, user_id: session.user_id });
  return { ok: true, reason: "paid" as const };
}
