import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

// Helper: persist raw harvest data to Supabase (Vercel-safe) and optionally to local disk
async function persistRawData(sessionId: string, keyword: string, type: string, data: any, localPath?: string) {
    // 1. Always write to Supabase
    const { error } = await supabase.from('raw_harvest_results').insert({
        session_id: sessionId,
        keyword,
        type,
        data,
    });
    if (error) console.error('[Harvester] Supabase insert error:', error);

    // 2. Write to local disk as a bonus (will silently fail on Vercel read-only fs)
    if (localPath) {
        try {
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
        } catch (_) { /* Silently ignore on Vercel */ }
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { keyword, type, session_id } = body;
        const sessionId: string = session_id || crypto.randomUUID();

        if (type === 'hybrid-discovery') {
            const serperKey = process.env.SERPER_API_KEY;
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;

            if (!serperKey || !googleKey) {
                return NextResponse.json({ error: "Missing SERPER_API_KEY or GOOGLE_MAPS_API_KEY." }, { status: 400 });
            }

            // 1. Start Serper Search Promise
            const serperPromise = fetch("https://google.serper.dev/search", {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: keyword, gl: "ph", num: 40 })
            }).then(async res => {
                if (!res.ok) {
                    const errText = await res.text();
                    console.error("Serper API Error Context:", { status: res.status, errText, keyword });
                    throw new Error(`Serper API Error: ${res.statusText} - ${errText}`);
                }
                return res.json();
            });

            // 2. Start Google Maps Promise (with pagination)
             const mapsPromise = (async () => {
                let allResults: any[] = [];
                let nextPageToken = "";
                let pagesFetched = 0;
                const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

                do {
                    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&key=${googleKey}`;
                    if (nextPageToken) searchUrl += `&pagetoken=${nextPageToken}`;
                    
                    const response = await fetch(searchUrl);
                    const data = await response.json();
                    
                    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
                        if (data.status === "INVALID_REQUEST" && nextPageToken) {
                            await delay(2000); continue; 
                        }
                        throw new Error(data.error_message || `Google API Error: ${data.status}`);
                    }
                    if (data.results) allResults = [...allResults, ...data.results];
                    nextPageToken = data.next_page_token || "";
                    pagesFetched++;
                    if (nextPageToken && pagesFetched < 3) await delay(2500); 
                    else break;
                } while (nextPageToken && pagesFetched < 3);
                
                return allResults;
            })();

            // 3. Execute concurrently
            try {
                const [serperData, mapsData] = await Promise.all([serperPromise, mapsPromise]);

                const combinedData = {
                    keyword,
                    timestamp: new Date().toISOString(),
                    serper_seo_results: serperData,
                    google_maps_results: mapsData
                };

                const rawDataDir = path.join(process.cwd(), 'data', 'raw');
                const cleanKey = keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20).toLowerCase();
                const filePath = path.join(rawDataDir, `hybrid_sweep_${cleanKey}_${combinedData.timestamp.replace(/[:.]/g, '-')}.json`);
                await persistRawData(sessionId, keyword, 'hybrid-discovery', combinedData, filePath);

                return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: combinedData, source: "Hybrid Sweep (Parallel)" });
            } catch (err: any) {
                return NextResponse.json({ error: `Parallel Harvest Failed: ${err.message}` }, { status: 500 });
            }
        }

        if (type === 'serper-search') {
            const serperKey = process.env.SERPER_API_KEY;
            if (!serperKey) {
                return NextResponse.json({ error: "Missing SERPER_API_KEY in .env.local file." }, { status: 400 });
            }

            const searchUrl = "https://google.serper.dev/search";
            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: keyword,
                    gl: "ph",
                    num: 40 // Broad sweep covering ~4 pages of organic results
                })
            });

            if (!response.ok) {
                return NextResponse.json({ error: `Serper API Error: ${response.statusText}` }, { status: response.status });
            }

            const data = await response.json();

            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const cleanKey = keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20).toLowerCase();
            const filePath = path.join(rawDataDir, `serper_search_${cleanKey}_${timestamp}.json`);
            await persistRawData(sessionId, keyword, 'serper-search', data, filePath);

            return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: data, source: "Serper.dev Search" });
        }

        if (type === 'google-maps') {
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!googleKey) {
                return NextResponse.json({ error: "Missing GOOGLE_MAPS_API_KEY in .env.local file. Get a free API key from Google Cloud Console." }, { status: 400 });
            }

            let allResults: any[] = [];
            let nextPageToken = "";
            let pagesFetched = 0;
            const maxPages = 3; // Google allows up to 60 results max via pagination

            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

            do {
                let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&key=${googleKey}`;
                if (nextPageToken) {
                    searchUrl += `&pagetoken=${nextPageToken}`;
                }

                const response = await fetch(searchUrl);
                const data = await response.json();

                if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
                    if (data.status === "INVALID_REQUEST" && nextPageToken) {
                        // Google requires a small delay before the token is active
                        await delay(2000);
                        continue; 
                    }
                    return NextResponse.json({ error: data.error_message || `Google API Error: ${data.status}` }, { status: 400 });
                }

                if (data.results) {
                    allResults = [...allResults, ...data.results];
                }

                nextPageToken = data.next_page_token || "";
                pagesFetched++;

                if (nextPageToken && pagesFetched < maxPages) {
                    await delay(2500); // Wait for token to activate
                } else {
                    break;
                }
            } while (nextPageToken && pagesFetched < maxPages);

            // Save to Supabase + Local FS
            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(rawDataDir, `google_maps_${timestamp}.json`);
            await persistRawData(sessionId, keyword, 'google-maps', allResults, filePath);

            return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: allResults, source: "Official Google API" });
        }
        
        if (type === 'targeted-verification') {
            const serperKey = process.env.SERPER_API_KEY;
            if (!serperKey) {
                return NextResponse.json({ error: "Missing SERPER_API_KEY in .env.local file." }, { status: 400 });
            }

            const searchUrl = "https://google.serper.dev/search";
            // Force Serper to look for the business name specifically on social networks
            const targetedQuery = `${keyword} (site:facebook.com OR site:instagram.com OR site:tiktok.com OR site:tripadvisor.com.ph)`;

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: targetedQuery,
                    gl: "ph",
                    num: 10
                })
            });

            if (!response.ok) {
                return NextResponse.json({ error: `Serper API Error: ${response.statusText}` }, { status: response.status });
            }

            const data = await response.json();

            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const cleanKey = keyword.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20).toLowerCase();
            const filePath = path.join(rawDataDir, `targeted_verification_${cleanKey}_${timestamp}.json`);
            const tvData = { targeted_verification_results: data, original_keyword: keyword };
            await persistRawData(sessionId, keyword, 'targeted-verification', tvData, filePath);

            return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: data, source: "Targeted Verification Search" });
        }

        if (type === 'facebook-pages') {
            const token = process.env.APIFY_API_TOKEN;
            if (!token) {
                return NextResponse.json({ error: "Missing APIFY_API_TOKEN in .env.local file. Please generate one at apify.com and restart." }, { status: 400 });
            }
            
            const client = new ApifyClient({ token });
            const run = await client.actor("apify/facebook-pages-scraper").call({
                startUrls: [{ url: keyword }],
                maxPosts: 5,
            });
            
            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            // Save to Supabase + Local FS
            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(rawDataDir, `facebook_page_${timestamp}.json`);
            await persistRawData(sessionId, keyword, 'facebook-pages', items, filePath);

            return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: items, source: "Apify Facebook Scraper" });
        }

        if (type === 'facebook-groups') {
            const token = process.env.APIFY_API_TOKEN;
            if (!token) {
                return NextResponse.json({ error: "Missing APIFY_API_TOKEN in .env.local file. Please generate one at apify.com and restart." }, { status: 400 });
            }
            
            const client = new ApifyClient({ token });
            const run = await client.actor("apify/facebook-groups-scraper").call({
                startUrls: [{ url: keyword }],
                resultsLimit: 20, // Keep limit low to save Apify credits during tests
            });
            
            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            // Save to Supabase + Local FS
            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = path.join(rawDataDir, `facebook_group_${timestamp}.json`);
            await persistRawData(sessionId, keyword, 'facebook-groups', items, filePath);

            return NextResponse.json({ success: true, session_id: sessionId, savedTo: filePath, data: items, source: "Apify FB Groups Scraper" });
        }

        return NextResponse.json({ error: "Invalid harvester type" }, { status: 400 });

    } catch (error: any) {
        console.error("Harvester API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
