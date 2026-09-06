# Kitchen POS

A small, self-hostable point-of-sale and kitchen display system for food
service — pop-ups, cafés, market stalls, church kitchens, school events.
Someone takes orders on a tablet at the counter; the kitchen sees them appear
on a second screen and taps items off as they go out.

Next.js (App Router) + Supabase. No backend of your own to run: the app is
static-ish React talking straight to Postgres through Supabase's client, with
row-level security doing the access control.

- **Order Terminal** — build an order, apply modifiers, take a name, send it.
- **Kitchen Display** — live queue in New / Preparing / Ready lanes, updating
  in real time across every screen.
- **Campaigns** — scope a menu to an event or a service period, with optional
  per-item stock counts that mark things sold out as they run down.

---

## Deploy your own

You need a [Supabase](https://supabase.com) project (the free tier is enough
for a single kitchen) and somewhere to host a Next.js app — the instructions
below use [Vercel](https://vercel.com), also free-tier-viable.

**1. Fork this repo and create a Supabase project.** From
Dashboard → Project Settings you'll want the **project URL**, the
**publishable key**, and your **project ref** (the subdomain of the URL).

**2. Apply the schema.**

```sh
brew install supabase/tap/supabase   # or see the CLI docs for other platforms
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

(The Supabase CLI refuses a global `npm install -g`; use Homebrew, one of the
[other install methods](https://supabase.com/docs/guides/local-development/cli/getting-started),
or prefix each command with `npx`.)

**3. Seed a starter menu.** Optional but recommended for a first run — a
migrated-but-empty database gives you a terminal with nothing to sell and no
campaign to sell it under. Paste [`supabase/seed.sql`](supabase/seed.sql) into
Dashboard → SQL Editor and run it. It's idempotent and only ever adds rows
that are missing, so it's safe to re-run and safe to skip once you have a real
menu.

**4. Create your first user.** There is deliberately no sign-up page — this is
staff software, and an open registration form on a POS is a liability. Add
users by hand under Dashboard → Authentication → Users → Add user, with
"Auto Confirm User" checked.

**5. Configure and run.**

```sh
cd kitchen-pos
npm install
cp .env.example .env.local     # fill in your Supabase URL + publishable key
npm run dev
```

**6. Deploy.** Point Vercel at the `kitchen-pos` directory as the project
root, set the same environment variables in its dashboard, and deploy. To get
migrations deploying automatically on push, see
[Continuous deployment](#continuous-deployment) below.

---

## Configuring it for your kitchen

Configuration is split across three places, deliberately — see
[the tradeoff](#the-tradeoff-were-making) for why it isn't all one mechanism.

### Environment variables

Everything here has a working default except the Supabase credentials, so the
app runs on a two-line `.env.local`. The full annotated list lives in
[`kitchen-pos/.env.example`](kitchen-pos/.env.example).

| Variable | Default | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | — | **Required.** Your project's API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | — | **Required.** Publishable key (`sb_publishable_…`). `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as the legacy name. |
| `NEXT_PUBLIC_ORG_NAME` | `Kitchen` | Your name, woven into titles: "Bluebird Cafe POS", "Bluebird Cafe Terminal". |
| `NEXT_PUBLIC_LOCALE` | `en-US` | BCP 47 tag driving prices, dates, and 12- vs 24-hour clocks. |
| `NEXT_PUBLIC_CURRENCY` | `USD` | ISO 4217 code. An unrecognised code warns and falls back rather than breaking the app. |
| `SUPABASE_SECRET_KEY` | — | Optional, server-side only. Never needed to run the app; only for migrations and scripts that must bypass RLS. |

### Wording and labels

[`kitchen-pos/app/config/tenant.ts`](kitchen-pos/app/config/tenant.ts) is the
single module that reads the environment, and it also holds the strings a fork
changes once and forgets: the app name and description, and the two station
labels. If "Order Terminal" and "Kitchen Display" should read "Front Counter"
and "The Pass", that's one edit there and nowhere else.

No component hardcodes an org name, a currency, or a station label, and
nothing outside `tenant.ts` reads a branding or locale variable from the
environment. (`app/lib/supabase/client.ts` reads the two Supabase credentials
directly — that's the one other `process.env` site, and it's deliberate.) If
you find anything else, that's a bug.

### Look and feel

The colour system is Material-flavoured CSS custom properties in
[`kitchen-pos/app/globals.css`](kitchen-pos/app/globals.css). The accent
colour is defined once in the `BRAND` block at the top of that file, in light
and dark variants, and every palette below it refers back to those tokens — so
re-skinning is one block, not three.

The neutral surface ramp underneath is a warm sand tuned to the default green.
Moving to a cool accent usually means neutralising those too; they're left as
literals because changing them is a whole-look decision rather than a switch.

Typography is a local webfont — see
[`kitchen-pos/public/fonts/README.md`](kitchen-pos/public/fonts/README.md) for
swapping it, including the licensing catch of committing a font to a public
fork.

---

## The tenancy model

**One deployment per organisation.** Each tenant runs their own fork, their
own Supabase project, and their own database. There is no `tenant_id` column
anywhere, and two organisations never share a row.

This is the significant architectural decision in the repo, so it's worth
being explicit about what it buys and what it costs.

**What it buys.** Data isolation is total and needs no code to enforce — the
RLS policies only have to answer "is this user signed in?", not "does this row
belong to this user's org?", which is where multi-tenant systems typically leak.
There's no tenant-resolution middleware, no risk of a missing `where` clause
exposing another kitchen's orders, and no shared-database blast radius. A
tenant can fork, change whatever they like, and never rebase. Restoring a
backup affects exactly one organisation.

**What it costs.** Every tenant needs their own Supabase project and their own
deploy — there's no "sign up and go" path, and you can't run a hosted service
on this shape without building one. Upgrades don't propagate: a fix here
reaches other tenants only when they pull. And cross-tenant reporting is
impossible by construction.

For the target user — one organisation running one kitchen, wanting control of
their own data — that trade lands clearly on the right side. **If you need
shared-database multi-tenancy, this is the wrong starting point**, and
retrofitting it is not a small change: a `tenant_id` on every table, RLS
policies rewritten to join through org membership, a tenant-resolution layer,
and a migration path for existing rows.

### The tradeoff we're making

The general rule this codebase follows, and the reason configuration lives in
three places rather than one:

> Make the common case require no configuration at all; make the uncommon case
> require editing code rather than reading documentation.

An environment variable is the most flexible option and the most expensive
one — every knob is another line in someone's setup checklist and another
thing to get wrong at 6am before service. So the environment holds only what
genuinely differs between two deploys of the same code, and everything there
has a default. Things a fork changes once live in `tenant.ts` or `globals.css`
as plain code, where a reader can see them in context.

Concretely, that means:

- **New knob? Start it as a constant in `tenant.ts`.** Promoting a constant to
  an env var later is a non-breaking change. The reverse breaks every existing
  deployment.
- **No plugin system, no theme packages, no config file format.** They'd be a
  layer of indirection over one team's fork of a single-kitchen app.
- **Defaults everywhere.** `npm run dev` with only Supabase credentials set
  must produce a working app that says "Kitchen POS". Configuration that is
  required to boot is a bug.

---

## Repo layout

```
kitchen-pos/            Next.js app (this is the Vercel project root)
  app/config/tenant.ts    all environment reads + per-fork constants
  app/lib/format.ts       currency/date formatting, locale-driven
  app/lib/supabase/       data access, one module per table group
  app/terminal/           order-taking station
  app/kitchen/            kitchen display station
  app/globals.css         design tokens; BRAND block at the top
supabase/
  migrations/             ordered schema history
  seed.sql                starter menu for a fresh project
Makefile                  dev + migration targets for sandbox/prod
```

Development setup, the sandbox/production split, and migration workflow are
documented in [`kitchen-pos/README.md`](kitchen-pos/README.md).

### Continuous deployment

`.github/workflows/update_db.yaml` pushes migrations on every push to `main`.
It's project-agnostic — to use it in your fork, set three repository secrets
under Settings → Secrets and variables → Actions:

| Secret | Where to find it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase account settings → Access Tokens |
| `SUPABASE_DB_PASSWORD` | The database password you set at project creation |
| `SUPABASE_PROJECT_ID` | Your project ref |

The app itself deploys through Vercel's own GitHub integration, not this
workflow.

## License

No license file is present, which means default copyright applies. If you
intend others to deploy this, add one.
