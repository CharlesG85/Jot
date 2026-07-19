# 03_ROADMAP.md

# Development Roadmap

## Stage 0 — Architecture & Project Setup

### Goal

Create a scalable foundation before implementing any features.

### Tasks

- Create Expo project using Development Builds (NOT Expo Go)
- Configure TypeScript
- Configure Expo Router
- Configure Zustand
- Configure SQLite
- Configure Expo File System
- Configure Git
- Create feature-first folder structure
- Create theme constants
- Create shared color palette
- Create typography constants
- Define Idea model
- Define Layer model
- Create Audio Service interface
- Create Storage Service interface
- Configure ESLint & Prettier
- Verify app builds successfully on iOS

### Deliverable

A clean, scalable architecture with no placeholder code.

---

## Stage 1 — Home Screen

### Goal

Create the notebook experience.

### Tasks

- Build Notes-style home screen
- Display Idea list
- Create floating "New Idea" button
- Create new Idea
- Rename Idea
- Delete Idea
- Persist Ideas locally
- Sort by modified date
- Search Ideas by title (promoted from Backlog on 2026-07-09; lyrics/tag search remain backlog items until those features exist)

### Deliverable

Users can create and manage Ideas.

---

## Stage 2 — Idea Workspace

### Goal

Create the primary songwriting interface.

### Tasks

- Create Idea workspace
- Navigation bar
- Editable title
- Lyrics editor
- Settings gear
- Scrollable Layer stack
- Persistent Record button
- Empty-state UI

### Deliverable

Users can create complete musical ideas consisting of lyrics and recorded Layers.

---

## Stage 3 — Project Settings

### Goal

Configure musical timing.

### Tasks

- Settings sheet
- Tempo selector
- Time signature selector
- Loop length selector
- Default:

  - 60 BPM
  - 4/4
  - 4 Bars

- Save settings

### Deliverable

Each Idea controls its own timing.

---

## Stage 4 — Recording Engine

### Goal

Record audio reliably.

### Tasks

- Microphone permissions
- Record audio
- Stop recording
- Save recording
- Playback
- Recording indicator
- Processing state

### Deliverable

Single-layer recording works reliably.

---

## Stage 5 — Layer Management

### Goal

Support multiple musical ideas.

### Tasks

- Add Layer
- Rename Layer
- Delete Layer
- Swipe actions
- Export Layer
- Mute
- Solo
- Layer ordering

### Deliverable

Multi-layer Ideas.

---

## Stage 6 — Loop Engine

### Goal

Synchronize playback.

### Tasks

- Loop playback
- Automatic looping
- Gapless playback
- Synchronize Layers
- Stop at loop boundary
- Latency improvements

### Deliverable

Reliable synchronized looping.

---

## Stage 6.5 — Loop Interpretation

### Goal

Separate recording from playback.

### Tasks

- Stop recording immediately when the user taps Stop.
- Store the exact recorded audio duration.
- Compute the playback loop length (1, 2, 4, or 8 bars) after recording completes.
- Store loop length as metadata, independent of the audio file.
- Update the loop engine to repeat according to loopLengthBars, not the recording duration.
- Preserve synchronized playback across all Layers.
- Keep the original recording untouched.

### Deliverable

Audio is always captured exactly as performed while playback automatically loops at musically appropriate bar lengths.

---

## Stage 7 — Metronome

### Goal

Improve recording timing.

### Tasks

- Audio metronome
- Haptic metronome
- 4-beat count-in
- Respect tempo
- Respect time signature
- Enable/disable metronome

### Deliverable

Musically accurate recording workflow.

### Additional Tasks

### Additional Tasks

