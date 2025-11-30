
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GatePatternName, GateDivision, DrumKit, UserPatch } from '../types';
import { DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET, CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET, GATE_PATTERNS, DRUM_KITS, GATE_DIVISIONS } from '../constants';
import { Zap, Volume2, Loader2, Disc, Square, ChevronUp, ChevronDown, Waves, Activity, Wind, Church, Sparkles, ZapOff, Spline, Music2, Sliders, Heart, FolderHeart, Trash2, Drum, Grid3X3, Play, RotateCcw, VolumeX, Volume, Camera, MousePointer2, Scissors, ArrowUp, Wand2, Cpu, Radio, Globe, Skull, ActivitySquare, Waves as WavesIcon, Triangle, BoxSelect, Save } from 'lucide-react';
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
  userPatches: UserPatch[]; // Updated
  onLoadPatch: (p: UserPatch) => void; // Updated
  onBigSave: () => void;
  saveButtonText: string;
  nextSaveSlotIndex: number;
}

const FxButton = ({ label, active, onClick, icon: Icon, color }: { label: string, active: boolean, onClick: () => void, icon: any, color: string }) => {
  const colorStyles: Record<string, string> = {
    cyan: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]',
    violet: 'bg-violet-500/20 border-violet-400/50 text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.3)]',
    indigo: 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.3)]',
    orange: 'bg-orange-500/20 border-orange-400/50 text-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.3)]',
    pink: 'bg-pink-500/20 border-pink-400/50 text-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.3)]',
    yellow: 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.3)]',
    emerald: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)]',
  };

  const activeClass = colorStyles[color] || colorStyles.cyan;
  const dotColor = active ? { backgroundColor: 'currentColor' } : {};

  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }} 
      className={`
        group flex items-center gap-2 p-1.5 rounded-md border transition-all duration-150 w-full mb-1
        ${active 
          ? `${activeClass} translate-x-1` 
          : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5 hover:border-white/10 hover:text-gray-300'}
      `}
    >
      <div className={`p-0.5 rounded ${active ? 'bg-black/20' : ''}`}>
         <Icon size={12} className={active ? 'animate-pulse' : ''} />
      </div>
      <span className="text-[9px] font-bold tracking-wider uppercase flex-1 text-left">{label}</span>
      {active && <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={dotColor} />}
    </button>
  );
};

const VolumeSlider = ({ value, onChange, vertical = false }: { value: number, onChange: (v: number) => void, vertical?: boolean }) => (
  <div className={`relative flex items-center ${vertical ? 'h-16 w-8 justify-center' : 'w-full h-4'}`}>
    <div className={`absolute rounded-full bg-gray-900 border border-gray-700 ${vertical ? 'w-1.5 h-full' : 'w-full h-1.5'}`} />
    <div 
        className={`absolute rounded-full bg-gradient-to-t from-teal-600 to-teal-400 ${vertical ? 'w-1.5 bottom-0' : 'h-1.5 left-0'}`}
        style={vertical ? { height: `${value * 100}%` } : { width: `${value * 100}%` }}
    />
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={value} 
      onChange={(e) => {
          onChange(parseFloat(e.target.value));
      }}
      className={`
        absolute w-full h-full opacity-0 cursor-pointer z-10
        ${vertical ? 'appearance-slider-vertical' : ''}
      `}
      style={vertical ? { writingMode: 'vertical-lr', direction: 'rtl' } : {}}
    />
    <div 
        className={`absolute w-3 h-3 bg-gray-200 border border-gray-400 rounded-sm shadow-md pointer-events-none transition-all duration-75
            ${vertical ? 'left-1/2 -translate-x-1/2 mb-[-6px]' : 'top-1/2 -translate-y-1/2 ml-[-6px]'}
        `}
        style={vertical ? { bottom: `${value * 100}%` } : { left: `${value * 100}%` }}
    />
  </div>
);

// Neon Thumbs Up SVG for Big Save Button
const NeonThumbsUp = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 200 200" className={className} overflow="visible">
        <defs>
            <linearGradient id="neonThumbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
                <stop offset="50%" stopColor="#d946ef" /> {/* Magenta */}
                <stop offset="100%" stopColor="#eab308" /> {/* Yellow */}
            </linearGradient>
            <filter id="neonThumbGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        
        {/* Hand/Thumb Path */}
        <path 
            d="M50,100 L50,150 Q50,170 70,170 L130,170 Q150,170 150,150 L150,120 Q150,100 130,100 L110,100 L120,70 Q125,50 110,40 Q95,30 90,50 L80,100 L70,100 Q50,100 50,100 Z
               M50,100 Q40,100 40,110 L40,160 Q40,170 50,170"
            fill="none" 
            stroke="url(#neonThumbGrad)" 
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonThumbGlow)" 
        />
        
        {/* Fill with low opacity */}
        <path 
            d="M50,100 L50,150 Q50,170 70,170 L130,170 Q150,170 150,150 L150,120 Q150,100 130,100 L110,100 L120,70 Q125,50 110,40 Q95,30 90,50 L80,100 L70,100 Q50,100 50,100 Z"
            fill="url(#neonThumbGrad)" 
            opacity="0.2"
        />
        
        {/* Motion Lines */}
        <path d="M160,50 L170,40" stroke="#eab308" strokeWidth="4" strokeLinecap="round" filter="url(#neonThumbGlow)" />
        <path d="M170,70 L185,65" stroke="#d946ef" strokeWidth="4" strokeLinecap="round" filter="url(#neonThumbGlow)" />
        <path d="M30,130 L20,135" stroke="#06b6d4" strokeWidth="4" strokeLinecap="round" filter="url(#neonThumbGlow)" />
    </svg>
);

