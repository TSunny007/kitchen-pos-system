"use client";

import { useState, useEffect } from "react";
import { OrderItem, Modifier } from "../../types";

interface OrderItemEditModalProps {
  orderItem: OrderItem | null;
  availableModifiers: Modifier[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderItemId: number, updates: {
    quantity: number;
    notes: string | null;
    modifierIds: number[];
  }) => Promise<void>;
}

export default function OrderItemEditModal({
  orderItem,
  availableModifiers,
  isOpen,
  onClose,
  onSave,
}: OrderItemEditModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedModifierIds, setSelectedModifierIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when orderItem changes
  useEffect(() => {
    if (orderItem) {
      setQuantity(orderItem.quantity);
      setNotes(orderItem.notes || "");
      // Extract modifier IDs from the order item
      const modIds = orderItem.modifiers
        ?.map((m) => m.modifier_id)
        .filter((id): id is number => id !== null) || [];
      setSelectedModifierIds(modIds);
    }
  }, [orderItem]);

  if (!isOpen || !orderItem) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const toggleModifier = (modifierId: number) => {
    setSelectedModifierIds((prev) =>
      prev.includes(modifierId)
        ? prev.filter((id) => id !== modifierId)
        : [...prev, modifierId]
    );
  };

  const calculateTotal = () => {
    const basePrice = orderItem.item?.base_price || 0;
    const modifiersPrice = selectedModifierIds.reduce((sum, modId) => {
      const modifier = availableModifiers.find((m) => m.id === modId);
      return sum + (modifier?.price_delta || 0);
    }, 0);
    return (basePrice + modifiersPrice) * quantity;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(orderItem.id, {
        quantity,
        notes: notes.trim() || null,
        modifierIds: selectedModifierIds,
      });
      onClose();
    } catch (error) {
      console.error("Error saving order item:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[var(--md-elevation-3)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <h2 className="text-xl font-semibold text-on-surface">Edit Item</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
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
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Item name */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-on-surface">
              {orderItem.item?.name || "Unknown item"}
            </h3>
            <p className="text-sm text-on-surface-variant">
              Base price: {formatPrice(orderItem.item?.base_price || 0)}
            </p>
          </div>

          {/* Quantity */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-on-surface-variant">
              Quantity
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
              >
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
                    d="M20 12H4"
                  />
                </svg>
              </button>
              <span className="w-12 text-center text-xl font-semibold text-on-surface">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
              >
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
              </button>
            </div>
          </div>

          {/* Modifiers */}
          {availableModifiers.length > 0 && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                Modifiers
              </label>
              <div className="space-y-2">
                {availableModifiers.map((modifier) => (
                  <button
                    key={modifier.id}
                    onClick={() => toggleModifier(modifier.id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedModifierIds.includes(modifier.id)
                        ? "border-primary bg-primary-container"
                        : "border-outline-variant bg-surface-container hover:bg-surface-container-high"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selectedModifierIds.includes(modifier.id)
                            ? "border-primary bg-primary"
                            : "border-outline"
                        }`}
                      >
                        {selectedModifierIds.includes(modifier.id) && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-on-primary"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={
                          selectedModifierIds.includes(modifier.id)
                            ? "text-on-primary-container"
                            : "text-on-surface"
                        }
                      >
                        {modifier.name}
                      </span>
                    </div>
                    {modifier.price_delta !== 0 && (
                      <span
                        className={`text-sm ${
                          selectedModifierIds.includes(modifier.id)
                            ? "text-on-primary-container"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {modifier.price_delta > 0 ? "+" : ""}
                        {formatPrice(modifier.price_delta)}
                      </span>
                    )}
                  </button>
                ))}
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
              rows={3}
              className="w-full rounded-lg border border-outline bg-transparent px-4 py-3 text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-4">
          <div>
            <p className="text-xs text-on-surface-variant">Item Total</p>
            <p className="text-xl font-bold text-on-surface">
              {formatPrice(calculateTotal())}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-full border border-outline px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || quantity < 1}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:shadow-[var(--md-elevation-1)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
