"use client";

import { useState, useEffect, useMemo } from "react";
import { Order, OrderItem, OrderItemStatus } from "../../types";

interface KitchenItemCardProps {
  order: Order;
  orderItem: OrderItem;
  onStatusChange?: (orderItemId: number, newStatus: OrderItemStatus) => void;
}

// Orders backfilled by the "fix stuck in_progress orders" migration got
// updated_at stamped with whenever that migration actually ran, not their
// true completion time - which can be days/weeks after created_at for
// orders from old campaigns. No real prep takes anywhere near this long,
// so treat anything past this as unreliable data rather than display it.
const MAX_PLAUSIBLE_PREP_MS = 4 * 60 * 60 * 1000; // 4 hours

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

// One card per order item - each item moves through New / Preparing / Ready
// independently, rather than a single card grouping every item on an order.
export default function KitchenItemCard({
  order,
  orderItem,
  onStatusChange,
}: KitchenItemCardProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("");

  const formatDuration = (ms: number, justNowLabel = "Just now"): string => {
    const diffMins = Math.floor(ms / 60000);
    if (diffMins < 1) return justNowLabel;
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  };

  // Update elapsed time every 30 seconds while the item is still active
  useEffect(() => {
    const updateElapsed = () => {
      setElapsedTime(formatDuration(Date.now() - new Date(orderItem.created_at).getTime()));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);

    return () => clearInterval(interval);
  }, [orderItem.created_at]);

  // How long the item actually took to prep, once done - a fixed value
  // rather than a live-ticking clock, since it no longer needs to move.
  // null when the data isn't trustworthy (see MAX_PLAUSIBLE_PREP_MS above).
  const prepDuration = useMemo(() => {
    const ms = new Date(orderItem.updated_at).getTime() - new Date(orderItem.created_at).getTime();
    if (!Number.isFinite(ms) || ms < 0 || ms > MAX_PLAUSIBLE_PREP_MS) return null;
    return formatDuration(ms, "<1m");
  }, [orderItem.created_at, orderItem.updated_at]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isDone = orderItem.status === "done";

  // Get urgency class based on elapsed time and status
  const getUrgencyClass = (): string => {
    if (isDone) return "";
    const now = new Date();
    const created = new Date(orderItem.created_at);
    const diffMins = Math.floor((now.getTime() - created.getTime()) / 60000);
    if (diffMins >= 15) return "animate-pulse ring-2 ring-error";
    if (diffMins >= 10) return "ring-2 ring-warning";
    return "";
  };

  // Get card border color based on item status
  const getCardBorderClass = (): string => {
    switch (orderItem.status) {
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

  // Get header background based on item status. New uses the same header
  // color as Preparing - the card's border still tells the two apart -
  // since tertiary-container was blending into the item body below it.
  const getHeaderBgClass = (): string => {
    switch (orderItem.status) {
      case "new":
      case "in_progress":
        return "bg-secondary-container";
      case "done":
        return "bg-primary-container";
      default:
        return "bg-surface-container-high";
    }
  };

  const getHeaderTextClass = (): string => {
    switch (orderItem.status) {
      case "new":
      case "in_progress":
        return "text-on-secondary-container";
      case "done":
        return "text-on-primary-container";
      default:
        return "text-on-surface-variant";
    }
  };

  // Tapping a New card starts it preparing; tapping a Preparing card marks
  // it ready. Done cards have no further action.
  const handleAdvance = () => {
    if (!onStatusChange) return;
    if (orderItem.status === "new") {
      onStatusChange(orderItem.id, "in_progress");
    } else if (orderItem.status === "in_progress") {
      onStatusChange(orderItem.id, "done");
    }
  };

  const isTappable =
    !!onStatusChange && (orderItem.status === "new" || orderItem.status === "in_progress");

  const cardBody = (
    <>
      {/* Header - Order number, timer, customer name */}
      <div className={`rounded-t-xl px-4 py-3 ${getHeaderBgClass()}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs opacity-70 ${getHeaderTextClass()}`}>
            Order #{order.campaign_order_number ?? order.id}
          </span>
          {(!isDone || prepDuration) && (
            <span className={`flex items-center gap-1 text-xs ${getHeaderTextClass()}`}>
              <ClockIcon className="h-3.5 w-3.5" />
              {isDone ? prepDuration : elapsedTime}
            </span>
          )}
        </div>
        <div className="mt-2 border-t border-outline-variant pt-2">
          <h3 className={`text-base font-bold ${getHeaderTextClass()}`}>
            {order.customer_name}
          </h3>
        </div>
      </div>

      {/* Item - name and modifiers */}
      <div className="px-4 py-3">
        <p className={`text-xl font-semibold ${isDone ? "text-primary" : "text-on-surface"}`}>
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

      {/* Footer - completion time, done items only */}
      {isDone && (
        <div className="flex items-center justify-between border-t border-outline-variant p-3">
          <span className="text-sm text-on-surface-variant">
            Ordered: {formatTime(orderItem.created_at)}
          </span>
          <span className="text-sm font-medium text-primary">
            Completed: {formatTime(orderItem.updated_at)}
          </span>
        </div>
      )}
    </>
  );

  const cardClassName = `rounded-xl border-2 ${getCardBorderClass()} bg-surface-container-low shadow-[var(--md-elevation-1)] transition-all ${getUrgencyClass()}`;

  // Tappable cards render as a real <button> so the "advance status" action
  // is keyboard/switch-device accessible (focusable, Enter/Space-operable)
  // for free, instead of a div faking button behavior via onClick alone.
  if (isTappable) {
    return (
      <button
        type="button"
        onClick={handleAdvance}
        className={`block w-full text-left ${cardClassName} cursor-pointer hover:shadow-[var(--md-elevation-2)] active:scale-[0.99]`}
      >
        {cardBody}
      </button>
    );
  }

  return <div className={cardClassName}>{cardBody}</div>;
}
