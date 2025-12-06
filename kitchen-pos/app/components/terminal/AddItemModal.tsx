"use client";

import { useState, useEffect } from "react";
import { Category, Modifier } from "../../types";
import CategoryPicker from "./CategoryPicker";
import ModifierPicker from "./ModifierPicker";

interface AddItemModalProps {
  isOpen: boolean;
  categories: Category[];
  modifiers: Modifier[];
  selectedCategoryId?: number;
  onClose: () => void;
  onAddItem: (item: {
    name: string;
    description: string;
    base_price: number;
    category_id: number;
    image_url: string | null;
    modifierIds: number[];
    no_prep_needed: boolean;
  }) => Promise<void>;
  onCreateCategory?: (name: string) => Promise<Category | null>;
  onDeleteCategory?: (categoryId: number) => Promise<boolean>;
  onCreateModifier?: (data: { name: string; price_delta: number }) => Promise<Modifier | null>;
}

export default function AddItemModal({
  isOpen,
  categories,
  modifiers,
  selectedCategoryId,
  onClose,
  onAddItem,
  onCreateCategory,
  onDeleteCategory,
  onCreateModifier,
}: AddItemModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(selectedCategoryId);
  const [selectedModifierIds, setSelectedModifierIds] = useState<number[]>([]);
  const [noPrepNeeded, setNoPrepNeeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update category when selectedCategoryId prop changes
  useEffect(() => {
    if (selectedCategoryId) {
      setCategoryId(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  const handleToggleModifier = (modifierId: number) => {
    setSelectedModifierIds((prev) =>
      prev.includes(modifierId)
        ? prev.filter((id) => id !== modifierId)
        : [...prev, modifierId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter an item name");
      return;
    }

    if (!categoryId) {
      setError("Please select a category");
      return;
    }

    const parsedPrice = parseFloat(price) || 0;

    setIsSubmitting(true);
    try {
      await onAddItem({
        name: name.trim(),
        description: description.trim(),
        base_price: parsedPrice,
        category_id: categoryId,
        image_url: imageUrl.trim() || null,
        modifierIds: selectedModifierIds,
        no_prep_needed: noPrepNeeded,
      });
      // Reset form
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      setCategoryId(selectedCategoryId);
      setSelectedModifierIds([]);
      setNoPrepNeeded(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setCategoryId(selectedCategoryId);
    setSelectedModifierIds([]);
    setNoPrepNeeded(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-surface-container-lowest p-6 shadow-[var(--md-elevation-3)] sm:rounded-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">Add New Item</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Item Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chocolate Croissant"
              className="w-full rounded-lg border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Category *
            </label>
            <CategoryPicker
              categories={categories}
              selectedCategoryId={categoryId}
              onSelectCategory={setCategoryId}
              onCreateCategory={onCreateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-outline bg-surface pl-8 pr-4 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full rounded-lg border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Image URL
            </label>
            <div className="space-y-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-lg border border-outline bg-surface px-4 py-3 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={isSubmitting}
              />
              {/* Image Preview */}
              {imageUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-container">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    onLoad={(e) => {
                      (e.target as HTMLImageElement).style.display = 'block';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Modifiers */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Modifiers
            </label>
            <ModifierPicker
              modifiers={modifiers}
              selectedModifierIds={selectedModifierIds}
              onToggleModifier={handleToggleModifier}
              onCreateModifier={onCreateModifier}
            />
          </div>

          {/* No Prep Needed Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setNoPrepNeeded(!noPrepNeeded)}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                noPrepNeeded
                  ? "border-primary bg-primary-container"
                  : "border-outline-variant bg-surface-container hover:border-outline hover:bg-surface-container-high"
              }`}
            >
              <div>
                <p className={`font-medium ${noPrepNeeded ? "text-on-primary-container" : "text-on-surface"}`}>
                  Ready immediately
                </p>
                <p className={`text-sm ${noPrepNeeded ? "text-on-primary-container/70" : "text-on-surface-variant"}`}>
                  Skip kitchen preparation (e.g., packaged items)
                </p>
              </div>
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                  noPrepNeeded
                    ? "bg-primary text-on-primary"
                    : "border-2 border-outline-variant bg-surface"
                }`}
              >
                {noPrepNeeded && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-full border border-outline py-3 font-medium text-on-surface transition-colors hover:bg-surface-container"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-primary py-3 font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
