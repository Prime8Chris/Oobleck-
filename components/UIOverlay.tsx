
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SynthPreset, PlayState, FxState, ArpSettings, DrumSettings, SamplerGenre, GateSettings, GatePatternName, GateDivision, DrumKit, UserPatch, DrumFX, LeaderboardEntry } from '../types';
import { GATE_PATTERNS, DRUM_KITS, DRUM_FX_OPTIONS, GENRE_PRESETS } from '../constants';
import { Loader2, Sparkles, Lock, Unlock, Trophy, Save, RotateCcw, Scissors, Skull, Wand2, Cpu, Drum, Activity, Waves, Power, Disc, Mic, Camera, Sliders, ThumbsUp, Play, Square, Circle, Monitor, Grid, Droplets, Zap, Sunset, Cloud, Radio, Hexagon, Triangle } from 'lucide-react';
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
  
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  showHighScoreInput: boolean;
  onNameSubmit: (name: string) => void;

  // Trigger Signal for Pickup Feedback
  triggerSignal: { index: number, id: number } | null;
  
  // Input Ref for Visuals
  inputRef: React.MutableRefObject<{ 
      x: number; 
      y: number; 
      isClicked: boolean;
  }>;
}

interface TriggerBurst {
    id: number;
    x: number;
    y: number;
    val: number;
    color: string;
}

interface ScoreParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    val: number;
    color: string;
    life: number;
    scale: number;
}

type Theme = 'CYBER' | 'RETRO' | 'AERO' | 'CYBERPUNK' | 'SYNTHWAVE' | 'DREAM' | 'ATOMIC' | 'BRUTALIST' | 'TRON' | 'FUTURE' | 'MIAMI' | 'NEOGRID';

