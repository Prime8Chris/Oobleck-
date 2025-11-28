import { AudioParams, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GateDivision } from '../types';
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
      pattern: Array(16).fill({ kick: false, snare: false, hihat: false, clap: false }) 
  };
  private currentStep: number = 0;
  
  // Gate State
  private gateSettings: GateSettings = { enabled: false, pattern: 'OFF', division: '1/16', mix: 1.0 };
  
  // Drum Bus
  private drumCompressor: DynamicsCompressorNode | null = null;
  private drumGain: GainNode | null = null;
  private drumSaturation: WaveShaperNode | null = null;

  private currentFx: FxState = {
      delay: false, chorus: false, highpass: false,
      distortion: false, phaser: false, reverb: false, crunch: false
  };

  private stopTimeout: any = null;

  constructor(initialParams: AudioParams) {
    this.params = initialParams;
    this.currentArpFreq = initialParams.baseFreq;
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
    this.drumGain.gain.value = this.drumSettings.volume;
    
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
    this.shaper.curve = this.makeDistortionCurve(this.params.distortionAmount);
    
    this.crunchShaper = this.ctx.createWaveShaper();
    this.crunchShaper.curve = this.makeIdentityCurve();

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = this.params.filterResonanceBase;
    this.filter.frequency.value = this.params.filterCutoffBase;

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
    this.dryWet.gain.value = this.params.reverbMix;

    this.gateNode.connect(this.convolver);
    this.convolver.connect(this.dryWet);
    this.dryWet.connect(this.masterCompressor);

    this.startOscillators();
    this.startScheduler();
    this.updateFxState();
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
    const base = this.params.baseFreq;
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = this.params.osc1Type;
    this.osc1.frequency.value = base;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = this.params.osc2Type;
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

      // Use 16th notes for grid resolution
      const secondsPerBeat = 60 / this.arpSettings.bpm;
      const sixteenthTime = secondsPerBeat / 4;
      
      const lookahead = 0.1;

      if (this.nextNoteTime < this.ctx.currentTime) {
          this.nextNoteTime = this.ctx.currentTime + 0.01;
      }

      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
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
          const targetGain = isOpen ? 1.0 : Math.max(0, 1.0 - this.gateSettings.mix);
          // Use a very short ramp for click-free but sharp gating
          this.gateNode!.gain.setTargetAtTime(targetGain, t, 0.003);
      };

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
    if (!this.ctx || !this.drumCompressor) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.drumCompressor);

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

    osc.frequency.setValueAtTime(freqStart, time);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, time + decay);
    
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.start(time);
    osc.stop(time + decay);
  }

  private triggerSnare(time: number) {
    if (!this.ctx || !this.drumCompressor) return;
    const kit = this.drumSettings.kit || '808';

    // Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.connect(oscGain);
    oscGain.connect(this.drumCompressor);
    
    let toneFreq = 200;
    let toneDecay = 0.1;
    
    if (kit === '808') toneFreq = 200;
    else if (kit === '909') toneFreq = 250;
    else if (kit === 'INDUSTRIAL') toneFreq = 150;
    else if (kit === 'LOFI') toneFreq = 220;

    osc.frequency.setValueAtTime(toneFreq, time);
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
    osc.start(time);
    osc.stop(time + toneDecay);

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
    noiseGain.connect(this.drumCompressor);
    
    noiseGain.gain.setValueAtTime(0.7, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDuration);
    
    noise.start(time);
  }

  private triggerHiHat(time: number) {
    if (!this.ctx || !this.drumCompressor) return;
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
    gain.connect(this.drumCompressor);

    const vol = 0.4;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    noise.start(time);
  }

  private triggerClap(time: number) {
    if (!this.ctx || !this.drumCompressor) return;
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
    gain.connect(this.drumCompressor);

    // Clap envelope (multiple strikes)
    const t = time;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    gain.gain.setValueAtTime(0.5, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    gain.gain.setValueAtTime(0.5, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    noise.start(t);
  }

  private playArpNoteAt(time: number, duration: number) {
      const baseFreq = this.params.baseFreq; 
      
      let baseIndex = this.scaleFrequencies.findIndex(f => f >= baseFreq);
      if (baseIndex === -1) baseIndex = 0;

      // Ensure base index is valid within the scale provided
      if (baseIndex >= this.scaleFrequencies.length) baseIndex = 0;

      // The pool of notes is strictly determined by 'steps' and 'octaveRange'.
      // However, usually 'steps' in an ARP means the length of the pattern.
      // If the user selects Steps=1, we should only ever play the root.
      // If Steps=3, we cycle 0,1,2 relative to start.
      
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
      
      // Map stepOffset to Scale Index + Octave Shift
      // We want to span 'octaveRange' over the 'steps' if possible, or just walk up the scale?
      // Simple implementation: Walk up the scale array 'stepOffset' times.
      // If stepOffset exceeds scale length, wrap and add octave.
      
      const rawTargetIndex = baseIndex + stepOffset;
      const scaleLen = this.scaleFrequencies.length;
      
      let finalFreq = baseFreq;

      if (scaleLen > 0) {
          const wrappedIndex = rawTargetIndex % scaleLen;
          const octaveShift = Math.floor(rawTargetIndex / scaleLen);
          
          // Apply octave range limit? 
          // If the user sets Steps=16 but OctaveRange=1, should it go up forever? 
          // Let's constrain the octave shift by octaveRange.
          const constrainedOctave = octaveShift % (this.arpSettings.octaveRange + 1);
          
          finalFreq = this.scaleFrequencies[wrappedIndex] * Math.pow(2, constrainedOctave);
      }

      this.currentArpFreq = finalFreq;
      this.lastTriggerTime = time; // Trigger Envelope
  }

  // --- FX MACROS ---
  public triggerEffectStacks(ids: number[]) {
      if (!this.ctx) return;
      ids.forEach(id => this.triggerSpecialEffect(id));
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
                   if(this.filter) {
                       this.filter.type = 'lowpass';
                       this.filter.frequency.setTargetAtTime(this.params.filterCutoffBase, this.ctx!.currentTime, 0.1);
                       this.filter.Q.setTargetAtTime(this.params.filterResonanceBase, this.ctx!.currentTime, 0.1);
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
                 // Ensure we hear the effect by temporarily enabling delay if it's off.
                 // CRITICAL: Cap at 0.5 wetness (50%) as requested.
                 const currentWet = this.currentFx.delay ? 0.5 : 0;
                 if (currentWet < 0.5) {
                     this.delayDryWet.gain.cancelScheduledValues(now);
                     this.delayDryWet.gain.setValueAtTime(currentWet, now);
                     // Ramp up to 0.5 max
                     this.delayDryWet.gain.linearRampToValueAtTime(0.5, now + 0.1);
                     
                     // Restore state after effect (~1.5s)
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
                 const base1 = this.osc1.frequency.value;
                 const base2 = this.osc2.frequency.value;
                 this.osc1.frequency.setValueAtTime(base1, now);
                 this.osc1.frequency.exponentialRampToValueAtTime(base1 * 0.25, now + 0.1); // -2 octaves
                 this.osc1.frequency.setTargetAtTime(base1, now + 0.15, 0.1);
                 
                 this.osc2.frequency.setValueAtTime(base2, now);
                 this.osc2.frequency.exponentialRampToValueAtTime(base2 * 0.25, now + 0.1);
                 this.osc2.frequency.setTargetAtTime(base2, now + 0.15, 0.1);
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
                     if (this.filter) {
                         this.filter.type = 'lowpass';
                         this.filter.frequency.setTargetAtTime(this.params.filterCutoffBase, this.ctx!.currentTime, 0.1);
                         this.filter.Q.value = this.params.filterResonanceBase;
                     }
                 }, 400);
             }
             break;

          case 7: // Sub-drop Enhancer
             if (this.osc3) {
                 // transient boost on sub
                 const base = this.osc3.frequency.value;
                 this.osc3.frequency.setValueAtTime(60, now);
                 this.osc3.frequency.exponentialRampToValueAtTime(30, now + 0.4);
                 // return
                 this.osc3.frequency.setTargetAtTime(base, now + 0.5, 0.2);
             }
             break;

          case 8: // FM Mod Shriek
             // Simulate via rapid filter modulation since we don't have true FM setup exposed here easily
             if (this.filter) {
                 this.filter.Q.setValueAtTime(20, now);
                 this.filter.frequency.setValueAtTime(this.params.filterCutoffBase, now);
                 this.filter.frequency.linearRampToValueAtTime(this.params.filterCutoffBase + 2000, now + 0.05);
                 this.filter.frequency.linearRampToValueAtTime(this.params.filterCutoffBase - 500, now + 0.1);
                 this.filter.frequency.linearRampToValueAtTime(this.params.filterCutoffBase, now + 0.3);
                 
                 setTimeout(() => {
                     if (this.filter) this.filter.Q.value = this.params.filterResonanceBase;
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
    if (this.osc1) this.osc1.type = this.params.osc1Type;
    if (this.osc2) this.osc2.type = this.params.osc2Type;
    if (this.shaper) this.shaper.curve = this.makeDistortionCurve(this.params.distortionAmount);
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
      if (settings.enabled && !this.drumSettings.enabled) {
          this.currentStep = 0;
      }
      this.drumSettings = settings;
      if (this.drumGain) {
          this.drumGain.gain.setTargetAtTime(settings.volume, this.ctx!.currentTime, 0.1);
      }
  }
  
  public setGateSettings(settings: GateSettings) {
      this.gateSettings = settings;
      if (!settings.enabled && this.gateNode && this.ctx) {
           this.gateNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.1);
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

  private updateFxState() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.highpass) this.highpass.frequency.setTargetAtTime(this.currentFx.highpass ? 560 : 10, now, 0.1);
    
    // Explicit 0.5 cap for delay wetness
    if (this.delayDryWet) this.delayDryWet.gain.setTargetAtTime(this.currentFx.delay ? 0.5 : 0, now, 0.1);
    
    if (this.dryWet) this.dryWet.gain.setTargetAtTime(this.currentFx.reverb ? 0.6 : this.params.reverbMix, now, 0.1);
    if (this.preDistortionGain) this.preDistortionGain.gain.setTargetAtTime(this.currentFx.distortion ? 50.0 : 1.0, now, 0.1);
    
    // Updated Logic: "Crunch" is now "Saturate". Use makeDistortionCurve(15) for warm saturation instead of bitcrushing.
    if (this.crunchShaper) this.crunchShaper.curve = this.currentFx.crunch ? this.makeDistortionCurve(15) : this.makeIdentityCurve();
    
    if (this.phaserWetGain) this.phaserWetGain.gain.setTargetAtTime(this.currentFx.phaser ? 1.0 : 0, now, 0.1);
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
             this.currentArpFreq = this.params.baseFreq; 
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
    const now = this.ctx.currentTime;
    let isActive = false;
    if (this.arpSettings.enabled) {
        // With Arp enabled, we rely on the triggerEnvelope set in playArpNoteAt
        // But we need to keep the gate 'active' for the duration of the note?
        // Actually, playArpNoteAt updates lastTriggerTime.
        // We need to calculate gate length based on arp division.
        const notesPer16th = this.getNotesPer16th(this.arpSettings.division);
        const secondsPerBeat = 60 / this.arpSettings.bpm;
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
    const targetGain = isActive ? this.synthVolume : 0;
    
    // RESPONSE TWEAK: Faster attack (0.005), Faster release (0.1) for tight responsiveness
    const volumeLag = this.arpSettings.enabled ? 0.005 : (isActive ? 0.005 : 0.1); 
    this.gainNode.gain.setTargetAtTime(targetGain, now, volumeLag);

    if (this.preDistortionGain) {
        const baseDrive = this.currentFx.distortion ? 50.0 : 1.0;
        const clickBoost = isClicked ? 20.0 : 0;
        this.preDistortionGain.gain.setTargetAtTime(baseDrive + clickBoost, now, 0.02);
    }

    const pitchBend = (x * 2 - 1) * 200; 
    let base = this.arpSettings.enabled ? this.currentArpFreq : this.params.baseFreq;
    base = base * Math.pow(2, this.octaveOffset);
    
    // RESPONSE TWEAK: Faster pitch tracking
    const lag = 0.04 * (1 - hardness); 
    
    this.osc1.frequency.setTargetAtTime(base, now, lag);
    this.osc1.detune.setTargetAtTime(pitchBend, now, lag);
    const harmonicDetune = this.params.detuneSpread + (y * 50);
    this.osc2.frequency.setTargetAtTime(base, now, lag);
    this.osc2.detune.setTargetAtTime(pitchBend + harmonicDetune, now, lag);
    this.osc3.frequency.setTargetAtTime(base / 2, now, lag);

    let targetCutoff = this.params.filterCutoffBase + (hardness * 5000);
    if (isClicked) targetCutoff += 1000; 
    
    // RESPONSE TWEAK: Faster filter tracking
    this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.02);
    const targetRes = this.params.filterResonanceBase + (hardness * 10);
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
    const k = typeof amount === 'number' ? amount : 50;
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