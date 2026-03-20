"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Star, ExternalLink, Hash, ChevronRight, X, Trash2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';

export function IntelligenceDashboard() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    let result = businesses;
    
    if (selectedCategory !== 'All') {
      result = result.filter(b => b.categories?.includes(selectedCategory));
    }

    if (search.trim() !== '') {
      const lower = search.toLowerCase();
      result = result.filter(b => 
        (b.name && b.name.toLowerCase().includes(lower)) || 
        (b.overview && b.overview.toLowerCase().includes(lower)) ||
        (b.categories && b.categories.some((c: string) => c.toLowerCase().includes(lower)))
      );
    }
    
    setFiltered(result);
  }, [search, businesses, selectedCategory]);

  const uniqueCategories = Array.from(
    new Set(businesses.flatMap(b => b.categories || []))
  ).filter(Boolean).sort();

  const fetchBusinesses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('digital_maturity_score', { ascending: false });
    
    if (data) {
      setBusinesses(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  const fetchReports = async (category: string) => {
    setReportsLoading(true);
    // Sanitize category name to match backend generation format
    const cleanCat = category.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    const { data, error } = await supabase
      .from('intelligence_reports')
      .select('*')
      .eq('category', cleanCat)
      .order('created_at', { ascending: false });

    if (data) {
      // Deduplicate reports by type (keep newest)
      const uniqueReports = [];
      const types = new Set();
      for (const r of data) {
        if (!types.has(r.type)) {
          uniqueReports.push(r);
          types.add(r.type);
        }
      }
      setReports(uniqueReports);
    } else {
      setReports([]);
    }
    setReportsLoading(false);
  };

  const handleSelect = (business: any) => {
    setSelectedBusiness(business);
    if (business.categories && business.categories.length > 0) {
      fetchReports(business.categories[0]);
    } else {
      setReports([]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 5) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  const handleDeleteCard = async () => {
    if (!selectedBusiness) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedBusiness.name}?`)) return;

    const deletedId = selectedBusiness.id;
    // Optimistic UI update
    setBusinesses(prev => prev.filter(b => b.id !== deletedId));
    setSelectedBusiness(null);

    const { error } = await supabase.from('businesses').delete().eq('id', deletedId);
    if (error) {
      alert("Error deleting from database: " + error.message);
      fetchBusinesses(); // Restore UI on failure
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] w-full gap-6">
      {/* LEFT PANE: Searchable Cards Grid */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selectedBusiness ? 'w-1/3 border-r border-neutral-800 pr-6' : 'w-full'}`}>
        <div className="flex flex-col md:flex-row items-stretch gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input 
              placeholder="Search by business name, category..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-neutral-950 border-neutral-800 focus-visible:ring-emerald-500"
            />
          </div>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex h-10 w-full md:w-[180px] items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="All">All Categories</option>
            {uniqueCategories.map((c: any) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button variant="outline" className="border-neutral-800 bg-neutral-900 shrink-0" onClick={fetchBusinesses}>
            Refresh
          </Button>
        </div>

        <div className="overflow-y-auto pr-2 flex-col flex gap-4 pb-10">
          {loading ? (
            <div className="text-center text-neutral-500 py-10 animate-pulse">Loading profiles from database...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-neutral-500 py-10">No business profiles found matching your search.</div>
          ) : (
            <div className={`grid gap-4 ${selectedBusiness ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
              {filtered.map((biz) => (
                <Card 
                  key={biz.id} 
                  className={`bg-neutral-900 border-neutral-800 hover:border-emerald-500/50 transition-colors cursor-pointer ${selectedBusiness?.id === biz.id ? 'ring-1 ring-emerald-500' : ''}`}
                  onClick={() => handleSelect(biz)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-bold leading-tight line-clamp-2">{biz.name}</CardTitle>
                      <div className={`flex flex-col items-center justify-center rounded-md border px-2 py-1 ${getScoreColor(biz.digital_maturity_score)}`}>
                        <span className="text-xs font-bold leading-none">{biz.digital_maturity_score}</span>
                        <span className="text-[10px] uppercase opacity-70">Score</span>
                      </div>
                    </div>
                    <CardDescription className="text-xs flex items-center gap-1 mt-1 text-neutral-400">
                      <Hash className="w-3 h-3" />
                      {biz.categories?.[0] || 'Uncategorized'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-neutral-400 line-clamp-3 mb-3">{biz.overview}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      {biz.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span>{biz.rating} ({biz.reviews_count})</span>
                        </div>
                      )}
                      {biz.address && biz.address !== "Online/Unknown" && (
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{biz.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Detail View & Markdown Reports */}
      {selectedBusiness && (
        <div className="flex-1 flex flex-col bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden shadow-2xl relative animate-in slide-in-from-right-8 duration-300">
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-red-500/10 hover:text-red-500 text-neutral-500 transition-colors" 
              title="Delete Profile"
              onClick={handleDeleteCard}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-neutral-800 transition-colors" 
              title="Close Panel"
              onClick={() => setSelectedBusiness(null)}
            >
              <X className="w-4 h-4 text-neutral-400" />
            </Button>
          </div>

          <div className="p-6 border-b border-neutral-800 bg-neutral-950/50">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {selectedBusiness.name}
              <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${getScoreColor(selectedBusiness.digital_maturity_score)}`}>
                 Maturity: {selectedBusiness.digital_maturity_score}/10
              </div>
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-400">
              <span className="flex items-center gap-1"><Hash className="w-4 h-4"/> {selectedBusiness.categories?.join(', ')}</span>
              {selectedBusiness.address && <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {selectedBusiness.address}</span>}
              {selectedBusiness.rating > 0 && <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-500 fill-amber-500"/> {selectedBusiness.rating} ({selectedBusiness.reviews_count} reviews)</span>}
            </div>
            
            {selectedBusiness.social_links && selectedBusiness.social_links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedBusiness.social_links.map((link: string, i: number) => (
                  <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-emerald-400 transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    {new URL(link).hostname.replace('www.', '')}
                  </a>
                ))}
              </div>
            )}
            
            <p className="mt-4 text-sm text-neutral-300 leading-relaxed border-l-2 border-emerald-500 pl-3">
              {selectedBusiness.overview}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-neutral-950">
            {reportsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                 <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4"></div>
                 <p>Fetching AI Intelligence Reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20 text-neutral-500 border border-dashed border-neutral-800 rounded-lg">
                <p>No intelligence reports generated for the <b>{selectedBusiness.categories?.[0]}</b> category yet.</p>
                <p className="text-xs mt-2">Run the Analyst and Strategist agents to generate them.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 pb-20">
                {reports.map((report, idx) => (
                   <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                      <div className="bg-neutral-800/50 border-b border-neutral-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                         {report.type === 'analyst_gap_report' ? '📊 Category Analyst Report' : '🎯 Strategist Pitch Deck'}
                      </div>
                      <div className="p-6 prose prose-invert prose-emerald max-w-none">
                        <ReactMarkdown>{typeof report.content === 'string' ? report.content.replace(/\\n/g, '\n') : report.content}</ReactMarkdown>
                      </div>
                   </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
