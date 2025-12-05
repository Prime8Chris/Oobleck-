

import React, { useRef, useEffect, useState } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

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
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const requestRef = useRef<number | null>(null);
    const segmenterRef = useRef<ImageSegmenter | null>(null);
    const lastVideoTimeRef = useRef<number>(-1);
    const frameCountRef = useRef(0);
    
    const [error, setError] = useState<string | null>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [motionLevel, setMotionLevel] = useState(0);
    
    // UI State for Visualization
    const [uiActiveZones, setUiActiveZones] = useState<boolean[]>([false, false, false, false]);
    const [uiZoneEnergy, setUiZoneEnergy] = useState<number[]>([0, 0, 0, 0]);
    
    // Motion Logic Refs
    const zoneCooldowns = useRef<number[]>([0, 0, 0, 0]);
    const activeZones = useRef<boolean[]>([false, false, false, false]);
    const zoneEnergy = useRef<number[]>([0, 0, 0, 0]); 
    const prevCentroid = useRef<{x: number, y: number} | null>(null);
    const smoothPos = useRef<{x: number, y: number} | null>(null);
    const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    const lastUiUpdateRef = useRef<number>(0);

    const onZoneTriggerRef = useRef(onZoneTrigger);
    useEffect(() => { onZoneTriggerRef.current = onZoneTrigger; }, [onZoneTrigger]);

    // Zone Styles Mapping: TL=Red(0), TR=Yellow(1), BL=Cyan(2), BR=Purple(3)
    const ZONE_STYLES = [
        { 
            bar: 'bg-red-500', 
            border: 'border-red-500/20',
            active: 'bg-red-500/40 shadow-[inset_0_0_20px_rgba(239,68,68,0.4)]'
        },
        { 
            bar: 'bg-yellow-500', 
            border: 'border-yellow-500/20',
            active: 'bg-yellow-500/40 shadow-[inset_0_0_20px_rgba(234,179,8,0.4)]'
        },
        { 
            bar: 'bg-cyan-500', 
            border: 'border-cyan-500/20',
            active: 'bg-cyan-500/40 shadow-[inset_0_0_20px_rgba(6,182,212,0.4)]'
        },
        { 
            bar: 'bg-purple-500', 
            border: 'border-purple-500/20',
            active: 'bg-purple-500/40 shadow-[inset_0_0_20px_rgba(168,85,247,0.4)]'
        }
    ];

    // 1. Load Model
    useEffect(() => {
        let isMounted = true;
        const createSegmenter = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                );
                if (!isMounted) return;
                
                const segmenter = await ImageSegmenter.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    outputCategoryMask: true,
                    outputConfidenceMasks: false
                });
                
                if (isMounted) {
                    segmenterRef.current = segmenter;
                    setIsModelLoaded(true);
                }
            } catch (e) {
                console.error("Failed to load MediaPipe Segmenter", e);
                if (isMounted) setError("AI Model Load Failed");
            }
        };
        createSegmenter();
        return () => { isMounted = false; segmenterRef.current?.close(); };
    }, []);

    // 2. Manage Webcam Stream
    useEffect(() => {
        if (isActive) { 
            startWebcam(); 
        } else { 
            stopWebcam(); 
            setUiZoneEnergy([0,0,0,0]); 
            setMotionLevel(0);
        }
        return () => stopWebcam();
    }, [isActive]);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                // Optimization: Request lower resolution to reduce load on source
                video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }
            });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().catch(e => console.error("Play error", e));
                    if (!requestRef.current) requestRef.current = requestAnimationFrame(processFrame);
                };
            }
            setError(null);
        } catch (err) {
            console.error("Error accessing webcam:", err);
            setError("Camera Access Denied");
        }
    };

    const stopWebcam = () => {
        if (streamRef.current) { 
            streamRef.current.getTracks().forEach(track => track.stop()); 
            streamRef.current = null; 
        }
        if (requestRef.current) { 
            cancelAnimationFrame(requestRef.current); 
            requestRef.current = null; 
        }
    };

    const processFrame = (timestamp: number) => {
        requestRef.current = requestAnimationFrame(processFrame);
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!isActive || !video || !canvas || video.readyState < 2) return;
        
        // Throttling: Only process every 3rd frame (approx 20 FPS)
        frameCountRef.current++;
        if (frameCountRef.current % 3 !== 0) return;

        // Optimization: Analyze on a small grid (128x96)
        // We set the canvas size to small; CSS scales it up for the preview
        const analysisW = 128;
        const analysisH = 96;

        if (canvas.width !== analysisW) {
             canvas.width = analysisW;
             canvas.height = analysisH;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Fallback: If model isn't ready
        if (!segmenterRef.current) {
            ctx.clearRect(0, 0, analysisW, analysisH);
            return;
        }

        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            
            segmenterRef.current.segmentForVideo(video, timestamp, (result) => {
                if (result && result.categoryMask) {
                    const { width, height } = result.categoryMask;
                    const mask = result.categoryMask.getAsUint8Array();

                    // Resize Intermediate Canvas to match mask dimensions
                    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
                    const maskCanvas = maskCanvasRef.current;
                    if (maskCanvas.width !== width || maskCanvas.height !== height) {
                        maskCanvas.width = width;
                        maskCanvas.height = height;
                    }

                    const maskCtx = maskCanvas.getContext('2d');
                    if (!maskCtx) return;

                    const imageData = maskCtx.createImageData(width, height);
                    const data = imageData.data;

                    // --- PIXEL LOOP: INVERTED SILHOUETTE ---
                    for (let i = 0; i < mask.length; i++) {
                        const isFg = mask[i] > 0; 
                        const idx = i * 4;
                        
                        if (isFg) {
                            // Person -> Transparent
                            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;   
                        } else {
                            // Background -> Cyan
                            data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
                        }
                    }

                    maskCtx.putImageData(imageData, 0, 0);

                    // --- DRAW TO MAIN (SMALL) CANVAS ---
                    ctx.clearRect(0, 0, analysisW, analysisH);
                    ctx.save();
                    ctx.scale(-1, 1); // Mirror
                    ctx.imageSmoothingEnabled = false; 
                    // Draw mask scaled to analysis buffer
                    ctx.drawImage(maskCanvas, -analysisW, 0, analysisW, analysisH);
                    ctx.restore();

                    // --- MOTION DETECTION (On Small Buffer) ---
                    processMotion(ctx, analysisW, analysisH, timestamp);
                }
            });
        }
    };

    const processMotion = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
        // Read the rendered inverted silhouette from small buffer
        const finalImage = ctx.getImageData(0, 0, width, height);
        const data = finalImage.data;
        
        const prevData = prevFrameDataRef.current;
        let sumX = 0; let sumY = 0; let changedPixelCount = 0;
        const zoneActivity = [0, 0, 0, 0];
        const midX = width / 2;
        const midY = height / 2;
        const stride = 2; // Check every 2nd pixel (already low res)

        for (let i = 0; i < data.length; i += 4 * stride) {
             const alpha = data[i+3];

             if (prevData) {
                 const prevAlpha = prevData[i+3];
                 const diff = Math.abs(alpha - prevAlpha);

                 if (diff > 100) { 
                     const idx = i / 4;
                     const x = idx % width;
                     const y = Math.floor(idx / width);
                     
                     sumX += x; 
                     sumY += y; 
                     changedPixelCount++;
                     
                     const zIdx = (x >= midX ? 1 : 0) + (y >= midY ? 2 : 0);
                     zoneActivity[zIdx]++;
                 }
             }
        }
        
        if (!prevFrameDataRef.current || prevFrameDataRef.current.length !== data.length) {
             prevFrameDataRef.current = new Uint8ClampedArray(data);
        } else {
             prevFrameDataRef.current.set(data);
        }

        // --- GLOBAL MOTION ---
        if (changedPixelCount > 2) {
            const cx = sumX / changedPixelCount;
            const cy = sumY / changedPixelCount;
            
            // Map small buffer coords to window coords
            const sx = (cx / width) * window.innerWidth;
            const sy = (cy / height) * window.innerHeight;
            
             if (!smoothPos.current) smoothPos.current = { x: sx, y: sy };
             smoothPos.current.x += (sx - smoothPos.current.x) * 0.2;
             smoothPos.current.y += (sy - smoothPos.current.y) * 0.2;
             
             inputRef.current.x = smoothPos.current.x;
             inputRef.current.y = smoothPos.current.y;
             
             if (prevCentroid.current) {
                 inputRef.current.vx = (cx - prevCentroid.current.x) * (window.innerWidth / width) * 0.5; 
                 inputRef.current.vy = (cy - prevCentroid.current.y) * (window.innerHeight / height) * 0.5;
             }
             prevCentroid.current = { x: cx, y: cy };
        } else {
             inputRef.current.vx *= 0.9;
             inputRef.current.vy *= 0.9;
        }
        
        // --- ZONE TRIGGERS ---
        for(let i=0; i<4; i++) {
             // Lower threshold due to resolution
             const threshold = (width * height) * 0.005;
             const act = Math.min(zoneActivity[i] / threshold, 1.0);
             
             zoneEnergy.current[i] += act * 0.8;
             if(zoneEnergy.current[i] > 1.2) zoneEnergy.current[i] = 1.2;
             
             if(zoneEnergy.current[i] > 0.8 && timestamp > zoneCooldowns.current[i]) {
                 zoneCooldowns.current[i] = timestamp + 800;
                 activeZones.current[i] = true;
                 onZoneTriggerRef.current(i);
                 setTimeout(() => { activeZones.current[i] = false; }, 300);
             }
             
             zoneEnergy.current[i] *= 0.7;
        }

        const now = Date.now();
        if (now - lastUiUpdateRef.current > 100) {
             setUiZoneEnergy([...zoneEnergy.current]);
             setUiActiveZones([...activeZones.current]);
             setMotionLevel(Math.min(changedPixelCount / 20, 1));
             lastUiUpdateRef.current = now;
        }
    };

    return (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-12px] z-20 transition-all duration-300 ${isActive ? 'scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
            <div className="relative rounded-3xl overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.1)] bg-transparent w-[486px] h-[365px] group">
                
                <video ref={videoRef} className="hidden" playsInline muted />
                {/* CSS scales the small canvas up to fill the container */}
                <canvas ref={canvasRef} className="w-full h-full object-cover rendering-pixelated" style={{imageRendering: 'pixelated'}} />
                
                {!isModelLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="text-cyan-500 font-mono text-xs animate-pulse">INITIALIZING AI...</div>
                    </div>
                )}
                
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none p-2 gap-2">
                    {[0,1,2,3].map(i => (
                         <div key={i} className={`relative border-4 rounded-3xl transition-all duration-100 ${ZONE_STYLES[i].border} ${uiActiveZones[i] ? ZONE_STYLES[i].active : ''}`}>
                             <div 
                                className={`absolute bottom-4 ${ZONE_STYLES[i].bar} transition-all duration-75 ${i % 2 === 0 ? 'left-4' : 'right-4'} rounded-full`} 
                                style={{ width: '12px', height: `${Math.min(uiZoneEnergy[i]*80, 80)}%` }} 
                             />
                         </div>
                    ))}
                </div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                    <div className="w-4 h-4 border border-cyan-500/50 rounded-full flex items-center justify-center">
                        <div className="w-0.5 h-0.5 bg-cyan-500 rounded-full"></div>
                    </div>
                </div>
                
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-100" style={{ width: `${motionLevel * 100}%` }} />
            </div>
            
            {error && (
                <div className="absolute top-full mt-2 text-[8px] text-red-400 bg-black/90 p-2 rounded border border-red-500 shadow-lg backdrop-blur-sm">
                    {error}
                </div>
            )}
        </div>
    );
};

export default WebcamMotion;
