/** Formats a bar count as e.g. "1 bar", "2 bars". */
export function formatBars(bars: number): string {
  return `${bars} ${bars === 1 ? 'bar' : 'bars'}`;
}
