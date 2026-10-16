'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Send, Trash2, ArrowDown, Terminal as TerminalIcon, MessageSquare, Radio } from 'lucide-react';
import { MinecraftChatMessage } from './MinecraftChatMessage';

interface TerminalProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onClear: () => void;
  disabled?: boolean;
  serverName?: string;
  serverHost?: string;
  serverPort?: number;
}

const QUICK_COMMANDS = [
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
}) => {
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'chat' | 'system'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll, filter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
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
    onSendMessage(cmd);
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
    <div className="bg-white border border-slate-300/90 rounded-3xl overflow-hidden flex flex-col h-full shadow-lg shadow-slate-200/50">
      {/* Terminal Header & Toolbar */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/90 flex items-center justify-center shrink-0 shadow-2xs">
            <TerminalIcon className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight truncate text-xs">
                {serverName || 'Live Game Console'}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            {serverHost && (
              <span className="text-[11px] text-slate-500 font-mono block truncate mt-0.5">
                {serverHost}{serverPort ? `:${serverPort}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Segmented Filter Control */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('chat')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                filter === 'chat'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
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
      <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-200/90 flex items-center space-x-2 overflow-x-auto text-xs shrink-0">
        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider shrink-0 select-none mr-0.5">
          Quick:
        </span>
        {QUICK_COMMANDS.map(({ cmd, color }) => (
          <button
            key={cmd}
            onClick={() => sendQuickCommand(cmd)}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold shadow-2xs transition whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-40 active:scale-95 ${color}`}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-3 sm:p-4 overflow-y-auto bg-slate-50/50 border-b border-slate-200 flex flex-col space-y-1"
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
            <MinecraftChatMessage key={msg.id || idx} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Dock */}
      <form onSubmit={handleSubmit} className="p-3 bg-white flex items-center gap-2.5">
        <span className="text-emerald-600 font-mono font-black text-base px-1 select-none">&gt;</span>
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
          className="flex-1 bg-slate-50/80 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-2xs transition"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center gap-2 shadow-xs font-bold text-xs font-mono cursor-pointer active:scale-95 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
          <kbd className="hidden md:inline text-[9px] bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-100 font-sans">↵</kbd>
        </button>
      </form>
    </div>
  );
};
