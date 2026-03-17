// ─── Analysis Mode Router ───────────────────────────────────────────────────
// Classifies coordinates as inland, coastal, or mixed based on proximity
// to the UK MHWS (Mean High Water Spring) line and EA tidal flood zones.
//
// Referenced decisions: PRD §4.2 (mode routing), ADR-004 (physics modes)

import type { AnalysisMode, Coordinates } from '@/types';
import { MHWS_BUFFER_KM } from '@/types';
import { distToCoastKm, fetchFloodZones } from '@/services/ukData';

// ─── Coastal Region Bounding Boxes (Phase 1 Approximation) ──────────────────
//
// Simplified bounding boxes covering major UK coastal regions.
// Used as a fast first-pass check before the more expensive haversine
// distance calculation against the sampled coastline.

interface BBox {
  label: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const COASTAL_BBOXES: BBox[] = [
  // South coast (English Channel)
  { label: 'South Coast', minLat: 49.9, maxLat: 50.9, minLng: -5.7, maxLng: 1.5 },
  // East Anglia / Thames Estuary
  { label: 'East Anglia', minLat: 51.3, maxLat: 53.0, minLng: 0.5, maxLng: 1.8 },
  // Humber / Lincolnshire
  { label: 'Humber', minLat: 53.0, maxLat: 53.8, minLng: -0.5, maxLng: 0.4 },
  // NE England
  { label: 'NE England', minLat: 54.3, maxLat: 55.8, minLng: -2.0, maxLng: -0.1 },
  // NW England / Morecambe Bay
  { label: 'NW England', minLat: 53.2, maxLat: 54.5, minLng: -3.5, maxLng: -2.8 },
  // Liverpool Bay / Mersey
  { label: 'Liverpool Bay', minLat: 53.2, maxLat: 53.7, minLng: -3.3, maxLng: -2.9 },
  // Bristol Channel / Severn Estuary
  { label: 'Bristol Channel', minLat: 51.0, maxLat: 51.7, minLng: -5.2, maxLng: -2.5 },
  // SW England (Cornwall / Devon coast)
  { label: 'SW Coast', minLat: 50.0, maxLat: 51.3, minLng: -5.7, maxLng: -3.0 },
  // Welsh coast
  { label: 'Welsh Coast', minLat: 51.5, maxLat: 53.5, minLng: -5.3, maxLng: -4.0 },
  // Scottish East coast
  { label: 'Scottish East', minLat: 55.5, maxLat: 58.7, minLng: -3.5, maxLng: -1.5 },
  // Scottish West coast
  { label: 'Scottish West', minLat: 55.0, maxLat: 58.7, minLng: -6.0, maxLng: -5.0 },
  // Scottish North coast
  { label: 'Scottish North', minLat: 58.2, maxLat: 58.8, minLng: -5.5, maxLng: -3.0 },
];

/**
 * Fast bounding-box check: is the point inside any known coastal region?
 */
function isInCoastalBBox(lat: number, lng: number): boolean {
  return COASTAL_BBOXES.some(
    (bb) => lat >= bb.minLat && lat <= bb.maxLat && lng >= bb.minLng && lng <= bb.maxLng,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify analysis mode for the given coordinates.
 *
 * Algorithm:
 * 1. Compute haversine distance to nearest sampled UK coastline point.
 * 2. If < MHWS_BUFFER_KM (5 km) --> 'coastal'
 * 3. Check if in EA Tidal Flood Zone 3 --> 'mixed'
 * 4. If distance is 5-15 km and in a coastal bounding box --> 'mixed'
 * 5. Otherwise --> 'inland'
 */
export async function classifyMode(coordinates: Coordinates): Promise<AnalysisMode> {
  const { lat, lng } = coordinates;

  // Step 1: Distance to coast
  const coastDistKm = distToCoastKm(lat, lng);

  // Step 2: Within MHWS buffer
  if (coastDistKm < MHWS_BUFFER_KM) {
    return 'coastal';
  }

  // Step 3: Check EA flood zone data for tidal flooding indicator
  try {
    const floodData = await fetchFloodZones(coordinates);
    if (floodData.source !== 'mock' && floodData.data.floodZone === '3') {
      // Flood Zone 3 within 15km of coast suggests tidal influence
      if (coastDistKm <= 15) {
        return 'mixed';
      }
    }
  } catch {
    // Flood zone check failed; continue with distance-based classification
  }

  // Step 4: Transitional zone (estuarine / near-coast)
  if (coastDistKm <= 15 && isInCoastalBBox(lat, lng)) {
    return 'mixed';
  }

  // Step 5: Inland
  return 'inland';
}
