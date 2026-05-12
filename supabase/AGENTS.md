# Supabase migrations — agent guide

This folder is applied to **two separate Supabase projects** (prod and non-prod).
Read this before adding, removing, or editing anything under `migrations/`.

## How migrations get applied

`.github/workflows/migrate.yml` calls `supabase db push` automatically. The
Supabase native GitHub integration is **not** used. The trigger decides which
project gets the push:

| Event | Target project |
| --- | --- |
| `pull_request` (PR opened / pushed) | **dev** (`SUPABASE_DEV_*`) |
| `push` to `main` (PR merged) | **prod** (`SUPABASE_*`) |
| `workflow_dispatch` (manual) | **dev** only (manual prod is intentionally disabled) |

Order matters: **dev apply → preview verify → main merge → prod apply**.
No prod-first path exists, so a preview cannot accidentally read an old
schema while you verify a PR. Skipping dev (merging straight to main) is
still safe for prod, but the next PR's preview will be broken until that SQL
lands on dev.

`db push` is idempotent — already-applied migrations are skipped.

## PR checklist (migration-touching PRs only)

- [ ] After push: `Apply Supabase migrations` workflow (`apply` job) succeeded on **dev**
- [ ] Verify the affected flow on the Vercel preview deployment
- [ ] After merge: same workflow succeeded on **prod**
- [ ] Smoke check on the production domain (create one share)

## Required GitHub Secrets

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth (account token) |
| `SUPABASE_PROJECT_REF` | prod project ref |
| `SUPABASE_DB_PASSWORD` | prod DB password |
| `SUPABASE_DEV_PROJECT_REF` | non-prod project ref |
| `SUPABASE_DEV_DB_PASSWORD` | non-prod DB password |

## Naming convention

Files must sort lexicographically by timestamp prefix: `YYYYMMDDHHMMSS_short_snake_case.sql`.
The Supabase CLI applies them in that order, so misnamed files break the
chain. New migrations append; never edit an applied file in-place — write a
forward migration instead.

## ⚠️ Tied to runtime keys

Migration `20260509000002_lock_down_shares_rls.sql` revokes anon/auth role
grants and leaves only the **secret/service-role key path** working. Before
applying it to a given environment, the matching secret key must already be
deployed:

- prod → `SUPABASE_SECRET_KEY`
- non-prod → `SUPABASE_DEV_SECRET_KEY`

Apply the SQL without the secret key in place and existing publishable-key
call sites will 403 with `permission denied`. The runtime client in
`lib/supabase.ts` is the only legal entry point.
