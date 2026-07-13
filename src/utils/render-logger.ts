const counts: Record<string, number> = {};
let started = false;

/**
 * Instrumentation only. Increments a per-second render counter for `name`,
 * and (once, globally) starts a 1s interval that prints and resets every
 * counted name. Not wired into any production logic — call at the top of a
 * component body to count how many times its render function runs.
 */
export function logRender(name: string): void {
  counts[name] = (counts[name] ?? 0) + 1;

  if (!started) {
    started = true;
    setInterval(() => {
      console.log('[render-count]', JSON.stringify(counts));
      for (const key of Object.keys(counts)) {
        counts[key] = 0;
      }
    }, 1000);
  }
}
