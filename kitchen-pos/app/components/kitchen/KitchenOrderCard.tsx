"use client";

import { useState, useEffect, useMemo } from "react";
import { Order, OrderItemStatus } from "../../types";

interface KitchenOrderCardProps {
  order: Order;
  onItemStatusChange?: (orderItemIds: number[], newStatus: OrderItemStatus) => void;
  filterCategoryId?: number; // If set, only show items from this category
}

// Item status config for kitchen display
// Kitchen flow: new → in_progress (Preparing) → done (Ready)
// Terminal marks items as picked_up when customer picks up
const ITEM_STATUS_CONFIG: Record<OrderItemStatus, { label: string; bgClass: string; textClass: string }> = {
  new: {
    label: "New",
    bgClass: "bg-tertiary-container",
    textClass: "text-on-tertiary-container",
  },
  in_progress: {
    label: "Preparing",
    bgClass: "bg-secondary-container",
    textClass: "text-on-secondary-container",
  },
  done: {
    label: "Ready",
    bgClass: "bg-primary-container",
    textClass: "text-on-primary-container",
  },
  picked_up: {
    label: "Picked Up",
    bgClass: "bg-surface-container-high",
    textClass: "text-on-surface-variant",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-error-container",
    textClass: "text-on-error-container",
  },
};

export default function KitchenOrderCard({
  order,
  onItemStatusChange,
  filterCategoryId,
}: KitchenOrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("");

  // Update elapsed time every minute
  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const created = new Date(order.created_at);
      const diffMs = now.getTime() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) {
        setElapsedTime("Just now");
      } else if (diffMins < 60) {
        setElapsedTime(`${diffMins}m`);
      } else {
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        setElapsedTime(`${diffHours}h ${remainingMins}m`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [order.created_at]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Filter items to only show those matching the category filter
  const filteredItems = useMemo(() => {
    if (!order.order_items) return [];
    if (!filterCategoryId) return order.order_items;
    return order.order_items.filter(
      (item) => item.item?.category_id === filterCategoryId
    );
  }, [order.order_items, filterCategoryId]);

  // Compute the aggregate status of filtered items (for display and actions)
  const aggregateStatus = useMemo((): OrderItemStatus => {
    if (filteredItems.length === 0) return "new";
    
    const statuses = filteredItems.map((item) => item.status);
    const allNew = statuses.every((s) => s === "new");
    const allDone = statuses.every((s) => s === "done");
    const anyInProgress = statuses.some((s) => s === "in_progress");
    const anyDone = statuses.some((s) => s === "done");

    if (allDone) return "done";
    if (anyInProgress || anyDone) return "in_progress";
    if (allNew) return "new";
    return "new";
  }, [filteredItems]);

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
      .filter((item) => item.status !== "cancelled" && item.status !== "done" && item.status !== "picked_up")
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

  // Get card border color based on aggregate status
  const getCardBorderClass = (): string => {
    switch (aggregateStatus) {
      case "new":
        return "border-tertiary";
      case "in_progress":
        return "border-secondary";
      case "done":
        return "border-primary";
      default:
        return "border-outline-variant";
    }
  };

  // Get header background based on aggregate status
  const getHeaderBgClass = (): string => {
    switch (aggregateStatus) {
      case "new":
        return "bg-tertiary-container";
      case "in_progress":
        return "bg-secondary-container";
      case "done":
        return "bg-primary-container";
      default:
        return "bg-surface-container-high";
    }
  };

  const getHeaderTextClass = (): string => {
    switch (aggregateStatus) {
      case "new":
        return "text-on-tertiary-container";
      case "in_progress":
        return "text-on-secondary-container";
      case "done":
        return "text-on-primary-container";
      default:
        return "text-on-surface-variant";
    }
  };

  // Don't render if no items match the filter
  if (filteredItems.length === 0) {
    return null;
  }

  const statusConfig = ITEM_STATUS_CONFIG[aggregateStatus];

  return (
    <div
      className={`rounded-xl border-2 ${getCardBorderClass()} bg-surface-container-low shadow-[var(--md-elevation-1)] transition-all ${getUrgencyClass()}`}
    >
      {/* Header - Customer name, order number, time */}
      <div className={`flex items-center justify-between rounded-t-xl px-4 py-3 ${getHeaderBgClass()}`}>
        <div>
          <h3 className={`text-lg font-bold ${getHeaderTextClass()}`}>
            {order.customer_name}
          </h3>
          <p className={`text-sm ${getHeaderTextClass()} opacity-80`}>
            #{order.id} • {formatTime(order.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusConfig.bgClass} ${statusConfig.textClass} ring-1 ring-current ring-opacity-20`}
          >
            {statusConfig.label}
          </span>
          <span className={`text-sm font-medium ${getHeaderTextClass()}`}>
            ⏱ {elapsedTime}
          </span>
        </div>
      </div>

      {/* Order Items - Only showing filtered items */}
      {filteredItems.length > 0 && (
        <div className="divide-y divide-outline-variant">
          {filteredItems.map((orderItem) => {
            const itemStatusConfig = ITEM_STATUS_CONFIG[orderItem.status];
            const isInProgress = orderItem.status === "in_progress";
            const isDone = orderItem.status === "done";
            const isPickedUp = orderItem.status === "picked_up";
            
            return (
              <div
                key={orderItem.id}
                className={`px-4 py-3 ${isDone || isPickedUp ? "bg-primary-container/20" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox for in_progress items OR checkmark for done items */}
                  {isInProgress && onItemStatusChange ? (
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
                  ) : isDone || isPickedUp ? (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
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
                    </span>
                  ) : (
                    /* Quantity badge for new items */
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tertiary text-sm font-bold text-on-tertiary">
                      {orderItem.quantity}×
                    </span>
                  )}
                  
                  <div className="min-w-0 flex-1">
                    {/* Item name with status indicator */}
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-semibold ${isDone ? "text-primary" : "text-on-surface"}`}>
                        {orderItem.quantity > 1 && (isDone || isInProgress) && (
                          <span className="mr-1">{orderItem.quantity}×</span>
                        )}
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
      )}

      {/* Footer - Status actions */}
      {onItemStatusChange && (
        <div className="flex items-center justify-end gap-2 border-t border-outline-variant p-3">
          {aggregateStatus === "new" && (
            <button
              onClick={handleAdvanceStatus}
              className="rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-on-secondary shadow-[var(--md-elevation-1)] transition-all hover:shadow-[var(--md-elevation-2)] active:scale-95"
            >
              Start Preparing
            </button>
          )}
          {aggregateStatus === "in_progress" && (
            <span className="text-sm text-on-surface-variant">
              {filteredItems.filter(i => i.status === "done").length}/{filteredItems.length} ready
            </span>
          )}
        </div>
      )}
    </div>
  );
}
