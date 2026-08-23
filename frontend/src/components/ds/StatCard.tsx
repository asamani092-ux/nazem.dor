export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ds-stat">
      <div className="ds-stat-value">{value}</div>
      <div className="ds-stat-label">{label}</div>
    </div>
  );
}
