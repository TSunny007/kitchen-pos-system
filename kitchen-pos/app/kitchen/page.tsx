"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Campaign, Category, Order, OrderItemStatus } from "../types";
import { aggregateItemStatus, ITEM_STATUS_CONFIG } from "../lib/orderStatus";
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
import Modal from "../components/Modal";
import Link from "next/link";
import { tenant } from "../config/tenant";

// Single source of truth for the swimlane columns: labels come from the
// shared status config so the headers, the toggle buttons and the kitchen
// cards can't drift apart. The column tints and empty-state copy live here
// because they're specific to this board layout.
type Swimlane = "new" | "in_progress" | "done";

const SWIMLANE_CONFIG: Record<
  Swimlane,
  { label: string; columnClass: string; dividerClass: string; badgeClass: string; emptyMessage: string }
> = {
  new: {
    label: ITEM_STATUS_CONFIG.new.label,
    columnClass: "bg-tertiary-container/30",
    dividerClass: "border-tertiary/20",
    badgeClass: "bg-tertiary text-on-tertiary",
    emptyMessage: "No new orders",
  },
  in_progress: {
    label: ITEM_STATUS_CONFIG.in_progress.label,
    columnClass: "bg-secondary-container/30",
    dividerClass: "border-secondary/20",
    badgeClass: "bg-secondary text-on-secondary",
    emptyMessage: "No orders in progress",
  },
  done: {
    label: ITEM_STATUS_CONFIG.done.label,
    columnClass: "bg-primary-container/30",
    dividerClass: "border-primary/20",
    badgeClass: "bg-primary text-on-primary",
    emptyMessage: "No orders ready",
  },
};

