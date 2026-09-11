"use client";

import { Item } from "../../types";
import { BoxIcon, PlusIcon } from "../icons";
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
          <BoxIcon className="mx-auto h-16 w-16 text-outline-variant" />
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
          <PlusIcon className="mb-2 h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.5} />
          <span className="text-sm font-medium">Add Item</span>
        </button>
      )}
    </div>
  );
}
