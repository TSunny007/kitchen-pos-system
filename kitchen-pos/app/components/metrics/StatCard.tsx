interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

export default function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <p className="text-xs font-medium text-on-surface-variant sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-on-surface sm:text-3xl">{value}</p>
      {sublabel && (
        <p className="mt-1 text-xs text-on-surface-variant">{sublabel}</p>
      )}
    </div>
  );
}
