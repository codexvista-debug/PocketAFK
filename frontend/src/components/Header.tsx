'use client';

import React from 'react';
import { SocketStatus } from '../lib/useDaemonSocket';
import { 
  Settings as SettingsIcon, 
  Users, 
  WifiOff, 
  Activity, 
  LogIn, 
  LogOut,
  Shield,
  Bot
} from 'lucide-react';

interface HeaderProps {
  socketStatus: SocketStatus;
  activeCount: number;
  accountsCount: number;
  currentUser: string | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenAccounts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  socketStatus,
  activeCount,
  accountsCount,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  onOpenAccounts,
}) => {
  const getSocketBadge = () => {
    switch (socketStatus) {
      case 'AUTHENTICATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500" />
            Daemon Online
          </span>
        );
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Authenticating
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            Connecting
          </span>
        );
      case 'AUTH_ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <WifiOff className="w-3.5 h-3.5" />
            Auth Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            Standby
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      {/* Top Gradient Highlight Accent Line */}
      <div className="h-[2.5px] w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Logo + Status Details */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center font-black text-white text-lg shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/20">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-sm tracking-tight">PocketAFK</h1>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  24/7 Java Core
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {currentUser ? (
                  <>
                    {getSocketBadge()}
                    {activeCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300">
                        <Activity className="w-3 h-3 text-emerald-600 animate-spin" />
                        {activeCount} Bot{activeCount > 1 ? 's' : ''} Online
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">
                        0 Active
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.2 rounded-md border border-amber-200/80">
                    🔒 Sign in required to connect
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Controls (No duplicate "+ New Server" button!) */}
        <div className="flex items-center gap-2">
          {currentUser && (
            <>
              {/* Minecraft Accounts Manager */}
              <button
                onClick={onOpenAccounts}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer group"
                title="Manage Minecraft Accounts"
              >
                <Users className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-600 transition" />
                <span>Accounts</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-800 text-[10px] font-bold">
                  {accountsCount}
                </span>
              </button>

              {/* Settings / Termux Bridge Configuration */}
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
                title="Termux & Daemon Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </>
          )}

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 ml-1">
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-black text-emerald-950 font-mono tracking-tight">
                  @{currentUser}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
