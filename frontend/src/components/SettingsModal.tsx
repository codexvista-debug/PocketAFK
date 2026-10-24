'use client';

import React, { useState } from 'react';
import { X, Network, Check, Copy, Terminal, ChevronDown } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  daemonUrl: string;
  authToken: string;
  onSaveDaemonSettings: (url: string, token: string) => void;
  termuxCommand?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  daemonUrl,
  authToken,
  onSaveDaemonSettings,
  termuxCommand = 'curl -sL https://pocketafk.vercel.app/install | bash',
}) => {
  const [urlInput, setUrlInput] = useState(daemonUrl);
  const [tokenInput, setTokenInput] = useState(authToken);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);

  // Sync inputs when props change
  React.useEffect(() => {
    setUrlInput(daemonUrl);
  }, [daemonUrl]);

  React.useEffect(() => {
    setTokenInput(authToken);
  }, [authToken]);

  if (!isOpen) return null;

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
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">Termux Daemon Bridge</h2>
              <p className="text-[11px] text-slate-500">Connect and sync your Android Termux background runner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Section 1: Android Termux 1-Click Launcher (Light Mode Styled) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <span>Android Termux 1-Click Launcher</span>
            </div>

            {/* Quick Copy Command Card - Modern Light Mode */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 p-4 rounded-2xl border border-emerald-200/90 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="pa-settings-command-label text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>📱</span> Run this command in Termux:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCommand ? 'Copied to Clipboard!' : 'Copy Command'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/90 font-mono text-[11px] text-slate-800 break-all select-all shadow-inner leading-relaxed">
                {termuxCommand}
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed flex items-center gap-1">
                <span className="text-emerald-700 font-bold">✨ Auto-Sync:</span>
                <span>Termux will automatically sync your tunnel to this dashboard with zero copy-pasting.</span>
              </div>
            </div>
          </div>

          {/* Section 2: Manual Tunnel URL (Collapsed by default accordion) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 transition">
            <button
              type="button"
              onClick={() => setIsManualExpanded(!isManualExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-slate-500" />
                <span>Manual Tunnel URL (Optional Fallback)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <span>{isManualExpanded ? 'Hide' : 'Configure'}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isManualExpanded ? 'rotate-180 text-emerald-600' : 'text-slate-400'
                  }`}
                />
              </div>
            </button>

            {isManualExpanded && (
              <form onSubmit={handleSaveConnection} className="p-4 pt-2 space-y-3.5 border-t border-slate-200 bg-white">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WebSocket Tunnel URL (from `cloudflared`)
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="wss://your-tunnel.trycloudflare.com"
                    className="w-full bg-slate-50/60 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition shadow-2xs"
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
                    className="w-full bg-slate-50/60 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 transition shadow-2xs"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                  >
                    {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{isSaved ? 'Saved!' : 'Save & Connect'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer border border-slate-200 shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
