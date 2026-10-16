'use client';

import React from 'react';
import { Zap, Home, MapPin, Skull, Gift } from 'lucide-react';

interface QuickCommandsProps {
  onSendCommand: (cmd: string) => void;
  disabled?: boolean;
}

const DEFAULT_COMMANDS = [
  { label: '/afk', command: '/afk', icon: Zap, color: 'hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50/50' },
  { label: '/lifesteal', command: '/lifesteal', icon: Skull, color: 'hover:text-red-600 hover:border-red-300 hover:bg-red-50/50' },
  { label: '/afkrewards', command: '/afkrewards', icon: Gift, color: 'hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50' },
  { label: '/home', command: '/home', icon: Home, color: 'hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50' },
  { label: '/spawn', command: '/spawn', icon: MapPin, color: 'hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/50' },
];

export const QuickCommands: React.FC<QuickCommandsProps> = ({ onSendCommand, disabled = false }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <span className="text-slate-600 text-[11px] font-bold shrink-0 uppercase tracking-wider pl-1">
        Quick:
      </span>
      {DEFAULT_COMMANDS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.command}
            onClick={() => onSendCommand(item.command)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-mono font-semibold transition shrink-0 shadow-2xs disabled:opacity-40 cursor-pointer ${item.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
