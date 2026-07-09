# 04_DECISIONS.md

# Architectural Decisions

This document records architectural and product decisions that become the source of truth for future development.

Only record decisions that are intended to persist long-term.

---

## 2026-07-07

### Product

* The application is a musical notebook, not a Digital Audio Workstation (DAW).
* The primary goal is capturing ideas with minimal friction.
* Simplicity is preferred over feature richness.
* Every feature should support rapid songwriting.

### Naming

* The top-level object is called an **Idea**.
* An Idea contains one or more **Layers**.
* Avoid referring to Layers as "Tracks" unless technically required.
* The application should consistently use songwriting terminology rather than production terminology.

### Platform

* iPhone is the primary target platform.
* Android support should be added later without requiring major architectural changes.
* Development uses Expo Development Builds rather than Expo Go.
* Xcode is the primary build environment for iOS.

### Timing

* Default tempo is **60 BPM**.
* Supported time signatures are **4/4** and **3/4**.
* Default loop length is **4 bars**.
* Every Layer inherits timing from its parent Idea.
* Individual Layers do not maintain independent tempo or time signature.

### Recording

* The Record button remains fixed at the bottom of the screen.
* Recording should begin with a single tap.
* Count-in is enabled by default.
* Count-in follows the Idea's tempo and time signature.
* Optional haptic metronome is supported.

### Interface

* Icons are preferred over text buttons whenever practical.
* The interface should resemble Apple Notes and Voice Memos.
* Traditional DAW layouts should be avoided.
* Layer management uses swipe gestures similar to Voice Memos.

### Storage

* The application is local-first.
* Internet access is never required for core functionality.
* Audio files remain on the user's device.
* Metadata is stored separately from recordings.

### Architecture

* UI should never communicate directly with native audio APIs.
* Audio processing should be isolated behind service interfaces.
* Business logic should remain separate from UI.
* Feature-first organization is preferred.

### Monetization

* The free version must remain fully usable.
* Premium features extend the experience but do not remove core functionality.
* Premium architecture should be planned early but implemented later.

---

## 2026-07-09

### Product

* The "Search" Backlog item is partially promoted to Roadmap Stage 1: searching Ideas by title is now in scope.
* Searching by lyrics and tags remains in the Backlog until the Lyrics editor (Stage 2) and Tags (unbuilt Backlog item) exist.

---

# Decision Rules

When making future architectural decisions:

* Append to this document.
* Never remove historical decisions unless intentionally reversing them.
* If a previous decision changes, record the new decision with its date rather than editing history.
* This document is considered a source of truth alongside the specification documents.
