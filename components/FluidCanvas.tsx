import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PhysicsParams, VisualParams, VisualShape } from '../types';

interface Props {
  physics: PhysicsParams;
  visual: VisualParams;
  onUpdate: (x: number, y: number, speed: number, hardness: number, isClicked: boolean) => void;
  isPlaying: boolean;
  getAudioData?: () => Uint8Array | null;
  inputRef: React.MutableRefObject<{ 
      x: number; 
      y: number; 
      vx: number; 
      vy: number; 
      lastX: number; 
      lastY: number; 
      isClicked: boolean 
  }>;
  activeEffect?: number | null;
}

class Point {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  mass: number;
  phase: number; // For independent movement

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.originX = x;
    this.originY = y;
    this.vx = 0;
    this.vy = 0;
    this.mass = 1;
    this.phase = Math.random() * Math.PI * 2;
  }

  // Update uses World Coordinates for mouse
  update(worldMouse: { x: number; y: number; vx: number; vy: number }, physics: PhysicsParams, audioEnergy: number, isClicked: boolean, rawMouseSpeed: number) {
    // Distance to mouse (in World Space)
    const dx = worldMouse.x - this.x;
    const dy = worldMouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Interaction Radius boosts with audio and click
    const radius = 150 + (audioEnergy * 100) + (isClicked ? 100 : 0);
    
    // Use raw mouse speed for hardness calculation, as that represents user energy
    const normSpeed = Math.min(rawMouseSpeed / 30, 1); 
    let hardness = physics.thickeningFactor * normSpeed;
    if (isClicked) hardness += 0.2; // Artificial hardness on click
    
    // Repulsion/Attraction Force
    let force = 0;
    if (dist < radius) {
      force = (radius - dist) / radius;
      
      const pushX = worldMouse.vx * force * (0.1 + hardness * 0.5);
      const pushY = worldMouse.vy * force * (0.1 + hardness * 0.5);
      
      this.vx += pushX;
      this.vy += pushY;
    }

    // Add subtle audio jitter
    if (audioEnergy > 0.1) {
        this.vx += (Math.random() - 0.5) * audioEnergy * 2;
        this.vy += (Math.random() - 0.5) * audioEnergy * 2;
    }

    // Add Intense Wobble on Click
    if (isClicked) {
        this.vx += (Math.random() - 0.5) * 5;
        this.vy += (Math.random() - 0.5) * 5;
    }

    const springK = 0.02 + (hardness * 0.1); 
    const damp = 0.90 - (physics.viscosityBase * 0.1) - (hardness * 0.1); 

    const ax = (this.originX - this.x) * springK;
    const ay = (this.originY - this.y) * springK;

    this.vx += ax;
    this.vy += ay;
    
    this.vx *= damp;
    this.vy *= damp;

    this.x += this.vx;
    this.y += this.vy;
    
    return hardness; 
  }
}

class TrailParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
    decay: number;

    constructor(x: number, y: number, vx: number, vy: number, size: number, color: string, decay: number) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.life = 1.0;
        this.decay = decay;
    }
}

