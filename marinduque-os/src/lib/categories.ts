export const TOP_CATEGORIES = [
  'Food & Beverage',
  'Professional Services',
  'Health & Wellness',
  'Personal Services',
  'Tourism & Hospitality',
  'Agribusiness',
  'Retail & E-commerce',
  'Real Estate',
  'Auto Services',
  'Construction & Home Improvement',
  'Education',
  'Events',
  'Logistics',
  'Pet Care',
  'Tech Services',
  'Other',
] as const;

export type TopCategory = typeof TOP_CATEGORIES[number];

// Keyword → Top Category mapping (lowercase, partial match)
const CATEGORY_KEYWORDS: { category: TopCategory; keywords: string[] }[] = [
  {
    category: 'Food & Beverage',
    keywords: ['bakery', 'cafe', 'restaurant', 'food', 'bar', 'uraro', 'snack', 'karinderya',
      'eatery', 'carenderia', 'diner', 'pizza', 'sushi', 'grill', 'bbq', 'burger', 'coffee',
      'pastry', 'bread', 'meal', 'dining', 'bistro', 'canteen'],
  },
  {
    category: 'Professional Services',
    keywords: ['clinic', 'law', 'legal', 'accounting', 'notary', 'dental', 'dentist', 'medical',
      'doctor', 'lawyer', 'accountant', 'cpa', 'insurance', 'finance', 'bank', 'audit',
      'consultancy', 'consultant', 'physician', 'optometrist', 'optician'],
  },
  {
    category: 'Health & Wellness',
    keywords: ['spa', 'salon', 'barber', 'beauty', 'wellness', 'massage', 'gym', 'fitness',
      'nail', 'hair', 'skincare', 'therapy', 'yoga', 'meditation', 'pilates', 'aesthetic'],
  },
  {
    category: 'Personal Services',
    keywords: ['laundry', 'laundromat', 'printing', 'print', 'tailoring', 'seamstress', 'repair',
      'alterations', 'shoe', 'cobbler', 'cleaning', 'pest control'],
  },
  {
    category: 'Tourism & Hospitality',
    keywords: ['resort', 'hotel', 'inn', 'tour', 'butterfly', 'travel', 'lodge', 'hostel',
      'tourism', 'beach', 'island', 'dive', 'adventure', 'camping', 'cottage', 'airbnb',
      'guesthouse', 'transient'],
  },
  {
    category: 'Agribusiness',
    keywords: ['farm', 'coconut', 'tuba', 'poultry', 'agriculture', 'livestock', 'harvest',
      'rice', 'crop', 'fishery', 'fishing', 'aquaculture', 'organic', 'plantation',
      'vegetable', 'fruit', 'hog', 'goat', 'cattle'],
  },
  {
    category: 'Retail & E-commerce',
    keywords: ['store', 'shop', 'retail', 'sari-sari', 'buy', 'sell', 'market', 'grocery',
      'supermarket', 'merchandise', 'goods', 'online shop', 'ukay', 'thrift',
      'department', 'boutique', 'clothing', 'apparel', 'fashion'],
  },
  {
    category: 'Real Estate',
    keywords: ['real estate', 'rental', 'property', 'apartment', 'condo', 'lot', 'house',
      'lease', 'broker', 'agent', 'subdivision', 'dwelling'],
  },
  {
    category: 'Auto Services',
    keywords: ['car', 'motorcycle', 'motor', 'motorshop', 'auto', 'garage', 'carwash',
      'car wash', 'vulcanizing', 'tires', 'mechanic', 'vehicle', 'tricycle', 'jeepney'],
  },
  {
    category: 'Construction & Home Improvement',
    keywords: ['hardware', 'construction', 'carpentry', 'handyman', 'plumbing', 'electrical',
      'welding', 'fabrication', 'masonry', 'painting', 'renovation', 'contractor',
      'ironworks', 'lumber', 'roofing'],
  },
  {
    category: 'Education',
    keywords: ['school', 'tutorial', 'review', 'learning', 'training', 'center', 'academy',
      'college', 'university', 'institute', 'daycare', 'preschool', 'kindergarten',
      'education', 'coaching', 'driving school'],
  },
  {
    category: 'Events',
    keywords: ['photographer', 'videographer', 'florist', 'event', 'wedding', 'catering',
      'sound', 'lights', 'dj', 'host', 'venue', 'decoration', 'party', 'birthday',
      'debut', 'pictorial', 'photo'],
  },
  {
    category: 'Logistics',
    keywords: ['delivery', 'logistics', 'courier', 'moving', 'transport', 'cargo', 'trucking',
      'forwarding', 'shipping', 'messenger', 'padala'],
  },
  {
    category: 'Pet Care',
    keywords: ['pet', 'vet', 'veterinary', 'grooming', 'animal', 'dog', 'cat', 'veterinarian',
      'kennel', 'aquarium', 'fish'],
  },
  {
    category: 'Tech Services',
    keywords: ['cellphone', 'computer', 'tech', 'it', 'gadget', 'laptop', 'repair shop',
      'software', 'internet', 'cctv', 'printer repair', 'data recovery', 'networking'],
  },
];

/**
 * Maps a raw category string (from Google Maps types or Supabase intelligence_reports)
 * to one of the 15 top-level categories, or "Other" if no match.
 */
export function mapToTopCategory(raw: string): TopCategory {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other';
}

// Google Maps generic noise tokens that carry no useful category signal
const NOISE_TOKENS = new Set([
  'establishment', 'point of interest', 'point_of_interest', 'store',
  'verified target', 'website', 'other', 'geocode', 'premise',
  'street address', 'route',
]);

/**
 * Given a business's full categories array (from Google Maps / DB), scans every
 * element and returns the first top-level category that isn't "Other".
 * Falls back to "Other" if no meaningful match is found.
 */
export function bestCategory(categories: string[]): TopCategory {
  if (!categories?.length) return 'Other';
  // Try each raw category in order, skipping noise
  for (const raw of categories) {
    const lower = raw.toLowerCase().replace(/_/g, ' ').trim();
    if (NOISE_TOKENS.has(lower)) continue;
    const mapped = mapToTopCategory(raw);
    if (mapped !== 'Other') return mapped;
  }
  // Nothing matched — still "Other"
  return 'Other';
}

// ── Marinduque municipality utilities ────────────────────────────────────────

/** The 6 municipalities of Marinduque. */
export const MARINDUQUE_TOWNS = [
  'Boac',
  'Mogpog',
  'Santa Cruz',
  'Gasan',
  'Buenavista',
  'Torrijos',
] as const;

export type MarinduqueTown = typeof MARINDUQUE_TOWNS[number] | 'Unknown';

/**
 * Extracts the Marinduque municipality from a business address string.
 * Scans for each of the 6 town names (case-insensitive).
 * Returns 'Unknown' if no match is found (e.g. "Verified via Targeted Search").
 */
export function extractTown(address: string): MarinduqueTown {
  if (!address) return 'Unknown';
  const lower = address.toLowerCase();
  // Check "Santa Cruz" first (two words) before shorter single-word towns
  for (const town of MARINDUQUE_TOWNS) {
    if (lower.includes(town.toLowerCase())) return town;
  }
  return 'Unknown';
}
