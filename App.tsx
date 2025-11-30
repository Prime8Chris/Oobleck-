
import React, { useState, useEffect, useRef, useCallback } from 'react';
import FluidCanvas from './components/FluidCanvas';
import UIOverlay from './components/UIOverlay';
import WebcamMotion from './components/WebcamMotion';
import { AudioEngine } from './services/audioEngine';
import { DEFAULT_PRESET, GENRE_PRESETS, ALL_PRESETS, GATE_DIVISIONS } from './constants';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, VisualShape, CameraMode, RenderStyle, GateDivision, UserPatch } from './types';

const SLANG_TERMS = ["FRESH", "DOPE", "BITCHIN'", "SICK", "Yoooo", "NASTY", "MINT", "OOF", "FACK"];

const App: React.FC = () => {
  const [playState, setPlayState] = useState<PlayState>(PlayState.IDLE);
  const [preset, setPreset] = useState<SynthPreset>(DEFAULT_PRESET);
  
  // History State for "Run It Back" (ESC)
  const [previousPreset, setPreviousPreset] = useState<SynthPreset | null>(null);
  const [previousFxState, setPreviousFxState] = useState<FxState | null>(null);
  const [previousDrumSettings, setPreviousDrumSettings] = useState<DrumSettings | null>(null);
  const [previousGateSettings, setPreviousGateSettings] = useState<GateSettings | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [octave, setOctave] = useState(0);
  const [favorites, setFavorites] = useState<SynthPreset[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [synthVolume, setSynthVolume] = useState(0.15);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSounding, setIsSounding] = useState(false);
  const [crossFader, setCrossFader] = useState(0.5); // 0 = Drums, 1 = Synth, 0.5 = Mix
  
  const [currentGrowlName, setCurrentGrowlName] = useState<string | null>(null);
  const [isChaosLocked, setIsChaosLocked] = useState(false);

  // Defaults for initialization
  const defaultFx: FxState = { delay: false, chorus: false, highpass: false, distortion: false, phaser: false, reverb: false, crunch: false };
  const defaultArp: ArpSettings = { enabled: false, bpm: 86, division: '1/8', mode: 'UP', octaveRange: 1, gate: 0.5, steps: 1 };
  const defaultDrums: DrumSettings = { enabled: false, volume: 1.0, genre: 'BOOMBAP', kit: 'ACOUSTIC', pattern: GENRE_PRESETS['BOOMBAP'].pattern };
  const defaultGate: GateSettings = { enabled: false, pattern: 'TRANCE', division: '1/32', mix: 1.0 };

  // Dynamic Patch State (Full System State)
  const [userPatches, setUserPatches] = useState<(UserPatch | null)[]>(
      ALL_PRESETS.map((p, i) => ({
          label: i === 9 ? '0' : (i + 1).toString(),
          preset: p,
          fxState: defaultFx,
          drumSettings: defaultDrums,
          gateSettings: defaultGate,
          arpSettings: defaultArp,
          octave: 0
      }))
  );
  
  const [saveSlotIndex, setSaveSlotIndex] = useState(0);
  const [currentSlangIndex, setCurrentSlangIndex] = useState(0);

  // Visual Effect Sync
  const [activeVisualEffect, setActiveVisualEffect] = useState<number | null>(null);
  
  // Quantization Ref for Visuals
  const pendingVisualEffectRef = useRef<number | null>(null);
  
  // Shared Input Ref for coordinate handling (Webcam or Mouse)
  const inputRef = useRef<{ 
    x: number; 
    y: number; 
    vx: number; 
    vy: number; 
    lastX: number; 
    lastY: number; 
    isClicked: boolean 
  }>({ 
    x: -1000, y: -1000, vx: 0, vy: 0, lastX: -1000, lastY: -1000, isClicked: false 
  });

  const [fxState, setFxState] = useState<FxState>(defaultFx);
  const [arpSettings, setArpSettings] = useState<ArpSettings>(defaultArp);
  const [drumSettings, setDrumSettings] = useState<DrumSettings>(defaultDrums);
  const [gateSettings, setGateSettings] = useState<GateSettings>(defaultGate);

  // Track the user-selected baseline division to return to after modulation
  const baselineGateDivision = useRef<GateDivision>('1/32');
  
  // Drop Logic Refs
  const waitingForDropRef = useRef(false);
  
  // Snapshot Refs for Performance Actions
  const preGrowlGateSettings = useRef<GateSettings | null>(null);
  const preGrowlPreset = useRef<SynthPreset | null>(null);
  const preGrowlFxState = useRef<FxState | null>(null);
  const preGrowlBaselineGate = useRef<GateDivision>('1/32');
  
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasSoundingRef = useRef(false);

  // Load Favorites on Mount
  useEffect(() => {
      try {
          const saved = localStorage.getItem('oobleck_favorites');
          if (saved) {
              setFavorites(JSON.parse(saved));
          }
      } catch (e) {
          console.error("Failed to load favorites", e);
      }
  }, []);

  // Initialize Audio Engine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine(preset.audio);
    
    // Start UI Sync Loop for Sequencer Step
    const syncLoop = () => {
        if (audioEngineRef.current) {
            setCurrentStep(audioEngineRef.current.getCurrentStep());
        }
        animationFrameRef.current = requestAnimationFrame(syncLoop);
    };
    syncLoop();

    return () => {
      audioEngineRef.current?.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Handle Play State Changes
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (playState === PlayState.PLAYING) {
      engine.init().then(() => {
        if (engine.ctx?.state === 'suspended') {
          engine.ctx.resume();
        }
        engine.setFx(fxState);
        engine.setArpSettings(arpSettings);
        engine.setDrumSettings(drumSettings);
        engine.setGateSettings(gateSettings);
        engine.setSynthVolume(synthVolume);
        engine.setOctave(octave);
      });
    }
  }, [playState]);

  // Sync Parameters with Audio Engine
  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setParams(preset.audio);
  }, [preset]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setFx(fxState);
  }, [fxState]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setArpSettings(arpSettings);
  }, [arpSettings]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setDrumSettings(drumSettings);
  }, [drumSettings]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setGateSettings(gateSettings);
  }, [gateSettings]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setSynthVolume(synthVolume);
  }, [synthVolume]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setOctave(octave);
  }, [octave]);


  // --- VISUAL EFFECT GATEKEEPER ---
  const lastVisualTriggerTime = useRef(0);
  const triggerVisualEffect = useCallback((effectId: number) => {
      const now = Date.now();
      // Cooldown to prevent stacking/lag
      if (now - lastVisualTriggerTime.current > 200) {
          setActiveVisualEffect(effectId);
          lastVisualTriggerTime.current = now;
          // Reset after short duration
          setTimeout(() => setActiveVisualEffect(null), 300);
      }
  }, []);
  
  // 32nd Note Quantization for Visuals
  useEffect(() => {
      if (pendingVisualEffectRef.current !== null) {
          triggerVisualEffect(pendingVisualEffectRef.current);
          pendingVisualEffectRef.current = null;
      }
  }, [currentStep, triggerVisualEffect]);


  // --- PHYSICS LOOP ---
  // Calculates Gate Speed Modulation based on Screen Y Position
  const handlePhysicsUpdate = useCallback((x: number, y: number, speed: number, hardness: number, isClicked: boolean) => {
    if (!audioEngineRef.current) return;
    
    // Audio Modulation
    audioEngineRef.current.modulate(x, y, speed, hardness, isClicked);
    
    // Is Sounding Check
    const isNowSounding = speed > 0.1 || isClicked || hardness > 0.1;
    if (isNowSounding !== wasSoundingRef.current) {
        setIsSounding(isNowSounding);
        wasSoundingRef.current = isNowSounding;
    }
    
    // Gate Speed Modulation by Screen Position
    if (isClicked || speed > 0.5) {
        // Only modulate if not in a special state
        if (!waitingForDropRef.current && drumSettings.enabled) {
            let targetDiv = baselineGateDivision.current;
            const divisions = GATE_DIVISIONS;
            const baselineIdx = divisions.indexOf(baselineGateDivision.current);

            if (y < 0.33) {
                 // TOP: Double Speed (shift left in array)
                 if (baselineIdx > 0) targetDiv = divisions[Math.max(0, baselineIdx - 1)];
            } else if (y > 0.66) {
                 // BOTTOM: Match Baseline (No Slow Down) - as requested
                 targetDiv = baselineGateDivision.current;
            } else {
                 // MIDDLE: Baseline
                 targetDiv = baselineGateDivision.current;
            }
            
            if (targetDiv !== gateSettings.division) {
                 setGateSettings(prev => ({ ...prev, division: targetDiv }));
            }
        }
    }
    
    // Trigger Visual FX on Hard Interaction
    if (isClicked && speed > 50) {
        const randomEffect = Math.floor(Math.random() * 5);
        pendingVisualEffectRef.current = randomEffect;
    }

  }, [gateSettings.division, drumSettings.enabled]);


  // --- PERFORMANCE HANDLERS ---

  // 1. REVERT (Run It Back / ESC)
  const handleRevertPreset = useCallback(() => {
      if (previousPreset) {
          // Swap Current <-> Previous
          const tempPreset = preset;
          const tempFx = fxState;
          const tempDrums = drumSettings;
          const tempGate = gateSettings;
          
          setPreset(previousPreset);
          setFxState(previousFxState || defaultFx);
          setDrumSettings(previousDrumSettings || defaultDrums);
          setGateSettings(previousGateSettings || defaultGate);
          
          // Update History
          setPreviousPreset(tempPreset);
          setPreviousFxState(tempFx);
          setPreviousDrumSettings(tempDrums);
          setPreviousGateSettings(tempGate);
          
          // Update Baseline Ref for Screen Mod
          if (previousGateSettings) {
             baselineGateDivision.current = previousGateSettings.division;
          }

          if (audioEngineRef.current) {
             audioEngineRef.current.cancelGrowl(); // Ensure clean slate
          }
      } else {
          // No history? Restore pre-growl snapshot if available
          if (preGrowlGateSettings.current) {
              setGateSettings(preGrowlGateSettings.current);
              baselineGateDivision.current = preGrowlGateSettings.current.division;
          }
          if (preGrowlPreset.current) setPreset(preGrowlPreset.current);
          if (preGrowlFxState.current) setFxState(preGrowlFxState.current);
      }
      setCurrentGrowlName(null);
  }, [previousPreset, preset, fxState, drumSettings, gateSettings]);

  // 2. CHAOS MODE (Randomize)
  const handleRandomize = useCallback(() => {
    if (isChaosLocked) return;

    // Save History
    setPreviousPreset(preset);
    setPreviousFxState(fxState);
    setPreviousDrumSettings(drumSettings);
    setPreviousGateSettings(gateSettings);

    // Pick Random Preset
    const randomPreset = ALL_PRESETS[Math.floor(Math.random() * ALL_PRESETS.length)];
    
    // Create new preset ensuring we keep the current note (BaseFreq)
    const newPreset = {
        ...randomPreset,
        audio: {
            ...randomPreset.audio,
            baseFreq: preset.audio.baseFreq, // Preserve Note
            sustain: 1.0 // Force Sustain 100%
        },
        visual: {
             ...randomPreset.visual,
             // Randomize visuals
             shape: ['circle','square','triangle','hexagon','star'][Math.floor(Math.random()*5)] as VisualShape,
             renderStyle: ['particles','wireframe','mosaic','scanner'][Math.floor(Math.random()*4)] as RenderStyle,
             cameraMode: ['static','sway','pulse','shake','spin'][Math.floor(Math.random()*5)] as CameraMode
        }
    };
    setPreset(newPreset);

    // Randomize FX
    const randomFx: FxState = {
        delay: Math.random() > 0.5,
        chorus: Math.random() > 0.7,
        highpass: Math.random() > 0.8,
        distortion: Math.random() > 0.6,
        phaser: Math.random() > 0.7,
        reverb: true, // Always on
        crunch: Math.random() > 0.8
    };
    setFxState(randomFx);
    
    // Force Gate 1/32 and ON
    const newGate: GateSettings = { ...gateSettings, enabled: true, division: '1/32' };
    setGateSettings(newGate);
    baselineGateDivision.current = '1/32';
    
    // Force Rhythm ON
    if (!drumSettings.enabled) {
        setDrumSettings(prev => ({ ...prev, enabled: true }));
    }

  }, [preset, fxState, drumSettings, gateSettings, isChaosLocked]);

  // 3. GROWL (Grrrr!)
  const handleGrowl = useCallback(() => {
      // Snapshot
      preGrowlGateSettings.current = gateSettings;
      preGrowlPreset.current = preset;
      preGrowlFxState.current = fxState;
      preGrowlBaselineGate.current = baselineGateDivision.current;

      const names = ["Yoi", "Reese", "Laser", "Screech", "Growl", "Grind", "Machine"];
      const growlId = Math.floor(Math.random() * names.length) + 1; // 1-based index (approx)
      // Actually audio engine supports 10, map loosely
      const engineGrowlId = Math.floor(Math.random() * 10) + 1;
      
      setCurrentGrowlName(names[Math.floor(Math.random() * names.length)]);

      // 1. Trigger Audio Growl
      if (audioEngineRef.current) {
          audioEngineRef.current.triggerGrowl(engineGrowlId);
          // Force Gate OFF immediately (imperative)
          audioEngineRef.current.setGateSettings({...gateSettings, enabled: false});
      }
      
      // 2. React State Update
      setGateSettings(prev => ({ ...prev, enabled: false }));

      // 3. Setup Drop Logic
      if (drumSettings.enabled) {
          waitingForDropRef.current = true;
      } else {
          // Fallback if no rhythm
          setTimeout(() => {
              handleRevertPreset();
              if (audioEngineRef.current) audioEngineRef.current.cancelGrowl();
          }, 1000);
      }
  }, [gateSettings, preset, fxState, drumSettings, handleRevertPreset]);

  // 4. CHOP IT UP
  const handleChop = useCallback(() => {
      // Snapshot
      preGrowlGateSettings.current = gateSettings;
      preGrowlBaselineGate.current = baselineGateDivision.current;
      
      // Target: 1/64 Gate ON
      const target: GateSettings = { ...gateSettings, enabled: true, division: '1/64' };
      
      if (audioEngineRef.current) {
          audioEngineRef.current.setGateSettings(target);
      }
      setGateSettings(target);
      
      // Use Drop Logic to Stop
      if (drumSettings.enabled) {
          waitingForDropRef.current = true;
      } else {
          setTimeout(() => {
               // Restore
               if (preGrowlGateSettings.current) setGateSettings(preGrowlGateSettings.current);
          }, 1000);
      }
  }, [gateSettings, drumSettings]);

  // --- DROP LOGIC (Sync to Kick/Snare) ---
  useEffect(() => {
      if (waitingForDropRef.current && drumSettings.enabled) {
          const pattern = drumSettings.pattern;
          const stepData = pattern[currentStep] || { kick: false, snare: false };
          
          if (stepData.kick || stepData.snare) {
              // EXECUTE DROP
              
              if (audioEngineRef.current) {
                  audioEngineRef.current.cancelGrowl();
              }
              
              // Determine what to revert to
              let targetGate = preGrowlGateSettings.current;
              
              if (previousPreset) {
                  // If we have history (Chaos -> Growl -> Drop)
                  setPreset(previousPreset);
                  setFxState(previousFxState || defaultFx);
                  // Do NOT revert drums (keep beat flowing)
                  setPreviousPreset(preset); // Swap history
              } else {
                  // Simple Revert (Preset -> Growl -> Drop)
                  if (preGrowlPreset.current) setPreset(preGrowlPreset.current);
                  if (preGrowlFxState.current) setFxState(preGrowlFxState.current);
              }
              
              // Ensure Gate returns to something valid (default 1/32 if it was OFF/weird)
              if (!targetGate || !targetGate.enabled) {
                  targetGate = { ...gateSettings, enabled: true, division: '1/32' };
              }
              
              // IMPERATIVE RESTORE for punch-in
              if (audioEngineRef.current && targetGate) {
                  audioEngineRef.current.setGateSettings(targetGate);
              }
              setGateSettings(targetGate);
              baselineGateDivision.current = targetGate.division;
              
              waitingForDropRef.current = false;
              setCurrentGrowlName(null);
          }
      }
  }, [currentStep, drumSettings, preset, previousPreset, gateSettings]);


  // --- SAVE / LOAD PATCHES ---
  const handleBigSave = useCallback(() => {
      const label = `${SLANG_TERMS[currentSlangIndex]} (${saveSlotIndex === 9 ? 0 : saveSlotIndex + 1})`;
      
      // Create Patch (Excluding current Gate settings, force default)
      const patch: UserPatch = {
          label: label,
          preset: { ...preset, description: label },
          fxState: fxState,
          drumSettings: drumSettings,
          gateSettings: defaultGate, // Don't save gate state
          arpSettings: arpSettings,
          octave: octave
      };
      
      setUserPatches(prev => {
          const next = [...prev];
          next[saveSlotIndex] = patch;
          return next;
      });
      
      // Update UI state
      setPreset(prev => ({ ...prev, description: label }));
      
      // Cycle Indices
      setCurrentSlangIndex(prev => (prev + 1) % SLANG_TERMS.length);
      setSaveSlotIndex(prev => (prev + 1) % 10);
      
  }, [preset, fxState, drumSettings, arpSettings, octave, saveSlotIndex, currentSlangIndex]);

  const handleLoadPatch = useCallback((patch: UserPatch) => {
      // Capture current running states
      const wasDrumming = drumSettings.enabled;
      const wasGating = gateSettings.enabled;

      // History
      setPreviousPreset(preset);
      setPreviousFxState(fxState);
      setPreviousDrumSettings(drumSettings);
      setPreviousGateSettings(gateSettings);

      // Restore
      setPreset(patch.preset);
      setFxState(patch.fxState);
      
      // Drums: Force ON if running, else use patch setting
      const newDrums = { ...patch.drumSettings, enabled: wasDrumming || patch.drumSettings.enabled };
      setDrumSettings(newDrums);
      
      // Gate: IGNORE patch settings completely, keep current gate
      // (As requested: presets should not store/change gate data)
      const newGate = gateSettings; 
      
      setArpSettings(patch.arpSettings);
      setOctave(patch.octave);
      
      if (audioEngineRef.current) {
          audioEngineRef.current.setParams(patch.preset.audio);
          audioEngineRef.current.setFx(patch.fxState);
          audioEngineRef.current.setDrumSettings(newDrums);
          // Don't update gate from patch
          audioEngineRef.current.setArpSettings(patch.arpSettings);
          audioEngineRef.current.setOctave(patch.octave);
      }
  }, [preset, fxState, drumSettings, gateSettings, octave]);


  // --- WEBCAM HANDLER ---
  const handleZoneTrigger = useCallback((zoneIdx: number, visualEffectIdx?: number) => {
      // Visual Sync
      if (typeof visualEffectIdx === 'number') {
          pendingVisualEffectRef.current = visualEffectIdx;
      }
      
      if (zoneIdx === 0) { // TL: CHOP IT UP
          handleChop();
      } else if (zoneIdx === 1) { // TR: GRRRR! (Growl)
          handleGrowl();
      } else if (zoneIdx === 2) { // BL: RUN BACK (Undo)
          // Ensure rhythm stays on if it was on
          const wasDrumming = drumSettings.enabled;
          handleRevertPreset();
          if (wasDrumming) {
              setDrumSettings(prev => ({...prev, enabled: true}));
              if(audioEngineRef.current) audioEngineRef.current.setDrumSettings({...drumSettings, enabled: true});
          }
      } else if (zoneIdx === 3) { // BR: CHAOS
          handleRandomize();
      }
  }, [handleChop, handleGrowl, handleRevertPreset, handleRandomize, drumSettings]);

  // Handle Manual Gate Change (Update Baseline)
  const handleManualGateChange = (s: GateSettings) => {
      setGateSettings(s);
      baselineGateDivision.current = s.division;
  };


  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white selection:bg-teal-500/30">
      <FluidCanvas 
        key={1} // Force fresh canvas
        physics={preset.physics} 
        visual={preset.visual}
        onUpdate={handlePhysicsUpdate}
        isPlaying={playState === PlayState.PLAYING}
        getAudioData={() => audioEngineRef.current?.getAudioData() || null}
        inputRef={inputRef}
        activeEffect={activeVisualEffect}
      />
      
      <WebcamMotion 
        isActive={isCameraActive} 
        inputRef={inputRef} 
        onZoneTrigger={handleZoneTrigger}
      />

      <UIOverlay 
        currentPreset={preset}
        onPresetChange={setPreset}
        onRevertPreset={handleRevertPreset}
        playState={playState}
        setPlayState={setPlayState}
        onGenerateStart={() => {}}
        isRecording={isRecording}
        onToggleRecord={() => {
            if(isRecording) {
                audioEngineRef.current?.stopRecording().then(url => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `oobleck-session-${Date.now()}.webm`;
                    a.click();
                    setIsRecording(false);
                });
            } else {
                audioEngineRef.current?.startRecording();
                setIsRecording(true);
            }
        }}
        octave={octave}
        onOctaveChange={setOctave}
        fxState={fxState}
        onToggleFx={(k) => setFxState(prev => ({ ...prev, [k]: !prev[k] }))}
        onNotePlay={(f) => {
            if(audioEngineRef.current) {
                audioEngineRef.current.setParams({...preset.audio, baseFreq: f});
                audioEngineRef.current.trigger();
            }
        }}
        arpSettings={arpSettings}
        onArpChange={setArpSettings}
        onScaleFrequenciesChange={(freqs) => audioEngineRef.current?.setScaleFrequencies(freqs)}
        drumSettings={drumSettings}
        onDrumChange={setDrumSettings}
        currentStep={currentStep}
        gateSettings={gateSettings}
        onGateChange={handleManualGateChange}
        synthVolume={synthVolume}
        onSynthVolumeChange={setSynthVolume}
        favorites={favorites}
        onSaveFavorite={() => {
            const newFavs = [...favorites, preset];
            setFavorites(newFavs);
            localStorage.setItem('oobleck_favorites', JSON.stringify(newFavs));
        }}
        onDeleteFavorite={(i) => {
            const newFavs = favorites.filter((_, idx) => idx !== i);
            setFavorites(newFavs);
            localStorage.setItem('oobleck_favorites', JSON.stringify(newFavs));
        }}
        isCameraActive={isCameraActive}
        onToggleCamera={() => setIsCameraActive(!isCameraActive)}
        isSounding={isSounding}
        onRandomize={handleRandomize}
        crossFader={crossFader}
        onCrossFaderChange={(v) => {
            setCrossFader(v);
            // Engine update logic if needed for crossfader specifically
            // (Currently AudioEngine handles volumes directly via settings, 
            // but if crossfader logic was inside engine, we'd pass it here)
            // For now, we update volumes:
            if(audioEngineRef.current) {
                audioEngineRef.current.setDrumSettings({...drumSettings, volume: 1.0 - v}); // Simple mix
                audioEngineRef.current.setSynthVolume(v * 0.3); // Scale synth max
            }
        }}
        onGrowl={handleGrowl}
        currentGrowlName={currentGrowlName}
        onChop={handleChop}
        
        userPatches={userPatches}
        onLoadPatch={handleLoadPatch}
        onBigSave={handleBigSave}
        saveButtonText={SLANG_TERMS[currentSlangIndex]}
        nextSaveSlotIndex={saveSlotIndex}
      />
    </div>
  );
};

export default App;
