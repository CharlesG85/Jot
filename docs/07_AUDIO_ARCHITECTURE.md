# 07_AUDIO_ARCHITECTURE.md

# Audio Architecture Specification

This document defines architectural constraints, not implementation details. New features should integrate with the existing architecture rather than redesign it. If a proposed feature requires changing these architectural rules, the design should be reviewed before implementation begins.

## 1. Purpose

The audio engine is responsible for:

* Recording
* Playback
* Loop synchronization
* Metronome
* Layer management
* Future MIDI conversion
* Instrument playback
* Exporting

The audio system should remain modular so individual components can be improved without requiring a complete rewrite.

---

# 2. Philosophy

The application is a songwriting notebook, not a Digital Audio Workstation.

The audio engine should prioritize:

* Low latency
* Reliability
* Simplicity
* Predictable behavior
* Fast recording

The user should never have to think about the underlying audio engine.

---

# 3. Recording

Requirements:

* One-tap recording
* Low startup latency
* Immediate visual feedback
* Record into the currently selected Layer
* Automatically stop recording at the loop boundary
* Save recordings locally

---

# 4. Timing

Every Idea owns:

* Tempo
* Time Signature
* Loop Length

Defaults:

* 60 BPM
* 4/4
* 4 Bars

Every Layer inherits these values.

Layers cannot have independent timing.

---

# 5. Count-in & Metronome

Default:

* Enabled

Requirements:

* One-bar count-in (beat count matches the Idea's time signature)
* Respect project tempo
* Respect project time signature
* Haptic feedback, plus an on-screen beat indicator
* No audio click — audio playback couldn't be scheduled precisely enough to
  stay on the beat grid, while haptic/visual timing held up reliably on the
  same schedule, so the count-in relies on those instead

Future versions may revisit an audio click if a more precise scheduling
mechanism becomes available.

---

# 6. Looping

Requirements:

* Gapless looping
* All Layers remain synchronized
* Playback always begins on beat one
* Recording ends automatically at the loop boundary
* Short recordings automatically repeat during playback

The loop engine should remain accurate regardless of the number of Layers.

---

# 7. Playback

Requirements:

* Immediate playback
* Gapless looping
* Mute individual Layers
* Solo individual Layers
* Volume control per Layer

Playback should remain synchronized for the duration of the session.

### Additional Tasks

* Implement a musical timeline at the bottom of the workspace.
* Display beats and bars using simple tick marks.
* Display a linear playback indicator that moves across the timeline during count-in, recording, and playback.
* Synchronize the playback indicator with the project tempo and time signature.
* Use constant linear motion (no spring, easing, or damping).
* Reset the playback indicator to the beginning at the start of each loop.
* Clearly distinguish bar markers from beat markers.
* Keep the timeline informational only; it should not support scrubbing, editing, or waveform manipulation.
* Ensure the timeline serves as a reliable visual timing reference while maintaining the app's clean, non-DAW interface.


---

# 8. Layer Audio

Each Layer may contain:

* A recording
* An assigned instrument (future)
* Playback settings
* Export information

Future versions may also include MIDI data.

Original recordings should always be preserved.

---

# 9. Storage

Store:

* Project metadata in SQLite
* Audio recordings as local files

Do not store audio inside the database.

The application should function entirely offline.

---

# 10. MIDI

MIDI support is planned but not required for the initial release.

Future MIDI functionality should support:

* Melody detection
* Quantization
* Pitch correction
* Instrument playback

The architecture should allow MIDI to be added without redesigning the audio engine.

---

# 11. Export

Initial release:

* Export an entire Idea as a single **.m4a** audio file (the standard compressed audio format on iOS).

Future releases may support:

* Individual Layer export
* MIDI export
* WAV export

Exports should use the native iOS Share Sheet whenever possible.

---

# 12. Error Handling

Gracefully handle:

* Microphone permission denied
* Recording failure
* Playback failure
* Missing audio files
* Export failure

Audio errors should never crash the application.

---

# 13. Performance Goals

The audio engine should provide:

* Fast recording startup
* Low playback latency
* Stable synchronization
* Smooth looping
* Efficient memory usage

Audio processing should never noticeably impact UI responsiveness.

---

# 14. Architectural Rules

* Keep the audio engine independent from the UI.
* Keep recording, playback, storage, and future MIDI processing modular.
* Preserve original recordings.
* Favor simple, maintainable solutions over complex audio processing.
* Optimize for a smooth songwriting experience rather than professional production features.


# 15. Subsystem Responsibilities

Each subsystem should have one primary responsibility.

Transport
- Owns musical timing.
- Schedules musical events.

Recorder
- Owns microphone interaction.
- Starts and stops recordings.
- Does not determine musical timing.

Playback
- Plays audio.
- Synchronizes playback with the Transport.

Metronome
- Produces audible clicks and optional haptics.
- Follows the Transport.

Storage
- Saves and loads recordings.
- Does not participate in timing.

Layer Manager
- Organizes recordings and playback settings.
- Does not schedule playback.

UI
- Displays application state.
- Does not control musical timing directly.


# 16. Dependency Rules

Subsystems should communicate through well-defined interfaces.

The following principles apply:

- The Transport owns musical time.
- Other subsystems consume Transport state.
- UI components should observe state rather than schedule audio.
- React components should not create musical timers.
- Avoid duplicate sources of truth.
- Prefer extending existing systems over introducing parallel timing systems.

Do not introduce a new subsystem unless it has a clear responsibility that cannot reasonably belong to an existing subsystem. When a new subsystem is introduced, it should begin as the smallest implementation that satisfies the current requirements.