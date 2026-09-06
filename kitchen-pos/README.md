# Kitchen POS

A point-of-sale app for taking and tracking kitchen orders, built with Next.js (App Router) and Supabase. Deploys to Vercel automatically on push to `main`; database migrations (in `../supabase/migrations`) deploy via a separate GitHub Action.

> **Setting this up for a different organisation?** This page covers working on
> *an existing* deployment — you need access to its Vercel and Supabase
> projects. To stand up your own from scratch, start with
> [the root README](../README.md), which covers creating the Supabase project,
> applying the schema, seeding a menu, and what's configurable.

## Prerequisites

- **Node.js 20.9+** (this repo currently develops against Node 26). Install via [Homebrew](https://brew.sh): `brew install node`
- **Vercel CLI**, logged into an account with access to this deployment's Vercel project: `npm install -g vercel`
- Access to its **Supabase project** — you get this through Vercel (see below), no separate Supabase login needed to just run the app.

### macOS: Node/npm TLS errors ("unable to get local issuer certificate")

If `npm install` or `vercel` commands fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or `unable to get local issuer certificate`, it's because Homebrew's Node build doesn't trust some certificate chains (e.g. Google Trust Services roots) that macOS itself trusts. Fix:

```sh
echo 'export NODE_EXTRA_CA_CERTS="/opt/homebrew/opt/ca-certificates/share/ca-certificates/cacert.pem"' >> ~/.zshenv
```

(Use `~/.zshenv`, not `~/.zshrc` — it's the one zsh always sources, even for non-interactive shells. Add the equivalent `set -gx NODE_EXTRA_CA_CERTS ...` to `~/.config/fish/config.fish` if you use fish too.) Open a new terminal after adding it.

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Link this folder to the Vercel project** (one-time; you'll be prompted to log in first with `vercel login` if you haven't):
   ```sh
   vercel link --project <your-vercel-project>
   ```

3. **Pull environment variables from Vercel:**
   ```sh
   vercel env pull .env.local
   ```
   (Not using Vercel, or setting up a fresh fork? `cp .env.example .env.local`
   and fill it in by hand instead — `.env.example` documents every variable the
   app reads, and all but the two Supabase ones are optional.)

   This writes `.env.local` (gitignored) with:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — connect to the **real, shared Supabase project** (production data: real orders, real stock counts). To point at a separate sandbox project instead, see [Sandbox vs production](#sandbox-vs-production) below.
   - `NEXT_PUBLIC_ORG_NAME` — display name shown in the UI. Optional, like every non-Supabase variable; `.env.example` and [the root README](../README.md#environment-variables) list them all with their defaults.
   - `SUPABASE_KEY`, `SUPABASE_PROJECT_ID` — see caveat below.
   - `VERCEL_OIDC_TOKEN` — used by the Vercel SDK/OIDC, unrelated to Supabase.

   Re-run `vercel env pull .env.local` any time env vars change in the Vercel dashboard.

   **For active dev involving DB migrations, backfills, or anything that needs to bypass RLS** (not needed for normal app usage — the client runs fine on the anon key + RLS): add a `SUPABASE_SERVICE_ROLE_KEY` yourself. It isn't set in Vercel and `vercel env pull` won't fetch it. Get it from the Supabase dashboard → your project → **Settings → API** → reveal the `service_role` secret key, then add `SUPABASE_SERVICE_ROLE_KEY="<value>"` to `.env.local`.

4. **Run the dev server:**
   ```sh
   npm run dev
   ```
   Open http://localhost:3000.

5. **Log in.** There's no sign-up UI — you need an existing Supabase Auth user (email/password). Ask a teammate to create one for you via the Supabase dashboard (Authentication → Users), or if you have dashboard access, create your own.

## Known caveats

- **`SUPABASE_KEY` (from `vercel env pull`) is just a duplicate of the anon key, not a service-role key.** No service-role credential is configured in Vercel at all. The app never needs one — every page is a client component running against the publishable/anon key plus RLS policies — but migrations and backfills do; see the setup step above for adding your own.
- **`npm run dev` talks to whichever project `.env.local` points at — by default, production.** Use `make dev-sandbox` from the repo root to work against the sandbox project instead. There's still no local Postgres or seed data, so a sandbox project has to be migrated and populated by hand.
- **Toolchain versions are pinned slightly behind "latest".** `eslint` is pinned to `^9.39.5` and `typescript` to `^5.9.3` because `eslint-config-next@16.3.0`'s bundled `typescript-eslint` doesn't yet support ESLint 10 or TypeScript 7. Check if that's been resolved upstream before bumping either.

## Sandbox vs production

The `Makefile` at the repo root runs the app and migrations against either of two
Supabase projects, so you don't have to develop against live orders.

One-time setup: copy `.env.sandbox.example` and `.env.prod.example` to
`.env.sandbox` / `.env.prod` and fill in each project's URL and key. Each target
copies the selected file over `.env.local` (backing up the previous one to
`.env.local.bak`), since that's the file Next.js always loads.

```sh
make help            # list every target
make dev-sandbox     # dev server against the sandbox project
make dev-prod        # dev server against production
```

## Database migrations

Schema changes live in `../supabase/migrations` — a single shared history applied
independently to each project. On push to `main`, `.github/workflows/update_db.yaml`
pushes them to production automatically, so no manual step is needed for normal
development.

To apply migrations yourself (or to a sandbox project), use the Makefile targets —
each re-links to its own project ref immediately before pushing, so you can't
accidentally push to whichever project happened to be linked last:

```sh
make migration-new NAME=add_something   # create a migration file
make migrate-status-sandbox             # read-only: applied vs pending
make migrate-sandbox                    # dry-run, then apply on confirmation
make migrate-prod                       # same, against production
```

Run `supabase login` once first. The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
prompts for each project's DB password on first link and caches it in your OS
keychain — it's never written to a file.

## Deploy

Deploys to Vercel automatically on push to `main` — no manual steps needed.
