"use client";

import { Users, Flame, TrendingUp } from "lucide-react";

interface StatsBarProps {
  totalBusinesses: number;
  hotLeads: number;
  avgScore: number;
}

export function StatsBar({ totalBusinesses, hotLeads, avgScore }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Users className="w-4.5 h-4.5 text-sky-400" />
        </div>
        <div>
          <p className="text-xl font-bold text-white tabular-nums">{totalBusinesses}</p>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Businesses</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Flame className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{hotLeads}</p>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Hot Leads</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <TrendingUp className="w-4.5 h-4.5 text-amber-400" />
        </div>
        <div>
          <p className="text-xl font-bold text-white tabular-nums">{avgScore.toFixed(1)}</p>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider">Avg Score</p>
        </div>
      </div>
    </div>
  );
}
