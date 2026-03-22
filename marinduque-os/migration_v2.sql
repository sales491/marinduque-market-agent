-- Marinduque OS V2 — Schema Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Rename digital_maturity_score → vulnerability_score
ALTER TABLE businesses 
  RENAME COLUMN digital_maturity_score TO vulnerability_score;

-- 2. Add new columns for enriched data
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS town TEXT DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS has_website BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fb_likes INTEGER,
  ADD COLUMN IF NOT EXISTS last_fb_post TIMESTAMPTZ;

-- 3. Backfill town from existing address data
UPDATE businesses SET town = 'Boac' WHERE LOWER(address) LIKE '%boac%' AND town = 'Unknown';
UPDATE businesses SET town = 'Mogpog' WHERE LOWER(address) LIKE '%mogpog%' AND town = 'Unknown';
UPDATE businesses SET town = 'Santa Cruz' WHERE LOWER(address) LIKE '%santa cruz%' AND town = 'Unknown';
UPDATE businesses SET town = 'Gasan' WHERE LOWER(address) LIKE '%gasan%' AND town = 'Unknown';
UPDATE businesses SET town = 'Buenavista' WHERE LOWER(address) LIKE '%buenavista%' AND town = 'Unknown';
UPDATE businesses SET town = 'Torrijos' WHERE LOWER(address) LIKE '%torrijos%' AND town = 'Unknown';
