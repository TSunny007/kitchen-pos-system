"use client";

import { useState } from "react";
import { Order, OrderItem } from "../../types";
import { formatCurrency, formatPriceDelta, formatClockTime, formatTimeSince } from "../../lib/format";
import { useElapsedMs } from "../../lib/useElapsed";
import { lineTotal } from "../../lib/pricing";
import { ChevronDownIcon, CheckIcon, TrashIcon } from "../icons";

interface OrderCardProps {
  order: Order;
  onEditItem?: (orderItem: OrderItem) => void;
  onDeleteItem?: (orderItemId: number) => void;
  editable?: boolean;
}

export default function OrderCard({
  order,
  onEditItem,
  onDeleteItem,
  editable = false,
}: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const elapsedMs = useElapsedMs(order.created_at);
  const timeSince =
    elapsedMs === null ? null : formatTimeSince(order.created_at, elapsedMs);

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
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-on-surface">
              {order.customer_name}
            </h3>
            {itemCount > 0 && (
              <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            #{order.id}
            {timeSince && ` • ${timeSince}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {itemCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Collapsed preview - show first 3 items */}
      {!isExpanded && order.order_items && order.order_items.length > 0 && (
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
                  {formatCurrency(lineTotal(orderItem.item?.base_price || 0, orderItem.modifiers ?? [], orderItem.quantity))}
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
      {isExpanded && order.order_items && order.order_items.length > 0 && (
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
                        <CheckIcon className="h-4 w-4" strokeWidth={3} />
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
                                <span>{formatPriceDelta(mod.price_delta)}</span>
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
                      {formatCurrency(lineTotal(orderItem.item?.base_price || 0, orderItem.modifiers ?? [], orderItem.quantity))}
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
                            <TrashIcon className="h-4 w-4" />
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

      {/* Footer - Total and times */}
      <div className="flex items-center justify-between border-t border-outline-variant p-4">
        <div>
          <p className="text-xs text-on-surface-variant">Total</p>
          <span className="text-lg font-bold text-on-surface">
            {formatCurrency(order.subtotal)}
          </span>
        </div>

        {/* Time info */}
        <div className="text-right text-xs text-on-surface-variant">
          <p>Ordered: {formatClockTime(order.created_at)}</p>
          {/* `updated_at` is typed non-optional, but a partial realtime payload
              can still arrive without it, and formatClockTime renders "—" for
              an unparseable date. Omit the line rather than show "Completed: —". */}
          {isCompleted && order.updated_at && (
            <p className="text-primary font-medium">Completed: {formatClockTime(order.updated_at)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
