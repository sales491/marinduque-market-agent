"use client";

import { MapPin, AlertTriangle, Globe, Facebook } from "lucide-react";

interface LeadCardProps {
  rank: number;
  name: string;
  town: string;
  score: number;
  pitchTrigger: string;
  onClick?: () => void;
}

export function LeadCard({ rank, name, town, score, pitchTrigger, onClick }: LeadCardProps) {
  const scoreColor =
    score >= 8 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    score >= 5 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
               "bg-red-500/15 text-red-400 border-red-500/30";

  const triggerIcon = pitchTrigger.toLowerCase().includes("website")
    ? <Globe className="w-3.5 h-3.5" />
    : pitchTrigger.toLowerCase().includes("facebook") || pitchTrigger.toLowerCase().includes("social")
    ? <Facebook className="w-3.5 h-3.5" />
    : <AlertTriangle className="w-3.5 h-3.5" />;

  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-600/40 hover:bg-neutral-800/60 transition-all duration-200 text-left"
    >
      {/* Rank */}
      <span className="text-2xl font-black tabular-nums text-neutral-700 group-hover:text-neutral-500 transition-colors w-8 text-center shrink-0">
        {rank}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <MapPin className="w-3 h-3" />
            {town}
          </span>
          <span className="text-neutral-700">·</span>
          <span className="flex items-center gap-1 text-xs text-amber-400/80">
            {triggerIcon}
            {pitchTrigger}
          </span>
        </div>
      </div>

      {/* Score badge */}
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg border text-sm font-bold shrink-0 ${scoreColor}`}>
        {score}
      </div>
    </button>
  );
}

/**
 * Derive the primary pitch trigger from business data.
 */
export function derivePitchTrigger(biz: any): string {
  const links: string[] = biz.social_links || [];
  const hasFb = links.some((l: string) => l.toLowerCase().includes("facebook.com"));
  const hasWebsite = biz.has_website || links.some((l: string) => {
    const lower = l.toLowerCase();
    return lower.startsWith("http") && !lower.includes("facebook") && !lower.includes("instagram") && !lower.includes("tiktok");
  });

  if (!hasWebsite) return "No website";
  if (!hasFb) return "No Facebook page";
  if (biz.last_fb_post) {
    const lastPost = new Date(biz.last_fb_post);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (lastPost < sixMonthsAgo) return "Facebook inactive 6mo+";
  }
  if (biz.fb_likes && biz.fb_likes < 500) return "Low FB engagement";
  if (biz.reviews_count && biz.reviews_count < 20 && biz.rating >= 4.0) return "Needs review generation";
  return "Low digital presence";
}
