"use client";

import { useState } from "react";
import { Order, OrderItem, OrderStatus, OrderItemStatus } from "../../types";

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: number, newStatus: OrderStatus) => void;
  onItemStatusChange?: (orderItemId: number, newStatus: OrderItemStatus) => void;
  onDismiss?: (orderId: number) => void;
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
  ready: {
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

export default function OrderCard({
  order,
  onStatusChange,
  onItemStatusChange,
  onDismiss,
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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
    return formatTime(dateString);
  };

  const calculateItemPrice = (orderItem: OrderItem): number => {
    const basePrice = orderItem.item?.base_price || 0;
    const modifiersPrice = orderItem.modifiers?.reduce(
      (sum, mod) => sum + mod.price_delta,
      0
    ) || 0;
    return (basePrice + modifiersPrice) * orderItem.quantity;
  };

  const statusConfig = STATUS_CONFIG[order.status];
  const canEdit = editable && (order.status === "new" || order.status === "in_progress");
  const itemCount = order.order_items?.length || 0;
  
  // For ready orders, show pickup interface by default
  const isReadyForPickup = order.status === "ready";
  const doneItems = order.order_items?.filter((item) => item.status === "done") || [];
  const pickedUpItems = order.order_items?.filter((item) => item.status === "picked_up") || [];
  const pickupProgress = order.order_items?.length 
    ? `${pickedUpItems.length}/${order.order_items.length}`
    : "0/0";

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
            #{order.id} • {getTimeSince(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}
          >
            {statusConfig.label}
          </span>
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

      {/* Collapsed preview - show first 2 items (for non-ready orders) */}
      {!compact && !isExpanded && !isReadyForPickup && order.order_items && order.order_items.length > 0 && (
        <div className="border-t border-outline-variant px-4 py-2">
          <div className="space-y-1">
            {order.order_items.slice(0, 2).map((orderItem) => {
              const isDone = orderItem.status === "done";
              const isPickedUp = orderItem.status === "picked_up";
              return (
                <div
                  key={orderItem.id}
                  className={`flex items-center justify-between text-sm ${isPickedUp ? "line-through opacity-60" : ""}`}
                >
                  <span className={`truncate ${isDone ? "text-primary font-medium" : "text-on-surface-variant"}`}>
                    {isPickedUp ? (
                      <span className="mr-1 text-on-surface-variant">✓</span>
                    ) : isDone ? (
                      <span className="mr-1">✓</span>
                    ) : null}
                    <span className={`font-medium ${isDone ? "text-primary" : isPickedUp ? "text-on-surface-variant" : "text-on-surface"}`}>
                      {orderItem.quantity}×
                    </span>{" "}
                    {orderItem.item?.name || "Unknown item"}
                  </span>
                  <span className={`shrink-0 ${isDone ? "text-primary" : "text-on-surface-variant"}`}>
                    {formatPrice(calculateItemPrice(orderItem))}
                  </span>
                </div>
              );
            })}
            {order.order_items.length > 2 && (
              <p className="text-xs text-on-surface-variant">
                +{order.order_items.length - 2} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pickup Interface - Always visible for ready orders */}
      {!compact && isReadyForPickup && order.order_items && order.order_items.length > 0 && (
        <div className="border-t border-outline-variant bg-primary-container/20">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-2">
            <span className="text-sm font-medium text-on-surface">
              Mark items as picked up
            </span>
            <span className="text-xs text-on-surface-variant">
              {pickupProgress} picked up
            </span>
          </div>
          <div className="divide-y divide-outline-variant">
            {order.order_items.map((orderItem) => {
              const isDone = orderItem.status === "done";
              const isPickedUp = orderItem.status === "picked_up";
              
              return (
                <div
                  key={orderItem.id}
                  className={`flex items-center gap-3 px-4 py-3 ${isPickedUp ? "bg-surface-container opacity-60" : ""}`}
                >
                  {/* Checkbox for marking picked up */}
                  {isDone && onItemStatusChange ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemStatusChange(orderItem.id, "picked_up");
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-surface text-primary transition-all hover:bg-primary hover:text-on-primary active:scale-95"
                      title="Mark as picked up"
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
                  ) : isPickedUp ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant text-sm font-medium">
                      {orderItem.quantity}×
                    </span>
                  )}
                  
                  <div className="min-w-0 flex-1">
                    <span className={`font-medium ${isPickedUp ? "text-on-surface-variant line-through" : isDone ? "text-primary" : "text-on-surface"}`}>
                      {orderItem.item?.name || "Unknown item"}
                    </span>
                    {orderItem.modifiers && orderItem.modifiers.length > 0 && (
                      <div className={`text-xs ${isPickedUp ? "line-through" : ""} text-on-surface-variant`}>
                        {orderItem.modifiers.map((mod) => mod.label).join(", ")}
                      </div>
                    )}
                  </div>
                  
                  <span className={`text-sm font-medium ${isPickedUp ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
                    {formatPrice(calculateItemPrice(orderItem))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded itemized list */}
      {!compact && isExpanded && order.order_items && order.order_items.length > 0 && (
        <div className="border-t border-outline-variant">
          <div className="divide-y divide-outline-variant">
            {order.order_items.map((orderItem) => {
              const isDone = orderItem.status === "done";
              const isPickedUp = orderItem.status === "picked_up";
              
              return (
                <div
                  key={orderItem.id}
                  className={`p-4 ${canEdit ? "hover:bg-surface-container" : ""} ${isPickedUp ? "bg-surface-container opacity-60" : isDone ? "bg-primary-container/20" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      {/* Checkbox for marking picked up (done items only) */}
                      {isDone && onItemStatusChange ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemStatusChange(orderItem.id, "picked_up");
                          }}
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-surface text-primary transition-all hover:bg-primary hover:text-on-primary active:scale-95"
                          title="Mark as picked up"
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
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                      ) : isPickedUp ? (
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
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
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium bg-surface-container-high text-on-surface`}>
                          {orderItem.quantity}
                        </span>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            isDone 
                              ? "text-primary" 
                              : isPickedUp 
                                ? "text-on-surface-variant line-through" 
                                : "text-on-surface"
                          }`}>
                            {orderItem.item?.name || "Unknown item"}
                          </span>
                          {/* Item status indicator */}
                          {isDone && (
                            <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container">
                              ✓ Ready
                            </span>
                          )}
                          {isPickedUp && (
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                              Picked Up
                            </span>
                          )}
                        </div>
                    
                    {/* Modifiers */}
                    {orderItem.modifiers && orderItem.modifiers.length > 0 && (
                      <div className={`mt-1 space-y-0.5 ${isPickedUp ? "line-through" : ""}`}>
                        {orderItem.modifiers.map((mod) => (
                          <div
                            key={mod.id}
                            className={`flex items-center justify-between text-xs ${
                              isDone ? "text-primary/70" : "text-on-surface-variant"
                            }`}
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
                      <p className={`mt-1 rounded px-2 py-1 text-xs italic ${
                        isDone 
                          ? "bg-primary-container/50 text-on-primary-container"
                          : isPickedUp
                            ? "bg-surface-container-high text-on-surface-variant line-through"
                            : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        📝 {orderItem.notes}
                      </p>
                    )}
                  </div>
                </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-semibold ${isDone ? "text-primary" : "text-on-surface"} ${isPickedUp ? "line-through text-on-surface-variant" : ""}`}>
                      {formatPrice(calculateItemPrice(orderItem))}
                    </span>
                    
                    {/* Edit/Delete buttons */}
                    {canEdit && !isDone && !isPickedUp && (
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
              );
            })}
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

      {/* Footer - Total and actions */}
      <div className="flex items-center justify-between border-t border-outline-variant p-4">
        <div>
          <p className="text-xs text-on-surface-variant">Total</p>
          <span className="text-lg font-bold text-on-surface">
            {formatPrice(order.subtotal)}
          </span>
        </div>

        {/* Status change actions */}
        {showActions && (
          <div className="flex gap-2">
            {order.status === "new" && onStatusChange && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(order.id, "in_progress");
                }}
                className="rounded-full bg-secondary-container px-3 py-1.5 text-xs font-medium text-on-secondary-container transition-colors hover:bg-secondary"
              >
                Start
              </button>
            )}
            {order.status === "in_progress" && onStatusChange && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(order.id, "ready");
                }}
                className="rounded-full bg-primary-container px-3 py-1.5 text-xs font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary"
              >
                Ready
              </button>
            )}
            {order.status === "ready" && doneItems.length === 0 && (
              <span className="rounded-full bg-primary-container px-3 py-1.5 text-xs font-medium text-on-primary-container">
                ✓ All Picked Up
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
