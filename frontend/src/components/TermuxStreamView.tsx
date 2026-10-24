'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityLog, ChatMessage, ServerProfile } from '../types';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Copy, Power, Radio, Terminal as TerminalIcon } from 'lucide-react';
import { stripMinecraftFormatting } from './MinecraftChatMessage';

interface TermuxStreamViewProps {
  socketStatus: string;
  daemonStartedAt: number | null;
  lastDisconnectedAt: number | null;
  statusStorageAvailable: boolean;
  messages: ChatMessage[];
  activityLogs: ActivityLog[];
  servers: ServerProfile[];
  onShutdown: () => boolean;
  onShutdownTimeout: () => void;
}

type StreamLine = {
  id: string;
  timestamp: number;
  botId: string;
  account?: string;
  kind: string;
  message: string;
};

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatRelative(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function TermuxStreamView({
  socketStatus,
  daemonStartedAt,
  lastDisconnectedAt,
  statusStorageAvailable,
  messages,
  activityLogs,
  servers,
  onShutdown,
  onShutdownTimeout,
}: TermuxStreamViewProps) {
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [followStream, setFollowStream] = useState(true);
  const [shutdownPending, setShutdownPending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const shutdownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (socketStatus === 'AUTHENTICATED') return;
    if (shutdownTimerRef.current !== null) window.clearTimeout(shutdownTimerRef.current);
    shutdownTimerRef.current = null;
    setShutdownPending(false);
  }, [socketStatus]);

  useEffect(() => () => {
    if (shutdownTimerRef.current !== null) window.clearTimeout(shutdownTimerRef.current);
  }, []);

  const lines = useMemo(() => {
    const messageLines: StreamLine[] = messages.map((entry) => ({
      id: `message-${entry.id}`,
      timestamp: entry.timestamp,
      botId: entry.botId,
      account: entry.accountUsername,
      kind: entry.type,
      message: stripMinecraftFormatting(entry.raw || entry.formattedText || '').replace(/\s+/g, ' ').trim(),
    }));
    const activityLines: StreamLine[] = activityLogs.map((entry) => ({
      id: `activity-${entry.id}`,
      timestamp: entry.timestamp,
      botId: entry.botId,
      kind: entry.type,
      message: entry.message,
    }));

    const seen = new Set<string>();
    return [...messageLines, ...activityLines]
      .filter((line) => {
        if (!line.message) return false;
        const signature = `${line.botId}|${line.message.toLowerCase()}|${Math.floor(line.timestamp / 3000)}`;
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-500);
  }, [messages, activityLogs]);

  useEffect(() => {
    if (followStream && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [followStream, lines.length]);

  const isOnline = socketStatus === 'AUTHENTICATED';
  const daemonUptime = daemonStartedAt
    ? Math.max(0, Math.floor(((isOnline ? now : lastDisconnectedAt || now) - daemonStartedAt) / 1000))
    : null;
  const serverNameFor = (line: StreamLine) => {
    const profileId = line.botId.includes('__') ? line.botId.split('__')[0] : line.botId;
    return servers.find((server) => server.id === profileId)?.name || profileId || 'PocketAFK';
  };

  const copyLines = async () => {
    try {
      await navigator.clipboard.writeText(lines.map((line) => `[${new Date(line.timestamp).toLocaleString()}] [${serverNameFor(line)}] ${line.message}`).join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const requestShutdown = () => {
    if (!window.confirm('Shut down the Termux daemon and disconnect all running Minecraft bots? You will need to start it again from Termux.')) return;
    if (!onShutdown()) return;
    setShutdownPending(true);
    shutdownTimerRef.current = window.setTimeout(() => {
      shutdownTimerRef.current = null;
      setShutdownPending(false);
      onShutdownTimeout();
    }, 8000);
  };

  return (
    <section className="pa-termux-stream mx-auto flex h-[calc(100dvh-120px)] min-h-[480px] max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#514d42] bg-[#211f1c] text-[#eee8dc] shadow-2xl">
      <header className="flex flex-col gap-4 border-b border-[#4b473e] bg-gradient-to-r from-[#302e29] via-[#282722] to-[#29332b] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-800/70 bg-emerald-950/50 text-emerald-300">
            <TerminalIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight text-[#fff6e5]">Termux Stream</h1>
            <p className="text-xs text-[#bcb3a4]">Live daemon output across your server profiles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${isOnline ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200' : 'border-[#514d42] bg-[#25241f] text-[#bcb3a4]'}`}>
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_#6acb72]' : 'bg-[#7c786e]'}`} />
            {isOnline ? 'Daemon online' : 'Daemon offline'}
          </span>
          <button type="button" onClick={requestShutdown} disabled={!isOnline || shutdownPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#704a42] bg-[#392724] px-3 text-xs font-bold text-[#e8b7a9] transition hover:border-[#a15f51] hover:bg-[#472c28] disabled:cursor-not-allowed disabled:opacity-40" title="Shut down Termux and disconnect all bots">
            <Power className="h-3.5 w-3.5" /> {shutdownPending ? 'Shutting down…' : 'Shut down'}
          </button>
          <button type="button" onClick={copyLines} disabled={!lines.length} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#565145] bg-[#302e29] px-3 text-xs font-bold text-[#ded6c7] transition hover:border-emerald-700 hover:bg-[#38362f] disabled:opacity-40" title="Copy visible stream lines">
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>

      <div className="grid gap-3 border-b border-[#4b473e] bg-[#25231f] p-4 sm:grid-cols-2 sm:px-6">
        <div className="flex min-h-[76px] items-center gap-3 rounded-xl border border-emerald-900/80 bg-[#202c25] px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#52634b] bg-[#2d382d] text-[#b8cc9e]"><Activity className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#aaa293]">{isOnline ? 'Daemon uptime' : 'Last session uptime'}</p>
            <p className="mt-1 text-base font-black tabular-nums text-[#f3eddf]">{daemonUptime !== null ? formatUptime(daemonUptime) : 'Not available'}</p>
          </div>
          <span className={`ml-auto h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-[#77736a]'}`} />
        </div>
        <div className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[#514d42] bg-[#302e29] px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#625b4c] bg-[#3a3832] text-[#c5bdaE]"><Clock3 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#aaa293]">Last disconnected</p>
            <p className="mt-1 truncate text-sm font-bold text-[#eee8dc]">
              {lastDisconnectedAt ? formatRelative(lastDisconnectedAt, now) : 'No disconnect recorded'}
            </p>
            {lastDisconnectedAt && <p className="mt-0.5 truncate text-[10px] text-[#aaa293]">{new Date(lastDisconnectedAt).toLocaleString()}</p>}
          </div>
        </div>
      </div>

      {!statusStorageAvailable && (
        <div className="flex items-start gap-2 border-b border-amber-900/60 bg-[#392f20] px-4 py-3 text-xs text-[#e8d09b] sm:px-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Persistent uptime history is not configured yet. Apply <code className="rounded bg-black/20 px-1">supabase/migrations/20261024_daemon_status.sql</code> to retain last-disconnect time across restarts.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-[#39372f] px-4 py-2.5 text-[11px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-[#c9c1b3]">
          <Radio className={`h-3.5 w-3.5 shrink-0 ${isOnline ? 'text-emerald-400' : 'text-[#827d72]'}`} />
          <span className="truncate">@{`daemon`} <span className="mx-1 text-[#6f6a60]">/</span> All daemon output · 24h view</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[#aaa293]">
          <span>{lines.length} recent lines</span>
          <button type="button" onClick={() => setFollowStream((value) => !value)} className="rounded-md border border-[#514d42] px-2 py-1 text-[10px] font-bold text-[#d5cdbd] hover:bg-[#302e29]">{followStream ? 'Following' : 'Follow'}</button>
        </div>
      </div>

      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto bg-[#1d1c19] px-3 py-3 font-mono text-[11px] sm:px-5 sm:py-4">
        {lines.length ? (
          <div className="space-y-1">
            {lines.map((line) => {
              const isError = /error|kick|fail/i.test(`${line.kind} ${line.message}`);
              const isGood = /spawn|connected|online/i.test(`${line.kind} ${line.message}`);
              return (
                <div key={line.id} className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-lg border-l-2 px-3 py-2 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-start ${isError ? 'border-l-[#8b5c53] bg-[#2b2422]' : isGood ? 'border-l-[#617b56] bg-[#242a22]' : 'border-l-[#5b574d] bg-[#24231f]'}`}>
                  <time className="whitespace-nowrap text-[10px] tabular-nums text-[#968f81]" title={new Date(line.timestamp).toLocaleString()}>{new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                  <span className="hidden max-w-36 truncate rounded border border-[#4c483e] bg-[#302e29] px-1.5 py-0.5 text-[9px] font-bold text-[#c9c1b3] sm:inline-block">{serverNameFor(line)}</span>
                  <p className={`col-span-2 min-w-0 break-words leading-relaxed sm:col-span-1 ${isError ? 'text-[#dfb5aa]' : isGood ? 'text-[#d6e0c7]' : 'text-[#e2dbcf]'}`}>
                    {line.account && <span className="mr-2 font-bold text-[#c3b989]">{line.account}</span>}
                    <span className="mr-2 text-[9px] uppercase tracking-wide text-[#8f887b]">{line.kind.replaceAll('_', ' ')}</span>
                    {line.message}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#514d42] bg-[#302e29] text-[#b8b0a1]"><TerminalIcon className="h-6 w-6" /></div>
            <p className="mt-4 text-sm font-bold text-[#eee8dc]">{isOnline ? 'Waiting for Termux output…' : 'No recent Termux output'}</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#aaa293]">When the daemon connects and starts your Minecraft profiles, connection events and server activity will appear here.</p>
            {!isOnline && <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#514d42] bg-[#292824] px-3 py-1 text-[10px] font-bold text-[#aaa293]"><CheckCircle2 className="h-3.5 w-3.5" /> Waiting for daemon connection</span>}
          </div>
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-[#39372f] bg-[#25241f] px-4 py-2 text-[10px] text-[#aaa293] sm:px-6">
        <span>Recent output from all server profiles</span>
        <span>{lastDisconnectedAt ? `Last stop ${formatRelative(lastDisconnectedAt, now)}` : 'No previous stop recorded'}</span>
      </footer>
    </section>
  );
}
