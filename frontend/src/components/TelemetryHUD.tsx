'use client';

import React from 'react';
import { Telemetry } from '../types';
import { Heart, Utensils, Compass, Globe, Activity } from 'lucide-react';

interface TelemetryHUDProps {
  telemetry: Telemetry | null;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry }) => {
  if (!telemetry) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-500 shadow-xs">
        <span className="font-medium">Bot not connected to world. Telemetry offline.</span>
        <span className="font-mono text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          waiting for spawn...
        </span>
      </div>
    );
  }

  const healthPercent = Math.max(0, Math.min(100, (telemetry.health / telemetry.maxHealth) * 100));
  const foodPercent = Math.max(0, Math.min(100, (telemetry.food / 20) * 100));

  const getDimensionBadge = (dim: string) => {
    if (dim.includes('nether')) return 'bg-red-50 text-red-700 border-red-200';
    if (dim.includes('end')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* Health Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            Health
          </span>
          <span className="font-mono font-bold text-red-600">
            {Math.round(telemetry.health)} / {telemetry.maxHealth}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="bg-red-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Hunger Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Utensils className="w-3.5 h-3.5 text-amber-500" />
            Hunger
          </span>
          <span className="font-mono font-bold text-amber-600">
            {Math.round(telemetry.food)} / 20
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="bg-amber-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${foodPercent}%` }}
          />
        </div>
      </div>

      {/* Position Coordinates */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
          <Compass className="w-3.5 h-3.5 text-sky-600" />
          Coordinates
        </div>
        <div className="font-mono text-xs text-slate-800 font-medium truncate">
          X: <span className="text-sky-600 font-bold">{telemetry.position.x}</span> Y: <span className="text-emerald-600 font-bold">{telemetry.position.y}</span> Z: <span className="text-purple-600 font-bold">{telemetry.position.z}</span>
        </div>
      </div>

      {/* Dimension & Ping */}
      <div className="space-y-1 flex flex-col justify-center">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            World
          </span>
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-600" />
            {telemetry.ping}ms
          </span>
        </div>
        <div>
          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getDimensionBadge(telemetry.dimension)}`}>
            {telemetry.dimension.replace('minecraft:', '')}
          </span>
        </div>
      </div>
    </div>
  );
};
