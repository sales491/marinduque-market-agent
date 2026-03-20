"use client";

import { useState } from "react";
import { LineChart, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function AnalystControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const handleAnalyst = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    
    // Clear out any old messages from the UI when starting a new generation
    const prevMsg = document.getElementById("analyst-batch-msg");
    if (prevMsg) prevMsg.innerText = "";

    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setReport(data.report);
        // show the batch success count dynamically
        if (data.message) {
            const msgEl = document.getElementById("analyst-batch-msg");
            if (msgEl) msgEl.innerText = data.message;
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden flex flex-col h-full">
      <CardHeader className="bg-neutral-900 border-b border-neutral-800 pb-4">
        <CardTitle className="flex items-center gap-2">
          <LineChart className="text-purple-400 w-5 h-5" />
          The Analyst Agent (Batch Mode)
        </CardTitle>
        <CardDescription className="text-neutral-400">
          Scans synthesized master profiles, chunks them into unique market categories, and automatically generates standalone market reports for each industry cluster into your data/analysis folder.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
        <Button onClick={handleAnalyst} disabled={loading} className="mb-4 bg-purple-600 hover:bg-purple-700 text-white w-fit">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Run Pipeline: Generate ALL Category Reports
        </Button>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-md text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        <div id="analyst-batch-msg" className="text-emerald-400 text-sm font-semibold mb-2" />

        {report && (
          <div className="flex-1 flex flex-col min-h-0">
            <h4 className="text-sm font-semibold mb-2 text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Aggregated Batch Preview:
            </h4>
            <div className="flex-1 overflow-y-auto w-full bg-neutral-950 border border-neutral-800 rounded-md p-6 prose prose-invert max-w-none">
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                {report}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
