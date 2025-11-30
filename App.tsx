
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
  const [crossFader, setCrossFader] = useState(0.5); 
  
  const [currentGrowlName, setCurrentGrowlName] = useState<string | null>(null);
  const [isChaosLocked, setIsChaosLocked] = useState(false);

  const defaultFx: FxState = { delay: false, chorus: false, highpass: false, distortion: false, phaser: false, reverb: false, crunch: false };
  const defaultArp: ArpSettings = { enabled: false, bpm: 86, division: '1/8', mode: 'UP', octaveRange: 1, gate: 0.5, steps: 1 };
  const defaultDrums: DrumSettings = { enabled: false, volume: 1.0, genre: 'BOOMBAP', kit: 'ACOUSTIC', fx: 'DRY', pattern: GENRE_PRESETS['BOOMBAP'].pattern };
  const defaultGate: GateSettings = { enabled: false, pattern: 'TRANCE', division: '1/32', mix: 1.0 };

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

  const [activeVisualEffect, setActiveVisualEffect] = useState<number | null>(null);
  
  const pendingVisualEffectRef = useRef<number | null>(null);
  
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

  const baselineGateDivision = useRef<GateDivision>('1/32');
  
  const waitingForDropRef = useRef(false);
  
  const preGrowlGateSettings = useRef<GateSettings | null>(null);
  const preGrowlPreset = useRef<SynthPreset | null>(null);
  const preGrowlFxState = useRef<FxState | null>(null);
  const preGrowlBaselineGate = useRef<GateDivision>('1/32');
  
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasSoundingRef = useRef(false);

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

  useEffect(() => {
    audioEngineRef.current = new AudioEngine(preset.audio);
    
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


  const lastVisualTriggerTime = useRef(0);
  const triggerVisualEffect = useCallback((effectId: number) => {
      const now = Date.now();
      if (now - lastVisualTriggerTime.current > 200) {
          setActiveVisualEffect(effectId);
          lastVisualTriggerTime.current = now;
          setTimeout(() => setActiveVisualEffect(null), 300);
      }
  }, []);
  
  useEffect(() => {
      if (pendingVisualEffectRef.current !== null) {
          triggerVisualEffect(pendingVisualEffectRef.current);
          pendingVisualEffectRef.current = null;
      }
  }, [currentStep, triggerVisualEffect]);


  const handlePhysicsUpdate = useCallback((x: number, y: number, speed: number, hardness: number, isClicked: boolean) => {
    if (!audioEngineRef.current) return;
    
    audioEngineRef.current.modulate(x, y, speed, hardness, isClicked);
    
    const isNowSounding = speed > 0.1 || isClicked || hardness > 0.1;
    if (isNowSounding !== wasSoundingRef.current) {
        setIsSounding(isNowSounding);
        wasSoundingRef.current = isNowSounding;
    }
    
    if (isClicked || speed > 0.5) {
        if (!waitingForDropRef.current && drumSettings.enabled) {
            let targetDiv = baselineGateDivision.current;
            const divisions = GATE_DIVISIONS;
            const baselineIdx = divisions.indexOf(baselineGateDivision.current);

            if (y < 0.33) {
                 if (baselineIdx > 0) targetDiv = divisions[Math.max(0, baselineIdx - 1)];
            } else if (y > 0.66) {
                 targetDiv = baselineGateDivision.current;
            } else {
                 targetDiv = baselineGateDivision.current;
            }
            
            if (targetDiv !== gateSettings.division) {
                 setGateSettings(prev => ({ ...prev, division: targetDiv }));
            }
        }
    }
    
    if (isClicked && speed > 50) {
        const randomEffect = Math.floor(Math.random() * 5);
        pendingVisualEffectRef.current = randomEffect;
    }

  }, [gateSettings.division, drumSettings.enabled]);


  const handleRevertPreset = useCallback(() => {
      if (previousPreset) {
          const tempPreset = preset;
          const tempFx = fxState;
          const tempDrums = drumSettings;
          const tempGate = gateSettings;
          
          setPreset(previousPreset);
          setFxState(previousFxState || defaultFx);
          setDrumSettings(previousDrumSettings || defaultDrums);
          setGateSettings(previousGateSettings || defaultGate);
          
          setPreviousPreset(tempPreset);
          setPreviousFxState(tempFx);
          setPreviousDrumSettings(tempDrums);
          setPreviousGateSettings(tempGate);
          
          if (previousGateSettings) {
             baselineGateDivision.current = previousGateSettings.division;
          }

          if (audioEngineRef.current) {
             audioEngineRef.current.cancelGrowl(); 
          }
      } else {
          if (preGrowlGateSettings.current) {
              setGateSettings(preGrowlGateSettings.current);
              baselineGateDivision.current = preGrowlGateSettings.current.division;
          }
          if (preGrowlPreset.current) setPreset(preGrowlPreset.current);
          if (preGrowlFxState.current) setFxState(preGrowlFxState.current);
      }
      setCurrentGrowlName(null);
  }, [previousPreset, preset, fxState, drumSettings, gateSettings]);

  const handleRandomize = useCallback(() => {
    if (isChaosLocked) return;

    setPreviousPreset(preset);
    setPreviousFxState(fxState);
    setPreviousDrumSettings(drumSettings);
    setPreviousGateSettings(gateSettings);

    const randomPreset = ALL_PRESETS[Math.floor(Math.random() * ALL_PRESETS.length)];
    
    const newPreset = {
        ...randomPreset,
        audio: {
            ...randomPreset.audio,
            baseFreq: preset.audio.baseFreq,
            sustain: 1.0 
        },
        visual: {
             ...randomPreset.visual,
             shape: ['circle','square','triangle','hexagon','star'][Math.floor(Math.random()*5)] as VisualShape,
             renderStyle: ['particles','wireframe','mosaic','scanner'][Math.floor(Math.random()*4)] as RenderStyle,
             cameraMode: ['static','sway','pulse','shake','spin'][Math.floor(Math.random()*5)] as CameraMode
        }
    };
    setPreset(newPreset);

    const randomFx: FxState = {
        delay: Math.random() > 0.5,
        chorus: Math.random() > 0.7,
        highpass: Math.random() > 0.8,
        distortion: Math.random() > 0.6,
        phaser: Math.random() > 0.7,
        reverb: true, 
        crunch: Math.random() > 0.8
    };
    setFxState(randomFx);
    
    const newGate: GateSettings = { ...gateSettings, enabled: true, division: '1/32' };
    setGateSettings(newGate);
    baselineGateDivision.current = '1/32';
    
    // Force Drum Enable on Chaos
    if (!drumSettings.enabled) {
        setDrumSettings(prev => ({ ...prev, enabled: true }));
    }

  }, [preset, fxState, drumSettings, gateSettings, isChaosLocked]);

  const handleGrowl = useCallback(() => {
      preGrowlGateSettings.current = gateSettings;
      preGrowlPreset.current = preset;
      preGrowlFxState.current = fxState;
      preGrowlBaselineGate.current = baselineGateDivision.current;

      const names = ["Yoi", "Reese", "Laser", "Screech", "Growl", "Grind", "Machine"];
      const engineGrowlId = Math.floor(Math.random() * 10) + 1;
      
      setCurrentGrowlName(names[Math.floor(Math.random() * names.length)]);

      if (audioEngineRef.current) {
          audioEngineRef.current.triggerGrowl(engineGrowlId);
          // Instant imperative update
          audioEngineRef.current.setGateSettings({...gateSettings, enabled: false});
      }
      
      setGateSettings(prev => ({ ...prev, enabled: false }));

      if (drumSettings.enabled) {
          waitingForDropRef.current = true;
      } else {
          setTimeout(() => {
              handleRevertPreset();
              if (audioEngineRef.current) audioEngineRef.current.cancelGrowl();
          }, 1000);
      }
  }, [gateSettings, preset, fxState, drumSettings, handleRevertPreset]);

  const handleChop = useCallback(() => {
      preGrowlGateSettings.current = gateSettings;
      preGrowlBaselineGate.current = baselineGateDivision.current;
      
      const target: GateSettings = { ...gateSettings, enabled: true, division: '1/64' };
      
      if (audioEngineRef.current) {
          audioEngineRef.current.setGateSettings(target);
      }
      setGateSettings(target);
      
      if (drumSettings.enabled) {
          waitingForDropRef.current = true;
      } else {
          setTimeout(() => {
               if (preGrowlGateSettings.current) setGateSettings(preGrowlGateSettings.current);
          }, 1000);
      }
  }, [gateSettings, drumSettings]);

  useEffect(() => {
      if (waitingForDropRef.current && drumSettings.enabled) {
          const pattern = drumSettings.pattern;
          const stepData = pattern[currentStep] || { kick: false, snare: false };
          
          if (stepData.kick || stepData.snare) {
              
              if (audioEngineRef.current) {
                  audioEngineRef.current.cancelGrowl();
              }
              
              let targetGate = preGrowlGateSettings.current;
              
              if (previousPreset) {
                  setPreset(previousPreset);
                  setFxState(previousFxState || defaultFx);
                  setPreviousPreset(preset); 
              } else {
                  if (preGrowlPreset.current) setPreset(preGrowlPreset.current);
                  if (preGrowlFxState.current) setFxState(preGrowlFxState.current);
              }
              
              // Fallback if gate was somehow unset
              if (!targetGate || !targetGate.enabled) {
                  targetGate = { ...gateSettings, enabled: true, division: '1/32' };
              }
              
              // Force imperative update to prevent race conditions
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


  const handleBigSave = useCallback(() => {
      const label = `${SLANG_TERMS[currentSlangIndex]} (${saveSlotIndex === 9 ? 0 : saveSlotIndex + 1})`;
      
      const patch: UserPatch = {
          label: label,
          preset: { ...preset, description: label },
          fxState: fxState,
          drumSettings: drumSettings,
          gateSettings: defaultGate, 
          arpSettings: arpSettings,
          octave: octave
      };
      
      setUserPatches(prev => {
          const next = [...prev];
          next[saveSlotIndex] = patch;
          return next;
      });
      
      setPreset(prev => ({ ...prev, description: label }));
      
      setCurrentSlangIndex(prev => (prev + 1) % SLANG_TERMS.length);
      setSaveSlotIndex(prev => (prev + 1) % 10);
      
  }, [preset, fxState, drumSettings, arpSettings, octave, saveSlotIndex, currentSlangIndex]);

  const handleLoadPatch = useCallback((patch: UserPatch) => {
      const wasDrumming = drumSettings.enabled;
      const wasGateEnabled = gateSettings.enabled;

      setPreviousPreset(preset);
      setPreviousFxState(fxState);
      setPreviousDrumSettings(drumSettings);
      setPreviousGateSettings(gateSettings);

      setPreset(patch.preset);
      setFxState(patch.fxState);
      
      const newDrums = { ...patch.drumSettings, enabled: wasDrumming || patch.drumSettings.enabled };
      setDrumSettings(newDrums);
      
      // Keep gate independent
      // setGateSettings(patch.gateSettings); 
      
      setArpSettings(patch.arpSettings);
      setOctave(patch.octave);
      
      if (audioEngineRef.current) {
          audioEngineRef.current.setParams(patch.preset.audio);
          audioEngineRef.current.setFx(patch.fxState);
          audioEngineRef.current.setDrumSettings(newDrums);
          // audioEngineRef.current.setGateSettings(patch.gateSettings);
          audioEngineRef.current.setArpSettings(patch.arpSettings);
          audioEngineRef.current.setOctave(patch.octave);
      }
  }, [preset, fxState, drumSettings, gateSettings, octave]);


  const handleZoneTrigger = useCallback((zoneIdx: number, visualEffectIdx?: number) => {
      if (typeof visualEffectIdx === 'number') {
          pendingVisualEffectRef.current = visualEffectIdx;
      }
      
      if (zoneIdx === 0) { 
          handleChop();
      } else if (zoneIdx === 1) { 
          handleGrowl();
      } else if (zoneIdx === 2) { 
          const wasDrumming = drumSettings.enabled;
          handleRevertPreset();
          if (wasDrumming) {
              setDrumSettings(prev => ({...prev, enabled: true}));
              if(audioEngineRef.current) audioEngineRef.current.setDrumSettings({...drumSettings, enabled: true});
          }
      } else if (zoneIdx === 3) { 
          // STRICT CHAOS LOCK GUARD
          if (!isChaosLocked) {
              handleRandomize();
          }
      }
  }, [handleChop, handleGrowl, handleRevertPreset, handleRandomize, drumSettings, isChaosLocked]);

  const handleManualGateChange = (s: GateSettings) => {
      setGateSettings(s);
      baselineGateDivision.current = s.division;
  };


  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white selection:bg-teal-500/30">
      <FluidCanvas 
        key={1} 
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
            if(audioEngineRef.current) {
                audioEngineRef.current.setDrumSettings({...drumSettings, volume: 1.0 - v}); 
                audioEngineRef.current.setSynthVolume(v * 0.3); 
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
        isChaosLocked={isChaosLocked}
        onToggleChaosLock={() => setIsChaosLocked(!isChaosLocked)}
      />
    </div>
  );
};

export default App;
