
import React, { useRef, useEffect, useState } from 'react';
import { Grid2X2 } from 'lucide-react';

interface Props {
    isActive: boolean;
    inputRef: React.MutableRefObject<{ 
        x: number; 
        y: number; 
        vx: number; 
        vy: number; 
        lastX: number; 
        lastY: number; 
        isClicked: boolean 
    }>;
    onZoneTrigger: (zoneIndex: number, visualEffectIndex?: number) => void;
}

const WebcamMotion: React.FC<Props> = ({ isActive, inputRef, onZoneTrigger }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tempCanvasRef = useRef<HTMLCanvasElement>(null); // For Mosaic scaling
    const streamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [motionLevel, setMotionLevel] = useState(0);
    const [uiActiveZones, setUiActiveZones] = useState<boolean[]>([false, false, false, false]);
    const [uiZoneEnergy, setUiZoneEnergy] = useState<number[]>([0, 0, 0, 0]);
    
    // Logic Refs
    const zoneCooldowns = useRef<number[]>([0, 0, 0, 0]);
    const lastGlobalTriggerTime = useRef<number>(0); // Global cooldown to prevent burst triggers
    const activeZones = useRef<boolean[]>([false, false, false, false]);
    
    // Zone Energy for smoother triggering
    const zoneEnergy = useRef<number[]>([0, 0, 0, 0]); 
    
    // Centroid tracking for Motion Vectors
    const prevCentroid = useRef<{x: number, y: number} | null>(null);

    const effectRotationRef = useRef<number>(0);
    const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    const lastUiUpdateRef = useRef<number>(0);
    
    // Per-Zone Adaptive Light Sensitivity
    const prevZoneBrightnessRef = useRef<number[]>([128, 128, 128, 128]);

    // REF PATTERN FOR CALLBACK: Fixes stale closure in RAF loop
    const onZoneTriggerRef = useRef(onZoneTrigger);
    useEffect(() => {
        onZoneTriggerRef.current = onZoneTrigger;
    }, [onZoneTrigger]);

    useEffect(() => {
        if (isActive) {
            startWebcam();
        } else {
            stopWebcam();
            setMotionLevel(0);
            setUiZoneEnergy([0,0,0,0]);
        }
        return () => stopWebcam();
    }, [isActive]);

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            effectRotationRef.current = (effectRotationRef.current + 1) % 5;
        }, 3000);
        return () => clearInterval(interval);
    }, [isActive]);

    // Initialize temp canvas for effects
    useEffect(() => {
        if (!tempCanvasRef.current) {
            tempCanvasRef.current = document.createElement('canvas');
            tempCanvasRef.current.width = 4; // Tiny resolution for mosaic
            tempCanvasRef.current.height = 3;
        }
    }, []);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 320 }, 
                    height: { ideal: 240 },
                    facingMode: "user"
                } 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().catch(e => console.error("Play error", e));
                    requestRef.current = requestAnimationFrame(processFrame);
                };
            }
            setError(null);
        } catch (err) {
            console.error("Error accessing webcam:", err);
            setError("Could not access camera. Please verify permissions.");
        }
    };

    const stopWebcam = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
    };

    const processFrame = (timestamp: number) => {
        if (!isActive || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        // Optimization: Use willReadFrequently to hint browser for readback
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
        
        if (!ctx || video.readyState !== 4 || video.videoWidth === 0) {
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // Fixed low resolution for processing efficiency
        const width = 64; 
        const height = 48;
        const midX = width / 2;  // 32
        const midY = height / 2; // 24
        
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        if (canvas.width !== width) {
            canvas.width = width;
            canvas.height = height;
        }

        // 1. Draw Base Video (Hardware Accelerated)
        // We mirror the context to make interaction intuitive
        ctx.save();
        ctx.scale(-1, 1);
        ctx.filter = 'none';
        ctx.drawImage(video, -width, 0, width, height);
        ctx.restore();
        
        // 2. Read Pixels ONCE for Analysis
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const len = data.length;

        // --- MOTION ANALYSIS ---
        let sumX = 0;
        let sumY = 0;
        let changedPixelCount = 0;
        const zoneActivity = [0, 0, 0, 0];
        
        // Stats for next frame adaptation
        const nextZoneSums = [0, 0, 0, 0];
        const nextZoneCounts = [0, 0, 0, 0];

        const prevData = prevFrameDataRef.current;
        const currentZoneBrightness = prevZoneBrightnessRef.current;

        // IMPROVEMENT: Stride 8 (Every 2nd pixel)
        for (let i = 0; i < len; i += 8) { 
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            const pixelIndex = i >>> 2;
            const x = pixelIndex & 63; // pixelIndex % 64
            const y = pixelIndex >> 6; // pixelIndex / 64
            
            const zoneIdx = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
            
            nextZoneSums[zoneIdx] += r + g + b;
            nextZoneCounts[zoneIdx]++;

            if (prevData) {
                // PER-ZONE ADAPTIVE THRESHOLD (Tuned for Stability)
                const zoneB = currentZoneBrightness[zoneIdx];
                const normB = zoneB / 255;
                
                // Raised floor from 5 to 12 to filter camera noise in dark areas
                const localThreshold = Math.max(12, Math.min(60, 10 + normB * 50));

                const diff = 
                    Math.abs(r - prevData[i]) + 
                    Math.abs(g - prevData[i+1]) + 
                    Math.abs(b - prevData[i+2]);
                
                if (diff > localThreshold) {
                    sumX += x;
                    sumY += y;
                    changedPixelCount++;
                    zoneActivity[zoneIdx]++;
                }
            }
        }
        
        // Update Brightness Reference for next frame
        for(let z=0; z<4; z++) {
            if (nextZoneCounts[z] > 0) {
                prevZoneBrightnessRef.current[z] = (nextZoneSums[z] / nextZoneCounts[z]) / 3;
            }
        }

        // Cache current frame
        if (!prevFrameDataRef.current) {
            prevFrameDataRef.current = new Uint8ClampedArray(data);
        } else {
            prevFrameDataRef.current.set(data);
        }
        
        // Physics Update (Centroid)
        if (changedPixelCount > 5) {
            const currentCentroidX = sumX / changedPixelCount;
            const currentCentroidY = sumY / changedPixelCount;
            
            const screenX = (currentCentroidX / width) * window.innerWidth;
            const screenY = (currentCentroidY / height) * window.innerHeight;
            
            inputRef.current.x = screenX;
            inputRef.current.y = screenY;
            
            if (prevCentroid.current) {
                const dx = currentCentroidX - prevCentroid.current.x;
                const dy = currentCentroidY - prevCentroid.current.y;
                inputRef.current.vx = dx * 5; 
                inputRef.current.vy = dy * 5;
            }
            prevCentroid.current = { x: currentCentroidX, y: currentCentroidY };
        } else {
            inputRef.current.vx *= 0.9;
            inputRef.current.vy *= 0.9;
            prevCentroid.current = null;
        }

        // --- TRIGGER LOGIC ---
        const zoneTriggerThreshold = 0.85; // Slightly harder to trigger (was 0.8)
        const energyGain = 0.15; // Slower buildup (was 0.25) to prevent instant triggers
        const energyDecay = 0.90; // Decay factor
        
        let zonesChanged = false;
        
        for(let i=0; i<4; i++) {
            const zoneB = currentZoneBrightness[i];
            
            // ADAPTIVE SENSITIVITY BOOST (Reduced cap)
            // Reduced max boost from 6.0 to 3.5 to prevent noise triggers in pitch black
            const sensitivityBoost = Math.max(1.0, 3.5 - (zoneB / 50));
            
            const zoneMaxPixels = 384; // Approx pixels per zone with new stride
            const activityLevel = Math.min((zoneActivity[i] / (zoneMaxPixels * 0.05)) * sensitivityBoost, 2.0);
            
            zoneEnergy.current[i] += activityLevel * energyGain;
            
            // Clamp
            if (zoneEnergy.current[i] > 1.2) zoneEnergy.current[i] = 1.2;

            // Global cooldown check (500ms) to prevent multiple zones firing at once
            if (zoneEnergy.current[i] > zoneTriggerThreshold && 
                timestamp > zoneCooldowns.current[i] && 
                timestamp > lastGlobalTriggerTime.current + 500) {
                
                zoneCooldowns.current[i] = timestamp + 1500; // Longer cooldown per zone
                lastGlobalTriggerTime.current = timestamp;
                
                activeZones.current[i] = true;
                zoneEnergy.current[i] = 0; 

                const effectIdx = (i + effectRotationRef.current) % 5;
                
                // USE REF for Callback to avoid stale state capture
                onZoneTriggerRef.current(i, effectIdx);
                
                zonesChanged = true;
                
                setTimeout(() => { 
                    activeZones.current[i] = false; 
                    setUiActiveZones([...activeZones.current]);
                }, 300);
            }
            zoneEnergy.current[i] *= energyDecay;
        }

        // --- RENDER VISUAL EFFECTS ---
        const anyActive = activeZones.current.some(Boolean);

        if (anyActive) {
            ctx.save();
            ctx.scale(-1, 1); 
            
            for (let z = 0; z < 4; z++) {
                if (!activeZones.current[z]) continue;

                const midX = width / 2;
                const midY = height / 2;
                const sy = Math.floor(z / 2) * midY;
                const col = z % 2;
                const destX = col === 0 ? -32 : -64;
                
                const scaleX = vW / width;
                const scaleY = vH / height;
                const sourceX = col === 0 ? 32 : 0;
                const sX_vid = sourceX * scaleX;
                const sY_vid = sy * scaleY;
                const sW_vid = 32 * scaleX;
                const sH_vid = 24 * scaleY;
                const effectIdx = (z + effectRotationRef.current) % 5;

                ctx.save();
                if (effectIdx === 0) { 
                    ctx.filter = 'invert(1)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                else if (effectIdx === 1) {
                    ctx.filter = 'hue-rotate(180deg) saturate(300%)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                else if (effectIdx === 2) {
                    const tempCtx = tempCanvasRef.current?.getContext('2d');
                    if (tempCtx && tempCanvasRef.current) {
                        ctx.imageSmoothingEnabled = false;
                        tempCtx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, 0, 0, 4, 3);
                        ctx.drawImage(tempCanvasRef.current, 0, 0, 4, 3, destX, sy, 32, 24);
                    }
                }
                else if (effectIdx === 3) {
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    for(let ly=0; ly<24; ly+=2) ctx.fillRect(destX, sy + ly, 32, 1);
                }
                else if (effectIdx === 4) {
                    ctx.filter = 'contrast(200%) saturate(200%)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                ctx.restore();
            }
            ctx.restore();
        }

        const now = Date.now();
        if (zonesChanged || now - lastUiUpdateRef.current > 50) { // Update faster (50ms) for smoother UI meters
            setMotionLevel(Math.min(changedPixelCount / 200, 1));
            setUiZoneEnergy([...zoneEnergy.current]); // Sync energy for meters
            if (zonesChanged) setUiActiveZones([...activeZones.current]);
            lastUiUpdateRef.current = now;
        }

        requestRef.current = requestAnimationFrame(processFrame);
    };

    return (
        <div className={`absolute top-[18rem] left-[31px] z-20 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(45,212,191,0.2)] bg-black/80 backdrop-blur-sm w-64 h-48">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />
                
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                    {/* Top Left */}
                    <div className={`relative border-r border-b border-white/10 flex items-start justify-start p-1 transition-colors duration-200 ${uiActiveZones[0] ? 'bg-teal-500/20' : ''}`}>
                         {/* Energy Meter Background */}
                         <div className="absolute bottom-0 left-0 w-full bg-teal-500/10 transition-all duration-75" style={{ height: `${Math.min(uiZoneEnergy[0]*100, 100)}%` }} />
                         <span className={`relative z-10 text-[8px] font-bold font-mono transition-colors ${uiActiveZones[0] ? 'text-teal-300' : 'text-gray-500'}`}>CHOP IT UP</span>
                    </div>
                    {/* Top Right */}
                    <div className={`relative border-b border-white/10 flex items-start justify-end p-1 transition-colors duration-200 ${uiActiveZones[1] ? 'bg-red-500/20' : ''}`}>
                        <div className="absolute bottom-0 left-0 w-full bg-red-500/10 transition-all duration-75" style={{ height: `${Math.min(uiZoneEnergy[1]*100, 100)}%` }} />
                        <span className={`relative z-10 text-[8px] font-bold font-mono transition-colors ${uiActiveZones[1] ? 'text-red-300' : 'text-gray-500'}`}>GRRRR!</span>
                    </div>
                    {/* Bottom Left */}
                    <div className={`relative border-r border-white/10 flex items-end justify-start p-1 transition-colors duration-200 ${uiActiveZones[2] ? 'bg-blue-500/20' : ''}`}>
                         <div className="absolute bottom-0 left-0 w-full bg-blue-500/10 transition-all duration-75" style={{ height: `${Math.min(uiZoneEnergy[2]*100, 100)}%` }} />
                         <span className={`relative z-10 text-[8px] font-bold font-mono transition-colors ${uiActiveZones[2] ? 'text-blue-300' : 'text-gray-500'}`}>RUN BACK</span>
                    </div>
                    {/* Bottom Right */}
                    <div className={`relative flex items-end justify-end p-1 transition-colors duration-200 ${uiActiveZones[3] ? 'bg-purple-500/20' : ''}`}>
                         <div className="absolute bottom-0 left-0 w-full bg-purple-500/10 transition-all duration-75" style={{ height: `${Math.min(uiZoneEnergy[3]*100, 100)}%` }} />
                         <span className={`relative z-10 text-[8px] font-bold font-mono transition-colors ${uiActiveZones[3] ? 'text-purple-300' : 'text-gray-500'}`}>CHAOS</span>
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Grid2X2 size={12} className="text-white/20" />
                </div>
                
                {/* Global Motion Bar */}
                <div className="absolute bottom-0 left-0 h-1 bg-teal-500 transition-all duration-100" style={{ width: `${motionLevel * 100}%` }} />
            </div>
            {error && <div className="absolute top-full mt-2 text-xs text-red-400 bg-black/80 p-2 rounded">{error}</div>}
        </div>
    );
};

export default WebcamMotion;
