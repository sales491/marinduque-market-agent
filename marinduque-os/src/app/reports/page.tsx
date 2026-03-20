'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowRight, Search, Trash2, FileText, Tag, Calendar, Loader2, Bot } from 'lucide-react';
import { mapToTopCategory, TOP_CATEGORIES, type TopCategory } from '@/lib/categories';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PipelineRun {
  session_id: string;
  keyword: string;
  status: string;
  source: string | null;
  created_at: string;
  topCategories: TopCategory[];
}

export default function ReportsPage() {
  const [runs, setRuns]           = useState<PipelineRun[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState<'All' | TopCategory>('All');
  const [deleting, setDeleting]   = useState<string | null>(null);

  useEffect(() => { fetchRuns(); }, []);

  async function fetchRuns() {
    setLoading(true);

    // Fetch completed pipeline runs
    const { data: pipelineData } = await supabase
      .from('pipeline_runs')
      .select('session_id, keyword, status, source, created_at')
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (!pipelineData) { setLoading(false); return; }

    // Fetch all intelligence_report categories to tag each run
    const { data: reportData } = await supabase
      .from('intelligence_reports')
      .select('session_id, category');

    const catsBySession: Record<string, Set<TopCategory>> = {};
    for (const r of (reportData || [])) {
      if (!catsBySession[r.session_id]) catsBySession[r.session_id] = new Set();
      catsBySession[r.session_id].add(mapToTopCategory(r.category));
    }

    const enriched: PipelineRun[] = pipelineData.map(run => ({
      ...run,
      topCategories: Array.from(catsBySession[run.session_id] || []).sort(),
    }));

    setRuns(enriched);
    setLoading(false);
  }

  async function handleDelete(session_id: string, keyword: string) {
    if (!confirm(`Delete the report for "${keyword}"? This cannot be undone.`)) return;
    setDeleting(session_id);
    try {
      const res = await fetch('/api/delete-report', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id }),
      });
      if (res.ok) {
        setRuns(prev => prev.filter(r => r.session_id !== session_id));
      } else {
        const err = await res.json();
        alert('Delete failed: ' + (err.error || 'Unknown error'));
      }
    } finally {
      setDeleting(null);
    }
  }

  // Derive active category tabs (only those with reports)
  const usedCategories = Array.from(
    new Set(runs.flatMap(r => r.topCategories))
  ).sort() as TopCategory[];

  // Filter runs by search + active tab
  const filtered = runs.filter(run => {
    const matchesSearch = !search.trim() ||
      run.keyword.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'All' ||
      run.topCategories.includes(activeTab as TopCategory);
    return matchesSearch && matchesTab;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Intelligence Reports</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full">
        <div className="max-w-5xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Intelligence Reports</h2>
            <p className="text-sm text-neutral-400">
              All completed pipeline runs — analyst gap reports and sales attack plans.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by keyword…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
            />
          </div>

          {/* Category tabs */}
          {!loading && usedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveTab('All')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === 'All'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                All ({runs.length})
              </button>
              {usedCategories.map(cat => {
                const count = runs.filter(r => r.topCategories.includes(cat)).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeTab === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Report cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-neutral-500 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading reports…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl">
              <FileText className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm font-medium">
                {runs.length === 0 ? 'No reports yet.' : 'No reports match your search.'}
              </p>
              {runs.length === 0 && (
                <Link href="/" className="inline-flex items-center gap-1.5 mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                  Run your first pipeline <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(run => (
                <div
                  key={run.session_id}
                  className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-5 flex items-center gap-5 transition-all"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-900/30 border border-emerald-800/40 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-emerald-400" />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm leading-snug truncate mb-1">
                      {run.keyword}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(run.created_at)}
                      </span>
                      {run.topCategories.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Tag className="w-3 h-3" />
                          {run.topCategories.join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Source badge */}
                    <span className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      run.source === 'AI Agent'
                        ? 'bg-violet-900/40 text-violet-300 border border-violet-700/40'
                        : 'bg-sky-900/40 text-sky-300 border border-sky-700/40'
                    }`}>
                      {run.source === 'AI Agent'
                        ? <><Bot className="w-3 h-3" /> AI Agent</>
                        : <><Search className="w-3 h-3" /> Quick Harvest</>}
                    </span>
                    <button
                      onClick={() => handleDelete(run.session_id, run.keyword)}
                      disabled={deleting === run.session_id}
                      title="Delete report"
                      className="p-2 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {deleting === run.session_id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/report/${run.session_id}`}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all"
                    >
                      View Report <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
