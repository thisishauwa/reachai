# ECHO / REACH Encounter

A clinician-facing health encounter and disease-surveillance PWA. **REACH
Encounter** is the standard clinical documentation workflow; **ECHO
Encounter** is an assisted syndromic-surveillance and triage workflow that
can run anonymously or with an identified patient and can generate
privacy-safe referrals between facilities.

Built with Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS,
shadcn/ui (Base UI), React Hook Form + Zod, TanStack Query, Dexie
(IndexedDB) and Supabase (Postgres, Auth, Storage, Realtime).

> Clinical content note: this repo does not ship clinically-approved
> triage thresholds, guidance text or consent language. `supabase/seed_dev_only.sql`
> contains **placeholder, non-production, non-reviewed** demo content
> clearly marked as such, for local development only. Do not deploy it.

## 1. Prerequisites

- Node.js 20.9+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`)
- Docker (for `supabase start`, i.e. the local Postgres/Auth/Storage stack)

## 2. Local setup

```bash
npm install

# Start local Supabase (Postgres + Auth + Storage + Studio)
supabase start
```

`supabase start` applies everything under `supabase/migrations/` and then
the seed files declared in `supabase/config.toml` (`seed_reference_data.sql`

- `seed_dev_only.sql`) automatically. It prints your local API URL, anon key
  and service-role key.

Copy `.env.local.example` to `.env.local` and fill in the values `supabase start` printed:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key from `supabase start`>
```

The service-role key is **never** used by this app (all privileged
operations are implemented as `security definer` Postgres functions --
`evaluate_triage`, `create_referral`, `transition_referral` -- callable by
the `authenticated` role and enforcing their own authorization checks). Do
not add it to any client-reachable code.

### Create your first clinician account

1. Run the app (`npm run dev`) and use the sign-up flow, or create a user via
   Supabase Studio (`http://127.0.0.1:54323` → Authentication → Users → Add
   user). Note the generated user UUID.
2. Link that user to a demo facility (the seed already created a demo
   organization and two facilities: `PHC-DEMO` and `GH-DEMO`) by running in
   the Studio SQL editor or `psql`:

   ```sql
   insert into public.profiles (id, display_name)
   values ('<auth-user-uuid>', 'Demo Clinician')
   on conflict (id) do update set display_name = excluded.display_name;

   insert into public.facility_memberships (user_id, organization_id, facility_id, role)
   values ('<auth-user-uuid>', '00000000-0000-0000-0000-000000000001',
           '00000000-0000-0000-0000-000000000010', 'clinician');
   ```

   To test the referral destination side, add a second membership at
   `GH-DEMO` (`00000000-0000-0000-0000-000000000011`) with role
   `referral_clinician`, or create a second user for that facility.

3. Sign in at `/login`.

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000`. You'll land on the workflow chooser (REACH vs
ECHO), then Home.

## 3. Regenerating Supabase types

`src/lib/supabase/database.types.ts` is currently hand-authored to mirror
`supabase/migrations/20260101000000_init_schema.sql`. Once you're iterating
against a real project, regenerate it from the live schema and reconcile any
drift:

```bash
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

## 4. Testing

```bash
npm test        # vitest run (unit tests)
npm run test:watch
npm run lint
npm run build    # type-checks (tsc) + production build
```

Unit tests cover the deterministic logic explicitly called out in the test
plan: the conditional-question / `show_when` evaluator, the triage rule
selector (severity + priority ordering), the anonymous-mode privacy guard,
the referral status state machine, and outbox idempotency-key de-duplication.
See `src/lib/logic/__tests__/`.

These pure functions mirror -- but do not replace -- the authoritative
server-side logic in `supabase/migrations/20260101000001_functions.sql`
(`evaluate_triage`, `create_referral`, `transition_referral`), which is the
actual source of truth enforced by Postgres/RLS. That SQL was validated
directly against a local Postgres 16 instance (schema + RLS + all three
functions applied cleanly; a full ECHO walkthrough -- consent → syndrome →
answers → `evaluate_triage` → acknowledge → `create_referral` → `arrived` →
`closed` → incentive evaluation -- was exercised end to end).

## 5. Project structure

