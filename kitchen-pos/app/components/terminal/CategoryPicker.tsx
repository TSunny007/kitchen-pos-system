"use client";

import { useState, useRef, useEffect } from "react";
import { Category } from "../../types";
import { ChevronDownIcon, CheckIcon, SpinnerIcon, TrashIcon, PlusIcon } from "../icons";

interface CategoryPickerProps {
  categories: Category[];
  selectedCategoryId?: number;
  onSelectCategory: (categoryId: number) => void;
  onCreateCategory?: (name: string) => Promise<Category | null>;
  onDeleteCategory?: (categoryId: number) => Promise<boolean>;
}

export default function CategoryPicker({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onDeleteCategory,
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Filter categories based on search
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search query matches any existing category
  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === searchQuery.toLowerCase()
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setConfirmDeleteId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelectCategory = (categoryId: number) => {
    onSelectCategory(categoryId);
    setIsOpen(false);
    setSearchQuery("");
    setConfirmDeleteId(null);
  };

  const handleCreateCategory = async () => {
    if (!onCreateCategory || !searchQuery.trim() || exactMatch) return;

    setIsCreating(true);
    try {
      const newCategory = await onCreateCategory(searchQuery.trim());
      if (newCategory) {
        onSelectCategory(newCategory.id);
        setIsOpen(false);
        setSearchQuery("");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (confirmDeleteId !== categoryId) {
      setConfirmDeleteId(categoryId);
      return;
    }
    
    if (!onDeleteCategory) return;
    
    setDeletingCategoryId(categoryId);
    try {
      const success = await onDeleteCategory(categoryId);
      if (success) {
        setConfirmDeleteId(null);
      }
    } catch {
      // Error is likely due to foreign key constraint (items linked to category)
      alert("Cannot delete category: it may have items linked to it.");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCategories.length === 1) {
        handleSelectCategory(filteredCategories[0].id);
      } else if (!exactMatch && searchQuery.trim() && onCreateCategory) {
        handleCreateCategory();
      }
    } else if (e.key === "Escape") {
      // This picker is rendered inside a Modal, which also closes on Escape.
      // Dismissing the dropdown shouldn't discard the whole form behind it.
      e.stopPropagation();
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
          isOpen
            ? "border-primary ring-1 ring-primary"
            : "border-outline hover:border-outline-variant"
        } ${selectedCategory ? "text-on-surface" : "text-on-surface-variant"}`}
      >
        <div className="flex items-center gap-2">
          {selectedCategory ? (
            <>
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: getCategoryColor(selectedCategory.id),
                }}
              />
              <span>{selectedCategory.name}</span>
            </>
          ) : (
            <span>Select category...</span>
          )}
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 text-on-surface-variant transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-outline-variant bg-surface-container shadow-lg">
          {/* Search Input */}
          <div className="border-b border-outline-variant p-2">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create..."
              className="w-full rounded-md bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Category List */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-container-high ${
                    category.id === selectedCategoryId
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(category.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: getCategoryColor(category.id) }}
                    />
                    <span className="truncate">{category.name}</span>
                    {category.id === selectedCategoryId && (
                      <CheckIcon className="ml-auto h-4 w-4 shrink-0" />
                    )}
                  </button>
                  
                  {/* Delete Button */}
                  {onDeleteCategory && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCategory(category.id, e)}
                      disabled={deletingCategoryId === category.id}
                      className={`shrink-0 rounded p-1 transition-colors ${
                        confirmDeleteId === category.id
                          ? "bg-error text-on-error"
                          : "text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
                      } disabled:opacity-50`}
                      title={confirmDeleteId === category.id ? "Click again to confirm" : "Delete category"}
                    >
                      {deletingCategoryId === category.id ? (
                        <SpinnerIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              ))
            ) : searchQuery && !exactMatch ? null : (
              <p className="px-3 py-2 text-sm text-on-surface-variant">No categories found</p>
            )}

            {/* Create New Category Option */}
            {searchQuery.trim() && !exactMatch && onCreateCategory && (
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isCreating}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4 shrink-0" />
                <span>
                  {isCreating ? "Creating..." : `Create "${searchQuery.trim()}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Generate consistent colors for categories based on ID
function getCategoryColor(id: number): string {
  const colors = [
    "#f44336", // red
    "#e91e63", // pink
    "#9c27b0", // purple
    "#673ab7", // deep purple
    "#3f51b5", // indigo
    "#2196f3", // blue
    "#03a9f4", // light blue
    "#00bcd4", // cyan
    "#009688", // teal
    "#4caf50", // green
    "#8bc34a", // light green
    "#cddc39", // lime
    "#ffc107", // amber
    "#ff9800", // orange
    "#ff5722", // deep orange
  ];
  return colors[id % colors.length];
}
