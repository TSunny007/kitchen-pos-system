"use client";

import { useCallback } from "react";
import { Order, OrderItem, OrderStatus, OrderItemStatus } from "../../types";
import OrderCard from "./OrderCard";

interface RecentOrdersProps {
  orders: Order[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onStatusChange?: (orderId: number, newStatus: OrderStatus) => void;
  onItemStatusChange?: (orderItemId: number, newStatus: OrderItemStatus) => void;
  onRefresh?: () => void;
  onEditItem?: (orderItem: OrderItem) => void;
  onDeleteItem?: (orderItemId: number) => void;
  editable?: boolean;
}

export default function RecentOrders({
  orders,
  isLoading,
  hasMore,
  onLoadMore,
  onStatusChange,
  onItemStatusChange,
  onRefresh,
  onEditItem,
  onDeleteItem,
  editable = false,
}: RecentOrdersProps) {
  // Handle scroll to bottom to load more
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const nearBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 100;

      if (nearBottom && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  if (orders.length === 0 && !isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-16 w-16 text-outline-variant"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="mt-4 text-on-surface-variant">No recent orders</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Orders will appear here once submitted
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-4 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Refresh button */}
      {onRefresh && (
        <div className="flex justify-end border-b border-outline-variant px-4 py-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      )}

      {/* Orders list */}
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onStatusChange={onStatusChange}
            onItemStatusChange={onItemStatusChange}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
            showActions={!!onStatusChange}
            editable={editable}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* End of list indicator */}
        {!hasMore && orders.length > 0 && (
          <p className="py-4 text-center text-xs text-on-surface-variant">
            No more orders
          </p>
        )}
      </div>
    </div>
  );
}
