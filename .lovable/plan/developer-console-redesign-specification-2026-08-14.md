# Developer Console — Redesign Specification

Continuation of the Developer Mode audit. This is a specification only; no code changes are included. Scope constraint carried through: no wallet, no payouts, no paid-app marketplace. The MK5,000/month Developer Pro subscription is the only developer monetization.

Verified against the current code and database: 14 developer routes, two competing navigation systems (4-item bottom bar plus a 10-item pill strip), `upload.tsx` inserting listings with `status: "published"`, `subscriptions` writable by the owner, `profiles` self-updatable including `kyc_status`, listing policies keyed on `developer_id` only (team roles unusable), and all analytics tallied client-side.

---

## A. Navigation structure

Replace both existing navigation systems with one console navigation.

**Desktop (>=1024px) — persistent left sidebar, 260px**
```text
[ studio identity block ]
  avatar · studio name
  Verified badge · Pro chip

  Overview            /console
  Products            /console/products
  Insights            /console/insights
  Growth              /console/growth
  Account             /console/account

  ─────────────────
  Notifications  (count)
  Help & AI      (opens docked panel)
  Switch to store
```
Sidebar item = icon + label, 40px row, active row gets an accent-tinted rounded rect. The identity block is a link to the public developer profile.

**Tablet (768–1023px)** — sidebar collapses to a 72px icon rail with tooltips.

**Mobile (<768px)** — 5-item bottom bar: Overview, Products, Insights, Growth, Account. Sub-tabs of each section become a horizontal scroll strip directly beneath the page title. The shopper search input is removed from the developer header; the header shows page title, notification bell, and a mode switcher.

**Sub-navigation per section**
- Overview: none
- Products: list view, then per-product tabs (Listing, Media, Releases, Reviews, ASO)
- Insights: Performance | Audience | Store presence
- Growth: Promote | Spotlight | Reputation
- Account: Profile | Verification | Subscription | Team | Security | Resources

The AI assistant stops being a route and becomes a docked panel button in the sidebar footer, available context-aware on every console page.

---

## B. Developer Dashboard (Overview) — section by section

1. **Header strip** — "Good morning, {studio}", verification badge, Pro chip with renewal date, primary button "New product".
2. **Action queue** (top of page, replaces the founding banner). Only renders rows that exist; each row is a link with a verb:
   - Listing rejected — fix and resubmit
   - Draft incomplete — finish and submit
   - Version scheduled/awaiting review
   - Unanswered reviews older than 48h
   - KYC not submitted / documents rejected
   - Subscription expiring within 7 days
   When empty: a single calm "You're all caught up" card with the next suggested growth action.
3. **Metric row** — 4 tiles: Installs (30d), Views (30d), Conversion %, Average rating. Each tile shows value, sparkline, and delta vs previous period.
4. **Products at a glance** — up to 4 compact product rows: icon, name, status pill, installs 30d, rating. "View all products" link. No editing controls here.
5. **Reputation card** — score, tier, and the two highest-impact actions to raise it (derived from the same checks the score uses), not just a bar.
6. **Founding programme card** — moved to the bottom, single compact card.

Removed from the dashboard: duplicated KYC/subscription/phone status list (now on Account), duplicated counts already implied by the product rows.

---

## C. Product management IA

**Products list** (`/console/products`)
- Filter chips: All, Live, In review, Draft, Rejected, Archived. Search by name.
- Row: icon 48px, name + kind label, status pill, installs 30d, rating, "Manage".
- Empty state: illustration, "Publish your first product", primary CTA.

**Product detail** (`/console/products/$id`) — header with icon, name, status pill, quick actions (View in store, Submit for review / Unpublish). Tabs replace today's single 780-line page:

| Tab | Contents |
|---|---|
| Listing | Name, tagline, description, category, tags, keywords, website URL. Inline completeness meter. |
| Media | Icon, banner, screenshots (drag order), promo images, video URL. |
| Releases | Version timeline (current, scheduled, past), ship-a-version form, rollback, per-version install adoption. |
| Reviews | Reviews for this product with reply box, rating distribution, response rate. |
| ASO | Score, failed checks with one-tap AI fix, keyword suggestions, score history. |

Beta testing moves inside Releases as a channel selector plus tester list, rather than a separate tab — it is a property of a release, not a parallel concept.

---

## D. Publishing / review / release workflow

```text
Draft ──Submit──> In review ──Approve──> Live
                      │
                      └──Reject──> Rejected ──Edit──> Draft
Live ──New version──> Version in review ──Approve──> Live (updated)
Live ──Unpublish──> Archived
```

- Upload becomes a 4-step wizard, saving a draft after each step: 1) Type & basics, 2) Media, 3) Build or URL, 4) Review & submit. Step 4 shows the ASO checklist and blocks submission until name, description, icon and one screenshot exist.
- "Submit for review" is the only path to `In review`; developers can no longer set `Live` themselves.
- Rejections show the reason inline on the product header with an "Edit and resubmit" button.
- Scheduled releases actually promote at their scheduled time; the Releases tab shows a countdown.
- Priority review is a Pro benefit: Pro submissions sort to the top of the admin queue and the developer sees an expected-review-time note.

---

## E. Analytics redesign (Insights)

- **Performance**: date-range selector (7d / 30d / 90d / custom), installs and views over time, conversion rate (views→installs), per-product breakdown table, per-version adoption.
- **Audience**: device split, country/region split (Malawi districts where available), new vs returning viewers.
- **Store presence**: search terms that surfaced your product, category rank, ASO score over time, competitor category benchmark (Pro).

