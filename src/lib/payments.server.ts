// Server-only PayChangu helpers. Never import from client code.
const API = "https://api.paychangu.com";

function secretKey() {
  const key = process.env["PAYCHANGU_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured: PAYCHANGU_SECRET_KEY is missing.");
  return key;
}

export async function createPaychanguCheckout(input: {
  txRef: string;
  amount: number;
  email: string;
  name: string;
  callbackUrl: string;
  returnUrl: string;
  title?: string;
  description?: string;
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
      ...(input.email ? { email: input.email } : {}),
      first_name: input.name,
      last_name: "Developer",
      tx_ref: input.txRef,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      customization: {
        title: input.title ?? "Developer Pro",
        description: input.description ?? "Malawian App Store monthly subscription",
      },
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    status?: string;
    message?: string;
    data?: { checkout_url?: string };
  } | null;
  const url = json?.data?.checkout_url;

  if (!res.ok || json?.status !== "success" || !url) {
    // Log provider response for diagnosis, never log authorization headers or secrets.
    console.error("[PayChangu] Checkout creation failed", {
      httpStatus: res.status,
      providerStatus: json?.status ?? null,
      providerMessage: json?.message ?? null,
      txRef: input.txRef,
    });
    const detail = json?.message?.slice(0, 180);
    throw new Error(
      detail
        ? `PayChangu rejected checkout (HTTP ${res.status}): ${detail}`
        : `PayChangu rejected checkout (HTTP ${res.status}). Check the server logs for the provider response.`,
    );
  }

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

/** Confirms the provider payment before activating its intended product. Idempotent. */
export async function settlePayment(txRef: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session } = await supabaseAdmin
    .from("payment_sessions")
    .select("*")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!session) return { ok: false, reason: "unknown" as const, purpose: "unknown" };
  if (session.status === "paid") return { ok: true, reason: "already" as const, purpose: session.purpose };

  const v = await verifyPaychanguPayment(txRef);
  if (!v.paid || v.currency !== "MWK" || v.amount < session.amount_mwk) {
    return { ok: false, reason: "unpaid" as const, purpose: session.purpose };
  }

  if (session.purpose.startsWith("ad_campaign:")) {
    const campaignId = session.purpose.slice("ad_campaign:".length);
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
      return { ok: false, reason: "invalid_campaign" as const, purpose: session.purpose };
    }
    const now = new Date();
    const { data: campaign } = await supabaseAdmin
      .from("promotions")
      .select("id,budget_mwk,status,payment_status,duration_days")
      .eq("id", campaignId)
      .eq("owner_id", session.user_id)
      .maybeSingle();
    if (!campaign) return { ok: false, reason: "campaign_not_found" as const, purpose: session.purpose };
    if (campaign.payment_status === "paid" && campaign.status === "active") {
      await supabaseAdmin.from("payment_sessions").update({
        status: "paid", paid_at: now.toISOString(), provider_reference: v.reference,
      }).eq("id", session.id).eq("status", "pending");
      return { ok: true, reason: "already" as const, purpose: session.purpose };
    }
    if (campaign.status !== "approved" || campaign.payment_status !== "unpaid" ||
      Number(campaign.budget_mwk) !== session.amount_mwk) {
      return { ok: false, reason: "campaign_not_approved" as const, purpose: session.purpose };
    }
    const { data: activated } = await supabaseAdmin.from("promotions").update({
      status: "active", payment_status: "paid", paid_at: now.toISOString(), starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + Math.max(1, Math.min(90, Number(campaign.duration_days) || 7)) * 864e5).toISOString(),
    }).eq("id", campaignId).eq("status", "approved").eq("payment_status", "unpaid").select("id");
    if (!activated?.length) {
      const { data: latest } = await supabaseAdmin.from("promotions").select("status,payment_status")
        .eq("id", campaignId).maybeSingle();
      if (latest?.status !== "active" || latest.payment_status !== "paid") {
        return { ok: false, reason: "campaign_activation_failed" as const, purpose: session.purpose };
      }
    }
    await supabaseAdmin.from("payment_sessions").update({
      status: "paid", paid_at: now.toISOString(), provider_reference: v.reference,
    }).eq("id", session.id).eq("status", "pending");
    return { ok: true, reason: "paid" as const, purpose: session.purpose };
  }

  const { data: claimed } = await supabaseAdmin
    .from("payment_sessions")
    .update({ status: "paid", paid_at: new Date().toISOString(), provider_reference: v.reference })
    .eq("id", session.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { ok: true, reason: "already" as const, purpose: session.purpose };

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id,current_period_end")
    .eq("user_id", session.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = Date.now();
  const base = existing?.current_period_end
    ? Math.max(now, Date.parse(existing.current_period_end))
    : now;
  const fields = {
    status: "active",
    plan: "pro",
    amount_mwk: session.amount_mwk,
    payment_reference: txRef,
    current_period_end: new Date(base + 30 * 864e5).toISOString(),
  };
  if (existing) await supabaseAdmin.from("subscriptions").update(fields).eq("id", existing.id);
  else await supabaseAdmin.from("subscriptions").insert({ ...fields, user_id: session.user_id });
  return { ok: true, reason: "paid" as const, purpose: session.purpose };
}
