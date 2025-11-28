import React, { useRef, useEffect, useState } from 'react';
import { Camera, Activity, Zap, Grid2X2 } from 'lucide-react';

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
    
    // Logic Refs
    const zoneCooldowns = useRef<number[]>([0, 0, 0, 0]);
    const activeZones = useRef<boolean[]>([false, false, false, false]);
    
    // Zone Energy for smoother triggering
    const zoneEnergy = useRef<number[]>([0, 0, 0, 0]); 
    
    // Centroid tracking for Motion Vectors
    const prevCentroid = useRef<{x: number, y: number} | null>(null);

    const effectRotationRef = useRef<number>(0);
    const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    const lastUiUpdateRef = useRef<number>(0);

    useEffect(() => {
        if (isActive) {
            startWebcam();
        } else {
            stopWebcam();
            setMotionLevel(0);
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

        const width = 64;
        const height = 48;
        const midX = width / 2;
        const midY = height / 2;
        
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
        // Note: getImageData captures the canvas state *after* the base draw.
        // Since we mirrored with scale(-1, 1), the visual left (0) is actually pixel index 0.
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const len = data.length;

        // --- MOTION ANALYSIS ---
        let sumX = 0;
        let sumY = 0;
        let changedPixelCount = 0;
        const zoneActivity = [0, 0, 0, 0];

        if (prevFrameDataRef.current) {
            const prevData = prevFrameDataRef.current;
            
            // Stride 4 for faster iteration (25% of pixels)
            for (let i = 0; i < len; i += 16) { // 4 pixels * 4 channels
                const diff = 
                    Math.abs(data[i] - prevData[i]) + 
                    Math.abs(data[i+1] - prevData[i+1]) + 
                    Math.abs(data[i+2] - prevData[i+2]);
                
                if (diff > 50) {
                    const pixelIndex = i >>> 2; // i / 4
                    const x = pixelIndex % width;
                    const y = (pixelIndex - x) / width; 
                    
                    sumX += x;
                    sumY += y;
                    changedPixelCount++;

                    // Determine Zone (0:TL, 1:TR, 2:BL, 3:BR)
                    const zoneIdx = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
                    zoneActivity[zoneIdx]++;
                }
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
        }

        // Cache current frame for next diff
        if (!prevFrameDataRef.current) {
            prevFrameDataRef.current = new Uint8ClampedArray(data);
        } else {
            prevFrameDataRef.current.set(data);
        }

        // --- TRIGGER LOGIC ---
        const zoneTriggerThreshold = 0.8; 
        const energyGain = 0.2;
        const energyDecay = 0.9;
        let zonesChanged = false;
        
        for(let i=0; i<4; i++) {
            const zoneMaxPixels = (width * height) / 4 / 4; // Adjusted for stride
            const activityLevel = Math.min(zoneActivity[i] / (zoneMaxPixels * 0.1), 1.0);
            zoneEnergy.current[i] += activityLevel * energyGain;
            
            if (zoneEnergy.current[i] > zoneTriggerThreshold && timestamp > zoneCooldowns.current[i]) {
                zoneCooldowns.current[i] = timestamp + 1000; 
                activeZones.current[i] = true;
                zoneEnergy.current[i] = 0; 

                const effectIdx = (i + effectRotationRef.current) % 5;
                onZoneTrigger(i, effectIdx);
                zonesChanged = true;
                
                setTimeout(() => { 
                    activeZones.current[i] = false; 
                    setUiActiveZones([...activeZones.current]);
                }, 300);
            }
            zoneEnergy.current[i] *= energyDecay;
        }

        // --- RENDER VISUAL EFFECTS (GPU Accelerated) ---
        // We draw ON TOP of the existing base video using clipping and filters
        const anyActive = activeZones.current.some(Boolean);

        if (anyActive) {
            ctx.save();
            ctx.scale(-1, 1); // Work in mirrored coordinates again
            
            for (let z = 0; z < 4; z++) {
                if (!activeZones.current[z]) continue;

                // Zone coordinates in Screen Space (0..64)
                const sx = (z % 2) * midX;        
                const sy = Math.floor(z / 2) * midY;
                
                // Destination X calculation for mirrored context
                const col = z % 2;
                const destX = col === 0 ? -32 : -64;
                const sourceX = col === 0 ? 32 : 0;
                
                // SOURCE VIDEO COORDINATES (SCALED)
                // We must scale the 64x48 coordinates up to the raw video resolution (e.g. 640x480)
                // to grab the correct crop.
                const scaleX = vW / width;
                const scaleY = vH / height;
                
                const sX_vid = sourceX * scaleX;
                const sY_vid = sy * scaleY;
                const sW_vid = 32 * scaleX;
                const sH_vid = 24 * scaleY;
                
                const effectIdx = (z + effectRotationRef.current) % 5;

                ctx.save();
                
                // 1. Invert
                if (effectIdx === 0) { 
                    ctx.filter = 'invert(1)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                // 2. Glitch (Hue Rotate + Saturation)
                else if (effectIdx === 1) {
                    ctx.filter = 'hue-rotate(180deg) saturate(300%)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                // 3. Mosaic (Downscale-Upscale Trick)
                else if (effectIdx === 2) {
                    const tempCtx = tempCanvasRef.current?.getContext('2d');
                    if (tempCtx && tempCanvasRef.current) {
                        ctx.imageSmoothingEnabled = false;
                        // Draw tiny to temp (from FULL RES video)
                        tempCtx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, 0, 0, 4, 3);
                        // Draw huge to dest
                        ctx.drawImage(tempCanvasRef.current, 0, 0, 4, 3, destX, sy, 32, 24);
                    }
                }
                // 4. Scanlines (Overlay)
                else if (effectIdx === 3) {
                    // Draw normal first
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                    // Overlay lines
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    for(let ly=0; ly<24; ly+=2) {
                        ctx.fillRect(destX, sy + ly, 32, 1);
                    }
                }
                // 5. Posterize (High Contrast)
                else if (effectIdx === 4) {
                    ctx.filter = 'contrast(200%) saturate(200%)';
                    ctx.drawImage(video, sX_vid, sY_vid, sW_vid, sH_vid, destX, sy, 32, 24);
                }
                
                ctx.restore();
            }
            ctx.restore();
        }

        // --- UI Updates ---
        const now = Date.now();
        if (zonesChanged || now - lastUiUpdateRef.current > 100) {
            setMotionLevel(Math.min(changedPixelCount / 200, 1));
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
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
                    <div className={`border-r border-b border-white/10 flex items-start justify-start p-1 transition-colors duration-200 ${uiActiveZones[0] ? 'bg-teal-500/20' : ''}`}>
                         <span className={`text-[8px] font-bold font-mono transition-colors ${uiActiveZones[0] ? 'text-teal-300' : 'text-gray-500'}`}>GATE 1/64</span>
                    </div>
                    <div className={`border-b border-white/10 flex items-start justify-end p-1 transition-colors duration-200 ${uiActiveZones[1] ? 'bg-red-500/20' : ''}`}>
                        <span className={`text-[8px] font-bold font-mono transition-colors ${uiActiveZones[1] ? 'text-red-300' : 'text-gray-500'}`}>GATE OFF + FX STACK</span>
                    </div>
                    <div className={`border-r border-white/10 flex items-end justify-start p-1 transition-colors duration-200 ${uiActiveZones[2] ? 'bg-blue-500/20' : ''}`}>
                         <span className={`text-[8px] font-bold font-mono transition-colors ${uiActiveZones[2] ? 'text-blue-300' : 'text-gray-500'}`}>GATE 1/4</span>
                    </div>
                    <div className={`flex items-end justify-end p-1 transition-colors duration-200 ${uiActiveZones[3] ? 'bg-purple-500/20' : ''}`}>
                         <span className={`text-[8px] font-bold font-mono transition-colors ${uiActiveZones[3] ? 'text-purple-300' : 'text-gray-500'}`}>CHAOS</span>
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <Grid2X2 size={12} className="text-white/20" />
                </div>
                
                <div className="absolute bottom-0 left-0 h-1 bg-teal-500 transition-all duration-100" style={{ width: `${motionLevel * 100}%` }} />
            </div>
            {error && <div className="absolute top-full mt-2 text-xs text-red-400 bg-black/80 p-2 rounded">{error}</div>}
        </div>
    );
};

export default WebcamMotion;