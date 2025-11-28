"use client";

import { Item } from "../../types";

interface ItemCardProps {
  item: Item;
  onClick: () => void;
}

export default function ItemCard({ item, onClick }: ItemCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-low transition-all hover:shadow-[var(--md-elevation-2)] active:scale-[0.98]"
    >
      {/* Image placeholder */}
      <div className="relative aspect-square w-full bg-surface-container">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-outline-variant transition-colors group-hover:text-primary"
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
          </div>
        )}
        {/* Quick add indicator */}
        <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-sm font-medium text-on-surface line-clamp-2">
          {item.name}
        </h3>
        <p className="mt-1 text-sm font-semibold text-primary">
          {formatPrice(item.base_price)}
        </p>
      </div>
    </button>
  );
}
