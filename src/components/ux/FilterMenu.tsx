import styles from "./FilterMenu.module.css";

export type HaFilter = "all" | "home" | "away";

export function FilterMenu({
  ha,
  onHa,
  open,
  onToggle,
}: {
  ha: HaFilter;
  onHa: (v: HaFilter) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={onToggle}
      >
        Filters
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Filters">
          <p className={styles.label}>Home / Away</p>
          <div className={styles.row} role="group">
            {(
              [
                ["all", "All"],
                ["home", "Home"],
                ["away", "Away"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={ha === id ? styles.chipOn : styles.chip}
                aria-pressed={ha === id}
                onClick={() => onHa(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Applies to Matchup week strip only · no navigation
          </p>
        </div>
      ) : null}
    </div>
  );
}
