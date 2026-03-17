// ─── UK Data Connectors ─────────────────────────────────────────────────────
// Typed TypeScript port of docs/app/uk-data.js. Fetches from UK government
// open-data APIs where CORS is supported, falls back to location-aware mock
// data for APIs that require a proxy.
//
// Referenced decisions: ADR-003 (Cloudflare Worker proxy), PRD §6 (data sources)

import { get as idbGet, set as idbSet } from 'idb-keyval';
import type {
  Coordinates,
  UKDataResponse,
  FloodZoneData,
  CatchmentData,
  SoilData,
  ElevationData,
  TidalData,
  BathymetryData,
  DataSource,
  SoilType,
  AnalysisMode,
} from '@/types';

// ─── Cache TTLs (milliseconds) ─────────────────────────────────────────────

const TTL = {
  FLOOD_ZONES: 24 * 60 * 60 * 1000,      // 24 hours
  CATCHMENT: 24 * 60 * 60 * 1000,         // 24 hours
  SOIL: 7 * 24 * 60 * 60 * 1000,          // 7 days
  ELEVATION: 7 * 24 * 60 * 60 * 1000,     // 7 days
  TIDAL: 5 * 60 * 1000,                    // 5 minutes
  BATHYMETRY: 7 * 24 * 60 * 60 * 1000,    // 7 days
  RAINFALL: 7 * 24 * 60 * 60 * 1000,      // 7 days
} as const;

// ─── IndexedDB TTL Cache ────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const entry = await idbGet<CacheEntry<T>>(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function cacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    await idbSet(key, entry);
  } catch {
    // IndexedDB unavailable (private browsing, etc.) — proceed without caching
  }
}

// ─── Coordinate Snapping ────────────────────────────────────────────────────