// --- THEME DEFINITIONS ---
const THEMES: Record<Theme, any> = {
    CYBER: {
        container: "font-sans text-gray-200",
        panel: "bg-black/90 backdrop-blur-sm border-2 rounded-lg border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
        panelTitle: "bg-cyan-900 text-cyan-100 border border-black/50 rounded-sm font-black tracking-widest uppercase",
        header: "bg-gradient-to-b from-black/80 to-transparent",
        deck: "bg-zinc-950 border-t-4 border-cyan-600 shadow-[0_-10px_50px_rgba(0,0,0,0.9)]",
        accent: "cyan",
        button: "bg-black border border-gray-800 text-gray-600 hover:border-gray-600 rounded-[2px]",
        buttonActive: "bg-cyan-500 border-cyan-400 text-black shadow-[0_0_8px_rgba(6,182,212,0.8)] rounded-[2px]",
        keyWhite: "bg-gray-200 border-gray-400 hover:bg-white",
        keyWhiteActive: "bg-cyan-200 border-cyan-500",
        keyBlack: "bg-black border-gray-800",
        keyBlackActive: "bg-pink-400 border-pink-600",
        bigButton: "rounded-full border-4 border-cyan-400 bg-cyan-900/20 shadow-[0_0_30px_rgba(34,211,238,0.4)] backdrop-blur-sm",
        fontMain: "font-arcade",
        knobTrack: "bg-[#111] border border-[#333] rounded-full",
        knobFill: "bg-cyan-500 shadow-[0_0_10px_cyan]"
    },
    RETRO: {
        container: "font-mono text-black",
        panel: "bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black shadow-none",
        panelTitle: "bg-blue-800 text-white font-bold px-2",
        header: "bg-[#c0c0c0] border-b-2 border-white shadow-sm h-auto pb-2",
        deck: "bg-[#c0c0c0] border-t-2 border-white shadow-none",
        accent: "blue",
        button: "bg-[#c0c0c0] border-t-white border-l-white border-b-black border-r-black border-2 text-black active:border-t-black active:border-l-black",
        buttonActive: "bg-blue-800 border-t-black border-l-black border-b-white border-r-white border-2 text-white",
        keyWhite: "bg-white border-b-black border-r-black border-l-white border-t-white hover:bg-gray-100",
        keyWhiteActive: "bg-black border-black",
        keyBlack: "bg-black border-b-white border-r-white border-l-black border-t-black",
        keyBlackActive: "bg-red-800 border-red-900",
        bigButton: "border-2 bg-[#c0c0c0] border-t-white border-l-white border-b-black border-r-black group-hover:bg-gray-300",
        fontMain: "font-mono",
        knobTrack: "bg-gray-400 border-inset border-2 border-gray-600 rounded-full",
        knobFill: "bg-blue-800"
    },
    AERO: {
        container: "font-sans text-white",
        panel: "border border-white/40 bg-white/10 backdrop-blur-xl shadow-xl rounded-2xl",
        panelTitle: "bg-white/20 text-white font-bold px-3 rounded-full border border-white/20 shadow-sm backdrop-blur-md",
        header: "bg-white/10 backdrop-blur-lg border-b border-white/20 rounded-b-3xl mx-4 mt-0 shadow-lg",
        deck: "bg-white/10 border-t border-white/20 backdrop-blur-2xl shadow-[0_-10px_40px_rgba(255,255,255,0.1)] rounded-t-3xl mx-4 mb-0",
        accent: "white",
        button: "bg-white/20 text-white/60 hover:bg-white/40 rounded-full",
        buttonActive: "bg-white text-cyan-600 shadow-md rounded-full",
        keyWhite: "bg-white/80 border-white/50 hover:bg-white shadow-md",
        keyWhiteActive: "bg-cyan-200 border-cyan-400 shadow-inner",
        keyBlack: "bg-black/80 border-black/50 hover:bg-black/60 shadow-lg",
        keyBlackActive: "bg-pink-400/80 border-pink-500",
        bigButton: "rounded-3xl bg-cyan-500/20 backdrop-blur-md border border-white/40 shadow-lg group-hover:bg-cyan-500/40",
        fontMain: "font-sans",
        knobTrack: "bg-white/20 border border-white/10 rounded-full",
        knobFill: "bg-white/80 shadow-[0_0_10px_white]"
    },
    CYBERPUNK: {
        container: "font-sans text-yellow-400",
        panel: "bg-[#1a1a1a] border-2 border-yellow-400 clip-path-polygon shadow-[5px_5px_0px_rgba(250,204,21,0.2)]",
        panelTitle: "bg-yellow-400 text-black font-black uppercase tracking-tighter px-2 transform skew-x-[-10deg]",
        header: "bg-zinc-900 border-b-2 border-yellow-400",
        deck: "bg-[#0a0a0a] border-t-2 border-yellow-400",
        accent: "yellow",
        button: "bg-zinc-800 border border-yellow-400/30 text-yellow-400/50 hover:bg-yellow-400/20",
        buttonActive: "bg-yellow-400 text-black font-black border border-yellow-400",
        keyWhite: "bg-zinc-300 border-zinc-500",
        keyWhiteActive: "bg-yellow-400 border-yellow-600",
        keyBlack: "bg-zinc-800 border-zinc-900",
        keyBlackActive: "bg-red-500 border-red-700",
        bigButton: "bg-yellow-400 text-black border-2 border-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all rounded-none",
        fontMain: "font-sans",
        knobTrack: "bg-zinc-800 border border-yellow-400/50 rounded-full",
        knobFill: "bg-yellow-400"
    },
    SYNTHWAVE: {
        container: "font-arcade text-pink-300",
        panel: "bg-[#240046]/80 border border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)] rounded-lg",
        panelTitle: "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 font-bold italic",
        header: "bg-gradient-to-b from-[#240046] to-transparent",
        deck: "bg-[#180030] border-t border-pink-500 shadow-[0_-5px_20px_rgba(236,72,153,0.3)]",
        accent: "pink",
        button: "bg-purple-900/50 border border-purple-500/50 text-purple-300 hover:bg-purple-800",
        buttonActive: "bg-pink-500 text-white border border-pink-400 shadow-[0_0_10px_#ec4899]",
        keyWhite: "bg-purple-200 border-purple-400 hover:bg-white",
        keyWhiteActive: "bg-pink-200 border-pink-400 shadow-[0_0_15px_pink]",
        keyBlack: "bg-[#1a0b2e] border-purple-900",
        keyBlackActive: "bg-cyan-500 border-cyan-400 shadow-[0_0_15px_cyan]",
        bigButton: "rounded-full border-2 border-pink-500 bg-black shadow-[0_0_20px_inset_rgba(236,72,153,0.5)] hover:shadow-[0_0_30px_rgba(236,72,153,0.8)]",
        fontMain: "font-arcade",
        knobTrack: "bg-[#0f0518] border border-pink-500/30 rounded-full",
        knobFill: "bg-gradient-to-r from-cyan-500 to-pink-500"
    },
    DREAM: {
        container: "font-sans text-slate-600",
        panel: "bg-white/80 border border-white shadow-xl rounded-[2rem]",
        panelTitle: "bg-white text-sky-500 font-black px-4 py-1 rounded-full shadow-sm text-xs tracking-wider",
        header: "bg-white/70 backdrop-blur-xl border-b border-white/50 rounded-b-[3rem] mx-2 shadow-sm",
        deck: "bg-white/70 backdrop-blur-xl border-t border-white/50 rounded-t-[3rem] mx-2 shadow-lg",
        accent: "sky",
        button: "bg-white border border-sky-100 text-sky-300 hover:text-sky-500 rounded-xl shadow-sm",
        buttonActive: "bg-sky-400 text-white rounded-xl shadow-[0_4px_12px_rgba(56,189,248,0.4)] transform scale-105",
        keyWhite: "bg-white border-slate-100 shadow-sm rounded-b-lg",
        keyWhiteActive: "bg-sky-200 border-sky-300",
        keyBlack: "bg-slate-700 border-slate-800 rounded-b-lg",
        keyBlackActive: "bg-indigo-400 border-indigo-500",
        bigButton: "bg-gradient-to-br from-white to-sky-50 border border-white shadow-[8px_8px_16px_rgba(56,189,248,0.15),-4px_-4px_12px_white] rounded-2xl hover:scale-105 transition-transform",
        fontMain: "font-sans",
        knobTrack: "bg-slate-100 rounded-full",
        knobFill: "bg-sky-400 rounded-full"
    },
    ATOMIC: {
        container: "font-mono text-teal-900",
        panel: "bg-[#f4f1ea] border-2 border-teal-700 rounded-lg shadow-[4px_4px_0px_#0f766e]",
        panelTitle: "bg-teal-700 text-[#fdfbf7] px-2 font-bold tracking-widest border border-teal-900",
        header: "bg-[#f0ece2] border-b-2 border-teal-700",
        deck: "bg-[#e8e4d8] border-t-2 border-teal-700",
        accent: "teal",
        button: "bg-[#e8e4d8] border border-teal-700/30 text-teal-800/60 hover:bg-teal-700/10 rounded-sm",
        buttonActive: "bg-red-500 text-white border-2 border-red-700 rounded-full",
        keyWhite: "bg-[#fdfbf7] border-teal-900/20",
        keyWhiteActive: "bg-teal-200 border-teal-700",
        keyBlack: "bg-teal-900 border-black",
        keyBlackActive: "bg-orange-500 border-orange-700",
        bigButton: "bg-[#fdfbf7] border-4 border-teal-700 rounded-full shadow-[6px_6px_0px_rgba(13,148,136,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all",
        fontMain: "font-mono",
        knobTrack: "bg-[#d6d3c9] border border-teal-700 rounded-full",
        knobFill: "bg-red-500"
    },
    BRUTALIST: {
        container: "font-mono text-black",
        panel: "bg-white border-4 border-black shadow-[8px_8px_0px_black] rounded-none",
        panelTitle: "bg-black text-white px-2 uppercase font-bold tracking-tighter transform -translate-y-4 border-2 border-white inline-block",
        header: "bg-white border-b-4 border-black",
        deck: "bg-white border-t-4 border-black",
        accent: "black",
        button: "bg-white border-2 border-black hover:bg-black hover:text-white transition-none rounded-none font-bold uppercase",
        buttonActive: "bg-black text-white border-2 border-black transition-none rounded-none",
        keyWhite: "bg-white border-2 border-black hover:bg-gray-200",
        keyWhiteActive: "bg-black border-2 border-black",
        keyBlack: "bg-black border-2 border-white",
        keyBlackActive: "bg-white border-4 border-black",
        bigButton: "bg-white border-4 border-black hover:bg-black hover:text-white rounded-none shadow-[6px_6px_0px_black] transition-none active:translate-x-1 active:translate-y-1 active:shadow-none",
        fontMain: "font-mono",
        knobTrack: "bg-white border-2 border-black rounded-full",
        knobFill: "bg-black"
    },
    TRON: {
        container: "font-arcade text-cyan-400",
        panel: "bg-black/90 border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4),inset_0_0_20px_rgba(6,182,212,0.1)] rounded-none",
        panelTitle: "text-cyan-400 bg-black border border-cyan-500 px-2 tracking-[0.2em] uppercase text-xs shadow-[0_0_10px_cyan]",
        header: "bg-black/80 border-b border-cyan-500/50 shadow-[0_0_20px_cyan]",
        deck: "bg-black/90 border-t border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]",
        accent: "cyan",
        button: "bg-black border border-cyan-500/30 text-cyan-500/50 hover:bg-cyan-900/30 hover:text-cyan-400 hover:border-cyan-400",
        buttonActive: "bg-cyan-500/20 text-cyan-100 border border-cyan-400 shadow-[0_0_10px_cyan]",
        keyWhite: "bg-black border border-cyan-800 hover:bg-cyan-900/30",
        keyWhiteActive: "bg-cyan-400 border border-cyan-200 shadow-[0_0_20px_cyan]",
        keyBlack: "bg-black border border-orange-800",
        keyBlackActive: "bg-orange-500 border border-orange-400 shadow-[0_0_20px_orange]",
        bigButton: "rounded-full bg-black border-2 border-cyan-500 shadow-[0_0_15px_cyan,inset_0_0_15px_cyan] hover:bg-cyan-900/40",
        fontMain: "font-arcade",
        knobTrack: "bg-[#050505] border border-cyan-900 rounded-full",
        knobFill: "bg-cyan-400 shadow-[0_0_10px_cyan]"
    },
    FUTURE: {
        container: "font-sans text-slate-800",
        panel: "bg-slate-50/80 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.5)]",
        panelTitle: "bg-slate-800 text-white px-3 py-0.5 rounded-full text-[9px] tracking-[0.2em] font-bold uppercase",
        header: "bg-slate-100/60 backdrop-blur-2xl border-b border-white/20 mx-4 mt-2 rounded-2xl shadow-sm",
        deck: "bg-slate-100/60 backdrop-blur-2xl border-t border-white/20 mx-4 mb-2 rounded-2xl shadow-lg",
        accent: "indigo",
        button: "bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-all duration-300",
        buttonActive: "bg-indigo-600 text-white shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] rounded-lg transform scale-[1.02]",
        keyWhite: "bg-white border-slate-100 rounded-b-xl shadow-sm hover:shadow-md transition-all",
        keyWhiteActive: "bg-indigo-50 border-indigo-200 shadow-inner",
        keyBlack: "bg-slate-800 border-slate-900 rounded-b-lg shadow-lg",
        keyBlackActive: "bg-indigo-500 border-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]",
        bigButton: "bg-white border border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1),inset_0_-4px_0_0_rgba(0,0,0,0.05)] rounded-[24px] hover:-translate-y-1 transition-transform",
        fontMain: "font-sans",
        knobTrack: "bg-slate-200 rounded-full",
        knobFill: "bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.4)]"
    },
    MIAMI: {
        container: "font-sans text-pink-500",
        panel: "bg-[#fffef0] border-2 border-pink-500 shadow-[6px_6px_0px_#2dd4bf]",
        panelTitle: "bg-pink-500 text-white px-3 -skew-x-12 font-black uppercase text-xs tracking-wide shadow-[2px_2px_0px_#2dd4bf]",
        header: "bg-gradient-to-r from-pink-500/10 to-teal-400/10 border-b-2 border-pink-400",
        deck: "bg-[#fffef0]/90 border-t-2 border-teal-400 shadow-[0_-10px_0px_rgba(45,212,191,0.1)]",
        accent: "pink",
        button: "bg-white border-2 border-pink-200 text-pink-300 hover:border-pink-500 hover:text-pink-500 rounded-none",
        buttonActive: "bg-teal-400 text-white border-2 border-teal-500 shadow-[4px_4px_0px_#f472b6] transform -translate-y-0.5",
        keyWhite: "bg-white border-b-4 border-pink-200 hover:bg-pink-50",
        keyWhiteActive: "bg-pink-400 border-pink-600",
        keyBlack: "bg-teal-900 border-b-4 border-teal-700",
        keyBlackActive: "bg-yellow-400 border-yellow-600",
        bigButton: "bg-gradient-to-tr from-yellow-300 to-pink-500 text-white border-4 border-white shadow-[6px_6px_0px_#2dd4bf] rounded-full hover:rotate-3 transition-transform",
        fontMain: "font-sans",
        knobTrack: "bg-pink-100 border-2 border-pink-300 rounded-full",
        knobFill: "bg-teal-400 border-r-2 border-teal-600"
    },
    NEOGRID: {
        container: "font-arcade text-cyan-400",
        panel: "bg-black/80 border-2 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] rounded-lg",
        panelTitle: "bg-pink-600 text-white border border-pink-400 px-2 uppercase text-xs shadow-[0_0_10px_#ec4899] font-bold tracking-widest",
        header: "bg-black/90 border-b-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]",
        deck: "bg-black/90 border-t-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]",
        accent: "purple",
        button: "bg-black border border-cyan-500/40 text-cyan-500/60 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20",
        buttonActive: "bg-cyan-500 text-black border border-cyan-300 shadow-[0_0_15px_cyan]",
        keyWhite: "bg-white border border-gray-400 hover:bg-gray-100",
        keyWhiteActive: "bg-pink-500 border-pink-600 shadow-[0_0_20px_pink]",
        keyBlack: "bg-purple-900 border border-purple-700",
        keyBlackActive: "bg-cyan-400 border-cyan-300 shadow-[0_0_20px_cyan]",
        bigButton: "rounded-lg border-2 border-purple-500 bg-black shadow-[0_0_15px_purple,inset_0_0_10px_purple] hover:bg-purple-900/30 text-purple-400 hover:text-purple-200",
        fontMain: "font-arcade",
        knobTrack: "bg-black border border-purple-500/50 rounded-full",
        knobFill: "bg-gradient-to-t from-cyan-500 to-pink-500 shadow-[0_0_10px_pink]"
    }
};

