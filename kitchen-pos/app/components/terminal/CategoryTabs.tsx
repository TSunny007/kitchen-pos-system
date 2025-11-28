"use client";

import { Category } from "../../types";

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: Category | null;
  onSelectCategory: (category: Category | null) => void;
}

export default function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order
  );

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
        {sortedCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category)}
            className={`relative whitespace-nowrap px-6 py-4 text-sm font-medium transition-colors ${
              selectedCategory?.id === category.id
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {category.name}
            {selectedCategory?.id === category.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
