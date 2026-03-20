# RESTORE STATE — Marinduque OS
**Last updated:** 2026-03-20 ~01:00 EDT  
**Conversation ID:** `081f0d9a-fd0a-4970-a083-e934a3bdf5c7`  
**Project dir:** `c:\Users\mspen\.gemini\antigravity\scratch\marinduque-market-agent\marinduque-os`  
**Dev server:** `npm run dev -- --port 3001`  
**Supabase project:** `goaeqgrijyjyivensjjp`

---

## What We Were Doing

Full UX + backend overhaul of Marinduque OS. Two goals in one session:

1. **Fix Vercel Hobby 10s timeout** — move Analyst + Strategist AI calls to a Supabase Edge Function
2. **UX Redesign** — unified one-page pipeline: Search → live progress stages → Report Complete → `/report/[session_id]`

---

## What Is DONE ✅

### Database (Supabase)
- `raw_harvest_results` table — stores raw harvest data per `session_id` ✅
- `businesses` table — has `session_id` column ✅
- `pipeline_runs` table — NEW, tracks pipeline status per session ✅  
  Columns: `id`, `session_id`, `keyword`, `status`, `error_message`, `combined_report`, `created_at`, `updated_at`
- `intelligence_reports` table — has `session_id` column added ✅

### Supabase Edge Function
- `run-pipeline` deployed and ACTIVE ✅  
  - Handles: Synthesize → Analyst (parallel) → Strategist (parallel) → mark complete
  - Uses `gemini-2.0-flash` via direct Gemini REST API
  - Updates `pipeline_runs.status` at each stage
  - Writes `combined_report` markdown to `pipeline_runs` on completion
  - Uses `EdgeRuntime.waitUntil()` for fire-and-forget response
  - `verify_jwt: false` (called server-side from harvester)

### harvester/route.ts ✅ COMPLETE REWRITE
- `export const runtime = 'edge'` — 30s Vercel Hobby limit
- No `fs`/`path` (Edge-incompatible — removed)
- Uses lightweight Supabase REST fetch directly
- Saves to `raw_harvest_results` + creates `pipeline_runs` row (parallel)
- Calls `triggerPipeline()` — NON-AWAITED fire-and-forget to Edge Function
- Returns `{ success, session_id }` immediately
- Facebook scraping disabled in edge mode (returns helpful error)

### harvester-agent/route.ts ✅ PARTIAL
- `export const runtime = 'edge'` added ✅
- **PROBLEM**: `NextResponse` was removed with the import of `next/server` but is still used in ~4 places in the file.  
  **Fix needed**: Replace all `NextResponse.json(...)` → `Response.json(...)` in this file

---

## What Is STILL NEEDED ⏳

### Phase 3 (remaining)
- [ ] Fix `harvester-agent/route.ts` — replace `NextResponse.json` → `Response.json` (lint errors, ~4 occurrences)
- [ ] Retire/archive `synthesizer/route.ts`, `analyst/route.ts`, `strategist/route.ts` (pipeline moved to Edge Fn)
- [ ] Update `SynthesizerControl`, `AnalystControl`, `StrategistControl` UI components (they'll be removed from page)

### Phase 4 — UX Redesign (NOT STARTED)
- [ ] Redesign `src/app/page.tsx` — unified search + live pipeline progress tracker
  - Single input (keyword or AI prompt)
  - Toggle: Quick Harvest / AI Agent mode
  - After submit: animated stage progress (Harvesting → Synthesizing → Analyzing → Strategizing → Complete)
  - Polls `pipeline_runs` every 3s via Supabase REST
  - "Report Complete → View Report" CTA when status = `complete`
- [ ] New page: `src/app/report/[session_id]/page.tsx`
  - Fetches `pipeline_runs` row by session_id
  - Renders `combined_report` as Markdown (use ReactMarkdown + prose)
  - Header: keyword, timestamp, "View in Intelligence Directory" link
- [ ] `IntelligenceDashboard.tsx` — unchanged (already reads from `businesses` table)
- [ ] Remove Synthesizer/Analyst/Strategist tabs from Agent Control Center

### Phase 5 — Commit & Deploy
- [ ] Commit all changes
- [ ] Push to GitHub → Vercel auto-deploys
- [ ] End-to-end test on Vercel live site

---

## Key Files

| File | Status |
|---|---|
| `src/app/api/harvester/route.ts` | ✅ Done — Edge Runtime, triggers Edge Fn |
| `src/app/api/harvester-agent/route.ts` | ⚠️ Partial — needs NextResponse → Response fix |
| `src/app/api/synthesizer/route.ts` | ⏳ To be retired/archived |
| `src/app/api/analyst/route.ts` | ⏳ To be retired/archived |
| `src/app/api/strategist/route.ts` | ⏳ To be retired/archived |
| `src/app/page.tsx` | ⏳ Full redesign needed |
| `src/app/report/[session_id]/page.tsx` | ⏳ New page, not yet created |
| `src/components/HarvesterControl.tsx` | ✅ Has session_id, copy badge |
| `src/components/SynthesizerControl.tsx` | ✅ Has session_id input — will be removed from page tab |

---

## Architecture Summary

```
User submits search
       ↓
Vercel Edge (30s): /api/harvester
  → saves to raw_harvest_results
  → creates pipeline_runs row (status: harvesting)
  → fires Supabase Edge Fn (NON-AWAITED)
  → returns { session_id } in <2s
       ↓
Supabase Edge Fn: run-pipeline (no timeout)
  → status: synthesizing → reads raw data, upserts businesses
  → status: analyzing    → all categories Gemini calls in parallel
  → status: strategizing → all categories Gemini calls in parallel
  → status: complete     → writes combined_report to pipeline_runs
       ↓
Client polls pipeline_runs every 3s
  → shows animated progress stages
  → when complete: "View Report" CTA → /report/[session_id]
```

---

## Supabase Edge Function Details
- **Name:** `run-pipeline`  
- **URL:** `https://goaeqgrijyjyivensjjp.supabase.co/functions/v1/run-pipeline`  
- **Status:** ACTIVE  
- **JWT verify:** false (called server-side)  
- **Model used:** `gemini-2.0-flash` (fast enough for edge, better quality than flash-lite)

---

## Immediate Next Step (on resume)

1. Open `harvester-agent/route.ts`
2. Find/replace all `NextResponse.json(` → `Response.json(` (about 4 occurrences around lines 39, 113, 191, 199)
3. Then start Phase 4 UX redesign of `src/app/page.tsx`
