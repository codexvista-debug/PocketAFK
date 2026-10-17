'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Eye, 
  Activity, 
  Radio, 
  Sparkles, 
  Play, 
  Pause, 
  Maximize2, 
  Minimize2, 
  Flame, 
  Droplets, 
  Box, 
  CheckCircle2, 
  AlertTriangle,
  Compass,
  Cpu,
  Layers,
  Zap
} from 'lucide-react';
import { Telemetry, FarmMachineState } from '@/types';

interface CobbleFarmPOVVisualizerProps {
  telemetry: Telemetry | null;
  isOnline: boolean;
  accountUsername?: string;
  serverName?: string;
}

type ViewMode = 'iso' | 'first_person' | 'radar';

export function CobbleFarmPOVVisualizer({
  telemetry,
  isOnline,
  accountUsername = 'Bot',
  serverName = 'DonutSMP'
}: CobbleFarmPOVVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('iso');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [particlesEnabled, setParticlesEnabled] = useState<boolean>(true);
  const [simulatedBlocks, setSimulatedBlocks] = useState<number>(1420);

  // Machine override/test states
  const [machineStates, setMachineStates] = useState<Record<string, { status: 'running' | 'idle' | 'jammed'; blocks: number }>>({
    north: { status: 'running', blocks: 355 },
    east: { status: 'running', blocks: 362 },
    south: { status: 'running', blocks: 348 },
    west: { status: 'running', blocks: 355 },
  });

  // Keep simulated block count ticking if online or playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedBlocks(prev => prev + 1);
      setMachineStates(prev => {
        const dirs = ['north', 'east', 'south', 'west'] as const;
        const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
        return {
          ...prev,
          [randomDir]: {
            ...prev[randomDir],
            blocks: prev[randomDir].blocks + 1
          }
        };
      });
    }, Math.max(200, Math.floor(1200 / speedMultiplier)));

    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier]);

  // Canvas render animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = performance.now();

    // Particle pool for steam, sparks, and item drops
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
      life: number;
      maxLife: number;
    }> = [];

    const spawnParticles = (x: number, y: number, type: 'steam' | 'spark' | 'drop', count = 2) => {
      if (!particlesEnabled) return;
      for (let i = 0; i < count; i++) {
        if (particles.length > 120) particles.shift();
        if (type === 'steam') {
          particles.push({
            x: x + (Math.random() - 0.5) * 12,
            y: y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.8 - Math.random() * 1.2,
            size: 3 + Math.random() * 4,
            alpha: 0.65,
            color: 'rgba(235, 240, 255,',
            life: 0,
            maxLife: 35 + Math.random() * 20,
          });
        } else if (type === 'spark') {
          particles.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.2 - Math.random() * 1.5,
            size: 2 + Math.random() * 2,
            alpha: 0.9,
            color: Math.random() > 0.4 ? 'rgba(255, 140, 0,' : 'rgba(255, 220, 50,',
            life: 0,
            maxLife: 25 + Math.random() * 15,
          });
        } else if (type === 'drop') {
          particles.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.8 + Math.random() * 0.8,
            size: 3,
            alpha: 0.85,
            color: 'rgba(140, 140, 140,',
            life: 0,
            maxLife: 30,
          });
        }
      }
    };

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const clockTime = isPlaying ? elapsed * speedMultiplier : 0;

      // Handle retina resolution
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear with Minecraft stone / cavern dark theme
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Coordinates and yaw from telemetry
      const botYaw = telemetry?.position?.yaw ?? -90;
      const botPitch = telemetry?.position?.pitch ?? 0;
      const botX = telemetry?.position?.x ?? -88475.6;
      const botY = telemetry?.position?.y ?? -52;
      const botZ = telemetry?.position?.z ?? -178317.7;

      if (viewMode === 'iso') {
        renderIsometricFarm(ctx, width, height, clockTime, botYaw, spawnParticles);
      } else if (viewMode === 'first_person') {
        renderFirstPersonPOV(ctx, width, height, clockTime, botYaw, botPitch, spawnParticles);
      } else if (viewMode === 'radar') {
        renderTacticalRadar(ctx, width, height, clockTime, botYaw);
      }

      // Update and draw floating particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const currentAlpha = p.alpha * (1 - p.life / p.maxLife);

        ctx.fillStyle = `${p.color} ${Math.max(0, currentAlpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [viewMode, isPlaying, speedMultiplier, particlesEnabled, machineStates, telemetry]);

  // --- RENDERER 1: 3D ISOMETRIC COBBLESTONE FARM ---
  const renderIsometricFarm = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    yaw: number,
    spawnParticle: (x: number, y: number, type: 'steam' | 'spark' | 'drop', c?: number) => void
  ) => {
    const cx = w / 2;
    const cy = h / 2 + 20;

    // Subtle isometric floor grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = -6; x <= 6; x++) {
      ctx.beginPath();
      const p1 = toIso(x * 32, -6 * 32, cx, cy);
      const p2 = toIso(x * 32, 6 * 32, cx, cy);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = -6; y <= 6; y++) {
      ctx.beginPath();
      const p1 = toIso(-6 * 32, y * 32, cx, cy);
      const p2 = toIso(6 * 32, y * 32, cx, cy);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Redstone wiring lines connecting the 4 machines
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ef4444';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -t * 12;

    ctx.beginPath();
    const northPt = toIso(0, -95, cx, cy);
    const eastPt = toIso(95, 0, cx, cy);
    const southPt = toIso(0, 95, cx, cy);
    const westPt = toIso(-95, 0, cx, cy);
    ctx.moveTo(northPt.x, northPt.y);
    ctx.lineTo(eastPt.x, eastPt.y);
    ctx.lineTo(southPt.x, southPt.y);
    ctx.lineTo(westPt.x, westPt.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 4 Cobblestone Generator Machines around the bot
    const machines = [
      { id: 'north', name: 'Machine #1 [North]', dx: 0, dy: -90, dir: 'N', phase: 0 },
      { id: 'east', name: 'Machine #2 [East]', dx: 90, dy: 0, dir: 'E', phase: 0.25 },
      { id: 'south', name: 'Machine #3 [South]', dx: 0, dy: 90, dir: 'S', phase: 0.5 },
      { id: 'west', name: 'Machine #4 [West]', dx: -90, dy: 0, dir: 'W', phase: 0.75 },
    ];

    // Render machines in sorted depth order
    machines.forEach((m) => {
      const state = machineStates[m.id] || { status: 'running', blocks: 350 };
      const isRunning = state.status === 'running';

      // Piston stroke animation cycle (0 -> 1)
      const cycle = isRunning ? (t * 0.9 + m.phase) % 1.0 : 0;
      // 0.0 - 0.35: Extension (push cobblestone forward)
      // 0.35 - 0.7: Retraction
      // 0.7 - 1.0: Dwell / generator cool-down
      let extension = 0;
      if (cycle < 0.35) {
        extension = cycle / 0.35; // Extending
      } else if (cycle < 0.7) {
        extension = 1.0 - (cycle - 0.35) / 0.35; // Retracting
      } else {
        extension = 0;
      }

      const mIso = toIso(m.dx, m.dy, cx, cy);

      // Piston Base Block
      drawIsoVoxel(ctx, m.dx, m.dy, 0, 24, 24, 20, cx, cy, '#475569', '#334155', '#1e293b');

      // Piston Head & Shaft extending towards the center
      const pushVec = { x: -Math.sign(m.dx) * extension * 16, y: -Math.sign(m.dy) * extension * 16 };
      drawIsoVoxel(
        ctx,
        m.dx + pushVec.x,
        m.dy + pushVec.y,
        4,
        18,
        18,
        10,
        cx, cy,
        '#b45309', // Oak wood head
        '#92400e',
        '#78350f'
      );

      // Water & Lava source blocks on the sides of the generator
      const sideOffset = m.dx === 0 ? { x: 28, y: 0 } : { x: 0, y: 28 };

      // Water block (flowing blue)
      drawIsoVoxel(
        ctx,
        m.dx + sideOffset.x,
        m.dy + sideOffset.y,
        0,
        18, 18, 14,
        cx, cy,
        'rgba(14, 165, 233, 0.85)',
        'rgba(2, 132, 199, 0.85)',
        'rgba(3, 105, 161, 0.85)'
      );

      // Lava block (molten orange)
      drawIsoVoxel(
        ctx,
        m.dx - sideOffset.x,
        m.dy - sideOffset.y,
        0,
        18, 18, 14,
        cx, cy,
        '#ea580c',
        '#c2410c',
        '#9a3412'
      );

      // Cobblestone forming block
      const cobblePos = {
        x: m.dx - Math.sign(m.dx || 0) * 22,
        y: m.dy - Math.sign(m.dy || 0) * 22,
      };
      drawIsoCobbleBlock(ctx, cobblePos.x, cobblePos.y, 0, 20, cx, cy);

      // Hopper below collecting line
      drawIsoVoxel(
        ctx,
        cobblePos.x,
        cobblePos.y,
        -16,
        16, 16, 12,
        cx, cy,
        '#374151',
        '#1f2937',
        '#111827'
      );

      // Particles during extension
      if (isRunning && cycle > 0.05 && cycle < 0.3) {
        spawnParticle(mIso.x, mIso.y - 12, 'steam', 1);
        if (Math.random() > 0.6) spawnParticle(mIso.x, mIso.y - 8, 'spark', 1);
        if (Math.random() > 0.7) spawnParticle(mIso.x, mIso.y + 6, 'drop', 1);
      }

      // Machine Status HUD Tag
      ctx.save();
      ctx.font = 'bold 10px monospace';
      const tagText = `${m.name}: ${isRunning ? (extension > 0.1 ? '⚡ PUSH' : '🟢 RUN') : '🔴 JAM'}`;
      const tagMetrics = ctx.measureText(tagText);
      const tagX = mIso.x - tagMetrics.width / 2;
      const tagY = mIso.y - 36;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isRunning ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tagX - 6, tagY - 11, tagMetrics.width + 12, 17, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isRunning ? '#34d399' : '#f87171';
      ctx.fillText(tagText, tagX, tagY + 2);
      ctx.restore();
    });

    // Central Bot in Isometric View
    renderIsometricBot(ctx, cx, cy, t, yaw);
  };

  // --- HELPER: Isometric 3D Projection Math ---
  const toIso = (x: number, y: number, cx: number, cy: number) => {
    return {
      x: cx + (x - y) * 1.0,
      y: cy + (x + y) * 0.55,
    };
  };

  const drawIsoVoxel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    w: number,
    l: number,
    h: number,
    cx: number,
    cy: number,
    topCol: string,
    leftCol: string,
    rightCol: string
  ) => {
    const hw = w / 2;
    const hl = l / 2;

    // Top Face
    const p1 = toIso(x - hw, y - hl, cx, cy);
    const p2 = toIso(x + hw, y - hl, cx, cy);
    const p3 = toIso(x + hw, y + hl, cx, cy);
    const p4 = toIso(x - hw, y + hl, cx, cy);

    const zOffset = z * 1.1;

    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - zOffset);
    ctx.lineTo(p2.x, p2.y - zOffset);
    ctx.lineTo(p3.x, p3.y - zOffset);
    ctx.lineTo(p4.x, p4.y - zOffset);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.stroke();

    // Left Face
    ctx.fillStyle = leftCol;
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y - zOffset);
    ctx.lineTo(p3.x, p3.y - zOffset);
    ctx.lineTo(p3.x, p3.y - zOffset + h);
    ctx.lineTo(p4.x, p4.y - zOffset + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Face
    ctx.fillStyle = rightCol;
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y - zOffset);
    ctx.lineTo(p2.x, p2.y - zOffset);
    ctx.lineTo(p2.x, p2.y - zOffset + h);
    ctx.lineTo(p3.x, p3.y - zOffset + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const drawIsoCobbleBlock = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    size: number,
    cx: number,
    cy: number
  ) => {
    drawIsoVoxel(ctx, x, y, z, size, size, size, cx, cy, '#94a3b8', '#64748b', '#475569');
    // Subtle cobblestone fleck texture
    const center = toIso(x, y, cx, cy);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(center.x - 4, center.y - z - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(center.x + 3, center.y - z - 4, 1.5, 0, Math.PI * 2);
    ctx.arc(center.x, center.y - z + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const renderIsometricBot = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    t: number,
    yaw: number
  ) => {
    const swing = Math.sin(t * 8) * 6;

    // Pedestal stand
    drawIsoVoxel(ctx, 0, 0, 0, 24, 24, 6, cx, cy, '#334155', '#1e293b', '#0f172a');

    // Bot Body (Teal shirt / Minecraft Steve)
    drawIsoVoxel(ctx, 0, 0, 8, 12, 10, 16, cx, cy, '#0284c7', '#0369a1', '#075985');

    // Bot Head (facing angle)
    const headYawRad = (yaw * Math.PI) / 180;
    const headOffsetX = Math.cos(headYawRad) * 3;
    const headOffsetY = Math.sin(headYawRad) * 3;
    drawIsoVoxel(ctx, headOffsetX, headOffsetY, 24, 10, 10, 10, cx, cy, '#fbcfe8', '#f472b6', '#db2777');

    // Swinging Arm with Diamond Pickaxe
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    const armPt = toIso(6, 4, cx, cy);
    ctx.beginPath();
    ctx.moveTo(armPt.x, armPt.y - 18);
    ctx.lineTo(armPt.x + 8 + swing, armPt.y - 10 + swing * 0.5);
    ctx.stroke();

    // Pickaxe head
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(armPt.x + 10 + swing, armPt.y - 10 + swing * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Nametag
    ctx.save();
    ctx.font = 'bold 11px monospace';
    const nameText = `@${accountUsername} (AFK)`;
    const metrics = ctx.measureText(nameText);
    const nx = cx - metrics.width / 2;
    const ny = cy - 54;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(nx - 6, ny - 11, metrics.width + 12, 18, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(nameText, nx, ny + 2);
    ctx.restore();
  };

  // --- RENDERER 2: FIRST-PERSON IN-GAME CAMERA (POV) ---
  const renderFirstPersonPOV = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    yaw: number,
    pitch: number,
    spawnParticle: (x: number, y: number, type: 'steam' | 'spark' | 'drop', c?: number) => void
  ) => {
    const cx = w / 2;
    const cy = h / 2;

    // Cavern Wall ahead
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stone ceiling & floor framing
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, 45);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h - 55, w, 55);

    // Left Chamber: Flowing Water Stream
    ctx.fillStyle = 'rgba(14, 165, 233, 0.65)';
    ctx.fillRect(w * 0.1, 45, w * 0.22, h - 100);
    // Water shimmer lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const lineY = 60 + ((t * 80 + i * 50) % (h - 130));
      ctx.beginPath();
      ctx.moveTo(w * 0.12, lineY);
      ctx.lineTo(w * 0.3, lineY + 6);
      ctx.stroke();
    }

    // Right Chamber: Flowing Molten Lava Stream
    ctx.fillStyle = 'rgba(234, 88, 12, 0.85)';
    ctx.fillRect(w * 0.68, 45, w * 0.22, h - 100);
    // Lava ember lines
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    for (let i = 0; i < 4; i++) {
      const lineY = 60 + ((t * 50 + i * 60) % (h - 130));
      ctx.beginPath();
      ctx.moveTo(w * 0.7, lineY);
      ctx.lineTo(w * 0.88, lineY + 8);
      ctx.stroke();
    }

    // Piston Head & Arm pushing from top-rear towards center
    const pistonCycle = (t * 0.9) % 1.0;
    const pistonPush = pistonCycle < 0.4 ? (pistonCycle / 0.4) : (1.0 - (pistonCycle - 0.4) / 0.4);
    const pistonY = 30 + pistonPush * 40;

    ctx.fillStyle = '#92400e'; // Oak wooden head
    ctx.fillRect(cx - 50, pistonY, 100, 24);
    ctx.strokeStyle = '#78350f';
    ctx.strokeRect(cx - 50, pistonY, 100, 24);

    // Metal shaft
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 12, 0, 24, pistonY);

    // Center Cobblestone Block right in front of the bot
    const blockSize = Math.min(180, w * 0.32);
    const blockX = cx - blockSize / 2;
    const blockY = cy - blockSize / 2 + 10;

    // Cobblestone Face
    ctx.fillStyle = '#64748b';
    ctx.fillRect(blockX, blockY, blockSize, blockSize);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(blockX, blockY, blockSize, blockSize);

    // Cobble texture pattern
    ctx.fillStyle = '#475569';
    for (let px = 0; px < 4; px++) {
      for (let py = 0; py < 4; py++) {
        if ((px + py) % 2 === 0) {
          ctx.fillRect(blockX + px * (blockSize / 4) + 6, blockY + py * (blockSize / 4) + 6, blockSize / 4 - 12, blockSize / 4 - 12);
        }
      }
    }

    // Breaking crack animation cycle (0% -> 100%)
    const crackCycle = (t * 2.5) % 1.0;
    if (crackCycle > 0.1) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 30);
      ctx.lineTo(cx - 20, cy);
      ctx.lineTo(cx + 15, cy + 25);
      if (crackCycle > 0.4) {
        ctx.lineTo(cx - 30, cy + 35);
        ctx.moveTo(cx, cy - 30);
        ctx.lineTo(cx + 25, cy - 10);
      }
      ctx.stroke();
    }

    // Steam & sparks at block junction
    if (Math.random() > 0.4) {
      spawnParticle(blockX + 10, cy, 'steam', 1);
      spawnParticle(blockX + blockSize - 10, cy, 'spark', 1);
    }

    // Crosshair (+)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // First-Person Pickaxe Swing in bottom right
    const swingAngle = Math.sin(t * 12) * 0.45;
    ctx.save();
    ctx.translate(w - 90, h - 30);
    ctx.rotate(-0.8 + swingAngle);

    // Pickaxe Handle (wood)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-6, -110, 12, 110);

    // Pickaxe Head (Diamond)
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(-45, -110);
    ctx.quadraticCurveTo(0, -135, 45, -110);
    ctx.lineTo(35, -95);
    ctx.quadraticCurveTo(0, -115, -35, -95);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // In-game HUD: Top Compass Ribbon
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(w * 0.25, 8, w * 0.5, 28);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.strokeRect(w * 0.25, 8, w * 0.5, 28);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const normYaw = Math.round(yaw);
    ctx.fillText(`Facing: [ ${getYawDirection(normYaw)} ] Yaw: ${normYaw}° | Pitch: ${Math.round(pitch)}°`, cx, 26);
    ctx.restore();

    // Action indicator pill
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.beginPath();
    ctx.roundRect(14, 12, 140, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('⛏️ MINING (AUTO-SWING)', 22, 28);
    ctx.restore();
  };

  // --- RENDERER 3: TACTICAL 2D RADAR BLUEPRINT ---
  const renderTacticalRadar = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    yaw: number
  ) => {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;

    // Dark grid background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Concentric range circles
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
      ctx.font = '9px monospace';
      ctx.fillText(`${Math.round(ratio * 12)}m`, cx + maxR * ratio + 3, cy - 3);
    });

    // Cross axes
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Rotating Radar Sweep Line
    const sweepAngle = t * 2.2;
    const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
    sweepGrad.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
    sweepGrad.addColorStop(0.15, 'rgba(14, 165, 233, 0.0)');
    sweepGrad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    // 4 Cobblestone Machines on Radar
    const radarMachines = [
      { id: 'north', label: 'GEN #1 [N]', x: cx, y: cy - maxR * 0.65 },
      { id: 'east', label: 'GEN #2 [E]', x: cx + maxR * 0.65, y: cy },
      { id: 'south', label: 'GEN #3 [S]', x: cx, y: cy + maxR * 0.65 },
      { id: 'west', label: 'GEN #4 [W]', x: cx - maxR * 0.65, y: cy },
    ];

    radarMachines.forEach((m) => {
      const state = machineStates[m.id];
      const isRunning = state?.status === 'running';

      // Pulse ring around active machines
      ctx.strokeStyle = isRunning ? '#34d399' : '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Piston vector arrow pointing towards bot
      const angleToCenter = Math.atan2(cy - m.y, cx - m.x);
      ctx.fillStyle = isRunning ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(m.x + Math.cos(angleToCenter) * 8, m.y + Math.sin(angleToCenter) * 8, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - 18);
    });

    // Center Bot Marker & FOV Cone
    const yawRad = ((yaw + 90) * Math.PI) / 180;
    const fov = (65 * Math.PI) / 180;

    // FOV Cone
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR * 0.5, yawRad - fov / 2, yawRad + fov / 2);
    ctx.closePath();
    ctx.fill();

    // Direction pointer
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(yawRad) * 26, cy + Math.sin(yawRad) * 26);
    ctx.stroke();

    // Bot center dot
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const getYawDirection = (yawDeg: number) => {
    let y = ((yawDeg % 360) + 360) % 360;
    if (y >= 337.5 || y < 22.5) return 'SOUTH';
    if (y >= 22.5 && y < 67.5) return 'SOUTH-WEST';
    if (y >= 67.5 && y < 112.5) return 'WEST';
    if (y >= 112.5 && y < 157.5) return 'NORTH-WEST';
    if (y >= 157.5 && y < 202.5) return 'NORTH';
    if (y >= 202.5 && y < 247.5) return 'NORTH-EAST';
    if (y >= 247.5 && y < 292.5) return 'EAST';
    return 'SOUTH-EAST';
  };

  const totalRunningMachines = Object.values(machineStates).filter(m => m.status === 'running').length;

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-4 z-50 bg-slate-900 p-6 rounded-2xl shadow-2xl overflow-y-auto' : ''}`}>
      {/* Visualizer Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setViewMode('iso')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              viewMode === 'iso'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            3D Farm Overview
          </button>

          <button
            onClick={() => setViewMode('first_person')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              viewMode === 'first_person'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            First-Person POV
          </button>

          <button
            onClick={() => setViewMode('radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              viewMode === 'radar'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Tactical Radar
          </button>
        </div>

        {/* Action & Speed Controls */}
        <div className="flex items-center gap-2">
          {/* Machine Speed Multiplier */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <span>Clock:</span>
            <button
              onClick={() => setSpeedMultiplier(0.5)}
              className={`px-1.5 py-0.5 rounded ${speedMultiplier === 0.5 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-200'}`}
            >
              0.5x
            </button>
            <button
              onClick={() => setSpeedMultiplier(1.0)}
              className={`px-1.5 py-0.5 rounded ${speedMultiplier === 1.0 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-200'}`}
            >
              1.0x
            </button>
            <button
              onClick={() => setSpeedMultiplier(1.5)}
              className={`px-1.5 py-0.5 rounded ${speedMultiplier === 1.5 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-200'}`}
            >
              1.5x
            </button>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title={isPlaying ? 'Pause Animation' : 'Resume Animation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-600" />}
          </button>

          {/* Particles Toggle */}
          <button
            onClick={() => setParticlesEnabled(!particlesEnabled)}
            className={`p-1.5 rounded-xl border transition ${
              particlesEnabled ? 'bg-amber-50 text-amber-600 border-amber-200' : 'border-slate-200 text-slate-400'
            }`}
            title="Toggle Steam & Ember Particles"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand View'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main High-Performance Canvas Viewport */}
      <div className="relative w-full h-[400px] md:h-[460px] rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Viewport Overlay Info HUD */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-emerald-400 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FARM MONITOR: <b>4 MACHINES RUNNING</b></span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-xs font-mono text-slate-300 shadow-md">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Redstone Clock: <b>1.2s Piston Pulse</b></span>
          </div>
        </div>

        {/* Viewport Overlay Bottom Telemetry Strip */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-300 shadow-md flex items-center gap-3">
            <span>Server: <b className="text-emerald-400">{serverName}</b></span>
            <span>Target: <b className="text-amber-400">Cobblestone AFK</b></span>
            <span>Rate: <b className="text-sky-400">~2,160 blocks/hr</b></span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-300 shadow-md">
            <span>Total Mined: <b className="text-emerald-400">+{simulatedBlocks.toLocaleString()}</b></span>
          </div>
        </div>
      </div>

      {/* Cobblestone Machines Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'north', name: 'Machine #1 [North]', dir: 'North', icon: Compass },
          { key: 'east', name: 'Machine #2 [East]', dir: 'East', icon: Compass },
          { key: 'south', name: 'Machine #3 [South]', dir: 'South', icon: Compass },
          { key: 'west', name: 'Machine #4 [West]', dir: 'West', icon: Compass },
        ].map((m) => {
          const state = machineStates[m.key] || { status: 'running', blocks: 350 };
          const isRunning = state.status === 'running';

          return (
            <div
              key={m.key}
              className={`p-4 rounded-2xl border transition-all shadow-xs ${
                isRunning
                  ? 'bg-white border-slate-200'
                  : 'bg-rose-50/50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{m.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">Piston Gen #{m.dir}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    isRunning
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {isRunning ? 'RUNNING' : 'OFFLINE'}
                </span>
              </div>

              {/* Piston Stroke & Production Metrics */}
              <div className="space-y-2 mt-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1 text-[11px]"><Zap className="w-3 h-3 text-amber-500" /> Piston Action:</span>
                  <span className="font-mono font-bold text-emerald-600">{isRunning ? 'Active Pushing' : 'Idle'}</span>
                </div>

                {/* Animated Piston Progress Indicator */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
                    style={{ width: isRunning ? '100%' : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Blocks Generated:</span>
                  <span className="font-mono font-bold text-slate-900">+{state.blocks}</span>
                </div>
              </div>

              {/* Quick toggle button */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    setMachineStates(prev => ({
                      ...prev,
                      [m.key]: {
                        ...prev[m.key],
                        status: isRunning ? 'idle' : 'running'
                      }
                    }));
                  }}
                  className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 transition"
                >
                  {isRunning ? 'Simulate Stop' : 'Resume Machine'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
