import Link from "next/link";
import styles from "./Shells.module.css";

export function EmptyShell({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.emptyTitle}>{title}</p>
      {body ? <p className={styles.emptyBody}>{body}</p> : null}
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref} className={styles.cta}>
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingShell({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-busy="true">
      <div className={styles.skel} />
      <div className={styles.skelShort} />
      <p className={styles.loadingLabel}>{label}</p>
    </div>
  );
}

export function ErrorShell({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTitle}>Something went wrong</p>
      <p className={styles.errorBody}>{message}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
