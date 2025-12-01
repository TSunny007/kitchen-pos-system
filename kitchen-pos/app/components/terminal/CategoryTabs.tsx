"use client";

import { useState } from "react";
import { Category } from "../../types";

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
  onDeleteCategory?: (categoryId: number) => Promise<boolean>;
  itemCountByCategory?: Record<number, number>;
}

export default function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
  onDeleteCategory,
  itemCountByCategory = {},
}: CategoryTabsProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order
  );

  const handleDeleteCategory = async (categoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirmDeleteId !== categoryId) {
      setConfirmDeleteId(categoryId);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    
    if (!onDeleteCategory) return;
    
    setIsDeleting(true);
    try {
      await onDeleteCategory(categoryId);
      setConfirmDeleteId(null);
    } catch (err) {
      alert("Cannot delete category: it may have active items linked to it.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border-b border-outline-variant bg-surface-container-low">
      <div className="flex gap-1 overflow-x-auto px-4">
        {/* All Items Tab */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`relative whitespace-nowrap px-6 py-4 text-sm font-medium transition-colors ${
            selectedCategory === null
              ? "text-primary"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          All Items
          {selectedCategory === null && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
          )}
        </button>

        {/* Category Tabs */}
        {sortedCategories.map((category) => {
          const isSelected = selectedCategory?.id === category.id;
          const isConfirming = confirmDeleteId === category.id;
          const itemCount = itemCountByCategory[category.id] ?? 0;
          const hasNoItems = itemCount === 0;
          
          return (
            <div key={category.id} className="relative flex items-center">
              <button
                onClick={() => onSelectCategory(category)}
                className={`relative whitespace-nowrap px-6 py-4 text-sm font-medium transition-colors ${
                  isSelected
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {category.name}
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
                )}
              </button>
              
              {/* Delete button - show when category is selected and has no items */}
              {isSelected && onDeleteCategory && hasNoItems && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCategory(category.id, e)}
                  disabled={isDeleting}
                  className={`-ml-2 mr-2 rounded-full p-1.5 transition-colors ${
                    isConfirming
                      ? "bg-error text-on-error"
                      : "text-error/70 hover:bg-error-container hover:text-error"
                  } disabled:opacity-50`}
                  title={isConfirming ? "Click again to confirm delete" : "Delete empty category"}
                >
                  {isDeleting ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
