"use client";

import { useState, useMemo, useEffect } from "react";
import { Item, Category, Campaign } from "../../types";

// Native <select> options are rendered by the OS on some platforms (e.g.
// iPadOS's picker wheel), which ignores CSS text-transform entirely - so
// category names are capitalized in the actual string, not just via CSS.
function capitalizeWords(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ManageCampaignItemsModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  allItems: Item[];
  campaignItemIds: Set<number>;
  itemStocks: Map<number, number | null>;
  categories: Category[];
  onClose: () => void;
  onToggleItem: (itemId: number, isCurrentlyLinked: boolean) => Promise<void>;
  onUpdateStock: (itemId: number, stock: number | null) => Promise<void>;
}

export default function ManageCampaignItemsModal({
  isOpen,
  campaign,
  allItems,
  campaignItemIds,
  itemStocks,
  categories,
  onClose,
  onToggleItem,
  onUpdateStock,
}: ManageCampaignItemsModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingItemIds, setLoadingItemIds] = useState<Set<number>>(new Set());

  // Local stock input state: item_id → string (allows empty for "no limit")
  const [stockInputs, setStockInputs] = useState<Map<number, string>>(new Map());
  const [savingStockIds, setSavingStockIds] = useState<Set<number>>(new Set());

  // Sync stock inputs when modal opens or itemStocks changes
  useEffect(() => {
    if (isOpen) {
      const inputs = new Map<number, string>();
      for (const [itemId, stock] of itemStocks) {
        inputs.set(itemId, stock != null ? String(stock) : "");
      }
      setStockInputs(inputs);
    }
  }, [isOpen, itemStocks]);

  // Group items by category for the category filter count
  const itemsByCategory = useMemo(() => {
    const grouped: Record<number, Item[]> = {};
    for (const item of allItems) {
      if (!grouped[item.category_id]) grouped[item.category_id] = [];
      grouped[item.category_id].push(item);
    }
    return grouped;
  }, [allItems]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (selectedCategoryId !== null) {
      items = items.filter((item) => item.category_id === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      );
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems, selectedCategoryId, searchQuery]);

  const handleToggle = async (itemId: number) => {
    const isLinked = campaignItemIds.has(itemId);
    setLoadingItemIds((prev) => new Set([...prev, itemId]));
    try {
      await onToggleItem(itemId, isLinked);
    } finally {
      setLoadingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleSelectAll = async () => {
    const unlinkedItems = filteredItems.filter((item) => !campaignItemIds.has(item.id));
    for (const item of unlinkedItems) await handleToggle(item.id);
  };

  const handleDeselectAll = async () => {
    const linkedItems = filteredItems.filter((item) => campaignItemIds.has(item.id));
    for (const item of linkedItems) await handleToggle(item.id);
  };

  const handleStockInputChange = (itemId: number, value: string) => {
    setStockInputs((prev) => new Map(prev).set(itemId, value));
  };

  const handleStockSave = async (itemId: number) => {
    const rawValue = (stockInputs.get(itemId) ?? "").trim();
    const stock = rawValue === "" ? null : parseInt(rawValue, 10);

    if (rawValue !== "" && (isNaN(stock!) || stock! < 0)) return;

    const currentStock = itemStocks.get(itemId) ?? null;
    if (stock === currentStock) return;

    setSavingStockIds((prev) => new Set([...prev, itemId]));
    try {
      await onUpdateStock(itemId, stock);
    } finally {
      setSavingStockIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const linkedCount = filteredItems.filter((item) => campaignItemIds.has(item.id)).length;
  const totalCount = filteredItems.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-surface-container-lowest shadow-[var(--md-elevation-3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant p-6">
          <div>
            <h2 className="text-xl font-semibold text-on-surface">
              Manage Campaign Items
            </h2>
            {campaign && (
              <p className="mt-1 text-sm text-on-surface-variant">
                {campaign.name} • {linkedCount} of {totalCount} items selected
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-outline-variant p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full bg-surface-container py-2 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="relative">
              <select
                value={selectedCategoryId ?? ""}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="appearance-none rounded-full bg-surface-container py-2 pl-4 pr-8 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {capitalizeWords(cat.name)} ({itemsByCategory[cat.id]?.length ?? 0})
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={linkedCount === totalCount}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={linkedCount === 0}
              className="rounded-full bg-surface-container px-4 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-on-surface-variant">
              No items found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isLinked = campaignItemIds.has(item.id);
                const isLoading = loadingItemIds.has(item.id);
                const isSavingStock = savingStockIds.has(item.id);
                const category = categories.find((c) => c.id === item.category_id);
                const stockValue = stockInputs.get(item.id) ?? "";

                return (
                  <div
                    key={item.id}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 transition-colors ${
                      isLinked
                        ? "bg-primary-container"
                        : "bg-surface-container"
                    } ${isLoading ? "opacity-50" : ""}`}
                  >
                    {/* Toggle area */}
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      disabled={isLoading}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left"
                    >
                      {/* Checkbox */}
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                          isLinked ? "border-primary bg-primary" : "border-outline"
                        }`}
                      >
                        {isLinked && (
                          <svg className="h-4 w-4 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isLinked ? "text-on-primary-container" : "text-on-surface"}`}>
                            {item.name}
                          </span>
                          {item.no_prep_needed && (
                            <span className="rounded bg-tertiary-container px-1.5 py-0.5 text-xs text-on-tertiary-container">
                              No Prep
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={isLinked ? "text-on-primary-container/70" : "text-on-surface-variant"}>
                            {category?.name ?? "Unknown"}
                          </span>
                          <span className={isLinked ? "text-on-primary-container/70" : "text-on-surface-variant"}>•</span>
                          <span className={isLinked ? "text-on-primary-container/70" : "text-on-surface-variant"}>
                            ${item.base_price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Stock input — only for linked items */}
                    {isLinked && (
                      <div className="shrink-0 flex items-center gap-1.5">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={stockValue}
                            onChange={(e) => handleStockInputChange(item.id, e.target.value)}
                            onBlur={() => handleStockSave(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleStockSave(item.id);
                            }}
                            placeholder="∞"
                            title="Stock count (leave blank for no limit)"
                            className="w-16 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-center text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                          />
                          {isSavingStock && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/80">
                              <svg className="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Loading spinner for toggle */}
                    {isLoading && (
                      <svg className="h-5 w-5 shrink-0 animate-spin text-primary" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant p-4">
          <p className="mb-3 text-center text-xs text-on-surface-variant">
            Stock field: enter a number to limit quantity, leave blank for no limit
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-primary py-3 font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
