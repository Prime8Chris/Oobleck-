
import { AudioParams, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GateDivision, DrumFX } from '../types';
import { GATE_PATTERNS } from '../constants';

export class AudioEngine {
  public ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null; // Sub/Noise
  private gainNode: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private dryWet: GainNode | null = null; // Reverb send
  private convolver: ConvolverNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private audioDataArray: Uint8Array = new Uint8Array(0);

  // FX Nodes
  private highpass: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private delayDryWet: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
  
  // Gate Node
  private gateNode: GainNode | null = null;

  // Crunch (Replaced with Saturate)
  private crunchShaper: WaveShaperNode | null = null;

  // Phaser
  private phaserInput: GainNode | null = null;
  private phaserOutput: GainNode | null = null;
  private phaserWetGain: GainNode | null = null;
  private phaserLFO: OscillatorNode | null = null;
  private phaserLFO_gain: GainNode | null = null;
  private phaserFilters: BiquadFilterNode[] = [];

  // Pre-distortion gain
  private preDistortionGain: GainNode | null = null;

  // Recording
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  private params: AudioParams;
  private octaveOffset: number = 0;
  private lastTriggerTime: number = 0;
  private synthVolume: number = 0.15;

  // Arp & Sequencer State
  private arpSettings: ArpSettings = { enabled: false, bpm: 120, division: '1/8', mode: 'UP', octaveRange: 1, gate: 0.5, steps: 1 };
  private scaleFrequencies: number[] = []; 
  private nextNoteTime: number = 0;
  private arpIndex: number = 0;
  private currentArpFreq: number = 0;
  private schedulerTimer: number | null = null;

  // Drum State
  private drumSettings: DrumSettings = { 
      enabled: false, 
      volume: 1.0, 
      genre: 'HOUSE',
      kit: '808',
      fx: 'DRY',
      pattern: Array(16).fill({ kick: false, snare: false, hihat: false, clap: false }) 
  };
  private currentStep: number = 0;
  
  // Drum Bus
  private drumCompressor: DynamicsCompressorNode | null = null;
  private drumGain: GainNode | null = null;
  private drumSaturation: WaveShaperNode | null = null;
  
  // Drum FX Nodes
  private drumFxInput: GainNode | null = null;
  private drumFxOutput: GainNode | null = null;
  private drumFxChainNodes: AudioNode[] = [];

  // Gate State
  private gateSettings: GateSettings = { enabled: false, pattern: 'OFF', division: '1/16', mix: 1.0 };

  private currentFx: FxState = {
      delay: false, chorus: false, highpass: false,
      distortion: false, phaser: false, reverb: false, crunch: false
  };

  private stopTimeout: any = null;
  private isGrowling: boolean = false;

  constructor(initialParams: AudioParams) {
    this.params = initialParams;
    this.currentArpFreq = initialParams.baseFreq;
  }

  // Helper to prevent non-finite errors
  private safeNum(val: number | undefined, def: number): number {
      return Number.isFinite(val) ? val as number : def;
  }

  private getValidOscType(type: string): OscillatorType {
      const valid: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
      if (valid.includes(type as OscillatorType)) {
          return type as OscillatorType;
      }
      return 'sawtooth'; // Fallback for custom types
  }

  public async init() {
    // If a stop was scheduled (e.g. StrictMode remount), cancel it
    if (this.stopTimeout) {
        clearTimeout(this.stopTimeout);
        this.stopTimeout = null;
    }

    if (this.ctx) {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        return;
    }
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256; 
    this.analyser.smoothingTimeConstant = 0.8;
    this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    this.destNode = this.ctx.createMediaStreamDestination();
    this.analyser.connect(this.destNode);

    // --- DRUM BUS ---
    this.drumCompressor = this.ctx.createDynamicsCompressor();
    this.drumCompressor.threshold.value = -10;
    this.drumCompressor.ratio.value = 4;
    
    this.drumSaturation = this.ctx.createWaveShaper();
    this.drumSaturation.curve = this.makeDistortionCurve(30);

    this.drumGain = this.ctx.createGain();
    this.drumGain.gain.value = this.safeNum(this.drumSettings.volume, 1.0);
    
    // Create FX Insert Points
    this.drumFxInput = this.ctx.createGain();
    this.drumFxOutput = this.ctx.createGain();
    
    // Routing: Input -> FX Chain -> Output -> Compressor -> Saturation -> Gain -> Master
    this.drumFxInput.connect(this.drumFxOutput); // Default DRY (shorted)
    this.drumFxOutput.connect(this.drumCompressor);
    
    this.drumCompressor.connect(this.drumSaturation);
    this.drumSaturation.connect(this.drumGain);
    this.drumGain.connect(this.masterCompressor);
    // ----------------

    // VCA
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;
    
    // Gate Node (Insert Point)
    this.gateNode = this.ctx.createGain();
    this.gateNode.gain.value = 1.0; // Default open

    // Synth Chain Construction
    this.preDistortionGain = this.ctx.createGain();
    this.preDistortionGain.gain.value = 1.0;

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = this.makeDistortionCurve(this.safeNum(this.params.distortionAmount, 0));
    
    this.crunchShaper = this.ctx.createWaveShaper();
    this.crunchShaper.curve = this.makeIdentityCurve();

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = this.safeNum(this.params.filterResonanceBase, 1);
    this.filter.frequency.value = this.safeNum(this.params.filterCutoffBase, 1000);

    this.highpass = this.ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 10;

    this.setupPhaser();

    // Signal Path:
    // OSCs -> Filter -> Phaser -> Crunch (Saturate) -> Highpass -> PreDist -> Shaper -> VCA -> GATE -> (Splits to FX/Master)
    
    this.filter.connect(this.phaserInput!);
    this.phaserOutput!.connect(this.crunchShaper);
    this.crunchShaper.connect(this.highpass);
    this.highpass.connect(this.preDistortionGain!);
    this.preDistortionGain!.connect(this.shaper);
    this.shaper.connect(this.gainNode);
    
    // Connect VCA to Gate
    this.gainNode.connect(this.gateNode);
    
    // Connect Gate to Master (Dry Synth)
    this.gateNode.connect(this.masterCompressor);

    // FX Sends (From Gate, so rhythmic gating affects reverb/delay sends)
    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.3;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.4;
    this.delayDryWet = this.ctx.createGain();
    this.delayDryWet.gain.value = 0;

    this.gateNode.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayDryWet);
    this.delayDryWet.connect(this.masterCompressor);

    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = await this.createReverbImpulse(2, 2.0);
    this.dryWet = this.ctx.createGain();
    this.dryWet.gain.value = this.safeNum(this.params.reverbMix, 0.3);

