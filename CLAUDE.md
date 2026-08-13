# Repo instructions for Claude Code

## Before opening a pull request

Check whether the fix is already in flight or already landed before creating a new PR — this repo has had duplicate/overlapping work land before:

- `gh pr list --state open` — is there an open PR touching the same files or behavior?
- `gh pr list --state merged --limit 20` — has this already been fixed and merged recently? (`git log origin/main --oneline -20` after a `git fetch` also catches this if local `main` is stale.)
- If the branch you're about to push already exists on `origin` with commits ahead of your local copy, fetch and inspect it (`git log <branch>..origin/<branch>`) before assuming it's yours to overwrite.

If an existing PR or recent commit already covers the issue, say so instead of duplicating the work — point to the existing PR/commit rather than opening a new one. If it's related but incomplete, prefer building on that branch/PR over starting a parallel one.

## Look for opportunities to simplify

While implementing or reviewing changes, don't stop at satisfying the immediate ask — look for adjacent simplification opportunities in the code you're touching: duplicate logic, overbuilt abstractions, stale/dead code paths, unnecessary state. Fix small ones inline; call out larger ones explicitly rather than silently expanding scope. Run the `simplify` skill (or `/code-review`) over non-trivial diffs before opening a PR.
