'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  Search, Star, MapPin, Hash, ExternalLink, TrendingUp,
  Trophy, ArrowRight, Loader2, X, BarChart2, Globe,
  Facebook, Instagram, Phone, Building2
} from 'lucide-react';
import { bestCategory, extractTown, mapToTopCategory, type MarinduqueTown } from '@/lib/categories';
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
  vulnerability_score: number;
  website_url: string;
  created_at: string;
}

interface Competitor {
  id: string;
  name: string;
  vulnerability_score: number;
  social_link_count: number;
  rating: number;
  rank: number;
  isTarget: boolean;
}

const JUNK_ADDRESSES = ['online/unknown', 'verified via', 'snippet:'];

function addressQuality(address: string): number {
  if (!address) return 0;
  const l = address.toLowerCase();
  return JUNK_ADDRESSES.some(j => l.includes(j)) ? 0 : 1;
}

function dedupeByName(businesses: Business[]): Business[] {
  const map = new Map<string, Business>();
  for (const b of businesses) {
    const key = b.name.trim().toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, b);
    } else {
      const eq = addressQuality(existing.address);
      const bq = addressQuality(b.address);
      if (bq > eq || (bq === eq && b.vulnerability_score > existing.vulnerability_score)) {
        // `b` wins — inherit social links from the loser `existing`
        const merged = Array.from(new Set([...(b.social_links || []), ...(existing.social_links || [])]));
        map.set(key, { ...b, social_links: merged });
      } else {
        // `existing` wins — absorb social links from challenger `b`
        existing.social_links = Array.from(new Set([...(existing.social_links || []), ...(b.social_links || [])]));
      }
    }
  }
  return Array.from(map.values());
}

function classifyLink(url: string): 'facebook' | 'instagram' | 'website' | 'other' {
  const l = url.toLowerCase();
  if (l.includes('facebook.com') || l.includes('fb.com')) return 'facebook';
  if (l.includes('instagram.com')) return 'instagram';
  if (l.startsWith('http')) return 'website';
  return 'other';
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : score >= 5
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${color}`}>
      <BarChart2 className="w-3 h-3" /> {score}/10
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = score * 10;
  const color = score >= 8 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 8 ? 'Hot Lead' : score >= 6 ? 'Warm Lead' : score >= 4 ? 'Developing' : 'Low Priority';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-neutral-500">Vulnerability</span>
        <span className={`text-xs font-bold ${score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{label}</span>
      </div>
      <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-600 mt-1">{score}/10 — {pct}th percentile equivalent</p>
    </div>
  );
}

