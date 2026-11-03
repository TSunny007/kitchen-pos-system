import type { TimeslotGranularity, TimeslotRow } from "../../lib/supabase/metrics";
import { formatCurrency, formatDuration } from "../../lib/format";

interface TimeslotTableProps {
  timeslots: TimeslotRow[];
  granularity: TimeslotGranularity;
  onGranularityChange: (granularity: TimeslotGranularity) => void;
  busiestKey: string | null;
}

export default function TimeslotTable({
  timeslots,
  granularity,
  onGranularityChange,
  busiestKey,
}: TimeslotTableProps) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-on-surface">Timeslot Activity</h3>
        <div className="flex shrink-0 rounded-full bg-surface-container-high p-0.5">
          {(["hour", "day"] as const).map((option) => (
            <button
              key={option}
              onClick={() => onGranularityChange(option)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                granularity === option
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {option === "hour" ? "Hourly" : "Daily"}
            </button>
          ))}
        </div>
      </div>

      {timeslots.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">
          No orders yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-medium">Timeslot</th>
                <th className="py-2 pr-3 font-medium">Items</th>
                <th className="py-2 pr-3 font-medium">Revenue</th>
                <th className="py-2 pr-3 font-medium">Top Item</th>
                <th className="py-2 font-medium">Avg Time to Serve</th>
              </tr>
            </thead>
            <tbody>
              {timeslots.map((slot) => (
                <tr
                  key={slot.key}
                  className={`border-b border-outline-variant/50 last:border-0 ${
                    slot.key === busiestKey ? "bg-primary-container/40" : ""
                  }`}
                >
                  <td className="py-2 pr-3 font-medium text-on-surface">
                    {slot.label}
                  </td>
                  <td className="py-2 pr-3 text-on-surface">{slot.itemsOrdered}</td>
                  <td className="py-2 pr-3 text-on-surface">
                    {formatCurrency(slot.revenue)}
                  </td>
                  <td className="py-2 pr-3 text-on-surface-variant">
                    {slot.topItem
                      ? `${slot.topItem.itemName} (${slot.topItem.quantity})`
                      : "—"}
                  </td>
                  <td className="py-2 text-on-surface-variant">
                    {slot.avgTimeToServeSeconds !== null
                      ? formatDuration(slot.avgTimeToServeSeconds)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
