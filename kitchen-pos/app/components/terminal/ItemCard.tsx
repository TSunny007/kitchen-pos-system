"use client";

import { Item } from "../../types";
import { formatCurrency } from "../../lib/format";
import { BoxIcon, PlusIcon } from "../icons";

interface ItemCardProps {
  item: Item;
  onClick: () => void;
}

export default function ItemCard({ item, onClick }: ItemCardProps) {

  const isSoldOut = item.stock === 0;
  const isLowStock =
    item.stock != null && item.stock > 0 && item.stock <= 5;

  return (
    <button
      onClick={isSoldOut ? undefined : onClick}
      disabled={isSoldOut}
      className={`group flex flex-col overflow-hidden rounded-xl transition-all ${
        isSoldOut
          ? "cursor-not-allowed bg-surface-container-low opacity-50"
          : "bg-surface-container-low hover:shadow-[var(--md-elevation-2)] active:scale-[0.98]"
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square w-full bg-surface-container">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className={`h-full w-full object-cover ${isSoldOut ? "grayscale" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BoxIcon
              className={`h-12 w-12 transition-colors ${
                isSoldOut
                  ? "text-outline-variant"
                  : "text-outline-variant group-hover:text-primary"
              }`}
            />
          </div>
        )}

        {/* Sold Out overlay */}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
            <span className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-semibold text-on-surface-variant">
              Sold Out
            </span>
          </div>
        )}

        {/* Low stock badge — shown when 5 or fewer remain */}
        {isLowStock && (
          <div className="absolute bottom-2 left-2 rounded-full bg-error-container px-2 py-0.5 text-xs font-semibold text-on-error-container">
            {item.stock} left
          </div>
        )}

        {/* Quick add indicator */}
        {!isSoldOut && (
          <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
            <PlusIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <h3
          className={`line-clamp-2 text-sm font-medium ${
            isSoldOut ? "text-on-surface-variant" : "text-on-surface"
          }`}
        >
          {item.name}
        </h3>
        <p
          className={`mt-1 text-sm font-semibold ${
            isSoldOut ? "text-on-surface-variant" : "text-primary"
          }`}
        >
          {formatCurrency(item.base_price)}
        </p>
      </div>
    </button>
  );
}
