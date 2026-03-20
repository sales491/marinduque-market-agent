import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';

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

        // Grab master profiles to allow the strategist to pull specific names
        const synthDataDir = path.join(process.cwd(), 'data', 'synthesized');
        const masterFilePath = path.join(synthDataDir, 'master_profiles.json');
        
        if (!fs.existsSync(masterFilePath)) {
            return NextResponse.json({ error: "Master profiles missing." }, { status: 400 });
        }

        const rawContent = fs.readFileSync(masterFilePath, 'utf-8');
        const profiles: any[] = JSON.parse(rawContent);

        // Group profiles by category to match Analyst output
        const categorizedProfiles: Record<string, any[]> = {};
        profiles.forEach((p: any) => {
             const mainCat = p.categories && p.categories.length > 0 ? p.categories[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : "uncategorized";
             if (!categorizedProfiles[mainCat]) categorizedProfiles[mainCat] = [];
             categorizedProfiles[mainCat].push(p);
        });

        const stratDir = path.join(process.cwd(), 'data', 'strategy');
        if (!fs.existsSync(stratDir)) fs.mkdirSync(stratDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const generatedPlans: any[] = [];
        let combinedTextPlan = "";

        // Loop through each market category
        for (const [category, catProfiles] of Object.entries(categorizedProfiles)) {
            // Find latest report for this specific category
            const files = fs.readdirSync(analysisDir)
                .filter(f => f.startsWith(`market_report_${category}`) && f.endsWith('.md'))
                .sort().reverse();
            
            if (files.length === 0) continue; // No Analyst report for this category yet
            
            const reportContent = fs.readFileSync(path.join(analysisDir, files[0]), 'utf-8');

            const prompt = `
You are a highly effective Digital Marketing Sales Strategist managing a new agency targeting provincial businesses in Marinduque.
Our agency strictly specializes in these core services:
- Local SEO (Google Maps / Google Business Profile Optimization)
- Reputation Management & Review Generation
- Social Media Management & Community Building
- Website Development

I am providing you with:
1. The objective Market Analysis Report written by our local Analyst for the [${category.toUpperCase()}] sector.
2. The raw dataset containing the names, categories, and digital maturity scores of the businesses in this sector.

Your job is to generate a highly actionable "Attack Plan" for our sales team for this week targeting the ${category} market.
Do not provide generic marketing advice. You must specifically name real businesses from the dataset.

Your output must include:
1. **Top 3 Warm Leads:** Identify 3 specific businesses from the dataset that desperately need digital marketing.
2. **The Pitch Angle for Each Lead:** Select one specific service from our core offerings that fits their biggest weakness, and write the exact pitch angle/hook for that service.
3. **The Next Step:** What does the team do tomorrow morning?

Dataset snippet: ${JSON.stringify(catProfiles.slice(0, 150), null, 2)}

Market Analysis Report:
${reportContent}
            `;

            const { text } = await generateText({
                model: googleProvider('gemini-2.5-pro'),
                prompt: prompt,
            });

            // Save category strategy plan to disk
            const planPath = path.join(stratDir, `action_plan_${category}_${timestamp}.md`);
            fs.writeFileSync(planPath, text);

            generatedPlans.push({ category, path: planPath });
            combinedTextPlan += `\n\n# 🎯 ATTACK PLAN: ${category.toUpperCase()} MARKET\n\n${text}\n\n---\n`;
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
