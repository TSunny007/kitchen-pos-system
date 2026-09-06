"use client";

import { useMemo } from "react";
import { Order, OrderItemStatus } from "../../types";
import { aggregateItemStatus, ITEM_STATUS_CONFIG } from "../../lib/orderStatus";
import { formatClockTime, formatElapsed } from "../../lib/format";
import { useElapsedMs } from "../../lib/useElapsed";

interface KitchenOrderCardProps {
  order: Order;
  onItemStatusChange?: (orderItemIds: number[], newStatus: OrderItemStatus) => void;
  filterCategoryIds?: Set<number>; // If non-empty, only show items in one of these categories
}

// Orders backfilled by the "fix stuck in_progress orders" migration got
// updated_at stamped with whenever that migration actually ran, not their
// true completion time - which can be days/weeks after created_at for
// orders from old campaigns. No real prep takes anywhere near this long,
// so treat anything past this as unreliable data rather than display it.
const MAX_PLAUSIBLE_PREP_MS = 4 * 60 * 60 * 1000; // 4 hours

export default function KitchenOrderCard({
  order,
  onItemStatusChange,
  filterCategoryIds,
}: KitchenOrderCardProps) {
  // Ticks every 30s while the order is still active; null on the first paint.
  const elapsedMs = useElapsedMs(order.created_at);
  const elapsedTime = elapsedMs === null ? null : formatElapsed(elapsedMs);

  // How long the order actually took to prep, once done - a fixed value
  // rather than a live-ticking clock, since it no longer needs to move.
  // null when the data isn't trustworthy (see MAX_PLAUSIBLE_PREP_MS above).
  const prepDuration = useMemo(() => {
    const ms = new Date(order.updated_at).getTime() - new Date(order.created_at).getTime();
    if (!Number.isFinite(ms) || ms < 0 || ms > MAX_PLAUSIBLE_PREP_MS) return null;
    return formatElapsed(ms, "<1m");
  }, [order.created_at, order.updated_at]);

  // Filter items to only show those matching the opted-in categories
  const filteredItems = useMemo(() => {
    if (!order.order_items) return [];
    if (!filterCategoryIds || filterCategoryIds.size === 0) return order.order_items;
    return order.order_items.filter(
      (item) => item.item?.category_id != null && filterCategoryIds.has(item.item.category_id)
    );
  }, [order.order_items, filterCategoryIds]);

  // Aggregate status of the filtered items (drives card color and actions)
  const aggregateStatus = useMemo(
    () => aggregateItemStatus(filteredItems),
    [filteredItems]
  );

  // Get urgency class based on elapsed time and status
  const getUrgencyClass = (): string => {
    const now = new Date();
    const created = new Date(order.created_at);
    const diffMins = Math.floor((now.getTime() - created.getTime()) / 60000);

    if (aggregateStatus === "done") return "";
    if (diffMins >= 15) return "animate-pulse ring-2 ring-error";
    if (diffMins >= 10) return "ring-2 ring-warning";
    return "";
  };

  // Handle advancing all filtered items to the next status
  const handleAdvanceStatus = () => {
    if (!onItemStatusChange || filteredItems.length === 0) return;

    const itemIds = filteredItems
      .filter((item) => item.status !== "cancelled" && item.status !== "done")
      .map((item) => item.id);

    if (itemIds.length === 0) return;

    let newStatus: OrderItemStatus;
    if (aggregateStatus === "new") {
      newStatus = "in_progress";
    } else if (aggregateStatus === "in_progress") {
      newStatus = "done";
    } else {
      return; // Already done
    }

    onItemStatusChange(itemIds, newStatus);
  };

  // Handle marking a single item as done (checkbox click)
  const handleItemDone = (itemId: number) => {
    if (!onItemStatusChange) return;
    onItemStatusChange([itemId], "done");
  };

  const statusConfig = ITEM_STATUS_CONFIG[aggregateStatus];

  // Don't render if no items match the filter
  if (filteredItems.length === 0) {
    return null;
  }

  // Tapping the whole card advances it from New straight to Preparing.
  // Preparing cards keep per-item checkboxes instead, so the card itself
  // isn't tappable there.
  const isTappableToStart = aggregateStatus === "new" && !!onItemStatusChange;

  const cardBody = (
    <>
      {/* Header - Customer name, order number, time */}
      <div className={`flex items-center justify-between rounded-t-xl px-4 py-3 ${statusConfig.bgClass}`}>
        <div>
          <h3 className={`text-lg font-bold ${statusConfig.textClass}`}>
            {order.customer_name}
          </h3>
          <p className={`text-sm ${statusConfig.textClass} opacity-80`}>
            #{order.id} • {formatClockTime(order.created_at)}
          </p>
        </div>
        {(aggregateStatus === "done" ? prepDuration : elapsedTime) && (
          <span className={`text-sm font-medium ${statusConfig.textClass}`}>
            ⏱ {aggregateStatus === "done" ? prepDuration : elapsedTime}
          </span>
        )}
      </div>

      {/* Order Items - Only showing filtered items */}
      <div className="divide-y divide-outline-variant">
          {filteredItems.map((orderItem) => {
            const itemStatusConfig = ITEM_STATUS_CONFIG[orderItem.status];
            const isInProgress = orderItem.status === "in_progress";
            const isDone = orderItem.status === "done";

            return (
              <div
                key={orderItem.id}
                className={`px-4 py-3 ${isDone ? "bg-primary-container/20" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox only for in_progress items */}
                  {isInProgress && onItemStatusChange && (
                    <button
                      onClick={() => handleItemDone(orderItem.id)}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-secondary bg-surface text-secondary transition-all hover:bg-secondary hover:text-on-secondary active:scale-95"
                      title="Mark as ready"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    {/* Item name with status indicator */}
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-semibold ${isDone ? "text-primary" : "text-on-surface"}`}>
                        {orderItem.item?.name || "Unknown item"}
                      </p>
                      {/* Individual item status badge */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${itemStatusConfig.bgClass} ${itemStatusConfig.textClass}`}
                      >
                        {itemStatusConfig.label}
                      </span>
                    </div>

                    {/* Modifiers - displayed as a list below item name */}
                    {orderItem.modifiers && orderItem.modifiers.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 pl-1">
                        {orderItem.modifiers.map((mod) => (
                          <li
                            key={mod.id}
                            className={`flex items-center gap-1.5 text-sm ${isDone ? "text-primary/70" : "text-on-surface-variant"}`}
                          >
                            <span className={isDone ? "text-primary" : "text-secondary"}>→</span>
                            <span className="font-medium">{mod.label || "Modifier"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {/* Notes */}
                    {orderItem.notes && (
                      <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
                        isDone
                          ? "bg-primary-container/50 text-on-primary-container"
                          : "bg-tertiary-container text-on-tertiary-container"
                      }`}>
                        📝 {orderItem.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer - Status actions or completion time. New cards have no
          footer - the whole card is the "start preparing" affordance. */}
      {aggregateStatus === "done" && (
        <div className="flex items-center justify-between border-t border-outline-variant p-3">
          <span className="text-sm text-on-surface-variant">
            Ordered: {formatClockTime(order.created_at)}
          </span>
          <span className="text-sm font-medium text-primary">
            Completed: {formatClockTime(order.updated_at)}
          </span>
        </div>
      )}
      {aggregateStatus === "in_progress" && onItemStatusChange && (
        <div className="flex items-center justify-end gap-2 border-t border-outline-variant p-3">
          <span className="text-sm text-on-surface-variant">
            {filteredItems.filter(i => i.status === "done").length}/{filteredItems.length} ready
          </span>
        </div>
      )}
    </>
  );

  const cardClassName = `rounded-xl border-2 ${statusConfig.borderClass} bg-surface-container-low shadow-[var(--md-elevation-1)] transition-all ${getUrgencyClass()}`;

  // New cards render as a real <button> so the "start preparing" action is
  // keyboard/switch-device accessible (focusable, Enter/Space-operable) for
  // free, instead of a div faking button behavior via onClick alone.
  if (isTappableToStart) {
    return (
      <button
        type="button"
        onClick={handleAdvanceStatus}
        className={`block w-full text-left ${cardClassName} cursor-pointer hover:shadow-[var(--md-elevation-2)] active:scale-[0.99]`}
      >
        {cardBody}
      </button>
    );
  }

  return <div className={cardClassName}>{cardBody}</div>;
}
