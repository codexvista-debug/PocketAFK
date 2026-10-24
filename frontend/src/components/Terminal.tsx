'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, QuickCommandItem } from '../types';
import { Send, Trash2, ArrowDown, Terminal as TerminalIcon, MessageSquare, Radio, Users, ChevronDown, Check, Pencil } from 'lucide-react';
import { MinecraftChatMessage } from './MinecraftChatMessage';

export interface ChatAccountItem {
  id: string;
  name: string;
  ign?: string;
  isOnline?: boolean;
}

interface TerminalProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string, senderAccountId?: string) => void;
  onClear: () => void;
  disabled?: boolean;
  serverName?: string;
  serverHost?: string;
  serverPort?: number;
  availableSenders?: ChatAccountItem[];
  selectedSenderId?: string;
  onSelectSender?: (senderId: string) => void;
  quickCommands?: QuickCommandItem[];
  onEditQuickCommands?: () => void;
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
  onClear,
  disabled = false,
  serverName,
  serverHost,
  serverPort,
  availableSenders = [],
  selectedSenderId = 'all',
  onSelectSender,
  quickCommands,
  onEditQuickCommands,
}) => {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
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

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll, filter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim(), selectedSenderId);
    setInput('');
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const sendQuickCommand = (cmd: string) => {
    if (disabled) return;
    onSendMessage(cmd, selectedSenderId);
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'chat') {
      return msg.type === 'chat' || (!msg.type && !msg.sender?.includes('System') && !msg.sender?.includes('Server'));
    }
    if (filter === 'system') {
      return msg.type === 'system' || msg.type === 'session_divider' || msg.type === 'death' || msg.type === 'error';
    }
    return true;
  });

  return (
    <div className="pa-chat-console bg-white border border-slate-300/90 rounded-3xl overflow-hidden flex flex-col h-full shadow-lg shadow-slate-200/50">
      {/* Terminal Header & Toolbar */}
      <div className="pa-chat-console-head bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/90 flex items-center justify-center shrink-0 shadow-2xs">
            <TerminalIcon className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight truncate text-xs">
                {serverName || 'Live Game Console'}
              </span>
            </div>
            {serverHost && (
              <span className="hidden sm:block text-[11px] text-slate-500 font-mono truncate mt-0.5">
                {serverHost}{serverPort ? `:${serverPort}` : ''}
              </span>
            )}
          </div>
        </div>

          <div className="pa-chat-filters flex items-center gap-2.5 shrink-0">
          {/* Segmented Filter Control */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setFilter('all')}
              className={`pa-chat-filter px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'all' ? 'is-active' : ''} ${
                filter === 'all'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('chat')}
              className={`pa-chat-filter px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'chat' ? 'is-active' : ''} ${
                filter === 'chat'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`pa-chat-filter px-3 py-1 rounded-lg transition cursor-pointer ${filter === 'system' ? 'is-active' : ''} ${
                filter === 'system'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              System
            </button>
          </div>

          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition font-bold shadow-2xs cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bottom</span>
            </button>
          )}

          <button
            onClick={onClear}
            title="Clear Chat Log"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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
              disabled={disabled}
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
        onScroll={handleScroll}
        className="pa-chat-stream flex-1 p-3 sm:p-4 overflow-y-auto bg-slate-50/50 border-b border-slate-200 flex flex-col space-y-1"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 select-none py-16">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-300">
              <MessageSquare className="h-6 w-6 stroke-[1.5]" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-mono text-xs font-semibold text-slate-700">No chat messages received yet.</p>
              <p className="text-[11px] text-slate-400">In-game chat and system logs will stream here in real-time.</p>
            </div>
            {disabled && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 font-mono text-xs font-bold px-3 py-1 rounded-full">
                Bot is currently disconnected
              </span>
            )}
          </div>
        ) : (
          filteredMessages.map((msg, idx) => (
            <MinecraftChatMessage key={msg.id || idx} message={msg} darkMode />
          ))
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
            disabled
              ? 'Bot offline (connect bot to send chat messages)...'
              : 'Type message or command (e.g. /spawn, /lifesteal, hello)...'
          }
          disabled={disabled}
          className="pa-chat-input flex-1 min-w-0 bg-slate-50/80 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-2xs transition"
        />

        {/* Sender Account Picker (Matches VistaAFK) */}
        {availableSenders && availableSenders.length > 0 && (
          <div className="pa-chat-sender relative shrink-0" ref={senderDropdownRef}>
            <span className="pa-chat-sender-label">Send as</span>
            <button
              type="button"
              onClick={() => setIsSenderDropdownOpen((prev) => !prev)}
              disabled={disabled}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300/90 text-xs font-bold text-slate-800 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Select which account sends this message"
            >
              {selectedSenderAccount ? (
                <>
                  <img
                    src={`https://minotar.net/helm/${encodeURIComponent(selectedSenderAccount.ign || selectedSenderAccount.name)}/18.png`}
                    alt={selectedSenderAccount.name}
                    className="w-4 h-4 rounded shadow-2xs border border-slate-200 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="truncate max-w-[100px] font-mono text-emerald-700">
                    {selectedSenderAccount.ign || selectedSenderAccount.name}
                  </span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-700 whitespace-nowrap">All accounts</span>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isSenderDropdownOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Send message as
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSender?.('all');
                    setIsSenderDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    !selectedSenderId || selectedSenderId === 'all'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                      <Users className="w-3 h-3" />
                    </div>
                    <span className="flex flex-col text-left">
                      <span>All accounts</span>
                      <span className="pa-chat-option-hint">Send through every account in this profile</span>
                    </span>
                  </div>
                  {(!selectedSenderId || selectedSenderId === 'all') && (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </button>

                <div className="border-t border-slate-100 my-1" />

                <div className="max-h-48 overflow-y-auto">
                  {availableSenders.map((acc) => {
                    const isSelected = selectedSenderId === acc.id || selectedSenderId === acc.ign;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          onSelectSender?.(acc.id);
                          setIsSenderDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={`https://minotar.net/helm/${encodeURIComponent(acc.ign || acc.name)}/20.png`}
                            alt={acc.name}
                            className="w-5 h-5 rounded shadow-2xs border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <span className="truncate font-mono">{acc.ign || acc.name}</span>
                          {acc.isOnline && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="pa-chat-send px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center gap-2 shadow-xs font-bold text-xs font-mono cursor-pointer active:scale-95 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
          <kbd className="hidden md:inline text-[9px] bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-100 font-sans">↵</kbd>
        </button>
      </form>
    </div>
  );
};
