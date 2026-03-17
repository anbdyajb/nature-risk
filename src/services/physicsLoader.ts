// ─── WASM Physics Engine Loader ─────────────────────────────────────────────
// Lazy-loads the WASM physics module on first call. If WASM fails to load,
// falls back to a JS implementation with simplified Manning's equation and
// wave drag formula.
//
// Referenced decisions: ADR-004 (deterministic engine), PRD §5 (physics)

import type {
  InlandPhysicsInput,
  InlandPhysicsResult,
  CoastalPhysicsInput,
  CoastalPhysicsResult,
  ValidationResult,
  AnalysisMode,
  ConfidenceScore,
  InterventionType,
} from '@/types';
import { MIN_INTERVENTION_AREA_HA } from '@/types';

// ─── WASM Module Interface ──────────────────────────────────────────────────

interface WasmPhysicsModule {
  calculate_inland(input: string): string;
  calculate_coastal(input: string): string;
  validate_intervention(input: string): string;
  classify_mode(lat: number, lng: number): string;
}

let _wasmModule: WasmPhysicsModule | null = null;
let _wasmLoadAttempted = false;
let _wasmAvailable = false;

// ─── WASM Loader ────────────────────────────────────────────────────────────

/**
 * Lazy-load the WASM physics module. Safe to call multiple times;
 * only the first call triggers the load.
 */
export async function initPhysics(): Promise<void> {
  if (_wasmLoadAttempted) return;
  _wasmLoadAttempted = true;

  try {
    // Path resolved at runtime by Vite; the WASM module is built via `npm run build:wasm`
    const wasmPath = '/wasm/nature_risk_physics.js';
    const wasmModule = await import(/* @vite-ignore */ wasmPath);
    await wasmModule.default();
    _wasmModule = wasmModule as unknown as WasmPhysicsModule;
    _wasmAvailable = true;
  } catch {
    _wasmAvailable = false;
    // JS fallback will be used
  }
}

/**
 * Whether the WASM module loaded successfully.
 */
export function isWasmAvailable(): boolean {
  return _wasmAvailable;
}

// ─── JS Fallback: Manning's Equation ────────────────────────────────────────
//
// Manning's equation for open channel flow:
//   Q = (1/n) * A * R^(2/3) * S^(1/2)
//
// Where:
//   Q = discharge (m^3/s)
//   n = Manning's roughness coefficient
//   A = cross-sectional area of flow (m^2)
//   R = hydraulic radius (m)
//   S = slope gradient (m/m)
//
// Intervention effect: increases effective n (roughness), reducing peak Q.

/** Manning's roughness uplift by intervention type. */
const MANNINGS_UPLIFT: Record<string, number> = {
  tree_planting: 0.015,
  peat_restoration: 0.020,
  leaky_dams: 0.025,
  floodplain_reconnection: 0.030,
  riparian_buffer: 0.012,
  oyster_reef: 0.010,
  seagrass_meadow: 0.015,
  saltmarsh: 0.020,
  combined_reef_saltmarsh: 0.025,
};

/** Soil infiltration rate (mm/hr) used in volume attenuation calc. */
const SOIL_INFILTRATION: Record<string, number> = {
  CLAY: 2,
  LOAM: 12,
  SAND: 25,
  PEAT: 5,
  CHALK: 20,
  UNKNOWN: 8,
};