Product administration (status changes, archive) leaves this page entirely and lives in Products. Aggregation moves to database-side RPCs with a date range instead of pulling raw events into the browser. Advertise/Spotlight impression numbers are only shown once the store surfaces actually record them; until then those metrics are labelled and hidden rather than displayed as zeros.

Pro gate: 90d+ ranges, country breakdown, competitor benchmark and CSV export.

---

## F. Subscription, KYC and verification UX

**Subscription (Account → Subscription)**
- Single card: plan name, MK5,000/month, status, current period end, and what is included.
- Activation is initiated from the app but confirmed server-side against a payment reference; the browser cannot write subscription state.
- Lapse handling: 7-day grace with a banner, then Pro-only features become read-only teasers rather than disappearing (existing data stays visible, actions are gated).
- Every gated control shows the same "Pro" chip and opens the same upgrade sheet, so gating feels consistent rather than random.

**Verification (Account → Verification)**
- Two-step vertical stepper: 1) Phone via WhatsApp, 2) Identity documents.
- Each step shows state (Not started / Pending review / Approved / Needs attention) with reviewer notes when rejected.
- `kyc_status` becomes admin/server-writable only; a developer cannot self-approve.
- Verified developers get: badge on listings and profile, higher trust weight in reputation, and eligibility for Spotlight. Verification is free and separate from Pro — Pro cannot buy a badge.

---

## G. Notifications, help, AI and ASO

- **Notifications**: developer notification centre in the console with type filters (Reviews, Releases, Moderation, Account). Events fire from the database so they are consistent regardless of who acted: review decision, new user review, install milestones (100/1k/10k), version state change, subscription renewal/expiry, team invitation.
- **Help**: Resources becomes a compact help drawer — publishing guide, policy summary, contact support, feature requests — instead of a full nav destination.
- **AI**: docked panel with page-aware quick actions ("Improve this description", "Suggest keywords", "Draft a changelog", "Reply to this review"). Output is plain text and applied inline with a preview/accept step, not copy-paste.
- **ASO**: score persists to `seo_score`/`quality_score` so it can be trended and used in ranking; each failed check has a direct fix action.

---

## H. Features to add, remove, merge

**Merge**
- Advertise + Spotlight → Growth ▸ Promote
- Profile + Verification + Subscription + Team + Security + Resources → Account (tabs)
- Growth/Stats product list → Products
- Beta → inside Releases
- AI Assistant route → docked panel

**Remove or hide**
- The scrolling 10-pill PortalTabs strip
- Any surface reporting metrics nothing records
- 2FA toggles that are stored but unenforced (hide until enforced)
- Leftover wallet/order/payout-era tables from the developer UI entirely

**Add**
- Action queue, review inbox, working release scheduling, conversion metric, notification centre, functional team seats, per-version adoption, subscription grace handling, upgrade sheet.

---

## I. Visual design direction

Building on existing tokens (Outfit display face, `--radius: 1rem`, `--shadow-soft`, `surface-card`, brand red/green, white background).

- **Grid & spacing**: 8px base scale. Page gutter 24px desktop / 12px mobile. Section gap 24px. Card padding 20px desktop / 16px mobile. Max content width 1180px next to the sidebar.
- **Cards**: `surface-card` everywhere, 1rem radius, soft shadow, hairline border. No nested cards — use dividers inside a card instead.
- **Typography**: Outfit for headings only. Page title 24px/700, section title 16px/600, body 14px, metadata 12px muted. Metric values 28px/700 tabular numerals.
- **Status vocabulary** (one set, used everywhere): Draft (muted), In review (amber-neutral outline), Live (brand green), Rejected (brand red), Archived (muted outline), Scheduled (outline with clock icon).
- **Colour discipline**: brand green = success/live/primary action; brand red = destructive/rejected/needs attention. No decorative colour. All values via semantic tokens.
- **Charts**: single-series where possible, brand green line/bars, muted grid, no legends when one series.
- **Responsive**: mobile is single column; metric tiles become a 2×2 grid; tables become stacked rows; the product detail tab strip scrolls horizontally; bottom bar stays fixed with safe-area padding.
- **Empty states**: icon, one-line explanation, one primary action. Never a bare "No data".
- **Loading**: skeletons matching final layout (tile skeletons for metrics, row skeletons for lists). No spinners on full pages.
- **Error states**: inline card with what failed and a retry button; destructive actions always confirm; toasts only for successful mutations.

---

## J. Roadmap

### P0 — trust, correctness, structure
1. Console shell: sidebar/rail/bottom bar, remove PortalTabs and the shopper search from developer pages.
2. Real review workflow: drafts, submit-for-review, admin queue functioning, rejection loop.
3. Lock server-side: `status`/`featured` not owner-writable, `kyc_status` admin-only, subscription not client-writable.
4. Narrow public profile reads so phone numbers are not exposed.
5. Overview page with action queue and metric row.

### P1 — the console worth paying for
6. Products list + product detail tabs (splitting the current manage page).
7. Insights rebuilt on SQL aggregates with date ranges and conversion.
8. Review inbox with reply and response-rate tracking.
9. Lifecycle notifications via database triggers plus the notification centre.
10. Subscription gating applied consistently, with upgrade sheet and grace handling.
11. Working release scheduling and version adoption.

### P2 — depth
12. Functional team seats (role-aware policies + invitation flow).
13. ASO score history, inline AI fixes, keyword suggestions.
14. Promote section with impressions actually recorded by store surfaces.
15. Category benchmarking, CSV export, verified-developer ranking benefit.

## Assumptions
- Payment collection stays outside the app; subscription activation is confirmed against a reference by an admin or server routine, and the app enforces state only.
- Admin moderation continues to live in this app.
- Verification stays free and independent of Pro.
