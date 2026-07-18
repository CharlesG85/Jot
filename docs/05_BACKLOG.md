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

* Grand Piano
* Upright Piano
* Acoustic Guitar
* Electric Guitar
* Nylon Guitar
* Choir
* Brass
* Orchestral Strings
* Analog Synths
* Pads

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

* MIDI Export
* WAV Export
* AIFF Export
* Stems
* ZIP Export

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

* Verse
* Chorus
* Bridge
* Intro
* Outro

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

* Lyrics
* Tags

Priority:
High

---

## Tags

Examples:

* Worship
* Pop
* Country
* Ballad
* Demo

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

## Remaining Instrument Palette

Stage 9 shipped with a single synthesized voice (Synth) to prove out the
render/cache architecture. Piano, Electric Piano, and Pad were added later as
new `InstrumentDefinition`s (src/models/instrument.ts), with a tap-to-open
picker panel (InstrumentSelector) replacing the segmented control so the
list can keep growing without a UI redesign. Still deferred, not dropped:

* Guitar
* Bass
* Strings

Each is a new `InstrumentDefinition` — the Renderer itself is already
generic and needs no changes to support them.

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

* None
* 1 Bar
* 2 Bars

Priority:
Low

---

## Alternate Time Signatures

Possible additions:

* 2/4
* 5/4
* 6/8
* 7/8

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

* Backlog items should never be implemented automatically.
* A backlog item must first be promoted into the Roadmap before development begins.
* Remove completed backlog items once they are fully implemented.
* Keep this document focused on future possibilities rather than implementation details.