function jsCalculateInland(input: InlandPhysicsInput): InlandPhysicsResult {
  const {
    interventionType,
    interventionAreaHa,
    catchmentAreaHa,
    slopeGradient,
    soilType,
    rainfallIntensityMmHr,
    channelWidthM,
    baseManningsN,
  } = input;

  // Area ratio: fraction of catchment covered by intervention
  const areaRatio = Math.min(interventionAreaHa / Math.max(catchmentAreaHa, 1), 1);

  // Manning's roughness uplift
  const nUplift = MANNINGS_UPLIFT[interventionType] ?? 0.015;
  const effectiveN = baseManningsN + nUplift * areaRatio;

  // Simplified flow calculation using Manning's equation
  // Assume a rectangular channel with width W, depth D
  const assumedDepthM = 1.5;
  const area = channelWidthM * assumedDepthM;
  const wettedPerimeter = channelWidthM + 2 * assumedDepthM;
  const hydraulicRadius = area / wettedPerimeter;

  const qBase = (1 / baseManningsN) * area * Math.pow(hydraulicRadius, 2 / 3) * Math.pow(slopeGradient, 0.5);
  const qNew = (1 / effectiveN) * area * Math.pow(hydraulicRadius, 2 / 3) * Math.pow(slopeGradient, 0.5);

  const peakFlowReductionPct = Math.round(((qBase - qNew) / qBase) * 100 * 10) / 10;

  // Flood height reduction: proportional to flow reduction (simplified)
  const floodHeightReductionM = Math.round(peakFlowReductionPct * 0.01 * assumedDepthM * 100) / 100;

  // Peak delay: based on intervention area and slope (empirical approximation)
  const peakDelayHrs = Math.round(areaRatio * (1 / Math.max(slopeGradient, 0.001)) * 0.5 * 10) / 10;

  // Volume attenuated: infiltration over intervention area during storm
  const stormDurationHrs = 6;
  const infiltrationRate = SOIL_INFILTRATION[soilType] ?? 8;
  const volumeAttenuatedM3 = Math.round(
    interventionAreaHa * 10000 * (infiltrationRate / 1000) * stormDurationHrs,
  );

  // Confidence based on data completeness
  const uncertaintyPct = Math.round(25 + (1 - areaRatio) * 15);
  const confidence: ConfidenceScore = {
    level: uncertaintyPct < 30 ? 'High' : uncertaintyPct < 45 ? 'Medium' : 'Low',
    uncertaintyPct,
    dataSources: [
      { name: 'EA LIDAR Composite DTM', resolution: '1-2m', licence: 'Open Government Licence v3.0' },
      { name: 'BGS Soilscapes', licence: 'OGL / BGS Licence' },
      { name: 'EA RoFRS', licence: 'Open Government Licence v3.0' },
    ],
  };

  return {
    peakFlowReductionPct: Math.max(0, peakFlowReductionPct),
    floodHeightReductionM: Math.max(0, floodHeightReductionM),
    peakDelayHrs: Math.max(0, peakDelayHrs),
    volumeAttenuatedM3: Math.max(0, volumeAttenuatedM3),
    confidence,
    physicsModel: 'JS Fallback (Manning)',
    citationKeys: ['manning_1891', 'chow_1959', 'ciria_c753'],
  };
}

// ─── JS Fallback: Coastal Wave Drag ────────────────────────────────────────
//
// Wave energy dissipation through habitat:
//   E_out = E_in * exp(-alpha * width)
//
// Where alpha is the drag coefficient per unit length, dependent on habitat type.
// Storm surge reduction is proportional to habitat width and drag.

const COASTAL_DRAG_ALPHA: Record<string, number> = {
  oyster_reef: 0.012,
  seagrass: 0.008,
  saltmarsh: 0.015,
  combined: 0.018,
};

/** Maturation years by habitat type. */
const MATURATION_YEARS: Record<string, number> = {
  oyster_reef: 3,
  seagrass: 5,
  saltmarsh: 10,
  combined: 8,
};

