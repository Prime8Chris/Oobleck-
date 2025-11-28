import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GatePatternName, GateDivision, DrumKit } from '../types';
import { DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET, CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET, GATE_PATTERNS, DRUM_KITS, GATE_DIVISIONS } from '../constants';
import { Zap, Volume2, Loader2, Disc, Square, ChevronUp, ChevronDown, Waves, Activity, Wind, Church, Sparkles, ZapOff, Spline, Music2, Sliders, Heart, FolderHeart, Trash2, Drum, Grid3X3, Play, RotateCcw, VolumeX, Volume, Camera, MousePointer2, Scissors, ArrowUp, Wand2, Cpu, Radio, Globe } from 'lucide-react';
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

// Updated Vibrant OOBLECK Logo SVG
const OobleckLogo = ({ onClick }: { onClick: () => void }) => (
  <div 
    className="cursor-pointer relative group w-52 h-52 md:w-64 md:h-64 select-none z-20" 
    onClick={onClick}
    role="button"
    aria-label="Randomize (Chaos Mode)"
  >
    <svg viewBox="0 0 300 240" className="w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-visible">
       <defs>
         <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
         </linearGradient>
         <linearGradient id="textFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
         </linearGradient>
         <filter id="hardGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
         </filter>
       </defs>
       
       {/* Background Splatter Layer */}
       <path d="M150,20 Q230,-10 260,60 Q290,130 220,180 Q150,230 80,180 Q10,130 40,60 Q70,-10 150,20 Z" 
             fill="#1e1b4b" transform="translate(10,10)" />
       <path d="M150,20 Q230,-10 260,60 Q290,130 220,180 Q150,230 80,180 Q10,130 40,60 Q70,-10 150,20 Z" 
             fill="url(#bodyGrad)" stroke="black" strokeWidth="8" />
             
       {/* Inner Goo Detail */}
       <path d="M100,50 Q150,40 200,60 Q230,100 200,140 Q150,160 100,140 Q70,100 100,50 Z" 
             fill="#86efac" opacity="0.5" />

       {/* Text Layer */}
       <g transform="translate(150,110) rotate(-4)">
          {/* Deep Shadow */}
          <text x="6" y="6" textAnchor="middle" fontSize="76" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="#312e81" stroke="#312e81" strokeWidth="20" letterSpacing="-4">OOBLECK</text>
          
          {/* Thick Outline */}
          <text x="0" y="0" textAnchor="middle" fontSize="76" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="black" stroke="black" strokeWidth="20" letterSpacing="-4">OOBLECK</text>
          
          {/* Inner Fill Outline */}
          <text x="0" y="0" textAnchor="middle" fontSize="76" fontFamily="Arial Black, sans-serif" fontWeight="900"
                fill="url(#textFill)" stroke="white" strokeWidth="4" letterSpacing="-4" paintOrder="stroke">OOBLECK</text>
          
          {/* Highlight / Gloss */}
          <path d="M-130,-30 Q0,-50 130,-30" stroke="white" strokeWidth="8" fill="none" opacity="0.4" strokeLinecap="round" />
       </g>

       {/* Dynamic Elements */}
       {/* Drip 1 */}
       <path d="M80,160 Q85,190 80,210" stroke="#22c55e" strokeWidth="8" fill="none" strokeLinecap="round" />
       <circle cx="80" cy="218" r="5" fill="#22c55e" />
       
       {/* Drip 2 */}
       <path d="M220,150 Q215,180 220,200" stroke="#22c55e" strokeWidth="6" fill="none" strokeLinecap="round" />

       {/* Zaps */}
       <path d="M260,30 L280,10 L270,50 L290,30" stroke="#fde047" strokeWidth="4" fill="none" filter="url(#hardGlow)">
          <animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite" />
       </path>
       <path d="M20,160 L10,190 L30,180" stroke="#fde047" strokeWidth="4" fill="none" filter="url(#hardGlow)">
          <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite" />
       </path>

       {/* Banner */}
       <g transform="translate(150,165) rotate(2)">
           <rect x="-110" y="-12" width="220" height="24" fill="black" transform="skewX(-20)" />
           <rect x="-110" y="-12" width="220" height="24" fill="none" stroke="#2dd4bf" strokeWidth="2" transform="skewX(-20)" />
           <text x="0" y="5" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="bold" fill="#2dd4bf" letterSpacing="1">FLUID SYNTHESIZER</text>
       </g>

    </svg>
    
    <div className="absolute inset-0 rounded-full bg-green-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  </div>
);

