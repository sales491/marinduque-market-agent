'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Search, Cpu, Bot, CheckCircle2, Circle, Loader2, AlertCircle, Facebook } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Stage = 'harvesting' | 'synthesizing' | 'analyzing' | 'strategizing' | 'complete' | 'error';

const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: 'harvesting',   label: 'Harvesting',   desc: 'Scanning Google Maps & web sources...' },
  { key: 'synthesizing', label: 'Synthesizing',  desc: 'Building unified business profiles...' },
  { key: 'analyzing',    label: 'Analyzing',     desc: 'Generating market gap reports...' },
  { key: 'strategizing', label: 'Strategizing',  desc: 'Building sales attack plans...' },
  { key: 'complete',     label: 'Complete',      desc: 'Intelligence report ready.' },
];

const STAGE_ORDER: Stage[] = ['harvesting', 'synthesizing', 'analyzing', 'strategizing', 'complete'];

function stageIndex(s: Stage) {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

function StageRow({ stage, current }: { stage: typeof STAGES[0]; current: Stage }) {
  const ci = stageIndex(current);
  const si = stageIndex(stage.key);
  const isDone    = ci > si || current === 'complete';
  const isActive  = stage.key === current && current !== 'complete';
  const isPending = ci < si;
  const isError   = current === 'error' && stage.key === STAGE_ORDER[ci];

  return (
    <div className={`flex items-start gap-4 py-4 px-5 rounded-xl transition-all duration-300 ${
      isActive ? 'bg-emerald-900/20 border border-emerald-800/40' :
      isDone   ? 'opacity-60' : 'opacity-30'
    }`}>
      <div className="mt-0.5 flex-shrink-0">
        {isDone    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
         isActive  ? <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" /> :
         isError   ? <AlertCircle className="w-5 h-5 text-red-400" /> :
                     <Circle className="w-5 h-5 text-neutral-600" />}
      </div>
      <div>
        <p className={`text-sm font-semibold ${isActive ? 'text-white' : isDone ? 'text-neutral-300' : 'text-neutral-500'}`}>
          {stage.label}
        </p>
        {isActive && <p className="text-xs text-emerald-400/80 mt-0.5">{stage.desc}</p>}
      </div>
    </div>
  );
}

export default function AgentOS() {
  const [mode, setMode]           = useState<'agent' | 'manual'>('agent');
  const [useApify, setUseApify]   = useState(false);
  const [prompt, setPrompt]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<Stage | null>(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll pipeline_runs table
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      const { data, error } = await supabase
        .from('pipeline_runs')
        .select('status, error_message')
        .eq('session_id', sessionId)
        .single();

      if (error || !data) return;
      setPipelineStatus(data.status as Stage);
      if (data.error_message) setErrorMsg(data.error_message);

      if (data.status === 'complete' || data.status === 'error') {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [sessionId]);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setSessionId(null);
    setPipelineStatus(null);
    setErrorMsg('');

    try {
      const endpoint = mode === 'agent' ? '/api/harvester-agent' : '/api/harvester';
      const body = mode === 'agent'
        ? { prompt, useApify }
        : { keyword: prompt, type: 'hybrid-discovery' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const sid = data.session_id;
      if (sid) {
        setSessionId(sid);
        setPipelineStatus('harvesting');
      } else {
        throw new Error('No session_id returned from server');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Something went wrong');
      setPipelineStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const isRunning = !!sessionId && pipelineStatus !== 'complete' && pipelineStatus !== 'error';

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Agent Control Center</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full max-w-3xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-neutral-950 border border-emerald-900/30 p-8 mb-8">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Marinduque OS</h1>
            <p className="text-neutral-400 max-w-xl text-base mb-6">
              Autonomous market intelligence — harvest local businesses, synthesize profiles, and generate strategic pitch plans. Powered by AI.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20 group"
            >
              Intelligence Directory
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Search Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Run Intelligence Pipeline</h2>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('agent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'agent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" /> AI Agent
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'manual'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" /> Quick Harvest
            </button>
          </div>

          {/* Facebook / Apify toggle — Agent mode only */}
          {mode === 'agent' && (
            <div className="flex items-center justify-between mb-4 px-4 py-3 bg-neutral-800/60 border border-neutral-700/50 rounded-lg">
              <div className="flex items-center gap-2.5">
                <Facebook className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white leading-none">Facebook Scraper</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Deep scrape via Apify — follower counts, posts, likes</p>
                </div>
              </div>
              <button
                onClick={() => setUseApify(v => !v)}
                disabled={loading || isRunning}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
                  useApify ? 'bg-blue-600' : 'bg-neutral-700'
                }`}
                aria-label="Toggle Facebook scraper"
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  useApify ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-3">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading || isRunning}
              placeholder={
                mode === 'agent'
                  ? 'e.g. "Find all resorts and cafes in Torrijos and check their Facebook presence"'
                  : 'e.g. "Cafes in Boac, Marinduque"'
              }
              rows={3}
              className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-4 py-3 resize-none placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 disabled:opacity-50"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun(); }}
            />
            <button
              onClick={handleRun}
              disabled={loading || isRunning || !prompt.trim()}
              className="self-end px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              {loading ? 'Starting…' : 'Run'}
            </button>
          </div>
          <p className="text-xs text-neutral-600 mt-2">
            {mode === 'agent'
              ? `⌘ + Enter to run · AI Agent — multi-step research${useApify ? ' · Facebook scraper ON' : ''}`
              : '⌘ + Enter to run · Quick Harvest — single keyword Google Maps + SEO scan'}
          </p>
        </div>

        {/* Pipeline Progress */}
        {pipelineStatus && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Pipeline Progress</h3>
              {sessionId && (
                <span className="text-xs text-neutral-600 font-mono">
                  {sessionId.slice(0, 8)}…
                </span>
              )}
            </div>

            {pipelineStatus === 'error' ? (
              <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/40 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Pipeline Error</p>
                  <p className="text-xs text-red-400/80 mt-1">{errorMsg || 'An unknown error occurred.'}</p>
                </div>
              </div>
            ) : pipelineStatus === 'complete' ? (
              <div className="space-y-1">
                {STAGES.filter(s => s.key !== 'error').map(s => (
                  <StageRow key={s.key} stage={s} current="complete" />
                ))}
                <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center gap-4">
                  <Link
                    href={`/report/${sessionId}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all group"
                  >
                    View Intelligence Report
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/directory" className="text-sm text-neutral-400 hover:text-white transition-colors">
                    Intelligence Directory →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {STAGES.filter(s => s.key !== 'error').map(s => (
                  <StageRow key={s.key} stage={s} current={pipelineStatus} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
