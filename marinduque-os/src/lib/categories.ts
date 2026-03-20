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