const SWIMLANES = Object.keys(SWIMLANE_CONFIG) as Swimlane[];

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
  // Empty set = no filter (show all categories). Non-empty = opt-in union filter.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  // Empty set = show all swimlanes/columns. Non-empty = opt-in union filter.
  const [selectedSwimlanes, setSelectedSwimlanes] = useState<Set<Swimlane>>(new Set());
  const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);

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

        // Default to the first active campaign, without disturbing a
        // selection the user has already made.
        const activeCampaign = campaignsData.find((c) => c.is_active);
        if (activeCampaign) {
          setSelectedCampaign((current) => current ?? activeCampaign);
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
          // Check if order should be visible in kitchen (new, in_progress, completed -
          // 'completed' is the "Ready" state; excluding it would make orders
          // disappear from the kitchen display the moment they're fully done)
          const isKitchenVisible = ["new", "in_progress", "completed"].includes(order.status);

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
              // Remove if no longer kitchen-visible (e.g., completed, cancelled)
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

  // Category selection handler - toggles a category in/out of the opt-in set
  const handleCategoryToggle = useCallback((categoryId: number) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleClearCategoryFilter = useCallback(() => {
    setSelectedCategoryIds(new Set());
  }, []);

  // Swimlane selection handler - toggles which status columns are shown
  const handleSwimlaneToggle = useCallback((status: Swimlane) => {
    setSelectedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const handleClearSwimlaneFilter = useCallback(() => {
    setSelectedSwimlanes(new Set());
  }, []);

  const isSwimlaneVisible = (status: Swimlane) =>
    selectedSwimlanes.size === 0 || selectedSwimlanes.has(status);

  // Shown as a badge on the Display Options button, since its current
  // filter state isn't otherwise visible until the modal is opened.
  const activeFilterCount = selectedCategoryIds.size + selectedSwimlanes.size;

  // Filter orders that have items in one of the selected categories
  // An order is relevant if it has at least one non-cancelled item that matches any selected category
  const filteredOrders = useMemo(() => {
    if (selectedCategoryIds.size === 0) return orders;

    return orders.filter((order) =>
      order.order_items?.some((item) => {
        const matchesCategory =
          item.item?.category_id != null && selectedCategoryIds.has(item.item.category_id);
        return matchesCategory && item.status !== "cancelled";
      })
    );
  }, [orders, selectedCategoryIds]);

  // Group orders by the aggregate status of items in the selected categories
  // If no categories selected, group by aggregate status of ALL items (not order status)
  const ordersByItemStatus = useMemo(() => {
    const grouped: Record<Swimlane, Order[]> = {
      new: [],
      in_progress: [],
      done: [],
    };

    filteredOrders.forEach((order) => {
      // Get items to consider - all items if no categories selected, or just items in a selected category
      // Also filter out cancelled items
      const relevantItems = selectedCategoryIds.size > 0
        ? order.order_items?.filter(
            (item) => item.item?.category_id != null &&
                      selectedCategoryIds.has(item.item.category_id) &&
                      item.status !== "cancelled"
          ) || []
        : order.order_items?.filter(
           (item) => item.status !== "cancelled"
          ) || [];

      if (relevantItems.length === 0) return;

      grouped[aggregateItemStatus(relevantItems)].push(order);
    });

    // Sort done orders by updated_at (most recently completed first)
    grouped.done.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return grouped;
  }, [filteredOrders, selectedCategoryIds]);

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
              {tenant.stations.kitchen.heading}
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
          <button
            onClick={() => setIsDisplayOptionsOpen(true)}
            className="relative flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high sm:px-4"
            title="Display options"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
              />
            </svg>
            <span className="hidden sm:inline">Display Options</span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                {activeFilterCount}
              </span>
            )}
          </button>
          <ThemeToggle />
          <CampaignSelector
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={setSelectedCampaign}
          />
        </div>
      </header>

      {/* Main Content - Order Columns by Item Status */}
      <main className="flex flex-1 gap-4 overflow-x-auto p-4">
        {SWIMLANES.filter(isSwimlaneVisible).map((status) => {
          const { label, columnClass, dividerClass, badgeClass, emptyMessage } =
            SWIMLANE_CONFIG[status];
          const columnOrders = ordersByItemStatus[status];

          return (
            <div
              key={status}
              className={`flex min-w-[300px] flex-1 flex-col rounded-xl sm:min-w-[320px] ${columnClass}`}
            >
              <div className={`flex items-center justify-between border-b px-4 py-3 ${dividerClass}`}>
                <h2 className="font-semibold text-on-surface">{label}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${badgeClass}`}>
                  {columnOrders.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {columnOrders.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-on-surface-variant">
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                ) : (
                  columnOrders.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onItemStatusChange={handleItemStatusChange}
                      filterCategoryIds={selectedCategoryIds}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Display Options Modal - mounted only while open, like every other
          modal in the app, so it can't hold stale state between opens. */}
      {isDisplayOptionsOpen && (
      <Modal
        onClose={() => setIsDisplayOptionsOpen(false)}
        title="Display Options"
        panelClassName="max-h-[90vh] max-w-lg overflow-y-auto"
      >
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-on-surface-variant">Categories</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleClearCategoryFilter}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCategoryIds.size === 0
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  All Categories
                </button>
                {[...categories]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.id)}
                      aria-pressed={selectedCategoryIds.has(category.id)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        selectedCategoryIds.has(category.id)
                          ? "bg-secondary text-on-secondary shadow-[var(--md-elevation-1)]"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-on-surface-variant">Stages</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleClearSwimlaneFilter}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    selectedSwimlanes.size === 0
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  All Stages
                </button>
                {SWIMLANES.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleSwimlaneToggle(status)}
                    aria-pressed={selectedSwimlanes.has(status)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      selectedSwimlanes.has(status)
                        ? "bg-secondary text-on-secondary shadow-[var(--md-elevation-1)]"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {SWIMLANE_CONFIG[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
              onClick={() => setIsDisplayOptionsOpen(false)}
              className="mt-6 w-full rounded-full bg-primary py-3 text-base font-medium text-on-primary transition-all hover:shadow-[var(--md-elevation-1)]"
            >
              Done
            </button>
          <button
            onClick={() => setIsDisplayOptionsOpen(false)}
            className="mt-6 w-full rounded-full bg-primary py-3 text-base font-medium text-on-primary transition-all hover:shadow-[var(--md-elevation-1)]"
          >
            Done
          </button>
        </div>
      </Modal>
      )}
    </div>
  );
}
