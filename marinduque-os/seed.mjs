import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Seeding Supabase...");

  // 1. Seed Businesses
  const synthFile = path.join(process.cwd(), 'data', 'synthesized', 'master_profiles.json');
  if (fs.existsSync(synthFile)) {
    const profiles = JSON.parse(fs.readFileSync(synthFile, 'utf-8'));
    console.log(`Found ${profiles.length} profiles to seed.`);
    
    const { error } = await supabase.from('businesses').upsert(
      profiles.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        town: p.town || 'Unknown',
        rating: p.rating,
        reviews_count: p.reviews_count,
        categories: p.categories,
        vulnerability_score: p.vulnerability_score ?? p.digital_maturity_score ?? 0,
        source: p.source,
        social_links: p.social_links,
        raw_data_ref: p.raw_data_ref,
        has_website: p.has_website || false,
        fb_likes: p.fb_likes || null,
        last_fb_post: p.last_fb_post || null,
        overview: `${p.name} is a ${p.categories?.[0] || 'business'} located at ${p.address || 'an unknown address'}. It was discovered via ${p.source}.`
      })),
      { onConflict: 'id' }
    );
    if (error) console.error("Error inserting businesses:", error);
    else console.log("Businesses seeded successfully.");
  }

  // 2. Seed Intelligence Reports
  const analysisDir = path.join(process.cwd(), 'data', 'analysis');
  if (fs.existsSync(analysisDir)) {
    const files = fs.readdirSync(analysisDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const match = f.match(/market_report_(.+)_2026/);
      const cat = match ? match[1] : 'uncategorized';
      const content = fs.readFileSync(path.join(analysisDir, f), 'utf-8');
      
      const { error } = await supabase.from('intelligence_reports').insert({
        type: 'analyst_gap_report',
        category: cat,
        content: content
      });
      if (error) console.error(`Error inserting analyst report ${f}:`, error);
    }
  }

  const stratDir = path.join(process.cwd(), 'data', 'strategy');
  if (fs.existsSync(stratDir)) {
    const files = fs.readdirSync(stratDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const match = f.match(/action_plan_(.+)_2026/);
      const cat = match ? match[1] : 'uncategorized';
      const content = fs.readFileSync(path.join(stratDir, f), 'utf-8');
      
      const { error } = await supabase.from('intelligence_reports').insert({
        type: 'strategist_pitch_deck',
        category: cat,
        content: content
      });
      if (error) console.error(`Error inserting strategy report ${f}:`, error);
    }
  }

  console.log("Seeding complete.");
}

seed();
