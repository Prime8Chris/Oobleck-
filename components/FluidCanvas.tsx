

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
  phase: number;

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

  update(worldMouse: { x: number; y: number; vx: number; vy: number }, physics: PhysicsParams, audioEnergy: number, isClicked: boolean, rawMouseSpeed: number) {
    const dx = worldMouse.x - this.x;
    const dy = worldMouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const radius = 150 + (audioEnergy * 100) + (isClicked ? 100 : 0);
    const normSpeed = Math.min(rawMouseSpeed / 30, 1); 
    let hardness = physics.thickeningFactor * normSpeed;
    if (isClicked) hardness += 0.2;
    
    let force = 0;
    if (dist < radius) {
      force = (radius - dist) / radius;
      const pushX = worldMouse.vx * force * (0.1 + hardness * 0.5);
      const pushY = worldMouse.vy * force * (0.1 + hardness * 0.5);
      this.vx += pushX;
      this.vy += pushY;
    }

    if (audioEnergy > 0.1) {
        this.vx += (Math.random() - 0.5) * audioEnergy * 2;
        this.vy += (Math.random() - 0.5) * audioEnergy * 2;
    }

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

const MAX_PARTICLES = 800; // Performance Cap

const FluidCanvas: React.FC<Props> = ({ physics, visual, onUpdate, isPlaying, getAudioData, inputRef, activeEffect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const trailsRef = useRef<TrailParticle[]>([]);
  const requestRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastInputTimeRef = useRef(Date.now());
  const cursorGlowRef = useRef<HTMLCanvasElement | null>(null);
  
  const onUpdateRef = useRef(onUpdate);
  const activeEffectRef = useRef(activeEffect);

  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { activeEffectRef.current = activeEffect; }, [activeEffect]);

  // Pre-render cursor glow sprite
  useEffect(() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
          const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 64, 64);
      }
      cursorGlowRef.current = c;
  }, []);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (activeEffect === 0) canvas.style.filter = 'invert(1)';
      else if (activeEffect === 4) canvas.style.filter = 'contrast(2) saturate(2)';
      else canvas.style.filter = 'none';
  }, [activeEffect]);

  useEffect(() => {
    const initGrid = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        
        // Dynamic Gap calculation to cap particle count
        const area = window.innerWidth * window.innerHeight;
        // Calculate gap such that (W/gap)*(H/gap) ~= MAX_PARTICLES
        // Area / gap^2 = MAX
        // gap = sqrt(Area / MAX)
        const minGap = 50;
        const calculatedGap = Math.sqrt(area / MAX_PARTICLES);
        const gap = Math.max(minGap, calculatedGap);

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
        
        if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
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
  
  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
  }, [visual.cameraMode, visual.shape]);

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
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    // Optimization: Ensure shadowBlur is ALWAYS 0 to prevent CPU rasterization
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalCompositeOperation = 'source-over';

    frameCountRef.current++;
    const mouseState = inputRef.current;
    const isClicked = mouseState.isClicked;
    const currentActiveEffect = activeEffectRef.current;

    const now = Date.now();
    const idleTime = now - lastInputTimeRef.current;
    
    if (idleTime > 1500 && !isClicked) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const animTime = idleTime - 1500;
        const t = Math.min(1, animTime / 3000); 
        const factor = 0.2 * (t * t * t * t); 
        mouseState.x += (centerX - mouseState.x) * factor;
        mouseState.y += (centerY - mouseState.y) * factor;
    }

    let bassEnergy = 0;
    let highEnergy = 0;
    if (getAudioData) {
        const data = getAudioData();
        if (data) {
            let b = 0; for(let i=0; i<5; i++) b += data[i];
            bassEnergy = (b / 5) / 255;
            let h = 0; for(let i=100; i<128; i++) h += data[i];
            highEnergy = (h / 28) / 255;
        }
    }
    
    const shakePower = Math.pow(bassEnergy, 2); 
    const maxShakeAmp = 25; 
    const clickShakeAmp = isClicked ? 10 : 0;
    const shakeVecX = (Math.random() - 0.5) * (shakePower * maxShakeAmp + clickShakeAmp);
    const shakeVecY = (Math.random() - 0.5) * (shakePower * maxShakeAmp + clickShakeAmp);

    ctx.fillStyle = '#000000';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const time = frameCountRef.current * 0.01;
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    let camX = 0; let camY = 0; let scale = 1; let rot = 0;
    let mode = visual.cameraMode;
    let renderStyle = visual.renderStyle;

    if (typeof currentActiveEffect === 'number') {
        if (currentActiveEffect === 1) { mode = 'shake'; camX += (Math.random() - 0.5) * 50; camY += (Math.random() - 0.5) * 50; }
        else if (currentActiveEffect === 2) { renderStyle = 'mosaic'; }
        else if (currentActiveEffect === 3) { renderStyle = 'scanner'; }
    }

    switch (mode) {
        case 'sway': camX += Math.sin(time * 0.5) * 30; camY += Math.cos(time * 0.3) * 20; rot = Math.sin(time * 0.2) * 0.02; break;
        case 'drift': camX += (frameCountRef.current * 0.5) % 100; break;
        case 'pulse': scale = 1 + (bassEnergy * 0.1); break;
        case 'zoom': scale = 1 + Math.sin(time * 0.2) * 0.1; break;
        case 'spin': rot = time * 0.1 + (bassEnergy * 0.2); scale = 0.8 + Math.sin(time) * 0.2; break;
        case 'shake': const shakeAmt = bassEnergy * 20; camX += (Math.random() - 0.5) * shakeAmt; camY += (Math.random() - 0.5) * shakeAmt; break;
    }

    const dx = mouseState.x - mouseState.lastX;
    const dy = mouseState.y - mouseState.lastY;
    
    if (mouseState.lastX > -100) {
        mouseState.vx = mouseState.vx * 0.3 + dx * 0.7;
        mouseState.vy = mouseState.vy * 0.3 + dy * 0.7;
    } else {
        mouseState.vx = 0; mouseState.vy = 0;
    }
    mouseState.lastX = mouseState.x;
    mouseState.lastY = mouseState.y;

    const rawSpeed = Math.sqrt(mouseState.vx**2 + mouseState.vy**2);

    let wx = mouseState.x - centerX;
    let wy = mouseState.y - centerY;
    wx /= scale; wy /= scale;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const rx = wx * cos - wy * sin;
    const ry = wx * sin + wy * cos;
    wx = rx - camX; wy = ry - camY;
    const worldMouseX = wx + centerX;
    const worldMouseY = wy + centerY;

    let wvx = mouseState.vx / scale;
    let wvy = mouseState.vy / scale;
    const rvx = wvx * cos - wvy * sin;
    const rvy = wvx * sin + wvy * cos;
    
    const worldMouse = { x: worldMouseX, y: worldMouseY, vx: rvx, vy: rvy };

    ctx.save();
    ctx.translate(centerX + camX, centerY + camY);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    const normSpeed = Math.min(rawSpeed / 40, 1);
    const globalHardness = physics.thickeningFactor * normSpeed;
    
    if (isPlaying) {
        onUpdateRef.current(mouseState.x / canvas.width, mouseState.y / canvas.height, rawSpeed, globalHardness, isClicked);
    }
    
    const getShakenPos = (x: number, y: number) => {
        const dist = Math.hypot(x - worldMouse.x, y - worldMouse.y);
        const shakeRadius = 300 + (bassEnergy * 200);
        const falloff = Math.max(0, 1 - dist / shakeRadius);
        return { x: x + shakeVecX * falloff, y: y + shakeVecY * falloff };
    };

    for (let i = trailsRef.current.length - 1; i >= 0; i--) {
        const tp = trailsRef.current[i];
        tp.x += tp.vx; tp.y += tp.vy; tp.life -= tp.decay;
        if (tp.life <= 0) {
            trailsRef.current.splice(i, 1);
        } else {
            ctx.fillStyle = tp.color;
            ctx.globalAlpha = tp.life; 
            drawShape(ctx, tp.x, tp.y, tp.size * tp.life, visual.shape);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0; 

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 255, b: 255 };
    }

    const baseRgb = hexToRgb(physics.colorBase);
    const solidRgb = hexToRgb(physics.colorSolid);
    
    const drawPoints = () => {
         pointsRef.current.forEach(p => {
              const localHardness = p.update(worldMouse, physics, bassEnergy, isClicked, rawSpeed);
              let r = baseRgb.r + (solidRgb.r - baseRgb.r) * localHardness;
              let g = baseRgb.g + (solidRgb.g - baseRgb.g) * localHardness;
              let b = baseRgb.b + (solidRgb.b - baseRgb.b) * localHardness;
              
              if (highEnergy > 0.1 || isClicked) {
                  const boost = isClicked ? 50 : (highEnergy * 100);
                  r = Math.min(255, r + boost); g = Math.min(255, g + boost); b = Math.min(255, b + boost);
              }
              
              let size = 1.5 + localHardness * 3 + (bassEnergy * 3);
              const colorString = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
              ctx.fillStyle = colorString;
              const { x: dx, y: dy } = getShakenPos(p.x, p.y);
              
              const isMoving = Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5 || localHardness > 0.1;
              if (isMoving && Math.random() > 0.95) {
                  const decay = Math.max(0.01, visual.trailLength * 0.1); 
                  const tSize = size * 0.6;
                  trailsRef.current.push(new TrailParticle(dx, dy, p.vx * 0.1, p.vy * 0.1, tSize, colorString, decay));
              }

              // Glow optimization: Double draw instead of shadowBlur (Performance critical)
              if (visual.glowIntensity > 0 && (localHardness > 0.1 || bassEnergy > 0.1)) {
                 const alpha = (localHardness + bassEnergy) * visual.glowIntensity * 0.5;
                 ctx.globalAlpha = alpha;
                 drawShape(ctx, dx, dy, size * 2, visual.shape);
                 ctx.fill();
                 ctx.globalAlpha = 1.0;
              }

              if (renderStyle === 'mosaic') {
                   ctx.fillRect(dx - 15, dy - 15, 35, 35);
              } else {
                   drawShape(ctx, dx, dy, size, visual.shape);
                   ctx.fill();
              }
        });
    };

    drawPoints();
    
    if ((visual.connectPoints || renderStyle === 'scanner') && (globalHardness > 0.1 || bassEnergy > 0.3 || isClicked || renderStyle === 'wireframe')) {
         const alpha = (globalHardness * 0.5) + (bassEnergy * 0.4) + (isClicked ? 0.3 : 0.1);
         ctx.strokeStyle = `rgba(${solidRgb.r}, ${solidRgb.g}, ${solidRgb.b}, ${Math.min(1, alpha)})`;
         ctx.lineWidth = visual.strokeWidth + (highEnergy * 2);
         ctx.beginPath();
         pointsRef.current.forEach((p, i) => {
             const { x: p1x, y: p1y } = getShakenPos(p.x, p.y);
             if (renderStyle === 'scanner') {
                  if (i % 50 !== 0 && pointsRef.current[i-1]) { 
                       const { x: p0x, y: p0y } = getShakenPos(pointsRef.current[i-1].x, pointsRef.current[i-1].y);
                       ctx.moveTo(p1x, p1y); ctx.lineTo(p0x, p0y);
                  }
                  return;
             }
             const distToMouse = Math.hypot(p.x - worldMouse.x, p.y - worldMouse.y);
             const range = 150 + (bassEnergy * 100) + (isClicked ? 100 : 0);
             if (distToMouse < range || renderStyle === 'wireframe') {
                 if (pointsRef.current[i+1] && Math.hypot(p.x - pointsRef.current[i+1].x, p.y - pointsRef.current[i+1].y) < 50) {
                     const { x: p2x, y: p2y } = getShakenPos(pointsRef.current[i+1].x, pointsRef.current[i+1].y);
                     ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y);
                 }
             }
         });
         ctx.stroke();
    }

    ctx.restore();

    // --- CURSOR (Optimized: No shadowBlur) ---
    const cursorSize = 16 + (bassEnergy * 10);
    // Draw Glow Sprite
    if (cursorGlowRef.current) {
        const glowSize = cursorSize * 4;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(cursorGlowRef.current, mouseState.x - glowSize/2, mouseState.y - glowSize/2, glowSize, glowSize);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.fillStyle = 'white';
    drawShape(ctx, mouseState.x, mouseState.y, cursorSize/2, visual.shape === 'star' ? 'star' : 'circle');
    ctx.fill();

    requestRef.current = requestAnimationFrame(animate);
  }, [physics, visual, isPlaying, getAudioData, inputRef]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [animate]);

  return (
    <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full touch-none cursor-crosshair z-0`} style={{ backgroundColor: 'black' }} />
  );
};

export default FluidCanvas;
