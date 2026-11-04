-- Backfill: orders whose items are all done but whose status never said so.
--
-- createOrder() used to insert every order as 'new', including ones made only
-- of no_prep_needed items, which are born with every item already 'done'. The
-- app only rolls an order up to 'completed' when the kitchen changes one of its
-- items, and nobody ever does for these, so they stayed 'new' forever. (Orders
-- that mix no-prep and prep items were never affected: ticking off the prep
-- items rolls them up as usual.) createOrder() now starts such orders as
-- 'completed'; this brings the existing ones in line, using the same rule as
-- updateOrderStatusFromItems(): at least one item that isn't cancelled, and
-- every one of those is done.
--
-- updated_at is deliberately left alone. The terminal shows it as the time the
-- order was completed and the kitchen derives how long it took from it, and
-- stamping these with the time this migration ran (as the earlier status
-- backfill did) would give months-old orders a completion time of today.
--
-- Idempotent: once an order is 'completed' it no longer matches.
update public.orders o
set status = 'completed'
where o.status in ('new', 'in_progress')
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
