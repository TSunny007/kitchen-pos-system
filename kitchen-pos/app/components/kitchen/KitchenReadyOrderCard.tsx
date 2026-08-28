"use client";

import { useState, useEffect } from "react";
import { Order, OrderItem } from "../../types";

interface KitchenReadyOrderCardProps {
  order: Order;
  items: OrderItem[]; // Relevant (non-cancelled, category-filtered) items for this order
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 11 15" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <line x1="5.5" y1="10" x2="5.5" y2="6" stroke="currentColor" />
      <line x1="6" y1="9.5" x2="9" y2="9.5" stroke="currentColor" />
      <line x1="5.5" y1="4" x2="5.5" y2="1" stroke="currentColor" />
      <circle cx="5.5" cy="9.5" r="5" stroke="currentColor" />
      <line x1="3" y1="0.5" x2="8" y2="0.5" stroke="currentColor" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// One card per order, listing every item on that order together - the
// expo/assembly view. Each item shows a cross until it's marked done
// (from its own card in the New/Preparing swimlanes), then a check.
export default function KitchenReadyOrderCard({ order, items }: KitchenReadyOrderCardProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("");

  useEffect(() => {
    const updateElapsed = () => {
      const diffMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
      if (diffMins < 1) {
        setElapsedTime("Just now");
      } else if (diffMins < 60) {
        setElapsedTime(`${diffMins}m`);
      } else {
        setElapsedTime(`${Math.floor(diffMins / 60)}h ${diffMins % 60}m`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  return (
    <div className="rounded-xl border-2 border-outline-variant bg-surface-container-low shadow-[var(--md-elevation-1)]">
      {/* Header - Order number, timer, customer name */}
      <div className="rounded-t-xl bg-surface-container-high px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-on-surface-variant opacity-70">
            Order #{order.campaign_order_number ?? order.id}
          </span>
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            <ClockIcon className="h-3.5 w-3.5" />
            {elapsedTime}
          </span>
        </div>
        <div className="mt-2 border-t border-outline-variant pt-2">
          <h3 className="text-base font-bold text-on-surface">{order.customer_name}</h3>
        </div>
      </div>

      {/* Items - each row separated by the same gray divider as the header */}
      <div className="divide-y divide-outline-variant">
        {items.map((orderItem) => {
          const isDone = orderItem.status === "done";
          return (
            <div key={orderItem.id} className="flex items-start gap-3 px-4 py-3">
              {isDone ? (
                <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <CrossIcon className="mt-0.5 h-5 w-5 shrink-0 text-error" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-base font-semibold ${isDone ? "text-primary" : "text-on-surface"}`}>
                  {orderItem.item?.name || "Unknown item"}
                </p>

                {orderItem.modifiers && orderItem.modifiers.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {orderItem.modifiers.map((mod) => (
                      <li
                        key={mod.id}
                        className={`text-sm font-medium ${isDone ? "text-primary/70" : "text-on-surface-variant"}`}
                      >
                        {mod.label || "Modifier"}
                      </li>
                    ))}
                  </ul>
                ) : null}

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
          );
        })}
      </div>
    </div>
  );
}