// --- STYLED COMPONENTS ---

const Panel: React.FC<{ children: React.ReactNode, title?: React.ReactNode, className?: string, theme: Theme }> = ({ children, title, className = "", theme }) => {
    const s = THEMES[theme];
    // Dynamic padding adjustment for NEOGRID
    const padding = theme === 'NEOGRID' ? 'p-1.5' : 'p-2';
    
    return (
        <div className={`relative flex flex-col ${padding} ${s.panel} ${className}`}>
            {title && (
                <div className={`absolute -top-2.5 left-2 px-1.5 text-[9px] ${s.panelTitle}`}>
                    {title}
                </div>
            )}
            {children}
        </div>
    );
};

const Knob: React.FC<{
    value: number;
    min?: number;
    max?: number;
    onChange: (val: number) => void;
    size?: number;
    theme: Theme;
    className?: string;
}> = ({ value, min = 0, max = 1, onChange, size = 32, theme, className = "" }) => {
    const s = THEMES[theme];
    const [dragging, setDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startVal, setStartVal] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        setStartY(e.clientY);
        setStartVal(value);
    };

    useEffect(() => {
        if (!dragging) return;
        const handleMove = (e: MouseEvent) => {
            const dy = startY - e.clientY;
            const range = 200; // pixels for full range
            const diff = (dy / range) * (max - min);
            let newVal = startVal + diff;
            newVal = Math.max(min, Math.min(max, newVal));
            onChange(newVal);
        };
        const handleUp = () => setDragging(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [dragging, startY, startVal, min, max, onChange]);

    // Calculate rotation: -135deg (min) to +135deg (max)
    const percentage = (value - min) / (max - min);
    const angle = -135 + (percentage * 270);

    return (
        <div 
            className={`relative rounded-full cursor-ns-resize ${s.knobTrack} ${className}`} 
            style={{ width: size, height: size }}
            onMouseDown={handleMouseDown}
        >
            <div 
                className={`absolute top-0 left-0 w-full h-full rounded-full transition-transform duration-75 ease-out`} 
                style={{ transform: `rotate(${angle}deg)` }}
            >
                <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-[15%] h-[30%] rounded-full ${s.knobFill}`} />
            </div>
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
             <div className="absolute -translate-x-1/2 -translate-y-full font-black text-2xl font-arcade animate-[float-up_0.8s_ease-out_forwards] stroke-black"
                  style={{ color: burst.color, textShadow: `2px 2px 0px black, 0 0 10px ${burst.color}` }}>
                  +{burst.val}
             </div>
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
  score, scorePopups,
  leaderboard, showHighScoreInput, onNameSubmit,
  triggerSignal, inputRef
}) => {
  const [activeMouseNote, setActiveMouseNote] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [highScoreName, setHighScoreName] = useState('');
  const [bursts, setBursts] = useState<TriggerBurst[]>([]);
  const [theme, setTheme] = useState<Theme>('CYBER');
  const [activeTriggerIndex, setActiveTriggerIndex] = useState<number | null>(null);

  // Refs for Trigger Buttons to calculate position for feedback
  const chopRef = useRef<HTMLButtonElement>(null);
  const growlRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const chaosRef = useRef<HTMLButtonElement>(null);
  
  // Refs for Score Particle System
  const scoreRef = useRef<HTMLDivElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ScoreParticle[]>([]);
  const requestRef = useRef<number | null>(null);

  const s = THEMES[theme];

  // Keyboard Logic kept from original
  const NOTE_MAP: Record<string, number> = {
    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
    ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16
  };
  const SCALES = { 'Chromatic': [0,1,2,3,4,5,6,7,8,9,10,11], 'Major': [0,2,4,5,7,9,11], 'Minor': [0,2,3,5,7,8,10], 'Pentatonic': [0,3,5,7,10] };
  const [selectedScale, setSelectedScale] = useState<keyof typeof SCALES>('Chromatic');
  const [rootNote, setRootNote] = useState(0); 
  
  // --- SCORE PARTICLE SYSTEM ---
  useEffect(() => {
    const animateParticles = () => {
        const canvas = particleCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let tx = canvas.width - 100; 
        let ty = 100;
        if (scoreRef.current) {
            const rect = scoreRef.current.getBoundingClientRect();
            tx = rect.left + rect.width / 2;
            ty = rect.top + rect.height / 2;
        }

        if (isSounding && inputRef.current.x > -100) {
            if (Math.random() > 0.6) {
                const colors = ['#67e8f9', '#f472b6', '#facc15', '#a855f7'];
                const p: ScoreParticle = {
                    x: inputRef.current.x,
                    y: inputRef.current.y,
                    vx: (Math.random() - 0.5) * 8, 
                    vy: (Math.random() - 0.5) * 8,
                    val: Math.ceil(Math.random() * 9),
                    color: colors[Math.floor(Math.random() * colors.length)],
                    life: 1.0,
                    scale: 0.5
                };
                particlesRef.current.push(p);
            }
        }

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            const dx = tx - p.x;
            const dy = ty - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            p.vx += dx * 0.005; 
            p.vy += dy * 0.005;
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.life > 0.8) {
                p.scale += 0.1;
                if(p.scale > 1.5) p.scale = 1.5;
            } else {
                p.scale *= 0.95;
            }
            
            p.life -= 0.01;

            if (p.life <= 0 || dist < 20) {
                particlesRef.current.splice(i, 1);
            } else {
                ctx.font = `900 ${Math.floor(14 * p.scale)}px "Orbitron"`;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                ctx.fillText(p.val.toString(), p.x, p.y);
            }
        }
        
        requestRef.current = requestAnimationFrame(animateParticles);
    };

    requestRef.current = requestAnimationFrame(animateParticles);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isSounding]);


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
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          clientX = rect.left + rect.width / 2;
          clientY = rect.top + rect.height / 2;
      }

      const id = Date.now() + Math.random();
      setBursts(prev => [...prev, { id, x: clientX, y: clientY, val, color }]);
      setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 800);
  }, []);

  useEffect(() => {
      if (triggerSignal) {
          const { index } = triggerSignal;
          
          // Set visual button trigger
          setActiveTriggerIndex(index);
          const timer = setTimeout(() => setActiveTriggerIndex(null), 300);

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
          return () => clearTimeout(timer);
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
  
  return (
    <div className={`absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden select-none ${s.container}`}>
      
      {/* Scanline Overlay (Conditional) */}
      <style>{`
        .arcade-scanlines {
            background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
            background-size: 100% 4px;
            pointer-events: none;
            position: absolute; inset: 0; z-index: 50; opacity: 0.5;
        }
        .synthwave-grid {
             background-image:
                linear-gradient(rgba(236, 72, 153, 0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(236, 72, 153, 0.4) 1px, transparent 1px);
             background-size: 40px 40px;
             perspective: 200px;
             transform-style: preserve-3d;
             position: absolute; bottom: 0; width: 100%; height: 50%; z-index: -1;
             mask-image: linear-gradient(to bottom, transparent, black);
        }
        .atomic-pattern {
             background-image: radial-gradient(#0d9488 15%, transparent 16%), radial-gradient(#0d9488 15%, transparent 16%);
             background-size: 20px 20px;
             background-position: 0 0, 10px 10px;
             opacity: 0.15;
             position: absolute; inset: 0; z-index: -1;
        }
        .brutalist-grid {
            background-image: linear-gradient(black 2px, transparent 2px), linear-gradient(90deg, black 2px, transparent 2px);
            background-size: 100px 100px;
            opacity: 0.1;
            position: absolute; inset: 0; z-index: -1;
        }
        .tron-grid {
            background-image: linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px);
            background-size: 40px 40px;
            position: absolute; bottom: 0; width: 100%; height: 60%; z-index: -1;
            transform: perspective(300px) rotateX(45deg) translateY(0);
            mask-image: linear-gradient(to bottom, transparent, black);
        }
        .miami-gradient {
            background: linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(45,212,191,0.1) 100%);
            position: absolute; inset: 0; z-index: -1;
        }
        .future-mesh {
            background-image: radial-gradient(circle at 1px 1px, rgba(99,102,241,0.15) 1px, transparent 0);
            background-size: 20px 20px;
            position: absolute; inset: 0; z-index: -1;
        }
        .neogrid-pattern {
             background-image:
                linear-gradient(rgba(168, 85, 247, 0.2) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.2) 1px, transparent 1px);
             background-size: 30px 30px;
             position: absolute; inset: 0; z-index: -1;
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
        .clip-path-polygon { clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
      `}</style>
      
      {theme === 'CYBER' && <div className="arcade-scanlines"></div>}
      {theme === 'SYNTHWAVE' && <div className="synthwave-grid"></div>}
      {theme === 'ATOMIC' && <div className="atomic-pattern"></div>}
      {theme === 'BRUTALIST' && <div className="brutalist-grid"></div>}
      {theme === 'TRON' && <div className="tron-grid"></div>}
      {theme === 'MIAMI' && <div className="miami-gradient"></div>}
      {theme === 'FUTURE' && <div className="future-mesh"></div>}
      {theme === 'NEOGRID' && <div className="neogrid-pattern"></div>}
      {theme === 'AERO' && <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-pink-500/10 pointer-events-none z-[-1]" />}

      {/* --- CANVAS PARTICLE LAYER --- */}
      <canvas ref={particleCanvasRef} className="absolute inset-0 pointer-events-none z-[100]" />

      {/* --- BURST OVERLAY --- */}
      {bursts.map(b => <BurstDisplay key={b.id} burst={b} />)}

      {/* --- RIGHT SIDEBAR (SCORE, FX, PRESETS) --- */}
      <div className={`absolute top-24 right-4 flex flex-col ${theme === 'NEOGRID' ? 'gap-2' : 'gap-4'} items-end w-44 pointer-events-auto z-50`}>
           {/* Score Module */}
           <div ref={scoreRef} className={`relative w-full p-2 ${s.panel}`}>
                <div className="flex flex-col items-end">
                    <span className={`text-[8px] font-bold uppercase tracking-widest mb-1 opacity-70`}>SCORE</span>
                    <span className={`text-xl ${s.fontMain}`}>{score.toLocaleString().padStart(6, '0')}</span>
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
               <div className={`w-full p-2 ${s.panel}`}>
                   <div className={`text-[8px] font-bold uppercase tracking-widest mb-1 pb-1 border-b border-current opacity-60`}>TOP PLAYERS</div>
                   <div className="flex flex-col gap-0.5">
                       {leaderboard.map((entry, i) => (
                           <div key={i} className="flex justify-between items-center text-[9px] font-mono">
                               <span className="opacity-80">{i+1}. {entry.name}</span>
                               <span className="font-bold">{entry.score.toLocaleString()}</span>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {/* Spacer */}
           <div className={`${theme === 'NEOGRID' ? 'h-2' : 'h-8'}`}></div>

           {/* FX Rack */}
           <Panel className="w-full" title="FX UNIT" theme={theme}>
                <div className="grid grid-cols-2 gap-1">
                   {['delay','reverb','chorus','distortion','phaser','crunch'].map(fx => (
                       <button 
                          key={fx} 
                          onClick={(e) => { 
                              onToggleFx(fx as keyof FxState);
                              if (!fxState[fx as keyof FxState]) triggerFeedback(e, 50, '#ec4899'); 
                          }}
                          className={`text-[8px] font-bold uppercase transition-all px-1 py-0.5 ${fxState[fx as keyof FxState] ? s.buttonActive : s.button}`}
                       >
                           {fx.substring(0,4)}
                       </button>
                   ))}
                </div>
           </Panel>

           {/* Presets Grid */}
           <Panel className="w-full" title="PATCHES" theme={theme}>
               <div className="grid grid-cols-5 gap-1">
                    {userPatches.map((p, i) => (
                        <button 
                            key={i}
                            onClick={() => onLoadPatch(p!)}
                            disabled={!p}
                            className={`w-6 h-6 flex items-center justify-center text-[9px] font-bold transition-all ${p ? s.buttonActive : s.button}`}
                        >
                            {i === 9 ? 0 : i + 1}
                        </button>
                    ))}
               </div>
           </Panel>
      </div>

      {/* --- HUD HEADER --- */}
      <div className={`relative flex justify-between items-start pointer-events-auto z-40 p-4 min-h-[140px] ${s.header}`}>
          <div className="flex gap-4 items-start w-1/4">
             {/* Logo */}
             <div className="relative group cursor-pointer" onClick={(e) => { if(!isChaosLocked) { triggerFeedback(e, 250, '#d946ef'); onRandomize(); }}}>
                 <div className={`italic font-black text-3xl tracking-tighter ${s.fontMain}`}>OOBLECK</div>
                 <div className={`text-[9px] font-bold tracking-[0.5em] mt-1 ml-1 opacity-60`}>MOTION SYNTHESIZER</div>
             </div>
             
             {/* UI Theme Switcher */}
             <div className="grid grid-cols-6 gap-1 items-center mt-1">
                 {(['CYBER', 'RETRO', 'AERO', 'CYBERPUNK', 'SYNTHWAVE', 'DREAM', 'ATOMIC', 'BRUTALIST', 'TRON', 'FUTURE', 'MIAMI', 'NEOGRID'] as Theme[]).map(th => (
                     <button 
                        key={th}
                        onClick={() => setTheme(th)}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-all ${theme === th ? 'bg-white text-black scale-110 shadow-md' : 'bg-black/20 text-white/50 hover:bg-white/20'}`}
                        title={th}
                     >
                         {th === 'CYBER' ? <Monitor size={10}/> : 
                          th === 'RETRO' ? <Grid size={10}/> : 
                          th === 'AERO' ? <Droplets size={10}/> :
                          th === 'CYBERPUNK' ? <Zap size={10}/> :
                          th === 'SYNTHWAVE' ? <Sunset size={10}/> :
                          th === 'DREAM' ? <Cloud size={10}/> :
                          th === 'ATOMIC' ? <Radio size={10}/> :
                          th === 'BRUTALIST' ? <Square size={10}/> :
                          th === 'TRON' ? <Disc size={10}/> :
                          th === 'FUTURE' ? <Sparkles size={10}/> :
                          th === 'MIAMI' ? <Waves size={10}/> :
                          <Triangle size={10}/>
                         }
                     </button>
                 ))}
             </div>
          </div>

          {/* --- TOP CENTER ACTIONS --- */}
          <div className="absolute left-1/2 -translate-x-1/2 top-6 w-full max-w-[486px] h-20 pointer-events-auto">
              {/* LOCK */}
              <button 
                onClick={onToggleChaosLock} 
                className="group flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform absolute right-1/2 mr-4"
              >
                   <div className={`relative p-4 transition-all duration-300 ${s.bigButton}`}>
                       {isChaosLocked ? 
                           <Lock size={40} className="drop-shadow-md" /> : 
                           <Unlock size={40} className="drop-shadow-md" />
                       }
                   </div>
                   <span className={`font-bold tracking-[0.2em] px-3 py-1 rounded text-[10px] bg-black/40 backdrop-blur-md ${isChaosLocked ? 'text-red-500' : 'text-green-400'}`}>
                       {isChaosLocked ? 'LOCKED' : 'UNLOCK'}
                   </span>
              </button>

              {/* SAVE */}
              <button 
                  onClick={(e) => { triggerFeedback(e, 2000, '#22d3ee'); onBigSave(); }}
                  className="group flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform absolute left-1/2 ml-4"
              >
                   <div className={`relative p-4 transition-all duration-300 ${s.bigButton}`}>
                       <ThumbsUp size={40} className="drop-shadow-md" />
                       {/* Slot indicator bubble */}
                       <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs bg-black text-white border-2 border-white`}>
                          {nextSaveSlotIndex}
                       </div>
                   </div>
                   <span className="font-bold tracking-[0.2em] px-3 py-1 rounded text-[10px] bg-black/40 backdrop-blur-md text-cyan-400">
                       SAVE
                   </span>
              </button>
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
                            <div className={`p-4 transition-all duration-300 ${s.bigButton} ${!isCameraActive && 'opacity-70'}`}>
                                <Camera size={32} className="drop-shadow-md" />
                            </div>
                            <span className="font-bold tracking-widest px-2 py-0.5 rounded text-[10px] bg-black/40 text-white">CAM</span>
                    </button>

                    {/* PLAY */}
                    <button 
                        onClick={handlePlayStop} 
                        className={`group flex flex-col items-center justify-center gap-1 transition-all ${drumSettings.enabled ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}
                    >
                            <div className={`p-4 transition-all duration-300 ${s.bigButton} ${!drumSettings.enabled && 'opacity-70'}`}>
                                {drumSettings.enabled ? 
                                    <Square size={32} className="drop-shadow-md" /> : 
                                    <Play size={32} className="ml-1 drop-shadow-md" />
                                }
                            </div>
                            <span className="font-bold tracking-widest px-2 py-0.5 rounded text-[10px] bg-black/40 text-white">
                                {drumSettings.enabled ? 'STOP' : 'PLAY'}
                            </span>
                    </button>

                    {/* REC */}
                    <button 
                        onClick={onToggleRecord} 
                        className={`group flex flex-col items-center justify-center gap-1 transition-all ${isRecording ? 'scale-110' : 'hover:scale-105 active:scale-95'}`}
                    >
                            <div className={`p-4 transition-all duration-300 ${s.bigButton} ${isRecording ? 'animate-pulse' : 'opacity-70'}`}>
                                <div className={`w-8 h-8 rounded-full ${isRecording ? 'bg-red-500' : 'bg-red-900 group-hover:bg-red-500 transition-colors'}`} />
                            </div>
                            <span className="font-bold tracking-widest px-2 py-0.5 rounded text-[10px] bg-black/40 text-white">REC</span>
                    </button>

               </div>

               {/* MAIN CONTROL GRID (2x2) mapped to Webcam Zones */}
               <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 p-2 rounded-3xl overflow-hidden">
                   
                   {/* TL: CHOP */}
                   <button 
                       ref={chopRef}
                       onClick={(e) => { triggerFeedback(e, 500, '#ef4444'); onChop(); }}
                       className={`group relative w-full h-full border-[8px] transition-all flex flex-col items-center justify-center rounded-3xl 
                          ${activeTriggerIndex === 0 ? 'bg-red-600 border-red-500' : 'bg-transparent border-zinc-600 hover:border-red-500 hover:bg-zinc-800'}
                          active:bg-red-600 active:border-red-500`}
                   >
                        <div className="flex flex-col items-center justify-center gap-2 transition-transform group-active:scale-95">
                           <Scissors size={48} className="text-red-500 mb-1 opacity-100" />
                           <span className={`${s.fontMain} text-2xl text-red-500 font-bold tracking-widest bg-black px-3 py-1 rounded-lg border border-red-500`}>CHOP</span>
                        </div>
                   </button>

                   {/* TR: GROWL */}
                   <button 
                       ref={growlRef}
                       onClick={(e) => { triggerFeedback(e, 1000, '#eab308'); onGrowl(); }}
                       className={`group relative w-full h-full border-[8px] transition-all flex flex-col items-center justify-center rounded-3xl
                          ${activeTriggerIndex === 1 ? 'bg-yellow-600 border-yellow-500' : 'bg-transparent border-zinc-600 hover:border-yellow-500 hover:bg-zinc-800'}
                          active:bg-yellow-600 active:border-yellow-500`}
                   >
                        <div className="flex flex-col items-center justify-center gap-2 transition-transform group-active:scale-95">
                           <Skull size={48} className="text-yellow-500 mb-1 opacity-100" />
                           <span className={`${s.fontMain} text-2xl text-yellow-500 font-bold tracking-widest bg-black px-3 py-1 rounded-lg border border-yellow-500`}>GROWL</span>
                        </div>
                   </button>

                   {/* BL: BACK */}
                   <button 
                       ref={backRef}
                       onClick={(e) => { triggerFeedback(e, 250, '#22d3ee'); onRevertPreset(); }}
                       className={`group relative w-full h-full border-[8px] transition-all flex flex-col items-center justify-center rounded-3xl
                          ${activeTriggerIndex === 2 ? 'bg-cyan-600 border-cyan-500' : 'bg-transparent border-zinc-600 hover:border-cyan-500 hover:bg-zinc-800'}
                          active:bg-cyan-600 active:border-cyan-500`}
                   >
                        <div className="flex flex-col items-center justify-center gap-2 transition-transform group-active:scale-95">
                           <RotateCcw size={48} className="text-cyan-500 mt-1 opacity-100" />
                           <span className={`${s.fontMain} text-2xl text-cyan-500 font-bold tracking-widest bg-black px-3 py-1 rounded-lg border border-cyan-500`}>BACK</span>
                        </div>
                   </button>

                   {/* BR: CHAOS */}
                   <button 
                       ref={chaosRef}
                       onClick={(e) => { if(!isChaosLocked) { triggerFeedback(e, 250, '#d946ef'); onRandomize(); }}} 
                       disabled={isChaosLocked} 
                       className={`group relative w-full h-full border-[8px] transition-all flex flex-col items-center justify-center rounded-3xl
                          ${activeTriggerIndex === 3 ? 'bg-purple-600 border-purple-500' : isChaosLocked ? 'border-zinc-800 bg-transparent opacity-50 cursor-not-allowed' : 'bg-transparent border-zinc-600 hover:border-purple-500 hover:bg-zinc-800'}
                          active:bg-purple-600 active:border-purple-500`}
                   >
                        <div className="flex flex-col items-center justify-center gap-2 transition-transform group-active:scale-95">
                           <Wand2 size={48} className={`${isChaosLocked ? 'text-gray-500' : 'text-purple-500'} mt-1 opacity-100`} />
                           <span className={`${s.fontMain} text-2xl font-bold tracking-widest bg-black px-3 py-1 rounded-lg border ${isChaosLocked ? 'text-gray-500 border-gray-500/30' : 'text-purple-500 border-purple-500'}`}>CHAOS</span>
                        </div>
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
      <div className={`pointer-events-auto z-40 w-full relative ${s.deck}`}>
          
          {/* Deck Gradient Line (Cyber Only) */}
          {theme === 'CYBER' && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10" />}

          {/* Main Control Grid */}
          <div className={`grid grid-cols-12 divide-x h-44 ${theme === 'CYBER' ? "bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] divide-white/5" : "bg-transparent divide-black/10"}`}>
              
              {/* CORE / GENESIS (2 Cols) */}
              <div className="col-span-2 p-3 flex flex-col gap-2 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                      <Cpu size={14} className={theme === 'CYBER' ? "animate-pulse" : ""} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${s.fontMain}`}>GENESIS</span>
                  </div>
                  
                  <div className="flex gap-1 mb-2">
                      <input 
                          className={`w-full text-[9px] font-mono h-7 focus:outline-none px-2 rounded-sm bg-black/20 border border-current opacity-70 focus:opacity-100 placeholder:opacity-50`}
                          placeholder="DESCRIBE SOUND..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                      />
                      <button onClick={handleGenerate} disabled={isGenerating} className={`w-8 h-7 flex items-center justify-center transition-colors ${s.buttonActive}`}>
                          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      </button>
                  </div>

                  <div className={`flex-1 flex flex-col justify-center gap-2 p-2 rounded border border-current opacity-80`}>
                      <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold w-8 opacity-70">VISC</span>
                          <div className={`flex-1 h-1.5 rounded-full overflow-hidden bg-black/20`}>
                              <div className={`h-full bg-current`} style={{width: `${currentPreset.physics.viscosityBase * 100}%`}} />
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold w-8 opacity-70">THICK</span>
                          <div className={`flex-1 h-1.5 rounded-full overflow-hidden bg-black/20`}>
                              <div className={`h-full bg-current`} style={{width: `${currentPreset.physics.thickeningFactor * 100}%`}} />
                          </div>
                      </div>
                  </div>
              </div>

              {/* SEQUENCER (5 Cols) */}
              <div className="col-span-5 p-3 flex flex-col relative">
                   <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2 opacity-80">
                           <Drum size={14} />
                           <span className={`text-[10px] font-black uppercase tracking-widest ${s.fontMain}`}>RHYTHM CORE</span>
                       </div>
                       <div className="flex items-center gap-2">
                           <div className={`px-1.5 py-0.5 rounded text-[8px] font-mono bg-black/20 border border-current`}>
                               BPM <span className="font-bold">{arpSettings.bpm}</span>
                           </div>
                           <button onClick={onToggleDrums} className={`h-4 px-2 rounded-full border flex items-center gap-1 transition-all ${drumSettings.enabled ? s.buttonActive : s.button}`}>
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
                              className={`px-2 py-0.5 rounded-[2px] text-[8px] font-bold border transition-all ${drumSettings.genre === g ? s.buttonActive : 'border-transparent opacity-50 hover:opacity-100'}`}
                           >
                               {g}
                           </button>
                       ))}
                   </div>

                   {/* Step Grid */}
                   <div className="flex-1 flex flex-col gap-1 justify-center">
                       {(['kick', 'snare', 'hihat', 'clap'] as const).map(layer => (
                           <div key={layer} className="flex gap-0.5 h-full items-center">
                               <div className="w-8 text-[7px] font-bold uppercase text-right pr-2 tracking-wider opacity-60">{layer.substring(0,3)}</div>
                               <div className="flex-1 flex gap-px h-3">
                                   {drumSettings.pattern.map((step, i) => {
                                       const isOn = step[layer];
                                       const isCurrent = i === currentStep;
                                       return (
                                           <button
                                              key={i}
                                              onClick={() => {
                                                  const np = [...drumSettings.pattern];
                                                  np[i] = {...np[i], [layer]: !np[i][layer]};
                                                  onDrumChange({...drumSettings, pattern: np});
                                              }}
                                              className={`flex-1 transition-all relative overflow-hidden rounded-[1px] ${isOn ? s.buttonActive : 'bg-black/20'} ${isCurrent ? 'brightness-150 z-10 scale-110' : ''}`}
                                           />
                                       )
                                   })}
                               </div>
                           </div>
                       ))}
                   </div>
                   
                   <div className="flex justify-between items-center mt-2 pt-2 border-t border-current/10">
                       <div className="flex gap-2">
                           <select value={drumSettings.kit} onChange={(e) => onDrumChange({...drumSettings, kit: e.target.value as DrumKit})} className="text-[9px] rounded px-1 py-0.5 outline-none bg-black/20 border border-current/50">
                               {DRUM_KITS.map(k => <option key={k} value={k}>{k}</option>)}
                           </select>
                           <select value={drumSettings.fx} onChange={(e) => onDrumChange({...drumSettings, fx: e.target.value as DrumFX})} className="text-[9px] rounded px-1 py-0.5 outline-none bg-black/20 border border-current/50">
                               {DRUM_FX_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                           </select>
                       </div>
                       
                       <div className="flex items-center gap-2 px-2 py-0.5 rounded-full border border-current/20 bg-black/10">
                           <Disc size={10} className="opacity-70" />
                           <Knob value={crossFader} onChange={onCrossFaderChange} theme={theme} size={20} className="mx-1" />
                           <Waves size={10} className="opacity-70" />
                       </div>
                   </div>
              </div>

              {/* DYNAMICS (2 Cols) */}
              <div className="col-span-2 p-3 flex flex-col">
                  <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Activity size={14} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${s.fontMain}`}>GATING</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center gap-3 p-2 rounded border border-current/20 bg-black/10">
                      <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold opacity-60">MODE</span>
                          <button onClick={() => onGateChange({...gateSettings, enabled: !gateSettings.enabled})} className={`px-2 py-0.5 text-[8px] font-bold transition-all ${gateSettings.enabled ? s.buttonActive : s.button}`}>
                              {gateSettings.enabled ? 'ON' : 'BYPASS'}
                          </button>
                      </div>
                      
                      <div>
                          <div className="text-[8px] mb-1 opacity-60">PATTERN</div>
                          <select value={gateSettings.pattern} onChange={(e) => onGateChange({...gateSettings, pattern: e.target.value as GatePatternName})} className="w-full text-[9px] rounded px-1 py-1 outline-none bg-black/20 border border-current/50">
                              {Object.keys(GATE_PATTERNS).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                          {['1/4','1/8','1/16','1/32'].map(d => (
                              <button key={d} onClick={() => onGateChange({...gateSettings, division: d as GateDivision})} className={`text-[7px] py-1 transition-all ${gateSettings.division === d ? s.buttonActive : s.button}`}>
                                  {d.substring(2)}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* SYNTH (3 Cols) */}
              <div className={`col-span-3 ${theme === 'NEOGRID' ? 'p-1 gap-1' : 'p-3'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Sliders size={14} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${s.fontMain}`}>OSCILLATOR</span>
                  </div>

                  <div className={`grid grid-cols-3 ${theme === 'NEOGRID' ? 'gap-1' : 'gap-2'} flex-1`}>
                       {[1,2,3].map(i => {
                           const oscKey = `osc${i}Type` as keyof typeof currentPreset.audio;
                           const volKey = `osc${i}Vol` as keyof typeof currentPreset.audio;
                           
                           const rawType = currentPreset.audio[oscKey];
                           const typeStr = typeof rawType === 'string' ? rawType : 'sine';

                           return (
                               <div key={i} className="flex flex-col items-center rounded p-1 border border-current/10 bg-black/10">
                                   <div className="flex-1 w-full flex justify-center py-2 relative">
                                       <Knob value={(currentPreset.audio[volKey] as number) || 0.5} onChange={(v) => onPresetChange({...currentPreset, audio: {...currentPreset.audio, [volKey]: v}})} theme={theme} size={36} />
                                   </div>
                                   <button 
                                      className={`w-full mt-2 text-[8px] font-mono rounded py-0.5 transition-colors uppercase ${s.button}`}
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
                  
                  <div className={`grid grid-cols-4 gap-2 ${theme === 'NEOGRID' ? 'mt-1' : 'mt-2'} px-1`}>
                       {['attack','decay','sustain','release'].map(p => (
                           <div key={p} className="flex flex-col items-center group">
                               <div className="h-8 w-full relative flex items-center justify-center">
                                   <Knob 
                                      value={currentPreset.audio[p as keyof typeof currentPreset.audio] as number}
                                      min={0.01} max={p === 'release' ? 5 : 1}
                                      onChange={(v) => onPresetChange({...currentPreset, audio: {...currentPreset.audio, [p]: v}})}
                                      theme={theme}
                                      size={24}
                                   />
                               </div>
                               <span className="text-[6px] mt-1 uppercase font-bold opacity-60">{p.substring(0,1)}</span>
                           </div>
                       ))}
                  </div>
              </div>
          </div>
          
          {/* KEYBOARD / BOTTOM STRIP */}
          <div className={`h-14 border-t flex items-end pb-1 px-1 relative z-20 ${s.deck} border-t-0`}>
              
              {/* Controls Left */}
              <div className="w-32 flex flex-col justify-center items-center px-2 gap-1 h-full border-r border-current/10 mr-1">
                  <div className="flex gap-1 w-full">
                      <button onClick={() => onOctaveChange(octave - 1)} className={`flex-1 text-[9px] py-1 rounded-sm font-bold border transition-colors ${s.button}`}>-OCT</button>
                      <button onClick={() => onOctaveChange(octave + 1)} className={`flex-1 text-[9px] py-1 rounded-sm font-bold border transition-colors ${s.button}`}>+OCT</button>
                  </div>
                  <div className="text-[9px] font-mono opacity-50">OCT AVE {octave > 0 ? `+${octave}` : octave}</div>
              </div>

              {/* Keys */}
              <div className="flex-1 flex gap-0.5 h-full relative">
                  {allKeys.map((k) => {
                      const noteIndex = k % 12;
                      const isBlack = [1, 3, 6, 8, 10].includes(noteIndex);
                      const baseFreq = 65.41 * Math.pow(2, (k - 9 + (octave * 12)) / 12);
                      const isActive = activeMouseNote === k;
                      
                      if (isBlack) return null;

                      const nextIsBlack = [1, 3, 6, 8, 10].includes((noteIndex + 1) % 12);
                      
                      return (
                          <div key={k} className="relative flex-1 h-full">
                              {/* White Key */}
                              <button
                                 onMouseDown={() => { onNotePlay(baseFreq); setActiveMouseNote(k); }}
                                 onMouseUp={() => setActiveMouseNote(null)}
                                 onMouseLeave={() => setActiveMouseNote(null)}
                                 className={`w-full h-full rounded-b-sm border-b-4 transition-colors ${isActive ? s.keyWhiteActive : s.keyWhite}`}
                              />
                              
                              {/* Black Key Overlay */}
                              {nextIsBlack && (
                                  <button
                                      onMouseDown={() => { 
                                          const blackFreq = 65.41 * Math.pow(2, (k + 1 - 9 + (octave * 12)) / 12);
                                          onNotePlay(blackFreq); 
                                          setActiveMouseNote(k + 1); 
                                      }}
                                      onMouseUp={() => setActiveMouseNote(null)}
                                      onMouseLeave={() => setActiveMouseNote(null)}
                                      className={`absolute z-10 top-0 -right-1/4 w-1/2 h-3/5 rounded-b-sm border-b-4 transition-colors ${activeMouseNote === k + 1 ? s.keyBlackActive : s.keyBlack}`}
                                  />
                              )}
                          </div>
                      );
                  })}
              </div>

              {/* Right Controls */}
              <div className="w-32 flex flex-col justify-center items-center px-2 gap-1 h-full border-l border-current/10 ml-1">
                  <div className="flex items-center gap-2">
                       <span className="text-[8px] font-bold opacity-60">SCALE</span>
                       <select value={selectedScale} onChange={(e) => setSelectedScale(e.target.value as any)} className="text-[9px] rounded px-1 outline-none bg-black/20 border border-current/20">
                           {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                  </div>
                  <div className="flex items-center gap-2">
                       <span className="text-[8px] font-bold opacity-60">ROOT</span>
                       <select value={rootNote} onChange={(e) => setRootNote(parseInt(e.target.value))} className="text-[9px] rounded px-1 outline-none bg-black/20 border border-current/20">
                           {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((n, i) => <option key={n} value={i}>{n}</option>)}
                       </select>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default UIOverlay;
