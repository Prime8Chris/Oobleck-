

import { SynthPreset, SamplerGenre, DrumStep, GatePatternName, DrumKit, GateDivision } from './types';

export const DEFAULT_PRESET: SynthPreset = {
  description: "Classic Oobleck (Cornstarch & Water)",
  audio: {
    osc1Type: 'sine',
    osc2Type: 'sawtooth',
    baseFreq: 110,
    detuneSpread: 15,
    filterCutoffBase: 200,
    filterResonanceBase: 1,
    distortionAmount: 20,
    reverbMix: 0.3,
  },
  physics: {
    name: "Cornstarch",
    viscosityBase: 0.2,
    thickeningFactor: 0.9, 
    colorBase: '#4fd1c5', 
    colorSolid: '#e53e3e', 
  },
  visual: {
      shape: 'circle',
      trailLength: 0.3,
      connectPoints: true,
      strokeWidth: 1,
      cameraMode: 'static',
      glowIntensity: 0.5,
      renderStyle: 'particles'
  }
};

export const LAVA_PRESET: SynthPreset = {
  description: "Molten Lava",
  audio: {
    osc1Type: 'triangle',
    osc2Type: 'square',
    baseFreq: 60,
    detuneSpread: 25,
    filterCutoffBase: 100,
    filterResonanceBase: 5,
    distortionAmount: 50,
    reverbMix: 0.5,
  },
  physics: {
    name: "Molten Rock",
    viscosityBase: 0.6,
    thickeningFactor: 0.4,
    colorBase: '#ed8936', 
    colorSolid: '#FFFF00', 
  },
  visual: {
      shape: 'square',
      trailLength: 0.1, // Long trails
      connectPoints: true,
      strokeWidth: 4,
      cameraMode: 'sway',
      glowIntensity: 0.8,
      renderStyle: 'mosaic'
  }
};

export const MERCURY_PRESET: SynthPreset = {
  description: "Liquid Metal",
  audio: {
    osc1Type: 'sine',
    osc2Type: 'sine',
    baseFreq: 220,
    detuneSpread: 5,
    filterCutoffBase: 800,
    filterResonanceBase: 0,
    distortionAmount: 5,
    reverbMix: 0.8,
  },
  physics: {
    name: "Mercury",
    viscosityBase: 0.1,
    thickeningFactor: 0.1,
    colorBase: '#a0aec0', 
    colorSolid: '#e2e8f0', 
  },
  visual: {
      shape: 'circle',
      trailLength: 0.6, // Very short trails
      connectPoints: false, // Droplets
      strokeWidth: 0,
      cameraMode: 'drift',
      glowIntensity: 1.0, // Shiny
      renderStyle: 'particles'
  }
};

export const GLORPCORE_PRESET: SynthPreset = {
  description: "Alien biological fluids",
  audio: {
    osc1Type: 'triangle',
    osc2Type: 'sine',
    baseFreq: 140,
    detuneSpread: 40,
    filterCutoffBase: 300,
    filterResonanceBase: 18,
    distortionAmount: 15,
    reverbMix: 0.6,
  },
  physics: {
    name: "Alien Slime",
    viscosityBase: 0.9, 
    thickeningFactor: 0.3,
    colorBase: '#805ad5', 
    colorSolid: '#48bb78', 
  },
  visual: {
      shape: 'hexagon',
      trailLength: 0.2,
      connectPoints: true,
      strokeWidth: 2,
      cameraMode: 'pulse',
      glowIntensity: 0.6,
      renderStyle: 'wireframe'
  }
};

export const BZZZZT_PRESET: SynthPreset = {
  description: "High voltage electrical discharge",
  audio: {
    osc1Type: 'sawtooth',
    osc2Type: 'square',
    baseFreq: 55,
    detuneSpread: 15,
    filterCutoffBase: 1500,
    filterResonanceBase: 2,
    distortionAmount: 90, 
    reverbMix: 0.1,
  },
  physics: {
    name: "Electricity",
    viscosityBase: 0.05, 
    thickeningFactor: 0.05,
    colorBase: '#f6e05e', 
    colorSolid: '#ffffff', 
  },
  visual: {
      shape: 'triangle', // Jagged
      trailLength: 0.05, // Extremely long light trails
      connectPoints: true,
      strokeWidth: 1,
      cameraMode: 'shake',
      glowIntensity: 0.9,
      renderStyle: 'scanner'
  }
};

