'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Terminal,
  Webhook,
  Server,
  Users,
  MessageSquare,
  Footprints,
  Clock,
  Wifi,
  ArrowRight,
  Send,
} from 'lucide-react';

type PreviewTab = 'dashboard' | 'chat' | 'accounts' | 'movement';

const TABS: { id: PreviewTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'chat', label: 'Live Chat' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'movement', label: 'Movement' },
];

// Fictional demo data only
const SESSIONS = [
  { name: 'Session 1', ago: '2h ago', uptime: '4h 12m', server: 'FreshSMP', bots: 2, live: true },
  { name: 'Session 2', ago: 'Yesterday', uptime: '18h 40m', server: 'play.earthmc.net', bots: 1, live: false },
  { name: 'Session 3', ago: '2d ago', uptime: '7h 05m', server: 'FreshSMP', bots: 3, live: false },
];

const CHAT = [
  { who: 'CobbleNomad_42', rank: 'MEMBER', text: 'anyone selling bottles of enchanting?', t: '5s' },
  { who: null, rank: '', text: 'Teleporting to AFK in 5s... Don\'t move!', t: '3s' },
  { who: 'RedstoneFox_', rank: 'VIP', text: 'gg that coinflip was crazy', t: '2s' },
  { who: null, rank: '', text: '$ _SmellyToes just beat qxyy_ in a coinflip worth $1.9K!', t: '1s', reward: true },
];

const ACCOUNTS = [
  { ign: 'CobbleNomad_42', server: 'FreshSMP', online: true },
  { ign: 'RedstoneFox_', server: 'FreshSMP', online: true },
  { ign: 'PixelDrifter', server: 'play.earthmc.net', online: false },
];

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', tab: 'dashboard' as PreviewTab },
  { icon: Sparkles, label: 'Changelog' },
  { icon: Terminal, label: 'Termux Stream' },
  { icon: Webhook, label: 'Webhook' },
  { icon: Server, label: 'Servers' },
  { icon: Users, label: 'Accounts', tab: 'accounts' as PreviewTab },
];

function Head({ ign, size = 20 }: { ign: string; size?: number }) {
  return (
    <img
      src={`https://minotar.net/helm/${encodeURIComponent(ign)}/${size * 2}.png`}
      alt=""
      width={size}
      height={size}
      className="rounded border border-[#5c564a] bg-[#302e29] [image-rendering:pixelated] shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://minotar.net/helm/MHF_Steve/32.png';
      }}
    />
  );
}

