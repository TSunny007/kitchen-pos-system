# Kitchen POS

A point-of-sale app for taking and tracking kitchen orders, built with Next.js (App Router) and Supabase. Deploys to Vercel automatically on push to `main`; database migrations (in `../supabase/migrations`) deploy via a separate GitHub Action.

## Prerequisites

- **Node.js 20.9+** (this repo currently develops against Node 26). Install via [Homebrew](https://brew.sh): `brew install node`
- **Vercel CLI**, logged into an account with access to the `kitchen-pos-system` project: `npm install -g vercel`
- Access to the shared **Supabase project** — you get this through Vercel (see below), no separate Supabase login needed to just run the app.

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
   vercel link --project kitchen-pos-system
   ```

3. **Pull environment variables from Vercel:**
   ```sh
   vercel env pull .env.local
   ```
   This writes `.env.local` (gitignored) with:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — connect to the **real, shared Supabase project** (production data: real orders, real stock counts). There is currently no local/sandboxed Supabase option wired up for this app.
   - `NEXT_PUBLIC_ORG_NAME` — display name shown in the UI.
   - `SUPABASE_KEY`, `SUPABASE_PROJECT_ID` — see caveat below.
   - `VERCEL_OIDC_TOKEN` — used by the Vercel SDK/OIDC, unrelated to Supabase.

   Re-run `vercel env pull .env.local` any time env vars change in the Vercel dashboard.

4. **Run the dev server:**
   ```sh
   npm run dev
   ```
   Open http://localhost:3000.

5. **Log in.** There's no sign-up UI — you need an existing Supabase Auth user (email/password). Ask a teammate to create one for you via the Supabase dashboard (Authentication → Users), or if you have dashboard access, create your own.

## Known caveats

- **`app/lib/supabase/server.ts` expects `SUPABASE_SERVICE_ROLE_KEY`, but Vercel provides `SUPABASE_KEY`.** Today this is harmless — `createServerClient()` isn't called anywhere in the app (everything runs client-side against the anon key + RLS policies) — but if you add server-side/admin code that relies on the service-role key, it'll silently fall back to the anon key instead. Worth reconciling the naming (rename the Vercel env var, or update `server.ts` to read `SUPABASE_KEY`) before depending on it.
- **You're developing against production data.** There's no seed data or local Postgres wired up, despite the migrations living in `../supabase/migrations`. Be deliberate about test orders / stock edits.
- **Toolchain versions are pinned slightly behind "latest".** `eslint` is pinned to `^9.39.5` and `typescript` to `^5.9.3` because `eslint-config-next@16.3.0`'s bundled `typescript-eslint` doesn't yet support ESLint 10 or TypeScript 7. Check if that's been resolved upstream before bumping either.
- `next dev` auto-generates `AGENTS.md`/`CLAUDE.md` at the project root on first run (a built-in Next.js 16 feature, disable via `agentRules: false` in `next.config.ts`). They'll typically show as modified in git each time you run dev; that's expected.

## Database migrations

Schema changes live in `../supabase/migrations` and deploy automatically to the shared Supabase project via `.github/workflows/update_db.yaml` on push to `main` — no manual `supabase db push` needed for normal development. The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) is only required if you want to create new migrations or run Supabase locally.

## Deploy

Deploys to Vercel automatically on push to `main` — no manual steps needed.
