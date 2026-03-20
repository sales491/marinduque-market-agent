# Multi-Agent Workflow

This document outlines how data flows through the Marinduque Market Analysis system.

## 1. Trigger
The workflow is initiated by a User Prompt to the **Strategist Agent**.
*Example: "Give me a list of high-potential cafes in Boac that have bad online presence but good food."*

## 2. Delegation to Harvester (The Hybrid Data Sweep)
The **Strategist** identifies the needed data and tasks the **Harvester Agent**. The Harvester executes a two-phased **Hybrid Data Sweep** to maximize discovery while minimizing API costs via Serper.dev.

### Phase 1: Broad Discovery (Entity Finding)
The Harvester runs generic, broad search queries to discover the market landscape.
- `SerperDevClient(query="cafes in Boac Marinduque", maxPages=3)` -> Extracts the top 30-50 organic results, Maps Local Pack, and "People Also Ask" questions.
- *Goal:* Identify the names of businesses operating in the area, whether they rank natively or via aggregators (TripAdvisor, Lists). No upfront business names are required.

### Phase 2: Targeted Verification (Social Footprint Snipping)
Once the Synthesizer extracts specific business names from Phase 1 (e.g., "Cafe Apollo"), the Harvester runs extremely cheap, laser-focused site queries in parallel.
- `SerperDevClient(query="site:facebook.com 'Cafe Apollo Boac'")`
- `SerperDevClient(query="site:tiktok.com 'Cafe Apollo'")`
- *Goal:* Definitively prove existence or absence on social platforms and grab follower counts/snippets without paying for heavy, dedicated social scrapers.

*Output: Distinct sets of raw JSON data representing broad market discovery, Maps listings, and targeted SEO/Social footprints.*

## 3. Structuring by Synthesizer
The unstructured data is passed to the **Synthesizer Agent**.
- It merges duplicates across platforms (e.g., matching a Google Maps entity to its corresponding Facebook page found via Serper.dev).
- It formats a standardized `BusinessProfile` JSON object.
- It calculates a **Digital Maturity Score** based on the completeness of their online footprint (SEO ranking, Maps presence, Social engagement).
- **Ranking Output:** It produces a unified, ranked list of businesses (e.g., top 20) ordered by specific criteria, providing an immediate snapshot of the market hierarchy and competitor landscape.

## 4. Deep Analysis
The structured profiles and their associated raw comments are sent to the **Analyst Agent**.
- It reads the reviews and comments attached to each profile.
- It identifies recurring entities (e.g., "slow service", "great ambiance", "no parking").
- It assigns a Sentiment Score.

## 5. Final Synthesis
The **Strategist Agent** receives the cleaned profiles and the sentiment analysis. It filters for profiles that match the original criteria (e.g., Digital Maturity < 4, Sentiment > 7).
It formats the final output as a Markdown report or a JSON payload to be displayed in the agency dashboard.