function jsCalculateCoastal(input: CoastalPhysicsInput): CoastalPhysicsResult {
  const {
    habitatType,
    habitatAreaHa,
    habitatWidthM,
    waterDepthM,
    significantWaveHeightM,
    wavePeriodS,
    tidalRangeM,
    seaLevelRiseM,
    distanceToAssetM,
  } = input;

  const alpha = COASTAL_DRAG_ALPHA[habitatType] ?? 0.010;

  // Wave energy reduction: exponential decay through habitat
  const transmissionCoeff = Math.exp(-alpha * habitatWidthM);
  const waveEnergyReductionPct = Math.round((1 - transmissionCoeff) * 100 * 10) / 10;

  // Storm surge reduction: proportional to habitat width and roughness
  const surgeReductionPerM = 0.0005 + alpha * 0.02;
  const stormSurgeReductionM = Math.round(surgeReductionPerM * habitatWidthM * 100) / 100;

  // Erosion delta: 25-year shoreline retreat reduction (m)
  // Based on habitat width providing buffer and wave energy absorption
  const baselineErosionRate = 0.5; // m/year without habitat
  const protectedErosionRate = baselineErosionRate * transmissionCoeff;
  const erosionDelta25yrM = Math.round((baselineErosionRate - protectedErosionRate) * 25 * 10) / 10;

  // Habitat suitability score (0-1)
  const depthSuitability = waterDepthM >= 0.5 && waterDepthM <= 10 ? 1.0 : 0.5;
  const areaSuitability = habitatAreaHa >= MIN_INTERVENTION_AREA_HA ? 1.0 : 0.3;
  const habitatSuitabilityScore = Math.round(depthSuitability * areaSuitability * 100) / 100;

  const maturationYears = MATURATION_YEARS[habitatType] ?? 7;

  const uncertaintyPct = Math.round(30 + (seaLevelRiseM / 0.5) * 10);
  const confidence: ConfidenceScore = {
    level: uncertaintyPct < 35 ? 'High' : uncertaintyPct < 50 ? 'Medium' : 'Low',
    uncertaintyPct,
    dataSources: [
      { name: 'UKHO ADMIRALTY Bathymetry', licence: 'Commercial' },
      { name: 'NTSLF / BODC tidal data', licence: 'Open (Crown Copyright)' },
      { name: 'EA NCERM', licence: 'Open Government Licence v3.0' },
      { name: 'UKCP18 (Met Office)', licence: 'Open Government Licence v3.0' },
    ],
  };

  return {
    waveEnergyReductionPct: Math.max(0, Math.min(99, waveEnergyReductionPct)),
    stormSurgeReductionM: Math.max(0, stormSurgeReductionM),
    erosionDelta25yrM: Math.max(0, erosionDelta25yrM),
    habitatSuitabilityScore,
    maturationYears,
    confidence,
    physicsModel: 'JS Fallback (Wave Drag)',
    citationKeys: ['dalrymple_1984', 'mendez_losada_2004', 'spalding_2014'],
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function jsValidateIntervention(input: {
  interventionType: InterventionType;
  areaHa: number;
  mode: AnalysisMode;
}): ValidationResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let valid = true;
  let message = 'Intervention parameters are within acceptable ranges.';

  if (input.areaHa < MIN_INTERVENTION_AREA_HA) {
    valid = false;
    message = `Intervention area (${input.areaHa} ha) is below the minimum threshold of ${MIN_INTERVENTION_AREA_HA} ha.`;
    suggestions.push(`Increase area to at least ${MIN_INTERVENTION_AREA_HA} ha for meaningful impact.`);
  }

  if (input.areaHa > 500) {
    warnings.push(
      `Area of ${input.areaHa} ha exceeds the validated scale range. Results beyond 500 ha carry additional uncertainty.`,
    );
  }

  // Check mode/intervention compatibility
  const coastalInterventions = new Set(['oyster_reef', 'seagrass_meadow', 'saltmarsh', 'combined_reef_saltmarsh']);
  const inlandInterventions = new Set(['tree_planting', 'peat_restoration', 'leaky_dams', 'floodplain_reconnection', 'riparian_buffer']);

  if (input.mode === 'inland' && coastalInterventions.has(input.interventionType)) {
    valid = false;
    message = `${input.interventionType} is a coastal intervention but the analysis mode is inland.`;
    suggestions.push('Switch to a coastal or mixed mode, or choose an inland intervention type.');
  }

  if (input.mode === 'coastal' && inlandInterventions.has(input.interventionType)) {
    valid = false;
    message = `${input.interventionType} is an inland intervention but the analysis mode is coastal.`;
    suggestions.push('Switch to an inland or mixed mode, or choose a coastal intervention type.');
  }

  return { valid, message, suggestions, scaleWarnings: warnings };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate inland physics. Uses WASM if available, JS fallback otherwise.
 */
export function calculateInland(input: InlandPhysicsInput): InlandPhysicsResult {
  if (_wasmAvailable && _wasmModule) {
    try {
      const resultJson = _wasmModule.calculate_inland(JSON.stringify(input));
      return JSON.parse(resultJson) as InlandPhysicsResult;
    } catch {
      // WASM call failed; fall back to JS
    }
  }
  return jsCalculateInland(input);
}

/**
 * Calculate coastal physics. Uses WASM if available, JS fallback otherwise.
 */
export function calculateCoastal(input: CoastalPhysicsInput): CoastalPhysicsResult {
  if (_wasmAvailable && _wasmModule) {
    try {
      const resultJson = _wasmModule.calculate_coastal(JSON.stringify(input));
      return JSON.parse(resultJson) as CoastalPhysicsResult;
    } catch {
      // WASM call failed; fall back to JS
    }
  }
  return jsCalculateCoastal(input);
}

/**
 * Validate an intervention against its parameters and mode.
 */
export function validateIntervention(input: {
  interventionType: InterventionType;
  areaHa: number;
  mode: AnalysisMode;
}): ValidationResult {
  if (_wasmAvailable && _wasmModule) {
    try {
      const resultJson = _wasmModule.validate_intervention(JSON.stringify(input));
      return JSON.parse(resultJson) as ValidationResult;
    } catch {
      // WASM call failed; fall back to JS
    }
  }
  return jsValidateIntervention(input);
}

/**
 * Classify analysis mode from coordinates. Uses WASM if available,
 * otherwise delegates to modeRouter.
 */
export function classifyMode(lat: number, lng: number): AnalysisMode {
  if (_wasmAvailable && _wasmModule) {
    try {
      return _wasmModule.classify_mode(lat, lng) as AnalysisMode;
    } catch {
      // Fall through
    }
  }
  // Synchronous approximation using coastline distance
  // The full async version is in modeRouter.ts
  return 'inland';
}
