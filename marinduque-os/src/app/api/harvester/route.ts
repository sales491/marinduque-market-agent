// Edge Runtime: 30s timeout on Vercel Hobby (vs 10s for Node.js serverless)
export const runtime = 'edge';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/run-pipeline`;

// Lightweight Supabase insert via REST (no SDK - Edge compatible)
async function supabaseInsert(table: string, row: object) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
    });
    if (!res.ok) {
        const err = await res.text();
        console.error(`[Harvester:supabaseInsert:${table}]`, err);
    }
}

async function triggerPipeline(sessionId: string, keyword: string) {
    try {
        await fetch(SUPABASE_EDGE_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, keyword }),
        });
    } catch (e: any) {
        console.error('[Harvester] Failed to trigger pipeline:', e.message);
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
                return Response.json({ error: 'Missing SERPER_API_KEY or GOOGLE_MAPS_API_KEY.' }, { status: 400 });
            }

            // Run Serper + Google Maps in parallel
            const serperPromise = fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: keyword, gl: 'ph', num: 40 }),
            }).then(r => r.json());

            const mapsPromise = (async () => {
                let allResults: any[] = [];
                let nextPageToken = '';
                let pagesFetched = 0;
                const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
                do {
                    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&key=${googleKey}`;
                    if (nextPageToken) url += `&pagetoken=${nextPageToken}`;
                    const r = await fetch(url);
                    const data = await r.json();
                    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                        if (data.status === 'INVALID_REQUEST' && nextPageToken) { await delay(2000); continue; }
                        throw new Error(data.error_message || `Google API Error: ${data.status}`);
                    }
                    if (data.results) allResults = [...allResults, ...data.results];
                    nextPageToken = data.next_page_token || '';
                    pagesFetched++;
                    if (nextPageToken && pagesFetched < 3) await delay(2500);
                    else break;
                } while (nextPageToken && pagesFetched < 3);
                return allResults;
            })();

            const [serperData, mapsData] = await Promise.all([serperPromise, mapsPromise]);

            const combinedData = {
                keyword,
                timestamp: new Date().toISOString(),
                serper_seo_results: serperData,
                google_maps_results: mapsData,
            };

            // Save raw data + create pipeline_run row in parallel
            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type: 'hybrid-discovery', data: combinedData }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting', source: body.source || 'Quick Harvest' }),
            ]);

            // Await the trigger: Vercel Edge Runtime kills in-flight fetches on response return.
            // triggerPipeline itself returns immediately (Edge Function uses waitUntil internally).
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, source: 'Hybrid Sweep (Parallel)', itemCount: mapsData.length });
        }

        if (type === 'serper-search') {
            const serperKey = process.env.SERPER_API_KEY;
            if (!serperKey) return Response.json({ error: 'Missing SERPER_API_KEY.' }, { status: 400 });

            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: keyword, gl: 'ph', num: 40 }),
            });
            const data = await res.json();

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type: 'serper-search', data }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting' }),
            ]);
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, data, source: 'Serper.dev Search' });
        }

        if (type === 'google-maps') {
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!googleKey) return Response.json({ error: 'Missing GOOGLE_MAPS_API_KEY.' }, { status: 400 });

            let allResults: any[] = [];
            let nextPageToken = '';
            let pagesFetched = 0;
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
            do {
                let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&key=${googleKey}`;
                if (nextPageToken) url += `&pagetoken=${nextPageToken}`;
                const r = await fetch(url);
                const data = await r.json();
                if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                    if (data.status === 'INVALID_REQUEST' && nextPageToken) { await delay(2000); continue; }
                    return Response.json({ error: data.error_message || `Google API Error: ${data.status}` }, { status: 400 });
                }
                if (data.results) allResults = [...allResults, ...data.results];
                nextPageToken = data.next_page_token || '';
                pagesFetched++;
                if (nextPageToken && pagesFetched < 3) await delay(2500);
                else break;
            } while (nextPageToken && pagesFetched < 3);

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type: 'google-maps', data: allResults }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting' }),
            ]);
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, data: allResults, source: 'Official Google API' });
        }

        if (type === 'targeted-verification') {
            const serperKey = process.env.SERPER_API_KEY;
            if (!serperKey) return Response.json({ error: 'Missing SERPER_API_KEY.' }, { status: 400 });

            const targetedQuery = `${keyword} (site:facebook.com OR site:instagram.com OR site:tiktok.com OR site:tripadvisor.com.ph OR site:looloo.com OR site:agoda.com OR site:shopee.ph OR site:lazada.com.ph)`;
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: targetedQuery, gl: 'ph', num: 10 }),
            });
            const data = await res.json();
            const tvData = { targeted_verification_results: data, original_keyword: keyword };

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type: 'targeted-verification', data: tvData }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting' }),
            ]);
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, data, source: 'Targeted Verification Search' });
        }

        // Facebook scraping via Apify REST API (Edge-compatible — no Node.js SDK needed)
        if (type === 'facebook-pages' || type === 'facebook-groups') {
            const apifyToken = process.env.APIFY_API_TOKEN;
            if (!apifyToken) {
                return Response.json({ error: 'Missing APIFY_API_TOKEN. Add it to Vercel environment variables.' }, { status: 400 });
            }

            // Use Apify's synchronous run endpoint — runs actor and returns dataset items in one call.
            // 20s server-side timeout fits within the 30s Vercel Edge limit.
            const actor = type === 'facebook-groups'
                ? 'apify~facebook-groups-scraper'
                : 'apify~facebook-pages-scraper';

            // ── Pre-warm: fire a tiny dummy run to boot the container ──────────
            // Cold starts take 20-40s. This 8s ping warms the container so the real
            // run below starts instantly. Cost: ~0.0006 CU ($0.00018). Result ignored.
            try {
                await fetch(
                    `https://api.apify.com/v2/acts/${actor}/runs?token=${apifyToken}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            startUrls: [{ url: 'https://www.facebook.com/apify' }],
                            maxPosts: 0,
                            maxPostComments: 0,
                            maxReviews: 0,
                            memoryMbytes: 1024,
                            maxRunTimeSecs: 8,
                        }),
                        signal: AbortSignal.timeout(9000),
                    }
                );
            } catch {
                // Ignore — warm-up is best-effort
            }
            // Wait a moment for container to finish booting
            await new Promise(r => setTimeout(r, 2000));
            // ────────────────────────────────────────────────────────────────────

            let apifyData: any[] = [];
            try {
                const apifyRes = await fetch(
                    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apifyToken}&timeout=25&format=json&clean=true`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            startUrls: [{ url: keyword }],
                            maxPosts: 3,
                            maxPostComments: 0,
                            maxReviews: 0,
                            memoryMbytes: 1024,
                        }),
                        signal: AbortSignal.timeout(28000), // 28s client-side — warm runs finish in 10-15s
                    }
                );

                if (apifyRes.ok) {
                    apifyData = await apifyRes.json();
                } else {
                    const errText = await apifyRes.text();
                    const isTimeout = errText.includes('TIMED-OUT');
                    if (isTimeout) {
                        console.warn('[Harvester:Apify] Run timed out even after warm-up — returning empty data.');
                        apifyData = [];
                    } else {
                        console.error(`[Harvester:Apify] ${apifyRes.status}:`, errText);
                        return Response.json({ error: `Apify error ${apifyRes.status}: ${errText.slice(0, 200)}` }, { status: 400 });
                    }
                }
            } catch (apifyErr: any) {
                console.error('[Harvester:Apify] fetch error:', apifyErr.message);
                return Response.json({ error: `Apify request failed: ${apifyErr.message}` }, { status: 400 });
            }

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type, data: apifyData }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting' }),
            ]);
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, data: apifyData, source: 'Apify Facebook Scraper' });
        }

        // ── Grid-Based nearbysearch Sweep ────────────────────────────────────
        if (type === 'grid-discovery') {
            const googleKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!googleKey) return Response.json({ error: 'Missing GOOGLE_MAPS_API_KEY.' }, { status: 400 });

            // Inline grid points (Edge Runtime cannot import node modules)
            const GRID = [
                { lat: 13.4450, lng: 121.8430 }, { lat: 13.4600, lng: 121.8500 },
                { lat: 13.4300, lng: 121.8350 }, { lat: 13.4500, lng: 121.8650 },
                { lat: 13.4150, lng: 121.8450 }, { lat: 13.4800, lng: 121.8600 },
                { lat: 13.4950, lng: 121.8700 }, { lat: 13.4700, lng: 121.8800 },
                { lat: 13.4850, lng: 121.8450 }, { lat: 13.4800, lng: 121.9200 },
                { lat: 13.4950, lng: 121.9400 }, { lat: 13.4650, lng: 121.9100 },
                { lat: 13.4800, lng: 121.9500 }, { lat: 13.4700, lng: 121.9600 },
                { lat: 13.4050, lng: 122.0800 }, { lat: 13.4200, lng: 122.0700 },
                { lat: 13.3900, lng: 122.0850 }, { lat: 13.4100, lng: 122.0550 },
                { lat: 13.4200, lng: 122.0950 }, { lat: 13.2600, lng: 121.9500 },
                { lat: 13.2750, lng: 121.9600 }, { lat: 13.2450, lng: 121.9400 },
                { lat: 13.2600, lng: 121.9750 }, { lat: 13.2700, lng: 121.9300 },
                { lat: 13.3200, lng: 121.8500 }, { lat: 13.3350, lng: 121.8600 },
                { lat: 13.3050, lng: 121.8400 }, { lat: 13.3200, lng: 121.8700 },
            ];

            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
            const allResults: any[] = [];
            const seenPlaceIds = new Set<string>();
            const placeType = body.placeType || 'establishment';

            // Sweep each grid point
            for (const point of GRID) {
                let nextPageToken = '';
                let pagesFetched = 0;
                do {
                    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${point.lat},${point.lng}&radius=2000&type=${placeType}&key=${googleKey}`;
                    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
                    if (nextPageToken) url += `&pagetoken=${nextPageToken}`;

                    const r = await fetch(url);
                    const data = await r.json();
                    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                        if (data.status === 'INVALID_REQUEST' && nextPageToken) { await delay(2000); continue; }
                        break; // Skip this point on error
                    }
                    for (const item of (data.results || [])) {
                        if (item.place_id && !seenPlaceIds.has(item.place_id)) {
                            seenPlaceIds.add(item.place_id);
                            allResults.push(item);
                        }
                    }
                    nextPageToken = data.next_page_token || '';
                    pagesFetched++;
                    if (nextPageToken && pagesFetched < 3) await delay(2500);
                    else break;
                } while (nextPageToken && pagesFetched < 3);
            }

            const combinedData = {
                keyword: keyword || `Grid Sweep (${placeType})`,
                timestamp: new Date().toISOString(),
                google_maps_results: allResults,
                serper_seo_results: { organic: [] }, // No SEO for grid sweeps
            };

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword: keyword || `Grid: ${placeType}`, type: 'grid-discovery', data: combinedData }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword: keyword || `Grid: ${placeType}`, status: 'harvesting', source: 'Grid Sweep' }),
            ]);
            await triggerPipeline(sessionId, keyword || `Grid: ${placeType}`);

            return Response.json({ success: true, session_id: sessionId, source: 'Grid Sweep (nearbysearch)', itemCount: allResults.length, gridPointsUsed: GRID.length });
        }

        // ── Native Facebook Search via Apify ─────────────────────────────────
        if (type === 'facebook-search') {
            const apifyToken = process.env.APIFY_API_TOKEN;
            if (!apifyToken) return Response.json({ error: 'Missing APIFY_API_TOKEN.' }, { status: 400 });

            let apifyData: any[] = [];
            try {
                const apifyRes = await fetch(
                    `https://api.apify.com/v2/acts/apify~facebook-pages-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=25&format=json&clean=true`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            searchQueries: [keyword],
                            maxPosts: 1,
                            maxPostComments: 0,
                            maxReviews: 0,
                            memoryMbytes: 1024,
                        }),
                        signal: AbortSignal.timeout(28000),
                    }
                );
                if (apifyRes.ok) {
                    apifyData = await apifyRes.json();
                } else {
                    const errText = await apifyRes.text();
                    console.warn('[Harvester:FB-Search]', errText.slice(0, 200));
                    apifyData = [];
                }
            } catch (err: any) {
                console.warn('[Harvester:FB-Search] Error:', err.message);
                apifyData = [];
            }

            await Promise.all([
                supabaseInsert('raw_harvest_results', { session_id: sessionId, keyword, type: 'facebook-search', data: apifyData }),
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting', source: 'Facebook Search' }),
            ]);
            await triggerPipeline(sessionId, keyword);

            return Response.json({ success: true, session_id: sessionId, data: apifyData, source: 'Native Facebook Search (Apify)' });
        }

        return Response.json({ error: 'Invalid harvester type' }, { status: 400 });

    } catch (error: any) {
        console.error('Harvester API Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
