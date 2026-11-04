"use client";

import { LedgerEntry } from "../../types";
import { netOf } from "../../lib/ledger";
import { formatCurrency, formatDate, formatPriceDelta } from "../../lib/format";
import { ChevronDownIcon, PlusIcon } from "../icons";

type Figures = { revenue: number; expenses: number; additions: number };

/**
 * Four figure columns at tablet width and up. Below that they would crush the
 * campaign name, so the row shows name and net, with the breakdown as a line
 * underneath instead.
 */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)]";

/**
 * Sign carries the meaning; colour only reinforces it.
 *
 * Positive is `on-primary-container`, not `primary`: the brand green is a fill
 * colour, and as text it is 2.2:1 on the light surface. This token is 11:1 in
 * light and dark, which is what small figures need.
 */
export function amountClass(amount: number): string {
  if (amount < 0) return "text-error";
  if (amount > 0) return "text-on-primary-container";
  return "text-on-surface-variant";
}

export function BalanceColumnHeaders() {
  return (
    <div
      className={`${COLUMNS} hidden px-4 pb-2 text-xs font-medium uppercase tracking-wide text-on-surface-variant sm:grid`}
    >
      <span className="pl-7">Campaign</span>
      <span className="text-right">Revenue</span>
      <span className="text-right">Expenses</span>
      <span className="text-right">Additions</span>
      <span className="text-right">Net</span>
    </div>
  );
}

interface CampaignBalanceRowProps {
  /** Ties the toggle to the panel it opens, for assistive tech. */
  panelId: string;
  name: string;
  /** Secondary line under the name, e.g. a date or "Archived". */
  detail?: string;
  figures: Figures;
  isExpanded: boolean;
  onToggle: () => void;
  /** `null` while loading. Only read when expanded. */
  entries: LedgerEntry[] | null;
  entriesFailed: boolean;
  onAddEntry: () => void;
  onEditEntry: (entry: LedgerEntry) => void;
}

export default function CampaignBalanceRow({
  panelId,
  name,
  detail,
  figures,
  isExpanded,
  onToggle,
  entries,
  entriesFailed,
  onAddEntry,
  onEditEntry,
}: CampaignBalanceRowProps) {
  const net = netOf(figures);

  return (
    <li className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className={`${COLUMNS} grid w-full gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-container-high`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDownIcon
            className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-on-surface">{name}</span>
            {detail && (
              <span className="block text-xs text-on-surface-variant">{detail}</span>
            )}
          </span>
        </span>

        <span className="hidden text-right text-on-surface sm:block">
          {formatCurrency(figures.revenue)}
        </span>
        <span className={`hidden text-right sm:block ${amountClass(figures.expenses)}`}>
          {formatPriceDelta(figures.expenses)}
        </span>
        <span className={`hidden text-right sm:block ${amountClass(figures.additions)}`}>
          {formatPriceDelta(figures.additions)}
        </span>
        <span className={`text-right font-semibold ${amountClass(net)}`}>
          {formatCurrency(net)}
        </span>

        {/* Each pair is nowrap so a narrow screen breaks between figures, not
            between a label and its number. */}
        <span className="col-span-2 flex flex-wrap gap-x-3 pl-7 text-xs text-on-surface-variant sm:hidden">
          <span className="whitespace-nowrap">Revenue {formatCurrency(figures.revenue)}</span>
          <span className="whitespace-nowrap">Expenses {formatPriceDelta(figures.expenses)}</span>
          <span className="whitespace-nowrap">Additions {formatPriceDelta(figures.additions)}</span>
        </span>
      </button>

      {isExpanded && (
        <div
          id={panelId}
          className="border-t border-outline-variant bg-surface-container-low px-4 py-3"
        >
          {entriesFailed ? (
            <p className="py-2 text-sm text-error">Couldn&apos;t load the entries.</p>
          ) : entries === null ? (
            <p className="py-2 text-sm text-on-surface-variant">Loading entries...</p>
          ) : entries.length === 0 ? (
            <p className="py-2 text-sm text-on-surface-variant">
              No expenses or additions yet.
            </p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onEditEntry(entry)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-surface-container"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-on-surface">{entry.label}</span>
                      <span className="block truncate text-xs text-on-surface-variant">
                        {[formatDate(entry.created_at), entry.person]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={`shrink-0 font-medium ${amountClass(entry.amount)}`}>
                      {formatPriceDelta(entry.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={onAddEntry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-outline px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <PlusIcon className="h-4 w-4" />
            Add entry
          </button>
        </div>
      )}
    </li>
  );
}
