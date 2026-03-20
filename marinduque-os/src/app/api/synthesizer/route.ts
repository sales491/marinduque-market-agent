import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export interface BusinessProfile {
    id: string;
    name: string;
    address?: string;
    rating?: number;
    reviews_count?: number;
    categories: string[];
    digital_maturity_score: number;
    source: string;
    raw_data_ref: string;
    social_links?: string[];
    session_id?: string;
}

const JUNK_DOMAINS = [
    'tripadvisor', 'yelp.com', 'foursquare.com', 'agoda.com',
    'booking.com', 'airbnb.com', 'hotels.com', 'expedia.com', 'restaurantguru.com'
];
const JUNK_PHRASES = ['top 10', 'top 5', 'best cafes in', 'best restaurants in', '15 best', '10 best'];

function isAggregator(title: string, links: string[]): boolean {
    const t = (title || '').toLowerCase();
    const l = (links || []).join(' ').toLowerCase();
    if (JUNK_DOMAINS.some(d => l.includes(d))) return true;
    if (JUNK_DOMAINS.some(d => t.includes(d))) return true;
    if (JUNK_PHRASES.some(p => t.includes(p))) return true;
    return false;
}

function scoreFromMapsItem(item: any): number {
    let score = 3;
    if (item.business_status === 'OPERATIONAL') score += 2;
    if (item.rating && item.rating > 4.0) score += 2;
    if (item.user_ratings_total && item.user_ratings_total > 50) score += 2;
    if (item.photos && item.photos.length > 0) score += 1;
    return score;
}

function profilesFromSerper(seoLinks: any[], sourceRef: string, baseScore = 5): BusinessProfile[] {
    const profiles: BusinessProfile[] = [];
    for (const seo of seoLinks) {
        const link = seo.link || '';
        const title = seo.title || 'Unknown Website';
        if (isAggregator(title, [link])) continue;
        let score = baseScore;
        if (link.includes('facebook.com') || link.includes('instagram.com') || link.includes('tiktok.com')) score += 2;
        if (seo.rating && seo.rating > 4.0) score += 1;
        profiles.push({
            id: Math.random().toString(36).substring(7),
            name: title,
            address: seo.snippet ? `Snippet: ${seo.snippet.slice(0, 80)}` : 'Online/Unknown',
            rating: seo.rating || 0,
            reviews_count: seo.ratingCount || 0,
            categories: ['Website'],
            digital_maturity_score: Math.min(score, 10),
            source: 'Serper SEO',
            social_links: [link],
            raw_data_ref: sourceRef
        });
    }
    return profiles;
}

function processRawRecord(parsed: any, sourceRef: string): BusinessProfile[] {
    const profiles: BusinessProfile[] = [];

    // 1. Hybrid Discovery
    if (parsed.keyword && (parsed.serper_seo_results || parsed.maps_results || parsed.google_maps_results)) {
        const hybridPlaces: any[] = parsed.maps_results || parsed.google_maps_results || [];
        const seoLinks: any[] = parsed.serper_seo_results?.organic || [];

        for (const item of hybridPlaces) {
            const score = scoreFromMapsItem(item);
            const matchingLinks = seoLinks.filter((seo: any) =>
                (seo.title && seo.title.toLowerCase().includes((item.name || '').toLowerCase())) ||
                (seo.snippet && seo.snippet.toLowerCase().includes((item.name || '').toLowerCase()))
            );
            const social_links: string[] = matchingLinks.map((l: any) => l.link).filter(Boolean);
            const bonusScore = matchingLinks.length > 0 ? 2 : 0;
            if (isAggregator(item.name || '', social_links)) continue;
            profiles.push({
                id: item.place_id || Math.random().toString(36).substring(7),
                name: item.name || 'Unknown Name',
                address: item.formatted_address || 'No Address Provided',
                rating: item.rating || 0,
                reviews_count: item.user_ratings_total || 0,
                categories: item.types || [],
                digital_maturity_score: Math.min(score + bonusScore, 10),
                source: 'Hybrid Sweep',
                social_links,
                raw_data_ref: sourceRef
            });
        }

        // Fallback: if Maps returned nothing, use Serper organic results
        if (profiles.length === 0 && seoLinks.length > 0) {
            profiles.push(...profilesFromSerper(seoLinks, sourceRef, 6));
        }

        return profiles;
    }

    // 2. Targeted Verification
    if (parsed.targeted_verification_results && parsed.original_keyword) {
        const seoLinks: any[] = parsed.targeted_verification_results.organic || [];
        const links = seoLinks.map((seo: any) => seo.link);
        if (!isAggregator(parsed.original_keyword, links) && seoLinks.length > 0) {
            const cleanName = parsed.original_keyword.replace(/ boac| marinduque/ig, '').trim();
            profiles.push({
                id: Math.random().toString(36).substring(7),
                name: cleanName,
                address: 'Verified via Targeted Search',
                rating: seoLinks[0]?.rating || 0,
                reviews_count: seoLinks[0]?.ratingCount || 0,
                categories: ['Verified Target'],
                digital_maturity_score: Math.min(seoLinks.length + 4, 10),
                source: 'Targeted Verification Serper',
                social_links: links.filter(Boolean),
                raw_data_ref: sourceRef
            });
        }
        return profiles;
    }

    // 3. Standalone Serper Search
    if (parsed.searchParameters && parsed.organic) {
        profiles.push(...profilesFromSerper(parsed.organic, sourceRef, 5));
        return profiles;
    }

    // 4. Raw array (Google Maps or Apify)
    const dataArray = Array.isArray(parsed) ? parsed : (parsed.results || [parsed]);
    for (const item of dataArray) {
        if (item.place_id || item.geometry) {
            profiles.push({
                id: item.place_id || Math.random().toString(36).substring(7),
                name: item.name || 'Unknown Name',
                address: item.formatted_address || 'No Address Provided',
                rating: item.rating || 0,
                reviews_count: item.user_ratings_total || 0,
                categories: item.types || [],
                digital_maturity_score: Math.min(scoreFromMapsItem(item), 10),
                source: 'Google Maps',
                social_links: [],
                raw_data_ref: sourceRef
            });
        } else if (item.url && item.url.includes('facebook')) {
            profiles.push({
                id: item.id || Math.random().toString(36).substring(7),
                name: item.title || item.name || 'Facebook Page',
                address: item.address || 'Online/No Address',
                rating: item.rating || 0,
                reviews_count: item.reviews || 0,
                categories: item.categories || ['Facebook Page'],
                digital_maturity_score: (item.likes && item.likes > 1000) ? 8 : 4,
                source: 'Apify Facebook',
                social_links: [item.url],
                raw_data_ref: sourceRef
            });
        }
    }

    return profiles;
}


