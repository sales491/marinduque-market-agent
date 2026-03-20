'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  Search, Star, MapPin, Hash, ExternalLink, TrendingUp,
  Trophy, ArrowRight, Loader2, X, BarChart2
} from 'lucide-react';
import { bestCategory, TOP_CATEGORIES } from '@/lib/categories';
import ReactMarkdown from 'react-markdown';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Business {
  id: string;
  name: string;
  categories: string[];
  address: string;
  rating: number;
  reviews_count: number;
  overview: string;
  social_links: string[];
  digital_maturity_score: number;
  website_url: string;
  created_at: string;
}

interface Competitor {
  id: string;
  name: string;
  digital_maturity_score: number;
  rank: number;
  isTarget: boolean;
}

// Deduplicate businesses by name — keep highest digital_maturity_score record
function dedupeByName(businesses: Business[]): Business[] {
  const map = new Map<string, Business>();
  for (const b of businesses) {
    const key = b.name.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing || b.digital_maturity_score > existing.digital_maturity_score) {
      map.set(key, b);
    }
  }
  return Array.from(map.values());
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 5
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${color}`}>
      <BarChart2 className="w-3 h-3" /> {score}/10
    </span>
  );
}

export default function BusinessSearchPage() {
  const [query, setQuery]                 = useState('');
  const [suggestions, setSuggestions]     = useState<Business[]>([]);
  const [sugLoading, setSugLoading]       = useState(false);
  const [selected, setSelected]           = useState<Business | null>(null);
  const [competitors, setCompetitors]     = useState<Competitor[]>([]);
  const [reports, setReports]             = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Debounced search for suggestions
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      const { data } = await supabase
        .from('businesses')
        .select('id, name, categories, digital_maturity_score, address, created_at')
        .ilike('name', `%${query.trim()}%`)
        .order('digital_maturity_score', { ascending: false })
        .limit(30);
      setSuggestions(dedupeByName((data || []) as Business[]).slice(0, 8));
      setSugLoading(false);
      setShowSuggestions(true);
    }, 300);
  }, [query]);

  async function selectBusiness(biz: Business) {
    setSelected(biz);
    setShowSuggestions(false);
    setQuery(biz.name);
    setProfileLoading(true);

    const topCat = bestCategory(biz.categories || []);

    // 1. Fetch all businesses in same top-level category for competitor ranking
    const { data: allInCat } = await supabase
      .from('businesses')
      .select('id, name, categories, digital_maturity_score')
      .order('digital_maturity_score', { ascending: false })
      .limit(500);

    const deduped = dedupeByName((allInCat || []) as Business[])
      .filter(b => bestCategory(b.categories || []) === topCat)
      .sort((a, b) => b.digital_maturity_score - a.digital_maturity_score);

    const targetIdx = deduped.findIndex(
      b => b.name.trim().toLowerCase() === biz.name.trim().toLowerCase()
    );
    const targetRank = targetIdx === -1 ? deduped.length : targetIdx + 1;
    // Show ranks 1..max(targetRank, 1), capped at 10
    const showUpTo = Math.min(Math.max(targetRank, 1), 10);

    setCompetitors(
      deduped.slice(0, showUpTo).map((b, i) => ({
        id: b.id,
        name: b.name,
        digital_maturity_score: b.digital_maturity_score,
        rank: i + 1,
        isTarget: b.name.trim().toLowerCase() === biz.name.trim().toLowerCase(),
      }))
    );

    // 2. Fetch intelligence reports for this category
    const cleanCat = (biz.categories?.[0] || topCat)
      .replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const { data: reportData } = await supabase
      .from('intelligence_reports')
      .select('type, content, created_at')
      .eq('category', cleanCat)
      .order('created_at', { ascending: false })
      .limit(10);

    // Dedupe by type — keep newest
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const r of (reportData || [])) {
      if (!seen.has(r.type)) { unique.push(r); seen.add(r.type); }
    }
    setReports(unique);
    setProfileLoading(false);
  }

  const getScoreColor = (score: number) =>
    score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Business Search</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 w-full">
        <div className="max-w-4xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Business Search</h2>
            <p className="text-sm text-neutral-400">
              Look up any business in the intelligence database — profile, score, social presence, and competitive ranking.
            </p>
          </div>

          {/* Search input */}
          <div ref={wrapperRef} className="relative mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search for a business by name…"
                value={query}
                onChange={e => { setQuery(e.target.value); if (!e.target.value) setSelected(null); }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="w-full pl-12 pr-12 py-3.5 bg-neutral-900 border border-neutral-700 text-white text-base rounded-xl placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50"
              />
              {query && (
                <button onClick={() => { setQuery(''); setSelected(null); setSuggestions([]); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && (query.trim().length > 0) && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-20 overflow-hidden">
                {sugLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-neutral-500">No businesses found matching "{query}"</div>
                ) : (
                  suggestions.map(biz => (
                    <button key={biz.id} onClick={() => selectBusiness(biz)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 transition-colors text-left border-b border-neutral-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{biz.name}</p>
                        <p className="text-xs text-neutral-500">{bestCategory(biz.categories || [])}</p>
                      </div>
                      <ScoreBadge score={biz.digital_maturity_score} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Business Profile */}
          {selected && (
            <div className="space-y-6">
              {profileLoading ? (
                <div className="flex items-center gap-3 text-neutral-500 py-10">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading business profile…</span>
                </div>
              ) : (
                <>
                  {/* Profile card */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white leading-tight">{selected.name}</h3>
                        <div className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
                          <Hash className="w-3 h-3" />
                          {bestCategory(selected.categories || [])}
                        </div>
                      </div>
                      <ScoreBadge score={selected.digital_maturity_score} />
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-400 mb-4">
                      {selected.rating > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {selected.rating} <span className="text-neutral-600">({selected.reviews_count} reviews)</span>
                        </span>
                      )}
                      {selected.address && selected.address !== 'Online/Unknown' && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {selected.address}
                        </span>
                      )}
                    </div>

                    {/* Overview */}
                    {selected.overview && (
                      <p className="text-sm text-neutral-300 leading-relaxed border-l-2 border-emerald-600 pl-3 mb-4">
                        {selected.overview}
                      </p>
                    )}

                    {/* Social links */}
                    {selected.social_links?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selected.social_links.map((link, i) => {
                          let label = link;
                          try { label = new URL(link).hostname.replace('www.', ''); } catch {}
                          return (
                            <a key={i} href={link.startsWith('http') ? link : `https://${link}`}
                              target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1.5 rounded-lg text-emerald-400 transition-colors">
                              <ExternalLink className="w-3 h-3" /> {label}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Competitor ranking */}
                  {competitors.length > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-neutral-800 bg-neutral-800/40">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-semibold text-white">
                          Competitive Ranking — {bestCategory(selected.categories || [])}
                        </h4>
                        <span className="ml-auto text-xs text-neutral-500">by Digital Maturity Score</span>
                      </div>
                      <div className="divide-y divide-neutral-800">
                        {competitors.map(c => (
                          <div key={c.id}
                            className={`flex items-center gap-4 px-5 py-3 transition-colors ${c.isTarget ? 'bg-emerald-900/20 border-l-2 border-emerald-500' : 'hover:bg-neutral-800/40'}`}>
                            {/* Rank badge */}
                            <span className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
                              c.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                              c.rank === 2 ? 'bg-neutral-500/20 text-neutral-300' :
                              c.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-neutral-800 text-neutral-500'
                            }`}>
                              {c.rank}
                            </span>

                            {/* Name */}
                            <span className={`flex-1 text-sm font-medium truncate ${c.isTarget ? 'text-emerald-300' : 'text-neutral-200'}`}>
                              {c.name}
                              {c.isTarget && <span className="ml-2 text-xs text-emerald-500 font-normal">← you</span>}
                            </span>

                            {/* Score */}
                            <span className={`text-sm font-bold flex-shrink-0 ${getScoreColor(c.digital_maturity_score)}`}>
                              {c.digital_maturity_score}
                            </span>

                            {/* Directory link */}
                            <Link href="/directory"
                              className="flex-shrink-0 text-xs text-neutral-600 hover:text-emerald-400 transition-colors flex items-center gap-0.5"
                              title="View in Intelligence Directory">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Intelligence reports */}
                  {reports.length > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-neutral-800 bg-neutral-800/40">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-white">Market Intelligence — {bestCategory(selected.categories || [])}</h4>
                      </div>
                      <div className="p-6 space-y-8">
                        {reports.map((r, i) => (
                          <div key={i}>
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                              {r.type === 'analyst_gap_report' ? '📊 Analyst Gap Report' : '🎯 Strategist Pitch Deck'}
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-neutral-300 prose-strong:text-emerald-300 prose-hr:border-neutral-800 prose-li:text-neutral-300">
                              <ReactMarkdown>
                                {typeof r.content === 'string' ? r.content.replace(/\\n/g, '\n') : r.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selected && !query && (
            <div className="text-center py-24 text-neutral-600">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Start typing a business name to search the intelligence database.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
