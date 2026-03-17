# Nature Risk — Developer Guide

**Version:** 1.0
**Date:** 2026-03-17

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Project Structure](#3-project-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Rust WASM Physics Engine](#5-rust-wasm-physics-engine)
6. [Adding New Intervention Types](#6-adding-new-intervention-types)
7. [Adding New UK Data Sources](#7-adding-new-uk-data-sources)
8. [State Management](#8-state-management)
9. [Testing](#9-testing)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Deployment](#11-deployment)

---

## 1. Prerequisites

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20+ | JavaScript runtime for Vite dev server and build |
| **npm** | 10+ | Package manager (ships with Node.js 20) |
| **Rust** | Stable (latest) | Compiles the WASM physics engine |
| **wasm-pack** | 0.12+ | Builds Rust to WebAssembly targeting the web |
| **Git** | 2.40+ | Version control |

### Optional Tools

| Tool | Purpose |
|------|---------|
| **wrangler** (Cloudflare CLI) | Deploy and manage the Cloudflare Worker CORS proxy |
| **cargo-watch** | Auto-recompile Rust on file changes during development |

### Installation

```bash
# Node.js (via nvm)
nvm install 20
nvm use 20

# Rust (via rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Cloudflare Wrangler (optional)
npm install -g wrangler
```

---

## 2. Local Development

### Clone and Install

```bash
git clone https://github.com/jjohare/nature-risk.git
cd nature-risk
npm install
```

### Build the WASM Physics Engine

The physics engine must be compiled before the Vite dev server can start:

```bash
npm run build:wasm
```

This runs `wasm-pack build --target web --out-dir ../src/wasm` inside the `physics-engine/` directory, producing the WASM binary and JavaScript glue code in `src/wasm/`.

### Start the Development Server

```bash
npm run dev
```

The Vite dev server starts on `http://localhost:3000` with hot module replacement enabled. The application loads the WASM module from `src/wasm/`.

### Environment Variables

Create a `.env.local` file in the project root (this file is gitignored):

```bash
# MapTiler API key for map tiles (required for map rendering)
VITE_MAPTILER_KEY=your_maptiler_key_here

# Cloudflare Worker proxy URL (optional; enables proxied API calls)
VITE_PROXY_URL=https://nature-risk-proxy.your-account.workers.dev
```

All environment variables prefixed with `VITE_` are available in client-side code via `import.meta.env.VITE_*`.

### Full Build (WASM + Vite)

```bash
npm run build:all
```

This runs `build:wasm` followed by `build`, producing the complete production bundle in `dist/`.

### Preview Production Build

```bash
npm run preview
```

Serves the `dist/` directory locally on `http://localhost:4173`.

---

## 3. Project Structure

```
nature-risk/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD: builds WASM + Vite, deploys to GH Pages
├── docs/
│   ├── PRD-master.md             # Master Product Requirements Document
│   ├── index.html                # Landing page (served at site root)
│   ├── adr/                      # Architecture Decision Records
│   │   ├── README.md
│   │   ├── ADR-001-*.md ... ADR-008-*.md
│   └── ddd/
│       └── domain-model.md       # DDD domain model and ubiquitous language
├── physics-engine/               # Rust WASM physics engine (standalone crate)
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/
│   │   ├── lib.rs                # WASM entry points (4 exports)
│   │   ├── types.rs              # Shared domain types (mirrors src/types/index.ts)
│   │   ├── inland.rs             # Inland hydrology calculations
│   │   ├── coastal.rs            # Coastal wave attenuation calculations
│   │   └── validation.rs         # Spatial validation and mode classification
│   └── tests/                    # Rust integration tests
├── worker/                       # Cloudflare Worker CORS proxy
│   ├── wrangler.toml             # Wrangler configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts              # Worker entry point (route matching, rate limiting)
├── src/                          # React/TypeScript SPA source
│   ├── main.tsx                  # Application entry point
│   ├── vite-env.d.ts             # Vite environment type declarations
│   ├── types/
│   │   └── index.ts              # Canonical DDD domain types
│   ├── services/
│   │   ├── advisor.ts            # Claude AI advisory service (live + demo mode)
│   │   ├── modeRouter.ts         # Inland/Coastal/Mixed classification
│   │   ├── physicsLoader.ts      # WASM loader with JS fallback
│   │   ├── ukData.ts             # UK government data API connectors + cache
│   │   └── pdfGenerator.ts       # Client-side PDF export (jsPDF + html2canvas)
│   ├── store/
│   │   ├── index.ts              # Zustand store (immer + zundo + event sourcing)
│   │   └── eventSourcing.ts      # Domain event middleware
│   ├── components/
│   │   ├── App.tsx               # Root component
│   │   ├── App.css               # Global styles
│   │   ├── Layout/
│   │   │   └── SplitScreen.tsx   # Responsive split-screen layout
│   │   ├── CoPilot/
│   │   │   ├── CoPilotPane.tsx   # Main co-pilot pane
│   │   │   ├── ActionStream.tsx  # Live analysis progress checklist
│   │   │   └── ChatMessage.tsx   # Individual chat message renderer
│   │   ├── Map/
│   │   │   ├── MapView.tsx       # MapLibre GL map component
│   │   │   └── DrawControls.tsx  # Polygon draw and pin-drop tools
│   │   ├── Widgets/
│   │   │   ├── RiskDeltaDial.tsx # Before/after risk gauge
│   │   │   ├── HydrographChart.tsx # Peak flow over time chart
│   │   │   ├── ConfidenceBadge.tsx # Confidence level indicator
│   │   │   └── UncertaintyRange.tsx # Uncertainty display
│   │   ├── Config/
│   │   │   └── AdvisorConfig.tsx # API key and proxy URL configuration
│   │   └── Export/
│   │       └── PdfExport.tsx     # PDF export button and logic
│   └── wasm/                     # Generated WASM output (gitignored, built by npm run build:wasm)
├── tests/                        # Vitest test files
├── index.html                    # Vite HTML entry point
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # TypeScript config for Node-side (Vite config)
├── package.json                  # npm scripts and dependencies
└── CLAUDE.md                     # Claude Code agent configuration
```

---

## 4. Architecture Overview

Nature Risk follows a **static-first, client-heavy** architecture. There is no backend server, no database, and no user authentication (Phase 1).

```
┌────────────────────────────────────────────────────────────────┐
│                 GitHub Pages (Static Hosting)                    │
│                                                                  │
│   React SPA ──► Zustand Store ──► MapLibre GL (map)             │
│       │              │                                           │
│       │              ├── Event-sourcing middleware (audit log)   │
│       │              └── zundo (undo/redo)                       │
│       │                                                          │
│       ├──► WASM Physics Engine (Rust → WebAssembly)              │
│       │         • calculateInland()                              │
│       │         • calculateCoastal()                             │
│       │         • validateIntervention()                         │
│       │         • classifyMode()                                 │
│       │                                                          │
│       └──► jsPDF + html2canvas (client-side PDF)                 │
└──────────┬─────────────────────────────────────────────────────┘
           │  HTTPS
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (CORS Proxy)                                   │
│  • Injects API keys from Worker secrets                           │
│  • Rate-limits 100 req/min per IP                                 │
│  • Routes: /api/ea/*, /api/os/*, /api/bgs/*, /api/met/*,        │
│            /api/ukho/*, /api/ntslf/*, /api/claude/*              │
└──────────┬─────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  External APIs                                                    │
│  EA LIDAR · OS Data Hub · BGS · Met Office · UKHO · NTSLF        │
│  Anthropic Claude API                                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Constraints

1. **No LLM arithmetic.** All quantitative outputs are computed by the deterministic WASM physics engine. The LLM narrates results but never computes them. (See ADR-004.)
2. **No API keys in client JS.** All API keys are stored as Cloudflare Worker secrets and never shipped in the browser bundle. (See ADR-003, ADR-005.)
3. **Static site only.** No server-side rendering, no persistent backend, no database. (See ADR-001.)
4. **Event sourcing for audit.** Every state mutation that affects a physics calculation is logged as a domain event with timestamp and causation chain. (See ADR-007.)

### Technology Rationale

| Choice | Alternative Considered | Rationale | ADR |
|--------|----------------------|-----------|-----|
| GitHub Pages | Vercel, Netlify | Zero cost, maximum auditability, no vendor lock-in | ADR-001 |
| MapLibre GL JS | Mapbox GL JS | Open-source fork, no token required for base maps | ADR-002 |
| Cloudflare Worker | AWS Lambda, Vercel Edge | Zero cold start, global edge, generous free tier | ADR-003 |
| Rust/WASM | AssemblyScript, pure JS | Determinism guarantee, type safety, near-native performance | ADR-004 |
| Claude API | OpenAI, local LLM | Best narrative synthesis, strong instruction following | ADR-005 |
| jsPDF | Server-side Puppeteer | No data leaves the browser, zero infrastructure | ADR-006 |
| Zustand + immer + zundo | Redux, MobX | Minimal boilerplate, immer immutability, built-in undo/redo | ADR-007 |
| GitHub Actions | GitLab CI, CircleCI | Tight integration with GitHub Pages hosting | ADR-008 |

---

## 5. Rust WASM Physics Engine

### Overview

The physics engine is a standalone Rust crate in `physics-engine/`. It compiles to `wasm32-unknown-unknown` via `wasm-pack` and is consumed by the React SPA as a WASM module. The engine is **pure and deterministic** — identical inputs always produce identical outputs. No side effects, no randomness, no I/O.

### Source Files

| File | Responsibility |
|------|---------------|
| `lib.rs` | WASM entry points: `calculateInland`, `calculateCoastal`, `validateIntervention`, `classifyMode` |
| `types.rs` | Shared domain types (mirrors `src/types/index.ts`). Serialised via `serde` + `serde-wasm-bindgen` |
| `inland.rs` | Manning's equation, Green-Ampt infiltration, catchment water balance |
| `coastal.rs` | Linear vegetation drag (Dalrymple et al.), JONSWAP spectrum modification, exponential wave energy decay |
| `validation.rs` | UK boundary check, area validation, soil suitability, bathymetric depth, mode classification |

### Building

```bash
cd physics-engine
wasm-pack build --target web --out-dir ../src/wasm
```

Or from the project root:

```bash
npm run build:wasm
```

The output is placed in `src/wasm/` and includes:
- `nature_risk_physics_bg.wasm` — the compiled WASM binary
- `nature_risk_physics.js` — JavaScript glue code
- `nature_risk_physics.d.ts` — TypeScript type declarations

### Testing

```bash
cd physics-engine
cargo test
```

This runs the Rust unit tests defined in `validation.rs` (and any tests in `inland.rs` and `coastal.rs`).

For browser-based WASM tests:

```bash
wasm-pack test --headless --chrome
```

### Modifying the Engine

1. Edit the Rust source files in `physics-engine/src/`
2. Run `cargo test` to validate
3. Run `npm run build:wasm` to rebuild the WASM binary
4. The Vite dev server will automatically pick up the new module

### JS Fallback

If the WASM module fails to load (e.g., in an older browser), the application falls back to a JavaScript implementation in `src/services/physicsLoader.ts`. The JS fallback uses simplified versions of the same equations (Manning's equation for inland; exponential wave energy decay for coastal). Physics results from the fallback are tagged with `physicsModel: "JS Fallback (Manning)"` or `physicsModel: "JS Fallback (Wave Drag)"` so the advisory layer can adjust confidence accordingly.

---

## 6. Adding New Intervention Types

Adding a new intervention type requires changes in four places:

### Step 1 — Rust Types (`physics-engine/src/types.rs`)

Add the new variant to `InterventionType` (for inland) or `CoastalHabitatType` (for coastal):

```rust
pub enum InterventionType {
    TreePlanting,
    PeatRestoration,
    LeakyDams,
    FloodplainReconnection,
    RiparianBuffer,
    NewInterventionType,  // Add here
}
```

### Step 2 — Rust Physics (`physics-engine/src/inland.rs` or `coastal.rs`)

Add the physics model parameters for the new type. For inland, this typically means adding Manning's roughness uplift, soil infiltration coefficients, and storage capacity parameters. For coastal, add the drag coefficient (alpha) and maturation years.

Update the validation logic in `physics-engine/src/validation.rs` if the new type has specific soil, depth, or area requirements.

### Step 3 — TypeScript Types (`src/types/index.ts`)

Add the new variant to the corresponding TypeScript union:

```typescript
export type InterventionType =
  | 'tree_planting'
  | 'peat_restoration'
  | 'leaky_dams'
  | 'floodplain_reconnection'
  | 'riparian_buffer'
  | 'new_intervention_type';  // Add here
```

### Step 4 — JS Fallback (`src/services/physicsLoader.ts`)

Add the Manning's roughness uplift (or coastal drag alpha) for the new type in the fallback lookup tables:

```typescript
const MANNINGS_UPLIFT: Record<string, number> = {
  // ... existing entries
  new_intervention_type: 0.018,  // Add here
};
```

### Step 5 — UI Components

Update the intervention type dropdown in the relevant UI component (typically in `src/components/Map/DrawControls.tsx` or `src/components/CoPilot/CoPilotPane.tsx`).

### Step 6 — Rebuild and Test

```bash
cd physics-engine && cargo test
npm run build:wasm
npm test
```

---

## 7. Adding New UK Data Sources

### Service Layer

All UK data connectors live in `src/services/ukData.ts`. Each data source follows the same pattern:

1. **Check IndexedDB cache** (via `idb-keyval`) using a location-snapped cache key
2. **Attempt a live API call** (if the API supports CORS from the browser)
3. **Fall back to location-aware mock data** if the API call fails or the API requires a proxy

To add a new data source:

```typescript
export async function fetchNewDataSource(
  coords: Coordinates
): Promise<UKDataResponse<YourDataType>> {
  const key = cacheKey('new_source', coords);

  // 1. Check cache
  const cached = await cacheGet<UKDataResponse<YourDataType>>(key);
  if (cached) return { ...cached, source: 'cached' };

  // 2. Attempt live call
  try {
    const response = await fetch(`${PROXY_URL}/api/newsource/...`);
    // ... parse response
    const result: UKDataResponse<YourDataType> = {
      data: parsedData,
      source: 'live',
      fetchedAt: now(),
      apiName: 'New Data Source Name',
      cacheKey: key,
    };
    await cacheSet(key, result, TTL.NEW_SOURCE);
    return result;
  } catch {
    // 3. Mock fallback
    return {
      data: mockData,
      source: 'mock',
      fetchedAt: now(),
      apiName: 'New Data Source (mock)',
      cacheKey: key,
    };
  }
}
```

### Cloudflare Worker Route

If the new API does not support browser CORS, add a route in `worker/src/index.ts`:

```typescript
const ROUTES: Route[] = [
  // ... existing routes
  {
    prefix: '/api/newsource/',
    upstream: 'https://api.newsource.gov.uk/',
    keyEnvField: 'NEW_SOURCE_KEY',
    keyInjection: 'header',
    keyHeader: 'Authorization',
  },
];
```

Then add the secret:

```bash
cd worker
wrangler secret put NEW_SOURCE_KEY
```

### Type Definitions

Add the response type in `src/types/index.ts`:

```typescript
export interface NewSourceData {
  // ... your fields
}
```

---

## 8. State Management

### Architecture

The application state is managed by **Zustand** with three middleware layers:

1. **immer** — Enables mutable-style updates that produce immutable state
2. **zundo (temporal)** — Provides undo/redo history (up to 50 states)
3. **Event-sourcing middleware** — Appends a `DomainEvent` to the append-only `eventLog` for every significant state mutation

### Store Structure

The store is defined in `src/store/index.ts` and is divided into slices:

| Slice | Fields | Purpose |
|-------|--------|---------|
| **Map** | `viewport`, `assetPin`, `interventionPolygon`, `activeLayers` | Geographic inputs and map state |
| **Analysis** | `mode`, `userIntent`, `currentStep`, `physicsResult`, `advisoryResult`, `opportunityZones`, `actionStream` | Analysis pipeline state |
| **CoPilot** | `messages` | Chat history |
| **Event Log** | `eventLog` | Append-only domain events for audit trail |
| **Config** | `advisorMode`, `proxyUrl` | Live/demo mode configuration |

### Domain Events

Every significant user action and system response is recorded as a `DomainEvent`:

| Event Type | Triggered By |
|-----------|-------------|
| `AssetPinPlaced` | User drops pin on map |
| `InterventionPolygonDrawn` | User draws polygon |
| `ModeClassified` | Mode router determines Inland/Coastal/Mixed |
| `DataFetched` | UK data API queries complete |
| `PhysicsCalculated` | WASM physics engine returns results |
| `AdvisorySynthesised` | Claude AI returns narrative |
| `ScenarioChanged` | User changes climate scenario |
| `InterventionTypeChanged` | User changes intervention type |
| `ReportExported` | User exports PDF |
| `AnalysisReset` | User resets the analysis |

Events are serialised into the exported PDF report as an audit trail.

### Selectors

Use the provided selectors for reading derived state:

```typescript
import {
  selectIsAnalysisRunning,
  selectCanRunAnalysis,
  selectLatestAdvisory,
  selectEventCount,
} from '@/store';
```

### Undo/Redo

The `zundo` temporal middleware provides undo and redo via:

```typescript
const { undo, redo, pastStates, futureStates } = useNatureRiskStore.temporal.getState();
```

Transient state (action stream, event log, chat messages, current step) is excluded from undo/redo history via the `partialize` option.

---

## 9. Testing

### Rust Tests

```bash
cd physics-engine
cargo test
```

Tests are located in `physics-engine/src/validation.rs` (inline `#[cfg(test)]` module) and in `physics-engine/tests/` for integration tests.

Key test cases:
- Valid inland and coastal inputs pass validation
- Out-of-UK-bounds coordinates fail
- Below-minimum-area polygons fail
- Peat restoration on chalk geology fails (physically incompatible)
- Shallow water depth fails for oyster reefs
- Mode classification returns correct values for known coordinates

### JavaScript/TypeScript Tests

```bash
npm test          # Single run
npm run test:watch  # Watch mode
```

Tests use **Vitest** (configured via `vite.config.ts`). Test files should be placed in `tests/` or co-located as `*.test.ts` files.

### What to Test

- **Physics loader:** Verify JS fallback produces reasonable results for known inputs
- **Mode router:** Verify inland, coastal, and mixed classification for representative UK coordinates
- **UK data connectors:** Verify cache behaviour and mock fallback
- **Store actions:** Verify state transitions for the analysis pipeline
- **Event sourcing:** Verify domain events are appended correctly

---

## 10. CI/CD Pipeline

### GitHub Actions Workflow

The pipeline is defined in `.github/workflows/deploy.yml` and runs on every push to `main`:

```
Job 1: build-wasm
  ├── Checkout
  ├── Install Rust toolchain + wasm32-unknown-unknown target
  ├── Install wasm-pack
  ├── Build WASM (wasm-pack build --target web --out-dir ../src/wasm)
  └── Upload WASM artifact

Job 2: build-app (depends on build-wasm)
  ├── Checkout
  ├── Download WASM artifact
  ├── Setup Node 20
  ├── npm ci
  ├── npm run build (with VITE_MAPTILER_KEY and VITE_PROXY_URL from secrets)
  ├── Assemble deploy directory:
  │     /           → Landing page (docs/index.html)
  │     /app/       → React SPA (Vite output)
  │     /adr/       → Architecture Decision Records
  └── Upload Pages artifact

Job 3: deploy (depends on build-app)
  └── Deploy to GitHub Pages
```

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VITE_MAPTILER_KEY` | MapTiler API key, injected at build time for map tile access |
| `VITE_PROXY_URL` | Cloudflare Worker proxy URL, injected at build time |

### Concurrency

The workflow uses a `pages` concurrency group with `cancel-in-progress: true`, ensuring only one deployment runs at a time and superseding any queued deployment.

---

## 11. Deployment

### GitHub Pages

The SPA is deployed to GitHub Pages automatically on every push to `main`. The deploy directory structure is:

```
/                    → Landing page (docs/index.html)
/app/                → React SPA (Vite build output)
/adr/                → Architecture Decision Records (static markdown)
```

The Vite `base` path is set to `/nature-risk/app/` in `vite.config.ts`, matching the GitHub Pages URL structure.

### Cloudflare Worker

The CORS proxy Worker is deployed independently:

```bash
cd worker
npm install
wrangler deploy
```

Set required secrets:

```bash
wrangler secret put OS_DATA_HUB_KEY
wrangler secret put MET_OFFICE_KEY
wrangler secret put UKHO_KEY
wrangler secret put ANTHROPIC_KEY
```

The Worker is deployed to `https://nature-risk-proxy.<account>.workers.dev/`.

Verify deployment:

```bash
curl https://nature-risk-proxy.<account>.workers.dev/health
# Expected: {"status":"ok","timestamp":"..."}
```

See the [Deployment Guide](deployment-guide.md) for detailed step-by-step instructions.

---

*For user documentation, see the [User Guide](user-guide.md). For API details, see the [API Reference](api-reference.md). For the full architecture rationale, see the [Architecture Overview](architecture-overview.md).*