export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { session_id } = body;

        const profiles: BusinessProfile[] = [];

        // ── PRIMARY: Read from Supabase (Vercel-safe) ──────────────────────────
        let query = supabase
            .from('raw_harvest_results')
            .select('*')
            .order('created_at', { ascending: false });

        if (session_id) {
            query = query.eq('session_id', session_id);
        } else {
            // Default: grab the most recent session's data
            const { data: latestRow } = await supabase
                .from('raw_harvest_results')
                .select('session_id')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestRow?.session_id) {
                query = query.eq('session_id', latestRow.session_id);
            }
        }

        const { data: supabaseRows, error: sbError } = await query;

        if (!sbError && supabaseRows && supabaseRows.length > 0) {
            for (const row of supabaseRows) {
                const parsed = row.data;
                const extracted = processRawRecord(parsed, row.id);
                profiles.push(...extracted.map(p => ({ ...p, session_id: row.session_id })));
            }
        } else {
            // ── FALLBACK: Read local disk files (local dev only) ────────────────
            const rawDataDir = path.join(process.cwd(), 'data', 'raw');
            if (!fs.existsSync(rawDataDir)) {
                return NextResponse.json({ error: "No raw data found in Supabase or local disk. Run Harvester first." }, { status: 400 });
            }
            const files = fs.readdirSync(rawDataDir).filter(f => f.endsWith('.json'));
            if (files.length === 0) {
                return NextResponse.json({ error: "No raw data files found. Run Harvester first." }, { status: 400 });
            }
            for (const file of files) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(path.join(rawDataDir, file), 'utf-8'));
                    profiles.push(...processRawRecord(parsed, file));
                } catch (_) { continue; }
            }
        }

        if (profiles.length === 0) {
            return NextResponse.json({ error: "No processable data found. Run Harvester first." }, { status: 400 });
        }

        // Deduplicate by fuzzy name matching
        const uniqueProfilesMap = new Map<string, BusinessProfile>();
        const normalizeName = (name: string) =>
            name.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/(cafe|restaurant|resort|hotel|inn|shop|store)$/, '');

        profiles.forEach(p => {
            const key = normalizeName(p.name);
            if (!uniqueProfilesMap.has(key)) {
                uniqueProfilesMap.set(key, p);
            } else {
                const existing = uniqueProfilesMap.get(key)!;
                if (p.social_links && p.social_links.length > 0) {
                    existing.social_links = Array.from(new Set([...(existing.social_links || []), ...p.social_links]));
                    existing.digital_maturity_score = Math.min(existing.digital_maturity_score + 2, 10);
                }
            }
        });

        const finalProfiles = Array.from(uniqueProfilesMap.values());
        const activeSessionId = finalProfiles[0]?.session_id || session_id;

        // Upsert to Supabase businesses table
        const { error: dbError } = await supabase
            .from('businesses')
            .upsert(finalProfiles.map((p: any) => ({
                id: p.id,
                name: p.name,
                address: p.address,
                rating: p.rating,
                reviews_count: p.reviews_count,
                categories: p.categories,
                digital_maturity_score: p.digital_maturity_score,
                source: p.source,
                social_links: p.social_links,
                raw_data_ref: p.raw_data_ref,
                session_id: activeSessionId,
                overview: `${p.name} is a ${p.categories?.[0] || 'business'} located at ${p.address || 'an unknown address'}. It was discovered via ${p.source}.`
            })), { onConflict: 'id' });

        if (dbError) console.error("Supabase upsert error:", dbError);

        // Save master file locally (bonus for local dev)
        try {
            const synthDataDir = path.join(process.cwd(), 'data', 'synthesized');
            if (!fs.existsSync(synthDataDir)) fs.mkdirSync(synthDataDir, { recursive: true });
            fs.writeFileSync(path.join(synthDataDir, 'master_profiles.json'), JSON.stringify(finalProfiles, null, 2));
        } catch (_) { /* Silently ignore on Vercel */ }

        return NextResponse.json({
            success: true,
            session_id: activeSessionId,
            profiles: finalProfiles,
            message: `Successfully synthesized ${finalProfiles.length} profiles from session ${activeSessionId}. Synced with Supabase.`
        });

    } catch (error: any) {
        console.error("Synthesizer API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process data" }, { status: 500 });
    }
}
