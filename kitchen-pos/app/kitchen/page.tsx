"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Campaign, Category, Order, OrderItemStatus } from "../types";
import {
  getCampaigns,
  getCategories,
  getKitchenOrders,
  updateMultipleOrderItemsStatus,
  subscribeToKitchenOrders,
} from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";
import CampaignSelector from "../components/terminal/CampaignSelector";
import KitchenOrderCard from "../components/kitchen/KitchenOrderCard";
import Link from "next/link";

export default function KitchenPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Load campaigns on mount
  useEffect(() => {
    if (!user) return;

    async function loadCampaigns() {
      try {
        setIsLoading(true);
        setError(null);
        const campaignsData = await getCampaigns();
        setCampaigns(campaignsData);

        // Select first active campaign by default
        const activeCampaign = campaignsData.find((c) => c.is_active);
        if (activeCampaign && !selectedCampaign) {
          setSelectedCampaign(activeCampaign);
        }
      } catch (err) {
        console.error("Error loading campaigns:", err);
        setError("Failed to load campaigns. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCampaigns();
  }, [user]);

  // Load categories and orders when campaign changes
  useEffect(() => {
    if (!user || !selectedCampaign) return;

    async function loadKitchenData() {
      try {
        const [categoriesData, ordersData] = await Promise.all([
          getCategories(),
          getKitchenOrders(selectedCampaign!.id),
        ]);

        setCategories(categoriesData);
        setOrders(ordersData);
      } catch (err) {
        console.error("Error loading kitchen data:", err);
        setError("Failed to load orders. Please try again.");
      }
    }

    loadKitchenData();
  }, [user, selectedCampaign]);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!selectedCampaign) return;

    const unsubscribe = subscribeToKitchenOrders(
      selectedCampaign.id,
      (eventType, order) => {
        setOrders((prev) => {
          // Check if order should be visible in kitchen (new, in_progress, ready)
          const isKitchenVisible = ["new", "in_progress", "ready"].includes(order.status);

          if (eventType === "INSERT") {
            // Add new order if it's kitchen-visible
            if (isKitchenVisible && !prev.find((o) => o.id === order.id)) {
              // Insert in correct position (oldest first)
              const newOrders = [...prev, order].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return newOrders;
            }
            return prev;
          } else if (eventType === "UPDATE") {
            if (isKitchenVisible) {
              // Update or add if now visible
              const exists = prev.find((o) => o.id === order.id);
              if (exists) {
                return prev.map((o) => (o.id === order.id ? order : o));
              } else {
                return [...prev, order].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              }
            } else {
              // Remove if no longer kitchen-visible (e.g., picked_up, cancelled)
              return prev.filter((o) => o.id !== order.id);
            }
          } else if (eventType === "DELETE") {
            return prev.filter((o) => o.id !== order.id);
          }
          return prev;
        });
      }
    );

    // Light backup polling every 30 seconds (in case of missed realtime events)
    const pollInterval = setInterval(async () => {
      try {
        const freshOrders = await getKitchenOrders(selectedCampaign.id);
        setOrders(freshOrders);
      } catch (err) {
        console.error("Error polling orders:", err);
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [selectedCampaign]);

  // Handle item status change (for category-filtered items)
  const handleItemStatusChange = useCallback(async (orderItemIds: number[], newStatus: OrderItemStatus) => {
    try {
      // Optimistic update - update item statuses in the UI
      setOrders((prev) => 
        prev.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
            orderItemIds.includes(item.id) ? { ...item, status: newStatus } : item
          ),
        }))
      );

      // Then persist to database
      await updateMultipleOrderItemsStatus(orderItemIds, newStatus);
      // Real-time subscription will also fire and sync any other changes
    } catch (err) {
      console.error("Error updating item status:", err);
      // On error, reload orders to get correct state
      if (selectedCampaign) {
        const ordersData = await getKitchenOrders(selectedCampaign.id);
        setOrders(ordersData);
      }
    }
  }, [selectedCampaign]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    if (!selectedCampaign) return;
    try {
      const freshOrders = await getKitchenOrders(selectedCampaign.id);
      setOrders(freshOrders);
    } catch (err) {
      console.error("Error refreshing orders:", err);
    }
  }, [selectedCampaign]);

  // Category selection handler
  const handleCategorySelect = useCallback((category: Category | null) => {
    setSelectedCategory(category);
  }, []);

  // Filter orders that have items in the selected category
  // An order is relevant if it has at least one item that matches the category
  // and that item is not yet "picked_up" (still visible in kitchen)
  const filteredOrders = useMemo(() => {
    if (!selectedCategory) return orders;

    return orders.filter((order) =>
      order.order_items?.some((item) => {
        const matchesCategory = item.item?.category_id === selectedCategory.id;
        // Include items that are not picked_up or cancelled (done items should show in Ready column)
        const isVisible = item.status !== "picked_up" && item.status !== "cancelled";
        return matchesCategory && isVisible;
      })
    );
  }, [orders, selectedCategory]);

  // Group orders by the aggregate status of items in the selected category
  // If no category selected, group by overall order status
  const ordersByItemStatus = useMemo(() => {
    const grouped: Record<"new" | "in_progress" | "done", Order[]> = {
      new: [],
      in_progress: [],
      done: [],
    };

    filteredOrders.forEach((order) => {
      if (!selectedCategory) {
        // No category filter - use overall order status
        if (order.status === "new") {
          grouped.new.push(order);
        } else if (order.status === "in_progress") {
          grouped.in_progress.push(order);
        } else if (order.status === "ready") {
          grouped.done.push(order);
        }
        return;
      }

      // Filter items to only those in the selected category
      const categoryItems = order.order_items?.filter(
        (item) => item.item?.category_id === selectedCategory.id
      ) || [];

      if (categoryItems.length === 0) return;

      // Compute aggregate status for these items
      const statuses = categoryItems.map((item) => item.status);
      const allNew = statuses.every((s) => s === "new");
      const allDone = statuses.every((s) => s === "done");
      const anyInProgress = statuses.some((s) => s === "in_progress");
      const anyDone = statuses.some((s) => s === "done");

      if (allDone) {
        grouped.done.push(order);
      } else if (anyInProgress || anyDone) {
        grouped.in_progress.push(order);
      } else if (allNew) {
        grouped.new.push(order);
      }
    });

    return grouped;
  }, [filteredOrders, selectedCategory]);

  // Count items for each status (used in column headers)
  const statusCounts = useMemo(() => {
    return {
      new: ordersByItemStatus.new.length,
      in_progress: ordersByItemStatus.in_progress.length,
      done: ordersByItemStatus.done.length,
    };
  }, [ordersByItemStatus]);

  // Loading state
  if (authLoading || isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-on-surface-variant">Loading kitchen display...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-6 py-2 text-on-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-medium text-on-surface sm:text-2xl">
              Kitchen Display
            </h1>
            <p className="text-xs text-on-surface-variant sm:text-sm">
              {filteredOrders.length} active order{filteredOrders.length !== 1 ? "s" : ""} • Live
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleRefresh}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            title="Refresh orders"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 sm:h-6 sm:w-6"
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
          </button>
          <ThemeToggle />
          <CampaignSelector
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={setSelectedCampaign}
          />
        </div>
      </header>

      {/* Category Tabs */}
      <div className="border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !selectedCategory
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            All Categories
          </button>
          {categories
            .sort((a, b) => a.display_order - b.display_order)
            .map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedCategory?.id === category.id
                    ? "bg-secondary text-on-secondary shadow-[var(--md-elevation-1)]"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {category.name}
              </button>
            ))}
        </div>
      </div>

      {/* Main Content - Order Columns by Item Status */}
      <main className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* New Items Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-tertiary-container/30">
          <div className="flex items-center justify-between border-b border-tertiary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">New</h2>
            <span className="rounded-full bg-tertiary px-2.5 py-0.5 text-sm font-medium text-on-tertiary">
              {statusCounts.new}
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {ordersByItemStatus.new.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No new orders</p>
              </div>
            ) : (
              ordersByItemStatus.new.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={handleItemStatusChange}
                  filterCategoryId={selectedCategory?.id}
                />
              ))
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-secondary-container/30">
          <div className="flex items-center justify-between border-b border-secondary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">Preparing</h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-medium text-on-secondary">
              {statusCounts.in_progress}
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {ordersByItemStatus.in_progress.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No orders in progress</p>
              </div>
            ) : (
              ordersByItemStatus.in_progress.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={handleItemStatusChange}
                  filterCategoryId={selectedCategory?.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-primary-container/30">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">Ready</h2>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-medium text-on-primary">
              {statusCounts.done}
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {ordersByItemStatus.done.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No orders ready</p>
              </div>
            ) : (
              ordersByItemStatus.done.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onItemStatusChange={handleItemStatusChange}
                  filterCategoryId={selectedCategory?.id}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
