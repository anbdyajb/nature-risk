# Nature-Based Risk Mitigation Agent (UK Edition)
## Master Product Requirements Document

**Product Name:** Nature Risk — Natural Capital Impact Predictor Agent
**Version:** 2.0 — Master PRD (Authoritative)
**Document Status:** Live
**Date:** 2026-03-17
**Supersedes:** PRD_NatureRisk_Agent_v1.md, PRD_ Natural Capital Impact Predictor Agent.md, PRD_ Nature-Based Risk Mitigation Agent (UK Focus).md

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem & Vision](#2-problem--vision)
3. [Target Users & Personas](#3-target-users--personas)
4. [Dual-Mode Agent Architecture](#4-dual-mode-agent-architecture)
5. [Core Capabilities](#5-core-capabilities)
6. [UK Data Sources & API Specifications](#6-uk-data-sources--api-specifications)
7. [UX / Interaction Design](#7-ux--interaction-design)
8. [Technical Architecture](#8-technical-architecture)
9. [Guardrails & Safety Constraints](#9-guardrails--safety-constraints)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Phased Roadmap](#11-phased-roadmap)
12. [Open Questions & Assumptions](#12-open-questions--assumptions)

---

## 1. Executive Summary

Nature Risk is a dual-mode agentic geospatial engine that quantifies how natural capital interventions — inland and coastal — reduce physical climate risks to specific corporate and infrastructure assets across the UK.

The product compresses a three-month environmental consultancy engagement into a fifteen-minute interactive session. Users either drop a pin on an asset to discover ranked upstream or offshore restoration opportunities, or draw a polygon around a proposed nature-based solution to discover which downstream or onshore assets benefit and by how much.

The core value proposition is directional, evidence-cited pre-feasibility analysis — not regulated advice — that enables early-stage investment decisions in nature-based solutions (NbS). Every quantitative output is produced by a deterministic physics engine, cited to primary UK open-data sources, and accompanied by a transparent confidence score.

The platform is delivered as a static GitHub Pages site with a split-screen Co-Pilot + Map interface, a WASM physics engine for deterministic calculations, Mapbox GL for GIS visualisation, and Claude AI for advisory reasoning. A Cloudflare Worker provides a CORS proxy for UK government data APIs.

---

## 2. Problem & Vision

### 2.1 The Problem

Corporations and infrastructure owners face a growing mandate to invest in nature-based solutions to mitigate physical climate risk. However, demonstrating the direct, asset-level ROI of an NbS investment is technically demanding and commercially inaccessible:

- Quantifying the downstream flood risk reduction from a proposed upstream wetland currently requires a multi-month hydrological study costing tens of thousands of pounds.
- Wave attenuation modelling for coastal habitats (oyster reefs, seagrass, saltmarsh) requires specialist marine consultancy that most corporate sustainability teams cannot procure quickly.
- Without quantified proof, the majority of NbS investment proposals stall at the business case stage, never reaching capital allocation.

### 2.2 The Vision

An agentic geospatial engine that is the first point of call for any corporate, infrastructure operator, or nature project developer who needs to answer the question: *"Exactly how much will this nature-based intervention protect this specific asset, and what is the evidence?"*

The agent serves two directions of the same problem:
- **Asset-first:** Given a corporate asset, where upstream or offshore should natural capital be restored to maximise protection?
- **Intervention-first:** Given a proposed nature-based intervention, which downstream or onshore assets benefit and by how much?

Both flows converge on a shareable, evidence-cited, board-ready pre-feasibility report.

---

## 3. Target Users & Personas

### 3.1 Primary Personas

#### Persona A — Corporate Asset Manager

| Attribute | Detail |
| :--- | :--- |
| **Role** | Head of Risk & Resilience, or Corporate Sustainability Director |
| **Organisation** | FTSE 350 company, utility, port operator, or large infrastructure owner |
| **Primary Goal** | Identify which nature-based investments would most directly reduce physical climate risk (flood, coastal) to owned or leased assets |
| **Pain Point** | Cannot justify NbS capex to the Board without asset-specific quantified risk reduction; consultancy is too slow and expensive for early-stage scoping |
| **Primary Input** | Drops a pin on a factory, substation, data centre, port, or road junction |
| **Desired Output** | A ranked list of upstream or offshore "High-Impact Opportunity Zones" for restoration, with predicted risk reduction at the pinned asset, confidence score, and one-click export |
| **Success Condition** | Produces a draft NbS investment case section for a Board paper within one session |

#### Persona B — Nature Project Developer

| Attribute | Detail |
| :--- | :--- |
| **Role** | Project Director at an environmental NGO, land management company, or green infrastructure developer |
| **Organisation** | Wildlife trust, rewilding enterprise, or specialist NbS developer seeking private capital |
| **Primary Goal** | Demonstrate the corporate beneficiaries of a proposed restoration project to unlock private investment or blended finance |
| **Pain Point** | Can model the ecological benefit of a project, but cannot quickly quantify the asset-protection value that would attract corporate co-investment |
| **Primary Input** | Draws a polygon around a proposed wetland, peatland, reef, or saltmarsh |
| **Desired Output** | A list of downstream or onshore assets (roads, industrial sites, towns) that benefit from the intervention, with quantified risk reduction per asset and evidence citations |
| **Success Condition** | Uses the output to populate a private placement memorandum or grant application within days, not months |

#### Persona C — ESG / Infrastructure Investor

| Attribute | Detail |
| :--- | :--- |
| **Role** | ESG Analyst or Infrastructure Portfolio Manager |
| **Organisation** | Asset manager, pension fund, development finance institution |
| **Primary Goal** | Screen and compare the risk-reduction efficacy of NbS investments across a portfolio of assets or geographies |
| **Pain Point** | No standardised tool exists to compare the quantified physical risk-reduction value of different NbS projects |
| **Primary Input** | Batch of asset locations or a portfolio geography |
| **Desired Output** | Comparative risk-reduction metrics and a ranked pipeline of NbS investment opportunities |
| **Success Condition** | Integrates Nature Risk outputs into standard portfolio risk reporting |

### 3.2 Secondary Users

- **Local Authorities and Combined Authorities** assessing flood resilience investment across their geography.
- **Insurance Underwriters** exploring parametric NbS co-investment products.
- **Academic Researchers** validating hydrological and marine impact models against empirical data.

---

## 4. Dual-Mode Agent Architecture

### 4.1 Mode Overview

The agent operates in two primary modes, with automatic routing based on the geographic coordinates of the input:

| Mode | Trigger Condition | Primary Toolchain | Output Type |
| :--- | :--- | :--- | :--- |
| **Inland / Hydrological** | Input coordinates are inland or in a riverine catchment | EA LIDAR, OS Open Rivers, BGS Soilscapes, Met Office rainfall, UKCEH Land Cover | Peak flood height reduction (m), flood peak delay (hrs), confidence score |
| **Coastal / Marine** | Input coordinates are within 5 km of the coast or a tidal estuary | UKHO Bathymetry, NTSLF tidal data, Met Office Coastal Models, Cefas saltmarsh/seagrass | Wave energy reduction (%), storm surge height reduction (m), 25-year erosion delta |

A **Mixed Mode** is invoked where input coordinates span an estuarine or transitional zone; both toolchains execute in parallel and results are merged by the Advisory layer.

### 4.2 Routing Logic

```
Input Received
    │
    ├─ Coordinates within 5 km of the MHWS line? ──► COASTAL mode
    │
    ├─ Coordinates in EA Tidal Flood Zone 3? ──► MIXED mode
    │
    └─ All other coordinates ──► INLAND mode
```

Mode routing accuracy target: > 99% (validated quarterly against a labelled test dataset).

### 4.3 Agent Flow

1. **Input Validation** — Validate geometry (polygon/point), check for minimum polygon area (≥ 0.5 ha), confirm UK boundary.
2. **Mode Classification** — Route to Inland, Coastal, or Mixed toolchain.
3. **Spatial Validation** — Cross-check intervention placement against soil type, habitat baseline, and bathymetric suitability. Surface warnings for unsuitable placements.
4. **Data Fetch** — Query all relevant UK data APIs in parallel. Surface `DATA_UNAVAILABLE` errors immediately if any API call fails; never interpolate missing geospatial data.
5. **Physics Engine Calculation** — Route all quantitative computations to the deterministic WASM physics engine. The LLM does not perform arithmetic on geospatial values.
6. **Advisory Synthesis** — The LLM (Claude) synthesises physics engine outputs, data citations, confidence scoring, and plain-English narrative into the structured response.
7. **Output Rendering** — Render in the split-screen UI: map layers updated, interactive widgets populated, Action Stream collapsed to summary.
8. **Export** — One-click PDF generation containing all outputs, source citations, disclaimers, and confidence scores.

---

## 5. Core Capabilities

### 5.1 Hydrological Intelligence (Inland)

**Catchment & Flow Tracing**
Trace flow paths from any UK point using 1m-resolution EA LIDAR composite data. Validate upstream/downstream hydrological connectivity via OS Open Rivers network. Delineate contributing catchment area using digital elevation model analysis. Identify hydrological barriers and natural storage features.

**Intervention Simulation**
Predict the effect of nature-based interventions on the flood hydrograph at a target asset:

| Intervention Type | Physical Mechanism Modelled | Key Parameters |
| :--- | :--- | :--- |
| Tree planting / reforestation | Increased interception and evapotranspiration; Manning's roughness coefficient increase | Species mix, canopy density, slope gradient |
| Peat restoration | Increased soil water storage capacity; reduced runoff coefficient | Peat depth, degradation state, saturation level |
| Leaky dams / woody debris dams | In-channel storage volume; flow velocity reduction | Dam spacing, channel width, storage geometry |
| Floodplain reconnection | Off-channel storage; flood peak attenuation | Floodplain area, connectivity threshold, storage depth |
| Riparian buffer strips | Reduced overland flow velocity; increased infiltration | Strip width, vegetation type, slope |

**Water Retention Delta**
Calculate soil-specific water retention change using BGS Soilscapes permeability and field capacity data combined with UKCEH Land Cover Map baseline. Apply localised Met Office UKCP18 rainfall projections (RCP4.5 and RCP8.5) to compute peak flow attenuation under current and future climate scenarios.

**Outputs**
- Estimated reduction in peak flood height (metres) at the target asset
- Delay in flood peak arrival (hours) at the target asset
- Percentage reduction in peak flow rate (Q-peak, m³/s)
- Confidence score (Low / Medium / High) with data-source citations
- Uncertainty range (e.g., "Peak flow reduction: 12% ± 3%")
- 25-year and 50-year horizon projections under UKCP18 scenarios

### 5.2 Marine Intelligence (Coastal)

**Wave Attenuation Modelling**
Model how coastal nature-based interventions reduce wave energy before it reaches sea walls, ports, or coastal infrastructure. Query UKHO Bathymetry to characterise the underwater slope (profile) and propagation path. Integrate Met Office Coastal Models for dominant wave direction and significant wave height (Hs) statistics.

| Habitat Type | Wave Attenuation Mechanism | Achievable Reduction Range |
| :--- | :--- | :--- |
| Oyster/shellfish reef | Hard substrate friction; wave breaking; current deflection | 15–50% wave energy reduction |
| Seagrass meadow | Canopy drag; turbulence induction; bed stabilisation | 10–40% wave energy reduction |
| Saltmarsh | Biomass drag; sedimentation; storm surge dissipation | 20–70% storm surge reduction |
| Combined reef + saltmarsh | Stacked attenuation | Up to 80% combined reduction |

**Erosion Prevention Analysis**
Identify areas where natural capital interventions can stabilise coastal sediment budgets. Integrate EA National Coastal Erosion Risk Mapping (NCERM) for baseline erosion rates. Project sediment budget changes over a 25-year horizon incorporating UKCP18 sea-level rise scenarios.

**Tidal & Storm Surge Context**
Integrate National Tide and Sea Level Facility (NTSLF) gauge data to characterise the tidal range and extreme water level return periods at the site. Overlay UKCP18 sea-level rise projections for the 2050, 2070, and 2100 time horizons.

**Dynamic Morphology Disclosure**
All coastal outputs must explicitly state that:
- Habitat maturation timelines range from 3 years (oyster reef) to 15+ years (saltmarsh succession).
- Habitat efficacy is subject to storm disturbance; baseline attenuation values carry a ± 20% inter-annual variability.
- Sea-level rise projections are incorporated; static baselines are never used.

**Outputs**
- Predicted reduction in wave energy (%) at the onshore asset
- Predicted reduction in storm surge height (metres) at the onshore asset
- Erosion risk delta over 25-year horizon (metres of shoreline retreat avoided)
- Habitat suitability score for the proposed intervention
- Confidence score with data-source citations
- 25/50-year projections under UKCP18 RCP4.5 and RCP8.5

### 5.3 Triage & Advisory Logic

**Spatial Validation (Real-Time)**
Cross-reference intervention polygon against habitat suitability datasets before beginning analysis:
- Soil type and depth (BGS Soilscapes) for inland interventions
- Seabed substrate and bathymetric depth (UKHO) for coastal interventions
- Land designation constraints (Natural England SSSIs, National Parks)
- Surface warnings with alternative recommendations (e.g., *"Soil type is thin rendzina — unsuitable for peat restoration; a leaky dam network would be more effective at this location"*)

**Scale Validation**
Alert users when the proposed intervention area is below the minimum effective threshold for the proposed intervention type. Provide minimum viable area guidance with a suggested scaling adjustment.

**Mode Routing**
Automatically classify each query as Inland, Coastal, or Mixed based on input coordinates. Route to the correct toolchain with no user intervention required. Log routing decision and rationale in the Action Stream.

**Confidence Scoring Framework**

| Level | Definition | Trigger Conditions |
| :--- | :--- | :--- |
| **High** | All primary data sources returned 200 OK; data resolution ≤ 2m; data recency ≤ 12 months | All APIs available; LIDAR 1m or OS Terrain 5 used; recent EA flood risk data |
| **Medium** | One or more secondary data sources unavailable; data resolution 2–10m; data recency 12–36 months | OS Terrain 50 used; some APIs falling back to cached data; interpolated rainfall |
| **Low** | Multiple APIs unavailable; reliance on coarse national datasets; data recency > 36 months | LIDAR unavailable; fallback to coarse DEM; very few tide gauge records nearby |

---

## 6. UK Data Sources & API Specifications

### 6.1 Inland Data Sources

| Dataset | Provider | Base URL | Data Type | Licence | Update Frequency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| LIDAR Composite (1m/2m) | Environment Agency | `https://environment.data.gov.uk/DefraDataDownload/?Mode=survey` | Elevation raster | Open Government Licence | As surveyed (irregular) |
| OS Terrain 5 | Ordnance Survey | `https://api.os.uk/maps/raster/v1` | Elevation raster | OS OpenData / Premium | Annual |
| OS Open Rivers | Ordnance Survey | `https://api.os.uk/downloads/v1/products/OpenRivers` | River network vector | OS OpenData | Annual |
| Catchment Data Explorer | Environment Agency | `https://environment.data.gov.uk/catchment-planning/` | Catchment polygons / WFS | Open Government Licence | Annual |
| Risk of Flooding from Rivers and Sea (RoFRS) | Environment Agency | `https://environment.data.gov.uk/flood-planning/` | Flood zone polygons | Open Government Licence | 2-yearly |
| FEH Web Service | UKCEH | `https://fehweb.ceh.ac.uk/` (registration required) | Peak flow statistics | Licenced (academic/commercial) | As updated |
| BGS Soilscapes | British Geological Survey | `https://www.bgs.ac.uk/datasets/soilscapes/` | Soil attribute polygons | OGL / BGS Licence | As updated |
| UKCEH Land Cover Map | UKCEH | `https://catalogue.ceh.ac.uk/documents/6c6c9203-7333-4d96-88ab-78925e7a4e73` | Land cover raster (25m) | Licenced | ~5 yearly |
| UKCP18 Projections | Met Office | `https://ukclimateprojections-ui.metoffice.gov.uk/` | Climate scenario grids | Open Government Licence | 2018 (v1); updates planned |
| Weather DataHub | Met Office | `https://data.hub.api.metoffice.gov.uk/` | Near-real-time & historical weather | Registration / API key required | Near real-time |
| OS MasterMap Topography | Ordnance Survey | `https://api.os.uk/features/v1/wfs` | Topographic features | Premium (PSGA) | 6-monthly |

### 6.2 Coastal Data Sources

| Dataset | Provider | Base URL | Data Type | Licence | Update Frequency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ADMIRALTY Marine Data Portal (Bathymetry) | UKHO | `https://datahub.admiralty.co.uk/` | Seabed elevation raster | Commercial licence | As surveyed |
| National Coastal Erosion Risk Mapping (NCERM) | Environment Agency | `https://environment.data.gov.uk/DefraDataDownload/?Mode=survey` | Erosion risk polygons | Open Government Licence | ~5 yearly |
| Saltmarsh Extents | EA / Cefas | `https://www.data.gov.uk/dataset/saltmarsh-extent` | Saltmarsh polygons | Open Government Licence | ~5 yearly |
| Seagrass Distribution | Project Seagrass / Ocean Conservation Trust | `https://www.projectseagrass.org/` (WMS/download) | Seagrass polygon/point | Creative Commons | Irregular |
| National Tide Gauge Network | NTSLF / BODC | `https://www.ntslf.org/tides/tidepred` | Tidal time series | Open | Near real-time |
| CS3X / WaveNet Coastal Models | Met Office | `https://data.hub.api.metoffice.gov.uk/` | Significant wave height, direction, period grids | Registration / API key | Hourly / daily |
| Regional Coastal Monitoring Programme | Channel Coastal Observatory | `https://www.coastalmonitoring.org/` | Wave buoy data, beach surveys | Open | Continuous / Annual |

### 6.3 Planned Phase 3 Integrations

| Dataset | Provider | Purpose | Status |
| :--- | :--- | :--- | :--- |
| JBA Flood Maps API | JBA Risk Management | High-resolution commercial flood risk for financial layer | Evaluate for Phase 3 |
| Fathom Global Flood Model | Fathom | Global baseline; supplementary UK coverage | Evaluate for Phase 3 |
| Biodiversity Net Gain Unit Prices | DEFRA / Natural England | BNG uplift valuation for intervention polygons | Awaiting stable API |
| Insurance Loss Benchmarks | TBC (Lloyd's, Swiss Re, JLT) | Avoided Loss £ GBP valuation | Partnership TBD |

---

## 7. UX / Interaction Design

### 7.1 Core Interface Philosophy

A **"Co-Pilot + Map"** split-screen layout:

- **Left Pane (40% width on desktop):** Conversational AI interface with structured chat, interactive data widgets, Action Stream, and export controls.
- **Right Pane (60% width on desktop):** Dynamic Mapbox GL GIS visualisation showing the intervention polygon, target asset pin, computed flow paths or wave direction arrows, risk zone layers, and delta overlays. Updates in real time as the agent completes each processing step.
- **Mobile:** Single-column layout; map collapses to a thumbnail that expands on tap.

### 7.2 Interaction Flows

#### Inland Happy Path — Asset Manager Flow

1. User drops a pin on the map at a target asset location (factory, substation, road).
2. User types or selects: *"What upstream restoration would best protect this asset from flood risk?"*
3. Agent runs spatial validation: confirms UK location, delineates catchment, confirms inland mode.
4. Action Stream shows: *"Delineating contributing catchment... [Done]"* → *"Fetching EA LIDAR 1m... [Done]"* → *"Querying EA RoFRS flood zones... [Done]"* → *"Calculating Opportunity Zones... [Done]"*
5. Right pane renders: catchment boundary, flow path network, colour-coded Opportunity Zone polygons (ranked High / Medium / Low).
6. Left pane renders: ranked list of Opportunity Zones with intervention type, predicted peak flow reduction, confidence score, and inline source citations.
7. User clicks an Opportunity Zone to explore it.
8. User adjusts intervention type (tree planting → peat restoration) via dropdown widget; agent reruns physics engine and updates outputs in real time.
9. User exports to PDF.

#### Inland Happy Path — Project Developer Flow

1. User draws a polygon on the map around a proposed restoration area (wetland, peatland).
2. User types: *"What assets downstream would benefit from this wetland, and by how much?"*
3. Agent validates polygon (area ≥ 0.5 ha), checks soil suitability, confirms inland mode.
4. Agent queries BGS Soilscapes, UKCEH Land Cover, OS Open Rivers, EA RoFRS.
5. Right pane renders: flow paths from polygon to downstream beneficiary assets, risk delta overlays.
6. Left pane renders: list of beneficiary assets with asset type, distance downstream, predicted flood height reduction, and confidence score.
7. User exports to PDF.

#### Coastal Happy Path

1. User draws a polygon at a proposed reef, seagrass, or saltmarsh location (offshore or intertidal).
2. User drops a pin on the onshore asset (sea wall, port, coastal road).
3. Agent validates polygon, confirms coastal mode, checks bathymetric suitability via UKHO.
4. Action Stream shows: *"Fetching UKHO bathymetry profile... [Done]"* → *"Querying NTSLF tidal data... [Done]"* → *"Applying UKCP18 sea-level rise (2050)... [Done]"* → *"Calculating wave attenuation... [Done]"*
5. Right pane renders: bathymetric contours, dominant wave direction arrows, intervention polygon, storm surge risk zone before/after overlay.
6. Left pane renders: wave energy reduction (%), storm surge height reduction (m), erosion delta over 25 years, habitat maturation timeline, confidence score with citations.
7. User exports to PDF.

### 7.3 UI Components

**Action Stream**
A live, collapsing checklist in the chat pane displaying each agent tool-call step with status (Running / Done / Error). Collapses to a single summary line once all steps complete. Expandable on click. Each step links to the underlying data source.

**Interactive Data Widgets**

| Widget | Content | Interaction |
| :--- | :--- | :--- |
| Risk Delta Dial | Gauge showing flood height or wave energy before vs. after intervention | Hover for exact values; tap to expand |
| Hydrograph (Inland) | Chart showing peak flow over time; before vs. after intervention curves | Adjustable return period selector (1-in-10 to 1-in-200) |
| Confidence Badge | Low / Medium / High indicator with tooltip listing source datasets and resolution | Tap to expand full data provenance |
| Uncertainty Range | "Peak flow reduction: 12% ± 3%" inline display | Tooltip explains ± basis (data resolution, model uncertainty) |
| Opportunity Zone Cards | Ranked intervention recommendations with type, area, predicted impact | Click to highlight on map, adjust intervention type |
| Asset Beneficiary List | Downstream assets with distance, type, predicted risk reduction | Click to highlight on map |

**Export**
One-click PDF report containing: all map outputs (static renders), all widget outputs, source citations, confidence scores, mandatory disclaimers, date/time stamp, and a structured pre-feasibility summary section formatted for inclusion in a Board investment memo.

### 7.4 Responsive Behaviour

| Breakpoint | Layout |
| :--- | :--- |
| ≥ 1280px (desktop) | Split-screen: 40% chat / 60% map |
| 768–1279px (tablet) | Stacked: full-width chat above map (map min-height: 400px) |
| < 768px (mobile) | Single-column: chat with collapsible thumbnail map |

---

## 8. Technical Architecture

### 8.1 Platform Overview

Nature Risk is delivered as a **static GitHub Pages site** — zero backend infrastructure, zero server costs, maximum auditability. All dynamic computation is performed client-side or via minimal serverless edge functions.

### 8.2 Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages (Static)                     │
│                                                             │
│  ┌──────────────────┐       ┌──────────────────────────┐   │
│  │  Chat / Co-Pilot │       │  Mapbox GL JS (right)    │   │
│  │  Pane (left)     │◄─────►│  - Polygon draw tool     │   │
│  │  - Claude API    │       │  - Asset pin drop        │   │
│  │  - Action Stream │       │  - Layer overlays        │   │
│  │  - Widgets       │       │  - Delta visualisation   │   │
│  └────────┬─────────┘       └──────────────────────────┘   │
│           │                                                 │
│  ┌────────▼─────────┐                                       │
│  │  WASM Physics    │                                       │
│  │  Engine          │                                       │
│  │  - Flow attn.    │                                       │
│  │  - Wave energy   │                                       │
│  │  - Retention Δ  │                                       │
│  └────────┬─────────┘                                       │
└───────────┼─────────────────────────────────────────────────┘
            │ (via Cloudflare Worker CORS proxy)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External UK Data APIs                      │
│  EA LIDAR · OS Data Hub · BGS · UKCEH · Met Office          │
│  UKHO ADMIRALTY · NTSLF · Cefas · EA RoFRS                  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Anthropic Claude API (Advisory Synthesis)                   │
│  - System prompt enforces all guardrails                     │
│  - LLM receives: physics output + data citations            │
│  - LLM produces: narrative, recommendations, disclaimers    │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Component Specifications

#### GitHub Pages (Static Hosting)
- All HTML, CSS, and JavaScript served as static assets from `/docs` directory.
- No server-side rendering; no database; no authentication server.
- All secrets (API keys) stored in environment variables injected at build time via GitHub Actions; never committed to source.

#### Mapbox GL JS (Mapping Layer)
- Version: Mapbox GL JS v3.x
- Polygon draw tool: `@mapbox/mapbox-gl-draw` for intervention polygon and asset pin input.
- Layers: basemap (Mapbox Satellite Streets), catchment boundary, flow network, risk zone fills (EA RoFRS), intervention polygon, Opportunity Zone polygons (colour-coded by impact rank), wave direction arrows, bathymetric contours.
- All layer data fetched from APIs and rendered client-side; no data written back to Mapbox.

#### WASM Physics Engine
- Language: Rust compiled to WebAssembly via `wasm-pack`.
- Responsibilities: all quantitative calculations including peak flow attenuation (Manning's equation, Green-Ampt infiltration model), wave energy dissipation (JONSWAP spectrum modification), water retention delta, erosion rate delta.
- Deterministic: given identical inputs, the engine always produces identical outputs. No stochastic elements.
- The Claude LLM layer never receives raw calculation requests; it only receives physics engine outputs to synthesise into narrative.

#### Claude API (Advisory Layer)
- Model: `claude-opus-4` for complex analysis; `claude-haiku-4` for simple triage and routing.
- System prompt encodes all guardrails (see Section 9), the "Not an Engineer" rule, confidence scoring logic, citation format, and output structure schema.
- Tool use: Claude calls defined tool functions (`fetch_ea_lidar`, `fetch_os_rivers`, `fetch_ukho_bathymetry`, `run_physics_engine`, `fetch_met_office_rainfall`, etc.). The LLM orchestrates tool calls; the tool implementations are deterministic TypeScript/Rust functions.
- The LLM never directly computes or interpolates geospatial values.

#### Cloudflare Worker (CORS Proxy)
- Lightweight edge function proxying requests from the client-side JS to UK government APIs that do not support browser CORS headers.
- Zero persistent state; no data stored.
- Rate limiting applied per client IP.
- API keys for gated sources (Met Office Weather DataHub, OS Data Hub Premium, UKHO ADMIRALTY) stored as Cloudflare Worker secrets.
- Deployed at `https://nature-risk-proxy.<account>.workers.dev/`

#### PDF Export
- Client-side PDF generation using `jsPDF` + `html2canvas`.
- No data sent to a third-party rendering service.

### 8.4 Data Flow

```
1. User Input (polygon/pin + query text)
         │
2. Input Validation (TypeScript, client-side)
         │
3. Mode Classification (Inland / Coastal / Mixed)
         │
4. Claude API call — system prompt + user input + mode
         │
5. Claude orchestrates tool calls via Cloudflare Worker:
   ├── EA LIDAR fetch
   ├── OS Open Rivers fetch
   ├── BGS Soilscapes fetch
   ├── EA RoFRS fetch
   ├── Met Office rainfall fetch
   └── (Coastal: UKHO, NTSLF, Met Office Coastal)
         │
6. WASM Physics Engine receives validated data → computes outputs
         │
7. Claude receives physics outputs + data citations → synthesises response
         │
8. Response rendered: Mapbox GL layers updated + chat widgets populated
         │
9. User optionally exports PDF
```

### 8.5 Non-Functional Requirements

| Requirement | Target | Notes |
| :--- | :--- | :--- |
| End-to-end latency | < 2 minutes | From prompt submission to final rendered output |
| API success rate | > 98% | Across all external UK data sources |
| WASM engine init time | < 500ms | On first page load |
| Mobile performance | Lighthouse ≥ 80 | Performance score on Moto G4 equivalent |
| Accessibility | WCAG 2.1 AA | Colour contrast, keyboard navigation, ARIA labels |
| CORS proxy uptime | > 99.9% | Cloudflare Workers SLA |
| Data cache staleness | ≤ 30 days | Risk baseline data refreshed monthly; staleness surfaced to user |

---

## 9. Guardrails & Safety Constraints

### 9.1 The "Not an Engineer" Rule

**Every output, without exception, must carry the following mandatory disclaimer:**

> *"These results are proxy models for directional pre-feasibility assessment only. They are not a substitute for a certified Flood Risk Assessment (FRA), structural engineering survey, regulated environmental impact assessment, or any other statutory process. Do not rely on these outputs for planning decisions, insurance, or regulatory submissions without independent professional verification."*

The disclaimer must appear:
- Inline in the chat response below every quantitative output.
- As a persistent banner in the UI.
- On every page of any exported PDF report.

### 9.2 Zero Hallucination on Geospatial Data

- The LLM must never guess, interpolate, or estimate topographical, bathymetric, or geospatial values if an API call fails or returns no data.
- On any data fetch failure, the agent must surface a `DATA_UNAVAILABLE` error to the user with: the specific data source that failed, a plain-English explanation of what data is missing, and the impact on output quality.
- The agent must never proceed to a quantitative output if a primary data source (EA LIDAR for inland; UKHO Bathymetry for coastal) is unavailable. It may produce a reduced-confidence qualitative assessment only if the user explicitly acknowledges the data gap.

### 9.3 Deterministic Physics Engine

All quantitative calculations — peak flow attenuation, wave energy dissipation, water retention delta, erosion rate delta — must be performed by the WASM physics engine, not the LLM. The LLM receives only the computed outputs for narrative synthesis.

### 9.4 Financial & Regulatory Compliance

The agent must not:
- Provide regulated financial advice as defined by the FCA (Financial Services and Markets Act 2000).
- Guarantee specific insurance premium reductions.
- Certify carbon credit yields or biodiversity net gain units for regulatory submission.
- Make representations about compliance with the Flood Re scheme, TCFD requirements, or any specific ESG rating methodology.

The agent may:
- Describe the general relationship between flood risk reduction and insurance pricing as a directional indicator.
- Reference DEFRA biodiversity net gain unit pricing data as indicative only.
- Describe how outputs may support TCFD physical risk disclosure (as one input among many).

### 9.5 Dynamic Morphology Disclosure

For all coastal outputs, the agent must explicitly state:
- The habitat type's estimated maturation timeline before full attenuation efficacy is reached.
- That inter-annual variability due to storm events introduces ± 20% uncertainty in attenuation values.
- That UKCP18 sea-level rise projections (RCP4.5 and RCP8.5) have been incorporated; that baseline outputs do not assume static sea levels.

### 9.6 Confidence Scoring (Mandatory)

Every quantitative output must include a Confidence Level (Low / Medium / High) derived from the confidence scoring framework defined in Section 5.3. The confidence score must:
- Be visible inline in the chat response.
- Include a tooltip or expandable detail listing the specific data sources used, their resolution, and their recency.
- Include an uncertainty range expressed as a percentage (e.g., ± 3%).
- Link directly to the primary data source's official URL.

### 9.7 Scientific Footnoting

Every prediction must cite its primary data source inline. Format:
> *"Modelled using [Source Name], resolution [X]m, last updated [Date], licence [Licence Type]."*

---

## 10. Success Metrics & KPIs

| Category | Metric | Target | Measurement Method |
| :--- | :--- | :--- | :--- |
| **Business Impact** | Time-to-Case | < 15 minutes | Session timing from first input to PDF export |
| **Business Impact** | Report Export Rate | > 15% | PDF export events / total sessions |
| **Business Impact** | Scenarios per Session | > 3 | Average number of distinct analysis runs per user session |
| **Technical** | End-to-End Latency | < 2 minutes | P95 latency from prompt submission to final rendered output |
| **Technical** | API Success Rate | > 98% | Proportion of external API calls returning 200 OK (sampled) |
| **Technical** | CORS Proxy Uptime | > 99.9% | Cloudflare Worker uptime monitoring |
| **Agentic** | Mode Routing Accuracy | > 99% | Quarterly evaluation against labelled test coordinate dataset |
| **Agentic** | Hallucination Rate | 0% | Automated regression test suite confirming no fabricated geospatial values |
| **Agentic** | Guardrail Compliance | 100% | Automated check that all outputs include required disclaimer text |
| **User Engagement** | Session Depth | > 3 analysis runs | Analytics event tracking per session |
| **Conversion** | Feasibility Study Requests | Tracked | CTA click-through from export screen to contact/enquiry form |

---

## 11. Phased Roadmap

### Phase 1 — Inland MVP (v1.0) — River Severn

**Objective:** Prove the core inland hydrological analysis flow for a single priority UK catchment.

**Geography:** River Severn catchment (priority rationale: highest documented corporate flood exposure of any UK catchment; Bewdley and Worcester well-documented flood events; strong EA data coverage).

**Capabilities:**
- Asset Manager flow: drop a pin, receive ranked upstream Opportunity Zones.
- Project Developer flow: draw a polygon, receive downstream beneficiary asset list.
- Intervention types: tree planting, peat restoration, leaky dams, floodplain reconnection.
- Interactive widgets: Risk Delta dial, Hydrograph, Confidence Badge, Uncertainty Range.
- PDF export (basic format).

**Data Integrations:**
- EA LIDAR Composite (1m/2m)
- OS MasterMap Topography Layer
- OS Open Rivers
- EA RoFRS (Risk of Flooding from Rivers and Sea)
- BGS Soilscapes
- UKCEH Land Cover Map
- Met Office Weather DataHub (rainfall)
- UKCP18 Projections

**Technical Deliverables:**
- GitHub Pages static site scaffold
- Mapbox GL split-screen Co-Pilot + Map interface
- WASM physics engine v1 (inland hydrology module)
- Cloudflare Worker CORS proxy
- Claude API integration with inland system prompt and tool definitions
- Basic PDF export

**Success Gate for Phase 2:** Mode routing accuracy > 99% on test dataset; zero hallucination failures in regression suite; end-to-end latency < 2 minutes for 95th percentile; at least 3 Opportunity Zone cards produced for any valid Severn Basin coordinate.

---

### Phase 2 — Blue Carbon & Coastal (v1.5)

**Objective:** Extend the platform to coastal and estuarine environments with full wave attenuation and erosion modelling.

**Capabilities (new):**
- "Draw a Reef/Saltmarsh" polygon tool in Mapbox GL.
- Coastal mode detection and automatic routing.
- Wave attenuation calculation (oyster reef, seagrass, saltmarsh, combined).
- Storm surge height reduction modelling.
- Erosion risk delta over 25-year horizon.
- UKCP18 sea-level rise scenario overlays (2050, 2070, 2100) on map.
- Dynamic morphology disclosure widgets.
- Coastal confidence scoring.
- PDF export updated with coastal output templates.

**New Data Integrations:**
- UKHO ADMIRALTY Marine Data Portal (Bathymetry)
- Cefas/EA Saltmarsh Extents
- Project Seagrass / Ocean Conservation Trust data
- NTSLF tidal gauge data
- Met Office CS3X/WaveNet Coastal Models
- EA NCERM (National Coastal Erosion Risk Mapping)
- Channel Coastal Observatory (Regional Coastal Monitoring)

**Technical Deliverables:**
- WASM physics engine v2 (coastal marine module added)
- Coastal tool definitions added to Claude API system prompt
- Mapbox GL coastal layers (bathymetric contours, wave direction arrows, erosion risk polygons)
- Extended Cloudflare Worker to proxy UKHO and NTSLF APIs

**Success Gate for Phase 3:** Wave attenuation model validated against at least one published case study (e.g., published saltmarsh wave attenuation data from EA/Cefas); coastal mode routing accuracy > 99%; no dynamic morphology disclosure violations in QA suite.

---

### Phase 3 — Financial Layer (v2.0)

**Objective:** Produce investment-grade, Board-ready financial outputs that enable direct capital allocation decisions.

**Capabilities (new):**
- £ GBP value of Avoided Loss per protected asset, using insurance loss modelling benchmarks (JBA or Fathom API integration TBD).
- Biodiversity Net Gain unit uplift valuation for inland intervention polygons (DEFRA BNG pricing).
- Structured investment memo section in PDF export (formatted for Board paper or private placement memorandum).
- Carbon sequestration indicative value (directional, not certified) for peatland and woodland interventions.
- Portfolio screening mode: batch input of multiple assets, comparative NbS pipeline output.

**New Data Integrations:**
- JBA Flood Maps API or Fathom Global Flood Model (commercial, evaluated)
- DEFRA/Natural England Biodiversity Net Gain pricing (API TBD)
- Insurance loss benchmark data (partnership TBD)

**Technical Deliverables:**
- Financial calculation module added to WASM engine or separate TypeScript service
- PDF export v3 with investment memo template
- Portfolio batch input UI
- Enhanced Claude system prompt with financial layer guidance and stricter FCA compliance guardrails

**Success Gate:** At least one corporate pilot user has used Phase 3 output as an input to a Board investment memo or NbS procurement process.

---

## 12. Open Questions & Assumptions

| # | Question | Owner | Assumed Default | Priority |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Which specific sub-catchment within the River Severn is the Phase 1 pilot geography? | Product / BD | Upper Severn / Bewdley gauge catchment (highest documented corporate exposure) | High |
| 2 | What is the minimum polygon size for a valid intervention, by intervention type? | Science | 0.5 ha for tree planting; 0.25 ha for peat restoration; 10m channel length for leaky dams (to be validated with environmental scientists) | High |
| 3 | How frequently should risk baseline data be refreshed from EA APIs, and how is cache staleness surfaced? | Engineering | Monthly refresh; staleness warning surfaced in Confidence Badge tooltip if cached data > 30 days old | Medium |
| 4 | Phase 3 financial model: in-house or third-party API (JBA vs Fathom)? | Product | Evaluate JBA Flood Maps API first; Fathom as backup if JBA commercial terms are unfavourable | High (Phase 3) |
| 5 | UKHO ADMIRALTY data: what is the licence for browser-client API calls, and does it permit direct calls through the Cloudflare proxy? | Legal / Engineering | Assume commercial licence required; budget for this in Phase 2 | High (Phase 2) |
| 6 | Will the agent support non-UK geographies in a future version? | Product | Out of scope for v1.0–v2.0; flag for v3.0 planning | Low |
| 7 | Seagrass data from Project Seagrass / Ocean Conservation Trust: is there a stable programmatic API, or is manual download required? | Engineering | Assume manual download + hosted GeoJSON initially; investigate WMS/WFS for Phase 2 | Medium (Phase 2) |
| 8 | PDF export: acceptable to use client-side jsPDF, or is a server-side render required for production quality? | Engineering / Product | jsPDF for Phase 1 MVP; evaluate Puppeteer/server-side render if PDF quality is insufficient for Board papers | Medium |
| 9 | Authentication: does the Phase 1 MVP require user accounts, or is it fully anonymous? | Product | Fully anonymous Phase 1; consider optional account creation in Phase 2 for session persistence | Low (Phase 1) |
| 10 | FEH Web Service licence: confirm commercial use terms for UKCEH FEH Web Service before Phase 1 launch | Legal | Assumed licenced (academic/commercial tier); confirm terms with UKCEH | High |

---

*This Master PRD supersedes all prior draft PRD documents. It should be reviewed alongside the companion System Prompt specification, which defines the agent's internal reasoning logic, tool-calling schema, and error-handling behaviour. Document owner: Product. Review cycle: quarterly or following any material change to UK data source APIs.*
