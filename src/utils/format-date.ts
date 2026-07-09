const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Formats a timestamp as a short relative label for Idea cards ("5m ago", "Yesterday", "Jul 8"). */
export function formatRelativeDate(timestampMs: number, now: number = Date.now()): string {
  const elapsed = now - timestampMs;

  if (elapsed < MINUTE_MS) {
    return 'Just now';
  }
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes}m ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours}h ago`;
  }

  const date = new Date(timestampMs);
  const today = new Date(now);
  const yesterday = new Date(now - DAY_MS);

  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }

  const isSameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: isSameYear ? undefined : 'numeric',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
