import styles from "./AutosaveToast.module.css";

/** Locked copy — A-X1 / COMPONENT_MATRIX */
export function AutosaveToast({
  visible,
  message = "Roster saved on this device",
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.pip} aria-hidden />
      {message}
    </div>
  );
}
