'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import {
  Search, Star, MapPin, ExternalLink, X, Loader2,
  Globe, Facebook, Instagram, Trophy, ArrowUp, ArrowDown,
  Filter, Hash
} from 'lucide-react';
import { bestCategory, extractTown, type TopCategory, TOP_CATEGORIES } from '@/lib/categories';
import { derivePitchTrigger } from '@/components/LeadCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Quick Filters ──────────────────────────────────────────────────────────
type QuickFilter = 'all' | 'hot' | 'no-website' | 'no-facebook' | 'inactive-fb';

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot Leads (7+)' },
  { key: 'no-website', label: 'No Website' },
  { key: 'no-facebook', label: 'No Facebook' },
  { key: 'inactive-fb', label: 'Inactive FB' },
];

function applyFilter(businesses: any[], filter: QuickFilter): any[] {
  switch (filter) {
    case 'hot': return businesses.filter(b => (b.vulnerability_score || 0) >= 7);
    case 'no-website': return businesses.filter(b => !b.has_website);
    case 'no-facebook': return businesses.filter(b => {
      const links: string[] = b.social_links || [];
      return !links.some((l: string) => l.toLowerCase().includes('facebook.com'));
    });
    case 'inactive-fb': return businesses.filter(b => {
      if (!b.last_fb_post) return false;
      const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
      return new Date(b.last_fb_post) < sixMo;
    });
    default: return businesses;
  }
}

// ── Score Colors ───────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 8) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (score >= 5) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-red-400 bg-red-500/15 border-red-500/30';
}

