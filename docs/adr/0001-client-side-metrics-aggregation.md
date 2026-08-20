---
status: accepted
---

# Compute Campaign metrics client-side, not via Postgres views/RPCs

The Metrics page needs several real group-bys over a Campaign's Order Items — by item, by Timeslot, by modifier, by category — and a real alternative was to push these aggregations into Postgres as views or RPC functions, similar to the existing `decrement_campaign_item_stock` RPC. We chose client-side JS aggregation instead (fetch Order Items, `reduce` in the browser), matching every other aggregation already in this codebase (`recalculateOrderSubtotal`, cart totals). Pop-up Campaigns are small — hundreds, not millions, of Order Items — so the performance cost is negligible today, and it avoids introducing a second architectural style for aggregation.

Revisit this if a Campaign's order volume ever makes client-side aggregation noticeably slow; at that point the group-bys should move into SQL views or RPCs rather than being optimized further in JS.
