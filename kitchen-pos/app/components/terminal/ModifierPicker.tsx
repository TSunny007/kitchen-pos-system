"use client";

import { useState, useRef, useEffect } from "react";
import { Modifier } from "../../types";

interface ModifierPickerProps {
  modifiers: Modifier[];
  selectedModifierIds: number[];
  onToggleModifier: (modifierId: number) => void;
  onCreateModifier?: (data: { name: string; price_delta: number }) => Promise<Modifier | null>;
}

export default function ModifierPicker({
  modifiers,
  selectedModifierIds,
  onToggleModifier,
  onCreateModifier,
}: ModifierPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newModifierPrice, setNewModifierPrice] = useState("0");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedModifiers = modifiers.filter((m) => selectedModifierIds.includes(m.id));

  // Filter modifiers based on search
  const filteredModifiers = modifiers.filter((modifier) =>
    modifier.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search query matches any existing modifier
  const exactMatch = modifiers.some(
    (m) => m.name.toLowerCase() === searchQuery.toLowerCase()
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowPriceInput(false);
        setNewModifierPrice("0");
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const handleCreateModifier = async () => {
    if (!onCreateModifier || !searchQuery.trim()) return;

    setIsCreating(true);
    try {
      const newModifier = await onCreateModifier({
        name: searchQuery.trim(),
        price_delta: parseFloat(newModifierPrice) || 0,
      });
      if (newModifier) {
        onToggleModifier(newModifier.id);
        setSearchQuery("");
        setShowPriceInput(false);
        setNewModifierPrice("0");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setShowPriceInput(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button / Selected Modifiers Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full min-h-[48px] items-center gap-2 rounded-lg border px-4 py-2 text-left transition-colors ${
          isOpen
            ? "border-primary ring-1 ring-primary"
            : "border-outline hover:border-outline-variant"
        }`}
      >
        {selectedModifiers.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedModifiers.map((modifier) => (
              <span
                key={modifier.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-sm text-on-secondary-container"
              >
                {modifier.name}
                {modifier.price_delta !== 0 && (
                  <span className="opacity-70">
                    ({modifier.price_delta > 0 ? "+" : ""}{formatPrice(modifier.price_delta)})
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-on-surface-variant">Select modifiers (optional)...</span>
        )}
        <svg
          className={`ml-auto h-5 w-5 shrink-0 text-on-surface-variant transition-transform ${
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowPriceInput(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or create modifier..."
              className="w-full rounded-md bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Modifier List */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredModifiers.length > 0 ? (
              filteredModifiers.map((modifier) => {
                const isSelected = selectedModifierIds.includes(modifier.id);
                return (
                  <button
                    key={modifier.id}
                    type="button"
                    onClick={() => onToggleModifier(modifier.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-container-high ${
                      isSelected
                        ? "bg-secondary-container text-on-secondary-container"
                        : "text-on-surface"
                    }`}
                  >
                    <span className="truncate">{modifier.name}</span>
                    <div className="flex items-center gap-2">
                      {modifier.price_delta !== 0 && (
                        <span className="text-on-surface-variant">
                          {modifier.price_delta > 0 ? "+" : ""}{formatPrice(modifier.price_delta)}
                        </span>
                      )}
                      {isSelected && (
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            ) : searchQuery && !exactMatch ? null : (
              <p className="px-3 py-2 text-sm text-on-surface-variant">No modifiers found</p>
            )}

            {/* Create New Modifier Option */}
            {searchQuery.trim() && !exactMatch && onCreateModifier && (
              <div className="border-t border-outline-variant mt-1 pt-1">
                {showPriceInput ? (
                  <div className="px-3 py-2 space-y-2">
                    <p className="text-sm text-on-surface-variant">
                      Create "{searchQuery.trim()}"
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={newModifierPrice}
                          onChange={(e) => setNewModifierPrice(e.target.value)}
                          placeholder="0.00 (or -1.00)"
                          className="w-full rounded-md border border-outline bg-transparent pl-7 pr-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateModifier}
                        disabled={isCreating}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm text-on-primary hover:opacity-90 disabled:opacity-50"
                      >
                        {isCreating ? "..." : "Add"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPriceInput(true)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create "{searchQuery.trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
