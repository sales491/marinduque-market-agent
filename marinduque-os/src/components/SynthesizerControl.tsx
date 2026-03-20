"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Loader2 } from "lucide-react";
import { BusinessProfile } from "@/app/api/synthesizer/route";

export function SynthesizerControl() {
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<BusinessProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  const handleSynthesize = async () => {
    setLoading(true);
    setError(null);
    setProfiles(null);
    setMessage(null);

    try {
      const res = await fetch("/api/synthesizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId.trim() || undefined }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setProfiles(data.profiles);
        if (data.message) setMessage(data.message);
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
        <CardTitle>Synthesizer Agent</CardTitle>
        <CardDescription>Clean raw JSON from Harvester into structured Business Profiles with Digital Maturity Scores.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Session ID (leave blank to use latest)"
            className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-50 text-sm rounded-md px-3 py-2 font-mono placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button onClick={handleSynthesize} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
            Run Synthesizer Pipeline
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-900 rounded-md text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        {message && (
          <div className="p-4 bg-emerald-950/50 border border-emerald-900 rounded-md text-emerald-200 text-sm mb-4">
            {message}
          </div>
        )}

        {profiles && (
          <div className="mt-4 space-y-4">
            <h4 className="text-sm font-semibold">Processed Profiles ({profiles.length})</h4>
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex justify-between items-center p-3 text-sm bg-neutral-950 border border-neutral-800 rounded-md hover:bg-neutral-900 overflow-hidden shadow-sm">
                  <div className="flex flex-col min-w-0 flex-1 mr-4">
                    <span className="font-semibold truncate text-neutral-100">{profile.name}</span>
                    <span className="text-xs text-neutral-500 truncate">{profile.address}</span>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="font-medium text-yellow-500">{profile.rating} ⭐ <span className="text-neutral-500">({profile.reviews_count})</span></span>
                    <span className={`text-xs font-bold ${profile.digital_maturity_score > 6 ? 'text-emerald-400' : 'text-orange-400'}`}>Score: {profile.digital_maturity_score}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