```
supabase/
  migrations/
    20260101000000_init_schema.sql   # supplied schema (tables, enums, RLS, triggers, storage buckets)
    20260101000001_functions.sql     # evaluate_triage / create_referral / transition_referral (security definer)
    20260101000002_facility_directory.sql  # additive RLS policy so clinicians can list same-org facilities as referral destinations
  seed_reference_data.sql            # supplied UI reference data (syndromes, sample questions, lab catalogue)
  seed_dev_only.sql                  # LOCAL-ONLY demo org/facilities/consent text/triage rules/incentive rule

src/
  app/
    login/                           # email/password auth
    (app)/                           # protected shell (bottom nav + header), gated on an active facility_membership
      workflow/                     # REACH/ECHO chooser
      home/ patients/ encounters/ referrals/ settings/
  components/
    echo/                            # ECHO encounter step components (privacy mode, consent, demographics, syndrome, adaptive questions, triage, referral)
    reach/                           # REACH encounter step components (history, examination, assessment/labs/rx, review)
    nav/ notifications/ offline/ providers/ ui/
  lib/
    supabase/                        # browser + server clients, hand-authored Database types
    logic/                           # pure, unit-tested domain logic (conditions, triage, privacy, referral state machine, idempotency)
    offline/                         # Dexie (IndexedDB) outbox + sync controller + registered per-entity handlers
    queries/                         # TanStack Query hooks per domain
    validation/                      # Zod schemas
    session/                         # client-side session/workflow-mode context
  proxy.ts                           # Next.js 16 "proxy" (formerly middleware): Supabase session refresh + route protection
```

## 6. Architecture notes

- **Deterministic triage**: `evaluate_triage` loads only the encounter's
  currently-active (non-superseded) answers, selects the highest
  severity/priority published `triage_rules` row whose `conditions` JSON all
  match, and persists the matched rule id/version, the evaluated inputs, and
  a full snapshot of the ruleset considered. Nothing in the UI invents
  guidance -- it only renders what the function returned.
- **Privacy**: anonymous ECHO encounters have `patient_id = null` and a
  generated opaque `session_code`; a database trigger
  (`enforce_encounter_privacy`) rejects any attempt to attach a name, phone,
  patient code or signature to them regardless of what the client sends. The
  client mirrors this in `src/lib/logic/privacy.ts` for fast UI feedback, but
  the database is the actual enforcement boundary.
- **Idempotency / offline**: every mutation carries a client-generated UUID
  idempotency key. `create_referral` and `transition_referral` short-circuit
  and return the original result if the same key is replayed (via
  `client_mutations`). The client-side outbox (`src/lib/offline`) queues
  mutations in IndexedDB with declared dependencies, drains them in order
  when online with exponential backoff, and never discards a draft on
  failure -- Settings exposes sync state and a manual "Retry sync".
- **Referrals**: `referral_code` is non-sequential and the QR payload is
  just that code -- never patient data. `referral_events` is an append-only
  audit trail; `referrals.status` is a fast-read projection updated in the
  same transaction as the event insert.
- **RLS**: every exposed table has RLS enabled, deny-by-default. Domain
  writes are scoped to active facility memberships; reference data is
  read-only to authenticated users; referral/triage/membership writes only
  happen through the `security definer` functions described above --
  ordinary clients have no direct insert grant on those tables.

## 7. Known gaps / follow-ups before production

These mirror the "explicit assumptions" section of the PRD and are not
resolved by this codebase -- they need product/clinical/legal sign-off:

- Consent text, triage thresholds/guidance and the incentive rule in
  `seed_dev_only.sql` are placeholders and must be replaced by
  clinically-approved, versioned content (published through Supabase Studio
  or an admin tool, not this seed file).
- Drawn-signature capture (canvas → `consent-signatures` bucket upload) is
  not implemented; the identified-consent flow currently supports typed
  signatures only.
- Hausa audio playback controls are not implemented (the schema supports
  `audio_storage_path` on syndromes/questions; the UI shows a badge when one
  exists but does not yet play it).
- The offline outbox synchronizes the primary encounter/patient/referral
  writes; deeper conflict-resolution UX (surfacing a merge/override dialog
  for concurrent edits) is intentionally minimal for this MVP.
- Deployment (Vercel/other host + a hosted Supabase project + PWA icon
  assets in `public/`) is not configured; `public/manifest.json` references
  `icon-192.png` / `icon-512.png` placeholders that should be replaced with
  real app icons.