- Implement a musical timeline at the bottom of the workspace.
- Display beats and bars using simple tick marks.
- Display a linear playback indicator that moves across the timeline during count-in, recording, and playback.
- Synchronize the playback indicator with the project tempo and time signature.
- Use constant linear motion (no spring, easing, or damping).
- Reset the playback indicator to the beginning at the start of each loop.
- Clearly distinguish bar markers from beat markers.
- Keep the timeline informational only; it should not support scrubbing, editing, or waveform manipulation.
- Ensure the timeline serves as a reliable visual timing reference while maintaining the app's clean, non-DAW interface.

---

## Stage 8 — MIDI Pipeline

### Goal

Convert recordings into editable musical data.

### Tasks

- Pitch detection research
- Prototype audio → MIDI
- Quantization
- Pitch correction
- Internal MIDI representation

### Deliverable

Basic humming produces usable MIDI.

---

## Stage 9 — Offline Rendering Engine

### Goal

Render MIDI into instrument audio, offline.

### Tasks

- Offline instrument rendering engine (MIDI → audio file, never real-time synthesis)
- Piano
- Guitar
- Bass
- Strings
- Synth
- Pads
- Instrument switching
- Rendered-audio caching with background invalidation/regeneration

### Deliverable

A Layer with MIDI enabled plays back as rendered instrument audio — indistinguishable to the playback engine from an original recording. The playback engine never schedules or synthesizes MIDI in real time; its only responsibility is synchronized audio-file playback.

### Additional Tasks

- Implement expandable Layer cards.
- Expand a Layer when the user taps the Layer card (excluding playback controls).
- Animate expansion vertically, similar to Apple Voice Memos.
- Add a MIDI toggle (On/Off). When enabled, render the Layer's MIDI data (docs/03_ROADMAP.md Stage 8) into an audio file using the selected instrument in the background, then play that rendered file; when disabled, play the original recording. The original recording is never modified or deleted.
- Add an instrument selector (visible only when MIDI is enabled).
- Add a horizontal volume slider.
- Add expandable audio effects with simple intensity options:
  - Off
  - Low
  - Medium
  - High
- Design the expanded Layer view to accommodate future controls without resembling a DAW.

---

## Stage 9.5a — Sample-Based Instrument Library

### Goal

Replace procedural instrument synthesis with high-quality sample-based instruments rendered offline via a lightweight SoundFont or equivalent sample library.

### Tasks

- Integrate a lightweight, permissively licensed sample-based instrument library (e.g. SoundFont).
- Replace procedural oscillators/envelopes with sample playback during offline rendering.
- Support offline rendering only (never real-time synthesis).
- Maintain rendered-audio caching.
- Invalidate and regenerate cached renders whenever:
>> MIDI changes
>> Instrument changes
- xpand the instrument library to include:
>> Piano
>> Electric Piano
>> Guitar
>> Bass
>> Strings
>> Synth Lead
>> Pads
- Keep the renderer generic so additional instruments can be added without architectural changes.
- Continue rendering instrument output into a standard audio file used by the playback engine.

### Stage 9.5A — SoundFont Validation (complete)

A dedicated first step, proving the library/asset choice before building the
renderer itself. Library evaluated and chosen: `soundfont2` (Mrtenz, MIT,
TypeScript, zero native dependencies — pure JS, so identical on iOS and
Android). Rejected alternatives: real-time RN SoundFont players (no offline
rendering support), a native `AVAudioUnitSampler`-based renderer (iOS-only,
no existing Expo module, contradicts the project's no-native-modules
architecture), Web-Audio-API-based players (no Web Audio in RN/Hermes).

Bundled asset: `assets/instruments/upright-piano-kw.sf2` (Upright Piano KW,
FreePats project, CC0 public domain, no attribution required), bundled via
the same `metro.config.js` `assetExts` + `expo-asset` mechanism already
proven for the CREPE `.onnx` model. Loader: `src/utils/soundfont-loader.ts`.