const UIOverlay: React.FC<Props> = ({ 
  currentPreset, onPresetChange, playState, setPlayState, 
  onGenerateStart, isRecording, onToggleRecord, octave, onOctaveChange,
  fxState, onToggleFx, onNotePlay, arpSettings, onArpChange, onScaleFrequenciesChange,
  drumSettings, onDrumChange, currentStep, gateSettings, onGateChange,
  synthVolume, onSynthVolumeChange,
  favorites, onSaveFavorite, onDeleteFavorite,
  isCameraActive, onToggleCamera, isSounding, onRandomize,
  crossFader, onCrossFaderChange, onRevertPreset
}) => {
  const [activeMouseNote, setActiveMouseNote] = useState<number | null>(null);
  const [hasRandomized, setHasRandomized] = useState(false);
  const [hasReverted, setHasReverted] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleKeyDown = (e: any) => {
    // Only trigger if not typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (e.repeat) return;
    
    // Spacebar Randomize
    if (e.code === 'Space') {
        e.preventDefault();
        onRandomize();
        setHasRandomized(true);
        return;
    }

    if (e.key === 'Escape') {
        onRevertPreset();
        setHasReverted(true);
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

    // Presets 1-0
    const key = e.key;
    const PRESET_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const pIdx = PRESET_KEYS.indexOf(key);
    
    if (pIdx >= 0) {
        // Switch Preset
        const PRESETS_LIST = [
            DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET,
            CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET
        ];
        if (PRESETS_LIST[pIdx]) {
            onPresetChange(PRESETS_LIST[pIdx]);
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
  };

  const handleKeyUp = () => {
      setActiveMouseNote(null);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown]); 

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
      
      {/* Floating Hints */}
      {!hasRandomized && (
         <div className="fixed top-24 left-1/2 -translate-x-1/2 animate-bounce flex flex-col items-center gap-2 opacity-80 z-50">
             <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20 text-teal-300 font-mono text-sm flex items-center gap-2">
                 <span className="border border-teal-300/50 rounded px-1 text-xs">SPACE</span>
                 <span>to Randomize</span>
             </div>
             <ChevronDown className="text-teal-300" />
         </div>
      )}

      {hasRandomized && !hasReverted && (
           <div className="fixed top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-80 z-50 pointer-events-none">
             <div className="bg-black/80 backdrop-blur px-4 py-2 rounded-lg border border-white/20 text-white font-mono text-xs flex items-center gap-4 shadow-xl">
                 <div className="flex items-center gap-2">
                     <span className="border border-white/40 rounded px-1.5 py-0.5 bg-white/10">SPACE</span>
                     <span className="text-gray-300">New Sound</span>
                 </div>
                 <div className="w-px h-4 bg-white/20"></div>
                 <div className="flex items-center gap-2">
                     <span className="border border-white/40 rounded px-1.5 py-0.5 bg-white/10">ESC</span>
                     <span className="text-gray-300">Go Back</span>
                 </div>
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
                      flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all w-full justify-center
                      ${isCameraActive 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                          : 'bg-white/10 text-gray-300 border border-white/10 hover:bg-white/20'}
                  `}
              >
                  <Camera size={16} />
                  {isCameraActive ? 'CAMERA ON' : 'CAMERA OFF'}
              </button>
              {!isCameraActive && !hasRandomized && (
                   <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center animate-bounce pointer-events-none">
                      <ArrowUp size={20} className="text-red-400" />
                  </div>
              )}
          </div>
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

            {/* PRESETS ROW */}
            <div className="flex gap-1 bg-black/60 backdrop-blur p-1 rounded-xl border border-white/10">
                {[
                    { l: '1', n: 'Default' }, { l: '2', n: 'Lava' }, { l: '3', n: 'Mercury' }, { l: '4', n: 'Glorp' }, { l: '5', n: 'Bzzzt' },
                    { l: '6', n: 'Crystal' }, { l: '7', n: 'Void' }, { l: '8', n: 'Cloud' }, { l: '9', n: 'Rust' }, { l: '0', n: 'Neon' }
                ].map((p, idx) => (
                    <button
                        key={p.l}
                        onMouseDown={() => {
                            const PRESETS = [DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET, CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET];
                            onPresetChange(PRESETS[idx]);
                        }}
                        className={`
                            w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-all
                            ${currentPreset.description === [DEFAULT_PRESET, LAVA_PRESET, MERCURY_PRESET, GLORPCORE_PRESET, BZZZZT_PRESET, CRYSTAL_PRESET, VOID_PRESET, ETHEREAL_PRESET, INDUSTRIAL_PRESET, NEON_PRESET][idx].description
                                ? 'bg-teal-500 text-black shadow-lg scale-110' 
                                : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'}
                        `}
                        title={p.n}
                    >
                        {p.l}
                    </button>
                ))}
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
        <div className="w-[98%] max-w-none mx-auto bg-zinc-900 border-4 border-zinc-700 rounded-t-lg shadow-2xl overflow-hidden backdrop-blur-xl relative">
          
          {/* Decorative Texture/Stripes */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-yellow-500 to-teal-500 opacity-80" />
          <div className="absolute top-1 left-0 w-full h-0.5 bg-black/50" />

          {/* Top Control Deck - Responsive 12-Column Grid */}
          <div className="grid grid-cols-12 divide-x-2 divide-zinc-800 bg-zinc-900 h-40">
            
            {/* MODULE 1: CORE (AI + Physics) - 2 Cols */}
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
                 
                 <div className="flex flex-col justify-between h-full pt-1">
                     {/* Genre Grid */}
                     <div className="grid grid-cols-4 gap-0.5 mb-2">
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

                     {/* Step Sequencer Visual */}
                     <div className="flex gap-px h-6 bg-black rounded-sm p-0.5 border border-zinc-700 shadow-inner mb-2">
                         {drumSettings.pattern.map((step, i) => (
                             <div 
                                key={i} 
                                className={`
                                    flex-1 rounded-[1px] transition-all duration-75
                                    ${i === currentStep 
                                        ? 'bg-white shadow-[0_0_8px_white] z-10' 
                                        : (step.kick || step.snare ? 'bg-pink-500/80' : 'bg-zinc-800')}
                                `}
                             />
                         ))}
                     </div>

                     {/* Kit & Mix */}
                     <div className="flex gap-2 items-center justify-between">
                         <select 
                            value={drumSettings.kit} 
                            onChange={(e) => onDrumChange({...drumSettings, kit: e.target.value as DrumKit})}
                            className="bg-black text-pink-500 text-[8px] font-bold uppercase border border-zinc-700 rounded-sm px-1 py-0.5 focus:outline-none w-auto"
                         >
                            {DRUM_KITS.map(kit => <option key={kit} value={kit}>{kit}</option>)}
                         </select>
                         
                         <div className="flex items-center gap-1.5 w-1/2 bg-zinc-800/50 rounded-sm px-1 py-0.5 border border-zinc-700/50 w-20">
                             <span className="text-[7px] font-bold text-pink-500">DRM</span>
                             <input 
                                type="range" min="0" max="1" step="0.01"
                                value={crossFader}
                                onChange={(e) => onCrossFaderChange(parseFloat(e.target.value))}
                                className="flex-1 h-1 bg-black rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-thumb]:rounded-[1px] cursor-ew-resize"
                             />
                             <span className="text-[7px] font-bold text-teal-500">SYN</span>
                         </div>
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

            {/* MODULE 4: SEQUENCE (Arp) - Reduced to 2 Cols, Single Column Flow */}
            <div className="col-span-2 p-2 flex flex-col justify-between">
                 <div className="flex items-center justify-between mb-1 border-b border-zinc-800 pb-1">
                     <div className="flex items-center gap-1 text-yellow-400">
                         <Grid3X3 size={12} />
                         <span className="text-[9px] font-black uppercase tracking-widest font-mono">SEQ</span>
                     </div>
                     <button 
                        onClick={() => onArpChange({...arpSettings, enabled: !arpSettings.enabled})}
                        className={`w-5 h-3 rounded transition-colors border border-black/30 ${arpSettings.enabled ? 'bg-yellow-600 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-zinc-700'}`}
                     >
                         <div className={`w-1.5 h-full bg-white/80 transition-transform ${arpSettings.enabled ? 'translate-x-2' : ''}`} />
                     </button>
                 </div>
                 
                 <div className="flex flex-col gap-1.5 h-full justify-between pt-1">
                     <div className="space-y-1">
                         <div className="flex justify-between items-center">
                            <label className="text-[7px] text-zinc-500 font-bold uppercase w-6">BPM</label>
                            <input 
                                type="range" min="60" max="240" 
                                value={arpSettings.bpm} 
                                onChange={(e) => onArpChange({...arpSettings, bpm: parseInt(e.target.value)})}
                                className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:rounded-[1px] mx-1"
                            />
                            <span className="text-[7px] text-yellow-500 font-mono font-bold w-4 text-right">{arpSettings.bpm}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <label className="text-[7px] text-zinc-500 font-bold uppercase w-6">Step</label>
                            <input 
                                 type="range" min="1" max="16" step="1"
                                 value={arpSettings.steps}
                                 onChange={(e) => onArpChange({...arpSettings, steps: parseInt(e.target.value)})}
                                 className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:rounded-[1px] mx-1"
                             />
                             <span className="text-[7px] text-yellow-500 font-mono font-bold w-4 text-right">{arpSettings.steps}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-1">
                        <select 
                                 value={arpSettings.division}
                                 onChange={(e) => onArpChange({...arpSettings, division: e.target.value as GateDivision})}
                                 className="flex-1 bg-black border border-zinc-700 rounded-sm px-0.5 py-0.5 text-yellow-500 text-[8px] focus:outline-none min-w-0"
                             >
                                 {GATE_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                         </select>
                         <div className="flex gap-0.5">
                             {['UP', 'DWN', 'RND'].map(m => (
                                 <button 
                                    key={m}
                                    onClick={() => onArpChange({...arpSettings, mode: m === 'RND' ? 'RANDOM' : (m === 'DWN' ? 'DOWN' : 'UP') as any})}
                                    className={`px-1 text-[5px] font-bold py-1 rounded-sm uppercase tracking-tighter ${arpSettings.mode.includes(m) || (m==='RND' && arpSettings.mode==='RANDOM') || (m==='DWN' && arpSettings.mode==='DOWN') ? 'bg-yellow-600 text-black' : 'bg-zinc-800 text-zinc-500'}`}
                                 >
                                     {m}
                                 </button>
                             ))}
                        </div>
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
                         
                         <div className="flex flex-col items-center gap-0.5 flex-1 items-center">
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