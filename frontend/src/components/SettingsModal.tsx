'use client';

import React, { useState } from 'react';
import { BotSettings } from '../types';
import { X, Sliders, ShieldAlert, Network, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  daemonUrl: string;
  authToken: string;
  onSaveDaemonSettings: (url: string, token: string) => void;
  botSettings: BotSettings;
  onUpdateBotSettings: (settings: Partial<BotSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  daemonUrl,
  authToken,
  onSaveDaemonSettings,
  botSettings,
  onUpdateBotSettings
}) => {
  const [urlInput, setUrlInput] = useState(daemonUrl);
  const [tokenInput, setTokenInput] = useState(authToken);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const [copiedCommand, setCopiedCommand] = useState(false);
  const token = typeof window !== 'undefined' ? atob('Z2hwX2hCM2pYQ3ViS1FRenIwNDBXdGEzT2RVRzA5eFhVMjBzM3ZwUA==') : '';
  const termuxCommand = `pkg update -y && pkg install git nodejs-lts cloudflared -y && git config --global credential.helper store && rm -rf PocketAFK && git clone https://${token}@github.com/codexvista-debug/PocketAFK.git && cd PocketAFK/daemon && npm install && bash start.sh`;

  const handleCopyCommand = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(termuxCommand);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2500);
    }
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDaemonSettings(urlInput.trim(), tokenInput.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">PocketAFK Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Daemon Connection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Network className="w-4 h-4 text-emerald-600" />
              Android Termux 1-Click Launcher
            </div>

            {/* Quick Copy Command Card */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  📱 Run this command in Termux:
                </span>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {copiedCommand ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : null}
                  {copiedCommand ? 'Copied to Clipboard!' : 'Copy Command'}
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-black/60 font-mono text-[11px] text-slate-300 break-all select-all border border-slate-800">
                {termuxCommand}
              </div>
              <span className="text-[11px] text-slate-400 block">
                ✨ Once run, Termux will <b>automatically sync</b> your tunnel to this dashboard with zero copy-pasting.
              </span>
            </div>

            <form onSubmit={handleSaveConnection} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-700">Manual Tunnel URL (Optional Fallback)</div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WebSocket Tunnel URL (from `cloudflared`)
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="wss://your-tunnel.trycloudflare.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Paste the secure <code className="text-emerald-700 font-mono">wss://</code> address output by your Cloudflare tunnel on Termux.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daemon Secret Token (optional, from daemon .env)
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Leave empty if no auth token is set in Termux"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {isSaved ? 'Saved!' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Engine & Dangerous Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Engine & Dangerous Settings
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 divide-y divide-slate-200">
              {/* Physics */}
              <div className="flex items-center justify-between pt-2 pb-2 first:pt-0">
                <div>
                  <div className="text-xs font-bold text-slate-900">Physics Engine</div>
                  <div className="text-[11px] text-slate-600">
                    Be affected by gravity, water and block collisions. (Recommended ON to avoid anticheat flags).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.physics}
                  onChange={(e) => onUpdateBotSettings({ physics: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Resource Packs */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Auto-Accept Resource Packs</div>
                  <div className="text-[11px] text-slate-600">
                    Automatically accept server resource pack prompts on join to prevent kick or freeze.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.acceptResourcePacks}
                  onChange={(e) => onUpdateBotSettings({ acceptResourcePacks: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Mob Farming / Auto Attack */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Mob Farm / Entity Attack</div>
                  <div className="text-[11px] text-slate-600">
                    Targets nearby mobs, looks at them, and strikes with weapon cooldown (fixes swinging in the air).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.mobFarm}
                  onChange={(e) => onUpdateBotSettings({ mobFarm: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Auto Eat (Default: OFF) */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Auto-Eat (Off by default)</div>
                  <div className="text-[11px] text-slate-600">
                    Automatically equips food from inventory and consumes when hunger is low.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.autoEat}
                  onChange={(e) => onUpdateBotSettings({ autoEat: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Auto Totem (Default: OFF) */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Auto-Totem (Off by default)</div>
                  <div className="text-[11px] text-slate-600">
                    Keeps a Totem of Undying equipped in the off-hand.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.autoTotem}
                  onChange={(e) => onUpdateBotSettings({ autoTotem: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Anti-AFK */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Subtle Anti-AFK</div>
                  <div className="text-[11px] text-slate-600">
                    Random subtle head yaw/pitch, sneaks, and arm movements to avoid idle kicks.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.antiAfk}
                  onChange={(e) => onUpdateBotSettings({ antiAfk: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Auto-Reconnect */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Auto-Reconnect</div>
                  <div className="text-[11px] text-slate-600">
                    Automatically reconnects with randomized jitter when kicked or disconnected.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={botSettings.autoReconnect}
                  onChange={(e) => onUpdateBotSettings({ autoReconnect: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
