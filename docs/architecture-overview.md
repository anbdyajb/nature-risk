# Nature Risk — Architecture Overview

**Version:** 1.0
**Date:** 2026-03-17

---

## Table of Contents

1. [System Diagram](#1-system-diagram)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Data Flow](#3-data-flow)
4. [Technology Choices](#4-technology-choices)
5. [Security Model](#5-security-model)
6. [Performance Characteristics](#6-performance-characteristics)

---

## 1. System Diagram

```
                            ┌─────────────────────────────────────────────┐
                            │         User's Browser                       │
                            │                                              │
                            │  ┌────────────────────────────────────────┐  │
                            │  │         React SPA (Vite)                │  │
                            │  │                                         │  │
                            │  │  ┌──────────┐    ┌───────────────────┐ │  │
                            │  │  │ Co-Pilot  │    │  MapLibre GL JS   │ │  │
                            │  │  │ Pane      │◄──►│  (GIS Map)        │ │  │
                            │  │  │           │    │  - Draw tools     │ │  │
                            │  │  │ - Chat    │    │  - Pin drop       │ │  │
                            │  │  │ - Action  │    │  - Layer overlays │ │  │
                            │  │  │   Stream  │    │  - Delta renders  │ │  │
                            │  │  │ - Widgets │    │                   │ │  │
                            │  │  │ - Export  │    │                   │ │  │
                            │  │  └─────┬─────┘    └───────────────────┘ │  │
                            │  │        │                                 │  │
                            │  │  ┌─────▼─────────────────────────────┐  │  │
                            │  │  │   Zustand Store                    │  │  │
                            │  │  │   + immer (immutable updates)      │  │  │
                            │  │  │   + zundo (undo/redo)              │  │  │
                            │  │  │   + event sourcing (audit log)     │  │  │
                            │  │  └─────┬─────────────────────────────┘  │  │
                            │  │        │                                 │  │
                            │  │  ┌─────▼──────────┐  ┌───────────────┐ │  │
                            │  │  │ WASM Physics    │  │ PDF Generator │ │  │
                            │  │  │ Engine (Rust)   │  │ (jsPDF +      │ │  │
                            │  │  │                 │  │  html2canvas)  │ │  │
                            │  │  │ - Inland hydro  │  └───────────────┘ │  │
                            │  │  │ - Coastal wave  │                    │  │
                            │  │  │ - Validation    │                    │  │
                            │  │  │ - Mode classify │                    │  │
                            │  │  └─────────────────┘                    │  │
                            │  └────────────────────────────────────────┘  │
                            └────────────┬────────────────────────────────┘
                                         │ HTTPS
                                         ▼
                            ┌─────────────────────────────────────────────┐
                            │  Cloudflare Worker (Edge CORS Proxy)         │
                            │                                              │
                            │  - Route matching (/api/ea/*, /api/os/*, …) │
                            │  - API key injection from Worker secrets     │
                            │  - Rate limiting (100 req/min per IP)        │
                            │  - CORS header injection                     │
                            │  - Zero persistent state                     │
                            └──────┬──────────┬───────────┬───────────────┘
                                   │          │           │
                    ┌──────────────┘    ┌─────┘     ┌─────┘
                    ▼                   ▼           ▼
   ┌──────────────────────┐  ┌─────────────┐  ┌──────────────────┐
   │  UK Government APIs   │  │  Anthropic   │  │  MapTiler        │
   │                       │  │  Claude API  │  │  (Tile Server)   │
   │  - EA LIDAR / RoFRS  │  │              │  │                  │
   │  - OS Data Hub       │  │  Advisory    │  │  Raster/vector   │
   │  - BGS Soilscapes    │  │  synthesis   │  │  map tiles       │
   │  - Met Office / UKCP │  │  only —      │  │  (direct from    │
   │  - UKHO ADMIRALTY    │  │  no maths    │  │   browser)       │
   │  - NTSLF / BODC     │  │              │  │                  │
   │  - Cefas / EA NCERM  │  │              │  │                  │
   └──────────────────────┘  └─────────────┘  └──────────────────┘
```

---

## 2. Bounded Contexts

The system is organised into five bounded contexts, following Domain-Driven Design (DDD). The full domain model is documented in [docs/ddd/domain-model.md](ddd/domain-model.md).

### 2a. Geospatial Context

**Responsibility:** Coordinate system management, raw spatial data ingestion, terrain analysis, catchment delineation, flow path computation, and bathymetry processing.

**Key services:** `CatchmentTracer`, `FlowPathValidator`, `LIDARDataFetcher`, `BathymetryFetcher`, `CoordinateTransformer`

**External APIs:** EA LIDAR, OS Data Hub, UKHO ADMIRALTY

**Implementation:** `src/services/ukData.ts` (data fetchers), `src/services/modeRouter.ts` (mode classification)

### 2b. Hydrological Context

**Responsibility:** All inland flood risk calculations. Applies physics-based hydrological modelling (Manning's equation, Green-Ampt infiltration, catchment water balance) to compute peak flow attenuation, flood height reduction, and water retention changes.

**Key services:** `HydrologicalSimulator`, `InterventionScorer`

**External APIs:** BGS Soilscapes, UKCEH Land Cover, EA RoFRS, Met Office / UKCP18

**Implementation:** `physics-engine/src/inland.rs` (Rust/WASM), `src/services/physicsLoader.ts` (JS fallback)

### 2c. Marine Context

**Responsibility:** All coastal risk calculations. Applies coastal physics (Dalrymple vegetation drag, JONSWAP spectrum modification) to compute wave energy reduction, storm surge reduction, and erosion rate changes.

**Key services:** `WaveAttenuationCalculator`, `ErosionPredictor`

**External APIs:** Cefas Saltmarsh Extents, NTSLF tidal network, Met Office Coastal Models, EA NCERM, UKCP18

**Implementation:** `physics-engine/src/coastal.rs` (Rust/WASM), `src/services/physicsLoader.ts` (JS fallback)

### 2d. Advisory Context

**Responsibility:** Natural-language synthesis of physics results. Takes deterministic numbers from the Hydrological or Marine context and produces a plain-English narrative with citations, confidence summaries, and disclaimers.

**Key constraints:**
- The LLM never computes, estimates, or modifies numerical values
- The LLM never fabricates geospatial data
- Every claim is cited to a primary data source
- The mandatory disclaimer is included in every response

**Implementation:** `src/services/advisor.ts`

### 2e. Reporting Context

**Responsibility:** Client-side PDF generation. Assembles physics results, advisory narrative, map snapshots, data provenance, event log, and disclaimers into a structured pre-feasibility report.

**Implementation:** `src/services/pdfGenerator.ts`, `src/components/Export/PdfExport.tsx`

### Context Map

```
  Geospatial ──────► Hydrological ──────► Advisory ──────► Reporting
       │                                      ▲                 ▲
       └──────────► Marine ───────────────────┘                 │
                                                                 │
       Store (event sourcing) ──────────────────────────────────┘
```

- Geospatial is the upstream context: all other contexts depend on it.
- Hydrological and Marine are independent; both consume Geospatial and publish results to Advisory.
- Advisory consumes physics results and produces narrative.
- Reporting consumes all contexts to assemble the PDF.
- The Zustand store with event-sourcing middleware provides the backbone connecting all contexts.

---

## 3. Data Flow

The following describes the complete data flow from user input to rendered output.

### Step-by-Step Sequence

```
1. USER INPUT
   User places AssetPin (coordinates) and draws InterventionPolygon
   (GeoJSON polygon with intervention type)
       │
       ▼
2. INPUT VALIDATION (client-side TypeScript)
   - UK boundary check (lat 49.8-60.9, lng -8.2 to 2.0)
   - Minimum polygon area (>= 0.5 ha)
   - Required fields present
       │
       ▼
3. MODE ROUTING (src/services/modeRouter.ts)
   Classifies as Inland, Coastal, or Mixed based on:
   - Haversine distance to nearest coastline sample point
   - EA Tidal Flood Zone 3 check (async)
   - Coastal bounding box check
       │
       ▼
4. DATA FETCH (src/services/ukData.ts)
   Parallel queries to UK data APIs via Cloudflare Worker:
   ┌─────────────────────────────────────────────────────┐
   │  Inland:                    Coastal:                 │
   │  - EA Flood Zones (live)   - UKHO Bathymetry (mock) │
   │  - EA Catchment (live)     - NTSLF Tidal (mock)     │
   │  - BGS Soilscapes (mock)   - Met Office Wave (mock) │
   │  - EA LIDAR (mock)         - EA NCERM (mock)        │
   │  - Met Office Rain (mock)                            │
   └─────────────────────────────────────────────────────┘
   Results cached in IndexedDB with TTL per source.
   "mock" sources use location-aware indicative values.
   "live" sources call the real API (CORS-enabled or via proxy).
       │
       ▼
5. PHYSICS ENGINE (physics-engine/src/ → WASM)
   Deterministic calculation — no randomness, no I/O:
   - Inland: Manning's equation → peak flow reduction, flood height
     delta, peak delay, volume attenuated
   - Coastal: Dalrymple drag → wave energy reduction, storm surge
     reduction, erosion delta, habitat suitability
   Returns typed result with confidence score and citations.
       │
       ▼
6. ADVISORY SYNTHESIS (src/services/advisor.ts → Claude API)
   Claude receives: physics results + data citations + user context
   Claude produces: narrative + spatial validation + scale warnings
   + confidence summary + disclaimer
   Falls back to deterministic demo template if API unavailable.
       │
       ▼
7. RENDERING
   - Zustand store updated with results
   - MapLibre GL layers: catchment, flow paths, opportunity zones,
     bathymetry, wave arrows, risk delta overlays
   - Co-Pilot pane: narrative, widgets (Risk Delta dial, Hydrograph,
     Confidence Badge, Uncertainty Range)
   - Action Stream collapses to summary
       │
       ▼
8. EXPORT (optional)
   Client-side PDF via jsPDF + html2canvas
   Includes: all outputs, map snapshots, citations, audit trail,
   disclaimers, pre-feasibility summary
```

### Event Sourcing

Every significant state transition in the pipeline emits a `DomainEvent`:

```
AssetPinPlaced → ModeClassified → DataFetched → PhysicsCalculated → AdvisorySynthesised
```

Each event carries:
- A unique ID (UUID v4)
- A timestamp (ISO 8601)
- A causation ID (linking events in the same chain)
- A typed payload

The event log is append-only, included in PDF exports, and available for audit.

---

## 4. Technology Choices

Each technology choice is documented as an Architecture Decision Record (ADR) in [docs/adr/](adr/).

| Component | Technology | Rationale | ADR |
|-----------|-----------|-----------|-----|
| **Hosting** | GitHub Pages | Zero cost, no server to maintain, maximum auditability, version-controlled deployments | [ADR-001](adr/ADR-001-static-site-architecture.md) |
| **Mapping** | MapLibre GL JS | Open-source (BSD), no token required for base tiles, compatible with Mapbox GL ecosystem (`@mapbox/mapbox-gl-draw`), WebGL rendering for large datasets | [ADR-002](adr/ADR-002-mapping-library.md) |
| **Data proxy** | Cloudflare Workers | Zero cold start (V8 isolates), global edge network, generous free tier (100K req/day), Worker secrets for API keys | [ADR-003](adr/ADR-003-uk-data-api-strategy.md) |
| **Physics engine** | Rust → WebAssembly | Determinism guarantee (no floating-point non-determinism when targeting wasm32), strong type system, near-native performance, reproducible builds | [ADR-004](adr/ADR-004-physics-calculation-engine.md) |
| **AI advisory** | Claude API (claude-sonnet-4-6) | Strongest instruction adherence for guardrail enforcement, excellent narrative synthesis, structured JSON output mode | [ADR-005](adr/ADR-005-ai-llm-integration.md) |
| **PDF export** | jsPDF + html2canvas | Client-side only — no data leaves the browser, zero infrastructure cost, no third-party rendering dependency | [ADR-006](adr/ADR-006-report-generation.md) |
| **State management** | Zustand + immer + zundo | Minimal boilerplate, immer provides immutable updates with mutable syntax, zundo adds undo/redo, small bundle size (< 5 KB) | [ADR-007](adr/ADR-007-state-management.md) |
| **CI/CD** | GitHub Actions | Native integration with GitHub Pages, free for public repositories, matrix builds for WASM + SPA | [ADR-008](adr/ADR-008-deployment-pipeline.md) |
| **Framework** | React 18 | Widely adopted, strong TypeScript support, compatible with Zustand and MapLibre GL | — |
| **Build tool** | Vite 6 | Near-instant HMR, native ESM, first-class WASM plugin support (`vite-plugin-wasm`) | — |
| **Client cache** | IndexedDB (via idb-keyval) | Larger storage than localStorage, async API, suitable for caching geospatial API responses | — |

---

## 5. Security Model

### Principle: No Backend, No Secrets in Client Code

Nature Risk is a static site with no backend server, no database, and no user authentication. This drastically reduces the attack surface.

### API Key Management

| Key | Stored Where | Accessible To |
|-----|-------------|---------------|
| `OS_DATA_HUB_KEY` | Cloudflare Worker secrets | Worker runtime only |
| `MET_OFFICE_KEY` | Cloudflare Worker secrets | Worker runtime only |
| `UKHO_KEY` | Cloudflare Worker secrets | Worker runtime only |
| `ANTHROPIC_KEY` | Cloudflare Worker secrets | Worker runtime only |
| `VITE_MAPTILER_KEY` | GitHub Actions secrets → injected at build time → embedded in JS bundle | Client-side (restricted by domain in MapTiler dashboard) |
| User's API key (optional) | Browser `sessionStorage` | Current tab only; cleared on close |

**Cloudflare Worker secrets** are encrypted at rest and never exposed in logs, source code, or API responses. The Worker strips sensitive response headers (`Set-Cookie`, `Server`, `X-Powered-By`) from upstream responses.

**User-supplied API keys** (entered via the Settings panel for live advisory mode) are stored in `sessionStorage` — scoped to the current browser tab and automatically cleared when the tab closes. They are never written to `localStorage`, cookies, or any persistent storage.

**Build-time secrets** (`VITE_MAPTILER_KEY`, `VITE_PROXY_URL`) are embedded in the JavaScript bundle. The MapTiler key should be domain-restricted in the MapTiler dashboard. The proxy URL is not secret — it is a public endpoint.

### CORS and Origin Restrictions

The Cloudflare Worker enforces origin checking:

- Only requests from the configured `ALLOWED_ORIGIN` (e.g., `https://jjohare.github.io`) and local development origins (`localhost:3000`, `localhost:5173`) are accepted
- Requests from other origins receive HTTP 403
- CORS preflight (OPTIONS) requests are handled correctly

### Rate Limiting

The Worker applies a sliding-window rate limit of **100 requests per minute per client IP**. This mitigates:

- Accidental request storms from client bugs
- Automated scraping of proxied API data
- Cost amplification attacks against metered upstream APIs

### Input Validation

- All user text input is **sanitised** before being sent to the Claude API (null bytes removed, angle brackets stripped, length limited)
- Coordinate inputs are validated against UK bounds (lat 49.8–60.9, lng -8.2 to 2.0)
- Polygon areas are validated (minimum 0.5 ha)
- POST/PUT request bodies are limited to 1 MB at the Worker level

### No Data Persistence

- The static site has no database and no server-side storage
- The Cloudflare Worker has zero persistent state
- All analysis data exists only in the user's browser memory
- IndexedDB is used for caching API responses (with TTL expiry) but contains no user-identifiable data
- Closing the browser tab discards all session data

---

## 6. Performance Characteristics

### WASM Initialisation

| Metric | Target | Notes |
|--------|--------|-------|
| WASM binary size | < 200 KB (gzipped) | Compiled with `opt-level = "s"` and LTO |
| First load time | < 500 ms | Lazy-loaded on first analysis; does not block initial page render |
| Calculation time (inland) | < 10 ms | Pure computation; no I/O |
| Calculation time (coastal) | < 10 ms | Pure computation; no I/O |

If WASM fails to load, the JavaScript fallback is used transparently. The fallback is slightly slower (10–50 ms per calculation) but produces equivalent results.

### API Latency

| API | Typical Latency | Notes |
|-----|----------------|-------|
| EA RoFRS (flood zones) | 300–800 ms | Direct CORS call; ArcGIS REST API |
| EA Catchment Explorer | 500–1500 ms | Via Worker proxy |
| BGS Soilscapes | N/A (mock) | Indicative data; no API call |
| EA LIDAR | N/A (mock) | Indicative data; no API call |
| Met Office | N/A (mock) | Indicative data; no API call |
| Claude API | 2000–5000 ms | Via Worker proxy; depends on response length |

All data API calls run in parallel. The end-to-end latency target is **< 2 minutes** from prompt submission to final rendered output (P95).

### Bundle Size

| Chunk | Size (gzipped) |
|-------|----------------|
| React + Zustand + immer | ~45 KB |
| MapLibre GL JS | ~200 KB |
| WASM physics binary | ~150 KB |
| jsPDF + html2canvas | ~80 KB (lazy-loaded) |
| Application code | ~30 KB |
| **Total initial load** | **~425 KB** |

jsPDF and html2canvas are lazy-loaded only when the user clicks the Export button, keeping the initial page load lean.

### Caching Strategy

| Data Source | Cache Location | TTL |
|-------------|---------------|-----|
| EA Flood Zones | IndexedDB | 24 hours |
| EA Catchment | IndexedDB | 24 hours |
| BGS Soilscapes | IndexedDB | 7 days |
| EA LIDAR | IndexedDB | 7 days |
| Tidal data | IndexedDB | 5 minutes |
| Bathymetry | IndexedDB | 7 days |
| Rainfall / UKCP18 | IndexedDB | 7 days |
| Map tiles | Browser cache | Set by tile server |

Cache keys are normalised to ~100 m precision (3 decimal places of lat/lng), meaning nearby queries within ~100 m reuse cached data.

### Accessibility

| Requirement | Target |
|-------------|--------|
| WCAG 2.1 | Level AA |
| Colour contrast | 4.5:1 minimum |
| Keyboard navigation | Full support |
| Screen reader | ARIA labels on all interactive elements |
| Mobile performance | Lighthouse >= 80 |

---

*For user documentation, see the [User Guide](user-guide.md). For API details, see the [API Reference](api-reference.md). For deployment instructions, see the [Deployment Guide](deployment-guide.md). For development setup, see the [Developer Guide](developer-guide.md).*
