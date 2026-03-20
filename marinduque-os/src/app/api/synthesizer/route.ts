import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface BusinessProfile {
    id: string; // Place ID or FB ID
    name: string;
    address?: string;
    rating?: number;
    reviews_count?: number;
    categories: string[];
    digital_maturity_score: number; // 1-10 scale
    source: string; 
    raw_data_ref: string; // link to original JSON identifier
    social_links?: string[]; // Adding this for the SEO data
}

export async function POST(req: Request) {
    try {
        const rawDataDir = path.join(process.cwd(), 'data', 'raw');
        const synthDataDir = path.join(process.cwd(), 'data', 'synthesized');
        
        if (!fs.existsSync(rawDataDir)) {
            return NextResponse.json({ error: "No raw data folder found. Run Harvester first." }, { status: 400 });
        }
        if (!fs.existsSync(synthDataDir)) {
            fs.mkdirSync(synthDataDir, { recursive: true });
        }

        const files = fs.readdirSync(rawDataDir).filter(f => f.endsWith('.json'));
        if (files.length === 0) {
            return NextResponse.json({ error: "No raw data files found in the data/raw folder. Run Harvester first." }, { status: 400 });
        }

        const profiles: BusinessProfile[] = [];

        // Loop through all saved Harvest JSON files and process them
        for (const file of files) {
            const fileContent = fs.readFileSync(path.join(rawDataDir, file), 'utf-8');
            let parsed;
            try {
                parsed = JSON.parse(fileContent);
            } catch (e) {
                console.error(`Skipping invalid JSON file: ${file}`);
                continue;
            }

            // 1. Handle Hybrid Sweep
            if (parsed.keyword && (parsed.serper_seo_results || parsed.maps_results)) {
                let hybridPlaces = parsed.maps_results || [];
                let seoLinks = parsed.serper_seo_results?.organic || [];

                for (const item of hybridPlaces) {
                    let score = 3;
                    if (item.business_status === 'OPERATIONAL') score += 2;
                    if (item.rating && item.rating > 4.0) score += 2;
                    if (item.user_ratings_total && item.user_ratings_total > 50) score += 2;
                    if (item.photos && item.photos.length > 0) score += 1;

                    // Entity Resolution: Find matching SEO links based on name
                    const matchingLinks = seoLinks.filter((seo: any) => 
                        (seo.title && seo.title.toLowerCase().includes(item.name.toLowerCase())) || 
                        (seo.snippet && seo.snippet.toLowerCase().includes(item.name.toLowerCase()))
                    );
                    
                    let social_links: string[] = [];
                    if (matchingLinks.length > 0) {
                        score += 2; // Bonus for having online presence/SEO ranking
                        social_links = matchingLinks.map((link: any) => link.link);
                    }

                    profiles.push({
                        id: item.place_id || Math.random().toString(36).substring(7),
                        name: item.name || "Unknown Name",
                        address: item.formatted_address || "No Address Provided",
                        rating: item.rating || 0,
                        reviews_count: item.user_ratings_total || 0,
                        categories: item.types || [],
                        digital_maturity_score: Math.min(score, 10), // Cap at 10
                        source: 'Hybrid Sweep',
                        social_links: social_links,
                        raw_data_ref: file
                    });
                }
            } 
            // 2. Handle standalone Serper Search
            else if (parsed.searchParameters && parsed.organic && !parsed.targeted_verification_results) {
                const seoLinks = parsed.organic || [];
                for (const seo of seoLinks) {
                    profiles.push({
                        id: Math.random().toString(36).substring(7),
                        name: seo.title || "Unknown Website",
                        address: "Online/Unknown",
                        rating: 0,
                        reviews_count: 0,
                        categories: ["Website"],
                        digital_maturity_score: 5, // Baseline for just having a website
                        source: 'Serper SEO',
                        social_links: [seo.link],
                        raw_data_ref: file
                    });
                }
            }
            // 3. Handle Targeted Verification Search
            else if (parsed.targeted_verification_results && parsed.original_keyword) {
                const seoLinks = parsed.targeted_verification_results.organic || [];
                profiles.push({
                    id: Math.random().toString(36).substring(7),
                    name: parsed.original_keyword.replace(/ boac| marinduque/ig, '').trim(), // Naive clean up for better matching
                    address: "Verified via Targeted Search",
                    rating: 0,
                    reviews_count: 0,
                    categories: ["Verified Target"],
                    digital_maturity_score: seoLinks.length > 0 ? 8 : 4,
                    source: 'Targeted Verification Serper',
                    social_links: seoLinks.map((seo: any) => seo.link),
                    raw_data_ref: file
                });
            }
            // 4. Handle old Array formats (Google Maps or Apify)
            else {
                let dataArray = Array.isArray(parsed) ? parsed : (parsed.results || [parsed]);
                
                for (const item of dataArray) {
                    // Google Maps place object
                    if (item.place_id || item.geometry) {
                        let score = 3;
                        if (item.business_status === 'OPERATIONAL') score += 2;
                        if (item.rating && item.rating > 4.0) score += 2;
                        if (item.user_ratings_total && item.user_ratings_total > 50) score += 2;
                        if (item.photos && item.photos.length > 0) score += 1;

                        profiles.push({
                            id: item.place_id || Math.random().toString(36).substring(7),
                            name: item.name || "Unknown Name",
                            address: item.formatted_address || "No Address Provided",
                            rating: item.rating || 0,
                            reviews_count: item.user_ratings_total || 0,
                            categories: item.types || [],
                            digital_maturity_score: Math.min(score, 10),
                            source: 'Google Maps',
                            social_links: [],
                            raw_data_ref: file
                        });
                    } 
                    // Apify Facebook 
                    else if (item.url && item.url.includes("facebook")) {
                        profiles.push({
                            id: item.id || Math.random().toString(36).substring(7),
                            name: item.title || item.name || "Facebook Page",
                            address: item.address || "Online/No Address",
                            rating: item.rating || 0,
                            reviews_count: item.reviews || 0,
                            categories: item.categories || ["Facebook Page"],
                            digital_maturity_score: (item.likes && item.likes > 1000) ? 8 : 4,
                            source: 'Apify Facebook',
                            social_links: [item.url],
                            raw_data_ref: file
                        });
                    }
                }
            }
        }

        // Deduplicate profiles by name (naive deduplication)
        const uniqueProfilesMap = new Map();
        profiles.forEach(p => {
            if (!uniqueProfilesMap.has(p.name)) {
                uniqueProfilesMap.set(p.name, p);
            } else {
                // If the new profile has social links and the existing doesn't, merge them
                const existing = uniqueProfilesMap.get(p.name);
                if (p.social_links && p.social_links.length > 0) {
                    existing.social_links = Array.from(new Set([...(existing.social_links || []), ...p.social_links]));
                    existing.digital_maturity_score = Math.min(existing.digital_maturity_score + 2, 10);
                }
            }
        });
        const finalProfiles = Array.from(uniqueProfilesMap.values());

        // Save the Master Synthesized File back to disk permanently
        const masterFilePath = path.join(synthDataDir, 'master_profiles.json');
        fs.writeFileSync(masterFilePath, JSON.stringify(finalProfiles, null, 2));

        return NextResponse.json({ 
            success: true, 
            profiles: finalProfiles, 
            message: `Successfully synthesized and merged ${finalProfiles.length} unique profiles from ${files.length} raw files. Saved to data/synthesized/master_profiles.json` 
        });

    } catch (error: any) {
        console.error("Synthesizer API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process data" }, { status: 500 });
    }
}
