import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing GEMINI_API_KEY in .env.local file. Add it to run the Analyst." }, { status: 400 });
        }

        const googleProvider = createGoogleGenerativeAI({
            apiKey: apiKey,
        });

        const synthDataDir = path.join(process.cwd(), 'data', 'synthesized');
        const masterFilePath = path.join(synthDataDir, 'master_profiles.json');
        
        if (!fs.existsSync(masterFilePath)) {
            return NextResponse.json({ error: "No synthesized profiles found. Please run the Synthesizer pipeline first to generate the master_profiles.json file." }, { status: 400 });
        }

        const rawContent = fs.readFileSync(masterFilePath, 'utf-8');
        const profiles = JSON.parse(rawContent);

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ error: "Master profiles file is empty." }, { status: 400 });
        }

        // Group profiles by their primary category
        const categorizedProfiles: Record<string, any[]> = {};
        profiles.forEach((p: any) => {
             // Clean strings for filenames, e.g. "coffee shop" -> "coffee_shop"
             const mainCat = p.categories && p.categories.length > 0 ? p.categories[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : "uncategorized";
             if (!categorizedProfiles[mainCat]) categorizedProfiles[mainCat] = [];
             categorizedProfiles[mainCat].push(p);
        });

        const analysisDir = path.join(process.cwd(), 'data', 'analysis');
        if (!fs.existsSync(analysisDir)) fs.mkdirSync(analysisDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const generatedReports = [];
        let combinedTextReport = "";

        // Loop through every single market category and generate an isolated report
        for (const [category, catProfiles] of Object.entries(categorizedProfiles)) {
            
            const prompt = `
You are an expert Local Market Analyst specializing in digital marketing opportunities in provincial regions like Marinduque.
Our digital marketing agency provides the following core services:
- Local SEO (Google Maps / Google Business Profile Optimization)
- Reputation Management & Review Generation
- Social Media Management & Community Building
- Website Development

I am providing you with the entire dataset of local businesses strictly operating within the [${category.toUpperCase()}] sector.

Your goal is to identify:
1. **Market Saturation & Gaps:** Within the ${category.toUpperCase()} market, what services are missing? Who is dominating?
2. **Digital Readiness:** Based on the 'digital_maturity_score' (1-10) and reviews, how digitally mature are these specific businesses overall?
3. **Strategic Opportunities:** Based specifically on our core services, where are the biggest gaps in this market? Where should we focus our lead generation efforts? Identify the most vulnerable niches where our services can provide immediate impact.

Provide a concise, highly structured Markdown report. Do not invent data; rely solely on the provided JSON profiles.
Dataset snippet (${catProfiles.length} items): 
${JSON.stringify(catProfiles.slice(0, 150), null, 2)}
            `;

            const { text } = await generateText({
                model: googleProvider('gemini-2.5-pro'),
                prompt: prompt,
            });

            // Save individual category report to disk permanently
            const reportPath = path.join(analysisDir, `market_report_${category}_${timestamp}.md`);
            fs.writeFileSync(reportPath, text);
            
            generatedReports.push({ category, path: reportPath });
            // Append to the UI display feed
            combinedTextReport += `\n\n# 📊 OVERVIEW: ${category.toUpperCase()} MARKET\n\n${text}\n\n---\n`;
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
