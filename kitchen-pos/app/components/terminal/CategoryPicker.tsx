"use client";

import { useState, useRef, useEffect } from "react";
import { Category } from "../../types";

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
        // If we deleted the selected category, clear selection
        if (selectedCategoryId === categoryId) {
          // Parent will need to handle this
        }
        setConfirmDeleteId(null);
      }
    } catch (err) {
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
        <svg
          className={`h-5 w-5 text-on-surface-variant transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
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
              className="w-full rounded-md bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
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
                      <svg className="ml-auto h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
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
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
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
