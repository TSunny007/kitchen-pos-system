"use client";

import { Item } from "../../types";
import ItemCard from "./ItemCard";

interface ItemGridProps {
  items: Item[];
  onItemClick: (item: Item) => void;
  onAddItemClick?: () => void;
}

export default function ItemGrid({ items, onItemClick, onAddItemClick }: ItemGridProps) {
  if (items.length === 0 && !onAddItemClick) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-16 w-16 text-outline-variant"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="mt-4 text-on-surface-variant">No items available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onClick={() => onItemClick(item)} />
      ))}
      
      {/* Add Item Card */}
      {onAddItemClick && (
        <button
          onClick={onAddItemClick}
          className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container/50 p-4 text-on-surface-variant transition-all hover:border-primary hover:bg-surface-container hover:text-primary sm:min-h-[160px]"
        >
          <svg
            className="mb-2 h-8 w-8 sm:h-10 sm:w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span className="text-sm font-medium">Add Item</span>
        </button>
      )}
    </div>
  );
}
