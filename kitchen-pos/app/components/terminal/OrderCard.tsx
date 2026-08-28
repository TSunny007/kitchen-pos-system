"use client";

import { useState } from "react";
import { Order, OrderItem, OrderStatus } from "../../types";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: number, newStatus: OrderStatus) => void;
  onEditItem?: (orderItem: OrderItem) => void;
  onDeleteItem?: (orderItemId: number) => void;
  showActions?: boolean;
  compact?: boolean;
  editable?: boolean;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bgClass: string; textClass: string }> = {
  new: {
    label: "New",
    bgClass: "bg-tertiary-container",
    textClass: "text-on-tertiary-container",
  },
  in_progress: {
    label: "In Progress",
    bgClass: "bg-secondary-container",
    textClass: "text-on-secondary-container",
  },
  completed: {
    label: "Completed",
    bgClass: "bg-primary-container",
    textClass: "text-on-primary-container",
  },
  cancelled: {
    label: "Cancelled",
    bgClass: "bg-error-container",
    textClass: "text-on-error-container",
  },
};

export default function OrderCard({
  order,
  onStatusChange,
  onEditItem,
  onDeleteItem,
  showActions = false,
  compact = false,
  editable = false,
}: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return created.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateItemPrice = (orderItem: OrderItem): number => {
    const basePrice = orderItem.item?.base_price || 0;
    const modifiersPrice = orderItem.modifiers?.reduce(
      (sum, mod) => sum + mod.price_delta,
      0
    ) || 0;
    return (basePrice + modifiersPrice) * orderItem.quantity;
  };

  // Fallback for legacy statuses that may still exist in the database
  const statusConfig = STATUS_CONFIG[order.status] || {
    label: order.status,
    bgClass: "bg-surface-container-high",
    textClass: "text-on-surface-variant",
  };
  const canEdit = editable && (order.status === "new" || order.status === "in_progress");
  const itemCount = order.order_items?.length || 0;
  
  // Check if order is completed (all items are done)
  const isCompleted = order.status === "completed" || 
    (order.order_items && order.order_items.length > 0 && 
     order.order_items.every(item => item.status === "done" || item.status === "cancelled"));

  return (
    <div className="group rounded-xl border border-outline-variant bg-surface-container-low transition-all hover:border-outline hover:shadow-[var(--md-elevation-1)]">
      {/* Header - Customer name and status badge */}
      <div
        className="flex cursor-pointer items-start justify-between gap-2 p-4"
        onClick={() => !compact && setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-on-surface">
              {order.customer_name}
            </h3>
            {!compact && itemCount > 0 && (
              <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            #{order.campaign_order_number ?? order.id} • {getTimeSince(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!compact && itemCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Collapsed preview - show first 3 items */}
      {!compact && !isExpanded && order.order_items && order.order_items.length > 0 && (
        <div className="border-t border-outline-variant px-4 py-2">
          <div className="space-y-1">
            {order.order_items.slice(0, 3).map((orderItem) => (
              <div
                key={orderItem.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate text-on-surface">
                  {orderItem.item?.name || "Unknown item"}
                  {orderItem.modifiers && orderItem.modifiers.length > 0 && (
                    <span className="ml-1 text-on-surface-variant">
                      ({orderItem.modifiers.map(m => m.label).join(", ")})
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-on-surface-variant">
                  {formatPrice(calculateItemPrice(orderItem))}
                </span>
              </div>
            ))}
            {order.order_items.length > 3 && (
              <p className="text-xs text-on-surface-variant">
                +{order.order_items.length - 3} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expanded itemized list */}
      {!compact && isExpanded && order.order_items && order.order_items.length > 0 && (
        <div className="border-t border-outline-variant">
          <div className="divide-y divide-outline-variant">
            {order.order_items.map((orderItem) => (
              <div
                key={orderItem.id}
                className={`p-4 ${canEdit ? "hover:bg-surface-container" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                      orderItem.status === "done" ? "bg-primary text-on-primary" : 
                      orderItem.status === "in_progress" ? "bg-secondary text-on-secondary" :
                      "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {orderItem.status === "done" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : orderItem.status === "in_progress" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </span>
                      
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-on-surface">
                        {orderItem.item?.name || "Unknown item"}
                      </span>
                    
                      {/* Modifiers */}
                      {orderItem.modifiers && orderItem.modifiers.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {orderItem.modifiers.map((mod) => (
                            <div
                              key={mod.id}
                              className="flex items-center justify-between text-xs text-on-surface-variant"
                            >
                              <span>+ {mod.label}</span>
                              {mod.price_delta !== 0 && (
                                <span>{formatPrice(mod.price_delta)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    
                      {/* Notes */}
                      {orderItem.notes && (
                        <p className="mt-1 rounded bg-surface-container-high px-2 py-1 text-xs italic text-on-surface-variant">
                          📝 {orderItem.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-on-surface">
                      {formatPrice(calculateItemPrice(orderItem))}
                    </span>
                    
                    {/* Edit/Delete buttons */}
                    {canEdit && (
                      <div className="flex gap-1">
                        {onEditItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditItem(orderItem);
                            }}
                            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                            title="Edit item"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        )}
                        {onDeleteItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Remove this item from the order?")) {
                                onDeleteItem(orderItem.id);
                              }
                            }}
                            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                            title="Remove item"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact view - just item count */}
      {compact && order.order_items && (
        <div className="px-4 pb-4">
          <p className="text-sm text-on-surface-variant">
            {order.order_items.length} item{order.order_items.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Footer - Total and times */}
      <div className="flex items-center justify-between border-t border-outline-variant p-4">
        <div>
          <p className="text-xs text-on-surface-variant">Total</p>
          <span className="text-lg font-bold text-on-surface">
            {formatPrice(order.subtotal)}
          </span>
        </div>

        {/* Time info */}
        <div className="text-right text-xs text-on-surface-variant">
          <p>Ordered: {formatTime(order.created_at)}</p>
          {isCompleted && order.updated_at && (
            <p className="text-primary font-medium">Completed: {formatTime(order.updated_at)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
