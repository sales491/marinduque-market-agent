"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function HarvesterControl() {
  const [type, setType] = useState("google-maps");
  const [keyword, setKeyword] = useState("Cafes in Boac, Marinduque");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleHarvest = async () => {
    if (type === "facebook-pages" && !keyword.startsWith("http")) {
      setError("Error: Facebook Pages scraper requires a valid URL (e.g., https://www.facebook.com/kapeboac).");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/harvester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, type }),
      });
      
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.data);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 col-span-full mt-4">
      <CardHeader>
        <CardTitle>Launch Harvest Job</CardTitle>
        <CardDescription>Target specific keywords or URLs and extract raw business data.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <select 
            value={type} 
            onChange={(e) => {
              setType(e.target.value);
              if (e.target.value === "facebook-pages") setKeyword("https://www.facebook.com/zuck");
              else if (e.target.value === "facebook-groups") setKeyword("https://www.facebook.com/groups/marinduquemarketplace");
              else if (e.target.value === "targeted-verification") setKeyword("Marin Brew Cafe Boac");
              else setKeyword("Cafes in Boac, Marinduque");
            }}
            className="bg-neutral-950 border border-neutral-800 text-neutral-50 text-sm rounded-md px-3 py-2 w-full md:w-48 flex-shrink-0"
          >
            <option value="hybrid-discovery">Hybrid Sweep [Maps + Serper]</option>
            <option value="targeted-verification">Targeted Verification (Business Name)</option>
            <option value="google-maps">Google Maps (Keyword)</option>
            <option value="serper-search">Google Search [Serper] (Keyword)</option>
            <option value="facebook-pages">Facebook Page (URL)</option>
            <option value="facebook-groups">Facebook Group (URL)</option>
          </select>
          <input 
            type="text" 
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={type.includes("facebook") ? "https://www.facebook.com/your-target-url" : "e.g. Restaurants in Torrijos"}
            className="w-full md:flex-1 bg-neutral-950 border border-neutral-800 text-neutral-50 text-sm rounded-md px-3 py-2 min-w-0"
          />
          <Button onClick={handleHarvest} disabled={loading} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Start Harvest
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-md text-red-200 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 border border-neutral-800 rounded-md bg-neutral-950 p-4 max-h-64 overflow-y-auto w-full min-w-0">
            <h4 className="text-sm font-semibold mb-2 text-neutral-100">Raw Results ({result?.length || 0} items found)</h4>
            <div className="w-full max-w-full overflow-x-auto">
              <pre className="text-xs text-neutral-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
