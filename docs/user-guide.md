# Nature Risk — User Guide

**Version:** 1.0
**Date:** 2026-03-17

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Asset Manager Flow](#2-asset-manager-flow)
3. [Project Developer Flow](#3-project-developer-flow)
4. [Understanding Results](#4-understanding-results)
5. [Exporting Reports](#5-exporting-reports)
6. [Demo Mode vs Live Mode](#6-demo-mode-vs-live-mode)
7. [Frequently Asked Questions](#7-frequently-asked-questions)
8. [Glossary](#8-glossary)

---

## 1. Getting Started

### What is Nature Risk?

Nature Risk is a dual-mode geospatial engine that quantifies how nature-based solutions (NbS) — inland and coastal — reduce physical climate risks to specific corporate and infrastructure assets across the United Kingdom. It compresses what would typically be a three-month environmental consultancy engagement into a fifteen-minute interactive session.

The tool produces **directional, evidence-cited pre-feasibility analysis** — not regulated advice — enabling early-stage investment decisions in nature-based solutions. Every quantitative output is produced by a deterministic physics engine, cited to primary UK open-data sources, and accompanied by a transparent confidence score.

### Who is it for?

| User | Goal |
|------|------|
| **Corporate Asset Managers** | Identify which nature-based investments would most directly reduce flood or coastal risk to owned or leased assets |
| **Nature Project Developers** | Demonstrate which corporate assets benefit from a proposed restoration project, and by how much, to unlock private investment |
| **ESG / Infrastructure Investors** | Screen and compare risk-reduction efficacy of NbS investments across a portfolio |
| **Local Authorities** | Assess flood resilience investment options across their geography |

### System Requirements

Nature Risk runs entirely in your web browser. No software installation is required.

- **Browser:** A modern browser with WebAssembly support (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)
- **Screen:** Desktop or laptop recommended (minimum 1280 px width for the split-screen experience); tablet and mobile layouts are supported
- **Internet:** An active internet connection (required for map tiles and UK data API queries)

### The Interface

The application uses a **"Co-Pilot + Map"** split-screen layout:

- **Left pane (40% on desktop):** The conversational AI co-pilot, showing the Action Stream, interactive data widgets, analysis results, and export controls.
- **Right pane (60% on desktop):** A dynamic map visualisation showing terrain, flood zones, intervention polygons, flow paths, and risk overlays. The map updates in real time as the analysis progresses.

On tablets, the layout stacks vertically. On mobile devices, the map collapses to a tappable thumbnail.

---

## 2. Asset Manager Flow

Use this flow when you have a **specific asset** (factory, substation, data centre, port, road junction) and want to discover where upstream or offshore restoration would best protect it.

### Step 1 — Place an Asset Pin

Click or tap on the map to drop a pin at your asset's location. A dialogue will ask you to:

- **Label the asset** (e.g., "Bewdley substation")
- **Select the asset type** from the dropdown: Factory, Substation, Data Centre, Port, Road Junction, Sea Wall, Coastal Road, Building, or Other
- **Add a brief description** (optional but helpful for the AI advisory)

The map will centre on your pin and display surrounding context.

### Step 2 — Select Analysis Mode (Automatic)

The system automatically classifies your location as **Inland**, **Coastal**, or **Mixed** based on proximity to the UK coastline:

- **Inland:** More than 5 km from the Mean High Water Spring (MHWS) line
- **Coastal:** Within 5 km of the MHWS line
- **Mixed:** Transitional or estuarine zones (5–15 km from the coast, in EA Tidal Flood Zone 3)

The detected mode is displayed in the Action Stream. You do not need to select it manually.

### Step 3 — Run the Analysis

Type a question in the co-pilot pane, such as:

> *"What upstream restoration would best protect this asset from flood risk?"*

Or simply click the **Run Analysis** button. The Action Stream will show each step as it progresses:

1. **Validating inputs** — Confirms UK location and asset details
2. **Classifying analysis mode** — Routes to the correct toolchain
3. **Fetching UK environmental data** — Queries EA LIDAR, OS Open Rivers, BGS Soilscapes, EA RoFRS, and Met Office rainfall data in parallel
4. **Running physics engine** — Executes the deterministic WASM physics engine
5. **Synthesising AI advisory** — Claude AI produces a plain-English narrative

### Step 4 — View Results

Once complete, the interface updates with:

**On the map (right pane):**
- Catchment boundary polygon
- Flow path network (rivers and surface water routes)
- Colour-coded Opportunity Zone polygons ranked High / Medium / Low

**In the co-pilot (left pane):**
- A ranked list of upstream Opportunity Zones with intervention type, predicted peak flow reduction, and confidence score
- Interactive widgets: Risk Delta dial, Hydrograph chart, Confidence Badge, Uncertainty Range
- Inline citations to every data source used

### Step 5 — Explore and Adjust

- **Click an Opportunity Zone** on the map to view its detailed analysis
- **Change the intervention type** (e.g., tree planting to peat restoration) using the dropdown widget — the physics engine reruns and results update in real time
- **Adjust the return period** on the Hydrograph chart (1-in-10 to 1-in-200 year)

### Step 6 — Export

Click **Export to PDF** to generate a board-ready pre-feasibility report. See [Section 5](#5-exporting-reports) for details.

---

## 3. Project Developer Flow

Use this flow when you have a **proposed restoration project** (wetland, peatland, reef, saltmarsh) and want to discover which downstream or onshore assets benefit from it.

### Step 1 — Draw an Intervention Polygon

Use the polygon draw tool on the map toolbar to outline the boundary of your proposed intervention. The polygon must:

- Be located within the UK
- Have an area of at least **0.5 hectares** (the system will warn if it is below the recommended minimum of 2 ha)

### Step 2 — Select the Intervention Type

Choose the type of nature-based solution you are proposing:

**Inland interventions:**
- Tree Planting / Reforestation
- Peat Restoration
- Leaky Dams / Woody Debris Dams
- Floodplain Reconnection
- Riparian Buffer Strips

**Coastal interventions:**
- Oyster / Shellfish Reef
- Seagrass Meadow Restoration
- Saltmarsh Restoration
- Combined Reef + Saltmarsh

The system will perform **spatial validation**, checking whether the intervention type is suitable for the geology and habitat at that location. If unsuitable, it will suggest alternatives (e.g., *"Soil type is thin rendzina — unsuitable for peat restoration; a leaky dam network would be more effective at this location."*).

### Step 3 — Place the Target Asset Pin

Drop a pin on the downstream or onshore asset you wish to assess the benefit for. This could be a town, road, industrial site, or coastal infrastructure.

### Step 4 — Run the Analysis

Type a question or click **Run Analysis**. The Action Stream will display progress for each step.

### Step 5 — View Results

**Inland results include:**
- Estimated reduction in peak flood height (metres) at the target asset
- Delay in flood peak arrival (hours)
- Percentage reduction in peak flow rate
- Confidence score with uncertainty range
- 25-year and 50-year projections under UKCP18 scenarios

**Coastal results include:**
- Predicted reduction in wave energy (%) at the onshore asset
- Predicted reduction in storm surge height (metres)
- Erosion risk delta over a 25-year horizon (metres of shoreline retreat avoided)
- Habitat suitability score
- Habitat maturation timeline
- Confidence score with citations

### Step 6 — Export

Click **Export to PDF** to download your report.

---

## 4. Understanding Results

### Confidence Scores

Every quantitative output carries a confidence level:

| Level | What it means | Typical trigger |
|-------|--------------|-----------------|
| **High** | All primary data sources available; resolution ≤ 2 m; data recency ≤ 12 months | EA LIDAR 1 m available; all APIs returned successfully |
| **Medium** | One or more secondary sources unavailable; resolution 2–10 m; data recency 12–36 months | OS Terrain 50 used; some cached data |
| **Low** | Multiple APIs unavailable; coarse national datasets; data recency > 36 months | LIDAR unavailable; fallback to simplified models |

Click the **Confidence Badge** widget to expand full data provenance — which datasets were used, their resolution, recency, and licence.

### Uncertainty Ranges

Every numerical result includes an uncertainty range, expressed as a percentage:

> *"Peak flow reduction: 12% +/- 3%"*

The +/- value is computed from the resolution of the input data and the sensitivity of the physics model to parameter variation. Hover over the **Uncertainty Range** widget for a tooltip explaining the basis.

### Citations

Every factual claim in the advisory narrative is cited inline using the format:

> *"Modelled using [EA LIDAR Composite], resolution 1 m, last updated 2025-06, licence Open Government Licence."*

Click any citation to open the data source's official page.

### The Disclaimer

All outputs include the following mandatory disclaimer:

> *"These results are proxy models for directional pre-feasibility assessment only. They are not a substitute for a certified Flood Risk Assessment (FRA), structural engineering survey, regulated environmental impact assessment, or any other statutory process. Do not rely on these outputs for planning decisions, insurance, or regulatory submissions without independent professional verification."*

This disclaimer appears inline in every analysis response, as a persistent UI banner, and on every page of exported PDF reports.

---

## 5. Exporting Reports

### What the PDF Includes

The one-click PDF export generates a report containing:

- **Header:** Date, time, analysis mode, and asset details
- **Map renders:** Static images of the map at each analysis stage
- **Widget outputs:** Risk Delta dial, Hydrograph chart, and all numerical results
- **AI advisory narrative:** The full plain-English synthesis
- **Data provenance table:** Every data source used, with resolution, recency, and licence
- **Confidence assessment:** Score, uncertainty ranges, and explanation
- **Audit trail:** A chronological log of all domain events (input placed, mode classified, data fetched, physics calculated, advisory synthesised)
- **Mandatory disclaimers:** On every page
- **Pre-feasibility summary:** A structured section formatted for inclusion in a Board investment memo

### How to Export

1. Complete an analysis (the Export button becomes active once the analysis reaches the "complete" state)
2. Click **Export to PDF** in the co-pilot pane
3. The PDF is generated entirely client-side — no data is sent to any external server
4. Your browser will prompt you to save or open the file

---

## 6. Demo Mode vs Live Mode

### Demo Mode (Default)

When you first open Nature Risk, it operates in **Demo Mode**. In this mode:

- The physics engine runs normally, producing real calculations based on your inputs
- UK data APIs are queried where CORS is supported (e.g., EA flood zones); other data sources use location-aware indicative values
- The AI advisory narrative is generated locally from a template, not from a live Claude API call
- A banner indicates: *"Demo Mode Active — configure an API key to enable live Claude advisory"*

Demo Mode is fully functional for exploring the tool and understanding its capabilities.

### Live Mode

To enable Live Mode with full Claude AI advisory:

1. Click the **Settings** icon (gear) in the co-pilot pane
2. Enter your **Cloudflare Worker proxy URL** (provided by your organisation or self-hosted; see the [Deployment Guide](deployment-guide.md))
3. Optionally enter your **Anthropic API key** directly (stored in sessionStorage only — never persisted to disk or sent anywhere except Anthropic's API)
4. Click **Save Configuration**

In Live Mode:
- Claude AI produces bespoke plain-English advisory narratives
- Spatial validation is enriched with contextual ecological insights
- Scale warnings include domain-specific guidance

### Switching Between Modes

- If the API key or proxy URL becomes unavailable (network error, rate limit, expired key), the system gracefully falls back to Demo Mode and indicates this in the output
- Clearing the API key and proxy URL in Settings returns you to Demo Mode
- API keys are stored in `sessionStorage` only — they are automatically cleared when you close the browser tab

---

## 7. Frequently Asked Questions

### General

**Q: Is this a Flood Risk Assessment (FRA)?**
No. Nature Risk produces directional pre-feasibility analysis only. It is not a substitute for a certified FRA, structural engineering survey, or regulated environmental impact assessment. Always obtain independent professional verification before making planning, insurance, or regulatory decisions.

**Q: Does Nature Risk work outside the UK?**
No. The tool is designed exclusively for the United Kingdom. It relies on UK-specific data sources (Environment Agency, Ordnance Survey, British Geological Survey, Met Office, UKHO) and UK-specific physics models. Non-UK locations will be rejected by the input validation.

**Q: Is my data stored anywhere?**
No. Nature Risk is a static website with no backend database. Your inputs, results, and API keys are processed entirely in your browser. The optional Cloudflare Worker proxy passes API requests through but stores no data. Session data is lost when you close the browser tab.

**Q: How current is the data?**
Data freshness varies by source. EA LIDAR is surveyed irregularly (typically within the last 1–3 years). EA flood zones are updated every 2 years. UKCP18 projections are from the 2018 release. The Confidence Badge tooltip shows the recency of each data source used in your analysis.

### Technical

**Q: Why is the analysis taking a long time?**
The analysis queries multiple UK government APIs in parallel. If one or more APIs are slow or temporarily unavailable, the overall analysis may take up to 2 minutes. The Action Stream shows which step is running.

**Q: What happens if a data source is unavailable?**
The system surfaces a `DATA_UNAVAILABLE` error with a plain-English explanation of which data is missing and how it affects the result quality. It never guesses, interpolates, or fabricates geospatial data. If a primary source (e.g., EA LIDAR for inland, UKHO bathymetry for coastal) is unavailable, the analysis halts rather than producing unreliable numbers.

**Q: Can I use the tool on my phone?**
Yes, though the full experience is optimised for desktop. On mobile, the map collapses to a thumbnail and the co-pilot pane takes priority. Drawing polygons is easier with a mouse or stylus.

### Data and Science

**Q: What physics models does the engine use?**
- **Inland:** Manning's equation for open-channel flow, Green-Ampt infiltration model, catchment water balance
- **Coastal:** Linear vegetation drag model (Dalrymple et al. 1984), JONSWAP spectrum modification, exponential wave energy decay

**Q: Why does my confidence score show "Low"?**
A Low confidence score typically indicates that multiple data sources were unavailable, the analysis fell back to coarse national datasets, or the data is more than 36 months old. Check the Confidence Badge tooltip for specifics.

**Q: How are UKCP18 climate scenarios used?**
All inland and coastal projections incorporate UKCP18 data. By default, results are shown under the RCP 8.5 (high emissions) scenario. The physics engine applies UKCP18 rainfall intensification factors for inland analyses and sea-level rise projections for coastal analyses.

---

## 8. Glossary

| Abbreviation | Full Name | Description |
|-------------|-----------|-------------|
| **NbS** | Nature-based Solution | An intervention that works with natural processes to reduce climate risk (e.g., wetland creation, reef restoration) |
| **MHWS** | Mean High Water Spring | The average level of the two successive highest high waters during spring tides; used as the boundary between land and sea |
| **RoFRS** | Risk of Flooding from Rivers and Sea | Environment Agency dataset mapping flood zone polygons across England |
| **FEH** | Flood Estimation Handbook | UKCEH methodology and dataset for estimating peak river flows at any UK location |
| **UKCP18** | UK Climate Projections 2018 | Met Office probabilistic climate change dataset, providing rainfall, temperature, and sea-level rise scenarios to 2100 |
| **RCP** | Representative Concentration Pathway | A greenhouse gas concentration trajectory adopted by the IPCC. RCP 4.5 represents a moderate mitigation scenario; RCP 8.5 represents high emissions |
| **EA** | Environment Agency | The UK government body responsible for flood risk management and environmental regulation in England |
| **OS** | Ordnance Survey | The UK's national mapping agency |
| **BGS** | British Geological Survey | The UK's geological data authority |
| **UKCEH** | UK Centre for Ecology & Hydrology | Research centre responsible for the Land Cover Map and FEH Web Service |
| **UKHO** | United Kingdom Hydrographic Office | The UK authority for marine geospatial data, operating the ADMIRALTY data portal |
| **NTSLF** | National Tide and Sea Level Facility | The UK network of tidal observation gauges, operated by BODC |
| **BODC** | British Oceanographic Data Centre | National repository for UK marine data |
| **NCERM** | National Coastal Erosion Risk Mapping | Environment Agency dataset mapping coastal erosion risk across England |
| **Cefas** | Centre for Environment, Fisheries and Aquaculture Science | UK government agency providing marine and environmental data |
| **FRA** | Flood Risk Assessment | A certified engineering document required for planning applications in flood-risk areas. Nature Risk outputs are **not** an FRA |
| **BNG** | Biodiversity Net Gain | A regulatory metric (UK Environment Act 2021) measuring habitat improvement in biodiversity units |
| **TCFD** | Task Force on Climate-related Financial Disclosures | Framework for reporting climate-related financial risks; Nature Risk outputs may support TCFD physical risk disclosure as one input among many |
| **WASM** | WebAssembly | A portable binary format for executable code that runs in the browser at near-native speed |
| **CORS** | Cross-Origin Resource Sharing | A browser security mechanism controlling which websites can access APIs hosted on other domains |
| **SPA** | Single-Page Application | A web application that loads once and dynamically updates content without full page reloads |
| **mAOD** | Metres Above Ordnance Datum | The standard height reference used in UK mapping (approximately mean sea level at Newlyn) |

---

*For technical documentation, see the [Developer Guide](developer-guide.md). For API details, see the [API Reference](api-reference.md). For deployment instructions, see the [Deployment Guide](deployment-guide.md).*
