# Nature Risk — API Reference

**Version:** 1.0
**Date:** 2026-03-17

---

## Table of Contents

1. [Physics Engine API (WASM)](#1-physics-engine-api-wasm)
2. [Cloudflare Worker API (CORS Proxy)](#2-cloudflare-worker-api-cors-proxy)
3. [Claude Advisory API](#3-claude-advisory-api)
4. [UK Data Service API](#4-uk-data-service-api)
5. [Application Store API](#5-application-store-api)

---

## 1. Physics Engine API (WASM)

The physics engine is a Rust crate compiled to WebAssembly. It exports four pure, deterministic functions. All functions accept a JavaScript object (deserialised via `serde-wasm-bindgen`) and return a JavaScript object.

The WASM module is loaded lazily via `src/services/physicsLoader.ts`, which also provides a JavaScript fallback if WASM fails to load.

---

### `calculateInland(input: InlandPhysicsInput): InlandPhysicsResult`

Calculates inland flood attenuation from a watershed intervention using Manning's equation and a catchment water balance model.

**Input: `InlandPhysicsInput`**

| Field | Type | Description |
|-------|------|-------------|
| `interventionType` | `string` | One of: `"tree_planting"`, `"peat_restoration"`, `"leaky_dams"`, `"floodplain_reconnection"`, `"riparian_buffer"` |
| `interventionAreaHa` | `number` | Area of the proposed intervention in hectares (>= 0.5) |
| `catchmentAreaHa` | `number` | Area of the contributing catchment in hectares |
| `slopeGradient` | `number` | Channel slope gradient (dimensionless, e.g., 0.02 = 2%) |
| `soilType` | `string` | One of: `"CLAY"`, `"LOAM"`, `"SAND"`, `"PEAT"`, `"CHALK"`, `"UNKNOWN"` |
| `rainfallReturnPeriodYears` | `number` | Design storm return period in years (e.g., 100) |
| `rainfallIntensityMmHr` | `number` | Rainfall intensity in mm/hr |
| `channelWidthM` | `number` | River channel width in metres |
| `baseManningsN` | `number` | Baseline Manning's roughness coefficient (e.g., 0.035) |
| `ukcp18Scenario` | `string` | Climate scenario: `"rcp45"` or `"rcp85"` |

**Output: `InlandPhysicsResult`**

| Field | Type | Description |
|-------|------|-------------|
| `peakFlowReductionPct` | `number` | Percentage reduction in peak discharge |
| `floodHeightReductionM` | `number` | Reduction in flood water height at the asset (metres) |
| `peakDelayHrs` | `number` | Additional hours before flood peak arrives |
| `volumeAttenuatedM3` | `number` | Volume of water attenuated by the intervention (cubic metres) |
| `confidence` | `ConfidenceScore` | Composite confidence assessment (see below) |
| `physicsModel` | `string` | Model identifier (e.g., `"Rust WASM (Manning + Green-Ampt)"`) |
| `citationKeys` | `string[]` | Academic citation keys for the models used |

**Example:**

```typescript
import { calculateInland, initPhysics } from '@/services/physicsLoader';

await initPhysics();

const result = calculateInland({
  interventionType: 'tree_planting',
  interventionAreaHa: 25,
  catchmentAreaHa: 500,
  slopeGradient: 0.02,
  soilType: 'CLAY',
  rainfallReturnPeriodYears: 100,
  rainfallIntensityMmHr: 30,
  channelWidthM: 8,
  baseManningsN: 0.035,
  ukcp18Scenario: 'rcp85',
});

console.log(result.peakFlowReductionPct);  // e.g., 12.4
console.log(result.confidence.level);       // "High", "Medium", or "Low"
```

---

### `calculateCoastal(input: CoastalPhysicsInput): CoastalPhysicsResult`

Calculates coastal wave energy and storm surge attenuation through a marine habitat using the Dalrymple et al. (1984) vegetation drag model.

**Input: `CoastalPhysicsInput`**

| Field | Type | Description |
|-------|------|-------------|
| `habitatType` | `string` | One of: `"oyster_reef"`, `"seagrass"`, `"saltmarsh"`, `"combined"` |
| `habitatAreaHa` | `number` | Area of the proposed habitat in hectares (>= 0.5) |
| `habitatWidthM` | `number` | Cross-shore width of the habitat in metres |
| `waterDepthM` | `number` | Mean water depth at the habitat location (metres) |
| `significantWaveHeightM` | `number` | Significant wave height, Hs (metres) |
| `wavePeriodS` | `number` | Peak wave period (seconds) |
| `tidalRangeM` | `number` | Mean spring tidal range (metres) |
| `seaLevelRiseM` | `number` | Projected sea-level rise above present-day (metres) |
| `distanceToAssetM` | `number` | Distance from habitat to the onshore asset (metres) |
| `ukcp18Scenario` | `string` | Climate scenario: `"rcp45"` or `"rcp85"` |

**Output: `CoastalPhysicsResult`**

| Field | Type | Description |
|-------|------|-------------|
| `waveEnergyReductionPct` | `number` | Percentage reduction in wave energy at the asset |
| `stormSurgeReductionM` | `number` | Reduction in storm surge height at the asset (metres) |
| `erosionDelta25yrM` | `number` | Metres of shoreline retreat avoided over 25 years |
| `habitatSuitabilityScore` | `number` | Habitat suitability (0.0–1.0) based on depth and area |
| `maturationYears` | `number` | Estimated years to full habitat maturity |
| `confidence` | `ConfidenceScore` | Composite confidence assessment |
| `physicsModel` | `string` | Model identifier |
| `citationKeys` | `string[]` | Academic citation keys |

**Example:**

```typescript
const result = calculateCoastal({
  habitatType: 'saltmarsh',
  habitatAreaHa: 15,
  habitatWidthM: 200,
  waterDepthM: 2.5,
  significantWaveHeightM: 1.5,
  wavePeriodS: 8,
  tidalRangeM: 4.0,
  seaLevelRiseM: 0.22,
  distanceToAssetM: 500,
  ukcp18Scenario: 'rcp85',
});

console.log(result.waveEnergyReductionPct);  // e.g., 62.3
console.log(result.maturationYears);          // e.g., 10
```

---

### `validateIntervention(input: ValidationInput): ValidationResult`

Validates an intervention's spatial and physical suitability. Checks UK boundary, minimum area, soil suitability (inland), and bathymetric depth (coastal).

**Input: `ValidationInput`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `interventionType` | `string \| null` | One of | Inland intervention type (provide for inland) |
| `habitatType` | `string \| null` | One of | Coastal habitat type (provide for coastal) |
| `areaHa` | `number` | Yes | Intervention area in hectares |
| `lat` | `number` | Yes | WGS-84 latitude |
| `lng` | `number` | Yes | WGS-84 longitude |
| `soilType` | `string \| null` | No | Soil type (improves inland validation accuracy) |
| `waterDepthM` | `number \| null` | No | Water depth (improves coastal validation accuracy) |

At least one of `interventionType` or `habitatType` must be provided.

**Output: `ValidationResult`**

| Field | Type | Description |
|-------|------|-------------|
| `valid` | `boolean` | `true` if the intervention passes all checks |
| `message` | `string` | Human-readable validation message (error details if invalid) |
| `suggestions` | `string[]` | Alternative intervention suggestions (e.g., "Consider tree planting for this geology") |
| `scaleWarnings` | `string[]` | Soft warnings about undersized interventions |

**Validation Rules:**

| Check | Hard Fail | Soft Warning |
|-------|-----------|-------------|
| UK boundary (lat 49.8–60.9, lng -8.2 to 2.0) | Yes | — |
| Minimum area (< 0.5 ha) | Yes | — |
| Recommended area (0.5–2.0 ha) | — | Yes |
| Peat restoration on chalk/limestone | Yes | — |
| Peat restoration on sandy loam | — | Yes |
| Coastal habitat below minimum depth | Yes | — |
| No intervention or habitat type specified | Yes | — |

---

### `classifyMode(lat: number, lng: number): string`

Classifies the analysis mode based on coordinates. Returns `"inland"`, `"coastal"`, or `"mixed"`.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lat` | `number` | WGS-84 latitude |
| `lng` | `number` | WGS-84 longitude |

**Returns:** `string` — one of `"inland"`, `"coastal"`, or `"mixed"`.

The WASM implementation uses a simplified heuristic based on proximity to UK coastal boundaries. The full asynchronous mode router in `src/services/modeRouter.ts` supplements this with EA flood zone data for more accurate classification.

---

### Shared Types

**`ConfidenceScore`**

| Field | Type | Description |
|-------|------|-------------|
| `level` | `string` | `"High"`, `"Medium"`, or `"Low"` |
| `uncertaintyPct` | `number` | Uncertainty percentage (e.g., 25 means +/- 25%) |
| `dataSources` | `DataSourceCitation[]` | List of data sources used |

**`DataSourceCitation`**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Name of the data source (e.g., "EA LIDAR Composite DTM") |
| `resolution` | `string \| undefined` | Spatial resolution (e.g., "1-2m") |
| `lastUpdated` | `string \| undefined` | ISO 8601 date of last update |
| `licence` | `string` | Licence type (e.g., "Open Government Licence v3.0") |
| `url` | `string \| undefined` | URL to the data source |

---

## 2. Cloudflare Worker API (CORS Proxy)

The Cloudflare Worker at `https://nature-risk-proxy.<account>.workers.dev/` proxies requests to UK government data APIs and the Anthropic Claude API, injecting API keys from Worker secrets.

### Health Check

```
GET /health
GET /
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T10:30:00.000Z"
}
```

### Route Map

| Route Prefix | Upstream API | Authentication |
|-------------|-------------|----------------|
| `/api/ea/*` | `https://environment.data.gov.uk/` | None (open data) |
| `/api/os/*` | `https://api.os.uk/` | OS Data Hub API key (query parameter `key`) |
| `/api/bgs/*` | `https://www.bgs.ac.uk/` | None (open data) |
| `/api/met/*` | `https://data.hub.api.metoffice.gov.uk/` | Met Office API key (header `apikey`) |
| `/api/ukho/*` | `https://datahub.admiralty.co.uk/` | UKHO key (header `Ocp-Apim-Subscription-Key`) |
| `/api/ntslf/*` | `https://www.ntslf.org/` | None (open data) |
| `/api/claude/*` | `https://api.anthropic.com/v1/` | Anthropic API key (header `x-api-key`) |

### Request Format

The proxy transparently forwards all request methods (GET, POST, PUT, DELETE), query parameters, and safe headers (`Content-Type`, `Accept`, `Accept-Language`, `anthropic-version`).

**Example — Fetch EA Flood Zones:**

```bash
curl 'https://nature-risk-proxy.example.workers.dev/api/ea/arcgis/rest/services/EA/FloodMapForPlanningRiversAndSeaFloodZone3/MapServer/0/query?geometry=-2.0,52.0&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&outFields=*&f=json'
```

**Example — Call Claude API:**

```bash
curl -X POST 'https://nature-risk-proxy.example.workers.dev/api/claude/messages' \
  -H 'Content-Type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 1500,
    "system": "...",
    "messages": [{"role": "user", "content": "..."}]
  }'
```

### Rate Limiting

- **Limit:** 100 requests per minute per client IP
- **Window:** Sliding 60-second window
- **Response on exceeding:** HTTP 429

```json
{
  "error": "Rate limit exceeded — 100 requests per minute",
  "status": 429
}
```

### Request Size Limit

POST and PUT requests are limited to **1 MB** body size. Requests exceeding this limit receive HTTP 413:

```json
{
  "error": "Request body exceeds 1 MB limit",
  "status": 413
}
```

### Error Responses

All error responses use a consistent JSON format:

```json
{
  "error": "Human-readable error message",
  "status": 404
}
```

| Status | Meaning |
|--------|---------|
| 400 | Missing `Content-Type` header on POST/PUT |
| 403 | Origin not in allowed origins list |
| 404 | No route matched for the request path |
| 413 | Request body exceeds 1 MB |
| 429 | Rate limit exceeded |
| 502 | Upstream API error (the proxied API returned an error or was unreachable) |

### CORS Headers

All responses include CORS headers:

```
Access-Control-Allow-Origin: <requesting origin or configured default>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-api-key, anthropic-version
Access-Control-Max-Age: 86400
Vary: Origin
```

Allowed origins:
- The configured `ALLOWED_ORIGIN` (default: `https://jjohare.github.io`)
- `http://localhost:3000` (local development)
- `http://localhost:5173` (Vite dev server)

### Caching

GET responses from data APIs (excluding `/api/claude/*`) include a default `Cache-Control: public, max-age=3600` header if the upstream does not set one.

### Worker Secrets

| Secret | Purpose |
|--------|---------|
| `OS_DATA_HUB_KEY` | Ordnance Survey Data Hub API key |
| `MET_OFFICE_KEY` | Met Office Weather DataHub API key |
| `UKHO_KEY` | UKHO ADMIRALTY subscription key |
| `ANTHROPIC_KEY` | Anthropic Claude API key |

Set via `wrangler secret put <SECRET_NAME>`.

---

## 3. Claude Advisory API

The advisory service (`src/services/advisor.ts`) handles communication with the Claude API for narrative synthesis.

### System Prompt (Summary)

The Claude system prompt enforces the following rules:

1. **No numerical computation.** All numbers come from the physics engine only.
2. **No fabrication** of geospatial, topographical, or bathymetric data.
3. **Mandatory citations** for every factual claim: `[Source: {name}]`.
4. **Mandatory disclaimer** at the end of every response.
5. **No regulated financial advice**, insurance premium guarantees, or carbon credit certification.
6. **No claims of suitability** for planning submissions or regulatory filings.

### Request Format

The `analyse()` function accepts:

```typescript
interface AnalyseParams {
  mode: 'inland' | 'coastal' | 'mixed';
  userIntent: 'asset_manager' | 'project_developer';
  interventionType: string;
  interventionAreaHa: number;
  assetDescription: string;
  physicsResult: PhysicsResult;  // From the WASM engine
  coordinates: { lat: number; lng: number };
  userMessage?: string;
}
```

### Response JSON Schema

Claude is instructed to return valid JSON matching:

```typescript
interface AdvisoryResult {
  narrative: string;               // Full markdown narrative for the chat pane
  spatialValidation: {
    valid: boolean;
    message: string;               // Plain-English validation message
    suggestions: string[];         // Alternative intervention suggestions
  };
  scaleWarnings: string[];         // Warnings about undersized interventions
  confidenceSummary: string;       // One-sentence confidence summary
  disclaimer: string;              // The standard disclaimer text
}
```

### Demo Mode Behaviour

When no API key or proxy URL is configured, the advisor service generates a **deterministic demo response** locally (no API call is made). The demo response:

- Uses the actual physics engine results to populate the narrative
- Includes a `"Demo Mode Active"` banner at the top
- Follows the same JSON schema as a live response
- Includes the same data provenance table and citations (using known data sources)
- Is tagged with `rawResponse: "[Demo mode -- no live API call made]"`

The demo response is functionally identical to a live response, except the narrative is template-generated rather than AI-generated.

### Error Handling

| Error | Behaviour |
|-------|----------|
| Network error | Falls back to demo mode with warning |
| HTTP 429 (rate limited) | Returns error message; does not fall back |
| HTTP 401 (unauthorised) | Returns error message; does not fall back |
| Other HTTP errors | Falls back to demo mode with warning |
| Malformed JSON response | Uses raw text as narrative |

### Configuration

```typescript
import { configure, isConfigured, getStatus } from '@/services/advisor';

// Set API key and proxy URL
configure({
  apiKey: 'sk-ant-...',
  proxyUrl: 'https://nature-risk-proxy.example.workers.dev/api/claude/messages',
});

// Check status
getStatus();
// { configured: true, mode: 'live' }
```

API keys are stored in `sessionStorage` (tab-scoped, cleared on tab close).

---

## 4. UK Data Service API

The UK data service (`src/services/ukData.ts`) provides typed functions for fetching environmental data from UK government sources.

### Common Types

All data fetchers return a `UKDataResponse<T>` wrapper:

```typescript
interface UKDataResponse<T> {
  data: T;                    // The fetched data
  source: 'live' | 'cached' | 'mock';  // Data provenance
  fetchedAt: string;          // ISO 8601 timestamp
  apiName: string;            // Human-readable API name
  cacheKey: string;           // IndexedDB cache key
}
```

### `fetchFloodZones(coords)`

Queries EA Risk of Flooding from Rivers and Sea (RoFRS) via the ArcGIS REST API. **CORS-enabled — calls the API directly.**

```typescript
function fetchFloodZones(coords: Coordinates): Promise<UKDataResponse<FloodZoneData>>
```

```typescript
interface FloodZoneData {
  floodZone: '1' | '2' | '3' | '3b';
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  geometry?: GeoJSONPolygon;
}
```

Cache TTL: 24 hours.

### `fetchCatchmentData(coords)`

Queries EA Catchment Data Explorer. Falls back to location-aware mock data.

```typescript
function fetchCatchmentData(coords: Coordinates): Promise<UKDataResponse<CatchmentData>>
```

```typescript
interface CatchmentData {
  catchmentId: string;
  catchmentName: string;
  areaHa: number;
  boundaryGeometry: GeoJSONPolygon;
}
```

Cache TTL: 24 hours.

### `fetchSoilData(coords)`

Returns soil classification data. Currently uses location-aware indicative values (BGS Soilscapes requires proxy).

```typescript
function fetchSoilData(coords: Coordinates): Promise<UKDataResponse<SoilData>>
```

```typescript
interface SoilData {
  soilType: 'CLAY' | 'LOAM' | 'SAND' | 'PEAT' | 'CHALK' | 'UNKNOWN';
  permeability: 'low' | 'moderate' | 'high';
  fieldCapacityPct: number;
  description: string;
}
```

Cache TTL: 7 days.

### `fetchElevation(coords)`

Returns elevation data. Currently uses location-aware indicative values (EA LIDAR WCS requires proxy).

```typescript
function fetchElevation(coords: Coordinates): Promise<UKDataResponse<ElevationData>>
```

```typescript
interface ElevationData {
  elevationM: number;
  resolution: '1m' | '2m' | '5m' | '50m';
  source: 'EA_LIDAR' | 'OS_TERRAIN_5' | 'OS_TERRAIN_50';
}
```

Cache TTL: 7 days.

### `fetchTidalData(coords)`

Returns tidal data from the nearest NTSLF gauge. Currently uses an embedded station lookup.

```typescript
function fetchTidalData(coords: Coordinates): Promise<UKDataResponse<TidalData>>
```

```typescript
interface TidalData {
  stationId: string;
  stationName: string;
  tidalRangeM: number;
  meanHighWaterSpringM: number;
  latestReadingM: number;
  readingTime: string;
}
```

Cache TTL: 5 minutes.

### `fetchBathymetry(coords)`

Returns bathymetry data. Currently uses indicative depth calculations (UKHO ADMIRALTY requires commercial licence).

```typescript
function fetchBathymetry(coords: Coordinates): Promise<UKDataResponse<BathymetryData>>
```

```typescript
interface BathymetryData {
  depthM: number;
  slopeGradient: number;
  substrateType: string;
  source: string;
}
```

Cache TTL: 7 days.

### `fetchRainfall(coords)`

Returns rainfall and UKCP18 climate projection data. Currently uses location-aware indicative values.

```typescript
function fetchRainfall(coords: Coordinates): Promise<UKDataResponse<RainfallData>>
```

```typescript
interface RainfallData {
  annualMeanMm: number;
  rcp45UpliftPct: number;
  rcp85UpliftPct: number;
  q100DailyMaxMm: number;
}
```

Cache TTL: 7 days.

### `detectMode(coords)`

Determines analysis mode based on distance to coast (separate from the WASM `classifyMode`).

```typescript
function detectMode(coords: Coordinates): Promise<'inland' | 'coastal' | 'mixed'>
```

### `distToCoastKm(lat, lng)`

Utility function returning the haversine distance in kilometres from any point to the nearest sampled UK coastline point.

```typescript
function distToCoastKm(lat: number, lng: number): number
```

---

## 5. Application Store API

The Zustand store (`src/store/index.ts`) exposes actions and selectors for managing application state.

### Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `placeAssetPin(pin)` | `AssetPin` | Places an asset pin on the map; emits `AssetPinPlaced` event |
| `drawInterventionPolygon(polygon)` | `InterventionPolygon` | Records drawn polygon; emits `InterventionPolygonDrawn` event |
| `setMode(mode)` | `AnalysisMode` | Sets analysis mode; emits `ModeClassified` event |
| `setUserIntent(intent)` | `UserIntent` | Sets user intent (`asset_manager` or `project_developer`) |
| `runAnalysis()` | — | Executes the full analysis pipeline (async) |
| `configureAdvisor(apiKey?, proxyUrl?)` | Strings | Configures live/demo mode |
| `resetAnalysis()` | — | Clears analysis results; emits `AnalysisReset` event |
| `setViewport(v)` | `Viewport` | Updates map viewport |
| `toggleLayer(layer)` | `MapLayer` | Toggles a map layer on/off |
| `appendMessage(msg)` | `ChatMessage` | Appends a message to chat history |

### Selectors

| Selector | Returns | Description |
|----------|---------|-------------|
| `selectIsAnalysisRunning(state)` | `boolean` | `true` if analysis is in progress |
| `selectCanRunAnalysis(state)` | `boolean` | `true` if both pin and polygon are placed and analysis is idle |
| `selectLatestAdvisory(state)` | `AdvisoryResult \| null` | The most recent advisory result |
| `selectEventCount(state)` | `number` | Total number of domain events in the log |

---

*For user documentation, see the [User Guide](user-guide.md). For deployment instructions, see the [Deployment Guide](deployment-guide.md). For architecture context, see the [Architecture Overview](architecture-overview.md).*
