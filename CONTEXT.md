# Kitchen POS

A point-of-sale system for pop-up food events. Staff take orders on a Terminal view and fulfill them on a Kitchen Display view, scoped to a Campaign.

## Language

**Campaign**:
A single pop-up food event with its own menu (via Campaign Items), orders, and optional `starts_at`/`ends_at` window. All operational and reporting views are scoped to exactly one Campaign at a time — there is no cross-campaign aggregate view.
_Avoid_: Event, session (as a synonym for Campaign)

**Revenue**:
The sum of `base_price` plus any modifier `price_delta`, across all non-cancelled Order Items in a Campaign. Computed directly from Order Items, not from the stored `orders.subtotal` column, because `orders.subtotal` is not currently recalculated when an individual Order Item is cancelled (a known bug, tracked for a separate fix).
_Avoid_: Sales, total (without qualifying what it sums)

**Timeslot**:
A fixed-width time bucket (hourly or daily, selectable) that an Order falls into based on its `created_at` timestamp, in local (browser) time. The bucket range spans only the actual order activity within the selected Campaign, not its full `starts_at`–`ends_at` window.
_Avoid_: Slot, hour block, period

**Items Ordered**:
The count of non-cancelled Order Items in a Campaign. Since Order Items are flattened (one row per unit at `quantity = 1`), this is a row count, not a sum of a `quantity` field.

**Time to Serve**:
How long an Order Item took to reach `done` (or the legacy `picked_up` status, treated as equivalent), measured from its status-event log (`order_item_status_events`) rather than `order_items.updated_at` — `updated_at` is bumped by unrelated edits and doesn't distinguish which transition happened. For an Order, it's the latest of its non-cancelled items' done-timestamps minus the order's `created_at` — when the whole ticket cleared, not just one item. Excludes items with `no_prep_needed = true`, since those are created already `done` and have no real prep duration.
_Avoid_: Prep time, turnaround time, ticket time
