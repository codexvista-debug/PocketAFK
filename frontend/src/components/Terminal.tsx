'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { Send, Trash2, ArrowDown, Terminal as TerminalIcon } from 'lucide-react';
import { cleanMinecraftChatHtml } from '../lib/chatFormatter';

interface TerminalProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({
  messages,
  onSendMessage,
  onClear,
  disabled = false
}) => {
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[520px] shadow-xs">
      {/* Terminal Toolbar */}
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <TerminalIcon className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-slate-900">Live Chat Console</span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500 font-mono">{messages.length} messages</span>
        </div>

        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition font-medium"
            >
              <ArrowDown className="w-3 h-3" />
              Scroll to bottom
            </button>
          )}

          <button
            onClick={onClear}
            title="Clear Console"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Output (Dark high-contrast code pane with authentic Minecraft in-game text styling) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 bg-[#0b0f19] selection:bg-emerald-500/30 text-slate-200"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-center px-4">
            Console ready. Start the bot on Termux to stream live Minecraft chat and events.
          </div>
        ) : (
          messages.map((msg) => {
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const cleanHtml = cleanMinecraftChatHtml(msg.formattedText || msg.raw);

            if (msg.type === 'session_divider') {
              return (
                <div key={msg.id} className="py-2 text-center">
                  <div className="inline-block px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-amber-400 font-bold [text-shadow:1px_1px_0px_rgba(0,0,0,0.85)]">
                    <span dangerouslySetInnerHTML={{ __html: cleanHtml }} />
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-800/40 px-2 py-0.5 rounded transition-colors">
                <span className="text-slate-500 text-[10px] select-none shrink-0 pt-0.5">
                  [{timeStr}]
                </span>
                <div 
                  className="break-all whitespace-pre-wrap text-slate-100 font-mono tracking-wide [text-shadow:1px_1px_0px_rgba(0,0,0,0.85)]"
                  dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? "Bot offline..." : "Send chat or command (e.g. /afk, /spawn, hello)..."}
          disabled={disabled}
          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
