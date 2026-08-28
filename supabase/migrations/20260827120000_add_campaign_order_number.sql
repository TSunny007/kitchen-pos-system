-- Order numbers shown in the UI ("Order #7") use orders.id directly, which
-- is one identity sequence shared across every campaign - so a brand new
-- campaign's first order never starts at 1, it just continues wherever
-- the global sequence happened to be. Add a per-campaign order number
-- that starts at 1 for each campaign and increments from there instead.

-- Running counter per campaign. Incremented via a row-level UPDATE (which
-- Postgres serializes per row), so two orders placed for the same campaign
-- at the same time can't be handed the same number.
alter table public.campaigns
  add column if not exists next_order_number integer not null default 1;

alter table public.orders
  add column if not exists campaign_order_number integer;

-- Backfill existing orders: number them 1..N per campaign, oldest first.
-- Orders with no campaign_id are left unnumbered - there's no campaign to
-- scope them to, and the app already falls back to orders.id for those.
with numbered as (
  select id, row_number() over (
    partition by campaign_id order by created_at, id
  ) as rn
  from public.orders
  where campaign_id is not null
)
update public.orders o
set campaign_order_number = numbered.rn
from numbered
where o.id = numbered.id;

-- Seed each campaign's counter past its highest backfilled order number,
-- so the next real order continues the sequence instead of restarting at 1.
update public.campaigns c
set next_order_number = coalesce(
  (select max(campaign_order_number) + 1 from public.orders where campaign_id = c.id),
  1
);

-- Assign campaign_order_number automatically on insert, so app code never
-- has to compute or pass it (and can't race another insert to do so).
create or replace function public.set_campaign_order_number()
returns trigger as $$
begin
  if new.campaign_id is not null then
    update public.campaigns
    set next_order_number = next_order_number + 1
    where id = new.campaign_id
    returning next_order_number - 1 into new.campaign_order_number;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_campaign_order_number on public.orders;
create trigger orders_set_campaign_order_number
  before insert on public.orders
  for each row
  execute function public.set_campaign_order_number();