Verified directly against the installed package's actual source/types (not
assumed): `getKeyData(midiKey, bank, preset)` returns a `Key` exposing the
matched `Sample` (`Int16Array` PCM, sample rate, root key/`originalPitch`,
pitch correction, loop start/end — pre-adjusted to be relative to that
sample's own sliced data array) plus zone-level `generators`
(`SampleModes`, `CoarseTune`/`FineTune`, `OverridingRootKey`,
`InitialAttenuation`, the volume-envelope generators) and `preset`/
`instrument` mapping. All metadata required for a renderer is present.
Parsed the bundled file for MIDI 60 (middle C) and exported the raw,
unmodified sample as a WAV file to confirm the parser produces real,
non-silent, well-formed audio (44.1kHz, ~8s, loop points valid).

Not yet built: the renderer itself (pitch-shifting/resampling, looping,
envelope, mixing into the existing PCM pipeline) and the
`renderMode`/renderer-dispatch mechanism on `InstrumentDefinition`.

### Renderer (complete for Piano)

`InstrumentDefinition` is now a discriminated union on `renderMode`
(`'synth'` | `'soundfont'`) — `ensureLayerRenderCached` dispatches on this
one field, so a future sampled instrument needs only its own
`SoundFontInstrumentDefinition`, never a renderer-selection change.
`src/utils/soundfont-renderer.ts` implements sample-based rendering:
per-note pitch-shift (root key + coarse/fine tune generators + sample pitch
correction, linear-interpolation resampling — not cubic/sinc, an explicitly
deferred optimization), loop-point playback for sustained notes, a simple
fixed attack/release fade (not the SF2 spec's full volume-envelope
generators — deferred), additive mixing for correct polyphony/chords, and
the same `softClip` safety net as the synth renderer. `PIANO_DEFINITION`
now points at this renderer instead of procedural synthesis.

Verified incrementally (single note → chord → melody → a fuller 8-note
layer with overlapping/sustained/short notes), including autocorrelation
pitch-accuracy checks against each note's expected frequency (all within
~5 cents of the earlier-observed worst case), confirmed additive mixing for
chords, confirmed loop points keep a sustained note sounding well past the
raw sample's own natural length, and confirmed silence both before/after
notes and in the deliberate trailing tail.

Not yet done: instrument switching/UI, additional sampled instruments,
resampling-quality or performance optimization — all explicitly deferred
per this stage's own incremental scope.

### Bundled instrument library reconsidered: GeneralUser GS

The initial 57MB single-instrument piano SoundFont (Upright Piano KW) was
replaced with **GeneralUser GS** (~30MB), a General MIDI soundfont covering
all 128 GM instruments in one file — chosen deliberately over maximizing
one instrument's realism, since this app's goal is inspiring, listenable
recordings, not professional sample-library fidelity. Verified directly
(not assumed): every instrument named in this stage's own instrument list
(Piano, Electric Piano, Guitar, Bass, Strings, Synth Lead, Pad) is present
as a real, distinctly-sampled preset at its standard GM program number.
License: explicit unrestricted commercial use, no attribution required, 25
years of real-world commercial use with no known claims (full text:
`assets/instruments/generaluser-gs-LICENSE.txt`). Considered and rejected:
full FluidR3 GM (MIT, but 144MB — worse on the size goal), FluidR3Mono
(12.6MB, but SF3/OGG-compressed — `soundfont2` only reads raw PCM, would
need a new decoder dependency).

One bundled file now backs every current and future sample-based
instrument — adding one means a new `SoundFontInstrumentDefinition`
pointing at a different bank/preset in the same file, not a new asset.

Renderer re-verified against the new file end-to-end (single note → chord
→ melody → sustained note). One investigation worth recording: initial
pitch checks showed ~15-17 cents of apparent sharpness, tighter than the
first SoundFont's ~2-5 cents. Traced directly (not assumed) to the raw,
completely unprocessed sample itself already measuring ~7 cents off pure
pitch, plus this preset's own +4 cent `FineTune` generator — isolating
every renderer stage (resampling, fade, envelope, gain) individually
confirmed zero additional error contributed by the rendering code itself.
This is the source data's own natural tuning, not a rendering bug — normal
for real acoustic samples, inaudible in musical context.

