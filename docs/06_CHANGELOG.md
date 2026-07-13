# 06_CHANGELOG.md

# Changelog

This document tracks user-facing changes between application versions.

Follow the principles of Keep a Changelog.

Only record completed features.

Do not record work in progress.

---

# [Unreleased]

## Added

* Nothing yet.

## Changed

* Nothing yet.

## Fixed

* Nothing yet.

---

# [0.10.0] - 2026-07-12

### Fixed

* Recordings made with the count-in enabled could end up containing almost no real audio, regardless of how long the recording was held. Recording now always captures exactly what was performed.

### Changed

* The count-in now plays exactly one beat per beat of the Idea's time signature (3 beats for 3/4, 4 for 4/4, etc.) instead of always counting in four, and always ends on the downbeat.
* The count-in no longer plays an audio click — it now uses haptic feedback and an on-screen beat indicator only.

---

# [0.9.0] - 2026-07-12

### Changed

* Tapping Stop now ends a recording immediately — it no longer waits for the next bar boundary.
* A Layer's playback loop length is now chosen automatically after recording, from the actual length performed, rounding up to the nearest musically useful length (1, 2, 4, or 8 bars) rather than stretching the recording itself to fit.
* Original recordings are always saved exactly as performed; loop length is stored separately and only affects how a Layer repeats during synchronized Idea playback.

---

# [0.8.0] - 2026-07-10

### Added

* A four-beat count-in plays before recording, with audio clicks and haptic taps, spaced to the Idea's tempo and accenting each bar's downbeat.
* Metronome toggle in Idea Settings to turn the count-in on or off (on by default).

---

# [0.7.1] - 2026-07-10

### Changed

* A Layer's recording length now always rounds to a whole number of bars, so a recording that's stopped mid-bar keeps going a moment longer until the next bar rather than cutting off early.
* Each Layer now shows its length in bars (e.g. "2 bars") instead of minutes and seconds.

---

# [0.7.0] - 2026-07-10

### Added

* Play an entire Idea: every Layer plays together, looping in sync.
* Mute and Solo now affect Idea playback, and can be toggled while it's playing.
* Recording a new Layer automatically stops at the Idea's loop boundary.

---

# [0.6.0] - 2026-07-09

### Added

* Rename, mute, and solo a Layer.
* Delete or export a Layer via swipe actions.
* Reorder Layers in an edit mode with animated drag handles.

---

# [0.5.0] - 2026-07-09

### Added

* Record audio into a new Layer from the Idea Workspace.
* Layer playback.
* Microphone permission handling.
* Recording and processing indicators on the Record button.

---

# [0.4.0] - 2026-07-09

### Added

* Idea Settings sheet (tempo, time signature, loop length), opened from the Workspace's gear icon.

---

# [0.3.0] - 2026-07-09

### Added

* Idea Workspace screen, opened by tapping an Idea.
* Editable Idea title from the Workspace.
* Lyrics editor with autosave.

### Changed

* Tapping an Idea card now opens its Workspace; tapping its title still renames it inline.

---

# [0.2.0] - 2026-07-09

### Added

* Search Ideas by title.

---

# [0.1.0] - 2026-07-09

### Added

* Notes-style Idea list.
* Create Idea.
* Rename Idea.
* Delete Idea.
* Persistent local storage.

---

# Version Template

## [Version Number] - YYYY-MM-DD

### Added

* New features added during this release.

### Changed

* Existing functionality that changed.

### Fixed

* Bugs resolved.

### Improved

* Performance improvements.
* UI refinements.
* Accessibility improvements.

### Removed

* Deprecated functionality removed.

---

# Example

## [0.1.0] - 2026-07-07

### Added

* Notes-style Idea list.
* Create Idea.
* Rename Idea.
* Delete Idea.
* Persistent local storage.

### Improved

* Native iOS navigation.
* Faster application startup.

### Fixed

* Initial project setup issues.

---

# Versioning

Use Semantic Versioning.

Major (1.0.0)
Breaking architectural or user-facing changes.

Minor (0.2.0)
New functionality without breaking compatibility.

Patch (0.2.1)
Bug fixes and small improvements.

---

# Release Rules

* Every completed Roadmap stage should result in a new version.
* Update this file only after a stage is fully completed.
* Keep entries concise and user-focused.
* Do not include implementation details.
