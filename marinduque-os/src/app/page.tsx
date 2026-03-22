'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Flame, ArrowRight, RefreshCw } from 'lucide-react';
import { StatsBar } from '@/components/StatsBar';
import { LeadCard, derivePitchTrigger } from '@/components/LeadCard';
import { PipelineDrawer } from '@/components/PipelineDrawer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LeadBoard() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);

    // Fetch top 20 most vulnerable businesses
    const { data, count } = await supabase
      .from('businesses')
      .select('*', { count: 'exact' })
      .order('vulnerability_score', { ascending: false })
      .limit(20);

    if (data) setLeads(data);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Derived stats
  const hotLeads = leads.filter(b => (b.vulnerability_score || 0) >= 7).length;
  const avgScore = leads.length > 0
    ? leads.reduce((sum, b) => sum + (b.vulnerability_score || 0), 0) / leads.length
    : 0;

  const handleLeadClick = (id: string) => {
    router.push(`/hub?selected=${id}`);
  };

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Lead Board</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Hero header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-neutral-950 border border-emerald-900/30 p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-6 h-6 text-emerald-400" />
                  Lead Board
                </h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Today&apos;s most vulnerable businesses — ranked by agency opportunity.
                </p>
              </div>
              <button
                onClick={fetchLeads}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats bar */}
          {!loading && leads.length > 0 && (
            <StatsBar
              totalBusinesses={totalCount}
              hotLeads={hotLeads}
              avgScore={avgScore}
            />
          )}

          {/* Lead cards */}
          {loading ? (
            <div className="text-center text-neutral-500 py-16 animate-pulse">
              Loading leads…
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
              <Flame className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm font-medium">No businesses discovered yet.</p>
              <p className="text-neutral-600 text-xs mt-1">Run the pipeline below to start harvesting leads.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                  Top Leads by Vulnerability
                </h2>
                <button
                  onClick={() => router.push('/hub')}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {leads.map((biz, i) => (
                <LeadCard
                  key={biz.id}
                  rank={i + 1}
                  name={biz.name}
                  town={biz.town || 'Unknown'}
                  score={biz.vulnerability_score || 0}
                  pitchTrigger={derivePitchTrigger(biz)}
                  onClick={() => handleLeadClick(biz.id)}
                />
              ))}
            </div>
          )}

          {/* Pipeline Drawer */}
          <PipelineDrawer onComplete={fetchLeads} />

        </div>
      </main>
    </div>
  );
}
