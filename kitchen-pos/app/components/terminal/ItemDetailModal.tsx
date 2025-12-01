"use client";

import { useState } from "react";
import { Item, Modifier } from "../../types";

interface ItemDetailModalProps {
  item: Item;
  modifiers: Modifier[];
  allModifiers?: Modifier[]; // All modifiers available for linking
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: Item,
    quantity: number,
    modifiers: Modifier[],
    notes: string
  ) => void;
  // Modifier management callbacks (optional - only shown if provided)
  onCreateModifier?: (modifier: { name: string; price_delta: number }) => Promise<Modifier | null>;
  onLinkModifier?: (itemId: number, modifierId: number) => Promise<boolean>;
  onUnlinkModifier?: (itemId: number, modifierId: number) => Promise<boolean>;
  onDeleteModifier?: (modifierId: number) => Promise<boolean>;
  // Item management
  onDeleteItem?: (itemId: number) => Promise<boolean>;
}

export default function ItemDetailModal({
  item,
  modifiers,
  allModifiers = [],
  isOpen,
  onClose,
  onAddToCart,
  onCreateModifier,
  onLinkModifier,
  onUnlinkModifier,
  onDeleteModifier,
  onDeleteItem,
}: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [notes, setNotes] = useState("");
  
  // Modifier management state
  const [showModifierManager, setShowModifierManager] = useState(false);
  const [isCreatingModifier, setIsCreatingModifier] = useState(false);
  const [newModifierName, setNewModifierName] = useState("");
  const [newModifierPrice, setNewModifierPrice] = useState("0");
  const [savingModifier, setSavingModifier] = useState(false);
  const [confirmDeleteModifierId, setConfirmDeleteModifierId] = useState<number | null>(null);
  const [deletingModifierId, setDeletingModifierId] = useState<number | null>(null);
  
  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check if modifier management is enabled
  const canManageModifiers = onCreateModifier || onLinkModifier || onUnlinkModifier;

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
    setShowModifierManager(false);
    setIsCreatingModifier(false);
    setNewModifierName("");
    setNewModifierPrice("0");
    setShowDeleteConfirm(false);
    onClose();
  };
  
  const handleDeleteItem = async () => {
    if (!onDeleteItem) return;
    
    setIsDeleting(true);
    try {
      const success = await onDeleteItem(item.id);
      if (success) {
        handleClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Get modifiers that are available to link (not already linked to this item)
  const availableModifiersToLink = allModifiers.filter(
    (m) => !modifiers.some((linked) => linked.id === m.id)
  );
  
  const handleCreateModifier = async () => {
    if (!onCreateModifier || !newModifierName.trim()) return;
    
    setSavingModifier(true);
    try {
      const modifier = await onCreateModifier({
        name: newModifierName.trim(),
        price_delta: parseFloat(newModifierPrice) || 0,
      });
      
      if (modifier && onLinkModifier) {
        // Auto-link the newly created modifier to this item
        await onLinkModifier(item.id, modifier.id);
      }
      
      setNewModifierName("");
      setNewModifierPrice("0");
      setIsCreatingModifier(false);
    } catch (error) {
      console.error("Failed to create modifier:", error);
    } finally {
      setSavingModifier(false);
    }
  };
  
  const handleLinkModifier = async (modifierId: number) => {
    if (!onLinkModifier) return;
    await onLinkModifier(item.id, modifierId);
  };
  
  const handleUnlinkModifier = async (modifierId: number) => {
    if (!onUnlinkModifier) return;
    await onUnlinkModifier(item.id, modifierId);
    // Remove from selected if it was selected
    setSelectedModifiers((prev) => prev.filter((m) => m.id !== modifierId));
  };
  
  const handleDeleteModifier = async (modifierId: number) => {
    if (!onDeleteModifier) return;
    
    // First click: show confirmation
    if (confirmDeleteModifierId !== modifierId) {
      setConfirmDeleteModifierId(modifierId);
      return;
    }
    
    // Second click: delete
    setDeletingModifierId(modifierId);
    try {
      const success = await onDeleteModifier(modifierId);
      if (success) {
        // Remove from selected if it was selected
        setSelectedModifiers((prev) => prev.filter((m) => m.id !== modifierId));
      }
    } finally {
      setDeletingModifierId(null);
      setConfirmDeleteModifierId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal - full width on mobile, centered card on desktop */}
      <div className="relative z-10 max-h-[90vh] w-full overflow-hidden rounded-t-3xl bg-surface-container-lowest shadow-[var(--md-elevation-3)] sm:max-w-md sm:rounded-3xl">
        <div className="max-h-[90vh] overflow-y-auto">
          {/* Header with Image */}
          <div className="relative aspect-video w-full bg-surface-container sm:aspect-video">
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
                  className="h-16 w-16 text-outline-variant sm:h-20 sm:w-20"
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
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest/80 text-on-surface backdrop-blur-sm transition-colors hover:bg-surface-container-highest sm:right-4 sm:top-4"
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
            <div className="flex items-start justify-between gap-4">
              <div>
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
              
              {/* Delete Button */}
              {onDeleteItem && (
                <div className="shrink-0">
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container"
                        disabled={isDeleting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteItem}
                        disabled={isDeleting}
                        className="rounded-lg bg-error px-3 py-1.5 text-sm text-on-error hover:opacity-90 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Confirm"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                      title="Delete item"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
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

          {/* Modifiers - Customize section */}
          {modifiers.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-on-surface-variant">
                  Customize your order
                </label>
                {selectedModifiers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedModifiers([])}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {modifiers.map((modifier) => {
                  const isSelected = selectedModifiers.some(
                    (m) => m.id === modifier.id
                  );
                  return (
                    <button
                      key={modifier.id}
                      onClick={() => toggleModifier(modifier)}
                      className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        isSelected
                          ? "border-secondary bg-secondary-container"
                          : "border-outline-variant bg-surface-container hover:border-outline hover:bg-surface-container-high"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox indicator */}
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                            isSelected
                              ? "bg-secondary text-on-secondary"
                              : "border-2 border-outline-variant bg-surface"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className={`font-medium ${isSelected ? "text-on-secondary-container" : "text-on-surface"}`}>
                          {modifier.name}
                        </span>
                      </div>
                      {modifier.price_delta !== 0 && (
                        <span className={`text-sm font-medium ${
                          isSelected 
                            ? "text-on-secondary-container" 
                            : modifier.price_delta > 0 
                              ? "text-on-surface-variant" 
                              : "text-primary"
                        }`}>
                          {modifier.price_delta > 0 ? "+" : ""}
                          {formatPrice(modifier.price_delta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Selected summary */}
              {selectedModifiers.length > 0 && (
                <div className="mt-3 rounded-lg bg-secondary-container/50 px-3 py-2">
                  <p className="text-xs text-on-secondary-container">
                    <span className="font-medium">{selectedModifiers.length} modifier{selectedModifiers.length > 1 ? "s" : ""} selected:</span>{" "}
                    {selectedModifiers.map((m) => m.name).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No modifiers hint */}
          {modifiers.length === 0 && canManageModifiers && (
            <div className="mb-6 rounded-lg border border-dashed border-outline-variant p-4 text-center">
              <p className="text-sm text-on-surface-variant">
                No modifiers linked to this item.{" "}
                <button
                  type="button"
                  onClick={() => setShowModifierManager(true)}
                  className="text-primary hover:underline"
                >
                  Add modifiers
                </button>
              </p>
            </div>
          )}
          
          {/* Modifier Management Section */}
          {canManageModifiers && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-on-surface-variant">
                  Manage Modifiers
                </label>
                <button
                  type="button"
                  onClick={() => setShowModifierManager(!showModifierManager)}
                  className="text-sm text-primary hover:underline"
                >
                  {showModifierManager ? "Hide" : "Edit"}
                </button>
              </div>
              
              {showModifierManager && (
                <div className="rounded-lg border border-outline-variant p-4 space-y-4">
                  {/* Currently linked modifiers with unlink option */}
                  {modifiers.length > 0 && (
                    <div>
                      <p className="text-xs text-on-surface-variant mb-2">Linked Modifiers</p>
                      <div className="flex flex-wrap gap-2">
                        {modifiers.map((modifier) => (
                          <div
                            key={modifier.id}
                            className="flex items-center gap-1 rounded-full bg-tertiary-container px-3 py-1.5 text-sm text-on-tertiary-container"
                          >
                            <span>{modifier.name}</span>
                            {modifier.price_delta !== 0 && (
                              <span className="opacity-70">
                                ({modifier.price_delta > 0 ? "+" : ""}{formatPrice(modifier.price_delta)})
                              </span>
                            )}
                            {/* Unlink button */}
                            <button
                              type="button"
                              onClick={() => handleUnlinkModifier(modifier.id)}
                              className="ml-1 p-0.5 hover:bg-surface-container rounded-full transition-colors"
                              title="Unlink modifier"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            {/* Delete button */}
                            {onDeleteModifier && (
                              <button
                                type="button"
                                onClick={() => handleDeleteModifier(modifier.id)}
                                disabled={deletingModifierId === modifier.id}
                                className={`p-0.5 rounded-full transition-colors ${
                                  confirmDeleteModifierId === modifier.id
                                    ? "bg-error text-on-error"
                                    : "hover:bg-error-container hover:text-on-error-container"
                                }`}
                                title={confirmDeleteModifierId === modifier.id ? "Click again to delete permanently" : "Delete modifier"}
                              >
                                {deletingModifierId === modifier.id ? (
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Available modifiers to link */}
                  {availableModifiersToLink.length > 0 && (
                    <div>
                      <p className="text-xs text-on-surface-variant mb-2">Available Modifiers (click to link)</p>
                      <div className="flex flex-wrap gap-2">
                        {availableModifiersToLink.map((modifier) => (
                          <button
                            key={modifier.id}
                            type="button"
                            onClick={() => handleLinkModifier(modifier.id)}
                            className="flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1.5 text-sm text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors"
                          >
                            {modifier.name}
                            {modifier.price_delta !== 0 && (
                              <span className="opacity-70">
                                ({modifier.price_delta > 0 ? "+" : ""}{formatPrice(modifier.price_delta)})
                              </span>
                            )}
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Create new modifier */}
                  {onCreateModifier && (
                    <div>
                      {isCreatingModifier ? (
                        <div className="space-y-3">
                          <p className="text-xs text-on-surface-variant">Create New Modifier</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newModifierName}
                              onChange={(e) => setNewModifierName(e.target.value)}
                              placeholder="Modifier name"
                              className="flex-1 rounded-lg border border-outline bg-transparent px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none"
                            />
                            <div className="relative w-28">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={newModifierPrice}
                                onChange={(e) => setNewModifierPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-outline bg-transparent pl-7 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingModifier(false);
                                setNewModifierName("");
                                setNewModifierPrice("0");
                              }}
                              className="flex-1 rounded-lg border border-outline px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateModifier}
                              disabled={!newModifierName.trim() || savingModifier}
                              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-on-primary hover:opacity-90 disabled:opacity-50"
                            >
                              {savingModifier ? "Creating..." : "Create & Link"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCreatingModifier(true)}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create New Modifier
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
}
