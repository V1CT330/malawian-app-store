/** Monetization, local payment rails and commission helpers. */

export const MONETIZATION_MODELS = [
  { key: "free", label: "Free" },
  { key: "paid", label: "Paid" },
  { key: "freemium", label: "Freemium" },
  { key: "iap", label: "In-app purchases" },
  { key: "subscription", label: "Subscription" },
  { key: "donations", label: "Donations & tips" },
  { key: "ads", label: "Ad supported" },
  { key: "affiliate", label: "Affiliate" },
] as const;

export type MonetizationModel = (typeof MONETIZATION_MODELS)[number]["key"];

export const PAYMENT_METHODS = [
  { key: "airtel_money", label: "Airtel Money", group: "Mobile money" },
  { key: "tnm_mpamba", label: "TNM Mpamba", group: "Mobile money" },
  { key: "card", label: "Visa / Mastercard", group: "Cards" },
  { key: "bank", label: "Local bank transfer", group: "Banks" },
  { key: "international", label: "International gateway", group: "Cards" },
  { key: "btc", label: "Bitcoin (BTC)", group: "Crypto" },
  { key: "eth", label: "Ethereum (ETH)", group: "Crypto" },
  { key: "usdt", label: "USDT", group: "Crypto" },
  { key: "usdc", label: "USDC", group: "Crypto" },
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]["key"];

export const PAYOUT_METHODS = [
  { key: "airtel_money", label: "Airtel Money", hint: "+265 9xx xxx xxx" },
  { key: "tnm_mpamba", label: "TNM Mpamba", hint: "+265 8xx xxx xxx" },
  { key: "bank", label: "Bank transfer", hint: "Bank · account number" },
  { key: "crypto", label: "Crypto wallet", hint: "BTC / ETH / USDT address" },
] as const;

export const PURCHASE_KINDS = [
  { key: "one_time", label: "One-time purchase" },
  { key: "subscription_month", label: "Monthly subscription" },
  { key: "subscription_year", label: "Yearly subscription" },
  { key: "iap", label: "In-app purchase" },
  { key: "donation", label: "Donation / tip" },
] as const;

export type PurchaseKind = (typeof PURCHASE_KINDS)[number]["key"];

export const DEFAULT_COMMISSION = { standard: 15, premium: 10, referral: 5 };

export function commissionFor(amount: number, percent: number) {
  const commission = Math.round((amount * percent) / 100);
  return { commission, net: amount - commission };
}

export function methodLabel(key: string) {
  return PAYMENT_METHODS.find((m) => m.key === key)?.label ?? key;
}

export function isCrypto(key: string) {
  return ["btc", "eth", "usdt", "usdc"].includes(key);
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
