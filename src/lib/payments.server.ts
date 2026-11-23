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
  productName?: string;
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
        title: input.productName ?? "Malawian App Store",
        description: input.description ?? "Malawian App Store payment",
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

/** Verifies a PayChangu transaction, then atomically applies its entitlement. */
export async function settlePayment(txRef: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session, error: readError } = await supabaseAdmin
    .from("payment_sessions")
    .select("id,status,amount_mwk,currency")
    .eq("tx_ref", txRef)
    .maybeSingle();

  if (readError) throw new Error("Could not read the payment session.");
  if (!session) return { ok: false, reason: "unknown" as const };
  if (session.status === "paid") return { ok: true, reason: "already" as const };
  if (session.status !== "pending") return { ok: false, reason: "not_pending" as const };

  const verified = await verifyPaychanguPayment(txRef);
  if (!verified.paid || verified.currency !== "MWK" || verified.amount < session.amount_mwk) {
    return { ok: false, reason: "unpaid" as const };
  }

  const { data: settlement, error: settlementError } = await (supabaseAdmin as any).rpc(
    "settle_mas_payment_session",
    { _tx_ref: txRef, _provider_reference: verified.reference },
  );

  if (settlementError) {
    console.error("[PayChangu] Verified payment could not be settled", {
      txRef,
      message: settlementError.message,
    });
    throw new Error("Payment was verified but the MAS entitlement could not be updated. It will be retried.");
  }

  if (settlement === "paid" || settlement === "already") {
    return { ok: true, reason: settlement as "paid" | "already" };
  }
  return { ok: false, reason: settlement === "unknown" ? "unknown" as const : "not_pending" as const };
}
