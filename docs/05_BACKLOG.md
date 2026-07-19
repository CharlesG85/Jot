# 05_BACKLOG.md

# Product Backlog

This document contains ideas for future development.

Items in this document are **not approved for implementation** until they are promoted to the Roadmap.

The backlog exists to capture ideas without affecting the current architecture or development priorities.

---

# Premium Features

## Unlimited Layers

Remove the free layer limit.

Priority:
Medium

---

## Premium Instruments

Examples:

- Grand Piano
- Upright Piano
- Acoustic Guitar
- Electric Guitar
- Nylon Guitar
- Choir
- Brass
- Orchestral Strings
- Analog Synths
- Pads

Priority:
Medium

---

## Expanded Sound Libraries

Allow users to download additional instrument packs.

Priority:
Low

---

## Advanced Export

Possible additions:

- MIDI Export
- WAV Export
- AIFF Export
- Stems
- ZIP Export

Priority:
Medium

---

# Songwriting Feature

## Chord Suggestions

Generate chord suggestions from recorded melodies.

Priority:
Medium

---

## Chord Detection

Detect implied chords from MIDI.

Priority:
Medium

---

## Song Sections

Examples:

- Verse
- Chorus
- Bridge
- Intro
- Outro

Priority:
Low

---

## Favorite Ideas

Allow Ideas to be pinned.

Priority:
Medium

---

## Search

Search by title promoted to the Roadmap (Stage 1, 2026-07-09).

Remaining:

- Lyrics
- Tags

Priority:
High

---

## Tags

Examples:

- Worship
- Pop
- Country
- Ballad
- Demo

Priority:
Medium

---

## Folders

Organize Ideas into folders.

Priority:
Medium

---

# Audio Features

## Better Quantization

Support additional quantization options.

Priority:
Medium

---

## Better Pitch Detection

Improve melody recognition.

Priority:
High

---

## Mid-project Tempo Change

Changing an Idea's tempo (or time signature) after MIDI Layers already exist
does not retroactively re-quantize or re-render them — a Layer's rendered
audio keeps reflecting whatever tempo was current when it last rendered.

A working re-quantize-on-tempo-change implementation was built and verified
(re-running `quantizeNoteTiming` against each MIDI-enabled Layer's raw MIDI
data whenever tempo/time signature changed), but was deliberately reverted:
changing tempo mid-project may not be a workflow this app wants to support
at all, so it's not worth carrying the complexity until that's decided.

If revisited, worth re-examining from scratch rather than resurrecting the
reverted `useEffect` verbatim — e.g. whether tempo should be lockable per
Idea instead, and whether re-quantization should be automatic or an
explicit user-triggered action given it changes previously-recorded timing.

Priority:
Low

---

## Haptic Feedback During Recording

A haptic metronome (one Haptics.impactAsync call per beat, with a stronger
accent on the downbeat) was fully built and wired to the recording
Transport's own per-frame beat counter — confirmed via on-device logs that
it fires correctly on every beat — but produces no felt haptic once actual
recording starts. Confirmed via Apple's own documentation: iOS deliberately
silences UIFeedbackGenerator/Core Haptics while an audio session is
actively recording, specifically to keep the Taptic Engine's vibration out
of the microphone. Not a bug in this app's code or scheduling.

The documented fix is a native-only API,
`AVAudioSession.setAllowHapticsAndSystemSoundsDuringRecording(true)`, which
neither `expo-audio` nor `expo-haptics` expose — reaching it would mean this
project's first native module (a small Expo local module in Swift), which
was deliberately declined. Shelved in favor of a visual metronome instead
(see the beat-pulse-envelope-driven system in workspace-screen.tsx,
timeline.tsx, record-button.tsx, and beat-pulse-glow.tsx).

Count-in's own haptic (use-count-in.ts) is unaffected — the mic isn't live
yet during count-in, so haptics fire normally there.

If revisited, this requires accepting a native module and a dev-client
rebuild; there is no pure-JS/Expo-managed workaround.

Priority:
Low

---

## Harmony Detection

Detect harmonies from multiple Layers.

Priority:
Low

---

## Instrument Humanization

Natural timing variation.

Priority:
Low

---

## Velocity-Sensitive Instrument Playback

The SoundFont renderer (docs/03_ROADMAP.md Stage 9.5a) currently ignores
each note's own recorded velocity for sample-based instruments — every
note uses one fixed "medium" velocity (`FIXED_VELOCITY` in
soundfont-renderer.ts), both for which sample gets picked (soft vs. loud
velocity layer) and for amplitude. This was deliberate: `soundfont2`'s own
`getKeyData()` has no velocity parameter, so using each note's real
velocity naively picked whichever velocity-layer zone happened to be
listed first in the SF2 file for a given key, independent of how the note
was actually performed — audibly, different notes randomly switching
between a soft and loud sample character. A per-note-velocity-aware
zone lookup (already half-built as `findKeyData`, just needs the fixed
velocity replaced with each note's own) plus a decision on how to map
recorded loudness to a musically sensible velocity value are both real,
separate follow-up work.

Priority:
Medium

---

## Real Effects Processing

Stage 9 shipped the Off/Low/Medium/High effects-intensity control and
persists the setting per Layer, but it doesn't yet alter rendered audio —
no EQ, reverb, or delay is actually applied. This is separate, real DSP
work.

Priority:
Medium

---

## Audio Cleanup

Reduce background noise.

Priority:
Medium

---

## Multiple Count-in Lengths

Options:

- None
- 1 Bar
- 2 Bars

Priority:
Low

---

## Alternate Time Signatures

Possible additions:

- 2/4
- 5/4
- 6/8
- 7/8

Priority:
Low

---

# Collaboration

## Share Projects

Priority:
Low

---

## iCloud Sync

Priority:
Medium

---

## Cross-device Sync

Priority:
Medium

---

# AI Features

## Melody Cleanup

Improve sung melodies.

Priority:
Low

---

## Harmony Suggestions

Priority:
Low

---

## Chord Progression Suggestions

Priority:
Low

---

## Instrument Recommendations

Priority:
Low

---

# Apple Ecosystem

## Apple Watch Recording

Capture ideas directly from Apple Watch.

Priority:
Low

---

## Widgets

Quick recording widget.

Priority:
Medium

---

## Siri Shortcuts

Examples:

"Start a new musical idea."

Priority:
Medium

---

## Live Activities

Recording progress.

Priority:
Low

---

## Dynamic Island

Recording controls.

Priority:
Low

---

# Android

## Android Support

Adapt UI for Android while preserving the application's identity.

Priority:
Medium

---

# Maintenance Rules

- Backlog items should never be implemented automatically.
- A backlog item must first be promoted into the Roadmap before development begins.
- Remove completed backlog items once they are fully implemented.
- Keep this document focused on future possibilities rather than implementation details.
