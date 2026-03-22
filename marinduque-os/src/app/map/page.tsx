'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import {
  MapPin, Star, ExternalLink, X, Loader2, Globe, Facebook, Hash
} from 'lucide-react';
import { bestCategory } from '@/lib/categories';
import { derivePitchTrigger } from '@/components/LeadCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Dynamically import the map component (Leaflet requires window)
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(m => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then(m => m.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(m => m.Popup),
  { ssr: false }
);

// Marinduque town center coordinates for approximate plotting
const TOWN_COORDS: Record<string, [number, number]> = {
  'Boac':        [13.445, 121.843],
  'Mogpog':      [13.480, 121.860],
  'Santa Cruz':  [13.480, 121.920],
  'Torrijos':    [13.405, 122.080],
  'Buenavista':  [13.260, 121.950],
  'Gasan':       [13.320, 121.850],
};

// Jitter coordinates slightly so pins don't overlap
function jitter(base: [number, number], index: number): [number, number] {
  const angle = (index * 137.5) * (Math.PI / 180); // golden angle
  const radius = 0.003 + (index % 5) * 0.001;
  return [
    base[0] + Math.cos(angle) * radius,
    base[1] + Math.sin(angle) * radius,
  ];
}

function getMarkerColor(score: number): string {
  if (score >= 7) return '#ef4444'; // red — hot lead
  if (score >= 4) return '#f59e0b'; // amber — warm
  return '#22c55e'; // green — low vulnerability
}

export default function MapPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState<any | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Leaflet CSS must be loaded client-side
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    setMapReady(true);
    return () => { document.head.removeChild(link); };
  }, []);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .order('vulnerability_score', { ascending: false })
      .limit(500);
    if (data) setBusinesses(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  // Group businesses by town for coordinate assignment
  const townCounters: Record<string, number> = {};
  const plotted = businesses.map(biz => {
    const town = biz.town || 'Boac';
    const baseCoord = TOWN_COORDS[town] || TOWN_COORDS['Boac'];
    if (!townCounters[town]) townCounters[town] = 0;
    const coords = jitter(baseCoord, townCounters[town]++);
    return { ...biz, coords };
  });

  // Marinduque center
  const center: [number, number] = [13.38, 121.95];

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full">
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/50 flex items-center px-6 backdrop-blur-sm z-10 w-full">
        <h1 className="text-sm font-medium text-neutral-400">Workspace / Map View</h1>
        <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Hot Lead (7+)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Warm (4-6)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Low (0-3)</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        {loading || !mapReady ? (
          <div className="flex-1 flex items-center justify-center bg-neutral-950 text-neutral-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading map…
          </div>
        ) : (
          <div className="flex-1 relative">
            <MapContainer
              center={center}
              zoom={11}
              style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {plotted.map(biz => (
                <CircleMarker
                  key={biz.id}
                  center={biz.coords as [number, number]}
                  radius={biz.vulnerability_score >= 7 ? 8 : 6}
                  pathOptions={{
                    fillColor: getMarkerColor(biz.vulnerability_score || 0),
                    color: getMarkerColor(biz.vulnerability_score || 0),
                    fillOpacity: 0.7,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => setSelectedBiz(biz),
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong>{biz.name}</strong><br />
                      Score: {biz.vulnerability_score} · {biz.town || 'Unknown'}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* Side drawer */}
        {selectedBiz && (
          <div className="w-80 bg-neutral-900 border-l border-neutral-800 overflow-y-auto flex flex-col animate-in slide-in-from-right-4 duration-200">
            <div className="p-4 border-b border-neutral-800 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedBiz.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {bestCategory(selectedBiz.categories || [])}
                </p>
              </div>
              <button onClick={() => setSelectedBiz(null)} className="p-1 rounded hover:bg-neutral-800 text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Score */}
              <div className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                selectedBiz.vulnerability_score >= 7 ? 'bg-red-500/10 border-red-500/20' :
                selectedBiz.vulnerability_score >= 4 ? 'bg-amber-500/10 border-amber-500/20' :
                'bg-emerald-500/10 border-emerald-500/20'
              }`}>
                <span className="text-2xl font-black text-white">{selectedBiz.vulnerability_score || 0}</span>
                <span className="text-xs text-neutral-400">/10 Vulnerability</span>
              </div>

              {/* Pitch trigger */}
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs font-semibold text-amber-400">🎯 {derivePitchTrigger(selectedBiz)}</p>
              </div>

              {/* Details */}
              <div className="space-y-2 text-xs">
                {selectedBiz.town && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedBiz.town}</span>
                  </div>
                )}
                {selectedBiz.rating > 0 && (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{selectedBiz.rating} ({selectedBiz.reviews_count} reviews)</span>
                  </div>
                )}
              </div>

              {/* Social links */}
              {selectedBiz.social_links?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedBiz.social_links.map((link: string, i: number) => {
                    let hostname = link;
                    try { hostname = new URL(link).hostname.replace('www.', ''); } catch {}
                    return (
                      <a
                        key={i}
                        href={link.startsWith('http') ? link : `https://${link}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-emerald-400 transition-colors"
                      >
                        {hostname.includes('facebook') ? <Facebook className="w-3 h-3 text-blue-400" /> : <Globe className="w-3 h-3" />}
                        {hostname}
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Overview */}
              {selectedBiz.overview && (
                <p className="text-xs text-neutral-400 leading-relaxed border-l-2 border-emerald-500/50 pl-3">
                  {selectedBiz.overview}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
