import React, { useRef, useEffect, useState } from 'react';
import { Camera, Activity } from 'lucide-react';

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
    const tempCanvasRef = useRef<HTMLCanvasElement>(null); 
    const streamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [motionLevel, setMotionLevel] = useState(0);
    const [uiActiveZones, setUiActiveZones] = useState<boolean[]>([false, false, false, false]);
    const [uiZoneEnergy, setUiZoneEnergy] = useState<number[]>([0, 0, 0, 0]);
    
    const zoneCooldowns = useRef<number[]>([0, 0, 0, 0]);
    const lastGlobalTriggerTime = useRef<number>(0); 
    const activeZones = useRef<boolean[]>([false, false, false, false]);
    const zoneEnergy = useRef<number[]>([0, 0, 0, 0]); 
    const prevCentroid = useRef<{x: number, y: number} | null>(null);
    const smoothPos = useRef<{x: number, y: number} | null>(null);
    const effectRotationRef = useRef<number>(0);
    const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    const lastUiUpdateRef = useRef<number>(0);
    const prevZoneBrightnessRef = useRef<number[]>([128, 128, 128, 128]);

    const onZoneTriggerRef = useRef(onZoneTrigger);
    useEffect(() => { onZoneTriggerRef.current = onZoneTrigger; }, [onZoneTrigger]);

    useEffect(() => {
        if (isActive) { startWebcam(); } else { stopWebcam(); setMotionLevel(0); setUiZoneEnergy([0,0,0,0]); }
        return () => stopWebcam();
    }, [isActive]);

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => { effectRotationRef.current = (effectRotationRef.current + 1) % 5; }, 3000);
        return () => clearInterval(interval);
    }, [isActive]);

    useEffect(() => {
        if (!tempCanvasRef.current) {
            tempCanvasRef.current = document.createElement('canvas');
            tempCanvasRef.current.width = 4;
            tempCanvasRef.current.height = 3;
        }
    }, []);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } 
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
            setError("Could not access camera.");
        }
    };

    const stopWebcam = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
        if (requestRef.current) { cancelAnimationFrame(requestRef.current); }
    };

    const processFrame = (timestamp: number) => {
        if (!isActive || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
        
        if (!ctx || video.readyState !== 4 || video.videoWidth === 0) {
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }

        const width = 64; 
        const height = 48;
        const midX = width / 2;
        const midY = height / 2;
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        if (canvas.width !== width) { canvas.width = width; canvas.height = height; }

        ctx.save(); ctx.scale(-1, 1); ctx.filter = 'none'; ctx.drawImage(video, -width, 0, width, height); ctx.restore();
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const len = data.length;

        let sumX = 0; let sumY = 0; let changedPixelCount = 0;
        const zoneActivity = [0, 0, 0, 0];
        const nextZoneSums = [0, 0, 0, 0];
        const nextZoneCounts = [0, 0, 0, 0];
        const prevData = prevFrameDataRef.current;
        const currentZoneBrightness = prevZoneBrightnessRef.current;

        for (let i = 0; i < len; i += 8) { 
            const r = data[i]; const g = data[i+1]; const b = data[i+2];
            const pixelIndex = i >>> 2;
            const x = pixelIndex & 63; 
            const y = pixelIndex >> 6; 
            const zoneIdx = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
            
            nextZoneSums[zoneIdx] += r + g + b;
            nextZoneCounts[zoneIdx]++;

            if (prevData) {
                const zoneB = currentZoneBrightness[zoneIdx];
                const normB = zoneB / 255;
                const localThreshold = Math.max(12, Math.min(60, 10 + normB * 50));
                const diff = Math.abs(r - prevData[i]) + Math.abs(g - prevData[i+1]) + Math.abs(b - prevData[i+2]);
                
                if (diff > localThreshold) {
                    sumX += x; sumY += y; changedPixelCount++; zoneActivity[zoneIdx]++;
                }
            }
        }
        
        for(let z=0; z<4; z++) { if (nextZoneCounts[z] > 0) prevZoneBrightnessRef.current[z] = (nextZoneSums[z] / nextZoneCounts[z]) / 3; }

        if (!prevFrameDataRef.current) prevFrameDataRef.current = new Uint8ClampedArray(data);
        else prevFrameDataRef.current.set(data);
        
        if (changedPixelCount > 5) {
            const currentCentroidX = sumX / changedPixelCount;
            const currentCentroidY = sumY / changedPixelCount;
            const screenX = (currentCentroidX / width) * window.innerWidth;
            const screenY = (currentCentroidY / height) * window.innerHeight;
            if (!smoothPos.current) smoothPos.current = { x: screenX, y: screenY };
            const density = Math.min(changedPixelCount / 400, 1.0);
            const smoothFactor = 0.1 + (density * 0.4); 
            smoothPos.current.x = smoothPos.current.x * (1 - smoothFactor) + screenX * smoothFactor;
            smoothPos.current.y = smoothPos.current.y * (1 - smoothFactor) + screenY * smoothFactor;
            inputRef.current.x = smoothPos.current.x;
            inputRef.current.y = smoothPos.current.y;
            if (prevCentroid.current) {
                const dx = smoothPos.current.x - ((prevCentroid.current.x / width) * window.innerWidth);
                const dy = smoothPos.current.y - ((prevCentroid.current.y / height) * window.innerHeight);
                const massMultiplier = 1 + (density * 2.0); 
                inputRef.current.vx = dx * 0.5 * massMultiplier;
                inputRef.current.vy = dy * 0.5 * massMultiplier;
            }
            prevCentroid.current = { x: currentCentroidX, y: currentCentroidY };
        } else {
            inputRef.current.vx *= 0.9; inputRef.current.vy *= 0.9;
        }

        const zoneTriggerThreshold = 0.85; 
        const energyGain = 0.15; 
        const energyDecay = 0.92; 
        let zonesChanged = false;
        
        for(let i=0; i<4; i++) {
            const zoneB = currentZoneBrightness[i];
            const sensitivityBoost = Math.max(1.0, 3.5 - (zoneB / 50));
            const zoneMaxPixels = 384; 
            const activityLevel = Math.min((zoneActivity[i] / (zoneMaxPixels * 0.05)) * sensitivityBoost, 2.0);
            zoneEnergy.current[i] += activityLevel * energyGain;
            if (zoneEnergy.current[i] > 1.2) zoneEnergy.current[i] = 1.2;

            if (zoneEnergy.current[i] > zoneTriggerThreshold && timestamp > zoneCooldowns.current[i] && timestamp > lastGlobalTriggerTime.current + 500) {
                zoneCooldowns.current[i] = timestamp + 1500; 
                lastGlobalTriggerTime.current = timestamp;
                activeZones.current[i] = true;
                zoneEnergy.current[i] -= 0.6; 
                const effectIdx = (i + effectRotationRef.current) % 5;
                onZoneTriggerRef.current(i, effectIdx);
                zonesChanged = true;
                setTimeout(() => { activeZones.current[i] = false; setUiActiveZones([...activeZones.current]); }, 300);
            }
            zoneEnergy.current[i] *= energyDecay;
        }

        const anyActive = activeZones.current.some(Boolean);
        if (anyActive) {
            ctx.save(); ctx.scale(-1, 1); 
            for (let z = 0; z < 4; z++) {
                if (!activeZones.current[z]) continue;
                const midY = height / 2; const sy = Math.floor(z / 2) * midY; const col = z % 2; const destX = col === 0 ? -32 : -64;
                const scaleX = vW / width; const scaleY = vH / height;
                const sourceX = col === 0 ? 32 : 0; const sX_vid = sourceX * scaleX; const sY_vid = sy * scaleY;
                const sW_vid = 32 * scaleX; const sH_vid = 24 * scaleY; const effectIdx = (z + effectRotationRef.current) % 5;

                ctx.save();
                if (effectIdx === 0) { ctx.filter = 'invert(1)'; ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24); }
                else if (effectIdx === 1) { ctx.filter = 'hue-rotate(180deg) saturate(300%)'; ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24); }
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
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'; for(let ly=0; ly<24; ly+=2) ctx.fillRect(destX, sy + ly, 32, 1);
                }
                else if (effectIdx === 4) { ctx.filter = 'contrast(200%) saturate(200%)'; ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24); }
                ctx.restore();
            }
            ctx.restore();
        }

        const now = Date.now();
        if (zonesChanged || now - lastUiUpdateRef.current > 50) { 
            setMotionLevel(Math.min(changedPixelCount / 200, 1));
            setUiZoneEnergy([...zoneEnergy.current]); 
            if (zonesChanged) setUiActiveZones([...activeZones.current]);
            lastUiUpdateRef.current = now;
        }

        requestRef.current = requestAnimationFrame(processFrame);
    };

    return (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-12px] z-20 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
            <div className="relative rounded-xl overflow-hidden border-2 border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.1)] bg-black/10 w-[486px] h-[365px] group">
                
                {/* Video & Canvas */}
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="w-full h-full object-cover opacity-100" />
                
                {/* HUD Overlay Grid */}
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none border border-green-500/20">
                    {[0,1,2,3].map(i => (
                         <div key={i} className={`
                            relative border border-green-500/10 transition-colors duration-100
                            ${uiActiveZones[i] ? 'bg-green-500/20' : ''}
                         `}>
                             {/* Energy Bar for Zone */}
                             <div className={`
                                absolute bottom-0 w-full bg-green-500 transition-all duration-75
                                ${i % 2 === 0 ? 'left-0' : 'right-0'}
                             `} style={{ height: '2px', width: `${Math.min(uiZoneEnergy[i]*100, 100)}%` }} />
                         </div>
                    ))}
                </div>

                {/* Center Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                    <div className="w-4 h-4 border border-green-500/50 rounded-full flex items-center justify-center">
                        <div className="w-0.5 h-0.5 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="absolute w-full h-px bg-green-500/20"></div>
                    <div className="absolute h-full w-px bg-green-500/20"></div>
                </div>
                
                {/* Global Motion Bar */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-300 transition-all duration-100 shadow-[0_0_5px_rgba(34,197,94,0.8)]" style={{ width: `${motionLevel * 100}%` }} />
                
                {/* Scanline */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 background-size-[100%_2px,3px_100%] pointer-events-none opacity-20" />
            </div>
            
            {error && (
                <div className="absolute top-full mt-2 text-[8px] text-red-400 bg-black/90 p-2 rounded border border-red-500 shadow-lg backdrop-blur-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default WebcamMotion;