    this.gateNode.connect(this.convolver);
    this.convolver.connect(this.dryWet);
    this.dryWet.connect(this.masterCompressor);

    this.startOscillators();
    this.startScheduler();
    this.updateFxState();
    this.updateDrumFx();
  }

  private setupPhaser() {
      if (!this.ctx) return;
      this.phaserInput = this.ctx.createGain();
      this.phaserOutput = this.ctx.createGain();
      this.phaserWetGain = this.ctx.createGain();
      this.phaserWetGain.gain.value = 0; 
      this.phaserInput.connect(this.phaserOutput);
      this.phaserFilters = [];
      let lastNode: AudioNode = this.phaserInput;
      this.phaserLFO = this.ctx.createOscillator();
      this.phaserLFO.type = 'sine';
      this.phaserLFO.frequency.value = 0.5;
      this.phaserLFO_gain = this.ctx.createGain();
      this.phaserLFO_gain.gain.value = 300; 
      this.phaserLFO.connect(this.phaserLFO_gain);
      this.phaserLFO.start();
      for (let i = 0; i < 4; i++) {
          const apf = this.ctx.createBiquadFilter();
          apf.type = 'allpass';
          apf.frequency.value = 1000; 
          apf.Q.value = 2.0;
          this.phaserLFO_gain.connect(apf.frequency);
          lastNode.connect(apf);
          lastNode = apf;
          this.phaserFilters.push(apf);
      }
      lastNode.connect(this.phaserWetGain);
      this.phaserWetGain.connect(this.phaserOutput);
  }

  private startOscillators() {
    if (!this.ctx || !this.filter) return;
    const base = this.safeNum(this.params.baseFreq, 110);
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = this.getValidOscType(this.params.osc1Type);
    this.osc1.frequency.value = base;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = this.getValidOscType(this.params.osc2Type);
    this.osc2.frequency.value = base * 1.01; 
    this.osc3 = this.ctx.createOscillator(); 
    this.osc3.type = 'sine';
    this.osc3.frequency.value = base / 2;
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.osc3.connect(this.filter);
    const now = this.ctx.currentTime;
    this.osc1.start(now);
    this.osc2.start(now);
    this.osc3.start(now);
  }

  // --- SCHEDULER ---
  private startScheduler() {
      if (this.schedulerTimer) clearInterval(this.schedulerTimer);
      this.schedulerTimer = window.setInterval(() => {
          this.scheduleEvents();
      }, 25); 
  }

  private scheduleEvents() {
      if (!this.ctx) return;

      const bpm = this.safeNum(this.arpSettings.bpm, 120);
      const secondsPerBeat = 60 / (bpm || 120); // avoid div by zero
      const sixteenthTime = secondsPerBeat / 4;
      
      const lookahead = 0.1;
      const currentTime = this.ctx.currentTime;

      if (this.nextNoteTime < currentTime) {
          this.nextNoteTime = currentTime + 0.01;
      }

      while (this.nextNoteTime < currentTime + lookahead) {
          const time = this.nextNoteTime;
          
          // Schedule Drums (16th grid)
          if (this.drumSettings.enabled) {
             this.scheduleDrums(time, this.currentStep);
          }
          
          // Schedule Gate
          if (this.gateSettings.enabled) {
              this.scheduleGate(time, this.currentStep, sixteenthTime);
          } else if (this.gateNode) {
              // Ensure gate is open if disabled
              this.gateNode.gain.setTargetAtTime(1.0, time, 0.01);
          }
          
          // Schedule Arp
          if (this.arpSettings.enabled) {
              const notesPer16th = this.getNotesPer16th(this.arpSettings.division);
              
              if (notesPer16th < 1) {
                  // Slower than 1/16 (e.g. 1/8 = 0.5 notes per 16th, so trigger every 2nd step)
                  const interval = Math.round(1 / notesPer16th);
                  if (this.currentStep % interval === 0) {
                      const duration = sixteenthTime * interval;
                      this.playArpNoteAt(time, duration);
                  }
              } else {
                  // 1/16 or faster (1/32, 1/64)
                  // Trigger multiple notes within this 16th time slot
                  const subStepDuration = sixteenthTime / notesPer16th;
                  for (let i = 0; i < notesPer16th; i++) {
                      this.playArpNoteAt(time + (i * subStepDuration), subStepDuration);
                  }
              }
          }

          // Advance step dynamically based on pattern length or default to 16
          const patternLength = this.drumSettings.pattern.length > 0 ? this.drumSettings.pattern.length : 16;
          this.currentStep = (this.currentStep + 1) % patternLength;
          this.nextNoteTime += sixteenthTime;
      }
  }

  private scheduleGate(time: number, current16thStep: number, sixteenthTime: number) {
      if (!this.gateNode) return;
      
      const pattern = GATE_PATTERNS[this.gateSettings.pattern];
      
      const apply = (t: number, val: number) => {
          const isOpen = val === 1;
          const targetGain = isOpen ? 1.0 : Math.max(0, 1.0 - this.safeNum(this.gateSettings.mix, 1.0));
          // Use a very short ramp for click-free but sharp gating
          // GUARD: Check finite time
          if (Number.isFinite(t)) {
            this.gateNode!.gain.setTargetAtTime(targetGain, t, 0.003);
          }
      };

      if (!Number.isFinite(sixteenthTime) || sixteenthTime <= 0) return;

      switch(this.gateSettings.division) {
          case '1/64':
              // 4 steps per 16th
              for(let i=0; i<4; i++) {
                  const pIdx = (current16thStep * 4 + i) % 16;
                  apply(time + (sixteenthTime/4)*i, pattern[pIdx]);
              }
              break;
          case '1/32':
               // 2 steps per 16th
               for(let i=0; i<2; i++) {
                  const pIdx = (current16thStep * 2 + i) % 16;
                  apply(time + (sixteenthTime/2)*i, pattern[pIdx]);
              }
              break;
          case '1/16': 
              apply(time, pattern[current16thStep % 16]);
              break;
          case '1/8': 
              apply(time, pattern[Math.floor(current16thStep / 2) % 16]);
              break;
          case '1/4': 
              apply(time, pattern[Math.floor(current16thStep / 4) % 16]);
              break;
          case '1/2': 
              apply(time, pattern[Math.floor(current16thStep / 8) % 16]);
              break;
          case '1BAR': 
              apply(time, pattern[Math.floor(current16thStep / 16) % 16]);
              break;
          case '2BAR': 
              apply(time, pattern[Math.floor(current16thStep / 32) % 16]);
              break;
          default:
               apply(time, pattern[current16thStep % 16]);
      }
  }

  private getNotesPer16th(div: GateDivision): number {
      switch(div) {
          case '1/64': return 4;
          case '1/32': return 2;
          case '1/16': return 1;
          case '1/8': return 0.5; // Every 2 steps
          case '1/4': return 0.25; // Every 4 steps
          case '1/2': return 0.125;
          case '1BAR': return 0.0625;
          case '2BAR': return 0.03125;
          default: return 0.5;
      }
  }

  private scheduleDrums(time: number, stepIndex: number) {
      const step = this.drumSettings.pattern[stepIndex];
      if (!step) return;

      if (step.kick) this.triggerKick(time);
      if (step.snare) this.triggerSnare(time);
      if (step.hihat) this.triggerHiHat(time);
      if (step.clap) this.triggerClap(time);
  }

  // --- DRUM SYNTHESIS (SAMPLER ENGINE) ---
  private triggerKick(time: number) {
    if (!this.ctx || !this.drumFxInput) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.drumFxInput); // Route to FX Bus

    const kit = this.drumSettings.kit || '808';

    let freqStart = 150;
    let freqEnd = 30;
    let decay = 0.5;

    if (kit === '808') {
        freqStart = 75; // Lowered from 150 (Octave down)
        freqEnd = 25;   // Lowered from 50
        decay = 0.8; // long boom
        osc.type = 'sine';
    } else if (kit === '909') {
        freqStart = 90; // Lowered from 180
        freqEnd = 25;   // Lowered from 50
        decay = 0.4; // punchier
        osc.type = 'triangle'; // harder
    } else if (kit === 'ACOUSTIC') {
        freqStart = 60; // Lowered from 120
        freqEnd = 30;   // Lowered from 60
        decay = 0.3;
        osc.type = 'sine';
    } else if (kit === 'INDUSTRIAL') {
        freqStart = 100; // Lowered from 200
        freqEnd = 10;    // Lowered from 20
        decay = 0.2;
        osc.type = 'square'; // distorted
    } else if (kit === 'LOFI') {
        freqStart = 50; // Lowered from 100
        freqEnd = 20;   // Lowered from 40
        decay = 0.3;
        osc.type = 'sine';
    } else {
        // fallback
        freqStart = 60; // Lowered from 120
        freqEnd = 25;   // Lowered from 50
        decay = 0.5;
        osc.type = 'sine';
    }

    if (Number.isFinite(time)) {
        osc.frequency.setValueAtTime(freqStart, time);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, time + decay);
        
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        osc.start(time);
        osc.stop(time + decay);
    }
  }

  private triggerSnare(time: number) {
    if (!this.ctx || !this.drumFxInput) return;
    const kit = this.drumSettings.kit || '808';

    // Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(this.drumFxInput);
    
    let toneFreq = 200;
    let toneDecay = 0.1;
    
    if (kit === '808') toneFreq = 200;
    else if (kit === '909') toneFreq = 250;
    else if (kit === 'INDUSTRIAL') toneFreq = 150;
    else if (kit === 'LOFI') toneFreq = 220;

    if (Number.isFinite(time)) {
        osc.frequency.setValueAtTime(toneFreq, time);
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
        osc.start(time);
        osc.stop(time + toneDecay);
    }

    // Noise
    const noiseDuration = (kit === '808') ? 0.3 : 0.2;
    const bufferSize = this.ctx.sampleRate * noiseDuration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = (kit === 'LOFI') ? 'lowpass' : 'highpass';
    noiseFilter.frequency.value = (kit === 'LOFI') ? 3000 : 2000;
    
    const noiseGain = this.ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.drumFxInput);
    
    if (Number.isFinite(time)) {
        noiseGain.gain.setValueAtTime(0.7, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDuration);
        
        noise.start(time);
    }
  }

  private triggerHiHat(time: number) {
    if (!this.ctx || !this.drumFxInput) return;
    const kit = this.drumSettings.kit || '808';
    const duration = (kit === 'LOFI') ? 0.03 : 0.05;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = (kit === 'LOFI') ? 4000 : 7000; 
    
    if (kit === '808') {
        filter.type = 'bandpass';
        filter.frequency.value = 8000;
    }

    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumFxInput);

    const vol = 0.4;
    if (Number.isFinite(time)) {
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        noise.start(time);
    }
  }

  private triggerClap(time: number) {
    if (!this.ctx || !this.drumFxInput) return;
    const decay = 0.2;

    const bufferSize = this.ctx.sampleRate * decay;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 1;
    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumFxInput);

    // Clap envelope (multiple strikes)
    const t = time;
    if (Number.isFinite(t)) {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        gain.gain.setValueAtTime(0.5, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        gain.gain.setValueAtTime(0.5, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
        noise.start(t);
    }
  }

  private playArpNoteAt(time: number, duration: number) {
      const baseFreq = this.safeNum(this.params.baseFreq, 110);
      
      let baseIndex = this.scaleFrequencies.findIndex(f => f >= baseFreq);
      if (baseIndex === -1) baseIndex = 0;

      // Ensure base index is valid within the scale provided
      if (baseIndex >= this.scaleFrequencies.length) baseIndex = 0;

      const patternLength = this.arpSettings.steps;
      let stepOffset = 0;

      // Calculate Offset based on Mode and ArpIndex
      switch (this.arpSettings.mode) {
          case 'UP':
              stepOffset = this.arpIndex % patternLength;
              this.arpIndex++;
              break;
          case 'DOWN':
              stepOffset = (patternLength - 1) - (this.arpIndex % patternLength);
              this.arpIndex++;
              break;
          case 'UP_DOWN':
              const cycle = (patternLength * 2) - 2;
              if (cycle <= 0) {
                  stepOffset = 0;
              } else {
                  const pos = this.arpIndex % cycle;
                  stepOffset = pos < patternLength ? pos : cycle - pos;
              }
              this.arpIndex++;
              break;
          case 'RANDOM':
              stepOffset = Math.floor(Math.random() * patternLength);
              break;
          case 'BROWNIAN':
              if (Math.random() > 0.5) this.arpIndex++;
              else this.arpIndex--;
              
              // Wrap correctly
              const p = ((this.arpIndex % patternLength) + patternLength) % patternLength;
              stepOffset = p;
              break;
      }
      
      const rawTargetIndex = baseIndex + stepOffset;
      const scaleLen = this.scaleFrequencies.length;
      
      let finalFreq = baseFreq;

      if (scaleLen > 0) {
          const wrappedIndex = rawTargetIndex % scaleLen;
          const octaveShift = Math.floor(rawTargetIndex / scaleLen);
          const constrainedOctave = octaveShift % (this.arpSettings.octaveRange + 1);
          finalFreq = this.scaleFrequencies[wrappedIndex] * Math.pow(2, constrainedOctave);
      }

      this.currentArpFreq = Number.isFinite(finalFreq) ? finalFreq : baseFreq;
      this.lastTriggerTime = time; // Trigger Envelope
  }

  // --- FX MACROS ---
  public triggerEffectStacks(ids: number[]) {
      if (!this.ctx) return;
      ids.forEach(id => this.triggerSpecialEffect(id));
  }

  // --- GROWL TRIGGER ---
  public triggerGrowl(id: number) {
      if (!this.ctx || !this.osc1 || !this.osc2 || !this.filter || !this.gainNode) return;
      
      this.isGrowling = true; // Block modulate() from interfering
      const now = this.ctx.currentTime;
      const baseFreq = this.safeNum(this.params.baseFreq, 110);
      
      // Momentarily override engine for a "Shot"
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.safeNum(this.synthVolume, 0.15), now);
      
      // Helper to set oscs quickly
      const setOsc = (osc: OscillatorNode, type: OscillatorType, freqMult: number = 1, detune: number = 0) => {
          osc.type = type;
          osc.frequency.cancelScheduledValues(now);
          const freq = baseFreq * freqMult;
          if (Number.isFinite(freq)) osc.frequency.setValueAtTime(freq, now);
          
          osc.detune.cancelScheduledValues(now);
          if (Number.isFinite(detune)) osc.detune.setValueAtTime(detune, now);
      };

      const setFilter = (type: BiquadFilterType, freq: number, Q: number) => {
          if (!this.filter) return;
          this.filter.type = type;
          this.filter.frequency.cancelScheduledValues(now);
          if(Number.isFinite(freq)) this.filter.frequency.setValueAtTime(freq, now);
          this.filter.Q.cancelScheduledValues(now);
          if(Number.isFinite(Q)) this.filter.Q.setValueAtTime(Q, now);
      };

      switch(id) {
          case 1: // Basic Growl (Vowel RAAH)
              setOsc(this.osc1, 'sawtooth', 0.5); // Sub saw
              setOsc(this.osc2, 'sawtooth', 0.51, 15); // Detuned
              setFilter('bandpass', 400, 5);
              // Wow filter
              this.filter.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
              this.filter.frequency.exponentialRampToValueAtTime(300, now + 0.6);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(40, now);
              break;

          case 2: // Robotic FM Growl
              setOsc(this.osc1, 'sine', 0.5);
              setOsc(this.osc2, 'square', 1.0); // Modulator
              // Fake FM by rapid pitch mod
              if (Number.isFinite(baseFreq)) {
                this.osc1.frequency.setValueAtTime(baseFreq * 0.5, now);
                this.osc1.frequency.linearRampToValueAtTime(baseFreq * 0.5 + 200, now + 0.05);
              }
              setFilter('notch', 800, 10);
              this.filter.frequency.linearRampToValueAtTime(400, now + 0.4);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(80, now);
              break;

          case 3: // Yoi / Talking Bass
              setOsc(this.osc1, 'sawtooth', 0.5);
              setOsc(this.osc2, 'square', 0.5, 10);
              setFilter('bandpass', 300, 15); // High Res BP
              // YOI movement
              this.filter.frequency.setValueAtTime(300, now);
              this.filter.frequency.exponentialRampToValueAtTime(1500, now + 0.15); // Y
              this.filter.frequency.exponentialRampToValueAtTime(300, now + 0.4); // OI
              break;

          case 4: // Screech Hybrid
              setOsc(this.osc1, 'sawtooth', 1.0); // High pitch
              setOsc(this.osc2, 'sawtooth', 1.0, 50); // Very detuned
              setFilter('highpass', 500, 12);
              this.filter.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(100, now); // Scream
              break;

          case 5: // Reese Growl
              setOsc(this.osc1, 'sawtooth', 0.25); // Low
              setOsc(this.osc2, 'sawtooth', 0.25, 25); // Detuned
              setFilter('lowpass', 800, 2);
              // Phaser active
              if (this.phaserWetGain) this.phaserWetGain.gain.setValueAtTime(1, now);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(30, now);
              break;

          case 6: // Laser Bass
              setOsc(this.osc1, 'sine', 1.0);
              setOsc(this.osc2, 'triangle', 1.0);
              // Pew Pew pitch
              this.osc1.frequency.setValueAtTime(1500, now);
              this.osc1.frequency.exponentialRampToValueAtTime(60, now + 0.15);
              this.osc2.frequency.setValueAtTime(1500, now);
              this.osc2.frequency.exponentialRampToValueAtTime(60, now + 0.15);
              setFilter('highpass', 100, 5);
              break;

          case 7: // Donk Hybrid
              setOsc(this.osc1, 'square', 0.5);
              setOsc(this.osc2, 'sine', 0.5);
              // Fast pitch envelope
              this.osc1.frequency.setValueAtTime(400, now);
              this.osc1.frequency.exponentialRampToValueAtTime(60, now + 0.05);
              setFilter('lowpass', 3000, 1);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(60, now); // Hard clip
              break;

          case 8: // Beast Roar
              setOsc(this.osc1, 'sawtooth', 0.25);
              setOsc(this.osc2, 'square', 0.25, -15);
              setFilter('bandpass', 200, 8);
              this.filter.frequency.setValueAtTime(200, now);
              this.filter.frequency.linearRampToValueAtTime(800, now + 0.2);
              this.filter.frequency.linearRampToValueAtTime(150, now + 0.8);
              if (this.dryWet) this.dryWet.gain.setValueAtTime(0.4, now); // Reverb
              break;

          case 9: // Metallic Grinder
              setOsc(this.osc1, 'sawtooth', 0.5);
              setOsc(this.osc2, 'sawtooth', 0.75); // Fifth
              setFilter('notch', 500, 20);
              // Notch sweep
              this.filter.frequency.linearRampToValueAtTime(2000, now + 0.5);
              if (this.preDistortionGain) this.preDistortionGain.gain.setValueAtTime(50, now);
              break;

          case 10: // Machine Gun Bass
              setOsc(this.osc1, 'square', 0.25);
              setOsc(this.osc2, 'sawtooth', 0.25);
              setFilter('lowpass', 1200, 1);
              // AM Modulation on volume for stutter
              this.gainNode.gain.setValueAtTime(this.safeNum(this.synthVolume, 0.15), now);
              this.gainNode.gain.setValueAtTime(0, now + 0.05);
              this.gainNode.gain.setValueAtTime(this.safeNum(this.synthVolume, 0.15), now + 0.10);
              this.gainNode.gain.setValueAtTime(0, now + 0.15);
              this.gainNode.gain.setValueAtTime(this.safeNum(this.synthVolume, 0.15), now + 0.20);
              this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
              break;
      }
      
      this.lastTriggerTime = now;
  }

  // --- CANCEL GROWL (Manual Cut) ---
  public cancelGrowl() {
      if (!this.ctx) return;
      
      this.isGrowling = false; // Allow modulate() to resume control
      const now = this.ctx.currentTime;
      
      // Cancel Volume Automation
      if (this.gainNode) {
          this.gainNode.gain.cancelScheduledValues(now);
          // Ramp quickly to normal volume to avoid clicks
          this.gainNode.gain.setTargetAtTime(this.safeNum(this.synthVolume, 0.15), now, 0.05);
      }
      
      // Reset Oscillators
      [this.osc1, this.osc2, this.osc3].forEach(osc => {
          if (osc) {
              osc.frequency.cancelScheduledValues(now);
              osc.detune.cancelScheduledValues(now);
          }
      });
      
      // Reset Filter
      if (this.filter) {
          this.filter.frequency.cancelScheduledValues(now);
          this.filter.Q.cancelScheduledValues(now);
          this.filter.type = 'lowpass';
          // Restore base params smoothly
          if (Number.isFinite(this.params.filterCutoffBase))
            this.filter.frequency.setTargetAtTime(this.params.filterCutoffBase, now, 0.05);
          if (Number.isFinite(this.params.filterResonanceBase))
            this.filter.Q.setTargetAtTime(this.params.filterResonanceBase, now, 0.05);
      }
      
      // Reset PreDistortion
      if (this.preDistortionGain) {
          this.preDistortionGain.gain.cancelScheduledValues(now);
          this.preDistortionGain.gain.setTargetAtTime(this.currentFx.distortion ? 50.0 : 1.0, now, 0.05);
      }
      
      // Re-apply params to ensure consistency
      this.setParams(this.params);
  }

  private triggerSpecialEffect(id: number) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      switch(id) {
          case 1: // Phase/Comb Sweep (Ripping)
            if (this.phaserLFO) {
                this.phaserLFO.frequency.setValueAtTime(0.5, now);
                this.phaserLFO.frequency.linearRampToValueAtTime(20, now + 0.5); // Fast sweep
                this.phaserLFO.frequency.exponentialRampToValueAtTime(0.5, now + 1.0);
            }
            if (this.phaserWetGain) {
                this.phaserWetGain.gain.setValueAtTime(1, now);
                this.phaserWetGain.gain.setTargetAtTime(0, now + 1, 0.5);
            }
            break;
            
          case 2: // Formant Shift
            if (this.filter) {
                // Vowel-ish movements
                this.filter.type = 'bandpass';
                this.filter.frequency.setValueAtTime(300, now);
                this.filter.frequency.exponentialRampToValueAtTime(1200, now + 0.2); // A -> I
                this.filter.frequency.exponentialRampToValueAtTime(400, now + 0.4); // I -> O
                this.filter.Q.setValueAtTime(5, now);
                // Reset
                setTimeout(() => {
                   if(this.filter && this.ctx && Number.isFinite(this.params.filterCutoffBase)) {
                       this.filter.type = 'lowpass';
                       this.filter.frequency.setTargetAtTime(this.params.filterCutoffBase, this.ctx.currentTime, 0.1);
                       this.filter.Q.setTargetAtTime(this.safeNum(this.params.filterResonanceBase, 1), this.ctx.currentTime, 0.1);
                   }
                }, 500);
            }
            break;

          case 3: // Wavefold / Distortion Macro
            if (this.preDistortionGain && this.shaper) {
                this.preDistortionGain.gain.setValueAtTime(50, now);
                this.preDistortionGain.gain.linearRampToValueAtTime(100, now + 0.1); // Slam it
                this.preDistortionGain.gain.exponentialRampToValueAtTime(1, now + 0.6);
            }
            break;

          case 4: // Chorus -> Flanger
             if (this.delay && this.delayFeedback && this.delayDryWet) {
                 const currentWet = this.currentFx.delay ? 0.5 : 0;
                 if (currentWet < 0.5) {
                     this.delayDryWet.gain.cancelScheduledValues(now);
                     this.delayDryWet.gain.setValueAtTime(currentWet, now);
                     this.delayDryWet.gain.linearRampToValueAtTime(0.5, now + 0.1);
                     
                     setTimeout(() => {
                         if (this.delayDryWet && this.ctx) {
                             const target = this.currentFx.delay ? 0.5 : 0;
                             this.delayDryWet.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
                         }
                     }, 1500);
                 }

                 this.delay.delayTime.setValueAtTime(0.015, now); // Flange range
                 this.delay.delayTime.linearRampToValueAtTime(0.002, now + 0.2); // Sweep up
                 this.delay.delayTime.linearRampToValueAtTime(0.3, now + 1.0); // Back to echo
                 
                 this.delayFeedback.gain.setValueAtTime(0.8, now);
                 this.delayFeedback.gain.linearRampToValueAtTime(0.4, now + 0.5);
             }
             break;

          case 5: // Pitch-bend Slam
             if (this.osc1 && this.osc2) {
                 const base1 = this.safeNum(this.osc1.frequency.value, 110);
                 const base2 = this.safeNum(this.osc2.frequency.value, 110);
                 
                 if(Number.isFinite(base1)) {
                    this.osc1.frequency.setValueAtTime(base1, now);
                    this.osc1.frequency.exponentialRampToValueAtTime(Math.max(10, base1 * 0.25), now + 0.1); // -2 octaves
                    this.osc1.frequency.setTargetAtTime(base1, now + 0.15, 0.1);
                 }
                 
                 if(Number.isFinite(base2)) {
                    this.osc2.frequency.setValueAtTime(base2, now);
                    this.osc2.frequency.exponentialRampToValueAtTime(Math.max(10, base2 * 0.25), now + 0.1);
                    this.osc2.frequency.setTargetAtTime(base2, now + 0.15, 0.1);
                 }
             }
             break;

          case 6: // Notch Sweep + Distortion
             if (this.filter && this.preDistortionGain) {
                 this.filter.type = 'notch';
                 this.filter.Q.value = 10;
                 this.filter.frequency.setValueAtTime(100, now);
                 this.filter.frequency.exponentialRampToValueAtTime(4000, now + 0.3);
                 
                 this.preDistortionGain.gain.setValueAtTime(10, now);
                 this.preDistortionGain.gain.linearRampToValueAtTime(40, now + 0.3);
                 
                 setTimeout(() => {
                     if (this.filter && this.ctx && Number.isFinite(this.params.filterCutoffBase)) {
                         this.filter.type = 'lowpass';
                         this.filter.frequency.setTargetAtTime(this.params.filterCutoffBase, this.ctx.currentTime, 0.1);
                         this.filter.Q.value = this.safeNum(this.params.filterResonanceBase, 1);
                     }
                 }, 400);
             }
             break;

          case 7: // Sub-drop Enhancer
             if (this.osc3) {
                 // transient boost on sub
                 const base = this.safeNum(this.osc3.frequency.value, 55);
                 if(Number.isFinite(base)) {
                    this.osc3.frequency.setValueAtTime(60, now);
                    this.osc3.frequency.exponentialRampToValueAtTime(30, now + 0.4);
                    // return
                    this.osc3.frequency.setTargetAtTime(base, now + 0.5, 0.2);
                 }
             }
             break;

          case 8: // FM Mod Shriek
             if (this.filter && Number.isFinite(this.params.filterCutoffBase)) {
                 this.filter.Q.setValueAtTime(20, now);
                 this.filter.frequency.setValueAtTime(this.params.filterCutoffBase, now);
                 this.filter.frequency.linearRampToValueAtTime(this.params.filterCutoffBase + 2000, now + 0.05);
                 this.filter.frequency.linearRampToValueAtTime(Math.max(10, this.params.filterCutoffBase - 500), now + 0.1);
                 this.filter.frequency.linearRampToValueAtTime(this.params.filterCutoffBase, now + 0.3);
                 
                 setTimeout(() => {
                     if (this.filter) this.filter.Q.value = this.safeNum(this.params.filterResonanceBase, 1);
                 }, 300);
             }
             break;

          case 9: // Resample Crusher
             if (this.crunchShaper) {
                 this.crunchShaper.curve = this.makeStepCurve(2); // Very low bit depth
                 setTimeout(() => {
                     if (this.crunchShaper) {
                         // Fallback to current state
                         this.crunchShaper.curve = this.currentFx.crunch ? this.makeDistortionCurve(15) : this.makeIdentityCurve();
                     }
                 }, 300);
             }
             break;
      }
  }

  public getAudioData(): Uint8Array | null {
      if (!this.analyser) return null;
      this.analyser.getByteFrequencyData(this.audioDataArray);
      return this.audioDataArray;
  }

  public setParams(newParams: AudioParams) {
    this.params = newParams;
    if (!this.ctx) return;
    if (this.osc1) this.osc1.type = this.getValidOscType(this.params.osc1Type);
    if (this.osc2) this.osc2.type = this.getValidOscType(this.params.osc2Type);
    if (this.shaper) this.shaper.curve = this.makeDistortionCurve(this.safeNum(this.params.distortionAmount, 0));
    this.updateFxState();
  }

  public setFx(fx: FxState) {
    this.currentFx = fx;
    this.updateFxState();
  }

  public setArpSettings(settings: ArpSettings) {
      if (settings.enabled && !this.arpSettings.enabled) {
          // Reset arp index on enable
          this.arpIndex = 0;
      }
      this.arpSettings = settings;
  }
  
  public setDrumSettings(settings: DrumSettings) {
      const prevFx = this.drumSettings.fx;
      if (settings.enabled && !this.drumSettings.enabled) {
          this.currentStep = 0;
      }
      this.drumSettings = settings;
      
      // Update volume
      if (this.drumGain && this.ctx) {
          const vol = this.safeNum(settings.volume, 1.0);
          this.drumGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
      }
      
      // Check if FX changed
      if (prevFx !== settings.fx) {
          this.updateDrumFx();
      }
  }
  
  public setGateSettings(settings: GateSettings) {
      const wasEnabled = this.gateSettings.enabled;
      this.gateSettings = settings;
      
      if (!this.ctx || !this.gateNode) return;
      const now = this.ctx.currentTime;

      if (!settings.enabled) {
           this.gateNode.gain.cancelScheduledValues(now);
           this.gateNode.gain.setTargetAtTime(1.0, now, 0.1);
      } else if (settings.enabled && !wasEnabled) {
           this.gateNode.gain.cancelScheduledValues(now);
           const bpm = this.safeNum(this.arpSettings.bpm, 120);
           const secondsPerBeat = 60 / bpm;
           const sixteenthTime = secondsPerBeat / 4;
           const patternLength = this.drumSettings.pattern.length || 16;
           const playbackStep = (this.currentStep - 1 + patternLength) % patternLength;
           this.scheduleGate(now, playbackStep, sixteenthTime);
      }
  }

  public setScaleFrequencies(freqs: number[]) {
      this.scaleFrequencies = freqs;
  }
  
  public setSynthVolume(vol: number) {
      this.synthVolume = vol;
  }

  public getCurrentStep(): number {
      return this.currentStep;
  }
  
  // Public method to trigger a victory sound or visual (optional, but good for scoring)
  public triggerVictory() {
      // Placeholder for victory sound logic if needed
      // Currently just exposes functionality
  }

  private updateFxState() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.highpass) this.highpass.frequency.setTargetAtTime(this.currentFx.highpass ? 560 : 10, now, 0.1);
    
    if (this.delayDryWet) this.delayDryWet.gain.setTargetAtTime(this.currentFx.delay ? 0.5 : 0, now, 0.1);
    
    const reverbVal = this.safeNum(this.params.reverbMix, 0.3);
    if (this.dryWet) this.dryWet.gain.setTargetAtTime(this.currentFx.reverb ? 0.6 : reverbVal, now, 0.1);
    if (this.preDistortionGain) this.preDistortionGain.gain.setTargetAtTime(this.currentFx.distortion ? 50.0 : 1.0, now, 0.1);
    
    if (this.crunchShaper) this.crunchShaper.curve = this.currentFx.crunch ? this.makeDistortionCurve(15) : this.makeIdentityCurve();
    
    if (this.phaserWetGain) this.phaserWetGain.gain.setTargetAtTime(this.currentFx.phaser ? 1.0 : 0, now, 0.1);
  }

  private async updateDrumFx() {
      if (!this.ctx || !this.drumFxInput || !this.drumFxOutput) return;
      
      // 1. Disconnect input to break chain safely
      this.drumFxInput.disconnect();
      
      // 2. Clear old nodes
      this.drumFxChainNodes.forEach(n => n.disconnect());
      this.drumFxChainNodes = [];
      
      // 3. Rebuild Chain based on Selection
      const fxType = this.drumSettings.fx;
      
      if (fxType === 'DRY') {
          this.drumFxInput.connect(this.drumFxOutput);
          return;
      }
      
      let chainStart: AudioNode | null = null;
      let chainEnd: AudioNode | null = null;
      
      const addToChain = (node: AudioNode) => {
          this.drumFxChainNodes.push(node);
          if (!chainStart) {
              chainStart = node;
              chainEnd = node;
          } else {
              chainEnd?.connect(node);
              chainEnd = node;
          }
      };
      
      if (fxType === 'STUDIO') {
          // Slapback Delay (1/16th) + Light Reverb
          const bpm = this.safeNum(this.arpSettings.bpm, 120);
          const delayTime = (60 / bpm) / 4; 
          
          const delay = this.ctx.createDelay(1.0);
          delay.delayTime.value = delayTime;
          
          const delayGain = this.ctx.createGain();
          delayGain.gain.value = 0.3; // 30% wet
          
          // Parallel processing is tricky with linear chain builder, 
          // but for drum insert we usually want series or mix. 
          // Let's do a simple mix: Input -> Split -> (Dry + Wet) -> Output
          // To keep it simple in this structure, we'll put delay in parallel via a wrapper gain
          // Actually, let's just make a small reverb impulse for "Studio"
          
          const verb = this.ctx.createConvolver();
          // Short room reverb
          verb.buffer = await this.createReverbImpulse(0.5, 5.0); 
          const verbGain = this.ctx.createGain();
          verbGain.gain.value = 0.3;
          
          // Re-route manually for parallel mix
          this.drumFxInput.connect(this.drumFxOutput); // Dry signal
          
          this.drumFxInput.connect(delay);
          delay.connect(delayGain);
          delayGain.connect(this.drumFxOutput);
          
          this.drumFxInput.connect(verb);
          verb.connect(verbGain);
          verbGain.connect(this.drumFxOutput);
          
          this.drumFxChainNodes.push(delay, delayGain, verb, verbGain);
          return; // Custom routing done
      }
      
      if (fxType === 'OVERDRIVE') {
          const shaper = this.ctx.createWaveShaper();
          shaper.curve = this.makeDistortionCurve(100); // Hard clip
          addToChain(shaper);
      }
      
      if (fxType === '80s_TAPE') {
          const sat = this.ctx.createWaveShaper();
          sat.curve = this.makeDistortionCurve(20); // Warm saturation
          
          const lpf = this.ctx.createBiquadFilter();
          lpf.type = 'highshelf'; // Roll off highs
          lpf.frequency.value = 7000;
          lpf.gain.value = -12; // Cut 12dB above 7k
          
          addToChain(sat);
          addToChain(lpf);
      }
      
      if (fxType === 'OTT') {
          // Simulated via EQ Smile Curve + Compression
          const lowBoost = this.ctx.createBiquadFilter();
          lowBoost.type = 'lowshelf';
          lowBoost.frequency.value = 100;
          lowBoost.gain.value = 6;
          
          const highBoost = this.ctx.createBiquadFilter();
          highBoost.type = 'highshelf';
          highBoost.frequency.value = 5000;
          highBoost.gain.value = 6;
          
          const midScoop = this.ctx.createBiquadFilter();
          midScoop.type = 'peaking';
          midScoop.frequency.value = 1000;
          midScoop.Q.value = 1;
          midScoop.gain.value = -3;
          
          addToChain(lowBoost);
          addToChain(highBoost);
          addToChain(midScoop);
          
          // We rely on the main drumCompressor which follows this chain
          // But let's boost input gain to slam the compressor
          const boost = this.ctx.createGain();
          boost.gain.value = 2.0; 
          addToChain(boost);
      }
      
      if (fxType === 'CRUNCH') {
          const crusher = this.ctx.createWaveShaper();
          crusher.curve = this.makeStepCurve(4); // 4-bit depth simulation
          addToChain(crusher);
      }
      
      if (fxType === 'STADIUM') {
          const verb = this.ctx.createConvolver();
          // Long hall
          verb.buffer = await this.createReverbImpulse(3.0, 2.0);
          
          const verbMix = this.ctx.createGain();
          verbMix.gain.value = 0.5;
          
          // Parallel Routing
          this.drumFxInput.connect(this.drumFxOutput); // Dry
          this.drumFxInput.connect(verb);
          verb.connect(verbMix);
          verbMix.connect(this.drumFxOutput);
          
          this.drumFxChainNodes.push(verb, verbMix);
          return;
      }
      
      // Connect Series Chain
      if (chainStart && chainEnd) {
          this.drumFxInput.connect(chainStart);
          chainEnd.connect(this.drumFxOutput);
      } else {
          // Fallback
          this.drumFxInput.connect(this.drumFxOutput);
      }
  }

  public setOctave(offset: number) {
    this.octaveOffset = offset;
  }
  
  public trigger() {
      if (this.ctx) {
          if (this.arpSettings.enabled) {
             this.arpIndex = 0;
             this.nextNoteTime = this.ctx.currentTime;
          } else {
             this.lastTriggerTime = this.ctx.currentTime;
             this.currentArpFreq = this.safeNum(this.params.baseFreq, 110); 
          }
          if (this.ctx.state === 'suspended') this.ctx.resume();
      }
  }

  public startRecording() {
    if (!this.destNode) return;
    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.destNode.stream);
    this.mediaRecorder.ondataavailable = (evt) => { if (evt.data.size > 0) this.audioChunks.push(evt.data); };
    this.mediaRecorder.start();
  }

  public stopRecording(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) { resolve(""); return; }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        resolve(URL.createObjectURL(blob));
      };
      this.mediaRecorder.stop();
    });
  }

  public modulate(x: number, y: number, speed: number, hardness: number, isClicked: boolean) {
    if (!this.ctx || !this.osc1 || !this.osc2 || !this.osc3 || !this.filter || !this.gainNode) return;
    if (this.isGrowling) return; // Prevent modulation during growl

    const now = this.ctx.currentTime;
    let isActive = false;
    if (this.arpSettings.enabled) {
        const notesPer16th = this.getNotesPer16th(this.arpSettings.division);
        const bpm = this.safeNum(this.arpSettings.bpm, 120);
        const secondsPerBeat = 60 / bpm;
        const sixteenthTime = secondsPerBeat / 4;
        
        let stepDuration = sixteenthTime;
        if (notesPer16th >= 1) stepDuration = sixteenthTime / notesPer16th;
        else stepDuration = sixteenthTime * (1/notesPer16th);

        const gateLen = stepDuration * this.arpSettings.gate;
        if (now - this.lastTriggerTime < gateLen) isActive = true;
    } else {
        const timeSinceTrigger = now - this.lastTriggerTime;
        const isTriggerActive = timeSinceTrigger < 0.5; 
        isActive = speed > 0.1 || isTriggerActive || isClicked;
    }
    const targetGain = isActive ? (this.safeNum(this.synthVolume, 0.15) * (this.arpSettings.enabled ? 1.0 : this.safeNum(this.params.sustain, 0.8))) : 0;
    
    // ADSR Envelope Logic replacement for hardcoded lag
    const attack = this.safeNum(this.params.attack, 0.01);
    const release = this.safeNum(this.params.release, 0.1);
    
    // Use user-defined ADSR instead of hardcoded values
    // Clamp to prevent non-finite errors
    const volumeLag = Math.max(0.001, isActive ? attack : release); 

    if(Number.isFinite(targetGain))
        this.gainNode.gain.setTargetAtTime(targetGain, now, volumeLag);

    if (this.preDistortionGain) {
        const baseDrive = this.currentFx.distortion ? 50.0 : 1.0;
        const clickBoost = isClicked ? 20.0 : 0;
        this.preDistortionGain.gain.setTargetAtTime(baseDrive + clickBoost, now, 0.02);
    }

    const pitchBend = (Number.isFinite(x) ? (x * 2 - 1) : 0) * 200; 
    let base = this.arpSettings.enabled ? this.currentArpFreq : this.safeNum(this.params.baseFreq, 110);
    base = base * Math.pow(2, this.octaveOffset);
    
    // RESPONSE TWEAK: Faster pitch tracking
    // Clamp lag to be strictly positive to avoid "non-finite" or "not supported" error
    const lag = Math.max(0.001, 0.04 * (1 - hardness)); 
    
    if (Number.isFinite(base))
        this.osc1.frequency.setTargetAtTime(base, now, lag);
    if (Number.isFinite(pitchBend))
        this.osc1.detune.setTargetAtTime(pitchBend, now, lag);
        
    const harmonicDetune = this.safeNum(this.params.detuneSpread, 15) + (Number.isFinite(y) ? y * 50 : 0);
    if (Number.isFinite(base)) {
        this.osc2.frequency.setTargetAtTime(base, now, lag);
        this.osc3.frequency.setTargetAtTime(base / 2, now, lag);
    }
    if (Number.isFinite(pitchBend + harmonicDetune))
        this.osc2.detune.setTargetAtTime(pitchBend + harmonicDetune, now, lag);

    let targetCutoff = this.safeNum(this.params.filterCutoffBase, 1000) + (hardness * 5000);
    if (isClicked) targetCutoff += 1000; 
    
    // RESPONSE TWEAK: Faster filter tracking
    if (Number.isFinite(targetCutoff))
        this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.02);
        
    const targetRes = this.safeNum(this.params.filterResonanceBase, 1) + (hardness * 10);
    if (Number.isFinite(targetRes))
        this.filter.Q.setTargetAtTime(targetRes, now, 0.02);
  }

  public stop() {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    if (this.ctx) {
      this.gainNode?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      
      // Prevent race condition: delay close, but allow init() to cancel it
      this.stopTimeout = setTimeout(() => {
        this.ctx?.close();
        this.ctx = null;
        this.stopTimeout = null;
      }, 250);
    }
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' && Number.isFinite(amount) ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
  private makeIdentityCurve() {
      const curve = new Float32Array(2);
      curve[0] = -1; curve[1] = 1;
      return curve;
  }
  private makeStepCurve(steps: number) {
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = Math.floor(x * steps) / steps;
      }
      return curve;
  }
  private async createReverbImpulse(duration: number, decay: number): Promise<AudioBuffer> {
    const sampleRate = this.ctx!.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx!.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const n = length - i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }
    return impulse;
  }
}
