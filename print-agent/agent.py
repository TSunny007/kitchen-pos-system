"""Print Agent entrypoint.

Runs on the event venue's local network, bridging the cloud-hosted app to
the physical Cup Label printer (see docs/adr/0001-local-print-agent-for-cup-labels.md).

On startup, if any print_jobs were left 'pending' from a previous session,
asks whoever is running this script whether to print them now or cancel
them and start fresh - there's no way to tell a stale backlog (printer was
off, event's over) from one that still needs to be worked through, so this
is never decided automatically. Then it subscribes to Realtime INSERT
events on print_jobs for everything going forward. No printer ack in v1: a
job is marked 'handed_off' once sent to the printer, never confirmed
printed - see CONTEXT.md.
"""

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

from supabase import create_async_client
from supabase._async.client import AsyncClient

from labels import fetch_label_content, render_label
from printer import CupLabelPrinter


async def process_job(client: AsyncClient, printer: CupLabelPrinter, job: dict[str, Any]) -> None:
    content = await fetch_label_content(client, job["order_item_id"])
    printer.print_label(render_label(content))
    await (
        client.table("print_jobs")
        .update(
            {
                "status": "handed_off",
                "handed_off_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", job["id"])
        .execute()
    )


async def cancel_jobs(client: AsyncClient, job_ids: list[int]) -> None:
    await (
        client.table("print_jobs")
        .update({"status": "cancelled"})
        .in_("id", job_ids)
        .execute()
    )


async def resolve_pending_backlog(client: AsyncClient, printer: CupLabelPrinter) -> None:
    response = await (
        client.table("print_jobs")
        .select("id, order_item_id")
        .eq("status", "pending")
        .order("created_at")
        .execute()
    )
    jobs = response.data
    if not jobs:
        return

    answer = input(
        f"{len(jobs)} pending print job(s) from a previous session. "
        "Print them now, or cancel them and start fresh? [print/cancel]: "
    ).strip().lower()

    if answer.startswith("c"):
        await cancel_jobs(client, [job["id"] for job in jobs])
    else:
        for job in jobs:
            await process_job(client, printer, job)


async def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    printer_host = os.environ["PRINTER_HOST"]
    printer_port = int(os.environ.get("PRINTER_PORT", "9100"))

    client = await create_async_client(supabase_url, supabase_key)
    printer = CupLabelPrinter(printer_host, printer_port)

    await resolve_pending_backlog(client, printer)

    def on_insert(payload: dict[str, Any]) -> None:
        job = payload["data"]["record"]
        asyncio.create_task(process_job(client, printer, job))

    channel = client.channel("print-jobs")
    channel.on_postgres_changes(
        "INSERT", schema="public", table="print_jobs", callback=on_insert
    )
    await channel.subscribe()

    await asyncio.Event().wait()  # keep the process alive


if __name__ == "__main__":
    asyncio.run(main())
