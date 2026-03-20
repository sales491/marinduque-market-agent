"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function AgentHarvesterControl() {
  const [prompt, setPrompt] = useState("Run a broad discovery for 'Cafes in Boac, Marinduque'. Select the top 2 and verify their social media presence.");
  const [useApify, setUseApify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleLaunchAgent = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/harvester-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, useApify }),
      });
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 border-l-4 border-l-emerald-500 col-span-full mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" /> 
          Autonomous AI Harvester
        </CardTitle>
        <CardDescription>Give the AI a high-level research goal. It will autonomously discover businesses and run targeted verifications in the background.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Find resorts in Torrijos, pick the top 3, and verify their social media presence."
            className="w-full md:flex-1 bg-neutral-950 border border-neutral-800 text-neutral-50 text-sm rounded-md px-3 py-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex flex-col gap-2 w-full md:w-auto self-start">
            <Button onClick={handleLaunchAgent} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap px-6">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {loading ? 'AI is Researching...' : 'Launch AI'}
            </Button>
            <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={useApify} 
                onChange={(e) => setUseApify(e.target.checked)}
                className="rounded border-neutral-800 bg-neutral-950 text-emerald-600 focus:ring-emerald-500"
              />
              Enable Deep Social Scraping (Apify)
            </label>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-md text-red-200 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="border border-neutral-800 rounded-md bg-neutral-950 p-4 w-full">
              <h4 className="text-sm font-semibold mb-2 text-neutral-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                AI Summary
              </h4>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{result.response || "No summary provided. The AI may have only completed background actions without generating a final text."}</p>
            </div>
            
            <div className="border border-neutral-800 rounded-md bg-neutral-950 p-4 max-h-64 overflow-y-auto w-full min-w-0">
              <h4 className="text-sm font-semibold mb-2 text-neutral-100">Actions Taken by AI ({result.actions?.length || 0})</h4>
              <div className="w-full max-w-full overflow-x-auto">
                <pre className="text-xs text-neutral-400">
                  {JSON.stringify(result.actions, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
