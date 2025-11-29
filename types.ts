
export interface AudioParams {
  osc1Type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  osc2Type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  baseFreq: number;
  detuneSpread: number;
  filterCutoffBase: number;
  filterResonanceBase: number;
  distortionAmount: number;
  reverbMix: number;
  // ADSR
  attack: number;  // 0.001 to 2.0
  decay: number;   // 0.001 to 2.0
  sustain: number; // 0.0 to 1.0
  release: number; // 0.001 to 5.0
}

export interface PhysicsParams {
  viscosityBase: number; // How thick it feels at rest (0-1)
  thickeningFactor: number; // How much it hardens with speed (0-1)
  colorBase: string;
  colorSolid: string;
  name: string;
}

export type VisualShape = 'circle' | 'square' | 'triangle' | 'hexagon' | 'cross' | 'star';
export type CameraMode = 'static' | 'sway' | 'pulse' | 'drift' | 'spin' | 'shake' | 'zoom';
export type RenderStyle = 'particles' | 'wireframe' | 'mosaic' | 'scanner';

export interface VisualParams {
    shape: VisualShape;
    trailLength: number; // 0.05 (long trails) to 0.5 (short trails)
    connectPoints: boolean;
    strokeWidth: number;
    cameraMode: CameraMode;
    glowIntensity: number; // 0 to 1
    renderStyle?: RenderStyle;
}

export interface SynthPreset {
  audio: AudioParams;
  physics: PhysicsParams;
  visual: VisualParams;
  description: string;
}

export enum PlayState {
  IDLE,
  PLAYING,
  GENERATING
}

export interface FxState {
  delay: boolean;
  chorus: boolean;
  highpass: boolean;
  distortion: boolean;
  phaser: boolean;
  reverb: boolean;
  crunch: boolean;
}

export type ArpMode = 'UP' | 'DOWN' | 'UP_DOWN' | 'RANDOM' | 'BROWNIAN';

// Division relative to 1 Bar (4 beats)
// 1/16 = 16 steps per bar
export type GateDivision = '1/64' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1BAR' | '2BAR';

export interface ArpSettings {
  enabled: boolean;
  bpm: number; // 60 - 240
  division: GateDivision; 
  mode: ArpMode;
  octaveRange: number; // 1 - 3
  gate: number; // 0.1 - 1.0
  steps: number; // 1 - 16
}

export interface DrumStep {
  kick: boolean;
  snare: boolean;
  hihat: boolean;
  clap: boolean;
}

export type SamplerGenre = 'HIPHOP' | 'DISCO' | 'HOUSE' | 'DUBSTEP' | 'METAL' | 'FUNK' | 'ROCK' | 'BOOMBAP';
export type DrumKit = '808' | '909' | 'ACOUSTIC' | 'CRUNKY' | 'INDUSTRIAL' | 'LOFI';

export interface DrumSettings {
  enabled: boolean;
  volume: number;
  genre: SamplerGenre;
  kit: DrumKit;
  pattern: DrumStep[]; // Array of 16 steps
}

export type GatePatternName = 'OFF' | 'TRANCE' | 'PSY' | 'SIDECHAIN' | 'CHOP_1' | 'CHOP_2' | 'SYNC' | 'CHAOS';

export interface GateSettings {
    enabled: boolean;
    pattern: GatePatternName;
    division: GateDivision;
    mix: number; // 0 - 1 (dry/wet)
}
