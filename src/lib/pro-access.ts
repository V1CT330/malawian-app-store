export type ProSubscription = {
  plan?: string | null;
  status?: string | null;
  current_period_end?: string | null;
} | null | undefined;

/**
 * A paid Pro entitlement requires a recognised Pro plan and a finite,
 * unexpired paid period. Cancellation preserves access only until that
 * already-paid period ends.
 */
export function hasProAccess(
  subscription: ProSubscription,
  now = Date.now(),
): boolean {
  if (!subscription || subscription.plan !== "pro") return false;
  if (subscription.status !== "active" && subscription.status !== "cancelled" && subscription.status !== "trialing") return false;

  const periodEnd = subscription.current_period_end
    ? Date.parse(subscription.current_period_end)
    : Number.NaN;

  return Number.isFinite(periodEnd) && periodEnd > now;
}
