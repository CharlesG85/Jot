/**
 * An Instrument Definition is a named, data-driven description of a
 * synthesized voice — envelope shape plus harmonic content — never code
 * branches. The Renderer (src/utils/instrument-renderer.ts) is generic and
 * reads only from these values; adding a new instrument means adding a new
 * definition here, not touching the renderer. See docs/03_ROADMAP.md Stage 9.
 */

export type InstrumentId = 'synth';

export const ALL_INSTRUMENTS: InstrumentId[] = ['synth'];

export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  synth: 'Synth',
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
  envelope: EnvelopeParams;
  partials: HarmonicPartial[];
}

// Fast attack, sustained through the note, a few odd-harmonic partials at
// decreasing amplitude — not a naive full sawtooth, which would alias
// harshly at higher pitches.
const SYNTH_DEFINITION: InstrumentDefinition = {
  id: 'synth',
  name: 'Synth',
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

export const INSTRUMENT_DEFINITIONS: Record<InstrumentId, InstrumentDefinition> = {
  synth: SYNTH_DEFINITION,
};
