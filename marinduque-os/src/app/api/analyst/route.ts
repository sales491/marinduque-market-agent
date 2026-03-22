import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { bestCategory, TOP_CATEGORIES } from '@/lib/categories';

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing GEMINI_API_KEY in .env.local file. Add it to run the Analyst." }, { status: 400 });
        }

        const googleProvider = createGoogleGenerativeAI({ apiKey });

        // ── Load profiles: prefer Supabase, fallback to local disk ───────────
        let profiles: any[] = [];
        const { data: dbProfiles } = await supabase
            .from('businesses')
            .select('*')
            .order('vulnerability_score', { ascending: false })
            .limit(1000);

        if (dbProfiles && dbProfiles.length > 0) {
            profiles = dbProfiles;
        } else {
            const synthDataDir = path.join(process.cwd(), 'data', 'synthesized');
            const masterFilePath = path.join(synthDataDir, 'master_profiles.json');
            if (!fs.existsSync(masterFilePath)) {
                return NextResponse.json({ error: "No synthesized profiles found. Run the Synthesizer first." }, { status: 400 });
            }
            profiles = JSON.parse(fs.readFileSync(masterFilePath, 'utf-8'));
        }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ error: "No business profiles available." }, { status: 400 });
        }

        // ── Group by top-level category ──────────────────────────────────────
        const categorizedProfiles: Record<string, any[]> = {};
        for (const p of profiles) {
            const topCat = bestCategory(p.categories || []);
            const slug = topCat.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!categorizedProfiles[slug]) categorizedProfiles[slug] = [];
            categorizedProfiles[slug].push(p);
        }

        const analysisDir = path.join(process.cwd(), 'data', 'analysis');
        if (!fs.existsSync(analysisDir)) fs.mkdirSync(analysisDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const generatedReports = [];
        let combinedTextReport = "";

        for (const [category, catProfiles] of Object.entries(categorizedProfiles)) {
            // ── Pre-aggregate hard stats (Phase 6) ───────────────────────────
            const totalCount = catProfiles.length;
            const avgScore = (catProfiles.reduce((s, p) => s + (p.vulnerability_score || 0), 0) / totalCount).toFixed(1);

            const noWebsite = catProfiles.filter(p => !p.has_website).length;
            const noWebsitePct = ((noWebsite / totalCount) * 100).toFixed(0);

            const noFacebook = catProfiles.filter(p => {
                const links = p.social_links || [];
                return !links.some((l: string) => l.toLowerCase().includes('facebook.com'));
            }).length;
            const noFacebookPct = ((noFacebook / totalCount) * 100).toFixed(0);

            const inactiveFb = catProfiles.filter(p => {
                if (!p.last_fb_post) return false; // unknown, not counted
                const lastPost = new Date(p.last_fb_post);
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                return lastPost < sixMonthsAgo;
            }).length;

            // Top 5 most vulnerable leads for this category
            const topVulnerable = [...catProfiles]
                .sort((a, b) => (b.vulnerability_score || 0) - (a.vulnerability_score || 0))
                .slice(0, 5)
                .map(p => ({
                    name: p.name,
                    score: p.vulnerability_score,
                    town: p.town || 'Unknown',
                    weakness: !p.has_website ? 'No Website' :
                        !(p.social_links || []).some((l: string) => l.includes('facebook.com')) ? 'No Facebook' :
                        'Low Digital Presence'
                }));

            const prompt = `
You are an expert Local Market Analyst specializing in digital marketing opportunities in provincial regions like Marinduque.
Our digital marketing agency provides the following core services:
- Local SEO (Google Maps / Google Business Profile Optimization)
- Reputation Management & Review Generation
- Social Media Management & Community Building
- Website Development

You are analyzing the [${category.toUpperCase().replace(/_/g, ' ')}] sector in Marinduque.

## PRE-COMPUTED STATISTICS (use these as your primary data source):
- Total businesses discovered: ${totalCount}
- Average Vulnerability Score: ${avgScore}/10
- ${noWebsitePct}% have NO website (${noWebsite}/${totalCount})
- ${noFacebookPct}% have NO Facebook page (${noFacebook}/${totalCount})
- ${inactiveFb} businesses have inactive Facebook (no posts in 6+ months)

## TOP 5 MOST VULNERABLE LEADS:
${topVulnerable.map((t, i) => `${i + 1}. ${t.name} (Score: ${t.score}/10, Town: ${t.town}, Key Gap: ${t.weakness})`).join('\n')}

## SUPPLEMENTARY RAW DATA (top 15 profiles for context):
${JSON.stringify(catProfiles.slice(0, 15).map(p => ({
    name: p.name,
    town: p.town,
    rating: p.rating,
    reviews_count: p.reviews_count,
    vulnerability_score: p.vulnerability_score,
    has_website: p.has_website,
    social_links: p.social_links,
    fb_likes: p.fb_likes
})), null, 2)}

Your goal:
1. **Market Saturation & Gaps:** What services are missing in this sector? Who dominates?
2. **Digital Vulnerability Assessment:** Using the stats above, how exposed are these businesses? Where are the biggest gaps our agency can fill?
3. **Strategic Opportunities:** Based on our core services, identify the most actionable niches. Cite specific businesses and their vulnerability scores when making recommendations.

Write a concise, data-driven Markdown report. Every claim must be supported by the statistics above. Do NOT invent data.
            `;

            const { text } = await generateText({
                model: googleProvider('gemini-2.5-pro'),
                prompt: prompt,
            });

            // Save to disk
            const reportPath = path.join(analysisDir, `market_report_${category}_${timestamp}.md`);
            fs.writeFileSync(reportPath, text);

            // Save to Supabase
            const { error: dbError } = await supabase.from('intelligence_reports').insert({
                type: 'analyst_gap_report',
                category: category,
                content: text
            });
            if (dbError) console.error("Supabase insert error [Analyst]:", dbError);

            generatedReports.push({ category, path: reportPath });
            combinedTextReport += `\n\n# 📊 OVERVIEW: ${category.toUpperCase().replace(/_/g, ' ')} MARKET\n\n${text}\n\n---\n`;
        }

        return NextResponse.json({
            success: true,
            report: combinedTextReport,
            message: `Batch complete: Generated ${generatedReports.length} separate category reports.`
        });

    } catch (error: any) {
        console.error("Analyst API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate analysis via Gemini" }, { status: 500 });
    }
}
