import React, { useState, useEffect, useRef, useCallback } from 'react';
import FluidCanvas from './components/FluidCanvas';
import UIOverlay from './components/UIOverlay';
import WebcamMotion from './components/WebcamMotion';
import { AudioEngine } from './services/audioEngine';
import { DEFAULT_PRESET, GENRE_PRESETS, ALL_PRESETS, GATE_DIVISIONS } from './constants';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, VisualShape, CameraMode, RenderStyle, GateDivision } from './types';

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
  const [crossFader, setCrossFader] = useState(0.5); // 0 = Drums, 1 = Synth, 0.5 = Mix
  
  // Visual Effect Sync
  const [activeVisualEffect, setActiveVisualEffect] = useState<number | null>(null);
  
  // Quantization Ref
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

  const [fxState, setFxState] = useState<FxState>({
    delay: false,
    chorus: false,
    highpass: false,
    distortion: false,
    phaser: false,
    reverb: false,
    crunch: false
  });
  
  const [arpSettings, setArpSettings] = useState<ArpSettings>({
      enabled: false,
      bpm: 86,
      division: '1/8', 
      mode: 'UP',
      octaveRange: 1,
      gate: 0.5,
      steps: 1 // Default to single note
  });

  const [drumSettings, setDrumSettings] = useState<DrumSettings>({
      enabled: false,
      volume: 1.0,
      genre: 'BOOMBAP',
      kit: 'ACOUSTIC',
      pattern: GENRE_PRESETS['BOOMBAP'].pattern
  });

  const [gateSettings, setGateSettings] = useState<GateSettings>({
      enabled: false,
      pattern: 'TRANCE',
      division: '1/32', // Default to 1/32 as "middle" speed
      mix: 1.0
  });

  // Track the user-selected baseline division to return to after modulation
  const baselineGateDivision = useRef<GateDivision>('1/32');
  
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

  // Handle Preset Changes
  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setParams(preset.audio);
    }
  }, [preset]);

  // Handle FX Changes
  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setFx(fxState);
    }
  }, [fxState]);

  // Handle Arp Changes
  useEffect(() => {
    if (audioEngineRef.current) {
        audioEngineRef.current.setArpSettings(arpSettings);
    }
  }, [arpSettings]);

  // Handle Volume Changes (Synth + Crossfader)
  useEffect(() => {
    if (audioEngineRef.current) {
        // Apply Crossfader attenuation: Left (0) = Synth 0%, Right (1) = Synth 100%
        const mix = crossFader;
        const effectiveVol = synthVolume * mix;
        audioEngineRef.current.setSynthVolume(effectiveVol);
    }
  }, [synthVolume, crossFader]);

  // Handle Gate Changes
  useEffect(() => {
      if (audioEngineRef.current) {
          audioEngineRef.current.setGateSettings(gateSettings);
      }
  }, [gateSettings]);

  // Custom handler for Gate settings changes from UI to update baseline
  const handleManualGateChange = (newSettings: GateSettings) => {
      setGateSettings(newSettings);
      if (newSettings.division !== baselineGateDivision.current) {
          baselineGateDivision.current = newSettings.division;
      }
  };

  // Handle Drum Changes & Genre Switching Logic
  const handleDrumChange = (newSettings: DrumSettings) => {
      // Check if genre changed
      if (newSettings.genre !== drumSettings.genre) {
          const preset = GENRE_PRESETS[newSettings.genre];
          if (preset) {
              // Update pattern and BPM based on genre
              const updatedSettings = {
                  ...newSettings,
                  pattern: preset.pattern
              };
              setDrumSettings(updatedSettings);
              setArpSettings(prev => ({ ...prev, bpm: preset.bpm }));
              return;
          }
      }
      setDrumSettings(newSettings);
  };

  // Push changes to engine (Drum + Crossfader)
  useEffect(() => {
    if (audioEngineRef.current) {
        // Apply Crossfader attenuation: Left (0) = Drums 100%, Right (1) = Drums 0%
        const mix = 1 - crossFader;
        const effectiveVol = drumSettings.volume * mix;
        audioEngineRef.current.setDrumSettings({
            ...drumSettings,
            volume: effectiveVol
        });
    }
  }, [drumSettings, crossFader]);

  // --- QUANTIZED VISUAL EFFECTS ---
  // Runs on a 32nd note interval based on BPM to rate-limit triggers rhythmically
  useEffect(() => {
      if (playState !== PlayState.PLAYING) return;

      const bpm = arpSettings.bpm;
      const msPerBeat = 60000 / bpm;
      const msPer32nd = msPerBeat / 8; // 32nd note quantization

      const timer = setInterval(() => {
          if (pendingVisualEffectRef.current !== null) {
              // Consume the pending trigger
              setActiveVisualEffect(pendingVisualEffectRef.current);
              pendingVisualEffectRef.current = null;
              
              // Clear the effect after a 16th note duration (2 * 32nd)
              setTimeout(() => {
                  setActiveVisualEffect(null);
              }, msPer32nd * 2);
          }
      }, msPer32nd);

      return () => clearInterval(timer);
  }, [playState, arpSettings.bpm]);

  const triggerVisualEffect = (effectIdx: number) => {
      // Queue the effect to be picked up by the quantization loop
      pendingVisualEffectRef.current = effectIdx;
  };

  const handlePhysicsUpdate = useCallback((x: number, y: number, speed: number, hardness: number, isClicked: boolean) => {
    if (audioEngineRef.current && playState === PlayState.PLAYING) {
      audioEngineRef.current.modulate(x, y, speed, hardness, isClicked);
    }
    
    // Track if sound is effectively being produced (for visual feedback)
    const isActive = (speed > 0.05 || isClicked) && playState === PlayState.PLAYING;
    
    if (isActive !== wasSoundingRef.current) {
        wasSoundingRef.current = isActive;
        setIsSounding(isActive);
    }

    // Trigger visual effects on high intensity mouse interaction
    if (playState === PlayState.PLAYING) {
        // Trigger threshold: Fast movement (speed > 50) OR Click with movement (speed > 20)
        // 5 Visual Effects: 0=Invert, 1=Glitch, 2=Mosaic, 3=Scanlines, 4=Posterize
        if (speed > 50 || (isClicked && speed > 20)) {
             const effectIdx = Math.floor(Math.random() * 5);
             triggerVisualEffect(effectIdx);
        }
    }

    // Dynamic Gate Speed based on Screen Y Position
    if (gateSettings.enabled && (isClicked || speed > 0.05)) {
        const divisions = GATE_DIVISIONS;
        const baselineIdx = divisions.indexOf(baselineGateDivision.current);
        let targetIdx = baselineIdx;

        // Y: 0 is Top, 1 is Bottom
        if (y < 0) {
             targetIdx = baselineIdx;
        } else if (y < 0.33) {
            // Top Section: Double Speed (Faster = Lower Index)
            targetIdx = Math.max(0, baselineIdx - 1);
        } else {
            // Middle & Bottom Section: Baseline
            targetIdx = baselineIdx;
        }

        const targetDiv = divisions[targetIdx];
        if (targetDiv !== gateSettings.division) {
             setGateSettings(prev => ({ ...prev, division: targetDiv }));
        }
    } else if (gateSettings.enabled && gateSettings.division !== baselineGateDivision.current && !isClicked && speed < 0.05) {
        // Return to baseline when interaction stops
        setGateSettings(prev => ({ ...prev, division: baselineGateDivision.current }));
    }

  }, [playState, gateSettings.enabled, gateSettings.division, activeVisualEffect]);

  const handleToggleRecord = async () => {
    if (!audioEngineRef.current) return;

    if (isRecording) {
        const url = await audioEngineRef.current.stopRecording();
        setIsRecording(false);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `oobleck-synth-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    } else {
        audioEngineRef.current.startRecording();
        setIsRecording(true);
    }
  };

  const handleOctaveChange = (newOctave: number) => {
      if (newOctave > 2 || newOctave < -2) return;
      setOctave(newOctave);
      if (audioEngineRef.current) {
          audioEngineRef.current.setOctave(newOctave);
      }
  };

  const handleToggleFx = (key: keyof FxState) => {
    const newState = { ...fxState, [key]: !fxState[key] };
    setFxState(newState);
    if (audioEngineRef.current) {
      audioEngineRef.current.setFx(newState);
    }
  };
  
  const handleNotePlay = (freq: number) => {
      setPreset(prev => ({
          ...prev,
          audio: {
              ...prev.audio,
              baseFreq: freq
          }
      }));
      
      if (audioEngineRef.current) {
          audioEngineRef.current.trigger();
      }
  };

  const handlePresetChange = (newPreset: SynthPreset) => {
    setPreviousPreset(preset);
    setPreviousFxState(fxState);
    setPreviousDrumSettings(drumSettings);
    setPreviousGateSettings(gateSettings);
    
    setPreset(prev => ({
        ...newPreset,
        audio: {
            ...newPreset.audio,
            baseFreq: prev.audio.baseFreq // Keep the pitch the user is currently using
        }
    }));
  };

  const handleRevertPreset = () => {
      if (previousPreset) {
          const tempPreset = preset;
          setPreset(previousPreset);
          setPreviousPreset(tempPreset);

          if (previousFxState) {
              const tempFx = fxState;
              setFxState(previousFxState);
              setPreviousFxState(tempFx);
          }
          
          if (previousDrumSettings) {
             const tempDrums = drumSettings;
             setDrumSettings(previousDrumSettings);
             setPreviousDrumSettings(tempDrums);
          }
          
          if (previousGateSettings) {
             const tempGate = gateSettings;
             setGateSettings(previousGateSettings);
             setPreviousGateSettings(tempGate);
          }
      }
  };

  const handleScaleFrequenciesChange = (freqs: number[]) => {
      if (audioEngineRef.current) {
          audioEngineRef.current.setScaleFrequencies(freqs);
      }
  };

  const handleSaveFavorite = () => {
      // Check duplicates
      const exists = favorites.some(f => 
          f.physics.name === preset.physics.name && 
          f.description === preset.description
      );
      
      let newFavs;
      if (exists) {
          newFavs = favorites.filter(f => 
             !(f.physics.name === preset.physics.name && f.description === preset.description)
          );
      } else {
          newFavs = [...favorites, preset];
      }
      
      setFavorites(newFavs);
      localStorage.setItem('oobleck_favorites', JSON.stringify(newFavs));
  };

  const handleDeleteFavorite = (index: number) => {
      const newFavs = favorites.filter((_, i) => i !== index);
      setFavorites(newFavs);
      localStorage.setItem('oobleck_favorites', JSON.stringify(newFavs));
  };

  const getAudioData = useCallback(() => {
      return audioEngineRef.current?.getAudioData() ?? null;
  }, []);

  const handleRandomize = () => {
    // 1. Random Preset
    const randomPreset = ALL_PRESETS[Math.floor(Math.random() * ALL_PRESETS.length)];
    
    // Randomize Visuals on top of the preset for extra chaos
    const shapes: VisualShape[] = ['circle', 'square', 'triangle', 'hexagon', 'cross', 'star'];
    const cams: CameraMode[] = ['static', 'sway', 'drift', 'pulse', 'shake', 'spin', 'zoom'];
    const styles: RenderStyle[] = ['particles', 'wireframe', 'mosaic', 'scanner'];
    
    const chaosPreset: SynthPreset = {
        ...randomPreset,
        visual: {
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            cameraMode: cams[Math.floor(Math.random() * cams.length)],
            renderStyle: styles[Math.floor(Math.random() * styles.length)],
            connectPoints: Math.random() > 0.5,
            strokeWidth: Math.random() * 4,
            trailLength: 0.1 + Math.random() * 0.4,
            glowIntensity: Math.random()
        }
    };
    
    handlePresetChange(chaosPreset);

    // 2. Gate: 1/32 TRANCE (Default Random, will be overridden by zone logic if called from there)
    baselineGateDivision.current = '1/32'; // Update baseline
    setGateSettings({
        enabled: true,
        pattern: 'TRANCE',
        division: '1/32',
        mix: 1.0
    });

    // 3. Random FX On/Off
    setFxState({
        delay: Math.random() > 0.5,
        chorus: Math.random() > 0.5,
        highpass: Math.random() > 0.5,
        distortion: Math.random() > 0.5,
        phaser: Math.random() > 0.5,
        reverb: Math.random() > 0.5,
        crunch: Math.random() > 0.5
    });

    // 4. Start Sampler
    setDrumSettings(prev => ({
        ...prev,
        enabled: true
    }));

    // Ensure engine is playing
    if (playState === PlayState.IDLE) {
        setPlayState(PlayState.PLAYING);
    }
  };

  // Zone 0: TopLeft, Zone 1: TopRight, Zone 2: BotLeft, Zone 3: BotRight
  const handleZoneTrigger = (zoneIndex: number, visualEffectIndex?: number) => {
      // Sync visual effect to main canvas using centralized trigger (Queued)
      if (typeof visualEffectIndex === 'number') {
          triggerVisualEffect(visualEffectIndex);
      }

      switch (zoneIndex) {
          case 0: // Top Left: Gate 1/64 ON (Doubled from 1/32)
              baselineGateDivision.current = '1/64';
              setGateSettings(prev => ({
                  ...prev,
                  enabled: true,
                  division: '1/64'
              }));
              break;
          case 1: // Top Right: Gate OFF + FX STACK (Trigger 1-3 random FX macros)
              setGateSettings(prev => ({
                  ...prev,
                  enabled: false,
              }));
              if (audioEngineRef.current) {
                  // Randomly pick 1 to 3 effect IDs from 1-9
                  const count = Math.floor(Math.random() * 3) + 1;
                  const available = [1,2,3,4,5,6,7,8,9];
                  const selectedIds = [];
                  for(let i=0; i<count; i++) {
                      if (available.length === 0) break;
                      const idx = Math.floor(Math.random() * available.length);
                      selectedIds.push(available[idx]);
                      available.splice(idx, 1);
                  }
                  audioEngineRef.current.triggerEffectStacks(selectedIds);
              }
              break;
          case 2: // Bottom Left: Gate 1/32 ON (Match Bottom Right speed)
              baselineGateDivision.current = '1/32';
              setGateSettings(prev => ({
                  ...prev,
                  enabled: true,
                  division: '1/32'
              }));
              break;
          case 3: // Bottom Right: Chaos Mode + Gate 1/32 ON (Doubled from 1/16)
              handleRandomize();
              setTimeout(() => {
                  baselineGateDivision.current = '1/32';
                  setGateSettings(prev => ({
                      ...prev,
                      enabled: true,
                      division: '1/32'
                  }));
              }, 0);
              break;
      }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black selection:bg-teal-500/30">
      
      <FluidCanvas 
        key={1} // Force remount if needed
        physics={preset.physics} 
        visual={preset.visual}
        onUpdate={handlePhysicsUpdate}
        isPlaying={playState === PlayState.PLAYING}
        getAudioData={getAudioData}
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
        onPresetChange={handlePresetChange}
        onRevertPreset={handleRevertPreset}
        playState={playState}
        setPlayState={setPlayState}
        onGenerateStart={() => {}}
        isRecording={isRecording}
        onToggleRecord={handleToggleRecord}
        octave={octave}
        onOctaveChange={handleOctaveChange}
        fxState={fxState}
        onToggleFx={handleToggleFx}
        onNotePlay={handleNotePlay}
        
        arpSettings={arpSettings}
        onArpChange={setArpSettings}
        onScaleFrequenciesChange={handleScaleFrequenciesChange}
        
        drumSettings={drumSettings}
        onDrumChange={handleDrumChange}
        currentStep={currentStep}

        gateSettings={gateSettings}
        onGateChange={handleManualGateChange}
        
        synthVolume={synthVolume}
        onSynthVolumeChange={setSynthVolume}

        favorites={favorites}
        onSaveFavorite={handleSaveFavorite}
        onDeleteFavorite={handleDeleteFavorite}

        isCameraActive={isCameraActive}
        onToggleCamera={() => setIsCameraActive(!isCameraActive)}
        
        isSounding={isSounding}
        
        onRandomize={handleRandomize}
        crossFader={crossFader}
        onCrossFaderChange={setCrossFader}
      />
      
      <div className="md:hidden fixed bottom-0 w-full bg-yellow-500/10 text-yellow-200 text-[10px] p-1 text-center backdrop-blur-sm z-50 pointer-events-none">
        Best experienced on desktop.
      </div>
    </div>
  );
};

export default App;