# 02_TECH_SPEC.md

# Technical Specification

## 1. Philosophy

This application prioritizes:

1. Native feel
2. Low latency
3. Offline-first architecture
4. Maintainability
5. Simplicity
6. Performance
7. Modularity

Always choose the simplest architecture that scales.

Avoid premature optimization.

---

# 2. Primary Platform

Primary target:

* iPhone (iOS)

Future support:

* Android

Architect the application so Android support can be added with minimal changes, but optimize implementation decisions for iOS first.

---

# 3. Technology Stack

Framework

* Expo SDK
* Expo Development Builds (NOT Expo Go)
* React Native
* TypeScript
* Expo Router
* Node.js

Development

* VS Code
* Xcode
* Git
* GitHub

---

# 4. Required Packages

Navigation

* expo-router

State

* zustand

Storage

* expo-sqlite
* expo-file-system

Sharing

* expo-sharing

Styling

* expo-linear-gradient

Animation

* react-native-reanimated

Gestures

* react-native-gesture-handler

Icons

* @expo/vector-icons

Future (only when needed)

* react-native-skia
* react-native-mmkv

Do not install packages until they are required by the roadmap.

---

# 5. Folder Structure

Use feature-first architecture.

/
app/
assets/
components/
features/
hooks/
services/
storage/
models/
utils/
constants/
types/
docs/

Feature folders should encapsulate UI, hooks, services, and utilities related to a single feature whenever practical.

---

# 6. State Management

Use Zustand.

Global state should remain minimal.

Persist only application state that must survive app restarts.

Prefer local component state whenever possible.

---

# 7. Data Model

Idea

* id
* title
* tempo
* timeSignature
* loopLength
* createdAt
* updatedAt

Layer

* id
* name
* instrument
* muted
* solo
* volume
* audioPath
* midiData

Keep models independent from UI.

---

# 8. Audio Architecture

Audio should be isolated behind a service layer.

UI components must never directly communicate with native audio APIs.

Example architecture:

UI

↓

Hooks

↓

Audio Service

↓

Native Audio Engine

This allows future replacement of the recording engine without changing UI code.

---

# 9. Storage Architecture

Store all data locally.

Use SQLite for metadata.

Use the file system for recordings.

Never embed large binary data inside SQLite.

---

# 10. Rendering

Keep UI rendering separate from audio processing.

Heavy audio work should never block animations.

Avoid unnecessary re-renders.

Memoize expensive components where appropriate.

---

# 11. Navigation

Use Expo Router exclusively.

Avoid custom navigation solutions.

---

# 12. Styling

Use React Native StyleSheet.

Avoid UI component libraries.

Avoid Tailwind.

Keep styling centralized.

Shared values belong inside constants.

---

# 13. Icons

Prefer SF Symbols through @expo/vector-icons on iOS.

Icons should replace text whenever practical.

---

# 14. Performance Targets

Cold launch should feel instant.

Recording should begin immediately.

Playback should remain synchronized.

UI should maintain approximately 60 FPS.

Scrolling should remain smooth regardless of project count.

---

# 15. Error Handling

Never silently fail.

Handle:

* Permission denial
* Missing files
* Audio failures
* Storage failures

Display clear, user-friendly messages.

---

# 16. Code Standards

Strict TypeScript.

Small components.

Feature-first organization.

Single Responsibility Principle.

Composition over inheritance.

Avoid files exceeding roughly 300 lines when practical.

Prefer reusable hooks over duplicated logic.

Separate:

* UI
* Business Logic
* Audio
* Storage
* Utilities

---

# 17. Git Standards

One feature per commit whenever practical.

Write descriptive commit messages.

Keep the main branch stable.

Create feature branches for larger additions.

---

# 18. Future-Proofing

The architecture should allow future addition of:

* Premium features
* Additional instruments
* MIDI editing
* Lyrics
* Cloud sync
* AI-assisted songwriting
* Widgets
* Apple Watch support

Adding these features should require extending existing architecture rather than replacing it.
