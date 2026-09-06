"use client";

import { currencyAdornment } from "../../lib/format";

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Prices can't go negative; modifier deltas can ("-1.00" off). */
  allowNegative?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "sm" | "md";
  /** Extra classes for the outer box, e.g. a width or `flex-1`. */
  className?: string;
  "aria-label"?: string;
}

/**
 * A number input decorated with the tenant's currency symbol.
 *
 * The wrapper is a <label> carrying the padding, so the whole visible box —
 * symbol and padding included — focuses the field. An earlier version put the
 * padding on the wrapper and left the input at its natural height, which on a
 * tablet made a 48px-looking box with a ~20px tap target: the field ignored
 * taps everywhere except the middle. That matters more here than usual, since
 * this is a POS driven entirely by fingers on glass.
 *
 * Symbol placement and `step` both come from `currencyAdornment`, so a
 * suffix-currency or zero-decimal deployment gets the right layout for free.
 */
export default function PriceInput({
  value,
  onChange,
  placeholder = "0.00",
  allowNegative = false,
  disabled = false,
  autoFocus = false,
  size = "md",
  className = "",
  "aria-label": ariaLabel,
}: PriceInputProps) {
  const box =
    size === "sm"
      ? "gap-1.5 rounded-md px-3 py-1.5 text-sm"
      : "gap-2 rounded-lg px-4 py-3";

  const symbol = (
    <span className="shrink-0 select-none text-on-surface-variant">
      {currencyAdornment.symbol}
    </span>
  );

  return (
    <label
      className={`flex items-center border border-outline bg-transparent transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${box} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {currencyAdornment.position === "prefix" && symbol}
      <input
        type="number"
        inputMode="decimal"
        step={currencyAdornment.step}
        min={allowNegative ? undefined : "0"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="w-full min-w-0 bg-transparent text-on-surface placeholder:text-on-surface-variant focus:outline-none"
      />
      {currencyAdornment.position === "suffix" && symbol}
    </label>
  );
}
