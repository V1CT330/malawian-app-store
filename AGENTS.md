<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Payments go through PayChangu via a server function (checkout) and /api/public/payments/\* routes that re-verify each transaction with the provider before activating; only server code writes payment_sessions/subscriptions. Why: browser can never mark a payment paid.
- Identity verification events arrive at /api/public/webhooks/didit, are signature- and timestamp-checked, logged once per event in identity_verification_events, then mapped to profiles.kyc_status via vendor_data (user id). Why: idempotent, server-only KYC updates.
