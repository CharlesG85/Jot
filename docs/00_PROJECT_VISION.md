# 00_PROJECT_VISION.md

# Musical Ideas — Product Vision

## Vision

Musical Ideas is a lightweight musical notebook designed to capture inspiration before it disappears.

The application prioritizes speed, simplicity, and creative flow over production capabilities. It is intentionally **not** a Digital Audio Workstation (DAW). Users should never feel like they are editing a song—they should feel like they are capturing an idea.

The ideal workflow is:

Open app → Select or create an Idea → Tap Record → Hum or sing → Stop recording → Continue creating or close the app.

Everything in the application should support this workflow.

---

# Core Principles

1. Recording should begin in a single tap.
2. The interface should require as few interactions as possible.
3. Every feature should reduce creative friction.
4. The application should feel native on iOS.
5. Projects should open instantly.
6. All user data should remain local by default.
7. The application should remain useful without an internet connection.
8. If a proposed feature makes the application resemble a traditional DAW, it should be reconsidered.

---

# Target Audience

Primary users:

* Songwriters
* Musicians
* Producers
* Hobbyists
* Anyone who frequently thinks of melodies away from an instrument

The application is optimized for quickly preserving musical ideas, not producing finished songs.

---

# Product Philosophy

This application combines ideas from:

* Apple Notes
* Voice Memos

It deliberately avoids workflows inspired by:

* GarageBand
* Logic Pro
* Ableton Live
* FL Studio
* Pro Tools

The application should feel more like a notebook than a recording studio.

---

# Primary Object Model

The highest-level object is an **Idea**.

An Idea represents a single musical concept.

Each Idea contains:

- Title
- Lyrics
- Date Created
- Last Modified
- Tempo
- Time Signature
- Loop Length
- Layer Collection

Ideas appear on the Home screen as a scrollable list, similar to Apple Notes.

Selecting an Idea opens the recording workspace.

---

# Layer Model

Each Idea contains one or more Layers.

A Layer represents a single musical performance within the project.

Examples include:

* Melody
* Harmony
* Bass line
* Vocal percussion
* Counter melody

Each Layer contains:

* Unique ID
* Name
* Instrument
* Mute State
* Solo State
* Volume
* Raw Recording
* MIDI Representation (future)
* Export Metadata

Layers inherit all timing information from the parent Idea.

Layers do not have independent tempos or time signatures.

---

# Lyrics Philosophy

Lyrics are considered a first-class part of every Idea.

Many songwriters discover melody and lyrics simultaneously.

The application should allow lyrics to be captured alongside musical Layers without interrupting the creative workflow.

Lyrics should remain lightweight.

This is not intended to be a rich text editor or word processor.

Future versions may support:

- Rich text
- Chord annotations
- Section headings
- Lyric export

The initial implementation should prioritize fast capture and editing.

# Project Timing

Every Idea owns its musical timing.

Supported settings:

Tempo

* Default: 60 BPM

Time Signature

* 4/4
* 3/4

Loop Length

* Default: 4 Bars

All Layers remain synchronized to these settings.

---

# Recording Philosophy

Recording should always be immediately accessible.

The Record button remains fixed at the bottom center of the screen.

Optional count-in:

* Default: Enabled
* Four beats
* Uses current project tempo
* Uses current time signature
* Supports optional haptic feedback

---

# Loop Philosophy

Loops encourage creativity through constraints.

Rules:

* Every Layer uses the project loop length.
* Recording stops automatically at the loop boundary.
* Short recordings automatically repeat.
* Playback should always remain synchronized.
* Playback must remain gapless.

Infinite recordings are intentionally unsupported.

---

# Editing Philosophy

Editing should remain intentionally lightweight.

Supported actions:

* Rename Layer
* Change Instrument
* Mute
* Solo
* Delete
* Export

Advanced waveform editing, trimming, automation, effects chains, and DAW-style timelines are outside the scope of this product.

---

# Export Philosophy

Users own their creations.

Supported exports:

* Entire Idea
* Individual Layer

Future exports:

* MIDI
* Audio Stems

Exports should use the native Share Sheet whenever possible.

No account should be required.

---

# Offline Philosophy

The application is local-first.

Requirements:

* No login
* No mandatory cloud sync
* No subscription required for core functionality
* All recordings stored locally
* Internet connection not required

Future cloud features should remain optional.

---

# Premium Philosophy

The free version should remain genuinely useful.

Possible premium features include:

* Unlimited Layers
* Additional Instruments
* Expanded Sound Libraries
* Advanced Export Options
* Future creative tools

Premium features should extend the application without restricting the core songwriting workflow.

---

# Success Criteria

The application succeeds if a user can capture a musical idea within seconds, continue building it naturally through Layers, and revisit it later without ever feeling like they had to learn a DAW.
