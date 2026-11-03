'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Zap, Copy, Check, X, Terminal, ShieldAlert, Power, RotateCcw } from 'lucide-react';

interface SignetReconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  daemonStatus: 'AUTHENTICATED' | 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'AUTH_ERROR';
  daemonUrl?: string;
  onReconnectNow: () => void;
  onShutdownDaemon?: () => void;
  termuxCommand: string;
}

export const SignetReconnectModal: React.FC<SignetReconnectModalProps> = ({
  isOpen,
  onClose,
  daemonStatus,
  daemonUrl,
  onReconnectNow,
  onShutdownDaemon,
  termuxCommand,
}) => {
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [countdown, setCountdown] = useState(5);
  const [hasExhausted, setHasExhausted] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  const isAuthenticated = daemonStatus === 'AUTHENTICATED';
  const isConnecting = daemonStatus === 'CONNECTING' || daemonStatus === 'CONNECTED';

  // Reset attempt & countdown whenever the modal transitions from closed to open
  useEffect(() => {
    if (isOpen) {
      if (!isAuthenticated) {
        setAttempt(1);
        setCountdown(5);
        setHasExhausted(false);
        setIsShuttingDown(false);
      }
    }
  }, [isOpen, isAuthenticated]);

  // 3-Attempt, 5-Second Countdown Loop
  useEffect(() => {
    if (!isOpen || isAuthenticated || hasExhausted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (attempt < 3) {
            setAttempt((a) => a + 1);
            onReconnectNow();
            return 5;
          } else {
            // Reached attempt 3; stop and show manual copy-paste launcher popup
            setHasExhausted(true);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isAuthenticated, hasExhausted, attempt, onReconnectNow]);

  const handleCopyCommand = async () => {
    if (!termuxCommand) return;
    try {
      await navigator.clipboard.writeText(termuxCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleRestartAutoConnect = () => {
    setHasExhausted(false);
    setAttempt(1);
    setCountdown(5);
    onReconnectNow();
  };

  const handleShutdown = () => {
    if (!onShutdownDaemon) return;
    if (window.confirm('Are you sure you want to stop the Termux daemon and disconnect all bots?')) {
      setIsShuttingDown(true);
      onShutdownDaemon();
      setTimeout(() => {
        setIsShuttingDown(false);
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signet-reconnect-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full max-w-[500px] overflow-hidden rounded-2xl border-2 transition-all duration-300 shadow-2xl ${
          isAuthenticated
            ? 'border-emerald-500 bg-gradient-to-b from-[#1b341f] via-[#142318] to-[#0f1a12] shadow-[0_0_40px_rgba(16,185,129,0.35)]'
            : hasExhausted
            ? 'border-amber-600/80 bg-gradient-to-b from-[#251f15] via-[#1a1710] to-[#12100b] shadow-[0_0_40px_rgba(217,119,6,0.25)]'
            : 'border-emerald-500/80 bg-gradient-to-b from-[#222a1f] via-[#191e16] to-[#121610] shadow-[0_0_40px_rgba(84,158,55,0.25)]'
        }`}
      >
        {/* Animated Top Accent Bar */}
        <div
          className={`h-1.5 w-full transition-all duration-500 ${
            isAuthenticated
              ? 'bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-500'
              : hasExhausted
              ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600'
              : 'bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-600 animate-pulse'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header Row with Signet Allay Mascot */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                  isAuthenticated
                    ? 'bg-emerald-950/80 border-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                    : hasExhausted
                    ? 'bg-black/50 border-amber-600/60 shadow-[0_0_15px_rgba(217,119,6,0.3)]'
                    : 'bg-black/40 border-emerald-500/60 shadow-[0_0_15px_rgba(84,158,55,0.3)]'
                }`}
              >
                <img
                  src={isAuthenticated ? '/nav/daemon-allay-active.png' : '/nav/daemon-allay-inactive.png'}
                  alt="Signet mascot"
                  className={`w-11 h-11 object-contain transition-transform duration-300 ${
                    isAuthenticated
                      ? 'scale-110 drop-shadow-[0_0_8px_#34d399]'
                      : hasExhausted
                      ? 'opacity-80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]'
                      : 'animate-bounce drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]'
                  }`}
                  style={{ animationDuration: isAuthenticated || hasExhausted ? '0s' : '2.2s' }}
                />
              </div>
              {/* Status Ping Badge */}
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#191e16] flex items-center justify-center ${
                  isAuthenticated
                    ? 'bg-emerald-500'
                    : hasExhausted
                    ? 'bg-amber-500'
                    : 'bg-lime-400 animate-ping'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase mb-1 border ${
                  isAuthenticated
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                    : hasExhausted
                    ? 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>
                  {isAuthenticated
                    ? 'PocketAFK · Daemon Online'
                    : hasExhausted
                    ? 'PocketAFK · Daemon Standby'
                    : 'PocketAFK · Signet Autopilot'}
                </span>
              </div>
              <h2
                id="signet-reconnect-title"
                className="text-base font-extrabold text-white tracking-tight leading-snug"
              >
                {isAuthenticated
                  ? 'Termux Daemon Connected!'
                  : hasExhausted
                  ? 'Termux Daemon Not Responding'
                  : 'Reconnecting to Termux Daemon...'}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {isAuthenticated
                  ? 'WebSocket authenticated! Live bots and chat stream are synchronized.'
                  : hasExhausted
                  ? 'Signet attempted 3 automatic reconnections (15s total), but the Termux daemon is offline. Use your 1-click launcher command below to restart it.'
                  : 'Detected browser wakeup after being AFK. Signet is auto-restoring your real-time WebSocket connection to Termux.'}
              </p>
            </div>
          </div>

          {/* MODE 1: ACTIVE 3-ATTEMPT COUNTDOWN RECONNECTION */}
          {!isAuthenticated && !hasExhausted && (
            <div className="mt-4 p-4 rounded-xl bg-black/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                  <span className="text-slate-200 font-medium">
                    {daemonStatus === 'CONNECTED'
                      ? 'Authenticating session token...'
                      : 'Restoring WebSocket connection...'}
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  Attempt {attempt} of 3
                </span>
              </div>

              {/* 5-Second Animated Countdown Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Reconnection timer</span>
                  <span className="text-lime-300 font-bold">Retrying in {countdown}s</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(countdown / 5) * 100}%` }}
                  />
                </div>
              </div>

              {daemonUrl && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 truncate bg-black/50 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 select-none">wss://</span>
                  <span className="truncate text-slate-300">
                    {daemonUrl.replace(/^wss?:\/\//, '')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: NORMAL MANUAL LAUNCHER POPUP (AFTER 3 ATTEMPTS) */}
          {!isAuthenticated && hasExhausted && (
            <div className="mt-4 p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <p className="font-semibold text-white">Restart Termux with your 1-Click Command</p>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    Copy and run this command in Termux to launch the daemon and auto-link:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/70 px-3 py-2 rounded-lg border border-amber-600/40 text-[11px] font-mono text-amber-300 truncate select-all">
                  {termuxCommand || 'curl -sL https://pocketafk.vercel.app/install | bash'}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono pt-1 border-t border-slate-800">
                <Terminal className="w-3 h-3 text-slate-400" />
                <span>Tip: Android battery optimizer may stop background apps. Keep Termux battery unoptimized.</span>
              </div>
            </div>
          )}

          {/* MODE 3: CONNECTED & AUTHENTICATED */}
          {isAuthenticated && (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-bold">Active & Authenticated</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono">Live WebSocket</span>
              </div>

              {daemonUrl && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 truncate bg-black/50 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 select-none">wss://</span>
                  <span className="truncate text-slate-300">
                    {daemonUrl.replace(/^wss?:\/\//, '')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
            {/* Left Action: Shutdown (if connected) or Retry Auto-Connect (if exhausted) */}
            <div>
              {isAuthenticated && onShutdownDaemon && (
                <button
                  type="button"
                  onClick={handleShutdown}
                  disabled={isShuttingDown}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-xs font-bold text-rose-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  title="Stop Termux daemon and disconnect all bots"
                >
                  <Power className={`w-3.5 h-3.5 ${isShuttingDown ? 'animate-spin' : ''}`} />
                  <span>{isShuttingDown ? 'Shutting down...' : 'Shutdown Termux'}</span>
                </button>
              )}

              {!isAuthenticated && hasExhausted && (
                <button
                  type="button"
                  onClick={handleRestartAutoConnect}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Auto-Connect</span>
                </button>
              )}

              {!isAuthenticated && !hasExhausted && (
                <button
                  type="button"
                  onClick={() => setHasExhausted(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700/70 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                >
                  Manual Setup
                </button>
              )}
            </div>

            {/* Right Actions: Reconnect Now / Dismiss */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-700/80 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                {isAuthenticated ? 'Close' : 'Dismiss'}
              </button>

              {!isAuthenticated && !hasExhausted && (
                <button
                  type="button"
                  onClick={() => {
                    setCountdown(5);
                    onReconnectNow();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>Reconnect Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
