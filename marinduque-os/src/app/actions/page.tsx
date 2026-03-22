'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  ListChecks, Search, Loader2, ArrowRight,
  Circle, CheckCircle2, Phone, Trash2, Filter
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ActionStatus = 'not_started' | 'contacted' | 'closed';

interface LeadAction {
  id: string;
  business_id: string;
  business_name: string;
  pitch_service: string;
  pitch_message: string;
  status: ActionStatus;
  town?: string;
  vulnerability_score?: number;
  source_report_id?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_FLOW: ActionStatus[] = ['not_started', 'contacted', 'closed'];
const STATUS_META: Record<ActionStatus, { label: string; color: string; icon: any; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-red-400', icon: Circle, bg: 'bg-red-500/10 border-red-500/20' },
  contacted: { label: 'Contacted', color: 'text-amber-400', icon: Phone, bg: 'bg-amber-500/10 border-amber-500/20' },
  closed: { label: 'Closed', color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

function StatusBadge({ status }: { status: ActionStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.color} ${meta.bg}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

export default function ActionQueuePage() {
  const [actions, setActions] = useState<LeadAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchActions(); }, []);

  async function fetchActions() {
    setLoading(true);
    // Try fetching from lead_actions table
    const { data, error } = await supabase
      .from('lead_actions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setActions(data as LeadAction[]);
    } else {
      // Table might not exist yet — generate actions from Strategist reports
      await generateActionsFromReports();
    }
    setLoading(false);
  }

  async function generateActionsFromReports() {
    // Pull businesses with high vulnerability scores as fallback action items
    const { data: bizData } = await supabase
      .from('businesses')
      .select('id, name, town, vulnerability_score, social_links, has_website, last_fb_post, reviews_count, rating')
      .gte('vulnerability_score', 6)
      .order('vulnerability_score', { ascending: false })
      .limit(15);

    if (!bizData || bizData.length === 0) return;

    const generated: LeadAction[] = bizData.map(biz => {
      const links: string[] = biz.social_links || [];
      const hasFb = links.some((l: string) => l.toLowerCase().includes('facebook.com'));
      let service = 'Website Development';
      let message = `Your business has no website — customers searching for you online can't find you.`;

      if (biz.has_website && !hasFb) {
        service = 'Social Media Management';
        message = `Your business has no Facebook page. In Marinduque, 90% of customers check Facebook first.`;
      } else if (hasFb && biz.last_fb_post) {
        const lastPost = new Date(biz.last_fb_post);
        const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
        if (lastPost < sixMo) {
          service = 'Social Media Revival';
          message = `Your Facebook page hasn't been updated in months — tourists checking your page think you're closed.`;
        }
      } else if (biz.reviews_count < 20 && biz.rating >= 4.0) {
        service = 'Reputation Management';
        message = `You have a great ${biz.rating}-star rating but only ${biz.reviews_count} reviews. Let's amplify that.`;
      }

      return {
        id: `gen_${biz.id}`,
        business_id: biz.id,
        business_name: biz.name,
        pitch_service: service,
        pitch_message: message,
        status: 'not_started' as ActionStatus,
        town: biz.town,
        vulnerability_score: biz.vulnerability_score,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    setActions(generated);
  }

  async function cycleStatus(action: LeadAction) {
    const currentIdx = STATUS_FLOW.indexOf(action.status);
    const nextStatus = STATUS_FLOW[(currentIdx + 1) % STATUS_FLOW.length];

    // Optimistic update
    setActions(prev => prev.map(a =>
      a.id === action.id ? { ...a, status: nextStatus, updated_at: new Date().toISOString() } : a
    ));

    // Try to persist (will silently fail if table doesn't exist)
    if (!action.id.startsWith('gen_')) {
      await supabase.from('lead_actions').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', action.id);
    }
  }

  async function deleteAction(id: string) {
    setActions(prev => prev.filter(a => a.id !== id));
    if (!id.startsWith('gen_')) {
      await supabase.from('lead_actions').delete().eq('id', id);
    }
  }

  // Filtering
  let filtered = actions;
  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.business_name.toLowerCase().includes(q) ||
      a.pitch_service.toLowerCase().includes(q)
    );
  }

  const counts = {
    all: actions.length,
    not_started: actions.filter(a => a.status === 'not_started').length,
    contacted: actions.filter(a => a.status === 'contacted').length,
    closed: actions.filter(a => a.status === 'closed').length,
  };

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Action Queue</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full">
        <div className="max-w-3xl mx-auto">

          {/* Page header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-emerald-400" />
              Action Queue
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Track outreach to your most vulnerable leads — click the status badge to advance.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              {(['all', ...STATUS_FLOW] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {key === 'all' ? 'All' : STATUS_META[key].label} ({counts[key]})
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-600/50"
              />
            </div>
          </div>

          {/* Action cards */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-neutral-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading actions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
              <ListChecks className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">No actions to show.</p>
              <p className="text-neutral-600 text-xs mt-1">Run the pipeline to generate leads.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(action => (
                <div
                  key={action.id}
                  className={`group bg-neutral-900 border rounded-xl p-4 transition-all ${
                    action.status === 'closed' ? 'border-neutral-800/50 opacity-60' : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-semibold ${action.status === 'closed' ? 'text-neutral-400 line-through' : 'text-white'}`}>
                          {action.business_name}
                        </h3>
                        <span className="text-xs text-neutral-600">·</span>
                        <span className="text-xs text-emerald-400 font-medium">{action.pitch_service}</span>
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2 mb-2">
                        &ldquo;{action.pitch_message}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-600">
                        {action.town && <span>{action.town}</span>}
                        {action.vulnerability_score && <span>Score: {action.vulnerability_score}</span>}
                        <span>{new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => cycleStatus(action)} title="Click to advance status">
                        <StatusBadge status={action.status} />
                      </button>
                      <button
                        onClick={() => deleteAction(action.id)}
                        className="p-1.5 rounded-md text-neutral-700 hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
