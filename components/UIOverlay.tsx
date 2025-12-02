
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GatePatternName, GateDivision, DrumKit, UserPatch, DrumFX, LeaderboardEntry } from '../types';
import { ALL_PRESETS, GATE_PATTERNS, DRUM_KITS, DRUM_FX_OPTIONS, GENRE_PRESETS } from '../constants';
import { Loader2, Sparkles, Lock, Unlock, Trophy, Save, RotateCcw, Scissors, Skull, Wand2, Cpu, Drum, Activity, Waves, Power, Disc, Mic, Camera, Sliders, ThumbsUp, Play, Square, Circle } from 'lucide-react';
import { generatePreset } from '../services/geminiService';

interface Props {
  currentPreset: SynthPreset;
  onPresetChange: (p: SynthPreset) => void;
  onRevertPreset: () => void;
  playState: PlayState;
  setPlayState: (s: PlayState) => void;
  onGenerateStart: () => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  octave: number;
  onOctaveChange: (val: number) => void;
  fxState: FxState;
  onToggleFx: (key: keyof FxState) => void;
  onNotePlay: (freq: number) => void;
  
  arpSettings: ArpSettings;
  onArpChange: (s: ArpSettings) => void;
  onScaleFrequenciesChange: (freqs: number[]) => void;

  drumSettings: DrumSettings;
  onDrumChange: (s: DrumSettings) => void;
  onToggleDrums: () => void;
  currentStep: number;

  gateSettings: GateSettings;
  onGateChange: (s: GateSettings) => void;
  
  synthVolume: number;
  onSynthVolumeChange: (v: number) => void;

  favorites: SynthPreset[];
  onSaveFavorite: () => void;
  onDeleteFavorite: (index: number) => void;

  isCameraActive: boolean;
  onToggleCamera: () => void;
  
  isSounding: boolean;
  onRandomize: () => void;

  crossFader: number;
  onCrossFaderChange: (val: number) => void;

  onGrowl: () => void;
  currentGrowlName: string | null;

  onChop: () => void;

  // Dynamic Preset Props
  userPatches: (UserPatch | null)[];
  onLoadPatch: (p: UserPatch) => void;
  onBigSave: () => void;
  saveButtonText: string;
  nextSaveSlotIndex: number;

  // Chaos Lock
  isChaosLocked: boolean;
  onToggleChaosLock: () => void;
  
  // Score
  score: number;
  scorePopups: {id: number, val: number, label: string}[];
  activePoints: {id: number, x: number, y: number, val: number}[];
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  showHighScoreInput: boolean;
  onNameSubmit: (name: string) => void;

  // Trigger Signal for Pickup Feedback
  triggerSignal: { index: number, id: number } | null;
}

interface TriggerBurst {
    id: number;
    x: number;
    y: number;
    val: number;
    color: string;
}

// --- STYLED COMPONENTS ---

const Panel: React.FC<{ children: React.ReactNode, title?: React.ReactNode, className?: string, color?: string }> = ({ children, title, className = "", color = "cyan" }) => {
    const borderClass = {
        cyan: "border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
        pink: "border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.15)]",
        yellow: "border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.15)]",
        purple: "border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.15)]",
        red: "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)]"
    }[color] || "border-cyan-500";
    
    const bgTitle = {
        cyan: "bg-cyan-900 text-cyan-100",
        pink: "bg-pink-900 text-pink-100",
        yellow: "bg-yellow-900 text-yellow-100",
        purple: "bg-purple-900 text-purple-100",
        red: "bg-red-900 text-red-100"
    }[color] || "bg-cyan-900";

    return (
        <div className={`relative bg-black/90 backdrop-blur-sm border-2 rounded-lg p-2 flex flex-col ${borderClass} ${className}`}>
            {title && (
                <div className={`absolute -top-2.5 left-2 px-1.5 text-[9px] font-black tracking-widest uppercase border border-black/50 ${bgTitle} rounded-sm`}>
                    {title}
                </div>
            )}
            {children}
        </div>
    );
};

const VolumeSlider: React.FC<{ value: number, onChange: (v: number) => void, vertical?: boolean, color?: string }> = ({ value, onChange, vertical = false, color = 'cyan' }) => {
    const bgClass = {
        cyan: 'bg-cyan-500 shadow-[0_0_10px_cyan]', 
        pink: 'bg-pink-500 shadow-[0_0_10px_pink]', 
        yellow: 'bg-yellow-500 shadow-[0_0_10px_yellow]', 
        purple: 'bg-purple-500 shadow-[0_0_10px_purple]'
    }[color] || 'bg-cyan-500';

    return (
        <div className={`relative flex items-center group ${vertical ? 'h-full w-8 justify-center' : 'w-full h-4'}`}>
            {/* Track */}
            <div className={`absolute bg-[#111] border border-[#333] rounded-full ${vertical ? 'w-2 h-full' : 'w-full h-2'}`} />
            
            {/* Fill */}
            <div 
                className={`absolute rounded-full ${bgClass} opacity-80 ${vertical ? 'w-2 bottom-0' : 'h-2 left-0'}`}
                style={vertical ? { height: `${value * 100}%` } : { width: `${value * 100}%` }}
            />
            
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={value} 
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`absolute w-full h-full opacity-0 cursor-pointer z-20 ${vertical ? 'appearance-slider-vertical' : ''}`}
            />
            
            {/* Thumb */}
            <div 
                className={`absolute w-3 h-3 bg-white border border-black shadow pointer-events-none transition-all duration-75 z-10 ${vertical ? 'left-1/2 -translate-x-1/2 mb-[-6px]' : 'top-1/2 -translate-y-1/2 ml-[-6px]'}`}
                style={vertical ? { bottom: `${value * 100}%` } : { left: `${value * 100}%` }}
            />
        </div>
    );
};

