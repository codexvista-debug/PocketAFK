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
  RefreshCw,
  UserPlus,
  ShieldCheck,
  Zap
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500" />
            Daemon Online
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Authenticating
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
            <WifiOff className="w-3.5 h-3.5" />
            Tunnel Standby
          </span>
        );
    }
  };

  const getBotStateBadge = () => {
    switch (botState) {
      case 'SPAWNED':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase bg-emerald-600 text-white shadow-xs tracking-wider">
            In-Game
          </span>
        );
      case 'LOGGED_IN':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-sky-100 text-sky-800 border border-sky-300">
            Logged In
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
            Connecting...
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">
            Reconnecting
          </span>
        );
      case 'KICKED':
      case 'ERROR':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-red-100 text-red-800 border border-red-300">
            {botState}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-xs font-medium uppercase bg-slate-100 text-slate-500 border border-slate-200">
            Idle
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 px-4 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center font-black text-white text-xl shadow-md shadow-emerald-500/20 ring-1 ring-white/50">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-base tracking-tight">PocketAFK</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-2xs">
                  Java Core
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {getSocketBadge()}
                {getBotStateBadge()}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Minecraft Account Display */}
        <div className="flex items-center gap-2">
          {activeAccount ? (
            <div 
              onClick={onOpenAccounts}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-50/60 to-slate-50 border border-emerald-300/80 rounded-xl px-3.5 py-1.5 shadow-2xs cursor-pointer hover:border-emerald-500 transition group"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <div className="text-xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Bot</span>
                <span className="font-extrabold text-slate-900 group-hover:text-emerald-700 transition">
                  {activeAccount.username}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAccounts}
              className="flex items-center gap-2 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-300/80 rounded-xl px-3.5 py-1.5 shadow-2xs transition text-xs font-bold text-amber-900 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-amber-600" />
              <span>No Minecraft Account &bull; <span className="underline">Add One</span></span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isBotRunning ? (
            <button
              onClick={onStartBot}
              disabled={!activeAccount || socketStatus !== 'AUTHENTICATED'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Bot
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onStopBot}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm shadow-red-600/20 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
              <button
                onClick={onRestartBot}
                title="Restart Bot"
                className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onOpenAccounts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Accounts</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition shadow-2xs cursor-pointer"
            title="Configuration"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
              <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                @{currentUser}
              </span>
              <button
                onClick={onLogout}
                title="Log out"
                className="text-[11px] text-slate-500 hover:text-red-600 font-semibold px-1 py-1 transition cursor-pointer"
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer ml-1"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
