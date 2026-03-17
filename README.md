# Nature Risk

An agentic geospatial engine that quantifies how natural capital interventions — inland and coastal — reduce physical climate risks to corporate and infrastructure assets across the UK.

## Overview

Nature Risk compresses a 3-month environmental consultancy engagement into a 15-minute interactive session. It uses UK-specific hydrological and marine data to map upstream/offshore restoration to downstream/onshore asset protection.

## Dual-Mode Agent

| Mode | Input | Output |
|------|-------|--------|
| **Asset Manager** | Pin on a factory, port, or infrastructure asset | Ranked upstream/offshore restoration sites that protect that asset |
| **Project Developer** | Polygon of a proposed wetland, reef, or saltmarsh | Downstream assets benefiting, with quantified risk reduction |

Both modes produce a directional, evidence-cited pre-feasibility report supporting an investment memo.

## Core Capabilities

### Inland (Hydrological)
- Catchment & flow tracing using 1m-resolution LIDAR
- Intervention simulation (tree planting, peat restoration, leaky dams)
- Peak flow attenuation modelling
- **Output:** Estimated reduction in flood height (metres) and delay in flood peak (hours)

### Coastal (Marine)
- Wave attenuation modelling for oyster reefs, seagrass, and saltmarsh
- Erosion prevention analysis
- **Output:** Reduction in wave energy (%) and storm surge height (metres); erosion delta over 25-year horizon

## UK Data Sources

| Category | Sources |
|----------|---------|
| Topography | OS Data Hub (Terrain 50/5), EA LIDAR Composite (1m/2m) |
| Catchments & Flow | EA Catchment Data Explorer, OS Open Rivers, UKCEH FEH Web Service |
| Soil & Land Cover | BGS Soilscapes, UKCEH Land Cover Map, OS MasterMap |
| Baseline Risk | EA RoFRS API, Met Office UKCP18 Projections |
| Bathymetry | UKHO ADMIRALTY Marine Data Portal |
| Marine Habitats | Cefas/EA Saltmarsh, Ocean Conservation Trust / Project Seagrass |
| Tides & Waves | NTSLF, Met Office Coastal Models, EA NCERM |

## Target Users

- Corporate sustainability teams
- Risk and resilience officers
- Infrastructure developers
- ESG investors

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## Architecture

Built with RuFlo V3 — hierarchical-mesh swarm coordination, AgentDB with HNSW indexing, and event-sourced state management.

- **Topology:** hierarchical-mesh (15 agents max)
- **Memory:** Hybrid backend with HNSW search
- **Methodology:** Domain-Driven Design with bounded contexts

## License

Private — All rights reserved.
