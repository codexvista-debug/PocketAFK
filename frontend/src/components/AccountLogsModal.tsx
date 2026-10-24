'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  Database,
  Terminal,
  Server,
  MessageSquare,
  Zap,
  XCircle,
} from 'lucide-react';
import { MinecraftAccount, PlayerLogEntry, ActivityLog } from '../types';

interface AccountLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: MinecraftAccount | null;
  serverHost?: string;
  logs: PlayerLogEntry[];
  activityLogs?: ActivityLog[];
  isLiveConnected?: boolean;
}

export const AccountLogsModal: React.FC<AccountLogsModalProps> = ({
  isOpen,
  onClose,
  account,
  serverHost,
  logs,
  activityLogs = [],
  isLiveConnected = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const cleanPlayerName = account?.ign || account?.expectedIgn || account?.username || 'Unknown';
  const avatarKey = (account?.uuid || account?.ign || account?.username || 'Steve').split('@')[0];

  const unifiedLogs = useMemo(() => {
    type UnifiedLogItem = {
      id: string;
      timestamp: number;
      type: string;
      message: string;
      details?: string;
      serverHost: string;
      status: string;
    };

    const combined: UnifiedLogItem[] = [];

    // 1. Existing stored player audit logs
    (logs || []).forEach((l) => {
      combined.push({
        id: l.id,
        timestamp: l.timestamp,
        type: l.type,
        message: l.message,
        details: l.details,
        serverHost: l.serverHost || serverHost || '',
        status: l.status,
      });
    });

    // 2. Real-time live bot activity logs from daemon
    (activityLogs || []).forEach((act) => {
      combined.push({
        id: act.id,
        timestamp: act.timestamp,
        type: act.type,
        message: act.message,
        details: undefined,
        serverHost: serverHost || '',
        status: act.type === 'disconnect' ? 'error' : act.type === 'reconnect' ? 'warning' : 'success',
      });
    });

    // Sort newest first
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, activityLogs, serverHost]);

  const filteredLogs = useMemo(() => {
    return unifiedLogs
      .filter((entry) => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (
          entry.message.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q) ||
          (entry.details && entry.details.toLowerCase().includes(q)) ||
          entry.serverHost.toLowerCase().includes(q)
        );
      });
  }, [unifiedLogs, filterQuery]);

  if (!isOpen || !account) return null;

  const handleCopyLogs = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const text = filteredLogs
        .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.type.toUpperCase()}] ${l.message} ${l.details || ''}`)
        .join('\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeBadge = (type: string, status: string) => {
    switch (type) {
      case 'spawn':
      case 'spawned':
      case 'connected':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            SPAWNED
          </span>
        );
      case 'handshake':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            HANDSHAKE
          </span>
        );
      case 'connect':
      case 'connecting':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <Radio className="w-3 h-3 text-sky-600 animate-pulse" />
            CONNECTING
          </span>
        );
      case 'reconnecting':
      case 'reconnect':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            RECONNECTING
          </span>
        );
      case 'anti_afk':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <Zap className="w-3 h-3 text-teal-600" />
            ANTI-AFK
          </span>
        );
      case 'survival':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            SURVIVAL
          </span>
        );
      case 'command':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            COMMAND
          </span>
        );
      case 'kicked':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            KICKED
          </span>
        );
      case 'error':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            ERROR
          </span>
        );
      case 'disconnected':
      case 'disconnect':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            DISCONNECTED
          </span>
        );
      case 'chat':
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <MessageSquare className="w-3 h-3 text-indigo-600" />
            CHAT
          </span>
        );
      default:
        return (
          <span className="pa-log-type-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            ACTIVITY
          </span>
        );
    }
  };

  return (
    <div className="pa-account-logs-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="pa-logs-dialog bg-white border border-slate-200 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="pa-logs-header px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shrink-0 shadow-2xs">
              <img
                src={`https://crafthead.net/helm/${encodeURIComponent(avatarKey)}/40`}
                alt={cleanPlayerName}
                className="w-full h-full object-cover [image-rendering:pixelated]"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (!img.src.includes('mc-heads')) {
                    img.src = `https://mc-heads.net/avatar/${encodeURIComponent(avatarKey)}/40`;
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base text-slate-900">
                  @{cleanPlayerName}
                </h2>
                {isLiveConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Idle
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                <Server className="w-3 h-3 text-slate-400 inline" />
                <span className="text-slate-700 font-semibold">{serverHost || 'Configured Server'}</span>
                <span>•</span>
                <Database className="w-3 h-3 text-emerald-600 inline" />
                <span className="text-emerald-700 font-medium">Supabase Cloud Sync</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Connection history and live activity for this account</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Action Bar */}
        <div className="pa-logs-toolbar px-5 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 shrink-0">
            <span className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-700/60 grid place-items-center"><span className="pa-item-icon pa-icon-chat pa-logbook-icon" aria-hidden="true" /></span>
            <span>All events</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300">{unifiedLogs.length}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-2xs"
              />
            </div>

            <button
              onClick={handleCopyLogs}
              className="pa-logs-copy p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-300 transition cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
              title="Copy visible logs to clipboard"
              aria-label={copied ? 'Logs copied' : 'Copy visible logs'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Logs Feed Container */}
        <div className="pa-logs-stream flex-1 p-4 sm:p-5 overflow-y-auto space-y-2.5 bg-slate-50/60 min-h-[340px]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No logs captured yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Connection attempts, TCP handshakes, world spawns, kick reasons, and error audits for @{cleanPlayerName} will record and sync here in real time.
                </p>
              </div>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });

              const isError = entry.status === 'error' || entry.type === 'kicked' || entry.type === 'error';
              const isWarning = entry.status === 'warning' || entry.type === 'reconnecting' || entry.type === 'disconnected';
              const isSuccess = entry.type === 'spawned' || entry.type === 'connected';

              return (
                <div
                  key={entry.id}
                  data-log-status={isError ? 'error' : isWarning ? 'warning' : isSuccess ? 'success' : 'neutral'}
                  className="pa-log-entry p-3.5 rounded-xl border transition"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="pa-log-time text-[10px] font-mono font-medium select-none">
                        [{timeStr}]
                      </span>
                      {getTypeBadge(entry.type, entry.status)}
                      {entry.serverHost && (
                        <span className="pa-log-server text-[10px] font-mono px-1.5 py-0.5 rounded border">
                          {entry.serverHost}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="pa-log-message text-[13px] font-medium mt-2 leading-relaxed break-words">
                    {entry.message}
                  </p>

                  {/* Clean subtle light details badge (NO big black block!) */}
                  {entry.details && (
                    <div className="pa-log-detail mt-2 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] border max-w-full">
                      <span className="text-[9px] uppercase font-bold tracking-wider">Detail:</span>
                      <span className="font-medium break-all">{entry.details}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pa-logs-footer px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-bold text-slate-800">{filteredLogs.length}</span>
            <span>of</span>
            <span className="font-bold text-slate-800">{unifiedLogs.length}</span>
            <span>logged events</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