/** Round to 3 decimal places for cache-key normalisation (~100m precision). */
function snap(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function cacheKey(prefix: string, coords: Coordinates): string {
  return `${prefix}:${snap(coords.lat)}:${snap(coords.lng)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Haversine ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geographic Context Helpers ─────────────────────────────────────────────

function isSevernCatchment(lat: number, lng: number): boolean {
  return lat >= 51.5 && lat <= 52.8 && lng >= -3.5 && lng <= -2.0;
}

function isSEEngland(lat: number, lng: number): boolean {
  return lat >= 50.8 && lat <= 51.8 && lng >= -1.5 && lng <= 1.5;
}

function isUpland(lat: number, lng: number): boolean {
  if (lat > 56.0) return true;
  if (lat >= 53.5 && lat <= 55.5 && lng >= -3.5 && lng <= -1.5) return true;
  if (lat >= 51.7 && lat <= 53.5 && lng >= -4.5 && lng <= -3.0) return true;
  if (lat >= 50.5 && lat <= 51.2 && lng >= -4.1 && lng <= -3.2) return true;
  return false;
}

function indicativeSoilType(lat: number, lng: number): { code: SoilType; permeability: 'low' | 'moderate' | 'high'; fieldCapacity: number; description: string } {
  if (isUpland(lat, lng)) {
    return { code: 'PEAT', permeability: 'low', fieldCapacity: 85, description: 'Deep peat (blanket bog)' };
  }
  if (isSEEngland(lat, lng)) {
    return { code: 'CHALK', permeability: 'high', fieldCapacity: 30, description: 'Chalk rendzina' };
  }
  if (isSevernCatchment(lat, lng)) {
    return { code: 'CLAY', permeability: 'low', fieldCapacity: 42, description: 'Reddish-brown clay loam (Midland till)' };
  }
  return { code: 'CLAY', permeability: 'low', fieldCapacity: 48, description: 'Heavy clay (lowland alluvium)' };
}

// ─── Coastline Sample Points ────────────────────────────────────────────────

const UK_COAST_SAMPLE_POINTS: [number, number][] = [
  // South coast
  [50.10, -5.55], [50.07, -5.05], [50.12, -4.49], [50.33, -4.11],
  [50.37, -3.85], [50.42, -3.54], [50.47, -3.14], [50.61, -2.46],
  [50.72, -2.02], [50.82, -1.78], [50.73, -1.08], [50.68, -0.50],
  [50.79, 0.28], [50.88, 0.63], [51.08, 1.18], [51.12, 1.39],
  // Thames Estuary / East Anglia
  [51.45, 1.01], [51.75, 1.06], [51.97, 1.22], [52.30, 1.73],
  [52.58, 1.74], [52.94, 1.10], [53.05, 0.55], [53.25, 0.22],
  // Humber / Yorkshire / NE
  [53.53, 0.11], [53.72, 0.27], [54.07, -0.19], [54.29, -0.36],
  [54.52, -1.12], [54.67, -1.32], [54.85, -1.54], [55.02, -1.56],
  [55.22, -1.62], [55.42, -1.58], [55.59, -2.00],
  // SE Scotland
  [55.73, -2.40], [55.99, -3.18], [56.07, -3.40], [56.30, -2.93],
  [56.57, -2.62], [56.72, -2.34], [57.00, -2.12], [57.18, -2.11],
  // NE Scotland / Moray
  [57.40, -1.92], [57.59, -1.80], [57.70, -3.29], [57.56, -3.85],
  [57.66, -4.04], [57.78, -4.15], [57.90, -4.05],
  // N Scotland
  [58.26, -3.59], [58.52, -3.06], [58.65, -3.08], [58.57, -3.52],
  [58.29, -5.01], [58.00, -5.21], [57.88, -5.63],
  // W Scotland
  [57.74, -5.77], [57.59, -5.84], [57.32, -5.78], [57.05, -5.82],
  [56.80, -5.72], [56.55, -5.61], [56.25, -5.44], [55.95, -5.28],
  [55.60, -5.32], [55.40, -5.19], [55.20, -5.05],
  // SW Scotland
  [54.98, -5.15], [54.82, -5.00], [54.68, -4.87], [54.49, -4.68],
  // NW England
  [54.22, -3.45], [54.07, -3.20], [53.87, -3.21], [53.65, -3.08],
  [53.39, -3.07], [53.26, -3.25], [53.07, -4.24], [52.84, -4.46],
  [52.54, -4.52], [52.11, -4.70], [51.87, -5.07], [51.60, -5.07],
  [51.49, -4.92], [51.29, -4.55], [51.19, -4.17],
  // SW England
  [51.19, -4.17], [51.20, -3.71], [51.21, -3.31], [51.26, -3.00],
  [51.19, -2.90], [51.06, -3.09], [50.87, -3.39], [50.77, -3.94],
  [50.55, -4.52], [50.38, -5.02],
];

export function distToCoastKm(lat: number, lng: number): number {
  let minDist = Infinity;
  for (const [cLat, cLng] of UK_COAST_SAMPLE_POINTS) {
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ─── NTSLF Tide Stations ───────────────────────────────────────────────────

interface TideStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  mhwsODN: number;
  mhwnODN: number;
  mlwsODN: number;
}

const TIDE_STATIONS: TideStation[] = [
  { id: 'NEWL', name: 'Newlyn', lat: 50.103, lng: -5.543, mhwsODN: 2.69, mhwnODN: 2.01, mlwsODN: -2.52 },
  { id: 'PLYM', name: 'Plymouth', lat: 50.366, lng: -4.185, mhwsODN: 2.48, mhwnODN: 1.84, mlwsODN: -2.16 },
  { id: 'PORT', name: 'Portsmouth', lat: 50.798, lng: -1.110, mhwsODN: 1.87, mhwnODN: 1.44, mlwsODN: -1.38 },
  { id: 'NSHV', name: 'Newhaven', lat: 50.777, lng: 0.057, mhwsODN: 3.14, mhwnODN: 2.43, mlwsODN: -2.82 },
  { id: 'DOVE', name: 'Dover', lat: 51.113, lng: 1.325, mhwsODN: 3.39, mhwnODN: 2.59, mlwsODN: -2.98 },
  { id: 'SHEE', name: 'Sheerness', lat: 51.443, lng: 0.744, mhwsODN: 3.09, mhwnODN: 2.49, mlwsODN: -2.39 },
  { id: 'THMH', name: 'Tower Bridge', lat: 51.506, lng: -0.075, mhwsODN: 3.37, mhwnODN: 2.81, mlwsODN: -1.91 },
  { id: 'LOWT', name: 'Lowestoft', lat: 52.471, lng: 1.749, mhwsODN: 1.34, mhwnODN: 1.11, mlwsODN: -1.10 },
  { id: 'IMMI', name: 'Immingham', lat: 53.628, lng: -0.187, mhwsODN: 3.91, mhwnODN: 3.14, mlwsODN: -3.32 },
  { id: 'WTBY', name: 'Whitby', lat: 54.493, lng: -0.615, mhwsODN: 3.01, mhwnODN: 2.35, mlwsODN: -2.51 },
  { id: 'NSHD', name: 'North Shields', lat: 55.007, lng: -1.441, mhwsODN: 2.45, mhwnODN: 1.84, mlwsODN: -1.87 },
  { id: 'ABDN', name: 'Aberdeen', lat: 57.144, lng: -2.079, mhwsODN: 2.05, mhwnODN: 1.53, mlwsODN: -1.85 },
  { id: 'LVPL', name: 'Liverpool', lat: 53.451, lng: -3.018, mhwsODN: 4.93, mhwnODN: 3.96, mlwsODN: -4.17 },
  { id: 'AVTP', name: 'Avonmouth', lat: 51.509, lng: -2.713, mhwsODN: 6.62, mhwnODN: 5.25, mlwsODN: -5.90 },
  { id: 'CARD', name: 'Cardiff', lat: 51.467, lng: -3.167, mhwsODN: 6.05, mhwnODN: 4.72, mlwsODN: -5.34 },
];

function nearestTideStation(lat: number, lng: number): TideStation {
  let best = TIDE_STATIONS[0];
  let bestDist = Infinity;
  for (const station of TIDE_STATIONS) {
    const d = haversineKm(lat, lng, station.lat, station.lng);
    if (d < bestDist) {
      bestDist = d;
      best = station;
    }
  }
  return best;
}

// ─── EA Flood Zone Endpoints (CORS-enabled) ─────────────────────────────────

const EA_FLOOD_ZONE_2_URL =
  'https://environment.data.gov.uk/arcgis/rest/services/EA/FloodMapForPlanningRiversAndSeaFloodZone2/MapServer/0/query';
const EA_FLOOD_ZONE_3_URL =
  'https://environment.data.gov.uk/arcgis/rest/services/EA/FloodMapForPlanningRiversAndSeaFloodZone3/MapServer/0/query';

async function queryFloodZone(baseUrl: string, lat: number, lng: number): Promise<{ inZone: boolean; featureCount: number }> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'false',
    outFields: '*',
    f: 'json',
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`EA RoFRS returned HTTP ${response.status}`);
  }

  const json = await response.json();
  const features = Array.isArray(json.features) ? json.features : [];
  return { inZone: features.length > 0, featureCount: features.length };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch EA flood zone data for coordinates.
 * Data source: LIVE (EA RoFRS ArcGIS, CORS-enabled), with mock fallback.
 */
export async function fetchFloodZones(coords: Coordinates): Promise<UKDataResponse<FloodZoneData>> {
  const key = cacheKey('flood_zones', coords);

  // Check IndexedDB cache
  const cached = await cacheGet<UKDataResponse<FloodZoneData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  try {
    const [zone2, zone3] = await Promise.all([
      queryFloodZone(EA_FLOOD_ZONE_2_URL, coords.lat, coords.lng),
      queryFloodZone(EA_FLOOD_ZONE_3_URL, coords.lat, coords.lng),
    ]);

    let floodZone: FloodZoneData['floodZone'] = '1';
    let riskLevel: FloodZoneData['riskLevel'] = 'low';

    if (zone3.inZone) {
      floodZone = '3';
      riskLevel = 'high';
    } else if (zone2.inZone) {
      floodZone = '2';
      riskLevel = 'medium';
    }

    const result: UKDataResponse<FloodZoneData> = {
      data: { floodZone, riskLevel },
      source: 'live',
      fetchedAt: now(),
      apiName: 'EA Risk of Flooding from Rivers and Sea (RoFRS)',
      cacheKey: key,
    };

    await cacheSet(key, result, TTL.FLOOD_ZONES);
    return result;
  } catch {
    // Fallback to mock
    const coastDist = distToCoastKm(coords.lat, coords.lng);
    const mockZone: FloodZoneData['floodZone'] = coastDist < 5 ? '3' : '1';
    const mockRisk: FloodZoneData['riskLevel'] = coastDist < 5 ? 'high' : 'low';

    return {
      data: { floodZone: mockZone, riskLevel: mockRisk },
      source: 'mock',
      fetchedAt: now(),
      apiName: 'EA RoFRS (mock fallback)',
      cacheKey: key,
    };
  }
}

/**
 * Fetch EA catchment data.
 * Data source: LIVE (attempted) with mock fallback.
 */
export async function fetchCatchmentData(coords: Coordinates): Promise<UKDataResponse<CatchmentData>> {
  const key = cacheKey('catchment', coords);

  const cached = await cacheGet<UKDataResponse<CatchmentData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  try {
    const url = `https://environment.data.gov.uk/catchment-planning/WaterBody?point=${encodeURIComponent(`${coords.lng} ${coords.lat}`)}&_format=json`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const json = await response.json();
      const bodies = Array.isArray(json) ? json : (json.items ?? []);
      if (bodies.length > 0) {
        const primary = bodies[0];
        const result: UKDataResponse<CatchmentData> = {
          data: {
            catchmentId: primary['@id'] ?? primary.id ?? 'unknown',
            catchmentName: primary.label ?? primary.name ?? 'Unknown water body',
            areaHa: 500, // EA API does not return area; use indicative value
            boundaryGeometry: { type: 'Polygon', coordinates: [] },
          },
          source: 'live',
          fetchedAt: now(),
          apiName: 'EA Catchment Data Explorer',
          cacheKey: key,
        };
        await cacheSet(key, result, TTL.CATCHMENT);
        return result;
      }
    }
  } catch {
    // Fall through to mock
  }

  // Mock fallback
  const catchmentName = isSevernCatchment(coords.lat, coords.lng)
    ? 'River Severn (Middle Severn)'
    : 'Unknown water body (indicative)';

  const result: UKDataResponse<CatchmentData> = {
    data: {
      catchmentId: `mock-${snap(coords.lat)}-${snap(coords.lng)}`,
      catchmentName,
      areaHa: isSevernCatchment(coords.lat, coords.lng) ? 1200 : 500,
      boundaryGeometry: { type: 'Polygon', coordinates: [] },
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'EA Catchment Data Explorer (mock fallback)',
    cacheKey: key,
  };
  await cacheSet(key, result, TTL.CATCHMENT);
  return result;
}

