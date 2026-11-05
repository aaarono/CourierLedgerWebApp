# Courier Ledger · Foundation v0.4

A mobile-first earnings tracker for couriers. This is **Sprint 01 / Foundation**, not yet a working shift tracker. It includes a genuine authentication flow and secure profile/preferences storage **once you connect your own Supabase project**, plus an independently tested financial maths module. No backend keys, sessions, or service credentials are included.

## Stack

- React 19 / TypeScript / Vite 8
- Supabase Auth + PostgreSQL RLS (first migration only)
- Plain CSS foundation; Tailwind/shadcn UI adoption planned after the design tokens are finalized
- Vitest/Playwright planned; current pure-domain tests run on Node's `node:test` (no external runner)
- Static hosting: Cloudflare Pages (`npm run build`, `dist`)

## Local startup

```bash
npm install
cp .env.example .env     # on Windows: copy .env.example .env
# Add Supabase project URL and publishable/anon key to .env
npm run dev
npm test
npm run build
```

For the connected flow:

1. Create Supabase project.
2. Paste `supabase/migrations/202611060001_foundation.sql` in the Supabase SQL Editor and run it once (prefer Supabase CLI for further migrations).
3. In Supabase Auth configure Site URL (`http://localhost:5173` for dev), and add permitted redirect URLs for local + production deployment.
4. Enable Google provider, create Google OAuth web client and configure its client ID + secret **in Supabase**. Never store Google secret in `.env` (Vite exposes `VITE_*` vars to the client).
5. Email/password auth is also available. If email confirmation is enabled, confirm via email before signing in.

### Currency semantics — FINAL decision for MVP

`profiles.preferred_currency_code` determines the **currency of new workspaces**. Each workspace has its own immutable accounting currency (CZK / EUR / USD / UAH). Changing profile currency **does not change or convert existing amounts**. Cross-currency sums are forbidden. Locale (`ru`/`cs`/`en`) is independent. Money uses integer minor units; the pure-domain module covers commissions and rental allocations.

### Current functionality

- Login/sign-up via email and password, Google OAuth (after external provider setup)
- Live Supabase session and logout
- Personal workspace created on registration
- Profile with nickname, language, currency preference
- Responsive login + dashboard scaffold in 3 languages
- Finance math and 6 tests with exact historical examples

### Intentionally unavailable until next phases

- Shift creation, teams/invites, payouts, debts, cars, analytics, shared edits
- Team financial operations require transactional RPC and security tests; do **not** implement as unprotected client table writes.
- No automatic exchange rates or conversion.

## Deployment: Cloudflare Pages

Push the project to a new GitHub repo (no `.env`); choose Framework `Vite` / build `npm run build` / directory `dist`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Pages environment variables. Add resulting `https://*.pages.dev` URL to Supabase redirect allowlist and Google OAuth JavaScript origins as documented. Later use a custom domain.

### Cost caveat

Cloudflare Pages Free supports up to 500 builds/mo. Supabase Free is initially $0 with 500 MB DB and up to 50k MAU, but **free projects can pause after a week of inactivity**, so this is not guaranteed always-on production infrastructure. Budget at least $25/mo for Supabase Pro if the site becomes publicly important. Domain cost extra.

## Security and correctness

- Supabase service role keys / OAuth client secrets **must never** be embedded in browser JavaScript.
- Row-level security for `profiles` and `workspaces` is included, but needs integration testing on a real Supabase instance before external testers are invited.
- Amounts are stored as `BIGINT` decimal strings / `bigint` locally; do not put monetary sums into JS floats.
- Real data belongs to users and workspaces; seeded past courier data is deliberately **not** inserted into shared cloud tables.

## Files

- `docs/PRD-v0.4.md`: full requirements
- `docs/ARCHITECTURE-v0.4.md`: data / RLS / finance principles
- `docs/MVP-ROADMAP-v0.4.md`: milestones
- `supabase/migrations/`: incremental database setup
- `src/domain/`: money / currency calculations and tests

## Known validation limitations

Finance unit tests run in this environment. `npm install` and production bundle verification require npm network access, which was unavailable during assembly. A full Supabase two-account RLS/auth test likewise needs your Supabase project to be connected.
