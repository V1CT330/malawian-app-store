# Developer Mode — Audit and Console Redesign

Findings below come from reading the developer routes, shared components, the portal helpers, and the live database policies. Nothing was changed.

## What exists today

Fourteen developer pages: Dashboard, Growth (analytics + products), Upload, Manage product, Advertise, Spotlight, Profile, Verification, Developer Pro, Team, Security, Resources, AI Assistant, plus Admin. Navigation is a four-item bottom bar (Home, Upload, Stats, AI) plus a ten-item scrolling pill strip (PortalTabs).

## Audit

### 1. Visual hierarchy and navigation
- Two competing navigation systems. The bottom bar shows 4 destinations, the pill strip shows 10, and they overlap only partly. Ten equal-weight pills give no sense of what matters.
- PortalTabs is missing on Growth, Upload, Manage product and AI Assistant, so those pages are dead ends — you land there and lose the portal nav.
- Manage product is reachable only from the Growth page product list; there is no product-centric entry point anywhere in navigation.
- The developer surface reuses the shopper AppShell, including the shopper search field in the header, which does nothing useful for a developer.
- Developer pages carry no visual distinction from the store, so mode switching is invisible.

### 2. Dashboard UX
- The dashboard shows counts, a reputation bar, an account-status list and two buttons. It repeats reputation/status data also shown on Pro, Profile and Verification.
- No actionable queue: nothing surfaces "listing rejected", "review awaiting reply", "version pending", "KYC needs documents".
- The founding-program banner occupies the most valuable space above real data.
- Reputation is presented as a score with no explanation of how to raise it.

### 3. Publishing and review workflow
- **The review workflow does not exist.** Upload inserts listings with `status: "published"` directly, while the page copy says "reviewed by the store team after publishing". The Admin queue filters for `pending`/`draft`, so it is permanently empty and nothing is ever moderated.
- Upload is a single long form with no draft saving, no screenshots, no keywords/tags, and no validation against the ASO checks that the Manage page later scores you against.
- There is no submit-for-review action anywhere, and no rejection-to-resubmission loop in the developer UI.

### 4. Product management, versions, beta, engagement, ASO/AI
- Manage product is a single 780-line, six-tab page — the heaviest surface in the app and the least discoverable.
- Versions: rollback flips `is_current` but nothing schedules a `scheduled` release into `released`, so scheduled versions never go live.
- Beta: testers are stored but never notified or granted access to beta builds; the channel field is decorative.
- Engagement: developer review replies exist, but there is no cross-product review inbox — you must open each product.
- ASO/AI: the score is computed client-side only and never written back to `seo_score`/`quality_score`, which are read elsewhere.

### 5. Analytics
- Growth mixes charts with product administration (status changes, archive) — two different jobs on one page.
- All events are pulled client-side and aggregated in the browser; this will not scale, and there is no date-range control.
- Metrics exclude the things a developer most wants: conversion (views to installs), retention proxies, and per-version adoption.
- Advertise and Spotlight report impressions/clicks that nothing in the store actually records.

### 6. KYC and verification
- `profiles` allows a user to update their own row with no column restriction, and `kyc_status` lives on that row — so a developer can set their own status to `approved` and display a Verified badge without review.
- WhatsApp verification is UI-level only; the code path is not server-verified.
- Verified status confers nothing: no ranking, no badge in store listings surfaced consistently, no gating.

### 7. Subscription (MK5,000/month)
- **The subscription is unenforced and self-granted.** The Pro page upserts `status: 'active'` straight from the browser, and the `subscriptions` policy allows a user full write access to their own row. Any developer can activate Pro for free from the console or the API.
- Nothing in the app checks subscription state before allowing an action. Every "Pro benefit" listed (unlimited uploads, priority review, advanced analytics, AI assistant, featured profile, beta tools, team collaboration) is fully available to unsubscribed developers.
- There is no billing period display, renewal reminder, lapse handling, or grace period.

### 8. Notifications
- Notifications are insert-only by admins. Developers get nothing for new reviews, install milestones, version state changes, subscription renewal, or team invitations.
- There is no notification when a listing is rejected outside the admin action, and no in-console notification centre for developers — only the shopper alerts page, which is not in the developer bottom nav.

