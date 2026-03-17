// ─── Nature Risk — DDD Domain Types ──────────────────────────────────────────
// Canonical type definitions. All modules import from here.
// Aligned with docs/ddd/domain-model.md ubiquitous language.

// ─── Spatial Primitives ──────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  sw: Coordinates;
  ne: Coordinates;
}

export type GeoJSONPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GeoJSONPoint = {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
};

// ─── Core Domain ─────────────────────────────────────────────────────────────

export type AssetType =
  | 'factory'
  | 'substation'
  | 'data_centre'
  | 'port'
  | 'road_junction'
  | 'sea_wall'
  | 'coastal_road'
  | 'building'
  | 'other';

export interface Asset {
  id: string;
  type: AssetType;
  label: string;
  location: Coordinates;
  description: string;
}

export interface AssetPin {
  location: Coordinates;
  asset: Asset;
  placedAt: string; // ISO 8601
}

export type InterventionType =
  | 'tree_planting'
  | 'peat_restoration'
  | 'leaky_dams'
  | 'floodplain_reconnection'
  | 'riparian_buffer'
  | 'oyster_reef'
  | 'seagrass_meadow'
  | 'saltmarsh'
  | 'combined_reef_saltmarsh';

export interface InterventionPolygon {
  id: string;
  geometry: GeoJSONPolygon;
  interventionType: InterventionType;
  areaHa: number;
  drawnAt: string; // ISO 8601
}

// ─── Analysis Mode ───────────────────────────────────────────────────────────

export type AnalysisMode = 'inland' | 'coastal' | 'mixed';
export type UserIntent = 'asset_manager' | 'project_developer';

export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface ConfidenceScore {
  level: ConfidenceLevel;
  uncertaintyPct: number;
  dataSources: DataSourceCitation[];
}

export interface DataSourceCitation {
  name: string;
  resolution?: string;
  lastUpdated?: string;
  licence: string;
  url?: string;
}

// ─── Physics Engine Results ──────────────────────────────────────────────────

export type SoilType = 'CLAY' | 'LOAM' | 'SAND' | 'PEAT' | 'CHALK' | 'UNKNOWN';

export interface InlandPhysicsInput {
  interventionType: InterventionType;
  interventionAreaHa: number;
  catchmentAreaHa: number;
  slopeGradient: number;
  soilType: SoilType;
  rainfallReturnPeriodYears: number;
  rainfallIntensityMmHr: number;
  channelWidthM: number;
  baseManningsN: number;
  ukcp18Scenario: 'rcp45' | 'rcp85';
}

export interface InlandPhysicsResult {
  peakFlowReductionPct: number;
  floodHeightReductionM: number;
  peakDelayHrs: number;
  volumeAttenuatedM3: number;
  confidence: ConfidenceScore;
  physicsModel: string;
  citationKeys: string[];
}

export type CoastalHabitatType = 'oyster_reef' | 'seagrass' | 'saltmarsh' | 'combined';

export interface CoastalPhysicsInput {
  habitatType: CoastalHabitatType;
  habitatAreaHa: number;
  habitatWidthM: number;
  waterDepthM: number;
  significantWaveHeightM: number;
  wavePeriodS: number;
  tidalRangeM: number;
  seaLevelRiseM: number;
  distanceToAssetM: number;
  ukcp18Scenario: 'rcp45' | 'rcp85';
}

export interface CoastalPhysicsResult {
  waveEnergyReductionPct: number;
  stormSurgeReductionM: number;
  erosionDelta25yrM: number;
  habitatSuitabilityScore: number;
  maturationYears: number;
  confidence: ConfidenceScore;
  physicsModel: string;
  citationKeys: string[];
}

export type PhysicsResult = InlandPhysicsResult | CoastalPhysicsResult;

export interface ValidationResult {
  valid: boolean;
  message: string;
  suggestions: string[];
  scaleWarnings: string[];
}

// ─── UK Data Layer ───────────────────────────────────────────────────────────

export type DataSource = 'live' | 'cached' | 'mock';

export interface UKDataResponse<T> {
  data: T;
  source: DataSource;
  fetchedAt: string;
  apiName: string;
  cacheKey: string;
}

