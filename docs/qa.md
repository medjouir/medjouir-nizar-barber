# QA report — V0.1 (Phase 10)

Date: 2026-10-02 · Build: production (`next build`), demo mode, Node 24 runtime on Vercel.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Unit tests (engine, booking, clients, planning, settings, phone, format) | `npm test` | 107 passed |
| Database: constraints, double booking, RLS, owner linking | `npm run test:db` | all passed |
| End-to-end: definition of done (mobile, Pixel 7) | `npm run build && npm run test:e2e` | 3 passed |
| Typecheck / lint | `npm run typecheck && npm run lint` | clean |
| Accessibility: axe-core WCAG 2.1 A/AA + best practices, 19 screens | manual script | 0 violations |
| Responsive: no horizontal scroll at 360 / 390 / 768 / 1280 px, 15 screens | manual script | pass |

## Definition of done (spec) — verified end to end

1. Booking URL opens on mobile (`/nizar`, WhatsApp link preview with Open Graph image) ✔
2. Coupe / Coupe + barbe / Proteine cheveux selectable ✔
3. Only genuinely available dates and times are offered (hours, blocks, closed days, existing appointments, buffer, notice, horizon) ✔
4. Name + Moroccan phone (normalized), review, confirm, success screen ✔
5. Nizar sees the appointment on Lyouma, Planning and the client profile ✔
6. Contact (WhatsApp / 3ayet), reschedule, cancel, mark completed, mark no-show ✔
7. A confirmed slot is never offered again; simultaneous requests: exactly one wins (service test) and the database refuses overlaps (exclusion constraint test) ✔

## Fixed during QA

- Text contrast: "subtle" grey raised from #6b6b6b to #868686 (≥ 4.5:1); no-show and inactive states use strike-through instead of low-opacity text.
- Progress bar has an accessible name; blocked periods in week view have a proper role.
- Slide transitions could cause sideways scrolling on phones → `overflow-x: clip`.
- Loading skeleton for the barber area; Darija error screen with retry; Darija 404.
- `X-Powered-By` header removed. Security headers: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (HSTS by Vercel).

## Security review (V0.1)

- Public visitors never read clients, other appointments or private block reasons (checked on rendered HTML in e2e; RLS denies anon in DB tests).
- Every barber Server Action re-checks the session and scopes ids to the barber's own data; slugs are never taken from the browser.
- Manage links use 256-bit random tokens; malformed or unknown tokens return 404.
- Inputs validated server-side (names, phones, notes, settings) with the same rules as the DB constraints; maps links must be `https://`.
- Sign-out is POST-only; `/auth/confirm` only redirects to same-site paths.
- Only HTML injection: the QR code SVG generated server-side from our own URL.

## Known limits before real clients

- **Demo mode is public**: without Supabase env vars, `/dashboard` needs no login and data lives in the visitor's cookies. The Supabase `BookingStore` implementation must be written and the env vars set before sharing the link with real clients.
- **Rate limiting** on public booking is not implemented (no extra infrastructure in V0.1). Vercel Firewall rate-limit rules can be added on `/nizar/7jez` server actions.
- **Timezone data**: Morocco's clock rules come from the runtime (tzdata 2026c: permanent GMT+0 since 2026-09-20). Keep Node updated.
- Demo cookies keep the 6 latest bookings and 140-character notes (demo only).
