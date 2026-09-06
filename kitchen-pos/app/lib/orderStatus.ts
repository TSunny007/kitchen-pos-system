import type { OrderItemStatus } from "@/app/types";

/** The three kitchen-facing states an order can aggregate to. */
export type AggregateStatus = Extract<
  OrderItemStatus,
  "new" | "in_progress" | "done"
>;

/**
 * Roll a set of order items up into a single status.
 *
 * Cancelled items are ignored - an order is judged only on the work that still
 * has to happen. Returns "new" for an empty/all-cancelled set, which callers
 * that care about that case (the order-level writer) check separately.
 *
 * Rules: all done -> done; otherwise any work started or finished ->
 * in_progress; otherwise new.
 */
export function aggregateItemStatus(
  items: { status: OrderItemStatus }[]
): AggregateStatus {
  const active = items.filter((i) => i.status !== "cancelled");
  if (active.length === 0) return "new";
  if (active.every((i) => i.status === "done")) return "done";
  if (active.some((i) => i.status === "in_progress" || i.status === "done")) {
    return "in_progress";
  }
  return "new";
}

/**
 * Presentation for each item status. Single source of truth for the kitchen
 * card and the swimlane headers - these used to be three parallel switch
 * statements plus a separate label table.
 */
export const ITEM_STATUS_CONFIG: Record<
  OrderItemStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  new: {
    label: "New",
    bgClass: "bg-tertiary-container",
    textClass: "text-on-tertiary-container",
    borderClass: "border-tertiary",
  },
  in_progress: {
    label: "Preparing",
    bgClass: "bg-secondary-container",
    textClass: "text-on-secondary-container",
    borderClass: "border-secondary",
  },
  done: {
    label: "Ready",
    bgClass: "bg-primary-container",
    textClass: "text-on-primary-container",
    borderClass: "border-primary",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-error-container",
    textClass: "text-on-error-container",
    borderClass: "border-outline-variant",
  },
};
