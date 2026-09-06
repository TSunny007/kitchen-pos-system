"use client";

import { ReactNode } from "react";

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

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Omit to render no header row - for modals that supply their own. */
  title?: ReactNode;
  subtitle?: ReactNode;
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
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  variant = "sheet",
  panelClassName = "max-w-md",
  children,
}: ModalProps) {
  if (!isOpen) return null;

  const isSheet = variant === "sheet";

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center ${
        isSheet ? "items-end sm:items-center" : "items-center"
      }`}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className={`relative z-10 w-full bg-surface-container-lowest shadow-[var(--md-elevation-3)] ${
          isSheet ? "rounded-t-3xl sm:rounded-3xl" : "rounded-3xl"
        } ${panelClassName}`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-outline-variant p-6">
            <div>
              <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
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
