import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";

interface StationHeaderProps {
  title: string;
  /** Optional second line, e.g. the kitchen's live order count. */
  subtitle?: ReactNode;
  /** Buttons for the right-hand side, in the order they should appear. */
  actions?: ReactNode;
}

/**
 * The bar across the top of a station screen: back to the station picker, the
 * station's name, and its controls.
 *
 * Both stations drew this by hand. They differed in two ways, neither of them
 * a decision: the terminal padded itself 12px at mobile width and the kitchen
 * 16px, and only the terminal labelled its back link, so the kitchen's
 * announced as just "link". Both now take the kitchen's padding and the
 * terminal's label.
 */
export default function StationHeader({
  title,
  subtitle,
  actions,
}: StationHeaderProps) {
  const heading = (
    <h1 className="text-lg font-medium text-on-surface sm:text-2xl">{title}</h1>
  );

  return (
    <header
      className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6 sm:py-4"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          href="/"
          aria-label="Back to home"
          title="Back to home"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </Link>
        {subtitle === undefined ? (
          heading
        ) : (
          <div>
            {heading}
            <p className="text-xs text-on-surface-variant sm:text-sm">{subtitle}</p>
          </div>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex items-center gap-2 sm:gap-4">{actions}</div>
      )}
    </header>
  );
}
