# Antigravity State Restoration Marker

## Active Project
`c:\Users\mspen\.gemini\antigravity\scratch\marinduque-market-agent\marinduque-os`

This is a Next.js 16 app (Turbopack) running on **port 3001**. Start it with:
```
npm run dev
```
in the `marinduque-os` directory.

**DO NOT touch** `C:\Users\mspen\OneDrive\Desktop\ang-marinduque-market` — that is a separate older app and is NOT the one being worked on.

---

## Pending Tasks (in order)

### 1. Fix Markdown Rendering — `globals.css` ⚠️ QUICK FIX
File: `src/app/globals.css`

The `@tailwindcss/typography` package is already installed. Just add this line near the top of `globals.css` (after `@import "tailwindcss"`):
```css
@plugin "@tailwindcss/typography";
```
This will fix the business profile detail reports rendering as raw Markdown text instead of formatted HTML in `IntelligenceDashboard.tsx`.

### 2. Missing "10 Y.O. Cafe" Card ⚠️ INVESTIGATE
The user reported the "10 Y.O. Cafe" business card is missing from the directory view.

- Check `data/synthesized/master_profiles.json` — does the cafe entry exist?
- If yes, the issue is in the aggregator regex or fuzzy deduplication logic in `src/app/api/synthesizer/route.ts`
- Fix the filter so the cafe card appears in the directory

---

## Context / What Happened This Session
- Session crashed mid-task (previous RESTORE_STATE noted this)
- Tailwind Typography was already installed in `package.json` — just needs the CSS plugin line
- Markdown fix in `IntelligenceDashboard.tsx` needs the prose classes applied
- I accidentally made changes to the wrong app (`ang-marinduque-market`) earlier this session and reverted them — those files are clean
