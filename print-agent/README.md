# Print Agent

Bridges the cloud-hosted app to a Cup Label printer on the event venue's
local network. See `../CONTEXT.md` ("Print Agent", "Print Job", "Cup Label")
and `../docs/adr/0001-local-print-agent-for-cup-labels.md` for why this
exists as a separate process instead of a server route.

On startup, if any `print_jobs` were left `pending` from a previous
session, it asks whoever is running it whether to print them now or
cancel them and start fresh - there's no automatic rule for this (a stale
backlog and one that still needs printing look identical), so it's always
a manual choice at the prompt. It then stays subscribed to new jobs via
Supabase Realtime. There is no printer feedback in v1 - a job is marked
`handed_off` once sent to the printer, not confirmed printed. A misprint
falls back to the existing manual permanent-marker process; the Kitchen
Display is unaffected either way.

Printer hardware selection and how this process actually gets deployed at
a venue (systemd/launchd, printer IP configuration, etc.) are not decided
yet - this covers the agent's core logic only.

## Running locally

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRINTER_HOST
set -a; source .env; set +a
python agent.py
```

Use the sandbox Supabase project (see the root `Makefile`'s `*-sandbox`
targets) while testing, not production.
