'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

type Population = { online: boolean; players: { online: number; max: number } | null };

export function ServerPlayerCount({ host }: { host: string }) {
  const [population, setPopulation] = useState<Population | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/server-status?host=${encodeURIComponent(host)}`);
        if (!response.ok) return;
        const next = await response.json() as Population;
        if (alive) setPopulation(next);
      } catch {
        if (alive) setPopulation(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [host]);

  const count = population?.players;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-800" title="Players online on this Minecraft server">
      <Users className="h-3 w-3" aria-hidden="true" />
      {count ? `${count.online}/${count.max}` : population?.online === false ? 'Offline' : '—'}
    </span>
  );
}
