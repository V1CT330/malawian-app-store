# Roadmap

## GitHub and deployment readiness
- [x] Remove the tracked `.env` file from the repository; keep local secrets in ignored environment files.
- [x] Add a GitHub Actions build check for pull requests and pushes to `main`.
- [x] Stop logging raw Didit webhook payloads when signature validation fails.

## Production configuration — requires account access
- [ ] Configure `PAYCHANGU_SECRET_KEY` and `PAYCHANGU_WEBHOOK_SECRET` in Vercel Production environment variables.
- [ ] Configure `DIDIT_WEBHOOK_SECRET` in Vercel Production environment variables.
- [ ] Confirm `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set for server runtime, and `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set for the client build.
- [ ] Verify PayChangu webhook signature validation and successful transaction settlement against provider test/live events.
- [ ] Verify Didit webhook signature validation, idempotency, and KYC status updates with a real provider event.
- [ ] Run production smoke tests for homepage listings, registration, sign-in/session persistence, developer publishing, and payment/verification flows.
- [ ] Diagnose and fix the main Vercel project production domain/runtime issue after inspecting logs and project settings.

## Implemented backend routes
- [x] PayChangu checkout, payment webhook, and return/verification routes under `/api/public/payments/*`.
- [x] Didit identity-verification webhook at `/api/public/webhooks/didit`.
- [x] PayChangu test webhook at `/api/public/paychangu/webhook/test`.
