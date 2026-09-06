"use client";

import { useState } from "react";
import { Category, Modifier } from "../../types";
import CategoryPicker from "./CategoryPicker";
import ModifierPicker from "./ModifierPicker";
import Modal from "../Modal";
import { currencyAdornment } from "../../lib/format";

interface AddItemModalProps {
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
  onToggleCategoryRequiresLabel?: (categoryId: number, requiresLabel: boolean) => Promise<boolean>;
  onCreateModifier?: (data: { name: string; price_delta: number }) => Promise<Modifier | null>;
}

export default function AddItemModal({
  categories,
  modifiers,
  selectedCategoryId,
  onClose,
  onAddItem,
  onCreateCategory,
  onDeleteCategory,
  onToggleCategoryRequiresLabel,
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
      onClose(); // unmounts, discarding form state
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setIsSubmitting(false);
    }
  };

    return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add New Item"
      panelClassName="max-h-[90vh] max-w-md overflow-y-auto"
    >
      <div className="p-6">
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
              onToggleCategoryRequiresLabel={onToggleCategoryRequiresLabel}
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface">
              Price
            </label>
            {/* Flex rather than an absolutely-positioned overlay: the symbol
                trails the amount in most European locales and isn't always one
                character ("CHF", "R$"), so it has to size and sit naturally. */}
            <div className="flex items-center gap-2 rounded-lg border border-outline bg-surface px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              {currencyAdornment.position === "prefix" && (
                <span className="shrink-0 text-on-surface-variant">{currencyAdornment.symbol}</span>
              )}
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full min-w-0 bg-transparent text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                disabled={isSubmitting}
              />
              {currencyAdornment.position === "suffix" && (
                <span className="shrink-0 text-on-surface-variant">{currencyAdornment.symbol}</span>
              )}
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
              onClick={onClose}
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
    </Modal>
  );
}
