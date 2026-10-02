import styles from "./DoesntCountBadge.module.css";

export function DoesntCountBadge({
  label = "Doesn't count",
}: {
  label?: string;
}) {
  return <span className={styles.badge}>{label}</span>;
}
