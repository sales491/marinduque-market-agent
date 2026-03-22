"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Bot,
  Search,
  Facebook,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
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
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 ${
        isActive ? "bg-emerald-900/20 border border-emerald-800/40" : isDone ? "opacity-60" : "opacity-30"
      }`}
    >
      <div className="flex-shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isActive ? (
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
        ) : (
          <Circle className="w-4 h-4 text-neutral-600" />
        )}
      </div>
      <p className={`text-xs font-medium ${isActive ? "text-white" : isDone ? "text-neutral-400" : "text-neutral-600"}`}>
        {stage.label}
        {isActive && <span className="ml-2 text-emerald-400/70">{stage.desc}</span>}
      </p>
    </div>
  );
}

interface PipelineDrawerProps {
  /** Called when a pipeline completes so the parent can refresh data */
  onComplete?: () => void;
}

export function PipelineDrawer({ onComplete }: PipelineDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [useApify, setUseApify] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<Stage | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll pipeline_runs table
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
        if (data.status === "complete") onComplete?.();
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId, onComplete]);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setSessionId(null);
    setPipelineStatus(null);
    setErrorMsg("");
    setOpen(true);

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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Drawer header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Run Pipeline</span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {pipelineStatus}…
            </span>
          )}
          {pipelineStatus === "complete" && (
            <span className="text-xs text-emerald-400">✓ Complete</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>

      {/* Drawer body */}
      {open && (
        <div className="px-5 pb-5 border-t border-neutral-800 pt-4 space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("agent")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                mode === "agent"
                  ? "bg-emerald-600/10 border-emerald-600/50 text-white"
                  : "bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white"
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> AI Agent
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                mode === "manual"
                  ? "bg-emerald-600/10 border-emerald-600/50 text-white"
                  : "bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" /> Quick Harvest
            </button>
          </div>

          {/* Apify toggle */}
          {mode === "agent" && (
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 border border-neutral-700/50 rounded-lg">
              <span className="flex items-center gap-2 text-xs text-neutral-300">
                <Facebook className="w-3.5 h-3.5 text-blue-400" /> Facebook Scraper
              </span>
              <button
                onClick={() => setUseApify((v) => !v)}
                disabled={loading || isRunning}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
                  useApify ? "bg-blue-600" : "bg-neutral-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    useApify ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || isRunning}
              placeholder={
                mode === "agent"
                  ? 'e.g. "Find all resorts and cafes in Torrijos"'
                  : 'e.g. "Cafes in Boac, Marinduque"'
              }
              rows={2}
              className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 resize-none placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun();
              }}
            />
            <button
              onClick={handleRun}
              disabled={loading || isRunning || !prompt.trim()}
              className="self-end px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
              Run
            </button>
          </div>

          {/* Pipeline status */}
          {pipelineStatus && (
            <div className="space-y-1">
              {pipelineStatus === "error" ? (
                <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-300">Pipeline Error</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{errorMsg || "Unknown error"}</p>
                  </div>
                </div>
              ) : (
                <>
                  {STAGES.filter((s) => s.key !== "error").map((s) => (
                    <StageRow key={s.key} stage={s} current={pipelineStatus} />
                  ))}
                  {pipelineStatus === "complete" && sessionId && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-3">
                      <Link
                        href={`/report/${sessionId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-all group"
                      >
                        View Report <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
