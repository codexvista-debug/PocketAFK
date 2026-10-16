'use client';

import React from 'react';
import { Zap, Home, MapPin, Skull, Gift } from 'lucide-react';

interface QuickCommandsProps {
  onSendCommand: (cmd: string) => void;
  disabled?: boolean;
}

const DEFAULT_COMMANDS = [
  { 
    label: '/afk', 
    command: '/afk', 
    icon: Zap, 
    color: 'bg-amber-500/10 text-amber-700 border-amber-300/80 hover:bg-amber-500/20 hover:border-amber-400' 
  },
  { 
    label: '/lifesteal', 
    command: '/lifesteal', 
    icon: Skull, 
    color: 'bg-rose-500/10 text-rose-700 border-rose-300/80 hover:bg-rose-500/20 hover:border-rose-400' 
  },
  { 
    label: '/afkrewards', 
    command: '/afkrewards', 
    icon: Gift, 
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/80 hover:bg-emerald-500/20 hover:border-emerald-400' 
  },
  { 
    label: '/home', 
    command: '/home', 
    icon: Home, 
    color: 'bg-sky-500/10 text-sky-700 border-sky-300/80 hover:bg-sky-500/20 hover:border-sky-400' 
  },
  { 
    label: '/spawn', 
    command: '/spawn', 
    icon: MapPin, 
    color: 'bg-purple-500/10 text-purple-700 border-purple-300/80 hover:bg-purple-500/20 hover:border-purple-400' 
  },
];

export const QuickCommands: React.FC<QuickCommandsProps> = ({ onSendCommand, disabled = false }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <span className="text-slate-600 text-[11px] font-bold shrink-0 uppercase tracking-wider pl-1">
        Quick Actions:
      </span>
      {DEFAULT_COMMANDS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.command}
            onClick={() => onSendCommand(item.command)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition shrink-0 shadow-2xs disabled:opacity-40 cursor-pointer ${item.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
