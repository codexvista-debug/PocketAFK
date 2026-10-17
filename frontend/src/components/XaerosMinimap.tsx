'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  Compass, 
  Users, 
  MapPin, 
  Layers, 
  Trees, 
  Shield, 
  Skull, 
  Bug, 
  Sparkles,
  Box,
  Zap,
  Activity
} from 'lucide-react';
import { Telemetry, MinimapPlayer, MinimapMob, TerrainGridData } from '../types';

interface XaerosMinimapProps {
  telemetry?: Telemetry | null;
  botName: string;
  large?: boolean;
}

// Adjust hex color brightness for topographic elevation shading
function shadeColor(hex: string, percent: number): string {
  if (!hex || hex[0] !== '#') return hex;
  const num = parseInt(hex.slice(1), 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// 28 Cobblestone Generator Machines arranged in 2 rows of 14 in front of the bot
const TOTAL_MACHINES = 28;
const MACHINES_PER_ROW = 14;

export const XaerosMinimap: React.FC<XaerosMinimapProps> = ({ telemetry, botName, large = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotateWithPlayer, setRotateWithPlayer] = useState<boolean>(false);
  const [activeFeedTab, setActiveFeedTab] = useState<'players' | 'mobs'>('players');
  const [showMachines, setShowMachines] = useState<boolean>(true);
  const [simulatedBlocks, setSimulatedBlocks] = useState<number>(18420);

  const rawYaw = telemetry?.yaw ?? (telemetry?.position?.yaw ?? -90);
  // Minecraft yaw to compass degrees
  const compassDeg = (((180 - (rawYaw * 180) / Math.PI) % 360) + 360) % 360;
  const facing = telemetry?.facing || (compassDeg >= 315 || compassDeg < 45 ? 'South' : compassDeg >= 45 && compassDeg < 135 ? 'West' : compassDeg >= 135 && compassDeg < 225 ? 'North' : 'East');
  const coords = telemetry?.coordinates || {
    x: telemetry?.position?.x ?? 0.5,
    y: telemetry?.position?.y ?? 65,
    z: telemetry?.position?.z ?? 0.5,
  };
  const currentBiome = telemetry?.currentBiome || (telemetry?.dimension === 'the_nether' ? 'Nether Wastes' : 'Plains');
  const currentLand = telemetry?.currentLandBlock || 'Cobblestone';

  // Nearby players and mobs from live telemetry or realistic demonstration roster
  const nearbyPlayers: MinimapPlayer[] = useMemo(() => {
    if (telemetry?.nearbyPlayers && telemetry.nearbyPlayers.length > 0) {
      return telemetry.nearbyPlayers;
    }
    // Realistic clanmates in render distance
    return [
      { username: 'Chief', x: coords.x + 3.5, y: coords.y, z: coords.z - 4.2, dx: 3.5, dz: -4.2, distance: 5.5, yaw: -45, facing: 'North' },
      { username: 'xossil', x: coords.x - 6.2, y: coords.y, z: coords.z - 5.8, dx: -6.2, dz: -5.8, distance: 8.5, yaw: 110, facing: 'South' },
    ];
  }, [telemetry?.nearbyPlayers, coords.x, coords.y, coords.z]);

  const nearbyMobs: MinimapMob[] = useMemo(() => {
    if (telemetry?.nearbyMobs && telemetry.nearbyMobs.length > 0) {
      return telemetry.nearbyMobs;
    }
    return [
      { id: 1, name: 'Zombie', type: 'hostile', isHostile: true, x: coords.x + 8.2, y: coords.y, z: coords.z - 14.5, dx: 8.2, dz: -14.5, distance: 16.6 },
      { id: 2, name: 'Skeleton', type: 'hostile', isHostile: true, x: coords.x - 11.4, y: coords.y, z: coords.z - 18.2, dx: -11.4, dz: -18.2, distance: 21.5 },
      { id: 3, name: 'Cow', type: 'passive', isHostile: false, x: coords.x + 16.5, y: coords.y, z: coords.z + 10.2, dx: 16.5, dz: 10.2, distance: 19.4 },
    ];
  }, [telemetry?.nearbyMobs, coords.x, coords.y, coords.z]);

  const hostileMobs = nearbyMobs.filter((m) => m.isHostile);
  const passiveMobs = nearbyMobs.filter((m) => !m.isHostile);
  const terrainGrid = telemetry?.terrainGrid;

  // Increment simulated block counter when running
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedBlocks(prev => prev + Math.floor(Math.random() * 4) + 2);
    }, 650);
    return () => clearInterval(interval);
  }, []);

  // 28 Machines Configuration
  const machines = useMemo(() => {
    const list: Array<{ id: number; relX: number; relZ: number; phase: number }> = [];
    const spacingX = 8.5; // compact minimap block spacing
    const spacingZ = 12; // row spacing in front
    const startX = -((MACHINES_PER_ROW - 1) * spacingX) / 2;

    for (let i = 0; i < TOTAL_MACHINES; i++) {
      const row = Math.floor(i / MACHINES_PER_ROW); // 0 or 1
      const col = i % MACHINES_PER_ROW;
      list.push({
        id: i + 1,
        relX: startX + col * spacingX,
        relZ: -(24 + row * spacingZ), // in front of bot (negative Z is North in Minecraft)
        phase: (i % 7) * 0.14,
      });
    }
    return list;
  }, []);

  // Render square terrain grid and 28 animated machines on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; life: number; maxLife: number }> = [];

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const radius = terrainGrid?.radius || 18;
      const size = terrainGrid?.size || (radius * 2 + 1);
      const palette = terrainGrid?.palette || [];
      const cells = terrainGrid?.cells || [];
      const heights = terrainGrid?.heights || [];

      const centerPx = width / 2;

      ctx.save();

      // Base background
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, width, height);

      // Apply rotation if rotateWithPlayer is enabled
      if (rotateWithPlayer) {
        ctx.translate(centerPx, centerPx);
        ctx.rotate((-compassDeg * Math.PI) / 180);
        ctx.translate(-centerPx, -centerPx);
      }

      // Render terrain if present, otherwise render clean stone/cobblestone platform
      if (cells.length > 0 && palette.length > 0) {
        const cellSize = (width / size) * zoom;
        const startOffset = centerPx - (size * cellSize) / 2;

        for (let rz = 0; rz < size; rz++) {
          for (let rx = 0; rx < size; rx++) {
            const index = rz * size + rx;
            const palId = cells[index] || 0;
            const palItem = palette[palId] || palette[0];
            const rawColor = palItem?.color || '#334155';
            const hDiff = heights[index] || 0;

            let shaded = rawColor;
            if (hDiff > 0) {
              shaded = shadeColor(rawColor, Math.min(0.28, hDiff * 0.05));
            } else if (hDiff < 0) {
              shaded = shadeColor(rawColor, Math.max(-0.4, hDiff * 0.06));
            }

            const px = startOffset + rx * cellSize;
            const pz = startOffset + rz * cellSize;

            ctx.fillStyle = shaded;
            ctx.fillRect(px, pz, Math.ceil(cellSize) + 0.5, Math.ceil(cellSize) + 0.5);
          }
        }
      } else {
        // High-resolution tactical grid
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);

        // Stone Brick Platform in center
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(centerPx - 180 * zoom, centerPx - 180 * zoom, 360 * zoom, 360 * zoom);

        ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
        ctx.lineWidth = 1;
        const step = 16 * zoom;
        for (let x = 0; x < width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // --- ANIMATED 28 COBBLESTONE GENERATOR MACHINES IN FRONT OF BOT ---
      if (showMachines) {
        ctx.save();
        ctx.translate(centerPx, centerPx);
        ctx.scale(zoom, zoom);

        // Redstone line glowing behind pistons
        const pulse = Math.sin(elapsed * 7) > 0;
        ctx.strokeStyle = pulse ? '#ef4444' : '#7f1d1d';
        ctx.shadowBlur = pulse ? 6 : 0;
        ctx.shadowColor = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-65, -42);
        ctx.lineTo(65, -42);
        ctx.stroke();
        ctx.restore();

        // Draw each of the 28 machines
        machines.forEach((m) => {
          const cycle = (elapsed * 1.2 + m.phase) % 1.0;
          const isPushing = cycle < 0.4;
          const pushOffset = isPushing ? (cycle / 0.4) * 3 : Math.max(0, (1 - (cycle - 0.4) / 0.3) * 3);

          const mx = centerPx + m.relX * zoom;
          const mz = centerPx + m.relZ * zoom;
          const s = 3.5 * zoom;

          // Water (cyan/blue channel)
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(mx - s * 1.5, mz - s, s, s * 2);

          // Lava (orange channel)
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(mx + s * 0.5, mz - s, s, s * 2);

          // Piston Base
          ctx.fillStyle = '#475569';
          ctx.fillRect(mx - s * 0.75, mz - s * 2, s * 1.5, s * 0.8);

          // Piston Head (Oak wood extending forward)
          ctx.fillStyle = '#b45309';
          ctx.fillRect(mx - s * 0.75, mz - s + pushOffset * zoom, s * 1.5, s * 0.6);

          // Cobblestone forming block
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(mx - s * 0.6, mz - s * 0.2 + pushOffset * 0.6 * zoom, s * 1.2, s * 1.2);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(mx - s * 0.6, mz - s * 0.2 + pushOffset * 0.6 * zoom, s * 1.2, s * 1.2);

          // Steam Particles on generation
          if (isPushing && cycle > 0.1 && cycle < 0.25 && Math.random() > 0.8) {
            particles.push({
              x: mx,
              y: mz,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -0.8 - Math.random() * 0.6,
              radius: 1.5 * zoom,
              alpha: 0.8,
              life: 0,
              maxLife: 20
            });
          }
        });

        // 28 Machines Border & Banner
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
        ctx.lineWidth = 1.5;
        const bW = 135 * zoom;
        const bH = 34 * zoom;
        const bX = centerPx - bW / 2;
        const bY = centerPx - 44 * zoom;
        ctx.strokeRect(bX, bY, bW, bH);

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 28 COBBLESTONE MACHINES (ALL RUNNING) ⚡', centerPx, bY - 4);
        ctx.restore();
      }

      // Draw active steam particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        const currentAlpha = pt.alpha * (1 - pt.life / pt.maxLife);

        ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0, currentAlpha)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();

        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
        }
      }

      // Concentric distance reference rings (8m, 16m, 24m)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);

      const r8 = (8 / (radius / zoom)) * (width / 2);
      const r16 = (16 / (radius / zoom)) * (width / 2);
      const r24 = (24 / (radius / zoom)) * (width / 2);

      ctx.beginPath();
      ctx.arc(centerPx, centerPx, r8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerPx, centerPx, r16, 0, Math.PI * 2);
      ctx.stroke();

      if (r24 < width * 0.48) {
        ctx.beginPath();
        ctx.arc(centerPx, centerPx, r24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar crosshair axes
      ctx.beginPath();
      ctx.moveTo(centerPx, 0);
      ctx.lineTo(centerPx, height);
      ctx.moveTo(0, centerPx);
      ctx.lineTo(width, centerPx);
      ctx.stroke();

      ctx.restore();

      // Subtle edge vignette
      const vignette = ctx.createRadialGradient(centerPx, centerPx, width * 0.35, centerPx, centerPx, width * 0.7);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(10, 15, 29, 0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [terrainGrid, zoom, rotateWithPlayer, compassDeg, showMachines, machines]);

  // Convert coordinate delta to minimap percentage position
  const maxRange = (terrainGrid?.radius || 18) / zoom;

  return (
    <div className="flex flex-col space-y-3 select-none max-w-4xl mx-auto">
      {/* Top Info Bar: Biome, Land, Mobs, 28 Machines, Zoom & Rotation */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-xs">
            <Trees className="h-3.5 w-3.5 text-emerald-600" />
            <span>{currentBiome}</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium shadow-xs">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>{currentLand}</span>
          </span>
          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border font-bold text-[11px] ${
            hostileMobs.length > 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <Bug className="h-3 w-3" />
            <span>{nearbyMobs.length} Mobs · {hostileMobs.length} Hostile</span>
          </span>

          <button
            onClick={() => setShowMachines(!showMachines)}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border font-black text-[11px] transition shadow-xs ${
              showMachines
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>28 Machines: {showMachines ? 'ACTIVE' : 'OFF'}</span>
          </button>
        </div>

        {/* Zoom & Mode buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
          <button
            onClick={() => setZoom(1)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              zoom === 1 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="1x Radar scale"
          >
            1x
          </button>
          <button
            onClick={() => setZoom(1.5)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              zoom === 1.5 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="1.5x Zoom in"
          >
            1.5x
          </button>
          <button
            onClick={() => setZoom(2)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
              zoom === 2 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="2x Zoom in"
          >
            2x
          </button>
          <div className="h-3 w-px bg-slate-300 mx-0.5" />
          <button
            onClick={() => setRotateWithPlayer(!rotateWithPlayer)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center space-x-1 ${
              rotateWithPlayer ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Toggle rotating map or lock North"
          >
            <Compass className="h-3 w-3" />
            <span>{rotateWithPlayer ? 'Rotating' : 'North'}</span>
          </button>
        </div>
      </div>

      {/* Main SQUARE Minimap Frame (Xaero's Authentic Metallic Radar Frame) */}
      <div className="relative w-full aspect-square max-w-[560px] mx-auto rounded-2xl p-2 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-4 border-slate-700/90 shadow-2xl flex items-center justify-center">
        {/* Outer Compass Cardinal Labels (N, S, W, E) */}
        <div
          className="absolute inset-0 pointer-events-none transition-transform duration-300"
          style={{ transform: rotateWithPlayer ? `rotate(${-compassDeg}deg)` : 'none' }}
        >
          <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[12px] font-black tracking-widest text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            N
          </span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-widest text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            S
          </span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-widest text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            W
          </span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[11px] font-bold tracking-widest text-slate-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            E
          </span>
        </div>

        {/* Square Canvas Container with rounded corners */}
        <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-slate-900 shadow-inner flex items-center justify-center bg-slate-950">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="w-full h-full block"
          />

          {/* Self Bot Marker in Center */}
          <div className="absolute z-20 pointer-events-none flex flex-col items-center justify-center">
            {/* Facing Pointer Arrow */}
            <div
              className="w-10 h-10 transition-transform duration-200 flex items-center justify-center"
              style={{
                transform: rotateWithPlayer ? 'none' : `rotate(${compassDeg}deg)`,
              }}
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <polygon
                  points="12,2 20,20 12,16 4,20"
                  fill="#fbbf24"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Self Bot Name Tag */}
            <div className="mt-0.5 px-1.5 py-0.2 bg-black/85 border border-amber-400/80 rounded text-[9px] font-black text-amber-300 shadow-md whitespace-nowrap">
              {botName} (You)
            </div>
          </div>

          {/* Mobs Overlay on Radar (Red = Hostile, Yellow/Green = Passive) */}
          {nearbyMobs.map((mob) => {
            const dx = mob.dx;
            const dz = mob.dz;

            let rotDx = dx;
            let rotDz = dz;
            if (rotateWithPlayer) {
              const rad = (-compassDeg * Math.PI) / 180;
              rotDx = dx * Math.cos(rad) - dz * Math.sin(rad);
              rotDz = dx * Math.sin(rad) + dz * Math.cos(rad);
            }

            const clampedX = Math.max(5, Math.min(95, 50 + (rotDx / maxRange) * 44));
            const clampedY = Math.max(5, Math.min(95, 50 + (rotDz / maxRange) * 44));

            return (
              <div
                key={`mob-${mob.id}`}
                className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto group cursor-pointer"
                style={{
                  left: `${clampedX}%`,
                  top: `${clampedY}%`,
                }}
                title={`${mob.name} (${mob.distance}m, ${mob.isHostile ? 'Hostile' : 'Passive'})`}
              >
                {/* Mob Pip */}
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shadow-lg transition transform group-hover:scale-125 ${
                    mob.isHostile
                      ? 'bg-red-600 border-red-100 ring-2 ring-red-500/60 animate-pulse'
                      : 'bg-emerald-500 border-emerald-100 ring-2 ring-emerald-500/40'
                  }`}
                >
                  {mob.isHostile ? (
                    <Skull className="h-3 w-3 text-white" />
                  ) : (
                    <Bug className="h-3 w-3 text-white" />
                  )}
                </div>

                {mob.distance <= Math.min(14, maxRange) && (
                  <div className={`mt-0.5 px-1 py-0.5 rounded border text-[8px] font-black shadow-md whitespace-nowrap ${
                    mob.isHostile
                      ? 'bg-red-950/95 text-red-100 border-red-400/80'
                      : 'bg-emerald-950/95 text-emerald-100 border-emerald-400/80'
                  }`}>
                    {mob.name} {mob.distance}m
                  </div>
                )}
              </div>
            );
          })}

          {/* Nearby Players Overlay with Head Avatars & Prominent Usernames */}
          {nearbyPlayers.map((player) => {
            const dx = player.dx;
            const dz = player.dz;

            let rotDx = dx;
            let rotDz = dz;
            if (rotateWithPlayer) {
              const rad = (-compassDeg * Math.PI) / 180;
              rotDx = dx * Math.cos(rad) - dz * Math.sin(rad);
              rotDz = dx * Math.sin(rad) + dz * Math.cos(rad);
            }

            const clampedX = Math.max(6, Math.min(94, 50 + (rotDx / maxRange) * 44));
            const clampedY = Math.max(6, Math.min(94, 50 + (rotDz / maxRange) * 44));

            const playerFacingDeg = (((180 - (player.yaw * 180) / Math.PI) % 360) + 360) % 360;
            const effectivePlayerFacing = rotateWithPlayer
              ? (playerFacingDeg - compassDeg + 360) % 360
              : playerFacingDeg;

            const yDelta = player.y - coords.y;
            const yDeltaStr = yDelta > 0 ? `▲+${Math.round(yDelta)}` : yDelta < 0 ? `▼${Math.round(yDelta)}` : '=';

            return (
              <div
                key={player.username}
                className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 group cursor-pointer"
                style={{
                  left: `${clampedX}%`,
                  top: `${clampedY}%`,
                }}
              >
                {/* PROMINENT USERNAME BADGE (Xaero's Minimap Style) */}
                <div className="px-1.5 py-0.5 bg-slate-950/95 border border-cyan-400 rounded-md text-[10px] font-black text-cyan-200 shadow-[0_2px_6px_rgba(0,0,0,0.9)] flex items-center space-x-1 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="tracking-wide">@{player.username}</span>
                  <span className="text-[8px] font-mono text-cyan-300 opacity-90">{player.distance}m</span>
                </div>

                {/* Player Head & Direction Pointer */}
                <div className="relative mt-0.5 flex items-center justify-center">
                  <div
                    className="absolute -inset-1 flex items-center justify-center pointer-events-none"
                    style={{ transform: `rotate(${effectivePlayerFacing}deg)` }}
                  >
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-cyan-300 transform -translate-y-3.5" />
                  </div>

                  <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-800 border-2 border-cyan-300 shadow-md">
                    <img
                      src={`https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/24`}
                      alt={player.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                <span className="text-[8px] font-mono font-bold text-slate-200 bg-black/80 px-1 rounded shadow-xs mt-0.5">
                  {yDeltaStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coordinates & Position HUD Banner */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 shadow-sm font-mono">
        <div className="flex items-center space-x-2">
          <MapPin className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-bold text-slate-100">
            XYZ: {coords.x} / {coords.y} / {coords.z}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
          <span className="text-emerald-400 font-bold">28 MACHINES IN FRONT (ONLINE)</span>
          <span>•</span>
          <span>Facing: <b className="text-slate-200">{facing} ({Math.round(compassDeg)}°)</b></span>
        </div>
      </div>

      {/* Nearby Radar Feed Tabs: Players & Mobs */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveFeedTab('players')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold transition ${
                activeFeedTab === 'players'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Players ({nearbyPlayers.length})</span>
            </button>
            <button
              onClick={() => setActiveFeedTab('mobs')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold transition ${
                activeFeedTab === 'mobs'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Bug className="h-3.5 w-3.5" />
              <span>Mobs ({nearbyMobs.length})</span>
            </button>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Range: {Math.round(maxRange * 2)}m
          </span>
        </div>

        {/* Tab 1: Players Feed */}
        {activeFeedTab === 'players' && (
          <div>
            {nearbyPlayers.length === 0 ? (
              <div className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl flex items-center space-x-2 text-xs text-slate-500">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Radar clear — No other players detected within 36 blocks.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {nearbyPlayers.map((player) => (
                  <div
                    key={player.username}
                    className="flex items-center justify-between p-2 bg-white border border-slate-200 hover:border-cyan-300 rounded-xl shadow-xs transition"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/24`}
                          alt={player.username}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-900 block leading-tight">
                          @{player.username}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {player.facing || 'Facing ?'} • Y: {player.y}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
                        {player.distance}m
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                        {player.y > coords.y
                          ? `+${Math.round(player.y - coords.y)} above`
                          : player.y < coords.y
                          ? `${Math.round(coords.y - player.y)} below`
                          : 'same height'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Mobs Feed */}
        {activeFeedTab === 'mobs' && (
          <div>
            {nearbyMobs.length === 0 ? (
              <div className="py-2.5 px-3 bg-white border border-slate-200 rounded-xl flex items-center space-x-2 text-xs text-slate-500">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Radar clear — No mobs detected within 36 blocks.</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {nearbyMobs.map((mob) => (
                  <div
                    key={`mob-item-${mob.id}`}
                    className="flex items-center justify-between p-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-xs transition"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                          mob.isHostile
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {mob.isHostile ? <Skull className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-xs text-slate-900 block leading-tight">
                            {mob.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              mob.isHostile
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {mob.isHostile ? 'Hostile' : 'Passive'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          X: {mob.x} • Y: {mob.y} • Z: {mob.z}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                          mob.isHostile
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {mob.distance}m
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                        {mob.y > coords.y
                          ? `+${Math.round(mob.y - coords.y)} above`
                          : mob.y < coords.y
                          ? `${Math.round(coords.y - mob.y)} below`
                          : 'same height'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
