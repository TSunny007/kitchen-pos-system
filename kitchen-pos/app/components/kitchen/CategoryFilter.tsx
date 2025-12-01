"use client";

import { Category } from "../../types";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategories: number[];
  onCategoryToggle: (categoryId: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export default function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryToggle,
  onSelectAll,
  onClearAll,
}: CategoryFilterProps) {
  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order
  );

  const allSelected = selectedCategories.length === 0;
  const someSelected = selectedCategories.length > 0 && selectedCategories.length < categories.length;

  return (
    <div className="border-b border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
        {/* Quick actions */}
        <div className="flex shrink-0 items-center gap-1 border-r border-outline-variant pr-3">
          <button
            onClick={onSelectAll}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              allSelected
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            All
          </button>
          {selectedCategories.length > 0 && (
            <button
              onClick={onClearAll}
              className="rounded-full px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
              title="Clear filter"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-2">
          {sortedCategories.map((category) => {
            const isSelected = selectedCategories.includes(category.id);
            return (
              <button
                key={category.id}
                onClick={() => onCategoryToggle(category.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-secondary text-on-secondary shadow-[var(--md-elevation-1)]"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {category.name}
                {isSelected && (
                  <span className="ml-2">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected count indicator */}
        {someSelected && (
          <span className="shrink-0 rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
            {selectedCategories.length} selected
          </span>
        )}
      </div>
    </div>
  );
}
