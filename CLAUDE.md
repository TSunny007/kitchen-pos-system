# Repo instructions for Claude Code

## This is meant to be deployable by other people

This isn't only our kitchen's POS — it's intended to be forkable by other
organisations who want to run their own. That goal is easy to erode one commit
at a time, so treat it as a constraint on every change, not a phase we finished.

**The tenancy model is one deployment per organisation** — separate fork,
separate Supabase project, separate database. There is no `tenant_id` anywhere
and there shouldn't be one; don't add row-level multi-tenancy without an
explicit decision to change the model. The reasoning, and what it would cost to
reverse, is in the root `README.md`.

### Rules that follow from that

- **Nothing org-specific gets hardcoded in a component.** Org name, currency,
  locale, station labels, brand colours: these resolve through
  `kitchen-pos/app/config/tenant.ts`, `app/lib/format.ts`, or the `BRAND` block
  in `globals.css`. `tenant.ts` is the only place a branding or locale env var
  is read (`lib/supabase/client.ts` reads the Supabase credentials, and that's
  the whole list). A new `process.env` read, a bare `$`, or a hardcoded
  `en-US` in JSX is a bug — route it through the config seam instead.
- **Everything must have a working default.** `npm run dev` with only the two
  Supabase variables set has to produce a running app. Configuration that is
  required to boot, or that crashes the app when malformed, is a defect — bad
  input should warn and fall back.
- **New knob? Start it as a constant in `tenant.ts`, not an env var.**
  Promoting one later is non-breaking; demoting one breaks every existing
  deployment. Env vars are reserved for what genuinely differs between two
  deploys of the same code.
- **Resist configurability for its own sake.** No plugin system, no theme
  packages, no config file format. Each new option is a line in a stranger's
  setup checklist and a thing to get wrong before service, so when a change
  adds flexibility, say what it costs in ease of setup. The tradeoff in full is
  in the root `README.md`.
- **Schema changes ship with the schema.** New tables need their RLS policies
  in the same migration (see `20251206100000_add_campaign_items.sql` for the
  pattern), and anything a fresh deployment needs in order to have a usable
  first screen belongs in `supabase/seed.sql` — which must stay idempotent and
  must never clobber an operator's real data.
- **Keep the docs true.** A change to the env surface, the config module, or
  the deploy steps should update `README.md` and `kitchen-pos/.env.example` in
  the same PR. A stale setup guide is the fastest way to make this
  undeployable by anyone but us.

## Before opening a pull request

Check whether the fix is already in flight or already landed before creating a new PR — this repo has had duplicate/overlapping work land before:

- `gh pr list --state open` — is there an open PR touching the same files or behavior?
- `gh pr list --state merged --limit 20` — has this already been fixed and merged recently? (`git log origin/main --oneline -20` after a `git fetch` also catches this if local `main` is stale.)
- If the branch you're about to push already exists on `origin` with commits ahead of your local copy, fetch and inspect it (`git log <branch>..origin/<branch>`) before assuming it's yours to overwrite.

If an existing PR or recent commit already covers the issue, say so instead of duplicating the work — point to the existing PR/commit rather than opening a new one. If it's related but incomplete, prefer building on that branch/PR over starting a parallel one.

## Look for opportunities to simplify

While implementing or reviewing changes, don't stop at satisfying the immediate ask — look for adjacent simplification opportunities in the code you're touching: duplicate logic, overbuilt abstractions, stale/dead code paths, unnecessary state. Fix small ones inline; call out larger ones explicitly rather than silently expanding scope. Run the `simplify` skill (or `/code-review`) over non-trivial diffs before opening a PR.
