import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { extractTown } from '@/lib/categories';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BusinessProfile {
    id: string;
    name: string;
    address?: string;
    town?: string;
    rating?: number;
    reviews_count?: number;
    categories: string[];
    vulnerability_score: number;
    source: string;
    raw_data_ref: string;
    social_links?: string[];
    session_id?: string;
    last_fb_post?: string | null;
    has_website?: boolean;
    fb_likes?: number | null;
}

// ── Junk Filtering ───────────────────────────────────────────────────────────

const JUNK_DOMAINS = [
    'tripadvisor', 'yelp.com', 'foursquare.com',
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

// ── Deterministic ID Generation ──────────────────────────────────────────────

/** Generate a deterministic ID based on the source and a unique identifier.
 *  - Google Maps: use `place_id` directly.
 *  - Facebook / Apify: prefix with `fb_` + clean page ID or URL hash.
 *  - SEO / Serper: prefix with `seo_` + simple hash of the link URL.
 *  - Fallback: prefix with `gen_` + hash of name + address.
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

function deterministicId(item: any, source: 'maps' | 'facebook' | 'serper' | 'targeted'): string {
    if (source === 'maps') {
        return item.place_id || `maps_${simpleHash((item.name || '') + (item.formatted_address || ''))}`;
    }
    if (source === 'facebook') {
        // Apify Facebook pages often have a numeric `id` or a URL
        if (item.id && typeof item.id === 'string' && item.id.length > 4) return `fb_${item.id}`;
        if (item.url) return `fb_${simpleHash(item.url)}`;
        return `fb_${simpleHash((item.title || item.name || '') + (item.address || ''))}`;
    }
    if (source === 'serper') {
        const link = item.link || item.url || '';
        if (link) return `seo_${simpleHash(link)}`;
        return `seo_${simpleHash(item.title || Math.random().toString())}`;
    }
    if (source === 'targeted') {
        // For targeted verification, anchor on the keyword + first social link
        const keyword = item.keyword || item.name || '';
        const firstLink = (item.links || [])[0] || '';
        return `tv_${simpleHash(keyword + firstLink)}`;
    }
    return `gen_${simpleHash(JSON.stringify(item).slice(0, 200))}`;
}

// ── Vulnerability Scoring ────────────────────────────────────────────────────
// Scores businesses on how much they NEED a digital marketing agency.
// High score = high capacity + poor digital execution = hot lead.

function vulnerabilityScore(item: any, socialLinks: string[], fbData?: any): number {
    let score = 0;

    // CAPACITY signals (they have cash flow / foot traffic)
    if (item.place_id || item.business_status === 'OPERATIONAL') score += 1;
    if (item.user_ratings_total && item.user_ratings_total > 50) score += 1;
    if (item.rating && item.rating >= 4.0) score += 1;

    // VULNERABILITY signals (they need your agency)
    const hasWebsite = socialLinks.some(l => {
        const lower = l.toLowerCase();
        return lower.startsWith('http') &&
            !lower.includes('facebook.com') &&
            !lower.includes('instagram.com') &&
            !lower.includes('tiktok.com') &&
            !lower.includes('shopee.ph') &&
            !lower.includes('lazada.com');
    });
    if (!hasWebsite) score += 2; // No website = easy sell

    const hasFacebook = socialLinks.some(l => l.toLowerCase().includes('facebook.com'));
    if (!hasFacebook) {
        score += 2; // No Facebook at all = very vulnerable
    } else if (fbData) {
        // Has FB but check activity
        if (fbData.likes && fbData.likes < 500) score += 1; // Low engagement
        if (fbData.lastPostDate) {
            const lastPost = new Date(fbData.lastPostDate);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (lastPost < sixMonthsAgo) score += 2; // Inactive FB = very vulnerable
        }
    }

    // Unclaimed Google Business Profile indicator
    if (item.business_status === 'OPERATIONAL' && (!item.photos || item.photos.length === 0)) {
        score += 1; // Likely unclaimed — no photos uploaded
    }

    return Math.min(score, 10);
}

// Score for standalone SEO/social profiles (less data available)
function vulnerabilityScoreFromSeo(seo: any, link: string): number {
    let score = 3; // Base — we know they exist online
    const lower = link.toLowerCase();

    // If the only presence is a social page, they likely lack a website
    if (lower.includes('facebook.com') || lower.includes('instagram.com') || lower.includes('tiktok.com')) {
        score += 2; // Social-only, no proper web presence
    }

    if (seo.rating && seo.rating > 4.0) score += 1; // They have customers
    return Math.min(score, 10);
}

// ── Profile Extraction ───────────────────────────────────────────────────────

function profilesFromSerper(seoLinks: any[], sourceRef: string, baseScore = 5): BusinessProfile[] {
    const profiles: BusinessProfile[] = [];
    for (const seo of seoLinks) {
        const link = seo.link || '';
        const title = seo.title || 'Unknown Website';
        if (isAggregator(title, [link])) continue;
        const score = vulnerabilityScoreFromSeo(seo, link);
        const address = seo.snippet ? `Snippet: ${seo.snippet.slice(0, 80)}` : 'Online/Unknown';
        profiles.push({
            id: deterministicId(seo, 'serper'),
            name: title,
            address,
            town: extractTown(address),
            rating: seo.rating || 0,
            reviews_count: seo.ratingCount || 0,
            categories: ['Website'],
            vulnerability_score: Math.min(score, 10),
            source: 'Serper SEO',
            social_links: [link],
            has_website: !link.includes('facebook.com') && !link.includes('instagram.com'),
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
            const matchingLinks = seoLinks.filter((seo: any) =>
                (seo.title && seo.title.toLowerCase().includes((item.name || '').toLowerCase())) ||
                (seo.snippet && seo.snippet.toLowerCase().includes((item.name || '').toLowerCase()))
            );
            const social_links: string[] = matchingLinks.map((l: any) => l.link).filter(Boolean);
            if (isAggregator(item.name || '', social_links)) continue;
            const score = vulnerabilityScore(item, social_links);
            const address = item.formatted_address || 'No Address Provided';
            profiles.push({
                id: deterministicId(item, 'maps'),
                name: item.name || 'Unknown Name',
                address,
                town: extractTown(address),
                rating: item.rating || 0,
                reviews_count: item.user_ratings_total || 0,
                categories: item.types || [],
                vulnerability_score: score,
                source: 'Hybrid Sweep',
                social_links,
                has_website: social_links.some(l => !l.includes('facebook.com') && !l.includes('instagram.com')),
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
            const score = vulnerabilityScoreFromSeo(seoLinks[0], links[0] || '');
            profiles.push({
                id: deterministicId({ keyword: cleanName, links }, 'targeted'),
                name: cleanName,
                address: 'Verified via Targeted Search',
                town: 'Unknown',
                rating: seoLinks[0]?.rating || 0,
                reviews_count: seoLinks[0]?.ratingCount || 0,
                categories: ['Verified Target'],
                vulnerability_score: score,
                source: 'Targeted Verification Serper',
                social_links: links.filter(Boolean),
                has_website: links.some((l: string) => l && !l.includes('facebook.com') && !l.includes('instagram.com')),
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
            const address = item.formatted_address || 'No Address Provided';
            const score = vulnerabilityScore(item, []);
            profiles.push({
                id: deterministicId(item, 'maps'),
                name: item.name || 'Unknown Name',
                address,
                town: extractTown(address),
                rating: item.rating || 0,
                reviews_count: item.user_ratings_total || 0,
                categories: item.types || [],
                vulnerability_score: score,
                source: 'Google Maps',
                social_links: [],
                has_website: false,
                raw_data_ref: sourceRef
            });
        } else if (item.url && item.url.includes('facebook')) {
            const address = item.address || 'Online/No Address';
            const fbLikes = item.likes || 0;
            const lastPost = item.latestPosts?.[0]?.time || item.lastPostDate || null;
            const score = vulnerabilityScore(
                { business_status: 'OPERATIONAL' },
                [item.url],
                { likes: fbLikes, lastPostDate: lastPost }
            );
            profiles.push({
                id: deterministicId(item, 'facebook'),
                name: item.title || item.name || 'Facebook Page',
                address,
                town: extractTown(address),
                rating: item.rating || 0,
                reviews_count: item.reviews || 0,
                categories: item.categories || ['Facebook Page'],
                vulnerability_score: score,
                source: 'Apify Facebook',
                social_links: [item.url],
                fb_likes: fbLikes,
                last_fb_post: lastPost,
                has_website: false,
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

        // ── Deduplicate by deterministic ID ──────────────────────────────────
        // Since IDs are now anchored to place_id / fb page / URL hash,
        // duplicates naturally collapse. Merge social links on collision.
        const uniqueProfilesMap = new Map<string, BusinessProfile>();

        profiles.forEach(p => {
            const key = p.id;
            if (!uniqueProfilesMap.has(key)) {
                uniqueProfilesMap.set(key, p);
            } else {
                const existing = uniqueProfilesMap.get(key)!;
                // Merge social links
                if (p.social_links && p.social_links.length > 0) {
                    existing.social_links = Array.from(new Set([...(existing.social_links || []), ...p.social_links]));
                }
                // Keep the higher vulnerability score
                existing.vulnerability_score = Math.max(existing.vulnerability_score, p.vulnerability_score);
                // Prefer real addresses over placeholders
                if (existing.address === 'Online/Unknown' && p.address && p.address !== 'Online/Unknown') {
                    existing.address = p.address;
                    existing.town = p.town;
                }
                // Merge FB metadata
                if (p.fb_likes && (!existing.fb_likes || p.fb_likes > existing.fb_likes)) {
                    existing.fb_likes = p.fb_likes;
                }
                if (p.last_fb_post && !existing.last_fb_post) {
                    existing.last_fb_post = p.last_fb_post;
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
                town: p.town || extractTown(p.address || ''),
                rating: p.rating,
                reviews_count: p.reviews_count,
                categories: p.categories,
                vulnerability_score: p.vulnerability_score,
                source: p.source,
                social_links: p.social_links,
                raw_data_ref: p.raw_data_ref,
                session_id: activeSessionId,
                has_website: p.has_website || false,
                fb_likes: p.fb_likes || null,
                last_fb_post: p.last_fb_post || null,
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