export function SitePreview({ onSignIn }: { onSignIn: () => void }) {
  const [tab, setTab] = useState<PreviewTab>('dashboard');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setTab((cur) => TABS[(TABS.findIndex((x) => x.id === cur) + 1) % TABS.length].id);
    }, 4500);
    return () => clearInterval(t);
  }, [paused]);

  const activeSidebar = tab === 'accounts' ? 'Accounts' : tab === 'dashboard' ? 'Dashboard' : null;

  return (
    <div
      onClick={onSignIn}
      className="group w-full cursor-pointer select-none overflow-hidden rounded-2xl border border-[#4c493f] bg-[#1d1c19]/95 shadow-2xl shadow-black/60 backdrop-blur-md transition hover:border-emerald-500/50"
      title="Sign in to open PocketAFK"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-[#3a3831] bg-[#262522] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d86a5f]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e0b94f]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#7cc35a]" />
        <span className="ml-2 flex-1 truncate rounded-md bg-[#1a1916] px-2.5 py-0.5 text-center font-mono text-[10px] text-[#8e8777]">
          pocketafk.vercel.app
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
          Live preview
        </span>
      </div>

      <div className="flex min-h-[330px]">
        {/* Sidebar */}
        <aside className="hidden w-[132px] shrink-0 flex-col border-r border-[#3a3831] bg-[#242321] p-2 sm:flex">
          <div className="mb-2 flex items-center gap-1.5 px-1 py-1">
            <img src="/pocketafk-emblem.png" alt="" className="h-6 w-6 object-contain" />
            <div className="leading-tight">
              <div className="text-[10px] font-black text-[#f2ecdf]">PocketAFK</div>
              <div className="text-[8px] text-[#8e8777]">v2.4 Java Core</div>
            </div>
          </div>
          {NAV.map(({ icon: Icon, label, tab: target }) => (
            <button
              key={label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (target) {
                  setTab(target);
                  setPaused(true);
                }
              }}
              className={`mb-0.5 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-bold transition ${
                activeSidebar === label
                  ? 'border-emerald-600/60 bg-[#294331] text-emerald-200'
                  : 'border-transparent text-[#c8c0b1] hover:bg-[#302e29]'
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
          <div className="mt-2 border-t border-[#3a3831] px-1 pt-2 text-[8px] font-black uppercase tracking-wider text-[#756f62]">
            Server profiles
          </div>
          {['FreshSMP', 'EarthMC'].map((s, i) => (
            <div
              key={s}
              className={`mt-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
                i === 0 ? 'border-emerald-600/50 bg-[#294331] text-emerald-200' : 'border-transparent text-[#c8c0b1]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-emerald-400' : 'bg-[#6b655a]'}`} />
              {s}
            </div>
          ))}
        </aside>

        {/* Main pane */}
        <section className="flex min-w-0 flex-1 flex-col bg-[#1f1e1b]/80">
          {/* Tab strip */}
          <div
            className="flex items-center gap-1 overflow-x-auto border-b border-[#3a3831] px-3 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPaused(true);
                }}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${
                  tab === t.id
                    ? 'border-emerald-500/70 bg-emerald-900/70 text-emerald-200'
                    : 'border-[#3e3b33] bg-[#262522] text-[#a8a18f] hover:text-[#eee9dc]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              <Wifi className="h-2.5 w-2.5" /> Daemon online
            </span>
          </div>

          <div className="flex-1 p-3">
            {tab === 'dashboard' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[#8e8777]">Daemon history</div>
                  <div className="text-sm font-black text-[#f2ecdf]">Recent sessions</div>
                </div>
                {SESSIONS.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 rounded-xl border border-[#3e3b33] bg-[#292824] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-[#f2ecdf]">
                        {s.name}
                        <span
                          className={`rounded px-1 py-px text-[8px] font-bold ${
                            s.live ? 'bg-emerald-900/70 text-emerald-300' : 'bg-[#3a3831] text-[#a8a18f]'
                          }`}
                        >
                          {s.live ? 'LIVE' : 'ENDED'}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#8e8777]">Started {s.ago}</div>
                    </div>
                    <span className="hidden rounded border border-[#4c493f] bg-[#21201d] px-1.5 py-0.5 text-[9px] font-bold text-[#c8c0b1] xs:inline-block">
                      {s.server}
                    </span>
                    <div className="text-right">
                      <div className="text-[8px] font-bold uppercase text-[#756f62]">Uptime</div>
                      <div className="flex items-center gap-1 text-[10px] font-black text-emerald-300">
                        <Clock className="h-2.5 w-2.5" /> {s.uptime}
                      </div>
                    </div>
                    <div className="w-9 text-right text-[9px] text-[#a8a18f]">{s.bots} bot{s.bots > 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'chat' && (
              <div className="flex h-full flex-col gap-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 overflow-hidden rounded-lg border border-[#3e3b33] bg-[#262522] px-2 py-1.5 text-[9px] font-bold">
                  <span className="text-[#756f62]">QUICK:</span>
                  {['/afk', '/home', '/spawn', '/tpa accept'].map((c) => (
                    <span key={c} className="rounded border border-[#5a5549] bg-[#34322d] px-1.5 py-0.5 font-mono text-[#b9e998]">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="flex-1 space-y-1 rounded-xl border border-[#3e3b33] bg-[#181714]/70 p-1.5">
                  {CHAT.map((m, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                        m.reward
                          ? 'border-emerald-700/50 bg-[#29422f]/80'
                          : 'border-[#4a463c]/50 bg-[#24221e]/80'
                      }`}
                    >
                      {m.who ? (
                        <Head ign={m.who} size={20} />
                      ) : (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-[#557254] bg-[#2e4936] text-[9px]">⚙</span>
                      )}
                      <div className="min-w-0 flex-1 truncate text-[10px] text-[#eee8dc]">
                        {m.who && (
                          <>
                            <span className="mr-1 rounded bg-[#34322d] px-1 text-[8px] font-bold text-[#a8a18f]">{m.rank}</span>
                            <b>{m.who}</b> ▶{' '}
                          </>
                        )}
                        {m.text}
                      </div>
                      <span className="rounded-full border border-[#647d3c] bg-[#303b25] px-1.5 text-[9px] font-mono text-[#c7f36a]">{m.t}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[#605a4e] bg-[#211f1c] px-2.5 py-1.5 text-[10px] text-[#8e8777]">
                  <span className="text-[#a9df78]">&gt;</span>
                  <span className="flex-1">Type message or command…</span>
                  <Send className="h-3 w-3" />
                </div>
              </div>
            )}

            {tab === 'accounts' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-[#8e8777]">Microsoft accounts</div>
                    <div className="text-sm font-black text-[#f2ecdf]">Linked Java accounts</div>
                  </div>
                  <span className="rounded-full border border-[#4c493f] bg-[#21201d] px-2 py-0.5 text-[10px] font-bold text-[#c8c0b1]">3/10</span>
                </div>
                {ACCOUNTS.map((a) => (
                  <div key={a.ign} className="flex items-center gap-2.5 rounded-xl border border-[#3e3b33] bg-[#292824] px-3 py-2">
                    <Head ign={a.ign} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black text-[#f2ecdf]">{a.ign}</div>
                      <div className="text-[9px] text-[#8e8777]">{a.server}</div>
                    </div>
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                        a.online
                          ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                          : 'border-[#4c493f] bg-[#21201d] text-[#8e8777]'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${a.online ? 'bg-emerald-400' : 'bg-[#6b655a]'}`} />
                      {a.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-[#4c493f] px-3 py-2 text-center text-[10px] font-bold text-[#a8a18f]">
                  + Add account via Microsoft sign-in
                </div>
              </div>
            )}

            {tab === 'movement' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div>
                  <div className="text-sm font-black text-[#f2ecdf]">Movement &amp; Posture</div>
                  <div className="text-[10px] text-[#a8a18f]">Crouching and AFK posture controls.</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#3e3b33] bg-[#1d1c19] p-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-[#eee9dc]">
                      <Footprints className="h-3 w-3 text-emerald-400" /> Sneak mode
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-px text-[8px] font-extrabold uppercase text-emerald-300">
                        Active
                      </span>
                    </div>
                    <div className="mt-0.5 text-[9px] text-[#9d9685]">Keeps your bot crouched on ledges and farms.</div>
                  </div>
                  <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-600">
                    <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#3e3b33] bg-[#1d1c19] p-3">
                  <div className="text-[10px] text-[#9d9685]">Manual jump to unstick your bot.</div>
                  <span className="rounded-lg border border-[#4c493f] bg-[#302e29] px-2.5 py-1 text-[10px] font-bold text-[#eee9dc]">Jump</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between gap-2 border-t border-[#3a3831] bg-[#242321] px-3 py-2 text-[10px]">
        <span className="flex items-center gap-1.5 truncate text-[#a8a18f]">
          <MessageSquare className="h-3 w-3 text-emerald-400" />
          Demo data — your real accounts and servers appear after sign-in
        </span>
        <span className="flex shrink-0 items-center gap-1 font-black uppercase tracking-wider text-emerald-400 transition-transform group-hover:translate-x-0.5">
          Open app <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