/**
 * Fetch soil data from BGS Soilscapes.
 * Data source: MOCK (BGS requires proxy/registration).
 */
export async function fetchSoilData(coords: Coordinates): Promise<UKDataResponse<SoilData>> {
  const key = cacheKey('soil', coords);

  const cached = await cacheGet<UKDataResponse<SoilData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  const soil = indicativeSoilType(coords.lat, coords.lng);

  const result: UKDataResponse<SoilData> = {
    data: {
      soilType: soil.code,
      permeability: soil.permeability,
      fieldCapacityPct: soil.fieldCapacity,
      description: soil.description,
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'BGS Soilscapes (mock - proxy required)',
    cacheKey: key,
  };

  await cacheSet(key, result, TTL.SOIL);
  return result;
}

/**
 * Fetch elevation data from EA LIDAR.
 * Data source: MOCK (EA LIDAR WCS requires proxy for production).
 */
export async function fetchElevation(coords: Coordinates): Promise<UKDataResponse<ElevationData>> {
  const key = cacheKey('elevation', coords);

  const cached = await cacheGet<UKDataResponse<ElevationData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  // Indicative elevation based on geography
  let elevationM = 50;
  if (isUpland(coords.lat, coords.lng)) elevationM = 350;
  else if (isSEEngland(coords.lat, coords.lng)) elevationM = 80;
  else if (isSevernCatchment(coords.lat, coords.lng)) elevationM = 45;
  else if (distToCoastKm(coords.lat, coords.lng) < 2) elevationM = 5;

  const result: UKDataResponse<ElevationData> = {
    data: {
      elevationM,
      resolution: '2m',
      source: 'EA_LIDAR',
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'EA LIDAR Composite DTM (mock)',
    cacheKey: key,
  };

  await cacheSet(key, result, TTL.ELEVATION);
  return result;
}

/**
 * Fetch tidal data from the nearest NTSLF gauge.
 * Data source: MOCK (NTSLF has no CORS-enabled JSON API).
 */
export async function fetchTidalData(coords: Coordinates): Promise<UKDataResponse<TidalData>> {
  const key = cacheKey('tidal', coords);

  const cached = await cacheGet<UKDataResponse<TidalData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  const station = nearestTideStation(coords.lat, coords.lng);
  const springRange = Math.round((station.mhwsODN - station.mlwsODN) * 10) / 10;

  const result: UKDataResponse<TidalData> = {
    data: {
      stationId: station.id,
      stationName: station.name,
      tidalRangeM: springRange,
      meanHighWaterSpringM: station.mhwsODN,
      latestReadingM: station.mhwsODN * 0.85, // Indicative current reading
      readingTime: now(),
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'NTSLF / BODC (mock - proxy required)',
    cacheKey: key,
  };

  await cacheSet(key, result, TTL.TIDAL);
  return result;
}

/**
 * Fetch bathymetry data.
 * Data source: MOCK (UKHO ADMIRALTY requires commercial licence).
 */
export async function fetchBathymetry(coords: Coordinates): Promise<UKDataResponse<BathymetryData>> {
  const key = cacheKey('bathymetry', coords);

  const cached = await cacheGet<UKDataResponse<BathymetryData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  const coastDist = distToCoastKm(coords.lat, coords.lng);
  // Depth increases with distance from coast (very rough approximation)
  const depthM = coastDist < 1 ? 2 : Math.min(coastDist * 3, 50);

  const result: UKDataResponse<BathymetryData> = {
    data: {
      depthM,
      slopeGradient: 0.02,
      substrateType: depthM < 5 ? 'sand/gravel' : 'muddy sand',
      source: 'UKHO ADMIRALTY (mock)',
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'UKHO ADMIRALTY Marine Data Portal (mock)',
    cacheKey: key,
  };

  await cacheSet(key, result, TTL.BATHYMETRY);
  return result;
}

/**
 * Fetch rainfall and UKCP18 climate data.
 * Data source: MOCK (Met Office UKCP18 requires DataHub API key).
 */
export async function fetchRainfall(coords: Coordinates): Promise<UKDataResponse<{ annualMeanMm: number; rcp45UpliftPct: number; rcp85UpliftPct: number; q100DailyMaxMm: number }>> {
  const key = cacheKey('rainfall', coords);

  type RainfallData = { annualMeanMm: number; rcp45UpliftPct: number; rcp85UpliftPct: number; q100DailyMaxMm: number };
  const cached = await cacheGet<UKDataResponse<RainfallData>>(key);
  if (cached) return { ...cached, source: 'cached' };

  // Location-aware rainfall estimates
  let annualMeanMm = 750;
  let rcp45UpliftPct = 3;
  let rcp85UpliftPct = 8;

  if (isUpland(coords.lat, coords.lng) && coords.lng < -2.5) {
    annualMeanMm = 2100;
    rcp45UpliftPct = 5;
    rcp85UpliftPct = 12;
  } else if (isSevernCatchment(coords.lat, coords.lng)) {
    annualMeanMm = 850;
    rcp45UpliftPct = 4;
    rcp85UpliftPct = 9;
  } else if (isSEEngland(coords.lat, coords.lng)) {
    annualMeanMm = 620;
    rcp45UpliftPct = -2;
    rcp85UpliftPct = -6;
  }

  const result: UKDataResponse<RainfallData> = {
    data: {
      annualMeanMm,
      rcp45UpliftPct,
      rcp85UpliftPct,
      q100DailyMaxMm: Math.round(annualMeanMm * 0.10),
    },
    source: 'mock',
    fetchedAt: now(),
    apiName: 'Met Office UKCP18 (mock - DataHub key required)',
    cacheKey: key,
  };

  await cacheSet(key, result, TTL.RAINFALL);
  return result;
}

/**
 * Detect analysis mode based on distance to coast.
 * Exported for use by modeRouter.
 */
export async function detectMode(coords: Coordinates): Promise<AnalysisMode> {
  const dist = distToCoastKm(coords.lat, coords.lng);
  if (dist < 5) return 'coastal';
  if (dist <= 15) return 'mixed';
  return 'inland';
}
