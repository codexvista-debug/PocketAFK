'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, QuickCommandItem } from '../types';
import { Send, MessageSquare, Users, ChevronDown, Check, Pencil } from 'lucide-react';
import { MinecraftChatMessage, stripMinecraftFormatting } from './MinecraftChatMessage';
import { ServerLogo } from './ServerLogo';

export interface ChatAccountItem {
  id: string;
  name: string;
  ign?: string;
  isOnline?: boolean;
}

interface TerminalProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string, senderAccountId?: string) => void;
  disabled?: boolean;
  availableSenders?: ChatAccountItem[];
  selectedSenderId?: string;
  onSelectSender?: (senderId: string) => void;
  quickCommands?: QuickCommandItem[];
  onEditQuickCommands?: () => void;
  serverName?: string;
  serverHost?: string;
  autoScrollEnabled?: boolean;
}

const DEFAULT_QUICK_COMMANDS: QuickCommandItem[] = [
  { cmd: '/afk', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white' },
  { cmd: '/lifesteal', color: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white' },
  { cmd: '/home', color: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white' },
  { cmd: '/spawn', color: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-600 hover:text-white' },
  { cmd: '/tpa accept', color: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white' },
  { cmd: '/tpdeny', color: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-600 hover:text-white' },
  { cmd: '/help', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-600 hover:text-white' },
  { cmd: '/resourcepack', color: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-700 hover:text-white' },
];

export const Terminal: React.FC<TerminalProps> = ({
  messages,
  onSendMessage,
  disabled = false,
  availableSenders = [],
  selectedSenderId = 'all',
  onSelectSender,
  quickCommands,
  onEditQuickCommands,
  serverName = 'Minecraft Server',
  serverHost = '',
  autoScrollEnabled = true,
}) => {
  const [input, setInput] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const senderDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (senderDropdownRef.current && !senderDropdownRef.current.contains(event.target as Node)) {
        setIsSenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSenderAccount = availableSenders.find(
    (s) => s.id === selectedSenderId || s.ign === selectedSenderId
  );
  const onlineSenders = availableSenders.filter((sender) => sender.isOnline).length;
  const composerDisabled = disabled || availableSenders.length === 0 || (selectedSenderAccount ? !selectedSenderAccount.isOnline : onlineSenders === 0);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScrollEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || composerDisabled) return;
    onSendMessage(input.trim(), selectedSenderId);
    setInput('');
  };

  const sendQuickCommand = (cmd: string) => {
    if (composerDisabled) return;
    onSendMessage(cmd, selectedSenderId);
  };

  const playerForMessage = (message: ChatMessage): { name: string; bedrock: boolean } | null => {
    const raw = stripMinecraftFormatting(message.raw || message.formattedText || '');
    const nonPlayerLabels = new Set(['server', 'system', 'pocketafk', 'autocommand', 'broadcast', 'invitation']);
    const validPlayerName = (candidate?: string) => {
      const value = candidate?.replace(/^[+*.~#]+/, '').trim();
      return value && !nonPlayerLabels.has(value.toLowerCase()) ? candidate : undefined;
    };

    // Match names from the message's visible prefix instead of relying on the
    // protocol packet label: many servers send player chat in system-chat packets.
    const rankedName = raw.match(/^\s*\[[^\]]{1,32}\]\s*([+*.~#]?[A-Za-z0-9_]{1,16})\s*(?:▶|>|»|:)\s*/)?.[1];
    const whisperName = raw.match(/^\s*\[([A-Za-z0-9_]{1,16})\s*(?:→|->)\s*me\]\s*/i)?.[1];
    const chatLineName = validPlayerName(raw.match(/^\s*<([^>]{1,32})>\s*/)?.[1])
      || validPlayerName(whisperName)
      || validPlayerName(rankedName)
      || validPlayerName(raw.match(/^\s*(?:\[[^\]]{1,32}\]\s*){0,2}([+*.~#]?[A-Za-z0-9_][A-Za-z0-9_. #]{0,15})\s*(?:▶|>|»|:)\s*/)?.[1])
      || validPlayerName(raw.match(/^\s*([A-Za-z0-9_]{1,16})\s+(?:has made (?:the )?advancement|has completed (?:the )?challenge|joined the game|left the game|was slain by|was shot by|was killed by)\b/i)?.[1]);

    // Chat payloads identify the bot receiving the message in accountUsername;
    // only infer an avatar from the actual chat line, never from that account.
    if (!chatLineName) return null;
    const platform = String((message as ChatMessage & { platform?: string; edition?: string }).platform || (message as ChatMessage & { edition?: string }).edition || '').toLowerCase();
    const isFloodgateName = /^[.*]/.test(chatLineName);
    const name = isFloodgateName ? chatLineName.slice(1) : chatLineName;
    const bedrock = platform.includes('bedrock') || isFloodgateName || /[ .#]/.test(name);
    return name ? { name, bedrock } : null;
  };

  const relativeTime = (timestamp: number) => {
    const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h`;
    return `${Math.floor(elapsedHours / 24)}d`;
  };

  return (
    <div className="pa-chat-console bg-white border border-slate-300/90 rounded-3xl overflow-hidden flex flex-col h-full shadow-lg shadow-slate-200/50">
      {/* Terminal Header & Toolbar */}
      <div className="pa-chat-console-head bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="pa-chat-account-icon w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/90 flex items-center justify-center shrink-0 shadow-2xs">
            <ServerLogo host={serverHost} name={serverName} size="w-full h-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="pa-chat-account-name font-extrabold text-slate-900 tracking-tight truncate text-xs">{serverName}</span>
              <span className={`pa-chat-online-indicator ${onlineSenders ? 'is-online' : 'is-offline'}`} />
            </div>
            <span className="pa-chat-account-caption">
              {onlineSenders}/{availableSenders.length} accounts connected{serverHost ? ` · ${serverHost}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {availableSenders.length > 0 && (
            <div className="pa-chat-sender pa-chat-sender-header relative shrink-0" ref={senderDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSenderDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300/90 text-xs font-bold text-slate-800 transition cursor-pointer shadow-2xs"
                title="Choose which account's chat to view and send from"
                aria-label={`Chat account: ${selectedSenderAccount?.ign || selectedSenderAccount?.name || `All accounts (${availableSenders.length})`}`}
              >
                {selectedSenderAccount ? (
                  <img src={`https://minotar.net/helm/${encodeURIComponent(selectedSenderAccount.ign || selectedSenderAccount.name)}/20.png`} alt="" className="w-5 h-5 rounded border border-slate-200 shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : <Users className="w-4 h-4 text-slate-500" />}
                <span className="truncate max-w-[120px]">{selectedSenderAccount?.ign || selectedSenderAccount?.name || `All accounts (${availableSenders.length})`}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {isSenderDropdownOpen && (
                <div className="pa-chat-sender-menu absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Choose chat account</div>
                  <button type="button" onClick={() => { onSelectSender?.('all'); setIsSenderDropdownOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${!selectedSenderId || selectedSenderId === 'all' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> All accounts ({availableSenders.length})</span>
                    {(!selectedSenderId || selectedSenderId === 'all') && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <div className="max-h-48 overflow-y-auto">
                    {availableSenders.map((acc) => {
                      const isSelected = selectedSenderId === acc.id || selectedSenderId === acc.ign;
                      return <button key={acc.id} type="button" onClick={() => { onSelectSender?.(acc.id); setIsSenderDropdownOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-2 min-w-0"><img src={`https://minotar.net/helm/${encodeURIComponent(acc.ign || acc.name)}/20.png`} alt="" className="w-5 h-5 rounded border border-slate-200 shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} /><span className="truncate">{acc.ign || acc.name}</span>{acc.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Macro Commands Bar */}
      <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-200/90 flex items-center justify-between gap-2 shrink-0">
          <div className="pa-chat-commands flex items-center space-x-2 overflow-x-auto text-xs min-w-0 flex-1">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider shrink-0 select-none mr-0.5">
            Quick:
          </span>
          {(quickCommands && quickCommands.length > 0 ? quickCommands : DEFAULT_QUICK_COMMANDS).map(({ cmd, color }) => (
            <button
              key={cmd}
              onClick={() => sendQuickCommand(cmd)}
              disabled={composerDisabled}
              className={`pa-chat-command px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold shadow-2xs transition whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-40 active:scale-95 ${color || 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-600 hover:text-white'}`}
            >
              {cmd}
            </button>
          ))}
        </div>

        {onEditQuickCommands && (
          <button
            onClick={onEditQuickCommands}
            title="Edit Quick Commands for this server"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={scrollContainerRef}
        className="pa-chat-stream flex-1 p-3 sm:p-4 overflow-y-auto bg-slate-50/50 border-b border-slate-200 flex flex-col space-y-1"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 select-none py-16">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-300">
              <MessageSquare className="h-6 w-6 stroke-[1.5]" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-mono text-xs font-semibold text-slate-700">No messages for this account yet.</p>
              <p className="text-[11px] text-slate-400">Player chat and server events will appear here.</p>
            </div>
            {composerDisabled && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 font-mono text-xs font-bold px-3 py-1 rounded-full">
                Bot is currently disconnected
              </span>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => {
            const player = playerForMessage(msg);
            return (
            <div className="pa-chat-message-row" key={msg.id || idx}>
              {player ? (
                <img
                  src={player.bedrock
                    ? `https://tabavatars.net/avatar/?username=${encodeURIComponent(player.name)}&platform=bedrock`
                    : `https://minotar.net/helm/${encodeURIComponent(player.name)}/32.png`}
                  alt={`${player.name} skin`}
                  className="pa-chat-message-skin"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (player.bedrock && !img.src.includes('minotar.net')) img.src = `https://minotar.net/helm/${encodeURIComponent(player.name)}/32.png`;
                    else if (!img.src.includes('mc-heads.net')) img.src = `https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/32`;
                    else img.src = 'https://minotar.net/helm/MHF_Steve/32.png';
                  }}
                />
              ) : (
                <div className="pa-chat-system-avatar" aria-label="Server message">
                  <span className="pa-item-icon pa-icon-daemon-lamp" aria-hidden="true" />
                </div>
              )}
              <div className="pa-chat-message-body">
                <MinecraftChatMessage message={msg} showTimestamp={false} compact darkMode />
              </div>
              <time
                className="pa-chat-relative-time"
                dateTime={new Date(msg.timestamp || now).toISOString()}
                title={new Date(msg.timestamp || now).toLocaleString()}
              >
                {relativeTime(msg.timestamp || now)}
              </time>
            </div>
          );})
        )}
        {messages.length > 0 && !messages.some((message) => message.type === 'chat') && (
          <div className="pa-chat-waiting-note mx-auto mt-5 max-w-lg rounded-xl border px-4 py-3 text-center">
            <p className="text-xs font-bold">Server notices are arriving; waiting for player chat</p>
            <p className="mt-1 text-[11px]">Connection and server notices are visible, but no player messages have reached this account from {serverName} yet.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Dock */}
      <form onSubmit={handleSubmit} className="pa-chat-composer p-3 bg-white flex items-center gap-2.5 relative">
        <span className="pa-chat-prompt text-emerald-600 font-mono font-black text-base px-1 select-none">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            composerDisabled
              ? (selectedSenderAccount ? `${selectedSenderAccount.ign || selectedSenderAccount.name} is offline...` : 'No online accounts available to send chat...')
              : 'Type message or command (e.g. /spawn, /lifesteal, hello)...'
          }
          disabled={composerDisabled}
          className="pa-chat-input flex-1 min-w-0 bg-slate-50/80 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-2xs transition"
        />

        <button
          type="submit"
          disabled={composerDisabled || !input.trim()}
          className="pa-chat-send p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0"
          aria-label="Send message"
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
