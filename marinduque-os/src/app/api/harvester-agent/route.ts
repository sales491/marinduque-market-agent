// Edge Runtime: 30s timeout on Vercel Hobby (vs 10s for Node.js serverless)
export const runtime = 'edge';

import { generateText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/run-pipeline`;

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
        console.error(`[Agent:supabaseInsert:${table}]`, err);
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
        console.error('[Agent] Failed to trigger pipeline:', e.message);
    }
}

// Helper: Extract arguments from a tool call object across AI SDK versions.
// AI SDK v6 uses `input`, older versions use `args` or `arguments`.
function extractArgs(tc: any): Record<string, any> {
    return tc.input || tc.args || tc.arguments || {};
}

// Helper: Build the keyword for discovery from whatever Gemini sends.
// Gemini often halluclucinates { category, location } instead of { keyword }.
function buildDiscoveryKeyword(args: Record<string, any>): string {
    if (args.keyword && typeof args.keyword === 'string') return args.keyword;
    const cat = args.category || args.type || '';
    const loc = args.location || args.place || '';
    if (cat && loc) return `${cat} in ${loc}`;
    if (cat) return cat;
    if (loc) return loc;
    return 'Cafes in Boac, Marinduque'; // Sensible fallback
}

// Helper: Extract business name from tool args.
// Gemini sends `business_name` (snake_case) instead of `businessName` (camelCase).
function extractBusinessName(args: Record<string, any>): string {
    return args.businessName || args.business_name || args.name || args.keyword || 'Unknown Business';
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, useApify } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 400 });
        }

        const googleProvider = createGoogleGenerativeAI({ apiKey });
        const baseUrl = new URL(req.url).origin;
        const agentSessionId = crypto.randomUUID(); // All tool calls in this agent run share one session

        // Use .passthrough() so Zod v4 does NOT reject extra/unexpected fields from Gemini.
        const toolsDefinition: any = {
            performHybridDiscovery: tool({
                description: 'Run a broad discovery search combining Google Maps and Serper.dev. Pass the full search query as the keyword, e.g., "Cafes in Boac, Marinduque".',
                // @ts-ignore 
                parameters: z.object({
                    keyword: z.string().describe('The full search query including category and location, e.g., "Cafes in Boac, Marinduque"'),
                }).passthrough()
            }),
            performTargetedVerification: tool({
                description: 'Run a targeted verification search for a specific business name to find its social media footprint (Facebook, Instagram, TikTok). Pass the business name as businessName.',
                // @ts-ignore
                parameters: z.object({
                    businessName: z.string().describe('The specific name of the business to verify, e.g., "10 y.o. Cafe"'),
                }).passthrough()
            })
        };

        if (useApify) {
            toolsDefinition.performFacebookScrape = tool({
                description: 'Scrape a specific Facebook page URL to extract deep metrics like follower count, likes, and recent posts. Pass the full URL as url.',
                // @ts-ignore
                parameters: z.object({
                    url: z.string().url().describe('The full Facebook URL to scrape, e.g., "https://www.facebook.com/chinggays"'),
                }).passthrough()
            });
        }

        let systemPrompt = `You are the Autonomous Harvester AI Agent.

IMPORTANT TOOL USAGE RULES:
- When calling performHybridDiscovery, you MUST pass a single "keyword" string combining the category and location, e.g., { "keyword": "Cafes in Boac, Marinduque" }. Do NOT split into separate fields.
- When calling performTargetedVerification, you MUST pass the business name as "businessName", e.g., { "businessName": "10 y.o. Cafe" }.`;

        if (useApify) {
            systemPrompt += `\n- When you find a valid Facebook URL during targeted verification, you MUST immediately call performFacebookScrape with that URL to get deeper social metrics.`;
        }

        systemPrompt += `\n\nAfter receiving tool results, analyze them and provide a detailed summary of your findings.`;

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: prompt || "Run a broad discovery for 'Cafes in Boac, Marinduque'. Select the top 1 and verify their social media presence. Summarize your findings."
            }
        ];

        let finalResponse = "";
        let finalActions: any[] = [];
        const MAX_ITERATIONS = 5;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            let aiResult;
            try {
                aiResult = await generateText({
                    model: googleProvider('gemini-2.5-pro'),
                    messages,
                    tools: toolsDefinition
                });
            } catch (genError: any) {
                console.error(`[Agent Step ${i}] generateText error:`, genError.message);
                // If model errors on follow-up, return what we have so far
                if (finalActions.length > 0) {
                    finalResponse = `Agent completed ${finalActions.length} action(s) but encountered an error on step ${i}: ${genError.message}`;
                    break;
                }
                return Response.json({ error: genError.message || "AI generation failed" }, { status: 500 });
            }

            const { text, toolCalls, finishReason } = aiResult;
            console.log(`[Agent Step ${i}] finishReason=${finishReason}, toolCalls=${toolCalls?.length || 0}, textLen=${text?.length || 0}`);

            // If model finished without tool calls, capture final text
            if (!toolCalls || toolCalls.length === 0) {
                finalResponse = text;
                break;
            }

            // --- Process tool calls ---
            // Push assistant's thinking as its own message
            messages.push({
                role: 'assistant',
                content: text || `Executing ${toolCalls.length} tool(s)...`
            });

            // Execute all tools concurrently in parallel
            const stepResults = await Promise.all(toolCalls.map(async (tc: any) => {
                const args = extractArgs(tc);
                let resultData: any = {};

                try {
                    if (tc.toolName === 'performHybridDiscovery') {
                        const keyword = buildDiscoveryKeyword(args);
                        console.log(`[Agent] Discovery keyword: "${keyword}"`);
                        const res = await fetch(`${baseUrl}/api/harvester`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keyword, type: 'hybrid-discovery', session_id: agentSessionId })
                        });
                        const r = await res.json();
                        resultData = r.data || r;
                    } else if (tc.toolName === 'performTargetedVerification') {
                        const businessName = extractBusinessName(args);
                        console.log(`[Agent] Verifying: "${businessName}"`);
                        const res = await fetch(`${baseUrl}/api/harvester`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keyword: businessName, type: 'targeted-verification', session_id: agentSessionId })
                        });
                        const r = await res.json();
                        resultData = r.data || r;
                    } else if (tc.toolName === 'performFacebookScrape') {
                        const url = args.url || args.keyword;
                        console.log(`[Agent] Scraping FB: "${url}"`);
                        const res = await fetch(`${baseUrl}/api/harvester`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ keyword: url, type: 'facebook-pages', session_id: agentSessionId })
                        });
                        const r = await res.json();
                        resultData = r.data || r;
                    }
                } catch (e: any) {
                    console.error(`[Agent] Tool ${tc.toolName} error:`, e.message);
                    resultData = { error: e.message };
                }

                return {
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args,
                    result: resultData
                };
            }));

            // Feed results back as a user message (bypasses strict ModelMessage schema validation)
            messages.push({
                role: 'user',
                content: `Here are the results from the tools you called:\n\n${JSON.stringify(stepResults, null, 2)}\n\nPlease analyze these results and continue with your plan. If you are done, provide a final summary.`
            });

            finalActions.push(...stepResults);
        }

        // Extract keyword from the first finalAction's args (if available)
        const firstKeyword = finalActions[0]?.args?.keyword || finalActions[0]?.args?.businessName || prompt || '';

        // Insert pipeline_runs FIRST so the Edge Function can update it immediately.
        await supabaseInsert('pipeline_runs', { session_id: agentSessionId, keyword: firstKeyword, status: 'harvesting', source: body.source || 'AI Agent' });
        // Then trigger pipeline — Edge Function updates pipeline_runs status as it progresses.
        await triggerPipeline(agentSessionId, firstKeyword);

        return Response.json({
            success: true,
            session_id: agentSessionId,
            response: finalResponse,
            actions: finalActions
        });

    } catch (error: any) {
        console.error("Harvester AI Agent Error:", error);
        return Response.json({ error: error.message || "Failed to run autonomous agent" }, { status: 500 });
    }
}
