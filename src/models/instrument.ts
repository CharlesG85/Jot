import type { SFSymbol } from 'expo-symbols';

/**
 * An Instrument Definition is a named, data-driven description of a
 * synthesized voice — envelope shape plus harmonic content — never code
 * branches. The Renderer (src/utils/instrument-renderer.ts) is generic and
 * reads only from these values; adding a new instrument means adding a new
 * definition here, not touching the renderer. See docs/03_ROADMAP.md Stage 9.
 */

export type InstrumentId = 'piano' | 'electricPiano' | 'synth' | 'pad';

export const ALL_INSTRUMENTS: InstrumentId[] = ['piano', 'electricPiano', 'synth', 'pad'];

export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  piano: 'Piano',
  electricPiano: 'Electric Piano',
  synth: 'Synth',
  pad: 'Pad',
};

export interface EnvelopeParams {
  attackSeconds: number;
  decaySeconds: number;
  /** Level held between decay and release, 0-1. */
  sustainLevel: number;
  releaseSeconds: number;
}

/** One partial in an additive-synthesis recipe. */
export interface HarmonicPartial {
  /** Harmonic multiple of the note's fundamental frequency (1 = fundamental). */
  multiple: number;
  /** Relative amplitude, 0-1. */
  amplitude: number;
}

export interface InstrumentDefinition {
  id: InstrumentId;
  name: string;
  /**
   * SF Symbol shown in the instrument picker — not every instrument has one
   * that fits well; `InstrumentSelector` falls back to a generic icon when
   * this is unset.
   */
  icon?: SFSymbol;
  envelope: EnvelopeParams;
  partials: HarmonicPartial[];
}

// Percussive: a fast (but not instant — real hammers take a few ms) attack,
// then a long decay to a low sustain level, since a real piano note never
// truly plateaus — it just keeps decaying, more slowly, for the rest of its
// length. Partials mix even and odd harmonics fairly evenly (unlike the
// synth's odd-only recipe below), which is closer to a real piano's fuller,
// less hollow harmonic content.
const PIANO_DEFINITION: InstrumentDefinition = {
  id: 'piano',
  name: 'Piano',
  icon: 'pianokeys',
  envelope: {
    attackSeconds: 0.005,
    decaySeconds: 0.6,
    sustainLevel: 0.25,
    releaseSeconds: 0.3,
  },
  partials: [
    { multiple: 1, amplitude: 1 },
    { multiple: 2, amplitude: 0.5 },
    { multiple: 3, amplitude: 0.25 },
    { multiple: 4, amplitude: 0.12 },
    { multiple: 5, amplitude: 0.06 },
  ],
};

// A bell-like "e-piano" character — a strong 2nd harmonic gives it a
// hollower, rounder tone than the piano above, and one deliberately
// slightly-inharmonic upper partial (4.07, not 4) adds the subtle metallic
// edge that pure whole-number harmonics can't produce, evoking the classic
// FM-style electric piano tone without actually implementing FM synthesis.
const ELECTRIC_PIANO_DEFINITION: InstrumentDefinition = {
  id: 'electricPiano',
  name: 'Electric Piano',
  icon: 'pianokeys.inverse',
  envelope: {
    attackSeconds: 0.005,
    decaySeconds: 0.35,
    sustainLevel: 0.4,
    releaseSeconds: 0.4,
  },
  partials: [
    { multiple: 1, amplitude: 1 },
    { multiple: 2, amplitude: 0.6 },
    { multiple: 4.07, amplitude: 0.2 },
    { multiple: 7, amplitude: 0.08 },
  ],
};

// Fast attack, sustained through the note, a few odd-harmonic partials at
// decreasing amplitude — not a naive full sawtooth, which would alias
// harshly at higher pitches.
const SYNTH_DEFINITION: InstrumentDefinition = {
  id: 'synth',
  name: 'Synth',
  icon: 'waveform',
  envelope: {
    attackSeconds: 0.01,
    decaySeconds: 0.05,
    sustainLevel: 0.85,
    releaseSeconds: 0.05,
  },
  partials: [
    { multiple: 1, amplitude: 1 },
    { multiple: 3, amplitude: 0.3 },
    { multiple: 5, amplitude: 0.15 },
  ],
};

// A slow swell in, a steady hold, and a long tail out — the defining
// character of a pad regardless of harmonic content. More partials at
// moderate (not decreasing-fast) amplitude than the other instruments gives
// it a thicker, lusher texture suited to sustained backing rather than a
// distinct attack transient.
const PAD_DEFINITION: InstrumentDefinition = {
  id: 'pad',
  name: 'Pad',
  icon: 'cloud.fill',
  envelope: {
    attackSeconds: 0.8,
    decaySeconds: 0.3,
    sustainLevel: 0.75,
    releaseSeconds: 1.2,
  },
  partials: [
    { multiple: 1, amplitude: 1 },
    { multiple: 2, amplitude: 0.4 },
    { multiple: 3, amplitude: 0.3 },
    { multiple: 4, amplitude: 0.25 },
    { multiple: 5, amplitude: 0.2 },
    { multiple: 6, amplitude: 0.15 },
  ],
};

export const INSTRUMENT_DEFINITIONS: Record<InstrumentId, InstrumentDefinition> = {
  piano: PIANO_DEFINITION,
  electricPiano: ELECTRIC_PIANO_DEFINITION,
  synth: SYNTH_DEFINITION,
  pad: PAD_DEFINITION,
};