// Vibrant OOBLECK Logo SVG (Enhanced Cell-Shaded Version)
const OobleckLogo = ({ onClick }: { onClick: () => void }) => (
  <div 
    className="cursor-pointer relative group w-64 h-64 select-none z-20" 
    onClick={onClick}
    role="button"
    aria-label="Randomize (Chaos Mode)"
  >
    <svg viewBox="0 0 300 240" className="w-full h-full drop-shadow-[0_15px_35px_rgba(0,0,0,0.8)] overflow-visible">
       <defs>
         <linearGradient id="slimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#84cc16" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
         </linearGradient>
         <linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
         </linearGradient>
         <filter id="neonGlow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
         </filter>
         <filter id="displacement">
             <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
             <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/>
         </filter>
       </defs>
       
       {/* Background Splatters (Cell Shaded Depth) */}
       <path d="M160,10 Q250,-20 280,60 Q310,140 230,200 Q150,250 60,190 Q-10,130 30,50 Q70,-20 160,10 Z" 
             fill="#3b0764" stroke="black" strokeWidth="12" />
             
       <path d="M150,20 Q230,-10 260,60 Q290,130 220,180 Q150,230 80,180 Q10,130 40,60 Q70,-10 150,20 Z" 
             fill="url(#slimeGrad)" stroke="black" strokeWidth="6" />
             
       {/* Inner Highlights */}
       <path d="M100,50 Q150,40 200,60 Q230,100 200,140 Q150,160 100,140 Q70,100 100,50 Z" 
             fill="#bef264" opacity="0.4" filter="url(#displacement)" />

       {/* Typography Layer */}
       <g transform="translate(150,115) rotate(-5)">
          {/* Deep Shadow */}
          <text x="8" y="8" textAnchor="middle" fontSize="72" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="#1e1b4b" stroke="#1e1b4b" strokeWidth="24" letterSpacing="-4" opacity="0.8">OOBLECK</text>
          
          {/* Thick Outline */}
          <text x="0" y="0" textAnchor="middle" fontSize="72" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="black" stroke="black" strokeWidth="22" letterSpacing="-4">OOBLECK</text>
          
          {/* Main Gradient Text */}
          <text x="0" y="0" textAnchor="middle" fontSize="72" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="url(#textGrad)" stroke="white" strokeWidth="3" letterSpacing="-4" paintOrder="stroke">OOBLECK</text>
          
          {/* Wet Highlight on Text */}
          <path d="M-130,-35 Q-60,-55 0,-45 T130,-35" stroke="white" strokeWidth="6" fill="none" opacity="0.6" strokeLinecap="round" />
       </g>

       {/* Dynamic Drips */}
       <path d="M80,175 Q85,200 80,225" stroke="#4ade80" strokeWidth="10" fill="none" strokeLinecap="round" />
       <circle cx="80" cy="235" r="6" fill="#4ade80" />
       
       <path d="M220,165 Q215,190 220,215" stroke="#4ade80" strokeWidth="8" fill="none" strokeLinecap="round" />

       {/* Electric Zaps */}
       <path d="M260,30 L285,10 L275,50 L295,30" stroke="#fef08a" strokeWidth="4" fill="none" filter="url(#neonGlow)">
          <animate attributeName="opacity" values="0;1;0" dur="0.4s" repeatCount="indefinite" />
       </path>
       <path d="M20,160 L5,190 L35,180" stroke="#fef08a" strokeWidth="4" fill="none" filter="url(#neonGlow)">
          <animate attributeName="opacity" values="0;1;0" dur="0.6s" repeatCount="indefinite" />
       </path>

       {/* Tech Banner */}
       <g transform="translate(150,175) rotate(2)">
           <path d="M-115,-14 L115,-14 L105,14 L-125,14 Z" fill="black" stroke="#2dd4bf" strokeWidth="2" />
           <text x="0" y="5" textAnchor="middle" fontSize="11" fontFamily="monospace" fontWeight="bold" fill="#2dd4bf" letterSpacing="2">FLUID SYNTHESIZER</text>
       </g>

    </svg>
    
    <div className="absolute inset-0 rounded-full bg-green-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  </div>
);

// Internal component for the flying animation
const FlyingThumbImpl = ({sx, sy, tx, ty, onComplete}: {sx: number, sy: number, tx: number, ty: number, onComplete: () => void}) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        transform: `translate(${sx}px, ${sy}px) scale(1)`,
        opacity: 1
    });

    useEffect(() => {
        // Trigger animation next frame
        requestAnimationFrame(() => {
            setStyle({
                transform: `translate(${tx}px, ${ty}px) scale(0.2)`,
                opacity: 0
            });
        });
        
        const t = setTimeout(onComplete, 500); // Matches duration
        return () => clearTimeout(t);
    }, []);

    return (
        <div 
            className="fixed top-0 left-0 transition-all duration-500 ease-in-out pointer-events-none z-[100]" 
            style={style}
        >
             {/* Offset to center the 64x64 icon on the coordinate point */}
            <div style={{ transform: 'translate(-50%, -50%)' }}>
                <NeonThumbsUp className="w-16 h-16" />
            </div>
        </div>
    );
};

