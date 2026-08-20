import { supabase } from "./client";
import type { OrderItemStatus, OrderStatus } from "@/app/types";

export type TimeslotGranularity = "hour" | "day";

// Legacy status value, predating 'done', that still shows up in older rows.
const DONE_STATUSES = new Set(["done", "picked_up"]);

interface MetricsStatusEvent {
  new_status: string;
  created_at: string;
}

interface MetricsModifier {
  modifier_id: number | null;
  label: string;
  price_delta: number;
}

interface MetricsItem {
  id: number;
  name: string;
  base_price: number;
  no_prep_needed: boolean;
  category: { id: number; name: string } | null;
}

interface MetricsOrderItem {
  id: number;
  item_id: number;
  status: OrderItemStatus;
  created_at: string;
  item: MetricsItem | null;
  modifiers: MetricsModifier[];
  status_events: MetricsStatusEvent[];
}

interface MetricsOrder {
  id: number;
  created_at: string;
  status: OrderStatus;
  order_items: MetricsOrderItem[];
}

/**
 * Fetch everything the Metrics page needs for one campaign in a single
 * round trip: orders, their items, each item's modifiers, and each item's
 * full status-event history (needed for Time to Serve — see computeCampaignMetrics).
 */
export async function getCampaignOrdersForMetrics(
  campaignId: number
): Promise<MetricsOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      status,
      order_items (
        id,
        item_id,
        status,
        created_at,
        item:items ( id, name, base_price, no_prep_needed, category:categories ( id, name ) ),
        modifiers:order_item_modifiers ( modifier_id, label, price_delta ),
        status_events:order_item_status_events ( new_status, created_at )
      )
    `
    )
    .eq("campaign_id", campaignId);

  if (error) {
    console.error("Error fetching campaign orders for metrics:", error);
    throw error;
  }

  return (data || []) as unknown as MetricsOrder[];
}

/**
 * A single day if it fits on one calendar day (local time), otherwise
 * bucket by day rather than defaulting every multi-day campaign to hourly.
 */
export function inferDefaultGranularity(
  orders: MetricsOrder[]
): TimeslotGranularity {
  const days = new Set(
    orders
      .filter((order) => order.status !== "cancelled")
      .map((order) => new Date(order.created_at).toDateString())
  );
  return days.size > 1 ? "day" : "hour";
}

export interface RevenueByItemRow {
  itemId: number;
  itemName: string;
  quantity: number;
  baseRevenue: number;
  modifierRevenue: number;
  revenue: number;
}

export interface RevenueByModifierRow {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
}

export interface RevenueByCategoryRow {
  categoryId: number | null;
  categoryName: string;
  itemsOrdered: number;
  revenue: number;
}

export interface TimeToServeByItemRow {
  itemId: number;
  itemName: string;
  samples: number;
  avgSeconds: number;
}

export interface TimeslotRow {
  key: string;
  label: string;
  start: Date;
  itemsOrdered: number;
  revenue: number;
  topItem: { itemName: string; quantity: number } | null;
  avgTimeToServeSeconds: number | null;
}

export interface CampaignMetrics {
  granularity: TimeslotGranularity;
  orderCount: number;
  itemsOrdered: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageTimeToServeSeconds: number | null;
  averageOrderCompletionSeconds: number | null;
  busiestTimeslot: TimeslotRow | null;
  revenueByItem: RevenueByItemRow[];
  revenueByModifier: RevenueByModifierRow[];
  revenueByCategory: RevenueByCategoryRow[];
  timeToServeByItem: TimeToServeByItemRow[];
  timeslots: TimeslotRow[];
}

function firstDoneTimestamp(events: MetricsStatusEvent[]): number | null {
  const doneTimes = events
    .filter((event) => DONE_STATUSES.has(event.new_status))
    .map((event) => new Date(event.created_at).getTime());
  return doneTimes.length > 0 ? Math.min(...doneTimes) : null;
}

function bucketFor(
  date: Date,
  granularity: TimeslotGranularity
): { key: string; label: string; start: Date } {
  if (granularity === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      key: start.toISOString(),
      label: start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      start,
    };
  }
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours()
  );
  return {
    key: start.toISOString(),
    label: start.toLocaleTimeString(undefined, { hour: "numeric" }),
    start,
  };
}

interface TimeslotAccumulator extends TimeslotRow {
  itemCounts: Map<number, { itemName: string; quantity: number }>;
  totalTimeToServeSeconds: number;
  timeToServeSamples: number;
}

/**
 * Every aggregation the Metrics page shows, computed in one pass over a
 * campaign's orders. Pure function — no network calls — so it stays easy
 * to reason about and (if it's ever worth it) test independently of Supabase.
 *
 * Revenue and item counts are computed straight from Order Items, not the
 * stored `orders.subtotal`, because that column isn't recalculated when an
 * item is individually cancelled (see docs/adr and CONTEXT.md — Revenue).
 */
export function computeCampaignMetrics(
  orders: MetricsOrder[],
  granularity: TimeslotGranularity
): CampaignMetrics {
  const activeOrders = orders.filter((order) => order.status !== "cancelled");

  let totalRevenue = 0;
  let itemsOrdered = 0;
  let timeToServeTotalSeconds = 0;
  let timeToServeSamples = 0;
  let orderCompletionTotalSeconds = 0;
  let orderCompletionSamples = 0;

  const revenueByItem = new Map<number, RevenueByItemRow>();
  const revenueByModifier = new Map<string, RevenueByModifierRow>();
  const revenueByCategory = new Map<string, RevenueByCategoryRow>();
  const timeToServeByItem = new Map<
    number,
    { itemName: string; totalSeconds: number; samples: number }
  >();
  const timeslots = new Map<string, TimeslotAccumulator>();

  for (const order of activeOrders) {
    const orderDate = new Date(order.created_at);
    const bucket = bucketFor(orderDate, granularity);

    let slot = timeslots.get(bucket.key);
    if (!slot) {
      slot = {
        key: bucket.key,
        label: bucket.label,
        start: bucket.start,
        itemsOrdered: 0,
        revenue: 0,
        topItem: null,
        avgTimeToServeSeconds: null,
        itemCounts: new Map(),
        totalTimeToServeSeconds: 0,
        timeToServeSamples: 0,
      };
      timeslots.set(bucket.key, slot);
    }

    const activeItems = order.order_items.filter(
      (orderItem) => orderItem.status !== "cancelled"
    );

    // Order-level completion time deliberately includes no_prep_needed items in the
    // "did everything finish" check (an all-no-prep order really does complete
    // instantly) even though they're excluded from the per-item metric below,
    // where an instant duration would just be noise.
    if (activeItems.length > 0) {
      const doneTimes = activeItems.map((orderItem) =>
        firstDoneTimestamp(orderItem.status_events)
      );
      if (doneTimes.every((time): time is number => time !== null)) {
        const latestDone = Math.max(...doneTimes);
        orderCompletionTotalSeconds +=
          (latestDone - orderDate.getTime()) / 1000;
        orderCompletionSamples += 1;
      }
    }

    for (const orderItem of activeItems) {
      const item = orderItem.item;
      if (!item) continue;

      const modifierRevenue = orderItem.modifiers.reduce(
        (sum, modifier) => sum + modifier.price_delta,
        0
      );
      const lineRevenue = item.base_price + modifierRevenue;

      totalRevenue += lineRevenue;
      itemsOrdered += 1;

      slot.itemsOrdered += 1;
      slot.revenue += lineRevenue;
      const slotItem = slot.itemCounts.get(item.id) ?? {
        itemName: item.name,
        quantity: 0,
      };
      slotItem.quantity += 1;
      slot.itemCounts.set(item.id, slotItem);

      const itemRow = revenueByItem.get(item.id) ?? {
        itemId: item.id,
        itemName: item.name,
        quantity: 0,
        baseRevenue: 0,
        modifierRevenue: 0,
        revenue: 0,
      };
      itemRow.quantity += 1;
      itemRow.baseRevenue += item.base_price;
      itemRow.modifierRevenue += modifierRevenue;
      itemRow.revenue += lineRevenue;
      revenueByItem.set(item.id, itemRow);

      for (const modifier of orderItem.modifiers) {
        const modifierKey =
          modifier.modifier_id != null
            ? `id:${modifier.modifier_id}`
            : `label:${modifier.label}`;
        const modifierRow = revenueByModifier.get(modifierKey) ?? {
          key: modifierKey,
          label: modifier.label,
          quantity: 0,
          revenue: 0,
        };
        modifierRow.quantity += 1;
        modifierRow.revenue += modifier.price_delta;
        revenueByModifier.set(modifierKey, modifierRow);
      }

      const categoryKey = item.category ? String(item.category.id) : "uncategorized";
      const categoryRow = revenueByCategory.get(categoryKey) ?? {
        categoryId: item.category?.id ?? null,
        categoryName: item.category?.name ?? "Uncategorized",
        itemsOrdered: 0,
        revenue: 0,
      };
      categoryRow.itemsOrdered += 1;
      categoryRow.revenue += lineRevenue;
      revenueByCategory.set(categoryKey, categoryRow);

      if (!item.no_prep_needed) {
        const doneTime = firstDoneTimestamp(orderItem.status_events);
        if (doneTime !== null) {
          const seconds =
            (doneTime - new Date(orderItem.created_at).getTime()) / 1000;

          timeToServeTotalSeconds += seconds;
          timeToServeSamples += 1;

          const itemTimeRow = timeToServeByItem.get(item.id) ?? {
            itemName: item.name,
            totalSeconds: 0,
            samples: 0,
          };
          itemTimeRow.totalSeconds += seconds;
          itemTimeRow.samples += 1;
          timeToServeByItem.set(item.id, itemTimeRow);

          slot.totalTimeToServeSeconds += seconds;
          slot.timeToServeSamples += 1;
        }
      }
    }
  }

  const timeslotRows: TimeslotRow[] = Array.from(timeslots.values())
    .map((slot) => {
      let topItem: { itemName: string; quantity: number } | null = null;
      for (const candidate of slot.itemCounts.values()) {
        if (!topItem || candidate.quantity > topItem.quantity) topItem = candidate;
      }
      return {
        key: slot.key,
        label: slot.label,
        start: slot.start,
        itemsOrdered: slot.itemsOrdered,
        revenue: slot.revenue,
        topItem,
        avgTimeToServeSeconds:
          slot.timeToServeSamples > 0
            ? slot.totalTimeToServeSeconds / slot.timeToServeSamples
            : null,
      };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const busiestTimeslot = timeslotRows.reduce<TimeslotRow | null>(
    (busiest, row) =>
      row.itemsOrdered > 0 && (!busiest || row.itemsOrdered > busiest.itemsOrdered)
        ? row
        : busiest,
    null
  );

  return {
    granularity,
    orderCount: activeOrders.length,
    itemsOrdered,
    totalRevenue,
    averageOrderValue:
      activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0,
    averageTimeToServeSeconds:
      timeToServeSamples > 0 ? timeToServeTotalSeconds / timeToServeSamples : null,
    averageOrderCompletionSeconds:
      orderCompletionSamples > 0
        ? orderCompletionTotalSeconds / orderCompletionSamples
        : null,
    busiestTimeslot,
    revenueByItem: Array.from(revenueByItem.values()).sort(
      (a, b) => b.revenue - a.revenue
    ),
    revenueByModifier: Array.from(revenueByModifier.values()).sort(
      (a, b) => b.revenue - a.revenue
    ),
    revenueByCategory: Array.from(revenueByCategory.values()).sort(
      (a, b) => b.revenue - a.revenue
    ),
    timeToServeByItem: Array.from(timeToServeByItem.entries())
      .map(([itemId, row]) => ({
        itemId,
        itemName: row.itemName,
        samples: row.samples,
        avgSeconds: row.totalSeconds / row.samples,
      }))
      .sort((a, b) => b.avgSeconds - a.avgSeconds),
    timeslots: timeslotRows,
  };
}
