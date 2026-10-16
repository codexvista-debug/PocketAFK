'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Check, Sparkles, Terminal as TerminalIcon, Tag } from 'lucide-react';
import { QuickCommandItem } from '@/types';

export const DEFAULT_QUICK_COMMANDS: QuickCommandItem[] = [
  { cmd: '/afk', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white' },
  { cmd: '/lifesteal', color: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white' },
  { cmd: '/home', color: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white' },
  { cmd: '/spawn', color: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-600 hover:text-white' },
  { cmd: '/tpa accept', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white' },
  { cmd: '/tpdeny', color: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white' },
  { cmd: '/help', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-600 hover:text-white' },
  { cmd: '/resourcepack', color: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-700 hover:text-white' },
];

export const COLOR_OPTIONS = [
  { name: 'Emerald', value: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white', dot: 'bg-emerald-500' },
  { name: 'Rose', value: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white', dot: 'bg-rose-500' },
  { name: 'Amber', value: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white', dot: 'bg-amber-500' },
  { name: 'Sky', value: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-600 hover:text-white', dot: 'bg-sky-500' },
  { name: 'Indigo', value: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-600 hover:text-white', dot: 'bg-indigo-500' },
  { name: 'Purple', value: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-600 hover:text-white', dot: 'bg-purple-500' },
  { name: 'Slate', value: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-700 hover:text-white', dot: 'bg-slate-500' },
];

const POPULAR_PRESETS = [
  '/afk',
  '/home',
  '/spawn',
  '/sethome',
  '/tpa accept',
  '/tpdeny',
  '/lifesteal',
  '/kit',
  '/sell',
  '/sellall',
  '/shop',
  '/warp',
  '/wild',
  '/balance',
  '/pay',
  '/trade',
  '/help',
];

interface QuickCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  initialCommands?: QuickCommandItem[];
  onSave: (commands: QuickCommandItem[]) => void;
}

export const QuickCommandsModal: React.FC<QuickCommandsModalProps> = ({
  isOpen,
  onClose,
  serverName,
  initialCommands,
  onSave,
}) => {
  const [commands, setCommands] = useState<QuickCommandItem[]>([]);
  const [newCmd, setNewCmd] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0].value);

  useEffect(() => {
    if (isOpen) {
      if (initialCommands && initialCommands.length > 0) {
        setCommands(initialCommands);
      } else {
        setCommands(DEFAULT_QUICK_COMMANDS);
      }
      setNewCmd('');
    }
  }, [isOpen, initialCommands]);

  if (!isOpen) return null;

  const handleAddCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let text = newCmd.trim();
    if (!text) return;

    if (!text.startsWith('/')) {
      text = `/${text}`;
    }

    // Check duplicate
    if (commands.some((c) => c.cmd.toLowerCase() === text.toLowerCase())) {
      setNewCmd('');
      return;
    }

    setCommands((prev) => [...prev, { cmd: text, color: selectedColor }]);
    setNewCmd('');
  };

  const handleAddPreset = (cmdText: string) => {
    if (commands.some((c) => c.cmd.toLowerCase() === cmdText.toLowerCase())) return;
    const randomColor = COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].value;
    setCommands((prev) => [...prev, { cmd: cmdText, color: randomColor }]);
  };

  const handleRemoveCommand = (index: number) => {
    setCommands((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResetDefaults = () => {
    setCommands(DEFAULT_QUICK_COMMANDS);
  };

  const handleSave = () => {
    onSave(commands);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
              <TerminalIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>Quick Commands</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {serverName}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Custom macros for this server profile. Saved in Supabase across devices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Add New Command Input */}
          <form onSubmit={handleAddCommand} className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Command Macro</span>
              </label>
              <div className="flex items-center gap-1.5">
                {COLOR_OPTIONS.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => setSelectedColor(col.value)}
                    className={`w-4 h-4 rounded-full ${col.dot} transition cursor-pointer ${
                      selectedColor === col.value ? 'ring-2 ring-slate-800 ring-offset-1 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={col.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCmd}
                onChange={(e) => setNewCmd(e.target.value)}
                placeholder="e.g. /home, /sellall, /trade"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!newCmd.trim()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          {/* Current Server Commands */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Active Macros ({commands.length})</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            {commands.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No quick commands yet. Add one above or select from popular presets below.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs max-h-48 overflow-y-auto">
                {commands.map((cmdObj, idx) => (
                  <div
                    key={`${cmdObj.cmd}-${idx}`}
                    className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold shadow-2xs transition ${
                      cmdObj.color || 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span>{cmdObj.cmd}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCommand(idx)}
                      className="text-slate-400 hover:text-rose-600 ml-0.5 transition cursor-pointer"
                      title="Remove command"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Suggestions / Presets */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600 block">Popular Minecraft Command Presets</span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_PRESETS.map((p) => {
                const isAlreadyAdded = commands.some((c) => c.cmd.toLowerCase() === p.toLowerCase());
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => handleAddPreset(p)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                      isAlreadyAdded
                        ? 'bg-slate-100 text-slate-400 border border-slate-200'
                        : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    <span>{p}</span>
                    {isAlreadyAdded ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Quick Commands</span>
          </button>
        </div>
      </div>
    </div>
  );
};
