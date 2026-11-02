'use client';

import React from 'react';
import { RefreshCw, Radio, Wifi, WifiOff } from 'lucide-react';

interface DaemonReconnectBannerProps {
  socketStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATED' | 'AUTH_ERROR';
  hasConfiguredDaemon: boolean;
  onReconnectNow: () => void;
}

export const DaemonReconnectBanner: React.FC<DaemonReconnectBannerProps> = ({
  socketStatus,
  hasConfiguredDaemon,
  onReconnectNow,
}) => {
  // Only show when user has a daemon configured but is disconnected or trying to reconnect
  if (!hasConfiguredDaemon || socketStatus === 'AUTHENTICATED') {
    return null;
  }

  const isReconnecting = socketStatus === 'CONNECTING' || socketStatus === 'CONNECTED';

  return (
    <aside
      aria-label="Daemon connection status"
      className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full px-4 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none"
    >
      <div className="pointer-events-auto rounded-2xl border border-[#524d41] bg-[#22211ecc]/95 backdrop-blur-md p-4 text-[#f0eadc] shadow-2xl shadow-black/60 flex items-start gap-3.5">
        <div className="shrink-0 mt-0.5">
          {isReconnecting ? (
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400">
              <WifiOff className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black tracking-wide text-[#f5f0e3]">
              {isReconnecting ? 'Reconnecting to Termux Daemon' : 'Termux Daemon Offline'}
            </h4>
            <span
              className={`rounded-full px-2 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${
                isReconnecting
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isReconnecting ? 'Connecting' : 'Offline'}
            </span>
          </div>

          <p className="mt-1 text-[11px] leading-relaxed text-[#bcb5a6]">
            {isReconnecting
              ? 'Attempting automatic WebSocket reconnection to your Termux tunnel...'
              : 'Termux daemon connection timed out while you were away.'}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onReconnectNow}
              disabled={isReconnecting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/70 bg-emerald-600/90 hover:bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs transition hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>{isReconnecting ? 'Reconnecting...' : 'Reconnect now'}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
