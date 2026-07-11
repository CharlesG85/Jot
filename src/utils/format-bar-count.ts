/** Formats a duration in seconds as a whole, rounded bar count — e.g. "1 bar", "2 bars". */
export function formatBarCount(durationSeconds: number, barDurationSeconds: number): string {
  const bars = Math.max(1, Math.round(durationSeconds / barDurationSeconds));
  return `${bars} ${bars === 1 ? 'bar' : 'bars'}`;
}
