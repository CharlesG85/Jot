# 01_UI_SPEC.md

# UI Specification

## Design Goal

The application should feel like a native iOS creative notebook.

The primary inspirations are:

* Apple Notes
* Voice Memos
* Apple Music

The application should not visually resemble:

* GarageBand
* Logic Pro
* Ableton
* Traditional DAWs

The user should feel like they are capturing ideas, not producing a song.

---

# General Design Principles

Priorities:

1. Simplicity
2. Speed
3. Thumb-friendly interaction
4. Clear hierarchy
5. Minimal visual clutter

Avoid:

* Dense controls
* Technical terminology
* Timelines
* Mixer interfaces
* Complex menus

---

# Platform Style

Primary target:

iOS

Secondary target:

Android if implementation cost remains low.

Design should follow iOS conventions first.

Use:

* System typography
* Native spacing
* Rounded cards
* Large touch targets
* Familiar gestures

---

# Navigation Structure

Application hierarchy:

Home Screen

↓

Idea Workspace

↓

Layer Interaction

---

# Home Screen

Purpose:

A notebook of musical ideas.

The Home Screen should resemble Apple Notes.

Components:

## Idea List

Each Idea card displays:

* Title
* Last modified date
* Optional waveform preview
* Optional instrument indicator

Cards should be:

* Rounded rectangles
* Spacious
* Easy to scan

---

## Create Idea Button

Large floating action button.

Purpose:

Immediately create a new musical idea.

---

# Idea Workspace

Purpose:

The main creative environment.

Layout:

## Top Navigation

Contains:

Left:

* Back button

Center:

* Idea title

Right:

* Settings gear icon

---

# Idea Settings

Opened through the gear icon.

Settings include:

## Tempo

Default:

60 BPM

User can adjust tempo.

Purpose:

Allow slower humming and flexible ideas.

---

## Time Signature

Supported:

* 4/4
* 3/4

Default:

4/4

---

## Loop Length

Default:

4 bars

Future expansion possible.

---

# Layer Stack

The main workspace displays Layers vertically.

The design should feel like stacked musical ideas, not tracks.

Avoid:

* Horizontal timelines
* Track lanes
* DAW layouts

---

# Layer Card

Each Layer is represented as a rounded card.

Contains:

* Layer name
* Instrument icon
* Mute icon
* Solo icon
* Playback visualization
* Optional waveform

---

# Layer Interaction

Tap:

Select layer.

Swipe left:

Reveal actions:

* Delete
* Export

Interaction should mimic Apple Voice Memos.

---

# Record Button

The most important UI element.

Requirements:

* Fixed bottom position
* Thumb accessible
* Large circular button
* Clear recording state

States:

Idle:

* Ready to record

Recording:

* Active visual feedback

Processing:

* Conversion/loading state

---

# Playback Visualization

Do not use traditional timelines.

Preferred approaches:

* Animated waveform
* Circular loop progress
* Pulsing indicators

The visualization should communicate musical timing without feeling technical.

---

# Controls

Use icons instead of text whenever possible.

Examples:

Use:

* Play icon
* Pause icon
* Trash icon
* Export/share icon
* Gear icon

Avoid buttons labeled:

* Play
* Stop
* Delete
* Export

---

# Color System

Style:

* Soft gradients
* Pleasant musical colors
* Subtle contrast
* Rounded corners

Avoid:

* Harsh professional audio colors
* Dark DAW aesthetic
* Excessive visual complexity

---

# Animation

Animations should communicate state.

Examples:

Recording:

* Pulse animation

Playback:

* Moving indicator

Layer changes:

* Smooth transitions

Avoid unnecessary animation.

---

# Accessibility

Requirements:

* Dynamic text support
* Large touch targets
* VoiceOver compatibility
* Clear contrast

---

# Future UI Considerations

Possible future additions:

* Lyrics notes
* Tags
* Favorites
* Folders
* Search
* AI assistance

Do not implement unless added to roadmap.
