"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

export function CloseIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface ModalProps {
  onClose: () => void;
  /** Omit to render no header row - for modals that supply their own. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /**
   * Accessible name for modals that render no `title` row. Without one such a
   * dialog is announced as just "dialog".
   */
  ariaLabel?: string;
  /** "sheet" slides up from the bottom on mobile; "centered" never does. */
  variant?: "sheet" | "centered";
  /** Sizing/layout for the panel, e.g. "max-w-md" or "h-[85vh] max-w-2xl". */
  panelClassName?: string;
  children: ReactNode;
}

/**
 * Backdrop + panel shell shared by every modal in the app. Callers keep
 * control of panel sizing and scroll behavior via `panelClassName`, since
 * those genuinely differ - everything else was copy-pasted five times.
 *
 * Rendering this component *is* opening the modal: callers mount it
 * conditionally, which is also what gives each one fresh state per open.
 */
export default function Modal({
  onClose,
  title,
  subtitle,
  ariaLabel,
  variant = "sheet",
  panelClassName = "max-w-md",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isSheet = variant === "sheet";

  // Callers pass inline arrow functions, so reading onClose through a ref
  // keeps the listener effect from tearing down and re-binding every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
        .filter((el) => el.offsetParent !== null);

    // Move focus into the dialog so the next Tab lands inside it, and so
    // screen readers announce the dialog instead of the page behind it.
    (focusable()[0] ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const escaped = !panel?.contains(active);

      // Wrap at both ends, and pull focus back in if it got outside the panel.
      if (event.shiftKey && (active === first || escaped)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || escaped)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Return focus to whatever opened the modal, so keyboard users don't
      // get dumped back at the top of the page.
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
        isSheet ? "items-end sm:items-center sm:p-4" : "items-center p-4"
      }`}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        aria-label={title === undefined ? ariaLabel : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full bg-surface-container-lowest shadow-[var(--md-elevation-3)] focus:outline-none ${
          isSheet ? "rounded-t-3xl sm:rounded-3xl" : "rounded-3xl"
        } ${panelClassName}`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-outline-variant p-6">
            <div>
              <h2 id={titleId} className="text-xl font-semibold text-on-surface">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
