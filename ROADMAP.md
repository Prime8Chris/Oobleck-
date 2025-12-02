# 🗺️ Oobleck Development Roadmap

This document outlines the planned features and improvements for the Oobleck Non-Newtonian Fluid Synthesizer.

## Phase 1: Interaction & Performance (Current Focus)
- [x] **Gamification / Scoring**:
    - [x] Combo/Score system based on rhythm and interaction.
    - [x] Local Leaderboard for high scores.
- [x] **Chaos & Patching**:
    - [x] "The Big Save" user slots.
    - [x] Chaos Lock to preserve happy accidents.
- [ ] **Advanced Gesture Controls**: 
    - Implement "pinch" detection for filter resonance.
    - "Swipe" gestures for rapid preset switching.
- [ ] **Visual Polish**:
    - More diverse particle behaviors (boids/flocking).
    - Post-processing bloom overhaul.

## Phase 2: Audio Engine Expansion
- [x] **Improved Synth Engine**:
    - [x] 3rd Oscillator (Sub/Noise) added.
    - [ ] Unison / Detune Spread macro controls.
    - [ ] Modulation Matrix (LFO -> Pitch, Envelope -> Pulse Width).
- [ ] **Live Looper**:
    - Audio input recording (Microphone/Line-in) integrated into the fluid physics.
    - 4-track loop station with overdubbing capabilities.
- [ ] **Drum Sampler Overhaul**:
    - User sample import (Drag & Drop .wav files).
    - **Buildup Builder**: A macro knob that automates High-Pass Filter + Reverb + Snare Roll speed.

## Phase 3: Visual & Immersion
- [x] **Video Feed Integration**:
    - [x] Webcam motion zones implemented.
    - [ ] Optical flow fluid injection: Moving hands literally "push" the fluid pixels.
- [ ] **UI Improvements**:
    - "Zen Mode": Hides all UI controls.
    - Custom color themes saved with patches.

## Backlog / Experimental
- [ ] MIDI Support (WebMIDI API) to control Oobleck with physical hardware.
- [ ] Multiplayer Jam Mode (WebSockets) for collaborative noise-making.
- [ ] VR/XR Support for immersive 3D fluid manipulation.