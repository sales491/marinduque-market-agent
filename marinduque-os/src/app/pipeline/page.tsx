"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Cpu,
  Bot,
  Search,
  Facebook,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Stage =
  | "harvesting"
  | "synthesizing"
  | "analyzing"
  | "strategizing"
  | "complete"
  | "error";

const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: "harvesting", label: "Harvesting", desc: "Scanning Google Maps & web sources…" },
  { key: "synthesizing", label: "Synthesizing", desc: "Building unified business profiles…" },
  { key: "analyzing", label: "Analyzing", desc: "Generating market gap reports…" },
  { key: "strategizing", label: "Strategizing", desc: "Building sales attack plans…" },
  { key: "complete", label: "Complete", desc: "Intelligence report ready." },
];

const STAGE_ORDER: Stage[] = ["harvesting", "synthesizing", "analyzing", "strategizing", "complete"];

function stageIndex(s: Stage) {
  const i = STAGE_ORDER.indexOf(s);
  return i === -1 ? 0 : i;
}

function StageRow({ stage, current }: { stage: (typeof STAGES)[0]; current: Stage }) {
  const ci = stageIndex(current);
  const si = stageIndex(stage.key);
  const isDone = ci > si || current === "complete";
  const isActive = stage.key === current && current !== "complete";

  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-200 ${
        isActive ? "bg-emerald-900/20 border border-emerald-800/40" : isDone ? "opacity-60" : "opacity-30"
      }`}
    >
      <div className="flex-shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        ) : isActive ? (
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        ) : (
          <Circle className="w-5 h-5 text-neutral-600" />
        )}
      </div>
      <p className={`text-sm font-medium ${isActive ? "text-white" : isDone ? "text-neutral-400" : "text-neutral-600"}`}>
        {stage.label}
        {isActive && <span className="ml-2 text-emerald-400/70">{stage.desc}</span>}
      </p>
    </div>
  );
}

export default function PipelinePage() {
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [useApify, setUseApify] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<Stage | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("status, error_message")
        .eq("session_id", sessionId)
        .single();
      if (error || !data) return;
      setPipelineStatus(data.status as Stage);
      if (data.error_message) setErrorMsg(data.error_message);
      if (data.status === "complete" || data.status === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId]);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setSessionId(null);
    setPipelineStatus(null);
    setErrorMsg("");

    try {
      const endpoint = mode === "agent" ? "/api/harvester-agent" : "/api/harvester";
      const body =
        mode === "agent"
          ? { prompt, useApify, source: "AI Agent" }
          : { keyword: prompt, type: "hybrid-discovery", source: "Quick Harvest" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const sid = data.session_id;
      if (sid) {
        setSessionId(sid);
        setPipelineStatus("harvesting");
      } else {
        throw new Error("No session_id returned from server");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Something went wrong");
      setPipelineStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const isRunning = !!sessionId && pipelineStatus !== "complete" && pipelineStatus !== "error";

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Pipeline</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden w-full">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-neutral-950 border border-emerald-900/30 p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Cpu className="w-6 h-6 text-emerald-400" />
                  AI Pipeline
                </h1>
                <p className="text-neutral-400 text-sm mt-1">
                  Configure and launch data harvesting processes for market intelligence.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden p-6 space-y-6 shadow-xl relative z-10">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode("agent")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                  mode === "agent"
                    ? "bg-emerald-600/10 border-emerald-600/50 text-white"
                    : "bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white"
                }`}
              >
                <Bot className="w-4 h-4" /> AI Agent
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                  mode === "manual"
                    ? "bg-emerald-600/10 border-emerald-600/50 text-white"
                    : "bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white"
                }`}
              >
                <Search className="w-4 h-4" /> Quick Harvest
              </button>
            </div>

            {/* Apify toggle */}
            {mode === "agent" && (
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-800/60 border border-neutral-700/50 rounded-lg">
                <span className="flex items-center gap-2 text-sm text-neutral-300">
                  <Facebook className="w-4 h-4 text-blue-400" /> Deep Facebook Search (Requires Apify)
                </span>
                <button
                  onClick={() => setUseApify((v) => !v)}
                  disabled={loading || isRunning}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                    useApify ? "bg-blue-600" : "bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      useApify ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-neutral-300">Prompt / Target</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading || isRunning}
                placeholder={
                  mode === "agent"
                    ? 'e.g. "Find all resorts and cafes in Torrijos"'
                    : 'e.g. "Cafes in Boac, Marinduque"'
                }
                rows={3}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-4 py-3 resize-none placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun();
                }}
              />

              <div className="relative mb-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setPrompt(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  disabled={loading || isRunning}
                  className="w-full bg-neutral-800/50 border border-neutral-700/50 text-neutral-400 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-600/50 disabled:opacity-50 appearance-none cursor-pointer hover:bg-neutral-800 transition-colors"
                >
                  <option value="" disabled>✨ Load an example prompt...</option>
                  <optgroup label="Tourism & Hospitality">
                    <option value="Find all beachfront resorts and accommodations in Torrijos">Find beachfront resorts and accommodations in Torrijos</option>
                    <option value="Cafes and coffee shops in Boac, Marinduque">Cafes and coffee shops in Boac</option>
                    <option value="Local farmstays and eco-tourism sites in Buenavista">Local farmstays and eco-tourism sites in Buenavista</option>
                  </optgroup>
                  <optgroup label="Local Business Discovery">
                    <option value="Top rated restaurants in Santa Cruz with no website">Top rated restaurants in Santa Cruz with no website</option>
                    <option value="Hardware stores and construction suppliers across Marinduque">Hardware stores and construction suppliers across Marinduque</option>
                    <option value="Healthcare clinics and pharmacies in Mogpog">Healthcare clinics and pharmacies in Mogpog</option>
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                </div>
              </div>
              <button
                onClick={handleRun}
                disabled={loading || isRunning || !prompt.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                {isRunning ? "Running Pipeline..." : "Execute Pipeline"}
              </button>
            </div>

            {/* Pipeline status */}
            {pipelineStatus && (
              <div className="mt-8 space-y-2 border-t border-neutral-800 pt-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">
                  Pipeline Status
                </h3>
                {pipelineStatus === "error" ? (
                  <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/40 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-300">Pipeline Error</p>
                      <p className="text-sm text-red-400/80 mt-1">{errorMsg || "Unknown error"}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      {STAGES.filter((s) => s.key !== "error").map((s) => (
                        <StageRow key={s.key} stage={s} current={pipelineStatus} />
                      ))}
                    </div>
                    {pipelineStatus === "complete" && sessionId && (
                      <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center gap-3">
                        <Link
                          href={`/report/${sessionId}`}
                          className="inline-flex items-center justify-center gap-2 w-full py-3 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600 text-white text-sm font-semibold rounded-lg transition-all group shadow-md"
                        >
                          View Intelligence Report <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
