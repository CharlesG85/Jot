# 03_ROADMAP.md

# Development Roadmap

## Stage 0 — Architecture & Project Setup

### Goal

Create a scalable foundation before implementing any features.

### Tasks

* Create Expo project using Development Builds (NOT Expo Go)
* Configure TypeScript
* Configure Expo Router
* Configure Zustand
* Configure SQLite
* Configure Expo File System
* Configure Git
* Create feature-first folder structure
* Create theme constants
* Create shared color palette
* Create typography constants
* Define Idea model
* Define Layer model
* Create Audio Service interface
* Create Storage Service interface
* Configure ESLint & Prettier
* Verify app builds successfully on iOS

### Deliverable

A clean, scalable architecture with no placeholder code.

---

## Stage 1 — Home Screen

### Goal

Create the notebook experience.

### Tasks

* Build Notes-style home screen
* Display Idea list
* Create floating "New Idea" button
* Create new Idea
* Rename Idea
* Delete Idea
* Persist Ideas locally
* Sort by modified date

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

* Settings sheet
* Tempo selector
* Time signature selector
* Loop length selector
* Default:

  * 60 BPM
  * 4/4
  * 4 Bars
* Save settings

### Deliverable

Each Idea controls its own timing.

---

## Stage 4 — Recording Engine

### Goal

Record audio reliably.

### Tasks

* Microphone permissions
* Record audio
* Stop recording
* Save recording
* Playback
* Recording indicator
* Processing state

### Deliverable

Single-layer recording works reliably.

---

## Stage 5 — Layer Management

### Goal

Support multiple musical ideas.

### Tasks

* Add Layer
* Rename Layer
* Delete Layer
* Swipe actions
* Export Layer
* Mute
* Solo
* Layer ordering

### Deliverable

Multi-layer Ideas.

---

## Stage 6 — Loop Engine

### Goal

Synchronize playback.

### Tasks

* Loop playback
* Automatic looping
* Gapless playback
* Synchronize Layers
* Stop at loop boundary
* Latency improvements

### Deliverable

Reliable synchronized looping.

---

## Stage 7 — Metronome

### Goal

Improve recording timing.

### Tasks

* Audio metronome
* Haptic metronome
* 4-beat count-in
* Respect tempo
* Respect time signature
* Enable/disable metronome

### Deliverable

Musically accurate recording workflow.

---

## Stage 8 — MIDI Pipeline

### Goal

Convert recordings into editable musical data.

### Tasks

* Pitch detection research
* Prototype audio → MIDI
* Quantization
* Pitch correction
* Internal MIDI representation

### Deliverable

Basic humming produces usable MIDI.

---

## Stage 9 — Instrument Engine

### Goal

Play MIDI musically.

### Tasks

* Instrument system
* Piano
* Guitar
* Bass
* Strings
* Synth
* Pads
* Instrument switching

### Deliverable

Ideas play back using lightweight instruments.

---

## Stage 10 — Export

### Goal

Allow users to keep and share ideas.

### Tasks

* Export entire Idea
* Export Layer
* Share Sheet
* Prepare MIDI export
* Prepare stem export architecture

### Deliverable

Projects are portable.

---

## Stage 11 — UI Polish

### Goal

Make the app feel native.

### Tasks

* Micro animations
* Recording animations
* Playback animations
* Haptics
* Accessibility
* Dark Mode
* Performance optimization

### Deliverable

Production-quality user experience.

---

## Stage 12 — Premium Architecture

### Goal

Prepare for future monetization.

### Tasks

* Feature gating
* Layer limits
* Premium instruments
* Sound library architecture
* Upgrade prompts
* Purchase abstraction

### Deliverable

Premium-ready architecture without affecting free users.

---

# Development Rules

* Complete one stage before beginning the next.
* Do not skip stages.
* Every stage must end with a working application.
* Refactor immediately if a stage introduces technical debt.
* Do not implement future-stage features early unless required as infrastructure.
* Follow all specifications in PROJECT_VISION.md, UI_SPEC.md, and TECH_SPEC.md.
* If implementation conflicts with any specification, stop and request clarification.
