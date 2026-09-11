/**
 * The icons that appear in more than one place.
 *
 * An icon earns a slot here only when two or more call sites already draw
 * byte-identical path data — same `d`, same viewBox, same fill/stroke. That
 * rule is what makes replacing them a provably cosmetic change rather than a
 * redraw, and it's why a few one-off glyphs are still inline at their use site.
 *
 * Deliberately not a system: no name registry, no size tokens, no colour
 * props. Size and colour are Tailwind classes at the call site, the way they
 * already were. `strokeWidth` is the one exception, because a handful of these
 * genuinely appear at two weights.
 */

interface IconProps {
  className?: string;
  /** Stroke weight, where a glyph is legitimately drawn at more than one. */
  strokeWidth?: number;
}

/**
 * Every stroked glyph below is this same drawing, differing only in `d` and
 * sometimes a default weight — so it is written once.
 */
function StrokeIcon({
  d,
  className,
  strokeWidth = 2,
}: IconProps & { d: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
  );
}

export const CloseIcon = ({ className = "h-6 w-6", ...props }: IconProps) => (
  <StrokeIcon d="M6 18L18 6M6 6l12 12" className={className} {...props} />
);

export const PlusIcon = (props: IconProps) => (
  <StrokeIcon d="M12 4v16m8-8H4" {...props} />
);

export const MinusIcon = (props: IconProps) => (
  <StrokeIcon d="M20 12H4" {...props} />
);

/** Tick. Drawn at weight 3 where it sits inside a filled checkbox. */
export const CheckIcon = (props: IconProps) => (
  <StrokeIcon d="M5 13l4 4L19 7" {...props} />
);

export const TrashIcon = (props: IconProps) => (
  <StrokeIcon
    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    {...props}
  />
);

export const ChevronDownIcon = (props: IconProps) => (
  <StrokeIcon d="M19 9l-7 7-7-7" {...props} />
);

export const ArrowLeftIcon = (props: IconProps) => (
  <StrokeIcon d="M10 19l-7-7m0 0l7-7m-7 7h18" {...props} />
);

export const RefreshIcon = (props: IconProps) => (
  <StrokeIcon
    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    {...props}
  />
);

export const CartIcon = (props: IconProps) => (
  <StrokeIcon
    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    {...props}
  />
);

/** Placeholder for an item with no image. Always drawn light. */
export const BoxIcon = ({ strokeWidth = 1.5, ...props }: IconProps) => (
  <StrokeIcon
    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    strokeWidth={strokeWidth}
    {...props}
  />
);

/**
 * Busy indicator. Filled rather than stroked, so it shares nothing with the
 * above and takes no `strokeWidth`; callers add `animate-spin` themselves,
 * since a couple of them spin it only conditionally.
 */
export function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
