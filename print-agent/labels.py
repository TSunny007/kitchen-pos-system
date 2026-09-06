"""Cup Label content: fetching the data for a print job and rendering it to text.

Kept separate from Supabase/printer I/O so `render_label` is testable with a
plain fixture, no live database or hardware required.
"""

from dataclasses import dataclass
from typing import Any, Sequence

from supabase._async.client import AsyncClient


@dataclass(frozen=True)
class LabelContent:
    item_name: str
    modifiers: Sequence[str]
    customer_name: str
    order_number: int


def render_label(content: LabelContent) -> str:
    lines = [content.item_name]
    for modifier in content.modifiers:
        lines.append(f"  + {modifier}")
    lines.append(f"For: {content.customer_name}")
    lines.append(f"Order #{content.order_number}")
    return "\n".join(lines)


async def fetch_label_content(client: AsyncClient, order_item_id: int) -> LabelContent:
    """Join order_items -> items, orders, order_item_modifiers for one item.

    Modifiers are already snapshotted onto order_item_modifiers at order
    time (label/price_delta captured then, not live-joined to the
    modifiers table) - see CONTEXT.md's "Print Job" entry.
    """
    response = await (
        client.table("order_items")
        .select(
            "order_id,"
            "item:items(name),"
            "modifiers:order_item_modifiers(label),"
            "order:orders(customer_name)"
        )
        .eq("id", order_item_id)
        .single()
        .execute()
    )
    row: dict[str, Any] = response.data
    return LabelContent(
        item_name=row["item"]["name"],
        modifiers=[m["label"] for m in row.get("modifiers") or []],
        customer_name=row["order"]["customer_name"],
        order_number=row["order_id"],
    )