const BurstDisplay: React.FC<{ burst: TriggerBurst }> = ({ burst }) => {
    const particles = useMemo(() => Array.from({length: 8}).map((_, i) => {
        const angle = (i / 8) * 360 + Math.random() * 30;
        const dist = 40 + Math.random() * 30;
        const tx = Math.cos(angle * Math.PI / 180) * dist;
        const ty = Math.sin(angle * Math.PI / 180) * dist;
        return { tx, ty, id: i, size: 2 + Math.random() * 3 };
    }), []);

    return (
        <div className="absolute pointer-events-none z-[100]" style={{ left: burst.x, top: burst.y }}>
             {/* Popup Score */}
             <div className="absolute -translate-x-1/2 -translate-y-full font-black text-2xl font-arcade animate-[float-up_0.8s_ease-out_forwards] stroke-black"
                  style={{ color: burst.color, textShadow: `2px 2px 0px black, 0 0 10px ${burst.color}` }}>
                  +{burst.val}
             </div>
             
             {/* Particles */}
             {particles.map(p => (
                 <div key={p.id} 
                      className="absolute rounded-full"
                      style={{
                          width: p.size,
                          height: p.size,
                          backgroundColor: burst.color,
                          boxShadow: `0 0 5px ${burst.color}`,
                          '--tx': `${p.tx}px`,
                          '--ty': `${p.ty}px`,
                          animation: 'burst-particle 0.6s ease-out forwards'
                      } as React.CSSProperties} 
                 />
             ))}
        </div>
    );
};

// --- MAIN COMPONENT ---

