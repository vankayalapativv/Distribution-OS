import { FeedbackBanner } from "./feedback-banner";

/**
 * Inline error banner — the error-variant of {@link FeedbackBanner}, kept as a
 * named wrapper so existing callers don't change. For warnings/success/info,
 * use `FeedbackBanner` directly.
 *
 * Pass `onRetry` for LOAD failures to add a "Try again" affordance so a failed
 * fetch is never a dead-end; omit it for form/submit errors (retry doesn't apply).
 */
export function ErrorBanner({
  message,
  className,
  onRetry,
}: {
  readonly message: string;
  readonly className?: string;
  readonly onRetry?: () => void;
}) {
  return <FeedbackBanner variant="error" message={message} className={className} onRetry={onRetry} />;
}
