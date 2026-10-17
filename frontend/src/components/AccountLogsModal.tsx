'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Search,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  ArrowUpRight,
  Database,
  Terminal,
  Filter,
} from 'lucide-react';
import { MinecraftAccount, PlayerLogEntry, PlayerLogType } from '../types';

interface AccountLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: MinecraftAccount | null;
  serverHost?: string;
  logs: PlayerLogEntry[];
  onClearLogs: () => void;
  isLiveConnected?: boolean;
}

export const AccountLogsModal: React.FC<AccountLogsModalProps> = ({
  isOpen,
  onClose,
  account,
  serverHost,
  logs,
  onClearLogs,
  isLiveConnected = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'connection' | 'errors' | 'chat'>('all');
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const cleanPlayerName = account?.ign || account?.expectedIgn || account?.username || 'Unknown';
  const avatarKey = (account?.uuid || account?.ign || account?.username || 'Steve').split('@')[0];

  const filteredLogs = useMemo(() => {
    return logs
      .filter((entry) => {
        // Tab filter
        if (activeTab === 'connection') {
          return ['connecting', 'handshake', 'connected', 'spawned', 'reconnecting', 'disconnected'].includes(entry.type);
        }
        if (activeTab === 'errors') {
          return entry.type === 'error' || entry.type === 'kicked' || entry.status === 'error';
        }
        if (activeTab === 'chat') {
          return entry.type === 'chat';
        }
        return true;
      })
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
  }, [logs, activeTab, filterQuery]);

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

  const getTypeBadge = (type: PlayerLogType, status: string) => {
    switch (type) {
      case 'spawned':
      case 'connected':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✓ SPAWNED
          </span>
        );
      case 'handshake':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            HANDSHAKE
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
            CONNECTING
          </span>
        );
      case 'kicked':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            ⚠ KICKED
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            ✕ ERROR
          </span>
        );
      case 'chat':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            CHAT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Idle
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                <span>Server:</span>
                <span className="text-slate-700 font-semibold">{serverHost || 'Configured Server'}</span>
                <span>•</span>
                <Database className="w-3 h-3 text-emerald-600 inline" />
                <span className="text-emerald-700 font-medium">Supabase Cloud Sync</span>
              </p>
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
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Logs ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('connection')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'connection'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Connections
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'errors'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Kicks & Errors
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              In-Game Chat
            </button>
          </div>

          {/* Search + Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              onClick={handleCopyLogs}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer text-xs font-bold flex items-center gap-1 shadow-2xs shrink-0"
              title="Copy visible logs to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {confirmClear ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    onClearLogs();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={logs.length === 0}
                className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition cursor-pointer shadow-2xs shrink-0 disabled:opacity-40"
                title="Clear player logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Logs Feed Container */}
        <div className="flex-1 p-5 overflow-y-auto space-y-2.5 bg-slate-50/50 min-h-[320px]">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shadow-inner">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No logs captured yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
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

              return (
                <div
                  key={entry.id}
                  className={`p-3 rounded-2xl border transition shadow-2xs ${
                    isError
                      ? 'bg-rose-50/80 border-rose-200/90 text-rose-950'
                      : entry.type === 'spawned'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-slate-400 select-none">
                        [{timeStr}]
                      </span>
                      {getTypeBadge(entry.type, entry.status)}
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70">
                        {entry.serverHost}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-mono font-medium mt-1.5 leading-relaxed break-words">
                    {entry.message}
                  </p>

                  {entry.details && (
                    <div className="mt-2 p-2 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                      {entry.details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-semibold text-slate-700">{filteredLogs.length}</span>
            <span>of</span>
            <span className="font-semibold text-slate-700">{logs.length}</span>
            <span>logged events</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