export default function BusinessSearchPage() {
  const [query, setQuery]                   = useState('');
  const [suggestions, setSuggestions]       = useState<Business[]>([]);
  const [sugLoading, setSugLoading]         = useState(false);
  const [selected, setSelected]             = useState<Business | null>(null);
  const [competitorTown, setCompetitorTown] = useState<MarinduqueTown | null>(null);
  const [competitors, setCompetitors]       = useState<Competitor[]>([]);
  const [reports, setReports]               = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      const { data } = await supabase
        .from('businesses')
        .select('id, name, categories, vulnerability_score, address, created_at')
        .ilike('name', `%${query.trim()}%`)
        .order('vulnerability_score', { ascending: false })
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
    const town   = extractTown(biz.address || '');
    setCompetitorTown(town !== 'Unknown' ? town : null);

    // ── Query 1: All businesses for competitor ranking ───────────────────────
    const { data: allBiz } = await supabase
      .from('businesses')
      .select('id, name, categories, vulnerability_score, social_links, rating, address')
      .order('vulnerability_score', { ascending: false })
      .limit(500);

    const deduped = dedupeByName((allBiz || []) as Business[])
      .filter(b => {
        if (bestCategory(b.categories || []) !== topCat) return false;
        if (town !== 'Unknown') return extractTown(b.address || '') === town;
        return true;
      })
      .sort((a, b) => b.vulnerability_score - a.vulnerability_score);

    const targetIdx  = deduped.findIndex(b => b.name.trim().toLowerCase() === biz.name.trim().toLowerCase());
    const targetRank = targetIdx === -1 ? deduped.length : targetIdx + 1;
    const showUpTo   = Math.min(Math.max(targetRank, 1), 10);

    setCompetitors(
      deduped.slice(0, showUpTo).map((b, i) => ({
        id: b.id,
        name: b.name,
        vulnerability_score: b.vulnerability_score,
        social_link_count: (b.social_links || []).length,
        rating: b.rating || 0,
        rank: i + 1,
        isTarget: b.name.trim().toLowerCase() === biz.name.trim().toLowerCase(),
      }))
    );

    // ── Query 2: Intelligence reports — matched by top-level category ────────
    // New pipeline runs use slugs like 'food_and_beverage'.
    // Old runs used raw slugs like 'cafe', 'bar'. We handle both.
    const newSlug = topCat.toLowerCase().replace(/[^a-z0-9]/g, '_'); // e.g. food_and_beverage

    const { data: allReports } = await supabase
      .from('intelligence_reports')
      .select('type, content, category, created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    const matched = (allReports || []).filter(r => {
      const cat = r.category || '';
      // Exact match on new slug (highest priority)
      if (cat === newSlug) return true;
      // Fallback: old raw slug that maps to same top-level category
      return mapToTopCategory(cat) === topCat;
    });

    // Dedupe by type — keep newest per type, prefer new-format slugs
    const seen = new Set<string>();
    const unique: any[] = [];
    // Sort: new-slug matches first
    const sorted = [...matched].sort((a, b) =>
      (a.category === newSlug ? -1 : 1) - (b.category === newSlug ? -1 : 1)
    );
    for (const r of sorted) {
      if (!seen.has(r.type)) { unique.push(r); seen.add(r.type); }
    }
    setReports(unique);
    setProfileLoading(false);
  }

  const getScoreColor = (score: number) =>
    score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400';

  // Classify social links for display
  const socialsByType = (links: string[]) => {
    const fb  = links.filter(l => classifyLink(l) === 'facebook');
    const ig  = links.filter(l => classifyLink(l) === 'instagram');
    const web = links.filter(l => classifyLink(l) === 'website' && !fb.includes(l) && !ig.includes(l));
    return { fb, ig, web };
  };

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
              Business intelligence profile — digital footprint, competitive ranking, and sector analysis.
            </p>
          </div>

          {/* Search */}
          <div ref={wrapperRef} className="relative mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search for a business by name…"
                value={query}
                onChange={e => { setQuery(e.target.value); if (!e.target.value) { setSelected(null); setCompetitors([]); setReports([]); } }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="w-full pl-12 pr-12 py-3.5 bg-neutral-900 border border-neutral-700 text-white text-base rounded-xl placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600/50"
              />
              {query && (
                <button onClick={() => { setQuery(''); setSelected(null); setSuggestions([]); setCompetitors([]); setReports([]); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggestions && query.trim().length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-20 overflow-hidden">
                {sugLoading ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-neutral-500">No results for "{query}"</div>
                ) : (
                  suggestions.map(biz => (
                    <button key={biz.id} onClick={() => selectBusiness(biz)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-800 transition-colors text-left border-b border-neutral-800 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{biz.name}</p>
                        <p className="text-xs text-neutral-500">
                          {bestCategory(biz.categories || [])}
                          {extractTown(biz.address || '') !== 'Unknown' && ` · ${extractTown(biz.address || '')}`}
                        </p>
                      </div>
                      <ScoreBadge score={biz.vulnerability_score} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          {selected && (
            <div className="space-y-5">
              {profileLoading ? (
                <div className="flex items-center gap-3 text-neutral-500 py-12">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Building business intelligence profile…</span>
                </div>
              ) : (
                <>
                  {/* ── 1. BUSINESS IDENTITY ─────────────────────────────── */}
                  <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-2xl font-bold text-white leading-tight">{selected.name}</h3>
                      <ScoreBadge score={selected.vulnerability_score} />
                    </div>

                    {/* Tag row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                        <Hash className="w-3 h-3 text-emerald-500" /> {bestCategory(selected.categories || [])}
                      </span>
                      {extractTown(selected.address || '') !== 'Unknown' && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                          <MapPin className="w-3 h-3 text-emerald-500" /> {extractTown(selected.address || '')}
                        </span>
                      )}
                      {selected.rating > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {selected.rating} ({selected.reviews_count} reviews)
                        </span>
                      )}
                    </div>

                    {selected.address && !['Online/Unknown', 'Verified via Targeted Search'].includes(selected.address) && (
                      <p className="text-xs text-neutral-500 mb-4 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" /> {selected.address}
                      </p>
                    )}

                    {selected.overview && (
                      <p className="text-sm text-neutral-300 leading-relaxed border-l-2 border-emerald-600 pl-3">
                        {selected.overview}
                      </p>
                    )}
                  </section>

                  {/* ── 2. DIGITAL FOOTPRINT ─────────────────────────────── */}
                  <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-5">Digital Footprint</h4>

                    <ScoreBar score={selected.vulnerability_score} />

                    {selected.social_links?.length > 0 ? (
                      <div className="mt-5">
                        <p className="text-xs text-neutral-500 mb-3">Online Presences ({selected.social_links.length})</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selected.social_links.map((link, i) => {
                            const type = classifyLink(link);
                            let label = link;
                            try { label = new URL(link).hostname.replace('www.', ''); } catch {}
                            const Icon = type === 'facebook' ? Facebook
                              : type === 'instagram' ? Instagram
                              : type === 'website' ? Globe
                              : ExternalLink;
                            const iconColor = type === 'facebook' ? 'text-blue-400'
                              : type === 'instagram' ? 'text-pink-400'
                              : 'text-emerald-400';
                            return (
                              <a key={i}
                                href={link.startsWith('http') ? link : `https://${link}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2.5 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 rounded-lg transition-colors group">
                                <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                                <span className="text-sm text-neutral-300 group-hover:text-white truncate">{label}</span>
                                <ExternalLink className="w-3 h-3 ml-auto text-neutral-600 flex-shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex items-center gap-2 text-xs text-neutral-600">
                        <Globe className="w-4 h-4" />
                        No social or web presences found in database.
                      </div>
                    )}
                  </section>

                  {/* ── 3. COMPETITIVE LANDSCAPE ─────────────────────────── */}
                  {competitors.length > 0 && (
                    <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-800 bg-neutral-800/40">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <div>
                          <h4 className="text-sm font-semibold text-white">
                            Competitive Landscape{' '}
                            {competitorTown
                              ? <span className="text-emerald-400">· {competitorTown}</span>
                              : <span className="text-neutral-500">· Island-wide</span>
                            }
                          </h4>
                          <p className="text-xs text-neutral-500 mt-0.5">{bestCategory(selected.categories || [])} · ranked by Vulnerability Score</p>
                        </div>
                      </div>

                      {/* Column headers */}
                      <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 px-5 py-2 border-b border-neutral-800/60 text-xs text-neutral-600 font-medium">
                        <span>#</span>
                        <span>Business</span>
                        <span className="text-right">Rating</span>
                        <span className="text-right">Links</span>
                        <span className="text-right">Score</span>
                      </div>

                      <div className="divide-y divide-neutral-800/60">
                        {competitors.map(c => (
                          <div key={c.id}
                            className={`grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center px-5 py-3 transition-colors ${
                              c.isTarget ? 'bg-emerald-900/20 border-l-2 border-emerald-500' : 'hover:bg-neutral-800/30'
                            }`}>
                            {/* Rank */}
                            <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                              c.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                              c.rank === 2 ? 'bg-neutral-500/20 text-neutral-300' :
                              c.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-neutral-800 text-neutral-500'
                            }`}>{c.rank}</span>

                            {/* Name */}
                            <span className={`text-sm font-medium truncate ${c.isTarget ? 'text-emerald-300' : 'text-neutral-200'}`}>
                              {c.name}
                              {c.isTarget && <span className="ml-2 text-xs text-emerald-600 font-normal">← you</span>}
                            </span>

                            {/* Rating */}
                            <span className="text-xs text-neutral-400 text-right tabular-nums">
                              {c.rating > 0 ? <>⭐ {c.rating}</> : <span className="text-neutral-700">—</span>}
                            </span>

                            {/* Social link count */}
                            <span className="text-xs text-right tabular-nums">
                              <span className={c.social_link_count > 0 ? 'text-emerald-500' : 'text-neutral-700'}>
                                {c.social_link_count > 0 ? `${c.social_link_count} link${c.social_link_count !== 1 ? 's' : ''}` : 'none'}
                              </span>
                            </span>

                            {/* Score + dir link */}
                            <span className="flex items-center gap-2 justify-end">
                              <span className={`text-sm font-bold tabular-nums ${getScoreColor(c.vulnerability_score)}`}>
                                {c.vulnerability_score}
                              </span>
                              <Link href="/directory"
                                className="text-neutral-700 hover:text-emerald-400 transition-colors"
                                title="View in Intelligence Directory">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Scope callout — only when town is known */}
                  {competitorTown && reports.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-800/30 rounded-lg text-xs text-neutral-500 border border-neutral-800">
                      <span className="text-neutral-600 flex-shrink-0">ℹ</span>
                      <span>
                        Competitive ranking above is scoped to{' '}
                        <span className="text-emerald-400 font-medium">{competitorTown}</span>.
                        {' '}Sector intelligence below covers{' '}
                        <span className="text-neutral-300 font-medium">all of Marinduque</span>.
                      </span>
                    </div>
                  )}

                  {/* ── 4. SECTOR INTELLIGENCE ───────────────────────────── */}
                  {reports.length > 0 && (
                    <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-800 bg-neutral-800/40">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <div>
                          <h4 className="text-sm font-semibold text-white">Sector Intelligence</h4>
                          <p className="text-xs text-neutral-500 mt-0.5">All Marinduque · {bestCategory(selected.categories || [])} sector · from pipeline runs</p>
                        </div>
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
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selected && !query && (
            <div className="text-center py-24 text-neutral-600">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Search for a business to view its intelligence profile.</p>
              <p className="text-xs mt-1 text-neutral-700">Identity · Digital Footprint · Competitive Landscape · Sector Intelligence</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
