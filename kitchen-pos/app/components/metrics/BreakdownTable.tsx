interface BreakdownRow {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue: string;
}

interface BreakdownTableProps {
  title: string;
  rows: BreakdownRow[];
  emptyLabel?: string;
}

export default function BreakdownTable({
  title,
  rows,
  emptyLabel = "No data yet",
}: BreakdownTableProps) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-medium text-on-surface">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-on-surface">
                  {row.label}
                  {row.sublabel && (
                    <span className="ml-1.5 text-xs text-on-surface-variant">
                      {row.sublabel}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-medium text-on-surface">
                  {row.displayValue}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(row.value / maxValue) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
