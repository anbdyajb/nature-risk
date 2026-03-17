# Nature Risk

An agentic geospatial engine that quantifies how natural capital interventions — inland and coastal — reduce physical climate risks to corporate and infrastructure assets across the UK.

**[Live Demo](https://jjohare.github.io/nature-risk/)** | **[App](https://jjohare.github.io/nature-risk/app/)** | **[Documentation](docs/)**

## What It Does

Nature Risk compresses a 3-month environmental consultancy engagement into a 15-minute interactive session. Drop a pin on a UK asset or draw a polygon around a proposed restoration site, and receive quantified, evidence-cited risk reduction analysis — instantly.

| Mode | Input | Output |
|------|-------|--------|
| **Asset Manager** | Pin on a factory, port, substation, or infrastructure asset | Ranked upstream/offshore restoration sites with predicted risk reduction |
| **Project Developer** | Polygon around a proposed wetland, reef, or saltmarsh | Downstream beneficiary assets with quantified risk reduction per asset |

Both modes produce a one-click PDF pre-feasibility report suitable for Board papers.

## Tech Stack

```
┌──────────────────────────────────────────────────────────────┐
│                   GitHub Pages (Static)                       │
│                                                              │
│  ┌─────────────────┐      ┌────────────────────────────┐    │
│  │ React + TS SPA  │      │ MapLibre GL JS             │    │
│  │ (Co-Pilot Chat) │◄────►│ (GIS Visualisation)        │    │
│  └───────┬─────────┘      └────────────────────────────┘    │
│          │                                                   │
│  ┌───────▼─────────┐                                        │
│  │ Rust → WASM     │  Deterministic physics engine           │
│  │ Physics Engine   │  Manning's equation, JONSWAP wave      │
│  │ (96 KB binary)  │  model, Green-Ampt infiltration        │
│  └───────┬─────────┘                                        │
└──────────┼──────────────────────────────────────────────────┘
           │ via Cloudflare Worker CORS proxy
           ▼
┌──────────────────────────────────────────────────────────────┐
│  UK Government Data APIs                                      │
│  EA LIDAR · OS Data Hub · BGS Soilscapes · Met Office         │
│  UKHO ADMIRALTY · NTSLF · Cefas · EA RoFRS                   │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Claude AI (Advisory Synthesis)                               │
│  Narrates physics results — never computes values             │
└──────────────────────────────────────────────────────────────┘
```

## Key Features

- **Deterministic Physics Engine** — Rust compiled to WebAssembly (96 KB). Manning's equation for inland hydrology, JONSWAP wave drag model for coastal attenuation. 62 tests, zero tolerance for hallucinated values.
- **Dual-Mode Analysis** — Inland (flood attenuation, peak flow reduction) and Coastal (wave energy reduction, storm surge, erosion delta). Mixed mode for estuaries.
- **UK Open Data** — EA LIDAR, OS Open Rivers, BGS Soilscapes, UKHO Bathymetry, NTSLF tidal gauges, Met Office UKCP18 climate projections.
- **Claude AI Advisory** — Synthesises physics results into plain-English investment narratives with mandatory disclaimers and confidence scores. Demo mode works without an API key.
- **Event-Sourced State** — Zustand store with append-only event log for full audit trail. Undo/redo for scenario comparison.
- **PDF Export** — One-click Board-ready report with physics results, data provenance, confidence scoring, and regulatory disclaimers.
- **Zero Backend** — Static GitHub Pages site. Cloudflare Worker handles CORS proxy for UK APIs.

## Quick Start

### Prerequisites

- Node.js 20+
- Rust + wasm-pack (`curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`)

### Development

```bash
# Clone
git clone https://github.com/jjohare/nature-risk.git
cd nature-risk

# Build WASM physics engine
cd physics-engine && wasm-pack build --target web --out-dir ../src/wasm && cd ..

# Install dependencies
npm install --include=dev

# Start dev server
npm run dev
# → http://localhost:3000/nature-risk/app/
```

### Build

```bash
# Full build (WASM + React)
npm run build:all

# Or individually
npm run build:wasm   # Rust → WASM
npm run build        # TypeScript + Vite
```

### Test

```bash
# Rust physics engine tests (62 tests)
cd physics-engine && cargo test

# TypeScript tests
npm test
```

## Project Structure

```
nature-risk/
├── src/
│   ├── types/          # DDD domain types (shared contracts)
│   ├── store/          # Zustand + event-sourcing middleware
│   ├── components/     # React components
│   │   ├── Map/        # MapLibre GL + draw controls
│   │   ├── CoPilot/    # Chat pane + action stream
│   │   ├── Widgets/    # Risk dial, hydrograph, confidence badge
│   │   ├── Export/     # PDF generation
│   │   └── Config/     # API key configuration
│   └── services/       # UK data, Claude advisor, WASM loader
├── physics-engine/     # Rust WASM crate
│   ├── src/
│   │   ├── lib.rs      # WASM entry point (4 exports)
│   │   ├── inland.rs   # Manning's equation, Green-Ampt
│   │   ├── coastal.rs  # JONSWAP wave drag, erosion model
│   │   └── validation.rs
│   └── tests/          # 62 tests (unit + integration)
├── worker/             # Cloudflare Worker CORS proxy
├── docs/               # Landing page + documentation
│   ├── adr/            # 8 Architecture Decision Records
│   ├── ddd/            # Domain-Driven Design model
│   └── PRD-master.md   # Master Product Requirements
└── .github/workflows/  # CI/CD: build WASM → build React → deploy
```

## Deployment

Push to `main` triggers the GitHub Actions pipeline:

1. **build-wasm** — Installs Rust, builds physics engine to WASM
2. **build-app** — Downloads WASM artefact, builds React SPA with Vite
3. **deploy** — Publishes to GitHub Pages

### GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `VITE_MAPTILER_KEY` | MapTiler API key for styled map tiles (optional — falls back to OSM) |
| `VITE_PROXY_URL` | Cloudflare Worker proxy URL for UK government APIs |

### Cloudflare Worker

```bash
cd worker
npm install
wrangler secret put OS_DATA_HUB_KEY    # Ordnance Survey
wrangler secret put MET_OFFICE_KEY     # Met Office Weather DataHub
wrangler secret put UKHO_KEY           # UKHO ADMIRALTY
wrangler secret put ANTHROPIC_KEY      # Claude API
wrangler deploy
```

## UK Data Sources

| Category | Sources | Licence |
|----------|---------|---------|
| Topography | EA LIDAR Composite (1m/2m), OS Terrain 5 | OGL / OS OpenData |
| Rivers & Catchments | EA Catchment Data Explorer, OS Open Rivers | OGL / OS OpenData |
| Soil & Land Cover | BGS Soilscapes, UKCEH Land Cover Map | OGL / BGS Licence |
| Flood Risk | EA Risk of Flooding from Rivers and Sea (RoFRS) | OGL |
| Climate Projections | Met Office UKCP18 (RCP4.5 / RCP8.5) | OGL |
| Bathymetry | UKHO ADMIRALTY Marine Data Portal | Commercial |
| Marine Habitats | Cefas Saltmarsh, Project Seagrass | OGL / CC |
| Tides & Waves | NTSLF, Met Office CS3X/WaveNet | Open / Registration |

## Documentation

- [User Guide](docs/user-guide.md) — How to use the application
- [Developer Guide](docs/developer-guide.md) — Local development, architecture, extending
- [API Reference](docs/api-reference.md) — Physics engine and Worker API docs
- [Deployment Guide](docs/deployment-guide.md) — GitHub Pages + Cloudflare Worker setup
- [Architecture Overview](docs/architecture-overview.md) — System design and data flow
- [Architecture Decision Records](docs/adr/) — 8 ADRs covering all technical choices
- [Domain Model](docs/ddd/domain-model.md) — DDD bounded contexts and aggregates
- [Master PRD](docs/PRD-master.md) — Full product requirements document

## Guardrails

Every output includes:
- Mandatory disclaimer (not a substitute for certified FRA)
- Confidence score (Low / Medium / High) with data source citations
- Uncertainty range (e.g., "Peak flow reduction: 12% ± 3%")
- The LLM never computes values — all arithmetic is in the WASM physics engine

## Target Users

- **Corporate Asset Managers** — FTSE 350 sustainability/risk teams scoping NbS investments
- **Nature Project Developers** — NGOs and green infrastructure developers seeking private capital
- **ESG Investors** — Asset managers screening NbS investment efficacy across portfolios
- **Local Authorities** — Flood resilience investment planning

## Licence

Private — All rights reserved.
