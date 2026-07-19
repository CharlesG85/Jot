import type { SoundFont2 } from 'soundfont2';

// Shared across the app so the bundled SoundFont (tens of MB) is only
// downloaded-from-bundle and parsed once per app session, not once per
// Layer render — mirrors crepe-pitch-detector.ts's sessionPromise pattern.
let soundFontPromise: Promise<SoundFont2> | null = null;

/**
 * Loads and parses the bundled default SoundFont: GeneralUser GS
 * (assets/instruments/generaluser-gs.sf2, ~30MB, license v2.0 — see the
 * sibling generaluser-gs-LICENSE.txt — unrestricted commercial use, no
 * attribution required). Chosen over a per-instrument sample library
 * (docs/03_ROADMAP.md Stage 9.5a): one General MIDI file covers every
 * instrument the roadmap wants (Piano, Electric Piano, Guitar, Bass,
 * Strings, Synth Lead, Pad — verified present at their standard GM program
 * numbers) at a fraction of the size a single high-fidelity per-instrument
 * SoundFont would cost. Every SoundFontInstrumentDefinition shares this one
 * loader, differing only in which bank/preset they read.
 *
 * expo-asset, expo-file-system, and soundfont2 are imported dynamically,
 * not at module scope — expo-asset pulls in React Native's own module
 * graph, which can't load outside an RN runtime (e.g. a plain-Node
 * validation script) — matching crepe-pitch-detector.ts's own reasoning
 * for the same pattern.
 */
export function getDefaultSoundFont(): Promise<SoundFont2> {
  if (!soundFontPromise) {
    soundFontPromise = (async () => {
      const [{ Asset }, { File }, { SoundFont2 }] = await Promise.all([
        import('expo-asset'),
        import('expo-file-system'),
        import('soundfont2'),
      ]);
      // require() resolves via metro.config.js's 'sf2' assetExt registration.
      const asset = Asset.fromModule(require('@/assets/instruments/generaluser-gs.sf2'));
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new Error('Default SoundFont asset has no localUri after downloadAsync()');
      }
      const bytes = await new File(asset.localUri).bytes();
      return new SoundFont2(bytes);
    })();
  }
  return soundFontPromise;
}
