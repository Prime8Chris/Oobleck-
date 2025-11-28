
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SynthPreset } from '../types';

export const generatePreset = async (prompt: string): Promise<SynthPreset> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });
  
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      audio: {
        type: Type.OBJECT,
        properties: {
          osc1Type: { type: Type.STRING, enum: ['sine', 'square', 'sawtooth', 'triangle'] },
          osc2Type: { type: Type.STRING, enum: ['sine', 'square', 'sawtooth', 'triangle'] },
          baseFreq: { type: Type.NUMBER, description: "Base frequency in Hz (50-800)" },
          detuneSpread: { type: Type.NUMBER, description: "Detune in cents (0-100)" },
          filterCutoffBase: { type: Type.NUMBER, description: "Filter cutoff in Hz (100-5000)" },
          filterResonanceBase: { type: Type.NUMBER, description: "Q factor (0-20)" },
          distortionAmount: { type: Type.NUMBER, description: "Distortion (0-100)" },
          reverbMix: { type: Type.NUMBER, description: "0 to 1" },
        },
        required: ['osc1Type', 'osc2Type', 'baseFreq', 'detuneSpread', 'filterCutoffBase', 'filterResonanceBase', 'distortionAmount', 'reverbMix']
      },
      physics: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          viscosityBase: { type: Type.NUMBER, description: "0 (water) to 1 (tar)" },
          thickeningFactor: { type: Type.NUMBER, description: "0 (Newtonian) to 1 (Solidifies on impact)" },
          colorBase: { type: Type.STRING, description: "Hex color code" },
          colorSolid: { type: Type.STRING, description: "Hex color code for solid state" },
        },
        required: ['name', 'viscosityBase', 'thickeningFactor', 'colorBase', 'colorSolid']
      },
      visual: {
        type: Type.OBJECT,
        properties: {
           shape: { type: Type.STRING, enum: ['circle', 'square', 'triangle', 'hexagon', 'cross', 'star'] },
           trailLength: { type: Type.NUMBER, description: "0.05 (long) to 0.5 (short)" },
           connectPoints: { type: Type.BOOLEAN },
           strokeWidth: { type: Type.NUMBER, description: "1 to 5" },
           cameraMode: { type: Type.STRING, enum: ['static', 'sway', 'pulse', 'drift', 'spin', 'shake', 'zoom'] },
           glowIntensity: { type: Type.NUMBER, description: "0 to 1" },
           renderStyle: { type: Type.STRING, enum: ['particles', 'wireframe', 'mosaic', 'scanner'] }
        },
        required: ['shape', 'trailLength', 'connectPoints', 'strokeWidth', 'cameraMode', 'glowIntensity', 'renderStyle']
      }
    },
    required: ['description', 'audio', 'physics', 'visual']
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a synthesizer preset that physically behaves and sounds like: ${prompt}. 
    Interpret the physical properties (non-newtonian behavior) and translate them to audio parameters, physics settings, and visual style.
    For visuals, match the physics (e.g., 'wireframe' for structured, 'mosaic' for chunky/rocky, 'particles' for fluid).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      systemInstruction: "You are an expert sound designer, physicist, and visual artist. Create precise, creative presets where audio, physics, and visuals align.",
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text) as SynthPreset;
};
