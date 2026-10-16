'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Send, Trash2, ArrowDown, Terminal as TerminalIcon, MessageSquare } from 'lucide-react';
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
    <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden flex flex-col h-full shadow-md">
      {/* Terminal Header & Toolbar */}
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <TerminalIcon className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 uppercase tracking-wide truncate text-xs">
                {serverName || 'Live Game Console'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">&bull; Real-time Chat</span>
            </div>
            {serverHost && (
              <span className="text-[10px] text-slate-500 font-mono block truncate">
                {serverHost}{serverPort ? `:${serverPort}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filter buttons: All, Players, System (matches VistaAFK) */}
          <div className="flex items-center bg-slate-200/80 rounded-lg p-0.5 border border-slate-300 text-[11px] font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-0.5 rounded-md transition ${filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('chat')}
              className={`px-2.5 py-0.5 rounded-md transition ${filter === 'chat' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Players
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`px-2.5 py-0.5 rounded-md transition ${filter === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
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
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition font-medium"
            >
              <ArrowDown className="w-3 h-3" />
              <span className="hidden sm:inline">Bottom</span>
            </button>
          )}

          <button
            onClick={onClear}
            title="Clear Console"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Commands Bar (Matches VistaAFK) */}
      <div className="px-3.5 py-1.5 bg-slate-100/90 border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto text-xs shrink-0">
        <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider shrink-0 select-none mr-1">
          Quick:
        </span>
        {['/afk', '/lifesteal', '/home', '/spawn', '/tpa accept', '/help', '/resourcepack', '/tpdeny'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => sendQuickCommand(cmd)}
            disabled={disabled}
            className="px-2.5 py-0.5 bg-white hover:bg-emerald-600 hover:text-white disabled:opacity-40 text-slate-800 font-mono text-[11px] font-bold rounded-lg border border-slate-300 shadow-2xs transition whitespace-nowrap cursor-pointer shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Light-Mode Chat Terminal Screen (Clean Slate #f8fafc with VistaAFK MinecraftChatMessage) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-2.5 sm:p-3 overflow-y-auto bg-[#f8fafc] border-b border-slate-200 flex flex-col space-y-0.5"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 select-none py-12">
            <MessageSquare className="h-8 w-8 stroke-[1.5] text-slate-300" />
            <p className="font-mono text-xs text-slate-500">No chat messages received yet.</p>
            {disabled && <p className="text-amber-600 font-mono text-xs font-bold">Bot is currently offline.</p>}
          </div>
        ) : (
          filteredMessages.map((msg, idx) => (
            <MinecraftChatMessage key={msg.id || idx} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Prompt (Matches VistaAFK) */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-slate-50 flex items-center gap-2">
        <span className="text-emerald-600 font-mono font-bold text-sm px-1 select-none">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? 'Bot offline (connect bot to send chat messages)...' : 'Type message or command (e.g. /spawn, /lifesteal, hello)...'}
          disabled={disabled}
          className="flex-1 bg-white border border-slate-300 focus:border-emerald-600 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 disabled:opacity-50 shadow-2xs transition"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition flex items-center gap-1.5 shadow-xs font-bold text-xs font-mono cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
