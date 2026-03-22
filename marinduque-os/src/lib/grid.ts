import type { MarinduqueTown } from './categories';

/**
 * Marinduque Coordinate Grid
 *
 * The island of Marinduque is roughly 30km (N-S) × 20km (E-W).
 * This grid overlays ~28 coordinate points across all 6 municipalities,
 * each representing a 2km sweep radius for Google Maps `nearbysearch`.
 *
 * Reference:
 *  - Marinduque center: ~13.40°N, 121.97°E
 *  - Boac (capital, west coast): ~13.45°N, 121.84°E
 *  - Torrijos (east coast): ~13.405°N, 122.08°E
 */

export interface GridPoint {
    lat: number;
    lng: number;
    label: string;
    town: MarinduqueTown;
}

export const MARINDUQUE_GRID: GridPoint[] = [
    // ── Boac (capital, west coast) ───────────────────────────────────
    { lat: 13.4450, lng: 121.8430, label: 'Boac Centro',          town: 'Boac' },
    { lat: 13.4600, lng: 121.8500, label: 'Boac North',           town: 'Boac' },
    { lat: 13.4300, lng: 121.8350, label: 'Boac South',           town: 'Boac' },
    { lat: 13.4500, lng: 121.8650, label: 'Boac East',            town: 'Boac' },
    { lat: 13.4150, lng: 121.8450, label: 'Boac Coastal South',   town: 'Boac' },

    // ── Mogpog (north-central) ───────────────────────────────────────
    { lat: 13.4800, lng: 121.8600, label: 'Mogpog Centro',        town: 'Mogpog' },
    { lat: 13.4950, lng: 121.8700, label: 'Mogpog North',         town: 'Mogpog' },
    { lat: 13.4700, lng: 121.8800, label: 'Mogpog East',          town: 'Mogpog' },
    { lat: 13.4850, lng: 121.8450, label: 'Mogpog West',          town: 'Mogpog' },

    // ── Santa Cruz (northeast) ───────────────────────────────────────
    { lat: 13.4800, lng: 121.9200, label: 'Santa Cruz Centro',    town: 'Santa Cruz' },
    { lat: 13.4950, lng: 121.9400, label: 'Santa Cruz North',     town: 'Santa Cruz' },
    { lat: 13.4650, lng: 121.9100, label: 'Santa Cruz South',     town: 'Santa Cruz' },
    { lat: 13.4800, lng: 121.9500, label: 'Santa Cruz East',      town: 'Santa Cruz' },
    { lat: 13.4700, lng: 121.9600, label: 'Santa Cruz Coastal',   town: 'Santa Cruz' },

    // ── Torrijos (east coast) ────────────────────────────────────────
    { lat: 13.4050, lng: 122.0800, label: 'Torrijos Centro',      town: 'Torrijos' },
    { lat: 13.4200, lng: 122.0700, label: 'Torrijos North',       town: 'Torrijos' },
    { lat: 13.3900, lng: 122.0850, label: 'Torrijos South',       town: 'Torrijos' },
    { lat: 13.4100, lng: 122.0550, label: 'Torrijos West',        town: 'Torrijos' },
    { lat: 13.4200, lng: 122.0950, label: 'Torrijos Coastal',     town: 'Torrijos' },

    // ── Buenavista (southeast) ───────────────────────────────────────
    { lat: 13.2600, lng: 121.9500, label: 'Buenavista Centro',    town: 'Buenavista' },
    { lat: 13.2750, lng: 121.9600, label: 'Buenavista North',     town: 'Buenavista' },
    { lat: 13.2450, lng: 121.9400, label: 'Buenavista South',     town: 'Buenavista' },
    { lat: 13.2600, lng: 121.9750, label: 'Buenavista East',      town: 'Buenavista' },
    { lat: 13.2700, lng: 121.9300, label: 'Buenavista West',      town: 'Buenavista' },

    // ── Gasan (southwest coast) ──────────────────────────────────────
    { lat: 13.3200, lng: 121.8500, label: 'Gasan Centro',         town: 'Gasan' },
    { lat: 13.3350, lng: 121.8600, label: 'Gasan North',          town: 'Gasan' },
    { lat: 13.3050, lng: 121.8400, label: 'Gasan South',          town: 'Gasan' },
    { lat: 13.3200, lng: 121.8700, label: 'Gasan East',           town: 'Gasan' },
];

/**
 * Returns grid points for the specified towns, or all points if no filter.
 */
export function getGridPoints(towns?: MarinduqueTown[]): GridPoint[] {
    if (!towns || towns.length === 0) return MARINDUQUE_GRID;
    return MARINDUQUE_GRID.filter(p => towns.includes(p.town));
}

/** Default sweep radius in meters for nearbysearch. */
export const DEFAULT_RADIUS_M = 2000;
