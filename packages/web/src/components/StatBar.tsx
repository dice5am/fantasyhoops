interface StatBarProps {
  label: string;
  value: number;
}

export function StatBar({ label, value }: StatBarProps): JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value.toFixed(1)}</span>
    </div>
  );
}
