"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Campaign, Category, Order, OrderItem, OrderItemStatus } from "../types";
import {
  getCampaigns,
  getCategories,
  getKitchenOrders,
  updateMultipleOrderItemsStatus,
  subscribeToKitchenOrders,
} from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";
import CampaignSelector from "../components/terminal/CampaignSelector";
import KitchenItemCard from "../components/kitchen/KitchenItemCard";
import KitchenReadyOrderCard from "../components/kitchen/KitchenReadyOrderCard";
import Link from "next/link";

// Single source of truth for swimlane labels, shared by the column headers
// and the toggle buttons below so they can't drift out of sync.
const SWIMLANE_CONFIG: Record<"new" | "in_progress" | "done", { label: string }> = {
  new: { label: "New" },
  in_progress: { label: "Preparing" },
  done: { label: "Ready" },
};

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
  // Ready starts hidden - it's opt-in via the slider on the right edge of
  // the screen, not shown by default like New/Preparing.
  const [selectedSwimlanes, setSelectedSwimlanes] = useState<Set<"new" | "in_progress" | "done">>(
    new Set(["new", "in_progress"])
  );
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
  const handleSwimlaneToggle = useCallback((status: "new" | "in_progress" | "done") => {
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

  const isSwimlaneVisible = (status: "new" | "in_progress" | "done") =>
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

  // A single order item paired with its parent order, for rendering one
  // card per item instead of one card per order.
  type ItemCardEntry = { order: Order; orderItem: OrderItem };

  // Group individual order items by their own status (not the order's
  // aggregate status), optionally restricted to the selected categories.
  // Each item gets its own card in New/Preparing and moves independently.
  // Done items aren't grouped here - see readyOrderCards below, since the
  // Ready column groups by order instead of by item.
  const itemsByStatus = useMemo(() => {
    const grouped: Record<"new" | "in_progress", ItemCardEntry[]> = {
      new: [],
      in_progress: [],
    };

    orders.forEach((order) => {
      const relevantItems = (order.order_items || []).filter((item) => {
        if (item.status === "cancelled") return false;
        if (selectedCategoryIds.size === 0) return true;
        return item.item?.category_id != null && selectedCategoryIds.has(item.item.category_id);
      });

      relevantItems.forEach((orderItem) => {
        if (orderItem.status === "new" || orderItem.status === "in_progress") {
          grouped[orderItem.status].push({ order, orderItem });
        }
      });
    });

    // Oldest first, so the longest-waiting items surface at the top
    grouped.new.sort(
      (a, b) => new Date(a.orderItem.created_at).getTime() - new Date(b.orderItem.created_at).getTime()
    );
    grouped.in_progress.sort(
      (a, b) => new Date(a.orderItem.created_at).getTime() - new Date(b.orderItem.created_at).getTime()
    );

    return grouped;
  }, [orders, selectedCategoryIds]);

  // Ready column: one card per order, grouping every item on that order
  // together (checked off individually as it's marked done elsewhere)
  // rather than one card per item. An order only appears once at least one
  // of its items is fulfilled - otherwise it'd just be a wall of red
  // crosses cluttering the column before anything's actually ready.
  const readyOrderCards = useMemo(() => {
    const cards: { order: Order; items: OrderItem[] }[] = [];

    orders.forEach((order) => {
      const relevantItems = (order.order_items || []).filter((item) => {
        if (item.status === "cancelled") return false;
        if (selectedCategoryIds.size === 0) return true;
        return item.item?.category_id != null && selectedCategoryIds.has(item.item.category_id);
      });

      const hasFulfilledItem = relevantItems.some((item) => item.status === "done");

      if (relevantItems.length > 0 && hasFulfilledItem) {
        cards.push({ order, items: relevantItems });
      }
    });

    // Oldest order first
    cards.sort((a, b) => new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime());

    return cards;
  }, [orders, selectedCategoryIds]);

  // Count cards for each column header badge
  const statusCounts = useMemo(() => {
    return {
      new: itemsByStatus.new.length,
      in_progress: itemsByStatus.in_progress.length,
      done: readyOrderCards.length,
    };
  }, [itemsByStatus, readyOrderCards]);

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
        {/* New Items Column */}
        {isSwimlaneVisible("new") && (
        <div className="flex min-w-[300px] flex-1 flex-col rounded-xl bg-tertiary-container/30 sm:min-w-[320px]">
          <div className="flex items-center justify-between border-b border-tertiary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">{SWIMLANE_CONFIG.new.label}</h2>
            <span className="rounded-full bg-tertiary px-2.5 py-0.5 text-sm font-medium text-on-tertiary">
              {statusCounts.new}
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {itemsByStatus.new.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No new orders</p>
              </div>
            ) : (
              itemsByStatus.new.map(({ order, orderItem }) => (
                <KitchenItemCard
                  key={orderItem.id}
                  order={order}
                  orderItem={orderItem}
                  onStatusChange={(orderItemId, newStatus) =>
                    handleItemStatusChange([orderItemId], newStatus)
                  }
                />
              ))
            )}
          </div>
        </div>
        )}

        {/* In Progress Column - always a 2-across layout. Cards are split
            left/right by index (0=left, 1=right, 2=left, ...) so reading
            order goes left-to-right then down, like a grid - but each
            column is its own independent flex stack (not a CSS grid row),
            so a card never stretches to match a taller neighbor next to it. */}
        {isSwimlaneVisible("in_progress") && (
        <div className="flex min-w-[300px] flex-[2] flex-col rounded-xl bg-secondary-container/30 sm:min-w-[600px]">
          <div className="flex items-center justify-between border-b border-secondary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">{SWIMLANE_CONFIG.in_progress.label}</h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-medium text-on-secondary">
              {statusCounts.in_progress}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {itemsByStatus.in_progress.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No orders in progress</p>
              </div>
            ) : (
              <div className="flex gap-3">
                {[0, 1].map((columnIndex) => (
                  <div key={columnIndex} className="flex flex-1 flex-col gap-3">
                    {itemsByStatus.in_progress
                      .filter((_, i) => i % 2 === columnIndex)
                      .map(({ order, orderItem }) => (
                        <KitchenItemCard
                          key={orderItem.id}
                          order={order}
                          orderItem={orderItem}
                          onStatusChange={(orderItemId, newStatus) =>
                            handleItemStatusChange([orderItemId], newStatus)
                          }
                        />
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Ready Column */}
        {isSwimlaneVisible("done") && (
        <div className="flex min-w-[300px] flex-1 flex-col rounded-xl bg-primary-container/30 sm:min-w-[320px]">
          <div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
            <h2 className="font-semibold text-on-surface">{SWIMLANE_CONFIG.done.label}</h2>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-medium text-on-primary">
              {statusCounts.done}
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {readyOrderCards.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-on-surface-variant">
                <p className="text-sm">No active orders</p>
              </div>
            ) : (
              readyOrderCards.map(({ order, items }) => (
                <KitchenReadyOrderCard key={order.id} order={order} items={items} />
              ))
            )}
          </div>
        </div>
        )}
      </main>

      {/* Ready column visibility toggle - Ready starts hidden to reduce
          clutter, so this arrow tab on the right edge is the fast path
          to reveal it without opening the full Display Options modal.
          Points left (pull in) when hidden, right (push away) when shown. */}
      <button
        type="button"
        aria-pressed={isSwimlaneVisible("done")}
        aria-label={isSwimlaneVisible("done") ? "Hide Ready column" : "Show Ready column"}
        title={isSwimlaneVisible("done") ? "Hide Ready column" : "Show Ready column"}
        onClick={() => handleSwimlaneToggle("done")}
        className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center justify-center rounded-l-2xl bg-surface-container-high p-3 shadow-[var(--md-elevation-2)] transition-colors hover:bg-surface-container-highest"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-on-surface-variant"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isSwimlaneVisible("done") ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
          />
        </svg>
      </button>

      {/* Display Options Modal */}
      {isDisplayOptionsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDisplayOptionsOpen(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface-container-lowest p-6 shadow-[var(--md-elevation-3)] sm:rounded-3xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-on-surface">Display Options</h2>
              <button
                onClick={() => setIsDisplayOptionsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

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
                  {categories
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        aria-pressed={selectedCategoryIds.has(category.id)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium capitalize transition-all ${
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
                  {(Object.keys(SWIMLANE_CONFIG) as Array<"new" | "in_progress" | "done">).map((status) => (
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
          </div>
        </div>
      )}
    </div>
  );
}