const UIOverlay: React.FC<Props> = ({ 
  currentPreset, onPresetChange, playState, setPlayState, 
  onGenerateStart, isRecording, onToggleRecord, octave, onOctaveChange,
  fxState, onToggleFx, onNotePlay, arpSettings, onArpChange, onScaleFrequenciesChange,
  drumSettings, onDrumChange, currentStep, gateSettings, onGateChange,
  synthVolume, onSynthVolumeChange,
  favorites, onSaveFavorite, onDeleteFavorite,
  isCameraActive, onToggleCamera, isSounding, onRandomize,
  crossFader, onCrossFaderChange, onRevertPreset,
  onGrowl, currentGrowlName, onChop,
  userPatches, onLoadPatch, onBigSave, saveButtonText,
  nextSaveSlotIndex
}) => {
  const [activeMouseNote, setActiveMouseNote] = useState<number | null>(null);
  const [hasRandomized, setHasRandomized] = useState(false);
  const [hasReverted, setHasReverted] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isEscPressed, setIsEscPressed] = useState(false);
  
  // Animation Refs & State
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const presetBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [flyingThumb, setFlyingThumb] = useState<{sx:number, sy:number, tx:number, ty:number, id:number} | null>(null);

  const handleBigSaveClick = () => {
    if (saveBtnRef.current) {
        const sRect = saveBtnRef.current.getBoundingClientRect();
        // Target is the button for the NEXT save slot (passed from App)
        const tRect = presetBtnRefs.current[nextSaveSlotIndex]?.getBoundingClientRect();
        
        if (tRect) {
             setFlyingThumb({
                 sx: sRect.left + sRect.width / 2,
                 sy: sRect.top + sRect.height / 2,
                 tx: tRect.left + tRect.width / 2,
                 ty: tRect.top + tRect.height / 2,
                 id: Date.now()
             });
        }
    }
    onBigSave();
  };

  // Keyboard mapping
  const NOTE_MAP: Record<string, number> = {
    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
    ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16
  };
  
  // Scale definitions
  const SCALES = {
      'Chromatic': [0,1,2,3,4,5,6,7,8,9,10,11],
      'Major': [0,2,4,5,7,9,11],
      'Minor': [0,2,3,5,7,8,10],
      'Pentatonic': [0,3,5,7,10]
  };
  const [selectedScale, setSelectedScale] = useState<keyof typeof SCALES>('Chromatic');
  const [rootNote, setRootNote] = useState(0); // 0 = C

  useEffect(() => {
      // Calculate frequencies for the current scale
      const baseFreq = 65.41; // C2 (Shifted down from C3 130.81)
      const freqs = [];
      // 4 Octaves = 48 keys
      for(let i=0; i<48; i++) { 
          const octave = Math.floor(i / 12);
          const noteIndex = i % 12;
          
          // Check if note is in scale
          const interval = (noteIndex - rootNote + 12) % 12;
          
          if (SCALES[selectedScale].includes(interval)) {
               freqs.push(baseFreq * Math.pow(2, (i - 9)/12)); 
          }
      }
      onScaleFrequenciesChange(freqs);
  }, [selectedScale, rootNote]);

  const quantizeNote = (rawIndex: number) => {
      const scaleIntervals = SCALES[selectedScale];
      let minDist = 12;
      let bestIndex = rawIndex;
      
      const rawNoteClass = (rawIndex - rootNote + 12) % 12;
      
      if (scaleIntervals.includes(rawNoteClass)) return rawIndex;

      // Find nearest
      for(let d=1; d<6; d++) {
          if (scaleIntervals.includes((rawNoteClass + d)%12)) return rawIndex + d;
          if (scaleIntervals.includes((rawNoteClass - d + 12)%12)) return rawIndex - d;
      }
      return rawIndex;
  };

  const handleKeyDown = useCallback((e: any) => {
    // Only trigger if not typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (e.repeat) return;
    
    // Spacebar Randomize
    if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
        onRandomize();
        setHasRandomized(true);
        return;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        setIsEscPressed(true);
        onRevertPreset();
        setHasReverted(true);
        return;
    }

    // Growl Shortcut (Alt)
    if (e.key === 'Alt') {
        e.preventDefault(); // Prevent browser menu focus
        setIsAltPressed(true);
        onGrowl();
        return;
    }

    // Enter: Initialize if IDLE, Toggle Rhythm if PLAYING
    if (e.key === 'Enter') {
        if (playState === PlayState.IDLE) {
            setPlayState(PlayState.PLAYING);
        } else {
            onDrumChange({ ...drumSettings, enabled: !drumSettings.enabled });
        }
        return;
    }

    // Camera Toggle
    if (e.key === '\\') {
        onToggleCamera();
        return;
    }

    // --- Performance Shortcuts ---

    // Arrows: Mixing & Pitch
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        onOctaveChange(Math.min(octave + 1, 2));
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        onOctaveChange(Math.max(octave - 1, -2));
        return;
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onCrossFaderChange(Math.max(0, crossFader - 0.1));
        return;
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        onCrossFaderChange(Math.min(1, crossFader + 0.1));
        return;
    }

    // Brackets: Volume
    if (e.key === '[') {
        onSynthVolumeChange(Math.max(0, synthVolume - 0.05));
        return;
    }
    if (e.key === ']') {
        onSynthVolumeChange(Math.min(1, synthVolume + 0.05));
        return;
    }

    // QWERTY Row 1: Gate Speed (Left Hand)
    const gateMap: Record<string, GateDivision> = {
        'q': '1/64', 'w': '1/32', 'e': '1/16', 'r': '1/8', 't': '1/4'
    };
    if (gateMap[e.key.toLowerCase()]) {
        onGateChange({ ...gateSettings, division: gateMap[e.key.toLowerCase()] });
        return;
    }

    // QWERTY Row 1: Module Toggles (Right Hand)
    if (e.key.toLowerCase() === 'u') {
        onArpChange({ ...arpSettings, enabled: !arpSettings.enabled });
        return;
    }
    if (e.key.toLowerCase() === 'i') {
        onGateChange({ ...gateSettings, enabled: !gateSettings.enabled });
        return;
    }
    if (e.key.toLowerCase() === 'o') {
        onDrumChange({ ...drumSettings, enabled: !drumSettings.enabled });
        return;
    }
    if (e.key.toLowerCase() === 'p') {
        onToggleRecord();
        return;
    }

    // Presets 1-0 (Using UserPatches now)
    const key = e.key;
    const PRESET_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const pIdx = PRESET_KEYS.indexOf(key);
    
    if (pIdx >= 0) {
        if (userPatches[pIdx]) {
            onLoadPatch(userPatches[pIdx]);
        }
        return;
    }

    // Musical Typing
    if (NOTE_MAP.hasOwnProperty(key)) {
      const semitone = NOTE_MAP[key];
      const quantized = quantizeNote(semitone);
      const freq = 65.41 * Math.pow(2, quantized / 12); // C2
      onNotePlay(freq);
      setActiveMouseNote(semitone);
    }
  }, [octave, crossFader, synthVolume, gateSettings, arpSettings, drumSettings, onPresetChange, playState, onToggleRecord, onNotePlay, onToggleCamera, selectedScale, rootNote, onRandomize, onRevertPreset, onGrowl, userPatches, onLoadPatch]);

  const handleKeyUp = useCallback((e: any) => {
      if (e.code === 'Space') setIsSpacePressed(false);
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === 'Escape') setIsEscPressed(false);
      setActiveMouseNote(null);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]); 

  const handleGenerate = async () => {
      if (!prompt.trim()) return;
      setIsGenerating(true);
      try {
          const newPreset = await generatePreset(prompt);
          onPresetChange(newPreset);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGenerating(false);
      }
  };

  // 48 Key Generation (4 Octaves)
  const totalKeys = 48;
  const allKeys = Array.from({ length: totalKeys }, (_, i) => i);
  const whiteKeys = allKeys.filter(i => [0, 2, 4, 5, 7, 9, 11].includes(i % 12));
  const blackKeys = allKeys.filter(i => [1, 3, 6, 8, 10].includes(i % 12));
  
  const numWhiteKeys = whiteKeys.length;

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between z-10 overflow-hidden">
      
      <style>{`
        @keyframes wiggle {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
        }
        @keyframes snip {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-25deg); }
        }
        @keyframes reverse-spin {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
        }
        @keyframes splat-dance {
            0%, 100% { transform: scale(2) rotate(0deg); }
            25% { transform: scale(2.1) rotate(-2deg); }
            50% { transform: scale(2) rotate(0deg); }
            75% { transform: scale(2.1) rotate(2deg); }
        }
      `}</style>

      {/* FLYING THUMB ANIMATION LAYER */}
      {flyingThumb && (
          <FlyingThumbImpl 
             key={flyingThumb.id} 
             {...flyingThumb} 
             onComplete={() => setFlyingThumb(null)} 
          />
      )}

      {/* Growl Notification - Highest Priority Alert (z-[60]) */}
      {currentGrowlName && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]">
            <div className="bg-yellow-400 text-black font-black text-4xl px-8 py-4 -skew-x-12 border-4 border-black shadow-[8px_8px_0px_black] uppercase tracking-tighter animate-[wiggle_0.2s_ease-in-out_infinite]">
                {currentGrowlName}
            </div>
        </div>
      )}

      {/* CENTRAL CONTROL GRID (Replacing Floating Buttons) */}
      {playState === PlayState.PLAYING && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto w-[500px] h-[300px]">
            <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full">
                
                {/* TOP LEFT: CHOP IT UP (Gate 1/64) */}
                <button
                    onClick={onChop}
                    className={`
                        group relative flex flex-col items-center justify-center
                        bg-gradient-to-r from-orange-400 via-red-500 to-yellow-500
                        rounded-2xl border-4 border-black
                        transition-all duration-150
                        hover:opacity-75 hover:scale-[1.02]
                        active:opacity-100 active:scale-95 active:shadow-none
                        shadow-[6px_6px_0px_#000]
                        opacity-50
                    `}
                >
                    <Scissors className="w-10 h-10 mb-2 animate-[snip_0.4s_ease-in-out_infinite] text-white drop-shadow-md" strokeWidth={3} />
                    <span className="font-black text-2xl italic tracking-tighter text-white drop-shadow-md">CHOP IT UP</span>
                    <span className="text-[10px] font-mono font-bold text-white/80 tracking-widest mt-1">(CLICK)</span>
                </button>

                {/* TOP RIGHT: GRRRR! (Growl) */}
                <button
                    onClick={onGrowl}
                    className={`
                        group relative flex flex-col items-center justify-center
                        bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600
                        rounded-2xl border-4 border-black
                        transition-all duration-150
                        hover:opacity-75 hover:scale-[1.02]
                        active:opacity-100 active:scale-95 active:shadow-none
                        shadow-[6px_6px_0px_#000]
                        ${isAltPressed || currentGrowlName ? 'opacity-100 scale-[1.02]' : 'opacity-50'}
                    `}
                >
                    <Skull className="w-10 h-10 mb-2 animate-[bounce_0.5s_infinite] text-white drop-shadow-md" strokeWidth={3} />
                    <span className="font-black text-2xl italic tracking-tighter text-white drop-shadow-md">GRRRR!</span>
                    <span className="text-[10px] font-mono font-bold text-white/80 tracking-widest mt-1">(ALT)</span>
                </button>

                {/* BOTTOM LEFT: RUN BACK (Undo/ESC) */}
                <button
                    onClick={() => { onRevertPreset(); setHasReverted(true); }}
                    className={`
                        group relative flex flex-col items-center justify-center
                        bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600
                        rounded-2xl border-4 border-black
                        transition-all duration-150
                        hover:opacity-75 hover:scale-[1.02]
                        active:opacity-100 active:scale-95 active:shadow-none
                        shadow-[6px_6px_0px_#000]
                        ${isEscPressed ? 'opacity-100 scale-[1.02]' : 'opacity-50'}
                    `}
                >
                    <RotateCcw className="w-10 h-10 mb-2 animate-[reverse-spin_1.5s_linear_infinite] text-white drop-shadow-md" strokeWidth={3} />
                    <span className="font-black text-2xl italic tracking-tighter text-white drop-shadow-md">RUN BACK</span>
                    <span className="text-[10px] font-mono font-bold text-white/80 tracking-widest mt-1">(ESC)</span>
                </button>

                {/* BOTTOM RIGHT: CHAOS (Random) */}
                <button
                    onClick={() => { onRandomize(); setHasRandomized(true); }}
                    className={`
                        group relative flex flex-col items-center justify-center
                        bg-gradient-to-r from-red-500 via-purple-500 to-blue-600
                        rounded-2xl border-4 border-black
                        transition-all duration-150
                        hover:opacity-75 hover:scale-[1.02]
                        active:opacity-100 active:scale-95 active:shadow-none
                        shadow-[6px_6px_0px_#000]
                        ${isSpacePressed ? 'opacity-100 scale-[1.02]' : 'opacity-50'}
                    `}
                >
                    <Wand2 className="w-10 h-10 mb-2 animate-spin text-white drop-shadow-md" strokeWidth={3} />
                    <span className="font-black text-2xl italic tracking-tighter text-white drop-shadow-md">CHAOS</span>
                    <span className="text-[10px] font-mono font-bold text-white/80 tracking-widest mt-1">(SPACE)</span>
                </button>

            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="flex flex-col gap-4 relative ml-[15px]">
          <OobleckLogo onClick={() => { onRandomize(); setHasRandomized(true); }} />

          {/* Logo Call to Action Arrow */}
          {!hasRandomized && (
            <div className="absolute top-40 -right-4 flex items-center gap-2 animate-pulse pointer-events-none">
                <div className="text-teal-400 font-handwriting text-xl -rotate-12 font-bold whitespace-nowrap">CLICK ME</div>
                <ArrowUp className="text-teal-400 rotate-[-45deg]" size={32} />
            </div>
          )}

          {/* Camera Preview Placeholder (Position handled by WebcamMotion component) */}
          <div className="w-64 h-48"></div> 

          {/* Camera Button (Moved below camera preview) */}
          <div className="relative w-64 flex justify-center -mt-2">
              <button 
                  onClick={onToggleCamera}
                  className={`
                      group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black text-xs tracking-wider transition-all w-full
                      border-2 border-black shadow-[4px_4px_0px_#000]
                      active:opacity-100 active:scale-95 active:shadow-none
                      hover:scale-[1.02]
                      ${isCameraActive 
                          ? 'bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white animate-pulse opacity-100 scale-[1.02]' 
                          : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-teal-400 text-black opacity-50 hover:opacity-75'}
                  `}
              >
                  <Camera size={18} className={isCameraActive ? "animate-spin" : "group-hover:rotate-12 transition-transform"} />
                  <span className="drop-shadow-md italic">
                      {isCameraActive ? 'CAMERA OFF' : 'CAMERA ON'}
                  </span>
              </button>
              {!isCameraActive && !hasRandomized && (
                   <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center animate-bounce pointer-events-none">
                      <ArrowUp size={20} className="text-red-400" />
                  </div>
              )}
          </div>
        </div>
        
        {/* BIG SAVE BUTTON - Top Center (Neon Paint Splatter Style) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-4 pointer-events-auto z-20">
            <button
                ref={saveBtnRef}
                onClick={handleBigSaveClick}
                className="relative group w-48 h-32 flex items-center justify-center focus:outline-none transition-transform active:scale-95"
            >
                <NeonThumbsUp 
                    className={`absolute inset-0 w-full h-full drop-shadow-[0_0_20px_rgba(217,70,239,0.5)] ${isSounding ? 'animate-[splat-dance_0.2s_ease-in-out_infinite]' : 'animate-[splat-dance_3s_ease-in-out_infinite]'}`} 
                />
                
                {/* Rotating, Pulsating Text */}
                <span 
                    className={`
                        relative z-10 font-black text-2xl italic tracking-tighter text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] translate-y-[40px]
                        ${isSounding ? 'animate-pulse text-yellow-200' : ''}
                    `}
                >
                    {saveButtonText}
                </span>
            </button>
        </div>

        {/* TOP RIGHT CONTROLS */}
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 mb-2">
                <button 
                    onClick={onSaveFavorite}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 transition-colors"
                    title="Save to Favorites"
                >
                    <Heart size={14} />
                </button>
                <button 
                    onClick={onToggleRecord}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all
                        ${isRecording 
                            ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]' 
                            : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'}
                    `}
                >
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
                    {isRecording ? 'REC' : 'REC'}
                </button>
            </div>

            {/* PRESETS ROW - DYNAMIC COLOR & WIDTH */}
            <div className="flex gap-1 bg-black/60 backdrop-blur p-1 rounded-xl border border-white/10 flex-wrap justify-end max-w-[400px]">
                {userPatches.map((p, idx) => {
                    const isCurrent = currentPreset.description === p.preset.description;
                    const color = p.preset.physics.colorBase || '#14b8a6'; // fallback teal
                    
                    return (
                    <button
                        key={idx}
                        ref={(el) => (presetBtnRefs.current[idx] = el)}
                        onMouseDown={() => {
                            onLoadPatch(p);
                        }}
                        style={{
                            borderColor: color,
                            backgroundColor: isCurrent ? color : 'rgba(255,255,255,0.05)',
                            color: isCurrent ? '#000' : color,
                            boxShadow: isCurrent ? `0 0 10px ${color}` : 'none'
                        }}
                        className={`
                            w-auto px-2 h-6 rounded border flex items-center justify-center text-[9px] font-black uppercase transition-all min-w-[1.5rem]
                            ${isCurrent ? 'scale-110 z-10' : 'hover:bg-white/10'}
                        `}
                        title={p.preset.description}
                    >
                        {p.label}
                    </button>
                )})}
            </div>
            
            {/* Favorites List (Mini) */}
            {favorites.length > 0 && (
                <div className="mt-2 bg-black/60 backdrop-blur rounded-xl border border-white/10 p-2 max-h-32 overflow-y-auto w-48">
                    <div className="text-[9px] text-gray-500 uppercase font-bold mb-1 px-1">Favorites</div>
                    {favorites.map((fav, i) => (
                        <div key={i} className="flex items-center justify-between group p-1 hover:bg-white/5 rounded cursor-pointer" onClick={() => onPresetChange(fav)}>
                            <span className="text-[9px] text-gray-300 truncate w-32">{fav.physics.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteFavorite(i); }} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100">
                                <Trash2 size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* MAIN FX RACK - Sidebar (Updated to Vertical Stack) */}
            <div className="bg-black/60 backdrop-blur rounded-xl border border-white/10 p-2 mt-2 flex flex-col gap-1 w-[100px]">
                <FxButton label="Delay" active={fxState.delay} onClick={() => onToggleFx('delay')} icon={Waves} color="cyan" />
                <FxButton label="Reverb" active={fxState.reverb} onClick={() => onToggleFx('reverb')} icon={Church} color="violet" />
                <FxButton label="Chorus" active={fxState.chorus} onClick={() => onToggleFx('chorus')} icon={Wind} color="indigo" />
                <FxButton label="Distort" active={fxState.distortion} onClick={() => onToggleFx('distortion')} icon={Zap} color="orange" />
                <FxButton label="Saturate" active={fxState.crunch} onClick={() => onToggleFx('crunch')} icon={Scissors} color="pink" />
                <FxButton label="Phaser" active={fxState.phaser} onClick={() => onToggleFx('phaser')} icon={Disc} color="yellow" />
                <FxButton label="HiPass" active={fxState.highpass} onClick={() => onToggleFx('highpass')} icon={Activity} color="emerald" />
            </div>
        </div>
      </div>

      {/* FOOTER CONTROLS - COMBINED MASTER CARD */}
      <div className="flex flex-col items-center justify-end pointer-events-auto">
        
        {/* Playback Control (Hidden mostly as it's auto-play, but good for restart) */}
        {playState === PlayState.IDLE && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                <button 
                    onClick={() => setPlayState(PlayState.PLAYING)}
                    className="bg-teal-500 hover:bg-teal-400 text-black font-bold text-xl px-12 py-6 rounded-2xl shadow-[0_0_50px_rgba(45,212,191,0.5)] flex items-center gap-4 animate-pulse transition-transform hover:scale-105"
                >
                    <Play size={32} fill="black" />
                    INITIALIZE ENGINE
                </button>
            </div>
        )}

        {/* UNIFIED SYNTH DASHBOARD - 80s Boombox Style */}
        <div className="w-[98%] max-w-none mx-auto bg-zinc-900 border-4 border-zinc-700 rounded-t-lg shadow-2xl overflow-hidden backdrop-blur-xl relative translate-y-[10px]">
          
          {/* Decorative Texture/Stripes */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-yellow-500 to-teal-500 opacity-80" />
          <div className="absolute top-1 left-0 w-full h-0.5 bg-black/50" />

          {/* Top Control Deck - Responsive 12-Column Grid */}
          <div className="grid grid-cols-12 divide-x-2 divide-zinc-800 bg-zinc-900 h-40">
            
            {/* MODULE 1: CORE (AI + Physics) - 2 Cols (Growl Removed) */}
            <div className="col-span-2 p-2 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-purple-400 mb-1 border-b border-zinc-800 pb-1">
                    <Cpu size={12} />
                    <span className="text-[9px] font-black uppercase tracking-widest font-mono">CORE</span>
                </div>
                
                {/* AI */}
                <div className="flex gap-1 mb-2">
                    <input
                        className="w-full bg-black/50 border border-zinc-700 rounded-sm px-1 text-[8px] text-white placeholder-zinc-600 h-6 focus:outline-none focus:border-purple-500"
                        placeholder="Describe sound..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className="bg-purple-900/50 border border-purple-700 hover:bg-purple-800 text-purple-300 rounded-sm w-6 h-6 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    </button>
                </div>

                {/* Physics */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[7px] text-zinc-500 font-bold uppercase">
                        <span>MAT</span>
                        <span className="text-teal-400 font-mono">{currentPreset.physics.name}</span>
                    </div>
                    <div className="space-y-1">
                        <div className="h-1 w-full bg-black rounded-sm overflow-hidden border border-zinc-700">
                            <div className="h-full bg-blue-500" style={{ width: `${currentPreset.physics.viscosityBase * 100}%` }} />
                        </div>
                        <div className="h-1 w-full bg-black rounded-sm overflow-hidden border border-zinc-700">
                            <div className="h-full bg-orange-500" style={{ width: `${currentPreset.physics.thickeningFactor * 100}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* MODULE 2: RHYTHM (Sampler) - 4 Cols */}
            <div className="col-span-4 p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1 border-b border-zinc-800 pb-1">
                     <div className="flex items-center gap-1.5 text-pink-400">
                         <Drum size={12} />
                         <span className="text-[9px] font-black uppercase tracking-widest font-mono">RHYTHM</span>
                     </div>
                     <button 
                        onClick={() => onDrumChange({...drumSettings, enabled: !drumSettings.enabled})}
                        className={`w-6 h-3 rounded transition-colors border border-black/30 ${drumSettings.enabled ? 'bg-pink-600 shadow-[0_0_8px_rgba(236,72,153,0.6)]' : 'bg-zinc-700'}`}
                     >
                         <div className={`w-1.5 h-full bg-white/80 transition-transform ${drumSettings.enabled ? 'translate-x-3' : ''}`} />
                     </button>
                 </div>
                 
                 <div className="flex flex-col h-full pt-1 gap-1">
                     {/* Genre Grid */}
                     <div className="grid grid-cols-4 gap-0.5">
                         {['HIPHOP', 'DISCO', 'HOUSE', 'DUBSTEP', 'METAL', 'FUNK', 'ROCK', 'BOOMBAP'].map((g) => (
                             <button
                                key={g}
                                onClick={() => onDrumChange({...drumSettings, genre: g as SamplerGenre})}
                                className={`
                                    text-[6px] font-bold py-0.5 px-1 rounded-sm border-b 
                                    ${drumSettings.genre === g 
                                        ? 'bg-zinc-800 text-pink-400 border-pink-500' 
                                        : 'bg-zinc-800/30 text-zinc-600 border-transparent hover:bg-zinc-800'}
                                `}
                             >
                                 {g}
                             </button>
                         ))}
                     </div>

                     {/* 4-Layer Step Sequencer */}
                     <div className="flex-1 flex flex-col gap-0.5 min-h-0 bg-black/20 rounded-sm p-1 border border-zinc-800">
                         {(['kick', 'snare', 'hihat', 'clap'] as const).map((layer) => (
                             <div key={layer} className="flex gap-px items-center h-full">
                                 {/* Label */}
                                 <div className="w-6 text-[6px] font-bold text-zinc-500 uppercase text-right pr-1">
                                    {layer === 'hihat' ? 'HAT' : layer.substring(0,3)}
                                 </div>
                                 {/* Steps */}
                                 <div className="flex-1 flex gap-px h-full">
                                     {drumSettings.pattern.map((step, i) => (
                                         <button 
                                            key={i}
                                            onClick={() => {
                                                const newPattern = [...drumSettings.pattern];
                                                newPattern[i] = { ...newPattern[i], [layer]: !newPattern[i][layer] };
                                                onDrumChange({ ...drumSettings, pattern: newPattern });
                                            }}
                                            className={`
                                                flex-1 rounded-[1px] transition-colors
                                                ${step[layer] 
                                                    ? (layer === 'kick' ? 'bg-pink-500' : layer === 'snare' ? 'bg-cyan-500' : layer === 'hihat' ? 'bg-yellow-500' : 'bg-purple-500') 
                                                    : 'bg-zinc-800 hover:bg-zinc-700'}
                                                ${i === currentStep ? 'brightness-150 border-white/50 border' : ''}
                                            `}
                                         />
                                     ))}
                                 </div>
                             </div>
                         ))}
                     </div>

                     {/* Kit & Mix */}
                     <div className="flex gap-2 items-center justify-start mt-0.5">
                        <div className="flex items-center gap-1.5 bg-zinc-800/50 rounded-sm px-1 py-0.5 border border-zinc-700/50 w-20">
                             <span className="text-[7px] font-bold text-pink-500">DRM</span>
                             <input 
                                type="range" min="0" max="1" step="0.01"
                                value={crossFader}
                                onChange={(e) => onCrossFaderChange(parseFloat(e.target.value))}
                                className="flex-1 h-1 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-thumb]:rounded-[1px] cursor-ew-resize min-w-0"
                             />
                             <span className="text-[7px] font-bold text-teal-500">SYN</span>
                         </div>
                         <select 
                            value={drumSettings.kit} 
                            onChange={(e) => onDrumChange({...drumSettings, kit: e.target.value as DrumKit})}
                            className="bg-black text-pink-500 text-[8px] font-bold uppercase border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none w-auto"
                         >
                            {DRUM_KITS.map(kit => <option key={kit} value={kit}>{kit}</option>)}
                         </select>
                     </div>
                 </div>
            </div>

            {/* MODULE 3: DYNAMICS (Gate) - 2 Cols */}
            <div className="col-span-2 p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1 border-b border-zinc-800 pb-1">
                     <div className="flex items-center gap-1 text-orange-400">
                         <Spline size={12} />
                         <span className="text-[9px] font-black uppercase tracking-widest font-mono">DYNAMICS</span>
                     </div>
                     <button 
                        onClick={() => onGateChange({...gateSettings, enabled: !gateSettings.enabled})}
                        className={`w-5 h-3 rounded transition-colors border border-black/30 ${gateSettings.enabled ? 'bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.6)]' : 'bg-zinc-700'}`}
                     >
                         <div className={`w-1.5 h-full bg-white/80 transition-transform ${gateSettings.enabled ? 'translate-x-2' : ''}`} />
                     </button>
                 </div>

                 <div className="flex flex-col gap-2 h-full justify-center">
                     <div className="space-y-0.5">
                        <label className="text-[7px] text-zinc-500 font-bold uppercase">Pattern</label>
                        <select
                            value={gateSettings.pattern}
                            onChange={(e) => onGateChange({...gateSettings, pattern: e.target.value as GatePatternName})}
                            className="w-full bg-black text-orange-400 text-[8px] font-bold uppercase border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none"
                        >
                            {Object.keys(GATE_PATTERNS).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                     </div>

                     <div className="space-y-0.5">
                        <label className="text-[7px] text-zinc-500 font-bold uppercase">Rate</label>
                        <select
                            value={gateSettings.division}
                            onChange={(e) => onGateChange({...gateSettings, division: e.target.value as GateDivision})}
                            className="w-full bg-black text-orange-400 text-[8px] font-bold uppercase border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none"
                        >
                            {GATE_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                     </div>
                     
                     <div className="flex items-center gap-1 mt-1">
                         <span className="text-[7px] text-zinc-500 font-bold w-4">MIX</span>
                         <div className="w-16">
                             <VolumeSlider value={gateSettings.mix} onChange={(v) => onGateChange({...gateSettings, mix: v})} />
                         </div>
                     </div>
                 </div>
            </div>

            {/* MODULE 4: SYNTH (Osc & ADSR) - Replaced SEQ */}
            <div className="col-span-2 p-2 flex flex-col justify-between">
                 <div className="flex items-center justify-between mb-1 border-b border-zinc-800 pb-1">
                     <div className="flex items-center gap-1 text-yellow-400">
                         <ActivitySquare size={12} />
                         <span className="text-[9px] font-black uppercase tracking-widest font-mono">SYNTH</span>
                     </div>
                 </div>
                 
                 <div className="flex flex-col h-full justify-between pt-1 gap-1">
                     {/* Oscillators */}
                     <div className="flex gap-2">
                        {[1, 2].map(num => {
                            const oscKey = `osc${num}Type` as keyof typeof currentPreset.audio;
                            const type = currentPreset.audio[oscKey] as string;
                            const Icon = type === 'sine' ? WavesIcon : type === 'square' ? Square : type === 'triangle' ? Triangle : Activity;
                            
                            return (
                                <div key={num} className="flex-1 bg-black border border-zinc-700 rounded-sm p-1 flex flex-col items-center">
                                    <span className="text-[6px] text-zinc-500 font-bold uppercase mb-1">OSC {num}</span>
                                    <button 
                                        onClick={() => {
                                            const types = ['sine', 'square', 'sawtooth', 'triangle'];
                                            const idx = types.indexOf(type);
                                            const nextType = types[(idx + 1) % 4];
                                            onPresetChange({
                                                ...currentPreset,
                                                audio: { ...currentPreset.audio, [oscKey]: nextType }
                                            });
                                        }}
                                        className="text-yellow-500 hover:text-yellow-300 transition-colors"
                                    >
                                        <Icon size={14} />
                                    </button>
                                </div>
                            );
                        })}
                     </div>

                     {/* ADSR Sliders */}
                     <div className="flex justify-between items-end flex-1 gap-1 mt-1 bg-black/30 rounded-sm p-1 border border-zinc-800">
                        {['attack', 'decay', 'sustain', 'release'].map((param) => {
                            const val = currentPreset.audio[param as keyof typeof currentPreset.audio] as number;
                            const max = param === 'sustain' ? 1 : (param === 'release' ? 5 : 2); // Max values
                            
                            return (
                                <div key={param} className="flex flex-col items-center h-full gap-0.5 flex-1">
                                    <div className="relative w-2 h-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div 
                                            className="absolute bottom-0 w-full bg-yellow-500 rounded-b-full"
                                            style={{ height: `${(val / max) * 100}%` }}
                                        />
                                        <input
                                            type="range" min="0.001" max={max} step="0.01"
                                            value={val}
                                            onChange={(e) => onPresetChange({
                                                ...currentPreset,
                                                audio: { ...currentPreset.audio, [param]: parseFloat(e.target.value) }
                                            })}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-slider-vertical"
                                            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                                        />
                                    </div>
                                    <span className="text-[5px] text-zinc-500 font-bold uppercase">{param[0]}</span>
                                </div>
                            )
                        })}
                     </div>
                 </div>
            </div>

            {/* MODULE 5: GLOBAL (Master) - Increased to 2 Cols, includes Scales */}
            <div className="col-span-2 p-2 flex flex-col justify-between">
                 <div className="text-[9px] font-black uppercase tracking-widest font-mono text-teal-400 mb-1 border-b border-zinc-800 pb-1 flex items-center gap-1">
                    <Globe size={10} />
                    <span>GLOBAL</span>
                 </div>
                 
                 <div className="flex gap-2 h-full items-center">
                     {/* Left: Key/Scale */}
                     <div className="flex-1 flex flex-col justify-center gap-1 border-r border-zinc-800 pr-2">
                        <div className="space-y-0.5">
                            <label className="text-[6px] text-zinc-500 font-bold uppercase">Root</label>
                            <select 
                                value={rootNote} 
                                onChange={(e) => setRootNote(parseInt(e.target.value))}
                                className="w-full bg-black text-[8px] font-bold text-teal-500 border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none"
                            >
                                {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((n, i) => <option key={n} value={i}>{n}</option>)}
                            </select>
                        </div>
                        <div className="space-y-0.5">
                            <label className="text-[6px] text-zinc-500 font-bold uppercase">Scale</label>
                            <select 
                                value={selectedScale} 
                                onChange={(e) => setSelectedScale(e.target.value as any)}
                                className="w-full bg-black text-[8px] font-bold text-teal-500 border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none"
                            >
                                {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                     </div>
                     
                     {/* Right: Octave & Vol */}
                     <div className="flex gap-2 items-center justify-end flex-1 h-full">
                         <div className="flex flex-col items-center gap-0.5">
                             <button onClick={() => onOctaveChange(octave + 1)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-0.5 rounded-sm"><ChevronUp size={10} /></button>
                             <div className="text-center font-mono text-[10px] font-bold text-teal-400 w-5 bg-black rounded-sm border border-zinc-800">{octave > 0 ? `+${octave}` : octave}</div>
                             <button onClick={() => onOctaveChange(octave - 1)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-0.5 rounded-sm"><ChevronDown size={10} /></button>
                             <div className="text-[6px] text-zinc-500 uppercase font-bold tracking-wider">OCT</div>
                         </div>
                         
                         <div className="flex flex-col items-center gap-0.5 flex-1 items-center justify-center">
                             <VolumeSlider value={synthVolume} onChange={onSynthVolumeChange} vertical />
                             <div className="text-[6px] text-zinc-500 uppercase font-bold tracking-wider">VOL</div>
                         </div>
                     </div>
                 </div>
            </div>
          </div>

          {/* Bottom Keys Row - Hardware Style */}
          <div className="border-t-4 border-zinc-800 bg-zinc-900 p-1 relative shadow-inner">
               {/* 48 Keys (4 Octaves) */}
               <div className="flex h-20 gap-px relative pt-3 pb-1 px-1 bg-zinc-950 rounded-sm border border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                     {/* White Keys */}
                     {whiteKeys.map((semitone) => {
                         const isActive = activeMouseNote === semitone;
                         const keyFreq = 65.41 * Math.pow(2, semitone / 12); // C2
                         const isSelected = Math.abs(currentPreset.audio.baseFreq - keyFreq) < 2; 
                         const isGlowing = isSelected && isSounding;

                         return (
                            <button
                                key={semitone}
                                onMouseDown={() => {
                                    const quantized = quantizeNote(semitone);
                                    setActiveMouseNote(semitone);
                                    const freq = 65.41 * Math.pow(2, quantized / 12);
                                    onNotePlay(freq);
                                }}
                                onMouseEnter={(e) => {
                                    if (e.buttons === 1) {
                                        const quantized = quantizeNote(semitone);
                                        setActiveMouseNote(semitone);
                                        const freq = 65.41 * Math.pow(2, quantized / 12);
                                        onNotePlay(freq);
                                    }
                                }}
                                className={`
                                    flex-1 rounded-b-sm relative active:bg-teal-400 transition-colors shadow-sm
                                    ${isActive ? 'bg-teal-400' : 'bg-[#f0f0f0]'}
                                    ${isGlowing ? 'shadow-[0_0_15px_rgba(45,212,191,0.8)] bg-teal-100 z-10' : ''}
                                `}
                            />
                         );
                     })}
                     
                     {/* Black Keys */}
                     {blackKeys.map((semitone) => {
                         const whiteKeysBefore = Array.from({ length: semitone }).filter((_, n) => [0, 2, 4, 5, 7, 9, 11].includes(n % 12)).length;
                         // Calculate position based on percentage of white key width
                         // width per white key in % = 100 / numWhiteKeys
                         const keyWidthPct = 100 / numWhiteKeys;
                         const blackKeyWidthPct = 2.0; // Slightly narrower for higher density
                         const leftPos = (whiteKeysBefore * keyWidthPct) - (blackKeyWidthPct / 2);
                         
                         const isActive = activeMouseNote === semitone;
                         const keyFreq = 65.41 * Math.pow(2, semitone / 12);
                         const isSelected = Math.abs(currentPreset.audio.baseFreq - keyFreq) < 2;
                         const isGlowing = isSelected && isSounding;

                         return (
                            <button 
                                key={semitone}
                                onMouseDown={() => {
                                    const quantized = quantizeNote(semitone);
                                    setActiveMouseNote(semitone);
                                    const freq = 65.41 * Math.pow(2, quantized / 12);
                                    onNotePlay(freq);
                                }}
                                onMouseEnter={(e) => {
                                    if (e.buttons === 1) {
                                        const quantized = quantizeNote(semitone);
                                        setActiveMouseNote(semitone);
                                        const freq = 65.41 * Math.pow(2, quantized / 12);
                                        onNotePlay(freq);
                                    }
                                }}
                                style={{ left: `${leftPos}%`, width: `${blackKeyWidthPct}%` }}
                                className={`
                                    absolute top-3 h-3/5 rounded-b-sm z-20 hover:bg-zinc-700 active:bg-teal-600 border-x border-b border-zinc-700 shadow-md
                                    ${isActive ? 'bg-teal-500' : 'bg-[#1a1a1a]'}
                                    ${isGlowing ? 'shadow-[0_0_15px_rgba(45,212,191,0.8)] border-teal-400 bg-teal-900' : ''}
                                `} 
                            />
                         );
                     })}
               </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UIOverlay;