export const CRYSTAL_PRESET: SynthPreset = {
  description: "Shattering ice and glass",
  audio: {
    osc1Type: 'sine',
    osc2Type: 'triangle',
    baseFreq: 523.25, 
    detuneSpread: 2,
    filterCutoffBase: 2000,
    filterResonanceBase: 0.5,
    distortionAmount: 0,
    reverbMix: 0.9, 
  },
  physics: {
    name: "Liquid Glass",
    viscosityBase: 0.1, 
    thickeningFactor: 1.0, 
    colorBase: '#cffafe', 
    colorSolid: '#ffffff', 
  },
  visual: {
      shape: 'triangle',
      trailLength: 0.5,
      connectPoints: true,
      strokeWidth: 1,
      cameraMode: 'static',
      glowIntensity: 0.2, // Clear/Sharp
      renderStyle: 'wireframe'
  }
};

export const VOID_PRESET: SynthPreset = {
  description: "Dark matter from the abyss",
  audio: {
    osc1Type: 'square',
    osc2Type: 'sine',
    baseFreq: 32.7, 
    detuneSpread: 5,
    filterCutoffBase: 80,
    filterResonanceBase: 10,
    distortionAmount: 30,
    reverbMix: 0.4,
  },
  physics: {
    name: "Dark Matter",
    viscosityBase: 0.95, 
    thickeningFactor: 0.2,
    colorBase: '#4338ca', // Brighter Indigo 
    colorSolid: '#d8b4fe', // Bright Purple
  },
  visual: {
      shape: 'star',
      trailLength: 0.15,
      connectPoints: false,
      strokeWidth: 0,
      cameraMode: 'spin', // Disorienting
      glowIntensity: 0.6,
      renderStyle: 'particles'
  }
};

export const ETHEREAL_PRESET: SynthPreset = {
  description: "Soft clouds and dreams",
  audio: {
    osc1Type: 'triangle',
    osc2Type: 'sine',
    baseFreq: 261.6, 
    detuneSpread: 8,
    filterCutoffBase: 600,
    filterResonanceBase: 0,
    distortionAmount: 2,
    reverbMix: 0.95,
  },
  physics: {
    name: "Cloud Vapor",
    viscosityBase: 0.01, 
    thickeningFactor: 0.0, 
    colorBase: '#fce7f3', 
    colorSolid: '#bae6fd', 
  },
  visual: {
      shape: 'circle',
      trailLength: 0.02, // Max blur
      connectPoints: false,
      strokeWidth: 0,
      cameraMode: 'drift',
      glowIntensity: 0.7,
      renderStyle: 'particles'
  }
};

export const INDUSTRIAL_PRESET: SynthPreset = {
  description: "Grinding gears and rust",
  audio: {
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    baseFreq: 40, 
    detuneSpread: 30,
    filterCutoffBase: 400,
    filterResonanceBase: 8,
    distortionAmount: 85,
    reverbMix: 0.2,
  },
  physics: {
    name: "Rust Sludge",
    viscosityBase: 0.7,
    thickeningFactor: 0.8, 
    colorBase: '#451a03', 
    colorSolid: '#ea580c', 
  },
  visual: {
      shape: 'cross',
      trailLength: 0.4,
      connectPoints: true,
      strokeWidth: 5, // Chunky
      cameraMode: 'shake',
      glowIntensity: 0.1,
      renderStyle: 'scanner'
  }
};

