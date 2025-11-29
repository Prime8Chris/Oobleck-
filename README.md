# Oobleck: Non-Newtonian Fluid Synthesizer

Oobleck is an interactive, browser-based audio synthesizer that translates physical motion into sound. Mimicking the properties of a non-Newtonian fluid, the audio engine reacts differently depending on the velocity of interaction: move slowly for lush, liquid textures, or strike fast for hard, abrasive, solid sounds.

## 🌊 Features

*   **Physics-Based Synthesis:** Velocity and "hardness" modulate filter cutoff, distortion, and FM synthesis in real-time.
*   **Generative Patching:** "Chaos Mode" instantly generates unique patches with randomized oscillators, physics, and visuals.
*   **Motion Control:** Integrated webcam tracking divides the air into 4 interactive zones for hands-free FX triggering and modulation.
*   **Visualizer:** GPU-accelerated particle system that simulates fluid dynamics, complete with particle trails, glow, and reactive camera shake.
*   **Rhythm Engine:** 4-track step sequencer with genre-specific presets (Boom Bap, House, Trap, Dubstep, Metal) and multiple drum kits (808, 909, Acoustic, Industrial).
*   **Performance Tools:**
    *   **"GRRRR!" Button:** Instant bass growl fills and drops.
    *   **"Chop It Up":** Instant 1/64th note gating effects.
    *   **"Run It Back":** Instant state revert/undo for live performance transitions.

## 🎹 Controls

### Mouse / Touch
*   **Move:** Modulate pitch, filter, and harmonic spread.
*   **Click:** Trigger "strike" hardness (distortion boost).

### Keyboard Shortcuts
*   **Space Bar:** Chaos Mode (Randomize)
*   **Alt:** Trigger Growl
*   **Esc:** Run It Back (Undo/Revert)
*   **Enter:** Start / Toggle Drums
*   **\ (Backslash):** Toggle Camera

**Performance & Mixing:**
*   **Q / W / E / R / T:** Gate Speed (1/64, 1/32, 1/16, 1/8, 1/4)
*   **U / I / O:** Toggle Arp / Gate / Drums
*   **[ / ]:** Master Volume Down / Up
*   **Arrow Left / Right:** Crossfade Drums vs Synth
*   **Arrow Up / Down:** Octave Shift

### Webcam Zones
*   **Top Left:** Chop It Up (Gate 1/64)
*   **Top Right:** Grrrr! (Growl Fill)
*   **Bottom Left:** Run It Back (Undo)
*   **Bottom Right:** Chaos Mode

## 🛠️ Architecture

Built with React, TypeScript, and the Web Audio API. The visualizer utilizes HTML5 Canvas with custom physics integration.