const FluidCanvas: React.FC<Props> = ({ physics, visual, onUpdate, isPlaying, getAudioData, inputRef, activeEffect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const trailsRef = useRef<TrailParticle[]>([]);
  const requestRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastInputTimeRef = useRef(Date.now());
  
  // Use refs for callbacks and rapidly changing props to stabilize the loop
  const onUpdateRef = useRef(onUpdate);
  const activeEffectRef = useRef(activeEffect);

  useEffect(() => {
      onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
      activeEffectRef.current = activeEffect;
  }, [activeEffect]);

  // Apply CSS-based filters (GPU accelerated) instead of Canvas filters (CPU intensive)
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 0=Invert, 4=Posterize
      if (activeEffect === 0) {
          canvas.style.filter = 'invert(1)';
      } else if (activeEffect === 4) {
          canvas.style.filter = 'contrast(2) saturate(2)';
      } else {
          canvas.style.filter = 'none';
      }
  }, [activeEffect]);

  // Initialize Grid & Event Listeners
  useEffect(() => {
    const initGrid = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Optimization: alpha: false creates an opaque background (usually black) and speeds up compositing
        const ctx = canvas.getContext('2d', { alpha: false });
        
        const gap = 50; // Performance optimization: Reduced particle density
        const cols = Math.ceil(window.innerWidth / gap);
        const rows = Math.ceil(window.innerHeight / gap);
        const pts = [];
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                pts.push(new Point(i * gap, j * gap));
            }
        }
        pointsRef.current = pts;
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Force initial opaque black background
        if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Init mouse to center
        if (inputRef.current.x === -1000) {
            inputRef.current.x = canvas.width / 2;
            inputRef.current.y = canvas.height / 2;
            inputRef.current.lastX = canvas.width / 2;
            inputRef.current.lastY = canvas.height / 2;
        }
    };

    const handleResize = () => initGrid();
    window.addEventListener('resize', handleResize);
    initGrid();
    
    // Global Input Handlers (Window level to ignore Z-index blocking)
    const handleMouseMove = (e: MouseEvent) => {
        inputRef.current.x = e.clientX;
        inputRef.current.y = e.clientY;
        lastInputTimeRef.current = Date.now();
    };
    
    const handleTouchMove = (e: TouchEvent) => {
        inputRef.current.x = e.touches[0].clientX;
        inputRef.current.y = e.touches[0].clientY;
        lastInputTimeRef.current = Date.now();
    };

    const handleMouseDown = (e: MouseEvent) => {
        inputRef.current.isClicked = true;
        inputRef.current.x = e.clientX;
        inputRef.current.y = e.clientY;
        lastInputTimeRef.current = Date.now();
    };
    
    const handleTouchStart = (e: TouchEvent) => {
        inputRef.current.isClicked = true;
        inputRef.current.x = e.touches[0].clientX;
        inputRef.current.y = e.touches[0].clientY;
        lastInputTimeRef.current = Date.now();
    };

    const handleUp = () => { 
        inputRef.current.isClicked = false;
        lastInputTimeRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
    };
  }, [inputRef]);
  
  // Reset camera when visual mode changes
  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
  }, [visual.cameraMode, visual.shape]);

  // Helper: Draw different shapes
  const drawShape = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shape: VisualShape) => {
      ctx.beginPath();
      switch (shape) {
          case 'circle':
              ctx.arc(x, y, Math.max(0, size), 0, Math.PI * 2);
              break;
          case 'square':
              ctx.rect(x - size, y - size, size * 2, size * 2);
              break;
          case 'triangle':
              ctx.moveTo(x, y - size);
              ctx.lineTo(x + size, y + size);
              ctx.lineTo(x - size, y + size);
              ctx.closePath();
              break;
          case 'hexagon':
              for (let i = 0; i < 6; i++) {
                  const angle = (Math.PI / 3) * i;
                  const px = x + size * Math.cos(angle);
                  const py = y + size * Math.sin(angle);
                  if (i === 0) ctx.moveTo(px, py);
                  else ctx.lineTo(px, py);
              }
              ctx.closePath();
              break;
          case 'cross':
              const w = size / 3;
              ctx.rect(x - w, y - size, w * 2, size * 2);
              ctx.rect(x - size, y - w, size * 2, w * 2);
              break;
          case 'star':
              const spikes = 5;
              const outer = size;
              const inner = size / 2;
              let rot = Math.PI / 2 * 3;
              let cx = x;
              let cy = y;
              let step = Math.PI / spikes;
              ctx.moveTo(cx, cy - outer);
              for (let i = 0; i < spikes; i++) {
                  cx = x + Math.cos(rot) * outer;
                  cy = y + Math.sin(rot) * outer;
                  ctx.lineTo(cx, cy);
                  rot += step;

                  cx = x + Math.cos(rot) * inner;
                  cy = y + Math.sin(rot) * inner;
                  ctx.lineTo(cx, cy);
                  rot += step;
              }
              ctx.lineTo(x, y - outer);
              ctx.closePath();
              break;
          default:
              ctx.arc(x, y, Math.max(0, size), 0, Math.PI * 2);
      }
  };

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    // use alpha: false here as well for consistency, although getContext returns the same context
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    // CRITICAL: Reset shadow and composite properties at the start of every frame.
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalCompositeOperation = 'source-over';

    frameCountRef.current++;
    const mouseState = inputRef.current;
    const isClicked = mouseState.isClicked;
    const currentActiveEffect = activeEffectRef.current;

    // --- IDLE AUTO-CENTERING ---
    const now = Date.now();
    const idleTime = now - lastInputTimeRef.current;
    
    // Start centering after 1.5s of inactivity
    if (idleTime > 1500 && !isClicked) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Time-based acceleration calculation
        const animTime = idleTime - 1500;
        // Ramp up over 3 seconds (0 to 1)
        const t = Math.min(1, animTime / 3000); 
        
        // AGGRESSIVE ACCELERATION (Magnetic Snap)
        // t^4 curve creates a very slow start and a very fast finish.
        // Cap at 0.2 (20% per frame) which is extremely fast, ensuring it speeds up as it gets closer.
        const factor = 0.2 * (t * t * t * t); 

        mouseState.x += (centerX - mouseState.x) * factor;
        mouseState.y += (centerY - mouseState.y) * factor;
    }

    // --- Audio Analysis ---
    let bassEnergy = 0;
    let highEnergy = 0;
    if (getAudioData) {
        const data = getAudioData();
        if (data) {
            // Simple average for Bass (bins 0-5)
            let b = 0;
            for(let i=0; i<5; i++) b += data[i];
            bassEnergy = (b / 5) / 255;

            // Highs (bins 100+)
            let h = 0;
            for(let i=100; i<128; i++) h += data[i];
            highEnergy = (h / 28) / 255;
        }
    }

    // --- Drawing ---
    
    // PARTICLE TRAIL SYSTEM (Replaces Alpha Fade)
    // Always clear opaque black to fix the gray background issue
    ctx.fillStyle = '#000000';
    
    // Reset transform before clearing to ensure full coverage
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- CAMERA CALCULATION ---
    const time = frameCountRef.current * 0.01;
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    let camX = 0;
    let camY = 0;
    let scale = 1;
    let rot = 0;

    let mode = visual.cameraMode;
    let renderStyle = visual.renderStyle;

    if (typeof currentActiveEffect === 'number') {
        if (currentActiveEffect === 1) { // Glitch
            mode = 'shake';
            camX += (Math.random() - 0.5) * 50; 
            camY += (Math.random() - 0.5) * 50;
        } else if (currentActiveEffect === 2) { // Mosaic
            renderStyle = 'mosaic';
        } else if (currentActiveEffect === 3) { // Scanlines
            renderStyle = 'scanner';
        }
    }

    switch (mode) {
        case 'sway':
            camX += Math.sin(time * 0.5) * 30;
            camY += Math.cos(time * 0.3) * 20;
            rot = Math.sin(time * 0.2) * 0.02;
            break;
        case 'drift':
            camX += (frameCountRef.current * 0.5) % 100; 
            break;
        case 'pulse':
            scale = 1 + (bassEnergy * 0.1);
            break;
        case 'zoom':
            scale = 1 + Math.sin(time * 0.2) * 0.1;
            break;
        case 'spin':
            rot = time * 0.1 + (bassEnergy * 0.2);
            scale = 0.8 + Math.sin(time) * 0.2;
            break;
        case 'shake':
             const shakeAmt = bassEnergy * 20;
             camX += (Math.random() - 0.5) * shakeAmt;
             camY += (Math.random() - 0.5) * shakeAmt;
             break;
    }

    if (isClicked || bassEnergy > 0.5) {
        const impact = isClicked ? 10 : (bassEnergy * 15);
        camX += (Math.random() - 0.5) * impact;
        camY += (Math.random() - 0.5) * impact;
    }

    // --- INPUT VELOCITY UPDATE (Screen Space) ---
    const dx = mouseState.x - mouseState.lastX;
    const dy = mouseState.y - mouseState.lastY;
    
    // Only smooth if we aren't jumping from uninitialized state
    if (mouseState.lastX > -100) {
        mouseState.vx = mouseState.vx * 0.3 + dx * 0.7;
        mouseState.vy = mouseState.vy * 0.3 + dy * 0.7;
    } else {
        mouseState.vx = 0; 
        mouseState.vy = 0;
    }
    mouseState.lastX = mouseState.x;
    mouseState.lastY = mouseState.y;

    const rawSpeed = Math.sqrt(mouseState.vx**2 + mouseState.vy**2);

    // --- COORDINATE TRANSFORMATION (Screen -> World) ---
    let wx = mouseState.x - centerX;
    let wy = mouseState.y - centerY;
    
    wx /= scale;
    wy /= scale;
    
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const rx = wx * cos - wy * sin;
    const ry = wx * sin + wy * cos;
    
    wx = rx - camX;
    wy = ry - camY;
    
    const worldMouseX = wx + centerX;
    const worldMouseY = wy + centerY;

    let wvx = mouseState.vx / scale;
    let wvy = mouseState.vy / scale;
    const rvx = wvx * cos - wvy * sin;
    const rvy = wvx * sin + wvy * cos;
    
    const worldMouse = {
        x: worldMouseX,
        y: worldMouseY,
        vx: rvx,
        vy: rvy
    };

    // --- APPLY CAMERA TRANSFORM (For Drawing) ---
    ctx.save();
    ctx.translate(centerX + camX, centerY + camY);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    // --- HARDNESS CALCULATION & APP UPDATE ---
    const normSpeed = Math.min(rawSpeed / 40, 1);
    const globalHardness = physics.thickeningFactor * normSpeed;
    
    if (isPlaying) {
        onUpdateRef.current(
            mouseState.x / canvas.width,
            mouseState.y / canvas.height,
            rawSpeed,
            globalHardness,
            isClicked
        );
    }

    // --- RENDER & UPDATE TRAIL PARTICLES ---
    for (let i = trailsRef.current.length - 1; i >= 0; i--) {
        const tp = trailsRef.current[i];
        tp.x += tp.vx;
        tp.y += tp.vy;
        tp.life -= tp.decay;
        
        if (tp.life <= 0) {
            trailsRef.current.splice(i, 1);
        } else {
            ctx.fillStyle = tp.color;
            ctx.globalAlpha = tp.life; // Fade out
            drawShape(ctx, tp.x, tp.y, tp.size * tp.life, visual.shape);
            ctx.fill(); // Ensure shape is filled
        }
    }
    ctx.globalAlpha = 1.0; // Reset

    // --- RENDER MAIN POINTS & SPAWN TRAILS ---
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 255, b: 255 };
    }

    const baseRgb = hexToRgb(physics.colorBase);
    const solidRgb = hexToRgb(physics.colorSolid);
    
    const drawPoints = () => {
         pointsRef.current.forEach(p => {
              // PASS WORLD MOUSE to physics update
              const localHardness = p.update(worldMouse, physics, bassEnergy, isClicked, rawSpeed);
              
              let r = baseRgb.r + (solidRgb.r - baseRgb.r) * localHardness;
              let g = baseRgb.g + (solidRgb.g - baseRgb.g) * localHardness;
              let b = baseRgb.b + (solidRgb.b - baseRgb.b) * localHardness;
              
              if (highEnergy > 0.1 || isClicked) {
                  const boost = isClicked ? 50 : (highEnergy * 100);
                  r = Math.min(255, r + boost);
                  g = Math.min(255, g + boost);
                  b = Math.min(255, b + boost);
              }
              
              // Reduced base size from 2 to 1.5 for a cleaner look when idle
              let size = 1.5 + localHardness * 3 + (bassEnergy * 3);
              
              const colorString = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
              ctx.fillStyle = colorString;
              
              // Spawn Trail Particle logic
              // REPLACED HARD LIMIT (10) WITH PROBABILISTIC LOGIC to fix Left-Side Bias
              // visual.trailLength is 0.05 (long) to 0.5 (short).
              // We want more trails if length is short? No, if length is long, they persist longer.
              const isMoving = Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5 || localHardness > 0.1;
              
              // 5% chance per frame for moving particles to spawn a trail.
              // This is uniform across the screen, avoiding the loop order bias.
              if (isMoving && Math.random() > 0.95) {
                  const decay = Math.max(0.01, visual.trailLength * 0.1); 
                  const tSize = size * 0.6;
                  trailsRef.current.push(new TrailParticle(p.x, p.y, p.vx * 0.1, p.vy * 0.1, tSize, colorString, decay));
              }

              // Glow optimization: Double draw instead of shadowBlur
              if (visual.glowIntensity > 0 && (localHardness > 0.1 || bassEnergy > 0.1)) {
                 const alpha = (localHardness + bassEnergy) * visual.glowIntensity * 0.5;
                 ctx.globalAlpha = alpha;
                 drawShape(ctx, p.x, p.y, size * 2, visual.shape);
                 ctx.fill();
                 ctx.globalAlpha = 1.0;
              } else {
                 // Ensure shadowBlur is 0 for particles if not glowing
                 ctx.shadowBlur = 0;
              }

              if (renderStyle === 'mosaic') {
                   ctx.fillRect(p.x - 15, p.y - 15, 35, 35);
              } else {
                   drawShape(ctx, p.x, p.y, size, visual.shape);
                   ctx.fill();
              }
        });
    };

    drawPoints();
    
    // Connections / Scanner Lines
    if ((visual.connectPoints || renderStyle === 'scanner') && (globalHardness > 0.1 || bassEnergy > 0.3 || isClicked || renderStyle === 'wireframe')) {
         const alpha = (globalHardness * 0.5) + (bassEnergy * 0.4) + (isClicked ? 0.3 : 0.1);
         ctx.strokeStyle = `rgba(${solidRgb.r}, ${solidRgb.g}, ${solidRgb.b}, ${Math.min(1, alpha)})`;
         ctx.lineWidth = visual.strokeWidth + (highEnergy * 2);
         
         ctx.beginPath();
         pointsRef.current.forEach((p, i) => {
             // Scanner style: just horizontal lines
             if (renderStyle === 'scanner') {
                  if (i % 50 !== 0 && pointsRef.current[i-1]) { // approximate row
                       ctx.moveTo(p.x, p.y);
                       ctx.lineTo(pointsRef.current[i-1].x, pointsRef.current[i-1].y);
                  }
                  return;
             }

             const distToMouse = Math.hypot(p.x - worldMouse.x, p.y - worldMouse.y);
             const range = 150 + (bassEnergy * 100) + (isClicked ? 100 : 0);
             
             if (distToMouse < range || renderStyle === 'wireframe') {
                 if (pointsRef.current[i+1] && Math.hypot(p.x - pointsRef.current[i+1].x, p.y - pointsRef.current[i+1].y) < 50) {
                     ctx.moveTo(p.x, p.y);
                     ctx.lineTo(pointsRef.current[i+1].x, pointsRef.current[i+1].y);
                 }
             }
         });
         ctx.stroke();
    }

    ctx.restore(); // END CAMERA TRANSFORM

    // --- CURSOR (Drawn in Screen Space so it sticks to the mouse) ---
    // Sets shadow properties for next frame if not reset
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'white';
    ctx.fillStyle = 'white';
    // Use raw screen mouseState here
    drawShape(ctx, mouseState.x, mouseState.y, 8 + (bassEnergy * 5), visual.shape === 'star' ? 'star' : 'circle');
    ctx.fill();

    requestRef.current = requestAnimationFrame(animate);
  }, [physics, visual, isPlaying, getAudioData, inputRef]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute top-0 left-0 w-full h-full touch-none cursor-crosshair z-0`}
      style={{ backgroundColor: 'black' }}
    />
  );
};

export default FluidCanvas;