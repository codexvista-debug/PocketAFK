'use client';

import React from 'react';
import { SocketStatus } from '../lib/useDaemonSocket';
import { BotLifecycleState, Account } from '../types';
import { 
  Play, 
  Square, 
  Settings as SettingsIcon, 
  Users, 
  WifiOff, 
  RefreshCw 
} from 'lucide-react';

interface HeaderProps {
  socketStatus: SocketStatus;
  botState: BotLifecycleState;
  activeAccount: Account | null;
  currentUser: string | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenAccounts: () => void;
  onStartBot: () => void;
  onStopBot: () => void;
  onRestartBot: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  socketStatus,
  botState,
  activeAccount,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  onOpenAccounts,
  onStartBot,
  onStopBot,
  onRestartBot
}) => {
  const isBotRunning = botState === 'SPAWNED' || botState === 'LOGGED_IN' || botState === 'CONNECTING';

  const getSocketBadge = () => {
    switch (socketStatus) {
      case 'AUTHENTICATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Daemon Online
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Authenticating
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            Connecting
          </span>
        );
      case 'AUTH_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <WifiOff className="w-3.5 h-3.5" />
            Auth Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <WifiOff className="w-3.5 h-3.5" />
            Tunnel Offline
          </span>
        );
    }
  };

  const getBotStateBadge = () => {
    switch (botState) {
      case 'SPAWNED':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-emerald-600 text-white shadow-sm">
            Spawned
          </span>
        );
      case 'LOGGED_IN':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-sky-100 text-sky-800 border border-sky-300">
            Logged In
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            Connecting...
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">
            Reconnecting
          </span>
        );
      case 'KICKED':
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-red-100 text-red-800 border border-red-300">
            {botState}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            Idle
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-40 px-4 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-lg shadow-sm">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-base tracking-tight">PocketAFK</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-medium border border-slate-200">
                  v1.0 Java
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {getSocketBadge()}
                {getBotStateBadge()}
              </div>
            </div>
          </div>
        </div>

        {/* Center / Account Info */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <div className="text-xs">
            <span className="text-slate-600 font-medium block text-[10px]">CURRENT BOT</span>
            <span className="font-bold text-slate-800">
              {activeAccount ? activeAccount.username : 'No account selected'}
            </span>
          </div>
          {activeAccount && (
            <span className="text-xs text-slate-600 font-mono ml-2 px-1.5 py-0.5 bg-white border border-slate-200 rounded">
              {activeAccount.server_host}
            </span>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2">
          {!isBotRunning ? (
            <button
              onClick={onStartBot}
              disabled={!activeAccount || socketStatus !== 'AUTHENTICATED'}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Bot
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onStopBot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
              <button
                onClick={onRestartBot}
                title="Restart Bot"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onOpenAccounts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Accounts</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition shadow-xs"
            title="Configuration"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 ml-1">
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                @{currentUser}
              </span>
              <button
                onClick={onLogout}
                title="Log out"
                className="text-[11px] text-slate-500 hover:text-red-600 font-semibold px-1.5 py-1 transition cursor-pointer"
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer ml-1"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