function ScoreBar({ score }: { score: number }) {
  const pct = score * 10;
  const color = score >= 8 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 8 ? 'Hot Lead' : score >= 6 ? 'Warm Lead' : score >= 4 ? 'Developing' : 'Low Priority';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-500">Vulnerability Score</span>
        <span className={`text-xs font-bold ${score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>
          {score}/10 · {label}
        </span>
      </div>
      <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Hub Content (needs useSearchParams) ────────────────────────────────────
function HubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSelected = searchParams.get('selected');

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');
  const [activeCategory, setActiveCategory] = useState<TopCategory | 'All'>('All');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [contextTab, setContextTab] = useState<'competitors' | 'report'>('competitors');
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ── Fetch all businesses ────────────────────────────────────────────────
  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .order('vulnerability_score', { ascending: false })
      .limit(500);
    if (data) setBusinesses(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  // ── When selection changes, load context ────────────────────────────────
  const selected = businesses.find(b => b.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;

    // Build competitor list for same top-category
    const topCat = bestCategory(selected.categories || []);
    const town = extractTown(selected.address || '');

    const sameCat = businesses
      .filter(b => bestCategory(b.categories || []) === topCat)
      .filter(b => {
        if (town !== 'Unknown') return extractTown(b.address || '') === town;
        return true;
      })
      .sort((a, b) => (b.vulnerability_score || 0) - (a.vulnerability_score || 0))
      .slice(0, 10)
      .map((b, i) => ({
        ...b,
        rank: i + 1,
        isTarget: b.id === selected.id,
      }));
    setCompetitors(sameCat);

    // Fetch reports for this category
    setReportsLoading(true);
    const cleanCat = topCat.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    supabase
      .from('intelligence_reports')
      .select('*')
      .eq('category', cleanCat)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) {
          const unique: any[] = [];
          const types = new Set<string>();
          for (const r of data) {
            if (!types.has(r.type)) { unique.push(r); types.add(r.type); }
          }
          setReports(unique);
        }
        setReportsLoading(false);
      });
  }, [selected, businesses]);

  // ── Filtering ───────────────────────────────────────────────────────────
  let filtered = businesses;

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(b =>
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.town && b.town.toLowerCase().includes(q)) ||
      (b.overview && b.overview.toLowerCase().includes(q))
    );
  }

  // Quick filter
  filtered = applyFilter(filtered, activeFilter);

  // Category
  if (activeCategory !== 'All') {
    filtered = filtered.filter(b => bestCategory(b.categories || []) === activeCategory);
  }

  // Grouped categories for tabs
  const catCounts: Record<string, number> = {};
  for (const b of filtered) {
    const cat = bestCategory(b.categories || []);
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const activeCats = TOP_CATEGORIES.filter(c => catCounts[c] > 0);

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Intelligence Hub</h1>
      </header>

      {/* Filter bar */}
      <div className="border-b border-neutral-800 bg-neutral-900/80 px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Quick filters */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          {QUICK_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === f.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, town…"
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-600/50"
          />
        </div>
      </div>

      {/* Category tabs */}
      {activeCats.length > 1 && (
        <div className="border-b border-neutral-800 bg-neutral-900/50 px-6 py-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('All')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              activeCategory === 'All' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            All ({filtered.length})
          </button>
          {activeCats.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeCategory === cat ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {cat} ({catCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Business List ───────────────────────────────────────── */}
        <div className={`flex flex-col border-r border-neutral-800 overflow-y-auto transition-all ${selected ? 'w-72' : 'w-80'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-neutral-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-neutral-500 text-sm py-20 px-4">No businesses match your filters.</div>
          ) : (
            filtered.map(biz => (
              <button
                key={biz.id}
                onClick={() => {
                  setSelectedId(biz.id);
                  router.replace(`/hub?selected=${biz.id}`, { scroll: false });
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-800/50 text-left transition-all hover:bg-neutral-800/50 ${
                  selectedId === biz.id ? 'bg-neutral-800 border-l-2 border-l-emerald-500' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{biz.name}</p>
                  <p className="text-xs text-neutral-500 truncate">
                    {biz.town || 'Unknown'} · {bestCategory(biz.categories || [])}
                  </p>
                </div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-md border text-xs font-bold shrink-0 ${getScoreColor(biz.vulnerability_score || 0)}`}>
                  {biz.vulnerability_score || 0}
                </div>
              </button>
            ))
          )}
        </div>

        {/* ─── CENTER: Business Profile ──────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            <div className="max-w-xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {bestCategory(selected.categories || [])}</span>
                    {selected.town && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.town}</span>}
                    {selected.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {selected.rating} ({selected.reviews_count} reviews)
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSelectedId(null); router.replace('/hub', { scroll: false }); }} className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Pitch trigger */}
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                <p className="text-xs font-semibold text-amber-400">🎯 Pitch Trigger: {derivePitchTrigger(selected)}</p>
              </div>

              {/* Score bar */}
              <ScoreBar score={selected.vulnerability_score || 0} />

              {/* Social links */}
              {selected.social_links?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {selected.social_links.map((link: string, i: number) => {
                    let hostname = link;
                    try { hostname = new URL(link).hostname.replace('www.', ''); } catch {}
                    const isFb = hostname.includes('facebook');
                    const isIg = hostname.includes('instagram');
                    return (
                      <a
                        key={i}
                        href={link.startsWith('http') ? link : `https://${link}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-emerald-400 transition-colors"
                      >
                        {isFb ? <Facebook className="w-3 h-3 text-blue-400" /> :
                         isIg ? <Instagram className="w-3 h-3 text-pink-400" /> :
                         <Globe className="w-3 h-3" />}
                        {hostname}
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Overview */}
              {selected.overview && (
                <p className="mt-4 text-sm text-neutral-300 leading-relaxed border-l-2 border-emerald-500/50 pl-3">
                  {selected.overview}
                </p>
              )}

              {/* Metadata */}
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {selected.fb_likes != null && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                    <p className="text-lg font-bold text-white">{selected.fb_likes.toLocaleString()}</p>
                    <p className="text-[10px] text-neutral-500 uppercase">FB Likes</p>
                  </div>
                )}
                {selected.address && selected.address !== 'Online/Unknown' && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-neutral-300 truncate" title={selected.address}>{selected.address}</p>
                    <p className="text-[10px] text-neutral-500 uppercase mt-0.5">Address</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600">
            <div className="text-center">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a business from the list</p>
            </div>
          </div>
        )}

        {/* ─── RIGHT: Context Panel ─────────────────────────────────────── */}
        {selected && (
          <div className="w-80 border-l border-neutral-800 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setContextTab('competitors')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
                  contextTab === 'competitors'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                <Trophy className="w-3 h-3 inline mr-1" /> Competitors
              </button>
              <button
                onClick={() => setContextTab('report')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
                  contextTab === 'report'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                📊 Sector Report
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {contextTab === 'competitors' ? (
                competitors.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-10">No competitors found.</p>
                ) : (
                  <div className="space-y-1">
                    {competitors.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          router.replace(`/hub?selected=${c.id}`, { scroll: false });
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                          c.isTarget ? 'bg-emerald-900/20 border border-emerald-800/40' : 'hover:bg-neutral-800/50'
                        }`}
                      >
                        <span className={`w-5 text-right font-bold tabular-nums ${c.isTarget ? 'text-emerald-400' : 'text-neutral-600'}`}>
                          {c.rank}
                        </span>
                        <span className={`flex-1 truncate ${c.isTarget ? 'text-white font-semibold' : 'text-neutral-300'}`}>
                          {c.name}
                        </span>
                        <span className={`font-bold tabular-nums ${getScoreColor(c.vulnerability_score || 0).split(' ')[0]}`}>
                          {c.vulnerability_score || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : reportsLoading ? (
                <div className="flex items-center justify-center py-10 text-neutral-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-10 text-neutral-500">
                  <p className="text-xs">No reports for this sector yet.</p>
                  <p className="text-xs text-neutral-600 mt-1">Run the Analyst pipeline to generate them.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((r, i) => (
                    <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                      <div className="bg-neutral-800/50 border-b border-neutral-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {r.type === 'analyst_gap_report' ? '📊 Analyst Report' : '🎯 Strategist Pitch'}
                      </div>
                      <div className="p-3 prose prose-invert prose-emerald prose-xs max-w-none text-xs">
                        <ReactMarkdown>
                          {typeof r.content === 'string' ? r.content.replace(/\\n/g, '\n') : r.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper with Suspense for useSearchParams ─────────────────────────
export default function HubPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    }>
      <HubContent />
    </Suspense>
  );
}
