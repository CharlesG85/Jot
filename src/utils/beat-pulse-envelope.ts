/** Fraction of a beat interval spent on the sharp attack (0 → peak). */
const ATTACK_END = 0.08;
/** Fraction of a beat interval spent settling back down to the rest floor. */
const SETTLE_END = 0.22;
const REST_FLOOR = 0.15;
const REGULAR_PEAK = 0.72;
const REGULAR_BREATH_PEAK = 0.4;
const ACCENT_PEAK = 1;
const ACCENT_BREATH_PEAK = 0.55;

/**
 * The one curve every layer of the visual metronome (BeatPulseGlow, the
 * RecordButton's beat number, Timeline's active tick) is built from — see
 * each of their own docstrings. Three phases per beat:
 *
 * 1. Attack (0 → ATTACK_END): a fast rise to peak — the sharp, "instantaneous"
 *    hit itself.
 * 2. Settle (ATTACK_END → SETTLE_END): a quick drop back to a resting floor.
 *    Without this, the attack would just be the start of one long slow
 *    swell — settling first is what makes it read as a distinct, sharp
 *    pulse rather than a gradual one.
 * 3. Breathe (SETTLE_END → 1): a slow ease back up from that floor toward
 *    (not quite reaching) peak, timed to arrive right as the next beat's
 *    attack begins. This is the anticipation: motion visibly reaching
 *    toward the next beat, not recovering from the last one.
 *
 * Accent beats (isAccent) use the same three-phase shape with a taller peak
 * and breathing ceiling — "the same heartbeat, louder," not a different
 * effect — so beat 1 stands out without looking like a separate animation.
 *
 * Pure function of `phase` (see RecordingTransportResult.beatPhase) — every
 * consumer calls this fresh each frame rather than running its own
 * `withTiming`/`withSequence` animation, so nothing here can drift from the
 * transport that computed `phase` in the first place.
 */
export function beatPulseEnvelope(phase: number, isAccent: boolean): number {
  'worklet';
  const peak = isAccent ? ACCENT_PEAK : REGULAR_PEAK;
  const breathPeak = isAccent ? ACCENT_BREATH_PEAK : REGULAR_BREATH_PEAK;

  if (phase < ATTACK_END) {
    return REST_FLOOR + (peak - REST_FLOOR) * (phase / ATTACK_END);
  }
  if (phase < SETTLE_END) {
    const t = (phase - ATTACK_END) / (SETTLE_END - ATTACK_END);
    return peak - (peak - REST_FLOOR) * t;
  }
  const t = (phase - SETTLE_END) / (1 - SETTLE_END);
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return REST_FLOOR + (breathPeak - REST_FLOOR) * eased;
}
