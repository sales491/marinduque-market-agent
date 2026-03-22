import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { bestCategory } from '@/lib/categories';

export async function POST() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing GEMINI_API_KEY." }, { status: 400 });
        }

        const googleProvider = createGoogleGenerativeAI({ apiKey });

        const analysisDir = path.join(process.cwd(), 'data', 'analysis');
        if (!fs.existsSync(analysisDir)) {
            return NextResponse.json({ error: "No analysis reports found. Run Analyst first." }, { status: 400 });
        }

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
                return NextResponse.json({ error: "Master profiles missing." }, { status: 400 });
            }
            profiles = JSON.parse(fs.readFileSync(masterFilePath, 'utf-8'));
        }

        // Group profiles by top-level category
        const categorizedProfiles: Record<string, any[]> = {};
        for (const p of profiles) {
            const topCat = bestCategory(p.categories || []);
            const slug = topCat.toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!categorizedProfiles[slug]) categorizedProfiles[slug] = [];
            categorizedProfiles[slug].push(p);
        }

        const stratDir = path.join(process.cwd(), 'data', 'strategy');
        if (!fs.existsSync(stratDir)) fs.mkdirSync(stratDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const generatedPlans: any[] = [];
        let combinedTextPlan = "";

        for (const [category, catProfiles] of Object.entries(categorizedProfiles)) {
            // Find latest Analyst report for this category
            const files = fs.readdirSync(analysisDir)
                .filter(f => f.startsWith(`market_report_${category}`) && f.endsWith('.md'))
                .sort().reverse();

            if (files.length === 0) continue;

            const reportContent = fs.readFileSync(path.join(analysisDir, files[0]), 'utf-8');

            // ── Filter: Only pass the Top 10 most vulnerable leads ───────────
            const topLeads = [...catProfiles]
                .sort((a, b) => (b.vulnerability_score || 0) - (a.vulnerability_score || 0))
                .slice(0, 10)
                .map(p => ({
                    name: p.name,
                    town: p.town || 'Unknown',
                    rating: p.rating,
                    reviews_count: p.reviews_count,
                    vulnerability_score: p.vulnerability_score,
                    has_website: p.has_website || false,
                    social_links: p.social_links || [],
                    fb_likes: p.fb_likes || null,
                    last_fb_post: p.last_fb_post || null,
                }));

            const prompt = `
You are a highly effective Digital Marketing Sales Strategist managing a new agency targeting provincial businesses in Marinduque.
Our agency strictly specializes in these core services:
- Local SEO (Google Maps / Google Business Profile Optimization)
- Reputation Management & Review Generation
- Social Media Management & Community Building
- Website Development

I am providing you with:
1. The Analyst's Market Gap Report for the [${category.toUpperCase().replace(/_/g, ' ')}] sector.
2. The TOP 10 MOST VULNERABLE LEADS in this sector (pre-filtered by our vulnerability scoring engine).

## YOUR RULES:
For each lead, you MUST use one of these pitch triggers based on their ACTUAL DATA:
- If has_website is false → pitch **Website Development**
- If no facebook.com link in social_links → pitch **Social Media Management**
- If last_fb_post is older than 6 months or null with existing FB → pitch **Social Media Revival**
- If fb_likes < 500 → pitch **Social Media Growth**
- If reviews_count < 20 despite high rating → pitch **Reputation Management & Review Generation**
- If rating < 4.0 → pitch **Reputation Recovery**

Write the pitch as a DIRECT MESSAGE to the business owner. Example:
"Hey [Name], your 4.8-star rating from 150 reviews shows customers love you, but your Facebook page hasn't been updated since October — tourists checking your page think you're closed. Let us take over your social media calendar to capture that lost revenue."

## YOUR OUTPUT:
1. **Top 3 Warm Leads:** Name 3 specific businesses. For each: their data, the specific digital gap, and the exact pitch message.
2. **Quick Wins (Leads 4-7):** Briefly summarize the remaining high-value leads.
3. **The Morning Action:** What does the team do at 8 AM tomorrow?

## TOP 10 VULNERABLE LEADS DATA:
${JSON.stringify(topLeads, null, 2)}

## ANALYST GAP REPORT:
${reportContent}
            `;

            const { text } = await generateText({
                model: googleProvider('gemini-2.5-pro'),
                prompt: prompt,
            });

            const planPath = path.join(stratDir, `action_plan_${category}_${timestamp}.md`);
            fs.writeFileSync(planPath, text);

            const { error: dbError } = await supabase.from('intelligence_reports').insert({
                type: 'strategist_pitch_deck',
                category: category,
                content: text
            });
            if (dbError) console.error("Supabase insert error [Strategist]:", dbError);

            generatedPlans.push({ category, path: planPath });
            combinedTextPlan += `\n\n# 🎯 ATTACK PLAN: ${category.toUpperCase().replace(/_/g, ' ')} MARKET\n\n${text}\n\n---\n`;
        }

        if (generatedPlans.length === 0) {
            return NextResponse.json({ error: "Failed to generate any plans. Ensure Analyst has generated category reports." }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            plan: combinedTextPlan,
            message: `Batch complete: Generated ${generatedPlans.length} separate sales action plans.`
        });

    } catch (error: any) {
        console.error("Strategist API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate strategy via Gemini" }, { status: 500 });
    }
}
