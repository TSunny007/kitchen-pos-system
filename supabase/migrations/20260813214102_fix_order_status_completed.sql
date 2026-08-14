-- Fix orders.status lifecycle: 'completed' was never a valid value.
--
-- orders_status_check (from the initial migration) has only ever allowed
-- 'new', 'in_progress', 'ready', 'picked_up', 'cancelled' - 'completed' was
-- never added, even though updateOrderStatusFromItems() in app code has
-- always computed and attempted to write it once all of an order's items
-- are done. Every such write has been silently rejected by this constraint
-- (the app doesn't check the update's error), so orders have stuck at
-- 'in_progress' indefinitely instead of ever reaching a terminal state.
-- getKitchenOrders() filters on status IN ('new','in_progress'), so this
-- also meant fully-done orders never dropped out of that query.
--
-- 'ready'/'picked_up' at the order level are a separate legacy lifecycle
-- the app stopped using entirely (last written 2026-01-31); they represent
-- fulfilled orders and are folded into 'completed' here too.

-- Backfill: legacy order_items 'picked_up' -> 'done' first. 0 rows use it
-- in production today (confirmed before writing this migration), but this
-- keeps the migration idempotent/safe to run against any environment where
-- that might not hold. Must run before the orders backfill below, since an
-- order's completeness is derived from its items' statuses.
update public.order_items
set status = 'done', updated_at = now()
where status = 'picked_up';

-- Drop the old orders constraint - it doesn't allow 'completed', so the
-- backfills below would fail with a check violation if run while it's
-- still in place.
alter table public.orders drop constraint if exists orders_status_check;

-- Backfill: orders stuck at 'in_progress' whose items are all done/cancelled
-- (but not all cancelled) should have reached 'completed'.
update public.orders o
set status = 'completed', updated_at = now()
where status = 'in_progress'
  and exists (
    select 1 from public.order_items oi
    where oi.order_id = o.id
      and oi.status <> 'cancelled'
  )
  and not exists (
    select 1 from public.order_items oi
    where oi.order_id = o.id
      and oi.status not in ('done', 'cancelled')
  );

-- Backfill: legacy order-level statuses, unused since 2026-01-31.
update public.orders
set status = 'completed', updated_at = now()
where status in ('ready', 'picked_up');

-- Re-add orders.status tightened to the values the app actually uses.
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'in_progress', 'completed', 'cancelled'));

-- Tighten order_items.status: drop legacy 'picked_up' (superseded by
-- order-level completion instead of a separate item state). Safe now -
-- the backfill above already cleared any rows that had it.
alter table public.order_items drop constraint if exists order_items_status_check;
alter table public.order_items add constraint order_items_status_check
  check (status in ('new', 'in_progress', 'done', 'cancelled'));
