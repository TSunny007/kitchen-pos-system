"use client";

import { useState } from "react";
import { Item, Modifier } from "../../types";

interface ItemDetailModalProps {
  item: Item;
  modifiers: Modifier[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: Item,
    quantity: number,
    modifiers: Modifier[],
    notes: string
  ) => void;
}

export default function ItemDetailModal({
  item,
  modifiers,
  isOpen,
  onClose,
  onAddToCart,
}: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [notes, setNotes] = useState("");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const calculateTotal = (): number => {
    const baseTotal = item.base_price * quantity;
    const modifiersTotal = selectedModifiers.reduce(
      (sum, mod) => sum + mod.price_delta * quantity,
      0
    );
    return baseTotal + modifiersTotal;
  };

  const toggleModifier = (modifier: Modifier) => {
    setSelectedModifiers((prev) => {
      const isSelected = prev.some((m) => m.id === modifier.id);
      if (isSelected) {
        return prev.filter((m) => m.id !== modifier.id);
      }
      return [...prev, modifier];
    });
  };

  const handleAddToCart = () => {
    onAddToCart(item, quantity, selectedModifiers, notes);
    // Reset state
    setQuantity(1);
    setSelectedModifiers([]);
    setNotes("");
  };

  const handleClose = () => {
    setQuantity(1);
    setSelectedModifiers([]);
    setNotes("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[var(--md-elevation-3)]">
        {/* Header with Image */}
        <div className="relative aspect-video w-full bg-surface-container">
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
                className="h-20 w-20 text-outline-variant"
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
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest/80 text-on-surface backdrop-blur-sm transition-colors hover:bg-surface-container-highest"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Info */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-on-surface">
              {item.name}
            </h2>
            {item.description && (
              <p className="mt-2 text-on-surface-variant">{item.description}</p>
            )}
            <p className="mt-2 text-xl font-semibold text-primary">
              {formatPrice(item.base_price)}
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              Quantity
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
              </button>
              <span className="w-12 text-center text-2xl font-semibold text-on-surface">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
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
              </button>
            </div>
          </div>

          {/* Modifiers */}
          {modifiers.length > 0 && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                Customize
              </label>
              <div className="flex flex-wrap gap-2">
                {modifiers.map((modifier) => {
                  const isSelected = selectedModifiers.some(
                    (m) => m.id === modifier.id
                  );
                  return (
                    <button
                      key={modifier.id}
                      onClick={() => toggleModifier(modifier)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                      }`}
                    >
                      {modifier.name}
                      {modifier.price_delta !== 0 && (
                        <span className="ml-1 text-on-surface-variant">
                          {modifier.price_delta > 0 ? "+" : ""}
                          {formatPrice(modifier.price_delta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              Special Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any special requests..."
              rows={2}
              className="w-full rounded-lg border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-primary py-4 text-base font-medium text-on-primary transition-all hover:shadow-[var(--md-elevation-1)]"
          >
            <span>Add to Order</span>
            <span className="rounded-full bg-on-primary/20 px-3 py-1">
              {formatPrice(calculateTotal())}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