export const NEON_PRESET: SynthPreset = {
  description: "Radioactive plasma",
  audio: {
    osc1Type: 'square',
    osc2Type: 'square',
    baseFreq: 110,
    detuneSpread: 20,
    filterCutoffBase: 1200,
    filterResonanceBase: 15,
    distortionAmount: 40,
    reverbMix: 0.3,
  },
  physics: {
    name: "Plasma",
    viscosityBase: 0.05,
    thickeningFactor: 0.1,
    colorBase: '#84cc16', 
    colorSolid: '#d946ef', 
  },
  visual: {
      shape: 'hexagon',
      trailLength: 0.1,
      connectPoints: true,
      strokeWidth: 2,
      cameraMode: 'pulse',
      glowIntensity: 1.0,
      renderStyle: 'wireframe'
  }
};

export const ALL_PRESETS: SynthPreset[] = [
  DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET,
  CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET
];

export const DRUM_KITS: DrumKit[] = ['808', '909', 'ACOUSTIC', 'CRUNKY', 'INDUSTRIAL', 'LOFI'];

export const GATE_DIVISIONS: GateDivision[] = ['1/64', '1/32', '1/16', '1/8', '1/4', '1/2', '1BAR', '2BAR'];

const createStep = (k: boolean, s: boolean, h: boolean, c: boolean): DrumStep => ({ kick: k, snare: s, hihat: h, clap: c });
const empty = createStep(false, false, false, false);

export const GENRE_PRESETS: Record<SamplerGenre, { bpm: number, pattern: DrumStep[] }> = {
    HOUSE: {
        bpm: 124,
        pattern: Array(16).fill(empty).map((_, i) => ({
            kick: i % 4 === 0,
            snare: false,
            hihat: i % 4 === 2, // Offbeat hats
            clap: i === 4 || i === 12
        }))
    },
    DISCO: {
        bpm: 115,
        pattern: Array(16).fill(empty).map((_, i) => ({
            kick: i % 4 === 0,
            snare: i === 4 || i === 12,
            hihat: i % 2 === 1, // 8th note offbeats
            clap: false
        }))
    },
    HIPHOP: {
        bpm: 90,
        pattern: Array(16).fill(empty).map((_, i) => {
            const k = i === 0 || i === 10;
            const s = i === 4 || i === 12;
            const h = i % 2 === 0;
            return createStep(k, s, h, false);
        })
    },
    BOOMBAP: {
        bpm: 86,
        pattern: Array(16).fill(empty).map((_, i) => {
            const k = i === 0 || i === 7 || i === 10;
            const s = i === 4 || i === 12;
            const h = true; 
            return createStep(k, s, h, false);
        })
    },
    DUBSTEP: {
        bpm: 140,
        pattern: Array(16).fill(empty).map((_, i) => {
            // Half time feel: Kick on 1, Snare on 3 (step 8 in 16 steps)
            const k = i === 0 || i === 2 || i === 3; // Syncopated kick
            const s = i === 8;
            const h = i % 2 === 0;
            return createStep(k, s, h, false);
        })
    },
    ROCK: {
        bpm: 130,
        pattern: Array(16).fill(empty).map((_, i) => {
            const k = i === 0 || i === 3 || i === 8 || i === 11;
            const s = i === 4 || i === 12;
            const h = true;
            return createStep(k, s, h, false);
        })
    },
    METAL: {
        bpm: 160,
        pattern: Array(16).fill(empty).map((_, i) => {
            const k = true; // Double bass often? Let's do driving 8ths
            const s = i === 4 || i === 12;
            const h = i % 4 === 0;
            return createStep(i % 2 === 0, s, h, false);
        })
    },
    FUNK: {
        bpm: 105,
        pattern: Array(16).fill(empty).map((_, i) => {
            const k = i === 0 || i === 10 || i === 13;
            const s = i === 4 || i === 12 || i === 15; // Ghost note feel
            const h = i % 2 === 0;
            return createStep(k, s, h, false);
        })
    }
};

// 1 = Gate Open (Sound), 0 = Gate Closed (Silence)
// 16 Steps
export const GATE_PATTERNS: Record<GatePatternName, number[]> = {
    'OFF': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    'TRANCE': [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    'PSY': [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    'SIDECHAIN': [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1], // Ducks on 1, 5, 9, 13 (Kick)
    'CHOP_1': [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    'CHOP_2': [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
    'SYNC': [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
    'CHAOS': [1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0]
};