export interface FloodZoneData {
  floodZone: '1' | '2' | '3' | '3b';
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  geometry?: GeoJSONPolygon;
}

export interface CatchmentData {
  catchmentId: string;
  catchmentName: string;
  areaHa: number;
  boundaryGeometry: GeoJSONPolygon;
}

export interface SoilData {
  soilType: SoilType;
  permeability: 'low' | 'moderate' | 'high';
  fieldCapacityPct: number;
  description: string;
}

export interface ElevationData {
  elevationM: number;
  resolution: '1m' | '2m' | '5m' | '50m';
  source: 'EA_LIDAR' | 'OS_TERRAIN_5' | 'OS_TERRAIN_50';
}

export interface TidalData {
  stationId: string;
  stationName: string;
  tidalRangeM: number;
  meanHighWaterSpringM: number;
  latestReadingM: number;
  readingTime: string;
}

export interface BathymetryData {
  depthM: number;
  slopeGradient: number;
  substrateType: string;
  source: string;
}

// ─── Advisory Layer ──────────────────────────────────────────────────────────

export interface AdvisoryResult {
  narrative: string;
  spatialValidation: {
    valid: boolean;
    message: string;
    suggestions: string[];
  };
  scaleWarnings: string[];
  confidenceSummary: string;
  disclaimer: string;
  rawResponse?: string;
}

export type AdvisorMode = 'live' | 'demo';

// ─── Application State (Zustand) ────────────────────────────────────────────

export type AnalysisStep =
  | 'idle'
  | 'validating_input'
  | 'classifying_mode'
  | 'fetching_data'
  | 'running_physics'
  | 'synthesising_advisory'
  | 'complete'
  | 'error';

export interface ActionStreamEntry {
  id: string;
  label: string;
  status: 'running' | 'done' | 'error';
  startedAt: string;
  completedAt?: string;
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  physicsResult?: PhysicsResult;
  advisoryResult?: AdvisoryResult;
}

export interface OpportunityZone {
  id: string;
  rank: number;
  interventionType: InterventionType;
  geometry: GeoJSONPolygon;
  predictedImpact: PhysicsResult;
  label: string;
}

// ─── Domain Events (Event Sourcing) ──────────────────────────────────────────

export interface DomainEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  causationId?: string;
}

export type DomainEventType =
  | 'AssetPinPlaced'
  | 'InterventionPolygonDrawn'
  | 'ModeClassified'
  | 'DataFetched'
  | 'PhysicsCalculated'
  | 'AdvisorySynthesised'
  | 'ScenarioChanged'
  | 'InterventionTypeChanged'
  | 'ReportExported'
  | 'AnalysisReset';

// ─── Map State ───────────────────────────────────────────────────────────────

export interface Viewport {
  center: Coordinates;
  zoom: number;
  bearing: number;
  pitch: number;
}

export type MapLayer =
  | 'flood_zones'
  | 'catchment_boundary'
  | 'flow_network'
  | 'opportunity_zones'
  | 'bathymetry'
  | 'wave_direction'
  | 'erosion_risk'
  | 'intervention'
  | 'asset';

// ─── Report / Export ─────────────────────────────────────────────────────────

export interface ReportMetadata {
  generatedAt: string;
  mode: AnalysisMode;
  userIntent: UserIntent;
  assetLabel: string;
  interventionType: InterventionType;
  eventLog: DomainEvent[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DISCLAIMER_TEXT =
  'These results are proxy models for directional pre-feasibility assessment only. ' +
  'They are not a substitute for a certified Flood Risk Assessment (FRA), structural ' +
  'engineering survey, regulated environmental impact assessment, or any other statutory ' +
  'process. Do not rely on these outputs for planning decisions, insurance, or regulatory ' +
  'submissions without independent professional verification.';

export const MIN_INTERVENTION_AREA_HA = 0.5;

export const UK_BOUNDS: BoundingBox = {
  sw: { lat: 49.8, lng: -8.2 },
  ne: { lat: 60.9, lng: 2.0 },
};

export const MHWS_BUFFER_KM = 5;