const UIOverlay: React.FC<Props> = ({ 
  currentPreset, onPresetChange, playState, setPlayState, 
  isRecording, onToggleRecord, octave, onOctaveChange,
  fxState, onToggleFx, onNotePlay, arpSettings, onArpChange, onScaleFrequenciesChange,
  drumSettings, onDrumChange, onToggleDrums, currentStep, gateSettings, onGateChange,
  synthVolume, onSynthVolumeChange,
  favorites, onSaveFavorite, onDeleteFavorite,
  isCameraActive, onToggleCamera, isSounding, onRandomize,
  crossFader, onCrossFaderChange, onRevertPreset,
  onGrowl, currentGrowlName, onChop,
  userPatches, onLoadPatch, onBigSave, saveButtonText,
  nextSaveSlotIndex, isChaosLocked, onToggleChaosLock,
  score, scorePopups, activePoints,
  leaderboard, showHighScoreInput, onNameSubmit,
  triggerSignal
}) => {
  const [activeMouseNote, setActiveMouseNote] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [highScoreName, setHighScoreName] = useState('');
  const [bursts, setBursts] = useState<TriggerBurst[]>([]);

  // Refs for Trigger Buttons to calculate position for feedback
  const chopRef = useRef<HTMLButtonElement>(null);
  const growlRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const chaosRef = useRef<HTMLButtonElement>(null);

  // Keyboard Logic kept from original
  const NOTE_MAP: Record<string, number> = {
    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
    ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16
  };
  const SCALES = { 'Chromatic': [0,1,2,3,4,5,6,7,8,9,10,11], 'Major': [0,2,4,5,7,9,11], 'Minor': [0,2,3,5,7,8,10], 'Pentatonic': [0,3,5,7,10] };
  const [selectedScale, setSelectedScale] = useState<keyof typeof SCALES>('Chromatic');
  const [rootNote, setRootNote] = useState(0); 
  
  const triggerFeedback = useCallback((e: React.MouseEvent | React.TouchEvent, val: number, color: string) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      } else {
          // Fallback if no coordinates (e.g. keypress simulated)
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          clientX = rect.left + rect.width / 2;
          clientY = rect.top + rect.height / 2;
      }

      const id = Date.now() + Math.random();
      setBursts(prev => [...prev, { id, x: clientX, y: clientY, val, color }]);
      setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 800);
  }, []);

  // Effect to handle external triggers from webcam motion
  useEffect(() => {
      if (triggerSignal) {
          const { index } = triggerSignal;
          let target: { ref: React.RefObject<HTMLButtonElement | null>, val: number, color: string } | null = null;
          
          if (index === 0) target = { ref: chopRef, val: 500, color: '#ef4444' };
          if (index === 1) target = { ref: growlRef, val: 1000, color: '#eab308' };
          if (index === 2) target = { ref: backRef, val: 250, color: '#22d3ee' };
          if (index === 3) target = { ref: chaosRef, val: 250, color: '#d946ef' };
          
          if (target && target.ref.current) {
               const rect = target.ref.current.getBoundingClientRect();
               const x = rect.left + rect.width / 2;
               const y = rect.top + rect.height / 2;
               const id = Date.now() + Math.random();
               
               setBursts(prev => [...prev, { id, x, y, val: target.val, color: target.color }]);
               setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 800);
          }
      }
  }, [triggerSignal]);

  useEffect(() => {
      const baseFreq = 65.41; 
      const freqs = [];
      for(let i=0; i<48; i++) { 
          const octave = Math.floor(i / 12);
          const noteIndex = i % 12;
          const interval = (noteIndex - rootNote + 12) % 12;
          if (SCALES[selectedScale].includes(interval)) {
               freqs.push(baseFreq * Math.pow(2, (i - 9)/12)); 
          }
      }
      onScaleFrequenciesChange(freqs);
  }, [selectedScale, rootNote]);

  const quantizeNote = (rawIndex: number) => {
      const scaleIntervals = SCALES[selectedScale];
      const rawNoteClass = (rawIndex - rootNote + 12) % 12;
      if (scaleIntervals.includes(rawNoteClass)) return rawIndex;
      for(let d=1; d<6; d++) {
          if (scaleIntervals.includes((rawNoteClass + d)%12)) return rawIndex + d;
          if (scaleIntervals.includes((rawNoteClass - d + 12)%12)) return rawIndex - d;
      }
      return rawIndex;
  };

  const handleKeyDown = useCallback((e: any) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.repeat) return;
    
    if (e.code === 'Space') { e.preventDefault(); if (isChaosLocked) onToggleChaosLock(); else onRandomize(); return; }
    if (e.key === 'Escape') { e.preventDefault(); onRevertPreset(); return; }
    if (e.key === 'Alt') { e.preventDefault(); onGrowl(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (playState === PlayState.IDLE) setPlayState(PlayState.PLAYING); else onToggleDrums(); return; }
    if (e.key === '\\') { onToggleCamera(); return; }
    
    if (e.key === 'ArrowUp') { e.preventDefault(); onOctaveChange(Math.min(octave + 1, 2)); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); onOctaveChange(Math.max(octave - 1, -2)); return; }

    const key = e.key;
    if (NOTE_MAP.hasOwnProperty(key)) {
      const semitone = NOTE_MAP[key];
      const quantized = quantizeNote(semitone);
      const freq = 65.41 * Math.pow(2, quantized / 12);
      onNotePlay(freq);
      setActiveMouseNote(semitone);
    }
  }, [octave, onNotePlay, onToggleCamera, selectedScale, rootNote, onRandomize, onRevertPreset, onGrowl, isChaosLocked, onToggleChaosLock, onToggleDrums, playState]);

  const handleKeyUp = useCallback((e: any) => { setActiveMouseNote(null); }, []);
  useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);

  const handleGenerate = async () => {
      if (!prompt.trim()) return;
      setIsGenerating(true);
      try { const newPreset = await generatePreset(prompt); onPresetChange(newPreset); } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handlePlayStop = () => {
      if (drumSettings.enabled) {
          onDrumChange({ ...drumSettings, enabled: false });
          if (isCameraActive) onToggleCamera();
      } else {
          onDrumChange({ ...drumSettings, enabled: true });
          if (!gateSettings.enabled) {
              onGateChange({ ...gateSettings, enabled: true });
          }
      }
  };

  const totalKeys = 36;
  const allKeys = Array.from({ length: totalKeys }, (_, i) => i);
  const whiteKeys = allKeys.filter(i => [0, 2, 4, 5, 7, 9, 11].includes(i % 12));
  const blackKeys = allKeys.filter(i => [1, 3, 6, 8, 10].includes(i % 12));
  const numWhiteKeys = whiteKeys.length;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden font-sans select-none text-gray-200">
      
      {/* Scanline Overlay */}
      <style>{`
        .arcade-scanlines {
            background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
            background-size: 100% 4px;
            pointer-events: none;
            position: absolute; inset: 0; z-index: 50; opacity: 0.5;
        }
        .animate-rough-shake {
            animation: rough-shake 0.05s infinite;
        }
        @keyframes rough-shake {
            0% { transform: translate(2px, 2px) rotate(0deg); }
            20% { transform: translate(-4px, -4px) rotate(-2deg); }
            40% { transform: translate(-2px, 2px) rotate(2deg); }
            60% { transform: translate(4px, 4px) rotate(0deg); }
            80% { transform: translate(2px, -2px) rotate(-2deg); }
            100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes burst-particle {
            0% { transform: translate(0, 0) scale(1); opacity: 1; }
            100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes float-up {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            50% { transform: translateY(-40px) scale(1.2); opacity: 1; }
            100% { transform: translateY(-80px) scale(1); opacity: 0; }
        }
      `}</style>
      <div className="arcade-scanlines"></div>

      {/* --- BURST OVERLAY --- */}
      {bursts.map(b => <BurstDisplay key={b.id} burst={b} />)}

      {/* --- RIGHT SIDEBAR (SCORE, FX, PRESETS) --- */}
      <div className="absolute top-24 right-4 flex flex-col gap-4 items-end w-44 pointer-events-auto z-50">
           {/* Score Module */}
           <div className="relative bg-black/90 border border-yellow-500/50 rounded p-2 px-3 shadow-[0_0_15px_rgba(234,179,8,0.2)] w-full">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] text-yellow-600 font-bold uppercase tracking-widest mb-1">CREDITS</span>
                    <span className="font-arcade text-yellow-400 text-xl drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]">{score.toLocaleString().padStart(6, '0')}</span>
                </div>
                {/* Score Popups */}
                <div className="absolute top-full right-0 w-32 pointer-events-none h-32 overflow-visible">
                    {scorePopups.map(p => (
                        <div key={p.id} className="absolute right-0 flex flex-col items-end animate-[float-score_1s_ease-out_forwards] whitespace-nowrap">
                            <span className="text-white font-black text-sm drop-shadow-md">+{p.val}</span>
                            <span className="text-[8px] font-bold text-yellow-400 tracking-wider">{p.label}</span>
                        </div>
                    ))}
                </div>
           </div>

           {/* Leaderboard */}
           {leaderboard.length > 0 && (
               <div className="w-full bg-black/80 border border-yellow-500/30 rounded p-2">
                   <div className="text-[8px] text-yellow-600 font-bold uppercase tracking-widest mb-1 border-b border-yellow-500/20 pb-1">TOP PLAYERS</div>
                   <div className="flex flex-col gap-0.5">
                       {leaderboard.map((entry, i) => (
                           <div key={i} className="flex justify-between items-center text-[9px] font-mono">
                               <span className="text-yellow-500/80">{i+1}. {entry.name}</span>
                               <span className="text-yellow-100">{entry.score.toLocaleString()}</span>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {/* Spacer */}
           <div className="h-8"></div>

           {/* FX Rack */}
           <Panel className="w-full" title="FX UNIT" color="pink">
                <div className="grid grid-cols-2 gap-1">
                   {['delay','reverb','chorus','distortion','phaser','crunch'].map(fx => (
                       <button 
                          key={fx} 
                          onClick={(e) => { 
                              onToggleFx(fx as keyof FxState);
                              if (!fxState[fx as keyof FxState]) triggerFeedback(e, 50, '#ec4899'); 
                          }}
                          className={`text-[8px] font-bold uppercase border rounded-[2px] px-1 py-0.5 transition-all ${fxState[fx as keyof FxState] ? 'bg-pink-500 border-pink-400 text-black shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'bg-black border-gray-800 text-gray-600 hover:border-gray-600'}`}
                       >
                           {fx.substring(0,4)}
                       </button>
                   ))}
                </div>
           </Panel>

           {/* Presets Grid */}
           <Panel className="w-full" title="PATCHES" color="cyan">
               <div className="grid grid-cols-5 gap-1">
                    {userPatches.map((p, i) => (
                        <button 
                            key={i}
                            onClick={() => onLoadPatch(p!)}
                            disabled={!p}
                            className={`w-6 h-6 rounded-[2px] flex items-center justify-center text-[9px] font-bold transition-all ${p ? 'bg-cyan-900 border border-cyan-500 text-cyan-200 hover:bg-cyan-700 shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'bg-black border border-gray-800 text-gray-800'}`}
                        >
                            {i === 9 ? 0 : i + 1}
                        </button>
                    ))}
               </div>
           </Panel>
      </div>

      {/* --- HUD HEADER --- */}
      <div className="relative flex justify-between items-start pointer-events-auto z-40 p-4 bg-gradient-to-b from-black/80 to-transparent min-h-[140px]">
          <div className="flex gap-4 items-start w-1/4">
             {/* Logo */}
             <div className="relative group cursor-pointer" onClick={(e) => { if(!isChaosLocked) { triggerFeedback(e, 250, '#d946ef'); onRandomize(); }}}>
                 <div className="font-arcade text-3xl italic font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 tracking-tighter filter drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">OOBLECK</div>
                 <div className="text-[9px] font-bold text-gray-500 tracking-[0.5em] mt-1 ml-1">FLUID SYNTH</div>
             </div>
          </div>

          {/* --- TOP CENTER ACTIONS (BIG NEON) --- */}
          <div className="absolute left-1/2 -translate-x-1/2 top-6 w-full max-w-[486px] h-20 pointer-events-auto">
              {/* LOCK */}
              <button 
                onClick={onToggleChaosLock} 
                className="group flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform absolute right-1/2 mr-4"
              >
                   <div className={`
                       relative p-4 rounded-full border-4 transition-all duration-300 backdrop-blur-sm
                       ${isChaosLocked 
                           ? 'border-red-500 bg-red-900/20 shadow-[0_0_40px_rgba(239,68,68,0.6)]' 
                           : 'border-green-400 bg-green-900/20 shadow-[0_0_20px_rgba(74,222,128,0.3)] group-hover:shadow-[0_0_40px_rgba(74,222,128,0.6)]'}
                   `}>
                       {isChaosLocked ? 
                           <Lock size={40} className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,1)]" /> : 
                           <Unlock size={40} className="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,1)]" />
                       }
                   </div>
                   <span className={`font-arcade text-[12px] font-bold tracking-[0.2em] px-3 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 ${isChaosLocked ? 'text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-green-400'}`}>
                       {isChaosLocked ? 'LOCKED' : 'UNLOCK'}
                   </span>
              </button>

              {/* SAVE */}
              <button 
                  onClick={(e) => { triggerFeedback(e, 2000, '#22d3ee'); onBigSave(); }}
                  className="group flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform absolute left-1/2 ml-4"
              >
                   <div className="relative p-4 rounded-full border-4 border-cyan-400 bg-cyan-900/20 shadow-[0_0_30px_rgba(34,211,238,0.4)] group-hover:shadow-[0_0_50px_rgba(34,211,238,0.7)] transition-all backdrop-blur-sm">
                       <ThumbsUp size={40} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,1)]" />
                       {/* Slot indicator bubble */}
                       <div className="absolute -top-2 -right-2 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-black text-black font-black text-xs shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                          {nextSaveSlotIndex}
                       </div>
                   </div>
                   <span className="font-arcade text-[12px] font-bold tracking-[0.2em] text-cyan-400 bg-black/60 backdrop-blur-md px-3 py-1 rounded border border-white/10 group-hover:text-cyan-200">
                       SAVE
                   </span>
              </button>
          </div>

          <div className="flex gap-4 items-start w-1/4 justify-end">
             {/* Sys Panel Removed */}
          </div>
      </div>

      {/* --- CENTER ACTIONS (PLAYING) --- */}
      {playState === PlayState.PLAYING && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-12px] pointer-events-auto z-30">
           
           <div className="relative w-[486px] h-[365px]">
               {/* LEFT SIDE TOOLBAR (CAM, PLAY, REC) */}
               <div className="absolute right-[calc(100%+2rem)] top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center z-50">
                    
                    {/* CAM */}
                    <button 
                        onClick={onToggleCamera} 
                        className={`group flex flex-col items-center justify-center gap-1 transition-all ${isCameraActive ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}
                    >
                            <div className={`p-4 rounded-full border-4 backdrop-blur-md transition-all duration-300 ${isCameraActive ? 'border-green-400 bg-green-500/20 shadow-[0_0_30px_green]' : 'border-green-500/50 bg-black/40 hover:border-green-400 hover:shadow-[0_0_20px_green]'}`}>
                                <Camera size={32} className={isCameraActive ? "text-green-400 drop-shadow-[0_0_10px_white]" : "text-green-600 group-hover:text-green-400"} />
                            </div>
                            <span className={`font-arcade text-[10px] font-bold tracking-widest bg-black/60 px-2 py-0.5 rounded border border-green-500/30 ${isCameraActive ? 'text-green-400 shadow-[0_0_10px_green]' : 'text-green-700 group-hover:text-green-400'}`}>CAM</span>
                    </button>

                    {/* PLAY */}
                    <button 
                        onClick={handlePlayStop} 
                        className={`group flex flex-col items-center justify-center gap-1 transition-all ${drumSettings.enabled ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}
                    >
                            <div className={`p-4 rounded-full border-4 backdrop-blur-md transition-all duration-300 ${drumSettings.enabled ? 'border-pink-500 bg-pink-900/40 shadow-[0_0_30px_rgba(236,72,153,0.6)]' : 'border-pink-500/50 bg-black/40 hover:border-pink-400 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)]'}`}>
                                {drumSettings.enabled ? <Square size={32} className="text-pink-200 drop-shadow-[0_0_10px_white]" /> : <Play size={32} className="text-pink-600 group-hover:text-pink-400 ml-1" />}
                            </div>
                            <span className={`font-arcade text-[10px] font-bold tracking-widest bg-black/60 px-2 py-0.5 rounded border border-pink-500/30 ${drumSettings.enabled ? 'text-pink-200 shadow-[0_0_10px_pink]' : 'text-pink-700 group-hover:text-pink-400'}`}>
                                {drumSettings.enabled ? 'STOP' : 'PLAY'}
                            </span>
                    </button>

                    {/* REC */}
                    <button 
                        onClick={onToggleRecord} 
                        className={`group flex flex-col items-center justify-center gap-1 transition-all ${isRecording ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}
                    >
                            <div className={`p-4 rounded-full border-4 backdrop-blur-md transition-all duration-300 ${isRecording ? 'border-red-500 bg-red-600/20 shadow-[0_0_30px_red] animate-pulse' : 'border-red-500/50 bg-black/40 hover:border-red-400 hover:shadow-[0_0_20px_red]'}`}>
                                <div className={`w-8 h-8 rounded-full ${isRecording ? 'bg-red-500' : 'bg-red-900 group-hover:bg-red-500 transition-colors'}`} />
                            </div>
                            <span className={`font-arcade text-[10px] font-bold tracking-widest bg-black/60 px-2 py-0.5 rounded border border-red-500/30 ${isRecording ? 'text-red-400 shadow-[0_0_10px_red]' : 'text-red-700 group-hover:text-red-400'}`}>REC</span>
                    </button>

               </div>

               {/* MAIN CONTROL GRID (2x2) mapped to Webcam Zones */}
               {/* Superimposed over video: Maximize area, transparent backgrounds */}
               <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden">
                   
                   {/* TL: CHOP */}
                   <button 
                       ref={chopRef}
                       onClick={(e) => { triggerFeedback(e, 500, '#ef4444'); onChop(); }}
                       className="group relative w-full h-full border-4 border-white/10 hover:border-red-500/80 bg-black/10 hover:bg-red-500/5 transition-all flex flex-col items-center justify-center backdrop-blur-[0px]"
                   >
                        <div className="flex flex-col items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                           <Scissors size={48} className="text-red-500 mb-1 drop-shadow-[0_0_8px_red]" />
                           <span className="font-arcade text-2xl text-red-500 font-bold tracking-widest bg-black/40 px-2 rounded">CHOP</span>
                        </div>
                        {/* Corners */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500/30 group-hover:border-red-500 transition-colors" />
                   </button>

                   {/* TR: GROWL */}
                   <button 
                       ref={growlRef}
                       onClick={(e) => { triggerFeedback(e, 1000, '#eab308'); onGrowl(); }}
                       className="group relative w-full h-full border-4 border-white/10 hover:border-yellow-500/80 bg-black/10 hover:bg-yellow-500/5 transition-all flex flex-col items-center justify-center backdrop-blur-[0px]"
                   >
                        <div className="flex flex-col items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                           <Skull size={48} className="text-yellow-500 mb-1 drop-shadow-[0_0_8px_yellow]" />
                           <span className="font-arcade text-2xl text-yellow-500 font-bold tracking-widest bg-black/40 px-2 rounded">GROWL</span>
                        </div>
                        {/* Corners */}
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-500/30 group-hover:border-yellow-500 transition-colors" />
                   </button>

                   {/* BL: BACK */}
                   <button 
                       ref={backRef}
                       onClick={(e) => { triggerFeedback(e, 250, '#22d3ee'); onRevertPreset(); }}
                       className="group relative w-full h-full border-4 border-white/10 hover:border-cyan-500/80 bg-black/10 hover:bg-cyan-500/5 transition-all flex flex-col items-center justify-center backdrop-blur-[0px]"
                   >
                        <div className="flex flex-col items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                           <RotateCcw size={48} className="text-cyan-500 mt-1 drop-shadow-[0_0_8px_cyan]" />
                           <span className="font-arcade text-2xl text-cyan-500 font-bold tracking-widest bg-black/40 px-2 rounded">BACK</span>
                        </div>
                        {/* Corners */}
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/30 group-hover:border-cyan-500 transition-colors" />
                   </button>

                   {/* BR: CHAOS */}
                   <button 
                       ref={chaosRef}
                       onClick={(e) => { if(!isChaosLocked) { triggerFeedback(e, 250, '#d946ef'); onRandomize(); }}} 
                       disabled={isChaosLocked} 
                       className={`group relative w-full h-full border-4 border-white/10 hover:border-purple-500/80 bg-black/10 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center backdrop-blur-[0px] ${isChaosLocked ? 'cursor-not-allowed' : ''}`}
                   >
                        <div className="flex flex-col items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                           <Wand2 size={48} className={`${isChaosLocked ? 'text-gray-500' : 'text-purple-500'} mt-1 drop-shadow-[0_0_8px_purple]`} />
                           <span className={`font-arcade text-2xl font-bold tracking-widest bg-black/40 px-2 rounded ${isChaosLocked ? 'text-gray-500' : 'text-purple-500'}`}>CHAOS</span>
                        </div>
                        {/* Corners */}
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-purple-500/30 group-hover:border-purple-500 transition-colors" />
                   </button>
               </div>
               
           </div>
      </div>
      )}

      {/* --- START SCREEN --- */}
      {playState === PlayState.IDLE && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto z-50">
               <button 
                  onClick={() => setPlayState(PlayState.PLAYING)}
                  className="group relative"
               >
                   <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-50 group-hover:opacity-80 transition-opacity animate-pulse"></div>
                   <div className="relative bg-black border-4 border-cyan-500 text-cyan-400 hover:bg-cyan-900 hover:text-white px-12 py-6 rounded font-arcade text-2xl tracking-widest shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105">
                       INSERT COIN
                   </div>
               </button>
          </div>
      )}

      {/* --- GROWL POPUP --- */}
      {currentGrowlName && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
               <div className="animate-rough-shake bg-yellow-400 text-black font-black text-9xl px-12 py-6 border-[12px] border-black shadow-[20px_20px_0px_rgba(0,0,0,0.8)] uppercase -rotate-2 whitespace-nowrap font-arcade tracking-tighter mix-blend-hard-light">
                    {currentGrowlName}
               </div>
          </div>
      )}

      {/* --- HIGH SCORE INPUT --- */}
      {showHighScoreInput && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl pointer-events-auto">
              <div className="border-4 border-yellow-500 p-8 rounded-lg bg-black shadow-[0_0_50px_rgba(234,179,8,0.4)] text-center max-w-md w-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <div className="relative z-10">
                      <Trophy size={48} className="mx-auto text-yellow-500 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                      <h2 className="font-arcade text-2xl text-yellow-400 mb-2">NEW RECORD</h2>
                      <div className="text-5xl font-mono font-black text-white mb-8 tracking-tighter shadow-black drop-shadow-md">{score.toLocaleString()}</div>
                      <input 
                          autoFocus maxLength={8}
                          value={highScoreName}
                          onChange={(e) => setHighScoreName(e.target.value.toUpperCase())}
                          placeholder="INITIALS"
                          className="bg-zinc-900 border-2 border-zinc-700 text-white text-center text-3xl font-mono font-bold p-3 rounded w-full uppercase focus:outline-none focus:border-yellow-500 mb-4 tracking-widest placeholder:text-gray-700"
                      />
                      <button onClick={() => onNameSubmit(highScoreName || "ANON")} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black text-lg py-3 rounded uppercase font-arcade border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1">SUBMIT SCORE</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- BOTTOM CYBERDECK (DASHBOARD) --- */}
      <div className="pointer-events-auto z-40 w-full bg-zinc-950 border-t-4 border-cyan-600 shadow-[0_-10px_50px_rgba(0,0,0,0.9)] relative">
          
          {/* Deck Gradient Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10" />

          {/* Main Control Grid */}
          <div className="grid grid-cols-12 divide-x divide-white/5 h-44 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              
              {/* CORE / GENESIS (2 Cols) */}
              <div className="col-span-2 p-3 flex flex-col gap-2 relative overflow-hidden">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                      <Cpu size={14} className="animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest font-arcade">GENESIS</span>
                  </div>
                  
                  <div className="flex gap-1 mb-2">
                      <input 
                          className="w-full bg-black border border-purple-900/50 rounded-sm px-2 text-[9px] font-mono text-purple-100 h-7 focus:outline-none focus:border-purple-500 placeholder:text-purple-900"
                          placeholder="DESCRIBE SOUND..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                      />
                      <button onClick={handleGenerate} disabled={isGenerating} className="bg-purple-900 border border-purple-700 w-8 h-7 flex items-center justify-center text-purple-200 rounded-sm hover:bg-purple-600 transition-colors">
                          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      </button>
                  </div>

                  <div className="flex-1 bg-black/40 border border-white/5 rounded p-2 flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-2">
                          <span className="text-[8px] text-blue-400 font-bold w-8">VISC</span>
                          <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                              <div className="h-full bg-blue-500 shadow-[0_0_8px_blue]" style={{width: `${currentPreset.physics.viscosityBase * 100}%`}} />
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[8px] text-orange-400 font-bold w-8">THICK</span>
                          <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
                              <div className="h-full bg-orange-500 shadow-[0_0_8px_orange]" style={{width: `${currentPreset.physics.thickeningFactor * 100}%`}} />
                          </div>
                      </div>
                  </div>
              </div>

              {/* SEQUENCER (5 Cols) */}
              <div className="col-span-5 p-3 flex flex-col relative">
                   <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2 text-pink-500">
                           <Drum size={14} />
                           <span className="text-[10px] font-black uppercase tracking-widest font-arcade">RHYTHM CORE</span>
                       </div>
                       <div className="flex items-center gap-2">
                           <div className="bg-black border border-pink-900/50 px-1.5 py-0.5 rounded text-[8px] text-pink-400 font-mono">
                               BPM <span className="text-white font-bold">{arpSettings.bpm}</span>
                           </div>
                           <button onClick={onToggleDrums} className={`h-4 px-2 rounded-full border flex items-center gap-1 transition-all ${drumSettings.enabled ? 'bg-pink-600 border-pink-400 text-white' : 'bg-black border-gray-700 text-gray-600'}`}>
                               <Power size={8} />
                           </button>
                       </div>
                   </div>

                   {/* Genre Selectors */}
                   <div className="flex gap-1 mb-2 overflow-x-auto pb-1 no-scrollbar mask-image-linear-gradient">
                       {Object.keys(GENRE_PRESETS).map(g => (
                           <button 
                              key={g} 
                              onClick={() => {
                                  const genre = g as SamplerGenre;
                                  const p = GENRE_PRESETS[genre];
                                  onDrumChange({...drumSettings, genre, pattern: p.pattern.map(s=>({...s}))});
                                  onArpChange({...arpSettings, bpm: p.bpm});
                              }}
                              className={`px-2 py-0.5 rounded-[2px] text-[8px] font-bold border transition-all ${drumSettings.genre === g ? 'bg-pink-500 border-pink-300 text-black shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'bg-transparent border-gray-800 text-gray-500 hover:text-gray-300'}`}
                           >
                               {g}
                           </button>
                       ))}
                   </div>

                   {/* Step Grid */}
                   <div className="flex-1 flex flex-col gap-1 justify-center">
                       {(['kick', 'snare', 'hihat', 'clap'] as const).map(layer => (
                           <div key={layer} className="flex gap-0.5 h-full items-center">
                               <div className="w-8 text-[7px] font-bold text-gray-500 uppercase text-right pr-2 tracking-wider">{layer.substring(0,3)}</div>
                               <div className="flex-1 flex gap-px h-3">
                                   {drumSettings.pattern.map((step, i) => {
                                       const isOn = step[layer];
                                       const isCurrent = i === currentStep;
                                       const color = layer === 'kick' ? 'bg-pink-500' : layer === 'snare' ? 'bg-cyan-500' : layer === 'hihat' ? 'bg-yellow-500' : 'bg-purple-500';
                                       
                                       return (
                                           <button
                                              key={i}
                                              onClick={() => {
                                                  const np = [...drumSettings.pattern];
                                                  np[i] = {...np[i], [layer]: !np[i][layer]};
                                                  onDrumChange({...drumSettings, pattern: np});
                                              }}
                                              className={`flex-1 transition-all relative overflow-hidden ${isOn ? `${color} shadow-[0_0_5px_currentColor]` : 'bg-[#151515]'} ${isCurrent ? 'brightness-200 z-10 scale-110' : ''}`}
                                           />
                                       )
                                   })}
                               </div>
                           </div>
                       ))}
                   </div>
                   
                   <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                       <div className="flex gap-2">
                           <select value={drumSettings.kit} onChange={(e) => onDrumChange({...drumSettings, kit: e.target.value as DrumKit})} className="bg-black text-pink-300 text-[9px] border border-pink-900/50 rounded px-1 py-0.5 outline-none hover:border-pink-500">
                               {DRUM_KITS.map(k => <option key={k} value={k}>{k}</option>)}
                           </select>
                           <select value={drumSettings.fx} onChange={(e) => onDrumChange({...drumSettings, fx: e.target.value as DrumFX})} className="bg-black text-cyan-300 text-[9px] border border-cyan-900/50 rounded px-1 py-0.5 outline-none hover:border-cyan-500">
                               {DRUM_FX_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                           </select>
                       </div>
                       
                       <div className="flex items-center gap-2 bg-black/50 px-2 py-0.5 rounded-full border border-white/5">
                           <Disc size={10} className="text-pink-500" />
                           <input type="range" min="0" max="1" step="0.05" value={crossFader} onChange={(e) => onCrossFaderChange(parseFloat(e.target.value))} className="w-16 accent-white h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                           <Waves size={10} className="text-cyan-500" />
                       </div>
                   </div>
              </div>

              {/* DYNAMICS (2 Cols) */}
              <div className="col-span-2 p-3 flex flex-col">
                  <div className="flex items-center gap-2 text-orange-500 mb-2">
                      <Activity size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest font-arcade">GATING</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center gap-3 bg-black/20 p-2 rounded border border-white/5">
                      <div className="flex items-center justify-between">
                          <span className="text-[8px] text-gray-500 font-bold">MODE</span>
                          <button onClick={() => onGateChange({...gateSettings, enabled: !gateSettings.enabled})} className={`px-2 py-0.5 text-[8px] font-bold border rounded-[2px] transition-all ${gateSettings.enabled ? 'bg-orange-500 text-black border-orange-400 shadow-[0_0_10px_orange]' : 'bg-black border-gray-700 text-gray-600'}`}>
                              {gateSettings.enabled ? 'ON' : 'BYPASS'}
                          </button>
                      </div>
                      
                      <div>
                          <div className="text-[8px] text-gray-500 mb-1">PATTERN</div>
                          <select value={gateSettings.pattern} onChange={(e) => onGateChange({...gateSettings, pattern: e.target.value as GatePatternName})} className="w-full bg-black border border-orange-900/50 text-orange-400 text-[9px] rounded px-1 py-1 outline-none focus:border-orange-500">
                              {Object.keys(GATE_PATTERNS).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                          {['1/4','1/8','1/16','1/32'].map(d => (
                              <button key={d} onClick={() => onGateChange({...gateSettings, division: d as GateDivision})} className={`text-[7px] border rounded-[2px] py-1 transition-all ${gateSettings.division === d ? 'bg-orange-600 text-white border-orange-400' : 'bg-black border-gray-800 text-gray-600 hover:border-gray-600'}`}>
                                  {d.substring(2)}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* SYNTH (3 Cols) */}
              <div className="col-span-3 p-3 flex flex-col">
                  <div className="flex items-center gap-2 text-cyan-500 mb-2">
                      <Sliders size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest font-arcade">OSCILLATOR</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 flex-1">
                       {[1,2,3].map(i => {
                           const oscKey = `osc${i}Type` as keyof typeof currentPreset.audio;
                           const volKey = `osc${i}Vol` as keyof typeof currentPreset.audio;
                           
                           // FIX: Safely access OSC type, defaulting if undefined
                           const rawType = currentPreset.audio[oscKey];
                           const typeStr = typeof rawType === 'string' ? rawType : 'sine';

                           return (
                               <div key={i} className="flex flex-col items-center bg-black/40 border border-white/5 rounded p-1">
                                   <div className="flex-1 w-full flex justify-center py-2 relative">
                                       <VolumeSlider vertical value={(currentPreset.audio[volKey] as number) || 0.5} onChange={(v) => onPresetChange({...currentPreset, audio: {...currentPreset.audio, [volKey]: v}})} />
                                   </div>
                                   <button 
                                      className="w-full mt-2 text-[8px] font-mono text-cyan-300 border border-cyan-900/50 bg-cyan-950/50 rounded py-0.5 hover:bg-cyan-900 hover:border-cyan-500 transition-colors uppercase"
                                      onClick={() => {
                                          const types = i === 3 ? ['sine','white','pink','brown'] : ['sine','square','sawtooth','triangle','noise','supersaw'];
                                          const next = types[(types.indexOf(typeStr) + 1) % types.length];
                                          onPresetChange({...currentPreset, audio: {...currentPreset.audio, [oscKey]: next}});
                                      }}
                                   >
                                       {typeStr.substring(0,3)}
                                   </button>
                               </div>
                           )
                       })}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mt-2 px-1">
                       {['attack','decay','sustain','release'].map(p => (
                           <div key={p} className="flex flex-col items-center group">
                               <div className="h-8 w-full relative flex items-center justify-center">
                                   <input 
                                      type="range" className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                      min="0.01" max={p === 'release' ? 5 : 1} step="0.01"
                                      value={currentPreset.audio[p as keyof typeof currentPreset.audio] as number}
                                      onChange={(e) => onPresetChange({...currentPreset, audio: {...currentPreset.audio, [p]: parseFloat(e.target.value)}})}
                                   />
                                   <div className="w-1 h-full bg-gray-800 rounded-full overflow-hidden">
                                       <div className="w-full bg-cyan-500 absolute bottom-0" style={{height: `${(currentPreset.audio[p as keyof typeof currentPreset.audio] as number / (p==='release'?5:1))*100}%`}}></div>
                                   </div>
                               </div>
                               <span className="text-[6px] text-gray-500 mt-1 uppercase font-bold group-hover:text-cyan-400">{p.substring(0,1)}</span>
                           </div>
                       ))}
                  </div>
              </div>
          </div>
          
          {/* KEYBOARD / BOTTOM STRIP */}
          <div className="h-14 bg-[#080808] border-t border-white/10 flex items-end pb-1 px-1 relative z-20">
              
              {/* Controls Left */}
              <div className="w-32 flex flex-col justify-center items-center px-2 gap-1 h-full border-r border-white/5 mr-1">
                  <div className="flex gap-1 w-full">
                      <button onClick={() => onOctaveChange(octave - 1)} className="flex-1 bg-gray-900 text-gray-400 text-[8px] rounded border border-gray-700 hover:bg-gray-800 hover:text-white">-OCT</button>
                      <div className="px-2 text-[10px] font-mono font-bold text-cyan-400 flex items-center">{octave > 0 ? `+${octave}` : octave}</div>
                      <button onClick={() => onOctaveChange(octave + 1)} className="flex-1 bg-gray-900 text-gray-400 text-[8px] rounded border border-gray-700 hover:bg-gray-800 hover:text-white">+OCT</button>
                  </div>
                  <select value={selectedScale} onChange={(e) => setSelectedScale(e.target.value as any)} className="w-full bg-black text-[9px] text-gray-400 border border-gray-800 rounded outline-none h-4">
                      {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              
              {/* Piano Keys */}
              <div className="flex-1 relative flex items-end h-full gap-px select-none">
                  {whiteKeys.map(k => {
                       const isActive = activeMouseNote === k;
                       return (
                           <button 
                              key={k} 
                              onMouseDown={(e) => { triggerFeedback(e, 10, '#22d3ee'); onNotePlay(65.41 * Math.pow(2, quantizeNote(k)/12)); setActiveMouseNote(k); }}
                              className={`h-full flex-1 rounded-b-[2px] border-b-4 transition-all duration-75 ${isActive ? 'bg-cyan-400 border-cyan-600 shadow-[0_0_20px_cyan] z-10 translate-y-px' : 'bg-gray-200 border-gray-400 hover:bg-white'}`}
                           />
                       )
                  })}
                  
                  {/* Black Keys Absolute Positioning */}
                  {blackKeys.map(k => {
                       const isActive = activeMouseNote === k;
                       const whiteIndex = whiteKeys.filter(w => w < k).length;
                       const widthPct = (100 / numWhiteKeys) * 0.65; 
                       const leftPct = (whiteIndex * (100 / numWhiteKeys)) - (widthPct / 2);
                       
                       return (
                           <button
                              key={k}
                              onMouseDown={(e) => { triggerFeedback(e, 10, '#22d3ee'); onNotePlay(65.41 * Math.pow(2, quantizeNote(k)/12)); setActiveMouseNote(k); }}
                              style={{ left: `calc(${leftPct}% + 1px)`, width: `${widthPct}%` }}
                              className={`absolute top-0 h-[60%] rounded-b-[2px] border-b-4 border-x border-black z-20 transition-all duration-75 ${isActive ? 'bg-cyan-600 border-cyan-800 shadow-[0_0_15px_cyan] translate-y-px' : 'bg-black border-gray-800 hover:bg-gray-900'}`}
                           />
                       )
                  })}
              </div>
              
              {/* Master Volume */}
              <div className="w-12 flex flex-col items-center justify-end h-full border-l border-white/5 ml-1 pb-1">
                   <div className="h-8 w-4 mb-1">
                       <VolumeSlider vertical value={synthVolume} onChange={onSynthVolumeChange} color="cyan" />
                   </div>
                   <span className="text-[6px] font-bold text-gray-600">VOL</span>
              </div>
          </div>
      </div>
    </div>
  );
};

export default UIOverlay;