### Full instrument roster live; velocity-layer selection bug fixed

All 7 roadmap instruments (Piano, Electric Piano, Guitar, Bass, Strings,
Synth, Pad) now render sample-based from GeneralUser GS, replacing the
hand-crafted procedural definitions for Electric Piano/Synth/Pad.
`InstrumentSelector` needed no changes — it already iterated
`ALL_INSTRUMENTS` generically. `SynthInstrumentDefinition` and
`instrument-renderer.ts`'s procedural renderer are kept as working,
tested infrastructure for a possible future instrument, even though
nothing currently uses them.

Fixed along the way: `soundFont2.getKeyData()` only filters zones by key
range — it has no velocity parameter at all, and its own docstring admits
as much. For a velocity-layered instrument (soft/loud samples covering the
same key range via a `VelRange` generator, like this piano), that meant it
silently returned whichever velocity-layer zone happened to be listed
first in the SF2 file for a given key — a property of file ordering, not
performance. Audibly this presented as different notes randomly switching
between a soft and loud sample character. Replaced with
`soundfont-renderer.ts`'s own `findKeyData`, which filters by both key
range and velocity range against one fixed "medium" velocity
(`FIXED_VELOCITY = 90`) for every note — real velocity-sensitive playback
(reading each note's own recorded velocity) is deferred, not implemented
partially. Verified: the same melody rendered at velocity 20 vs. 127 now
produces byte-identical output.

### Deliverable

MIDI Layers render into realistic sampled instruments that play back as ordinary audio files. Instrument switching simply regenerates the rendered audio in the background while leaving the playback engine completely unaware of the rendering process.


## Stage 9.5b — Offline Audio Effects

### Goal

Apply audio effects during offline rendering so playback remains simple audio-file playback.

### Tasks
- Extend the offline rendering pipeline to support audio effects.
- Implement:
>> Reverb
>> Delay
>> Distortion
- Apply effects only during offline rendering (never during playback).
- Re-render automatically whenever:
>> Effect type changes
>> Effect intensity changes
- Preserve rendered-audio caching.
- Keep the original recording and rendered instrument audio unchanged until a new render completes.
- Continue allowing effect controls from the expanded Layer UI.
- Design the rendering pipeline so additional effects (EQ, compression, chorus, flanger, etc.) can be added later without modifying the playback engine.

### Deliverable

Users can apply effects to MIDI-rendered instruments through simple controls. Effects are baked into the rendered audio, and playback continues to consist solely of synchronized audio-file playback with no real-time DSP.


## Stage 10 — Export

### Goal

Allow users to keep and share ideas.

### Tasks

- Export entire Idea
- Export Layer
- Share Sheet
- Prepare MIDI export
- Prepare stem export architecture

### Deliverable

Projects are portable.

---

## Stage 11 — UI Polish

### Goal

Make the app feel native.

### Tasks

- Micro animations
- Recording animations
- Playback animations
- Haptics
- Accessibility
- Dark Mode
- Performance optimization

### Deliverable

Production-quality user experience.

---

## Stage 12 — Premium Architecture

### Goal

Prepare for future monetization.

### Tasks

- Feature gating
- Layer limits
- Premium instruments
- Sound library architecture
- Upgrade prompts
- Purchase abstraction

### Deliverable

Premium-ready architecture without affecting free users.

---

# Development Rules

- Complete one stage before beginning the next.
- Do not skip stages.
- Every stage must end with a working application.
- Refactor immediately if a stage introduces technical debt.
- Do not implement future-stage features early unless required as infrastructure.
- Follow all specifications in PROJECT_VISION.md, UI_SPEC.md, and TECH_SPEC.md.
- If implementation conflicts with any specification, stop and request clarification.
