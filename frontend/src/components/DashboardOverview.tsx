'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CalendarClock, ChevronRight, Clock3, RefreshCw, Server, Users, X } from 'lucide-react';
import { MinecraftAccount, ServerProfile } from '@/types';
import { ServerLogo } from './ServerLogo';

export interface DaemonSessionBot {
  id: string;
  botId: string;
  accountName: string;
  serverHost: string;
  connectedAt: string;
  disconnectedAt: string | null;
}

export interface DaemonSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  bots: DaemonSessionBot[];
}

interface DashboardOverviewProps {
  sessions: DaemonSession[];
  loading: boolean;
  daemonOnline: boolean;
  accounts: MinecraftAccount[];
  servers: ServerProfile[];
  onRefresh: () => void;
}

const durationLabel = (from: string | number, to: string | number | null) => {
  const ms = Math.max(0, (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime());
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [days && `${days}d`, (days || hours) && `${hours}h`, (days || hours || minutes) && `${minutes}m`, `${secs}s`].filter(Boolean).join(' ');
};

const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ sessions, loading, daemonOnline, accounts, servers, onRefresh }) => {
  const [selected, setSelected] = useState<DaemonSession | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const handleKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selected]);

  const getServerForBot = (bot: DaemonSessionBot) => {
    const normalizedHost = bot.serverHost.trim().toLowerCase().replace(/:\d+$/, '');
    return servers.find((server) => bot.botId.startsWith(`${server.id}__`))
      || servers.find((server) => server.serverHost.trim().toLowerCase().replace(/:\d+$/, '') === normalizedHost);
  };

  const getAccountForBot = (bot: DaemonSessionBot) => accounts.find((account) => {
    const name = (account.ign || account.expectedIgn || '').replace(/^@/, '').trim();
    return name && name.toLowerCase() === bot.accountName.replace(/^@/, '').trim().toLowerCase();
  });

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-200 pb-10 text-[#eee9dc]">
      <section className="overflow-hidden rounded-2xl border border-[#514d43] bg-[#252421]/95 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#454239] bg-gradient-to-r from-[#2e3028] to-[#252421] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-950/50 text-emerald-300"><CalendarClock className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8a18f]">Daemon history</p>
              <h1 className="text-xl font-black sm:text-2xl">Recent sessions</h1>
              <p className="mt-0.5 text-xs text-[#bcb5a6]">Your latest five Termux runs, newest first.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${daemonOnline ? 'border-emerald-700/70 bg-emerald-950/50 text-emerald-300' : 'border-[#514d43] bg-[#302e29] text-[#bcb5a6]'}`}>
              <span className={`h-2 w-2 rounded-full ${daemonOnline ? 'bg-emerald-400 animate-pulse' : 'bg-[#847e71]'}`} />{daemonOnline ? 'Daemon online' : 'Daemon offline'}
            </span>
            <button onClick={onRefresh} aria-label="Refresh sessions" title="Refresh sessions" className="rounded-lg border border-[#514d43] bg-[#302e29] p-2 text-[#d8d1c2] transition hover:border-emerald-700 hover:text-emerald-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </header>

        <div className="px-4 py-4 sm:px-7 sm:py-6">
          {loading && sessions.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#bcb5a6]"><RefreshCw className="h-4 w-4 animate-spin" /> Loading daemon sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#514d43] bg-[#211f1c]/70 px-5 text-center">
              <Activity className="mb-3 h-8 w-8 text-emerald-500/80" />
              <h2 className="font-bold">No daemon sessions recorded yet</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#bcb5a6]">Your next Termux start will appear here with its uptime. Bot connection details are collected while the dashboard is connected to the daemon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session, index) => {
                const active = !session.endedAt;
                return (
                  <button key={session.id} onClick={() => setSelected(session)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#4c493f] bg-[#2b2925] px-4 py-4 text-left transition hover:border-emerald-700/80 hover:bg-[#302f29] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#575246] bg-[#353229] text-[#d7c99d]"><Server className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-bold text-[#eee9dc]">Session {index + 1}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-emerald-900/70 text-emerald-300' : 'bg-[#403d35] text-[#c8c0b0]'}`}>{active ? 'RUNNING' : 'ENDED'}</span></span>
                        <span className="mt-1 block truncate text-xs text-[#bcb5a6]">Started {dateLabel(session.startedAt)}</span>
                      </span>
                    </span>
                    <span className="text-right sm:min-w-28 sm:text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#928c7e]">Uptime</span>
                      <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-extrabold text-emerald-200"><Clock3 className="h-3.5 w-3.5" />{durationLabel(session.startedAt, session.endedAt)}</span>
                    </span>
                    <span className="hidden items-center gap-1.5 text-xs text-[#aaa393] sm:inline-flex"><Users className="h-3.5 w-3.5" />{session.bots.length} bot{session.bots.length === 1 ? '' : 's'}<ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" /></span>
                    <span className="col-span-2 flex items-center justify-between border-t border-[#454239] pt-2 text-[11px] text-[#aaa393] sm:hidden"><span>{session.bots.length} bot{session.bots.length === 1 ? '' : 's'}</span><span>Tap for details <ChevronRight className="inline h-3.5 w-3.5" /></span></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#454239] bg-[#211f1c]/70 px-5 py-3 text-[11px] text-[#9f998c] sm:px-7">
          <span>Showing {Math.min(sessions.length, 5)} of the latest 5 sessions</span><span>Session details update as new activity arrives</span>
        </footer>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="daemon-session-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#5a5549] bg-[#262522] text-[#eee9dc] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[#454239] bg-gradient-to-r from-[#303128] to-[#262522] px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8a18f]">Daemon session details</p><h2 id="daemon-session-title" className="mt-1 text-lg font-black">Started {dateLabel(selected.startedAt)}</h2><p className="mt-1 text-xs text-[#bcb5a6]">{selected.endedAt ? `Ended ${dateLabel(selected.endedAt)}` : 'Still running'} · Uptime {durationLabel(selected.startedAt, selected.endedAt)}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close details" className="rounded-lg p-2 text-[#bcb5a6] hover:bg-[#403d35] hover:text-white"><X className="h-5 w-5" /></button>
            </header>
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-emerald-300" />Bots in this session <span className="rounded-full bg-[#403d35] px-2 py-0.5 text-xs text-[#d6cfbf]">{selected.bots.length}</span></div>
              {selected.bots.length ? (() => {
                const groups = new Map<string, { server: ServerProfile | undefined; host: string; bots: DaemonSessionBot[] }>();
                selected.bots.forEach((bot) => {
                  const server = getServerForBot(bot);
                  const host = server?.serverHost || bot.serverHost;
                  const key = server?.id || host.trim().toLowerCase();
                  const group = groups.get(key) || { server, host, bots: [] };
                  group.bots.push(bot);
                  groups.set(key, group);
                });
                return <div className="space-y-4">{Array.from(groups.values()).map((group, groupIndex) => (
                  <section key={`${group.host}-${groupIndex}`} className="overflow-hidden rounded-xl border border-[#4c493f] bg-[#2b2925]">
                    <header className="flex min-w-0 items-center gap-3 border-b border-[#454239] bg-[#323029] px-3 py-3 sm:px-4">
                      <ServerLogo host={group.host} name={group.server?.name || group.host} size="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#f0eadc]">{group.server?.name || group.host}</div>
                        <div className="truncate text-xs text-[#bcb5a6]">{group.host}{group.server?.serverPort && group.server.serverPort !== 25565 ? `:${group.server.serverPort}` : ''}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#514d43] bg-[#252421] px-2.5 py-1 text-[11px] font-bold text-[#cfc8b9]">{group.bots.length} bot{group.bots.length === 1 ? '' : 's'}</span>
                    </header>
                    <div className="divide-y divide-[#454239]">{group.bots.map((bot) => {
                      const account = getAccountForBot(bot);
                      const skinKey = account?.uuid || account?.ign || bot.accountName;
                      return <div key={bot.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={`https://crafthead.net/helm/${encodeURIComponent(skinKey)}/40`}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md border border-[#5a5549] bg-[#403d35] [image-rendering:pixelated]"
                            onError={(event) => { if (!event.currentTarget.src.includes('mc-heads.net')) event.currentTarget.src = `https://mc-heads.net/avatar/${encodeURIComponent(skinKey)}/40`; }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[#eee9dc]">{bot.accountName}</div>
                            <div className="mt-0.5 text-[11px] text-[#a8a18f]">Connected {dateLabel(bot.connectedAt)}</div>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-between rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-xs sm:col-span-1 sm:min-w-32 sm:justify-center">
                          <span className="text-[#bcb5a6] sm:hidden">Bot uptime</span>
                          <span className="font-extrabold text-emerald-200">{durationLabel(bot.connectedAt, bot.disconnectedAt || selected.endedAt)}</span>
                        </div>
                      </div>;
                    })}</div>
                  </section>
                ))}</div>;
              })() : <p className="rounded-xl border border-dashed border-[#514d43] p-5 text-center text-sm text-[#bcb5a6]">No bot connection details were captured for this session.</p>}
            </div>
            <footer className="flex justify-end border-t border-[#454239] px-5 py-3 sm:px-6"><button onClick={() => setSelected(null)} className="rounded-lg border border-[#5a5549] bg-[#34312b] px-4 py-2 text-xs font-bold hover:border-emerald-700 hover:text-emerald-200">Close</button></footer>
          </section>
        </div>
      )}
    </div>
  );
};
