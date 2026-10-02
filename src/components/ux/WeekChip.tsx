import type { YahooWeek } from "@/lib/yahooWeeks";
import { weekChipLabel } from "@/lib/yahooWeeks";
import styles from "./WeekChip.module.css";

export function WeekChip({
  week,
  selected,
  disabled,
  onSelect,
}: {
  week: YahooWeek;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (weekNumber: number) => void;
}) {
  const label = weekChipLabel(week);
  return (
    <button
      type="button"
      className={selected ? styles.chipOn : styles.chip}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect?.(week.week_number)}
      title={week.notes || week.label}
    >
      {label}
    </button>
  );
}
