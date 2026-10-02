import styles from "./TeamSubnav.module.css";

export type TeamView = "roster" | "matchup" | "density" | "compare";

const ITEMS: { id: TeamView; label: string }[] = [
  { id: "roster", label: "Roster" },
  { id: "matchup", label: "Matchup week" },
  { id: "density", label: "Density" },
  { id: "compare", label: "Compare" },
];

export function TeamSubnav({
  active,
  onChange,
}: {
  active: TeamView;
  onChange: (v: TeamView) => void;
}) {
  return (
    <nav className={styles.sub} aria-label="Team workspace">
      <ul className={styles.list} role="tablist">
        {ITEMS.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                className={on ? styles.tabOn : styles.tab}
                onClick={() => onChange(item.id)}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
