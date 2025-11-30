# 🗺️ Oobleck Development Roadmap

This document outlines the planned features and improvements for the Oobleck Non-Newtonian Fluid Synthesizer.

## Phase 1: Interaction & Performance (Current Focus)
- [ ] **Advanced Gesture Controls**: 
    - Implement "pinch" detection for filter resonance.
    - "Swipe" gestures for rapid preset switching.
    - Two-hand tracking for independent oscillator control.
- [ ] **Randomized Button Spawns**:
    - "Whac-a-Mole" style modulation: Temporary floating buttons appear rhythmically; clicking them triggers specific FX shots or fills.
- [ ] **Gamification / Scoring**:
    - Implement a "Combo" system based on rhythm precision and chaos triggering.
    - "Flow State" meter: Sustained interaction builds up a score multiplier.

## Phase 2: Audio Engine Expansion
- [ ] **Improved Synth Engine**:
    - Add 3rd Oscillator with dedicated noise types (Pink, White, Brown).
    - Implement a Modulation Matrix (LFO -> Pitch, Envelope -> Pulse Width).
    - Unison / Detune Spread macro controls.
- [ ] **Live Looper**:
    - Audio input recording (Microphone/Line-in) integrated into the fluid physics.
    - 4-track loop station with overdubbing capabilities.
- [ ] **Drum Sampler Overhaul**:
    - User sample import (Drag & Drop .wav files).
    - Individual drum hit tuning (Pitch, Decay per drum).
    - **Drum Fills**: One-button generative fills based on the current genre.
    - **Buildup & Drop Builder**: A macro knob that automates High-Pass Filter + Reverb + Snare Roll speed for instant transitions.
- [ ] **Arpeggiator Evolution**:
    - Programmable pattern editor (Piano roll for Arp).
    - Polyphonic arpeggiation.
    - Ratcheting (sub-steps) per note.

## Phase 3: Visual & Immersion
- [ ] **Video Feed Integration**:
    - Blend the live webcam feed directly behind the fluid visualizer using composite modes (Overlay, Screen, Difference).
    - Optical flow fluid injection: Moving hands literally "push" the fluid pixels.
- [ ] **UI Improvements**:
    - Fully responsive mobile layout.
    - "Zen Mode": Hides all UI controls, leaving only the visualizer and floating triggers.
    - Custom color themes saved with patches.

## Backlog / Experimental
- [ ] MIDI Support (WebMIDI API) to control Oobleck with physical hardware.
- [ ] Multiplayer Jam Mode (WebSockets) for collaborative noise-making.
- [ ] VR/XR Support for immersive 3D fluid manipulation.
