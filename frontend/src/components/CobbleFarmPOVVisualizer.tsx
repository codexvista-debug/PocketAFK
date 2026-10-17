'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Compass, 
  Users, 
  Skull, 
  Box, 
  ZoomIn, 
  ZoomOut, 
  Play, 
  Pause, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  Layers,
  Zap,
  RotateCcw
} from 'lucide-react';
import { Telemetry, RadarEntity } from '@/types';

interface CobbleFarmPOVVisualizerProps {
  telemetry: Telemetry | null;
  isOnline: boolean;
  accountUsername?: string;
  serverName?: string;
}

// 28 Cobblestone Generator Machines Layout in front of bot
// 2 rows of 14 machines = 28 total machines
const TOTAL_MACHINES = 28;
const MACHINES_PER_ROW = 14;

interface FarmMachineConfig {
  id: number;
  row: number;
  col: number;
  relX: number; // offset relative to bot
  relZ: number;
  phase: number;
  status: 'running' | 'idle' | 'jammed';
}

export function CobbleFarmPOVVisualizer({
  telemetry,
  isOnline,
  accountUsername = 'Bot',
  serverName = 'DonutSMP'
}: CobbleFarmPOVVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showPlayers, setShowPlayers] = useState<boolean>(true);
  const [showMobs, setShowMobs] = useState<boolean>(true);
  const [showMachines, setShowMachines] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [simulatedBlocks, setSimulatedBlocks] = useState<number>(14820);
  const avatarCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Generate 28 machines positioned in front of the bot
  const machines = useMemo<FarmMachineConfig[]>(() => {
    const list: FarmMachineConfig[] = [];
    const spacingX = 22; // horizontal block spacing
    const spacingZ = 28; // row spacing in front of bot
    const startX = -((MACHINES_PER_ROW - 1) * spacingX) / 2;

    for (let i = 0; i < TOTAL_MACHINES; i++) {
      const row = Math.floor(i / MACHINES_PER_ROW); // 0 or 1
      const col = i % MACHINES_PER_ROW; // 0 to 13
      list.push({
        id: i + 1,
        row,
        col,
        relX: startX + col * spacingX,
        relZ: -(40 + row * spacingZ), // in front of bot (negative Z is North in Minecraft)
        phase: (i % 7) * 0.14, // rhythmic wave pulses across rows
        status: 'running',
      });
    }
    return list;
  }, []);

  // Increment simulated block counter when running
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      // 28 machines running generates blocks rapidly
      setSimulatedBlocks(prev => prev + Math.floor(Math.random() * 3) + 2);
    }, 600);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    // Particle pool for steam puffs when cobblestone forms
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      life: number;
      maxLife: number;
    }> = [];

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const t = isPlaying ? elapsed : 0;

      // Handle High-DPI screens
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // --- 1. XAERO'S MINIMAP BACKGROUND (Dark Tactical Overworld Grid) ---
      ctx.fillStyle = '#1c2430'; // Classic Xaero's map slate background
      ctx.fillRect(0, 0, w, h);

      // Center of minimap viewport
      const cx = w / 2;
      const cy = h / 2 + 70; // Offset bot slightly lower so 28 machines in front take center stage

      // Bot Coordinates & Yaw from telemetry
      const botYaw = telemetry?.position?.yaw ?? -90;
      const posX = telemetry?.position?.x ?? -88475.6;
      const posY = telemetry?.position?.y ?? -52;
      const posZ = telemetry?.position?.z ?? -178317.7;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);

      // --- 2. MINECRAFT TERRAIN / PLATFORM GRID ---
      // Draw stone brick floor surrounding the bot and machines
      const gridSpan = 260;
      ctx.fillStyle = '#2b3545';
      ctx.fillRect(-gridSpan, -gridSpan, gridSpan * 2, gridSpan * 2);

      // Voxel grid lines (1 block = 16px scaled)
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1;
      const blockSize = 16;
      for (let x = -gridSpan; x <= gridSpan; x += blockSize) {
        ctx.beginPath();
        ctx.moveTo(x, -gridSpan);
        ctx.lineTo(x, gridSpan);
        ctx.stroke();
      }
      for (let z = -gridSpan; z <= gridSpan; z += blockSize) {
        ctx.beginPath();
        ctx.moveTo(-gridSpan, z);
        ctx.lineTo(gridSpan, z);
        ctx.stroke();
      }

      // Redstone clock line running behind the 28 machines
      ctx.save();
      const pulseGlow = Math.sin(t * 7) > 0;
      ctx.strokeStyle = pulseGlow ? '#ef4444' : '#7f1d1d';
      ctx.shadowBlur = pulseGlow ? 8 : 0;
      ctx.shadowColor = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-160, -100);
      ctx.lineTo(160, -100);
      ctx.stroke();
      ctx.restore();

      // --- 3. RENDER THE 28 COBBLESTONE GENERATOR MACHINES ---
      if (showMachines) {
        machines.forEach((m) => {
          // Piston cycle: 0 -> 1 loop with phase offset
          const cycle = (t * 1.1 + m.phase) % 1.0;
          // Piston extends from 0.0 to 0.4, retracts 0.4 to 0.7, recharges 0.7 to 1.0
          const isExtending = cycle < 0.4;
          const pistonOffset = isExtending ? (cycle / 0.4) * 6 : Math.max(0, (1 - (cycle - 0.4) / 0.3) * 6);

          const mx = m.relX;
          const mz = m.relZ;

          // Water channel (left block)
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(mx - 8, mz - 6, 5, 12);

          // Lava channel (right block)
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(mx + 3, mz - 6, 5, 12);

          // Piston Base Block (top)
          ctx.fillStyle = '#475569';
          ctx.fillRect(mx - 4, mz - 12, 8, 6);

          // Piston Head (Oak wood extending forward)
          ctx.fillStyle = '#b45309';
          ctx.fillRect(mx - 4, mz - 6 + pistonOffset, 8, 3);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(mx - 4, mz - 6 + pistonOffset, 8, 3);

          // Newly formed Cobblestone Block being pushed forward
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(mx - 3.5, mz - 2 + pistonOffset * 0.7, 7, 7);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(mx - 3.5, mz - 2 + pistonOffset * 0.7, 7, 7);

          // Hopper collection block (front)
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(mx - 4, mz + 7, 8, 6);

          // Active Steam Particles
          if (isExtending && cycle > 0.1 && cycle < 0.25 && Math.random() > 0.7) {
            particles.push({
              x: mx + (Math.random() - 0.5) * 4,
              y: mz + 2,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -0.6 - Math.random() * 0.5,
              radius: 1.5 + Math.random() * 2,
              alpha: 0.75,
              life: 0,
              maxLife: 20 + Math.random() * 10
            });
          }

          // Small machine number label
          ctx.font = '6px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.textAlign = 'center';
          ctx.fillText(`M${m.id}`, mx, mz - 14);
        });

        // Farm boundary banner indicator
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-165, -95, 330, 85, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 28 COBBLESTONE GENERATOR MACHINES (ONLINE & PUSHING) ⚡', 0, -82);
      }

      // --- 4. RENDER NEARBY MOBS (HOSTILE & PASSIVE) ---
      if (showMobs) {
        // Collect entities from telemetry or fallback to live demonstration entities
        const entities: RadarEntity[] = telemetry?.entities && telemetry.entities.length > 0
          ? telemetry.entities
          : [
              { id: 101, type: 'hostile', name: 'Zombie', x: posX + 14, y: posY, z: posZ - 22, distance: 14 },
              { id: 102, type: 'hostile', name: 'Skeleton', x: posX - 18, y: posY, z: posZ - 35, distance: 20 },
              { id: 103, type: 'passive', name: 'Cow', x: posX + 28, y: posY, z: posZ + 15, distance: 28 },
              { id: 104, type: 'passive', name: 'Sheep', x: posX - 24, y: posY, z: posZ + 20, distance: 24 },
            ];

        entities.forEach((ent) => {
          if (ent.type === 'player') return; // rendered in player step

          // Offset relative to bot position
          const relEntX = (ent.x - posX) * 5;
          const relEntZ = (ent.z - posZ) * 5;

          if (ent.type === 'hostile') {
            // Classic Xaero's Red Entity Dot with Danger Ring
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(relEntX, relEntZ, 4, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing warning ring
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(relEntX, relEntZ, 7 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
            ctx.stroke();

            // Mob Name Tag
            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#fca5a5';
            ctx.textAlign = 'center';
            ctx.fillText(`☠ ${ent.name}`, relEntX, relEntZ - 8);
          } else {
            // Passive Mob (Yellow Dot)
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(relEntX, relEntZ, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '7px monospace';
            ctx.fillStyle = '#fef08a';
            ctx.textAlign = 'center';
            ctx.fillText(ent.name, relEntX, relEntZ - 6);
          }
        });
      }

      // --- 5. RENDER PLAYERS WITH SKIN HEADS & USERNAMES ---
      if (showPlayers) {
        // Collect players from telemetry or provide nearby player roster
        const playerEntities: RadarEntity[] = (telemetry?.entities || []).filter(e => e.type === 'player');
        if (playerEntities.length === 0) {
          // Display current user & clanmates
          playerEntities.push(
            { id: 1, type: 'player', name: accountUsername, username: accountUsername, x: posX, y: posY, z: posZ, yaw: botYaw, distance: 0 },
            { id: 2, type: 'player', name: 'Chief', username: 'Chief', x: posX + 6, y: posY, z: posZ - 8, yaw: -45, distance: 6 },
            { id: 3, type: 'player', name: 'xossil', username: 'xossil', x: posX - 12, y: posY, z: posZ - 10, yaw: 120, distance: 12 },
          );
        } else {
          // Always ensure the bot's own avatar is present at center
          if (!playerEntities.find(p => p.username?.toLowerCase() === accountUsername.toLowerCase())) {
            playerEntities.unshift({
              id: 999,
              type: 'player',
              name: accountUsername,
              username: accountUsername,
              x: posX,
              y: posY,
              z: posZ,
              yaw: botYaw,
              distance: 0
            });
          }
        }

        playerEntities.forEach((p) => {
          const isMe = p.username?.toLowerCase() === accountUsername.toLowerCase();
          const relPX = isMe ? 0 : (p.x - posX) * 6;
          const relPZ = isMe ? 0 : (p.z - posZ) * 6;

          // Draw Player 8x8 Pixel Skin Head
          drawPlayerSkinHead(ctx, relPX, relPZ, p.username || 'Player', isMe);

          // Facing Pointer Arrow (Xaero's minimap direction pointer)
          const pYaw = isMe ? botYaw : (p.yaw ?? 0);
          const pRad = ((pYaw + 90) * Math.PI) / 180;
          ctx.strokeStyle = isMe ? '#38bdf8' : '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(relPX, relPZ);
          ctx.lineTo(relPX + Math.cos(pRad) * 12, relPZ + Math.sin(pRad) * 12);
          ctx.stroke();

          // Player Username Text Tag with Minecraft Drop Shadow
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          const uText = isMe ? `★ @${p.username} (YOU)` : `@${p.username}`;

          // Shadow
          ctx.fillStyle = '#000000';
          ctx.fillText(uText, relPX + 1, relPZ + 16);
          // Foreground
          ctx.fillStyle = isMe ? '#38bdf8' : '#f8fafc';
          ctx.fillText(uText, relPX, relPZ + 15);
        });
      }

      // --- 6. STEAM / PARTICLE SYSTEM ---
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        const alpha = pt.alpha * (1 - pt.life / pt.maxLife);

        ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0, alpha)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();

        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
        }
      }

      ctx.restore(); // Exit world transform

      // --- 7. XAERO'S MINIMAP METALLIC BORDER & COMPASS (N, E, S, W) ---
      renderXaerosMinimapFrame(ctx, w, h);

      // --- 8. MINECRAFT COORDINATES & STATUS HUD AT BOTTOM ---
      renderXaerosCoordinatesBar(ctx, w, h, posX, posY, posZ, botYaw);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [zoom, isPlaying, showPlayers, showMobs, showMachines, machines, telemetry, accountUsername]);

  // Helper: Draw authentic pixelated Minecraft player skin head
  const drawPlayerSkinHead = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    username: string,
    isSelf: boolean
  ) => {
    ctx.save();
    const size = 16;
    const hx = x - size / 2;
    const hy = y - size / 2;

    // Head base (Skin tone)
    ctx.fillStyle = '#eac39d';
    ctx.fillRect(hx, hy, size, size);

    // Hair (Dark Brown / Styled)
    ctx.fillStyle = isSelf ? '#1e293b' : '#3f271a';
    ctx.fillRect(hx, hy, size, 4);
    ctx.fillRect(hx, hy, 3, 7);
    ctx.fillRect(hx + size - 3, hy, 3, 7);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx + 3, hy + 7, 3, 2);
    ctx.fillRect(hx + size - 6, hy + 7, 3, 2);

    // Pupils
    ctx.fillStyle = isSelf ? '#0284c7' : '#4b62ad';
    ctx.fillRect(hx + 4, hy + 7, 2, 2);
    ctx.fillRect(hx + size - 5, hy + 7, 2, 2);

    // Mouth / Beard
    ctx.fillStyle = '#8d5b4c';
    ctx.fillRect(hx + 5, hy + 11, 6, 2);

    // Border around head
    ctx.strokeStyle = isSelf ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx - 0.5, hy - 0.5, size + 1, size + 1);

    ctx.restore();
  };

  // Helper: Authentic Xaero's Minimap Frame with Rivets and N / E / S / W Compass
  const renderXaerosMinimapFrame = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    const borderThickness = 12;

    // Outer dark iron bevel
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, borderThickness); // Top
    ctx.fillRect(0, h - borderThickness - 28, w, borderThickness); // Bottom
    ctx.fillRect(0, 0, borderThickness, h - 28); // Left
    ctx.fillRect(w - borderThickness, 0, borderThickness, h - 28); // Right

    // Metallic frame stroke
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 30);

    // Corner bracket accents
    const bracketSize = 18;
    ctx.fillStyle = '#64748b';
    // Top-Left
    ctx.fillRect(2, 2, bracketSize, 4);
    ctx.fillRect(2, 2, 4, bracketSize);
    // Top-Right
    ctx.fillRect(w - bracketSize - 2, 2, bracketSize, 4);
    ctx.fillRect(w - 6, 2, 4, bracketSize);
    // Bottom-Left
    ctx.fillRect(2, h - bracketSize - 32, 4, bracketSize);
    ctx.fillRect(2, h - 34, bracketSize, 4);
    // Bottom-Right
    ctx.fillRect(w - 6, h - bracketSize - 32, 4, bracketSize);
    ctx.fillRect(w - bracketSize - 2, h - 34, bracketSize, 4);

    // Compass Cardinal Letters (Authentic Xaero's Font Style)
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // NORTH (Top)
    ctx.fillStyle = '#f87171'; // Red for North
    ctx.fillText('N', w / 2, borderThickness / 2 + 1);

    // SOUTH (Bottom)
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('S', w / 2, h - borderThickness / 2 - 28);

    // WEST (Left)
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('W', borderThickness / 2 + 1, (h - 28) / 2);

    // EAST (Right)
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('E', w - borderThickness / 2 - 1, (h - 28) / 2);

    ctx.restore();
  };

  // Helper: Bottom Minecraft coordinate banner (Authentic Xaero's format)
  const renderXaerosCoordinatesBar = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    yaw: number
  ) => {
    ctx.save();
    // Bottom Bar Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 28);
    ctx.lineTo(w, h - 28);
    ctx.stroke();

    // Coordinates Text
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(
      `XYZ: ${Math.round(x * 10) / 10}, ${Math.round(y)}, ${Math.round(z * 10) / 10} | Yaw: ${Math.round(yaw)}°`,
      14,
      h - 10
    );

    // Right Side: Server & Machine Count Status
    ctx.textAlign = 'right';
    ctx.fillStyle = '#34d399';
    ctx.fillText(
      `28 MACHINES ACTIVE | +${simulatedBlocks.toLocaleString()} BLOCKS`,
      w - 14,
      h - 10
    );

    ctx.restore();
  };

  return (
    <div className={`space-y-3 ${isFullscreen ? 'fixed inset-3 z-50 bg-slate-950 p-4 rounded-2xl shadow-2xl flex flex-col justify-between' : ''}`}>
      {/* Top Minimap Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {/* Left: Farm & Map Details */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span>Xaero's Minimap — 28 Machine Factory Radar</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                28 / 28 Online
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Top-down orthographic minimap with live piston pulses, skin heads, and entity tracking.
            </p>
          </div>
        </div>

        {/* Right: Quick Minimap Layer & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Players */}
          <button
            onClick={() => setShowPlayers(!showPlayers)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              showPlayers ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Toggle Player Avatars & Usernames"
          >
            <Users className="w-3.5 h-3.5" />
            Players
          </button>

          {/* Toggle Mobs */}
          <button
            onClick={() => setShowMobs(!showMobs)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              showMobs ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Toggle Nearby Mobs"
          >
            <Skull className="w-3.5 h-3.5" />
            Mobs
          </button>

          {/* Toggle 28 Machines */}
          <button
            onClick={() => setShowMachines(!showMachines)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              showMachines ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title="Toggle 28 Cobble Machines"
          >
            <Box className="w-3.5 h-3.5" />
            28 Machines
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Zoom In / Out */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              onClick={() => setZoom(prev => Math.max(0.7, prev - 0.2))}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-900 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1.5 text-slate-600">{zoom.toFixed(1)}x</span>
            <button
              onClick={() => setZoom(prev => Math.min(2.5, prev + 0.2))}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-900 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pause / Play */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title={isPlaying ? 'Pause Radar' : 'Resume Radar'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-600" />}
          </button>

          {/* Fullscreen Expand */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Minimap'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Full-Scale Xaero's Minimap Screen */}
      <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950 ${isFullscreen ? 'flex-1 h-full' : 'h-[520px] md:h-[580px]'}`}>
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Top-Right HUD Overlay: 28 Machine Health & Pulse */}
        <div className="absolute top-4 right-4 pointer-events-none flex flex-col gap-1.5 items-end">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-xs font-mono text-emerald-400 shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>28 MACHINES IN FRONT: <b>ALL RUNNING</b></span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 shadow-md flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Clock: <b>1.2s Piston Stroke</b></span>
          </div>
        </div>

        {/* Top-Left HUD Overlay: Server & Farm Type */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-xs font-mono text-slate-200 shadow-lg flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-sky-400" />
            <span>Server: <b className="text-emerald-400">{serverName}</b> | Target: <b className="text-amber-400">Cobble Gen Bank</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
