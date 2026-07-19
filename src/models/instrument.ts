import type { SFSymbol } from 'expo-symbols';
import type { SoundFont2 } from 'soundfont2';

import { getDefaultSoundFont } from '@/utils/soundfont-loader';

/**
 * An Instrument Definition is a named, data-driven description of a voice —
 * never code branches. `renderMode` selects which renderer a definition is
 * played through by *capability*, not by instrument identity
 * (midi-render-service.ts's ensureLayerRenderCached dispatches on this one
 * field): `'synth'` definitions carry an envelope + harmonic-partial recipe
 * for src/utils/instrument-renderer.ts's procedural additive synthesis;
 * `'soundfont'` definitions instead point at a bundled sample library for
 * src/utils/soundfont-renderer.ts's sample-based rendering (see
 * docs/03_ROADMAP.md Stage 9.5a). Adding a new instrument — of either kind —
 * means adding a new definition here, never touching the renderer-selection
 * logic.
 *
 * Every current instrument is sample-based, all sharing the one bundled
 * GeneralUser GS SoundFont (soundfont-loader.ts) at its own standard GM
 * program number — verified directly against the installed soundfont2
 * package, not assumed from the GM spec alone. `SynthInstrumentDefinition`
 * (instrument-renderer.ts's procedural additive synthesis) is kept as
 * working, tested infrastructure for a future instrument that might want
 * it, even though nothing currently uses it.
 */

export type InstrumentId =
  'piano' | 'electricPiano' | 'guitar' | 'bass' | 'strings' | 'synth' | 'pad';

export const ALL_INSTRUMENTS: InstrumentId[] = [
  'piano',
  'electricPiano',
  'guitar',
  'bass',
  'strings',
  'synth',
  'pad',
];

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

interface InstrumentDefinitionBase {
  id: InstrumentId;
  name: string;
  /**
   * SF Symbol shown in the instrument picker — not every instrument has one
   * that fits well (SF Symbols has no dedicated bass-guitar or
   * strings-ensemble icon); `InstrumentSelector` falls back to a generic
   * icon when this is unset.
   */
  icon?: SFSymbol;
}

/** Procedural additive synthesis — see instrument-renderer.ts. */
export interface SynthInstrumentDefinition extends InstrumentDefinitionBase {
  renderMode: 'synth';
  envelope: EnvelopeParams;
  partials: HarmonicPartial[];
}

/**
 * Sample-based rendering from a bundled SoundFont — see
 * soundfont-renderer.ts. `loadSoundFont` is a per-definition reference
 * (rather than one hardcoded soundfont) so future sampled instruments can
 * point at a different bundled .sf2 file, or a different bank/preset within
 * a shared one, without any renderer-selection changes.
 */
export interface SoundFontInstrumentDefinition extends InstrumentDefinitionBase {
  renderMode: 'soundfont';
  loadSoundFont: () => Promise<SoundFont2>;
  bank: number;
  preset: number;
}

export type InstrumentDefinition = SynthInstrumentDefinition | SoundFontInstrumentDefinition;

const PIANO_DEFINITION: InstrumentDefinition = {
  id: 'piano',
  name: 'Piano',
  icon: 'pianokeys',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 0, // GM "Acoustic Grand Piano" — GeneralUser GS's "Stereo Grand"
};

const ELECTRIC_PIANO_DEFINITION: InstrumentDefinition = {
  id: 'electricPiano',
  name: 'Electric Piano',
  icon: 'pianokeys.inverse',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 4, // GM "Electric Piano 1" — GeneralUser GS's "Tine Electric Piano"
};

const GUITAR_DEFINITION: InstrumentDefinition = {
  id: 'guitar',
  name: 'Guitar',
  icon: 'guitars.fill',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 24, // GM "Acoustic Guitar (nylon)" — GeneralUser GS's "Nylon Guitar"
};

const BASS_DEFINITION: InstrumentDefinition = {
  id: 'bass',
  name: 'Bass',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 32, // GM "Acoustic Bass" — GeneralUser GS's "Acoustic Bass"
};

const STRINGS_DEFINITION: InstrumentDefinition = {
  id: 'strings',
  name: 'Strings',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 48, // GM "String Ensemble 1" — GeneralUser GS's "Stereo Strings Fast"
};

const SYNTH_DEFINITION: InstrumentDefinition = {
  id: 'synth',
  name: 'Synth',
  icon: 'waveform',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 80, // GM "Lead 1 (square)" — GeneralUser GS's "Square Lead"
};

const PAD_DEFINITION: InstrumentDefinition = {
  id: 'pad',
  name: 'Pad',
  icon: 'cloud.fill',
  renderMode: 'soundfont',
  loadSoundFont: getDefaultSoundFont,
  bank: 0,
  preset: 88, // GM "Pad 1 (new age)" — GeneralUser GS's "Fantasia"
};

export const INSTRUMENT_DEFINITIONS: Record<InstrumentId, InstrumentDefinition> = {
  piano: PIANO_DEFINITION,
  electricPiano: ELECTRIC_PIANO_DEFINITION,
  guitar: GUITAR_DEFINITION,
  bass: BASS_DEFINITION,
  strings: STRINGS_DEFINITION,
  synth: SYNTH_DEFINITION,
  pad: PAD_DEFINITION,
};
