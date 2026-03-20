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
                supabaseInsert('pipeline_runs', { session_id: sessionId, keyword, status: 'harvesting' }),
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

            const targetedQuery = `${keyword} (site:facebook.com OR site:instagram.com OR site:tiktok.com OR site:tripadvisor.com.ph)`;
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

        // Facebook types require Apify SDK (Node.js only) — not usable in Edge Runtime
        if (type === 'facebook-pages' || type === 'facebook-groups') {
            return Response.json({ error: 'Facebook scraping requires Node.js runtime and is not available in Edge mode. Use locally.' }, { status: 400 });
        }

        return Response.json({ error: 'Invalid harvester type' }, { status: 400 });

    } catch (error: any) {
        console.error('Harvester API Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
