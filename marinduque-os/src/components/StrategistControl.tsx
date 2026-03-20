"use client";

import { useState } from "react";
import { FileText, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function StrategistControl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  const handleStrategist = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);

    const prevMsg = document.getElementById("strategist-batch-msg");
    if (prevMsg) prevMsg.innerText = "";

    try {
      const res = await fetch("/api/strategist", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setPlan(data.plan);
        if (data.message) {
            const msgEl = document.getElementById("strategist-batch-msg");
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
          <FileText className="text-amber-500 w-5 h-5" />
          The Strategist Agent (Batch Mode)
        </CardTitle>
        <CardDescription className="text-neutral-400">
          Consumes the Analyst's category reports to generate highly actionable sales pitches, generating isolated pitch decks for each local market sector.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
        <Button onClick={handleStrategist} disabled={loading} className="mb-4 bg-amber-600 hover:bg-amber-700 text-white w-fit">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
          Run Pipeline: Generate ALL Category Pitch Decks
        </Button>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-md text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        <div id="strategist-batch-msg" className="text-emerald-400 text-sm font-semibold mb-2" />

        {plan && (
          <div className="flex-1 flex flex-col min-h-0">
            <h4 className="text-sm font-semibold mb-2 text-neutral-100 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              Aggregated Batch Sales Plans:
            </h4>
            <div className="flex-1 overflow-y-auto w-full bg-neutral-950 border border-neutral-800 rounded-md p-6 prose prose-invert max-w-none">
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                {plan}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