### 9. Permissions and security
- Listing owners can update every column, including `status` and `featured` — a developer can self-publish and self-feature into store placement.
- Team members are stored with roles (admin/editor/viewer) but listing policies only ever check `developer_id`. Invited team members cannot read or edit anything, so the whole Team feature is non-functional.
- `profiles` is publicly readable in full, which exposes phone numbers and KYC status to anonymous visitors.
- The Security page offers 2FA toggles that are stored as preferences and not enforced.

### 10. Missing features that would justify paying
Priority review, verified placement, featured slots, a review inbox with response SLAs, competitor/category benchmarking, crash and error reporting, release scheduling that works, working team seats, custom developer profile page, and export of analytics — currently none of these are gated or, in several cases, functional.

## Proposed Developer Console

### Information architecture
Collapse 14 destinations into 5 top-level sections with sub-tabs:

```text
Console (/console)
  Overview      action queue, live metrics, reputation, subscription state
Products (/console/products)
  list -> product detail: Listing | Media | Releases | Beta | Reviews | ASO
Insights (/console/insights)
  Performance | Audience | Store presence (ASO history)
Growth (/console/growth)
  Promote (Advertise + Spotlight merged) | Reputation
Account (/console/account)
  Profile | Verification | Team | Subscription | Security | Resources
```

Navigation: a persistent developer sidebar on desktop and a 5-item bottom bar on mobile (Overview, Products, Insights, Growth, Account), replacing both the shopper bar and PortalTabs. AI Assistant becomes a docked panel available on every console page rather than a route.

### Visual direction
A dedicated console shell distinct from the store: no shopper search, a developer identity block with studio name, verification badge and subscription chip; brand red/green reserved for status semantics (red = rejected/action needed, green = live/verified); dense card grid with a consistent metric-tile component; a single status pill vocabulary used everywhere (Draft, In review, Live, Rejected, Archived).

### Corrected publishing lifecycle
```text
Draft -> Submit for review -> In review -> Live
                                  \-> Rejected -> edit -> resubmit
Live -> Update submitted -> In review -> Live (new version)
```
Upload becomes a guided multi-step wizard that saves a draft at each step and requires the ASO essentials before the submit button unlocks.

## Technical notes

- Status transitions move to a server function plus a database check so `status` and `featured` can no longer be set by the owner client-side; add a column-level restriction and drop self-publish.
- Add a trigger or restricted policy so `kyc_status`, `is_developer` and verification fields on `profiles` are writable only by admin/service paths; narrow the public profile read to safe columns via a view.
- Subscription state becomes read-only to the user; activation happens through a server function that records a payment reference, with expiry handled by `current_period_end` and a scheduled check. Add an `is_pro(user)` database function used by both RLS and the UI for gating.
- Team access requires listing policies to consult `is_team_member(owner, auth.uid())` with role checks, mirrored on versions, media and analytics reads.
- Analytics aggregation moves into SQL views/RPCs with a date-range parameter instead of client-side tallies.
- Notification writes for lifecycle events (review decision, new review, milestone, renewal) move into database triggers so they fire regardless of who acts.

## Roadmap

### P0 — correctness and trust
1. Enforce the review workflow: upload creates a draft, add submit-for-review, admin queue becomes live.
2. Lock down `status`/`featured` writes and self-approved `kyc_status`.
3. Make the subscription server-controlled and gate at least three concrete benefits behind it.
4. Fix navigation dead ends and land the 5-section console shell with consistent status vocabulary.
5. Restrict public profile reads so phone numbers are not exposed.

### P1 — the console people would pay for
6. Overview action queue and lifecycle notifications via triggers.
7. Products section with a real list view and a slimmed product detail split into tabs.
8. Cross-product review inbox with reply and response-time tracking.
9. Insights rebuilt on SQL aggregates with date ranges and view-to-install conversion.
10. Working team seats (RLS + invitation flow) and release scheduling that actually promotes scheduled versions.

### P2 — depth and polish
11. ASO score history persisted, with AI suggestions applied inline.
12. Promote section: merged Advertise/Spotlight with impressions actually recorded by the store surfaces.
13. Verified-developer ranking benefit and richer public developer profile.
14. Analytics export, crash/error reporting intake, category benchmarking.

## Assumptions
- Subscription payment collection stays out of scope; activation is recorded manually or by an admin against a payment reference, with the app enforcing state only.
- Admin moderation stays inside this app rather than an external tool.
