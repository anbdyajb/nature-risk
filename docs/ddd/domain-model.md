# Nature Risk — Domain-Driven Design: Domain Model

**Version:** 1.0
**Date:** 2026-03-17
**Status:** Authoritative
**Scope:** All phases (Phase 1 Inland MVP through Phase 3 Financial Layer)

---

## Table of Contents

1. [Ubiquitous Language Glossary](#1-ubiquitous-language-glossary)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Context Map](#3-context-map)
4. [Aggregates](#4-aggregates)
5. [Domain Events](#5-domain-events)
6. [Repository Interfaces](#6-repository-interfaces)
7. [Application Services](#7-application-services)

---

## 1. Ubiquitous Language Glossary

This glossary defines every term used across the codebase, user interfaces, and team conversations. All code — variable names, function names, type names — MUST use these exact terms. Synonyms or informal alternatives are listed only to identify terms that must NOT appear in code.

### Core Spatial Terms

| Term | Definition | Do Not Use |
|------|-----------|------------|
| **Asset** | A specific corporate or infrastructure entity (factory, port, road, substation, building) at a known geographic location that is exposed to climate-related physical risk. An Asset has a type, a location, and a set of current risk scores. | "property", "site", "location" (in isolation) |
| **AssetPin** | The user-supplied geographic point (latitude/longitude) that identifies the Asset in the Asset Manager user flow. | "marker", "pin", "dropped pin" |
| **InterventionPolygon** | A user-drawn geographic polygon defining the physical extent of a proposed Nature-based Solution (NbS). Minimum valid area is 0.5 ha. | "drawing", "shape", "area", "zone" |
| **Coordinates** | A value object holding a WGS-84 longitude/latitude pair, expressed to six decimal places. All coordinate inputs are normalised to WGS-84. | "lat/lng", "point", "position" |
| **BritishNationalGrid** | The OSGB36 coordinate system used by Ordnance Survey. All OS data is received in BNG and converted to WGS-84 at the Anti-Corruption Layer. | "OSGB", "easting/northing" |
| **ElevationProfile** | A value object representing a cross-section of terrain elevations along a given transect, expressed in metres above Ordnance Datum (mAOD). | "height profile", "terrain slice" |
| **CatchmentBoundary** | The topographic watershed boundary that defines which land area drains to a specific river reach or outlet point. Derived from EA LIDAR and OS Open Rivers data. | "watershed", "drainage area" |
| **FlowPath** | A directed sequence of Coordinates along which surface water travels under gravity from an upstream point to a downstream outlet. Computed using LIDAR-derived digital elevation models. | "river path", "drainage path", "flow route" |
| **UpstreamOpportunityZone** | An area within a CatchmentBoundary, hydrologically connected to the target Asset's FlowPath, where a natural capital intervention would produce a measurable risk reduction at the Asset. The primary output in Asset Manager mode. | "restoration zone", "intervention area" |
| **OpportunityZoneRank** | The ordinal position of an UpstreamOpportunityZone in a list ordered by descending predicted RiskDelta at the target Asset. | "priority rank", "score rank" |

### Hydrological Terms

| Term | Definition | Do Not Use |
|------|-----------|------------|
| **WatershedIntervention** | A proposed inland NbS within a CatchmentBoundary, typed as one of: TreePlanting, PeatRestoration, LeakyDam, FloodplainReconnection, or WetlandCreation. | "inland project", "green infrastructure" |
| **SoilProfile** | A value object describing the soil characteristics at a location, sourced from BGS Soilscapes: permeability class, organic matter content, compaction risk, and saturation capacity. | "soil type", "ground conditions" |
| **LandCoverZone** | An area with a homogeneous land cover classification per the UKCEH Land Cover Map (e.g., Improved Grassland, Broadleaved Woodland, Cultivated Land). | "land use", "habitat type" |
| **RetentionDelta** | A value object expressing the change in water storage capacity (m3 per hectare) of a land parcel resulting from a WatershedIntervention, computed from SoilProfile and LandCoverZone baseline data. | "storage change", "retention change" |
| **PeakFlowAttenuation** | The reduction in peak discharge (m3/s) at the target Asset resulting from one or more WatershedInterventions, expressed as an absolute value and a percentage of the unmitigated peak discharge. | "flow reduction", "flood damping" |
| **FloodHeightDelta** | The reduction in predicted flood water surface elevation (metres) at the Asset location, derived from PeakFlowAttenuation via a stage-discharge relationship specific to the reach. | "flood level change", "stage reduction" |
| **FloodPeakDelay** | The additional time (hours) by which a WatershedIntervention delays the arrival of peak flow at the Asset, giving emergency services more lead time. | "peak delay", "lag time" |
| **HydrologicalConnection** | A validated boolean assertion that an InterventionPolygon is hydrologically connected to the target Asset via a FlowPath — i.e., water from the intervention area will flow through or into the Asset's CatchmentBoundary. | "upstream connection", "connectivity" |
| **BaselineFloodRisk** | The current (pre-intervention) probability of flooding at the Asset for a given return period (1-in-100-year, 1-in-200-year), sourced from EA RoFRS. | "current risk", "existing risk" |
| **UKCP18** | UK Climate Projections 2018. The Met Office probabilistic climate change dataset used as the authoritative source for future rainfall intensification and sea-level rise scenarios in all calculations. Never use static baselines where UKCP18 data is available. | "climate projections", "met office data" |
| **FRA** | Flood Risk Assessment. A certified document produced by a qualified engineer. The agent's outputs explicitly are NOT an FRA; this term is used only in disclaimers. | — |

### Marine Terms

| Term | Definition | Do Not Use |
|------|-----------|------------|
| **CoastalIntervention** | A proposed offshore or intertidal NbS, typed as one of: OysterReef, SeagrassmeadowRestoration, SaltmarshRestoration, MangroveRestoration, or CoralRestoration. | "marine project", "blue infrastructure" |
| **MarineHabitat** | An existing classified intertidal or subtidal habitat at a known location and extent, sourced from Cefas Saltmarsh Extents or Project Seagrass data. | "marine ecosystem", "offshore habitat" |
| **ErosionZone** | A coastal area identified as actively eroding or at risk of erosion within a 25-year horizon, per EA NCERM classification. | "eroding coast", "coastal risk area" |
| **BathymetryProfile** | A value object representing the underwater depth contours and seabed composition for a given coastal area, sourced from UKHO ADMIRALTY data. | "seabed profile", "depth data" |
| **WaterSlope** | A value object expressing the gradient of the seafloor (rise/run) in a given direction, derived from BathymetryProfile. This governs wave shoaling and breaking behaviour. | "seabed slope", "bathymetric gradient" |
| **WaveEnergyDelta** | The percentage reduction in wave energy (Joules per square metre) reaching the shore or Asset, attributable to a CoastalIntervention, computed using the deterministic WASM physics engine. | "wave reduction", "energy dissipation" |
| **StormSurgeReduction** | The reduction in peak storm surge water level (metres) at a coastal Asset attributable to a CoastalIntervention. | "surge reduction", "tidal surge attenuation" |
| **ErosionRiskDelta** | The change in annual erosion rate (metres per year) at an ErosionZone attributable to a CoastalIntervention, over a 25-year projection horizon incorporating UKCP18 sea-level rise. | "erosion change", "sediment delta" |
| **SedimentStabilisation** | The process by which a CoastalIntervention (typically saltmarsh or seagrass) traps and binds sediment, reducing bed and bank erosion. Measured as a SedimentAccretionRate value object. | "sediment trapping", "seabed stabilisation" |
| **SedimentAccretionRate** | A value object expressing the net rate of sediment deposition (mm/year) within a CoastalIntervention area. | "deposition rate" |
| **SeaLevelRiseScenario** | One of the UKCP18 probabilistic sea-level rise scenarios (RCP 2.6, RCP 4.5, RCP 8.5) applied to all coastal calculations. The default scenario used in displayed outputs is RCP 4.5 unless the user overrides. | "sea level projection", "climate scenario" |
| **NTSLFTideGauge** | A tidal observation record from the National Tide and Sea Level Facility network, used to calibrate storm surge predictions. | "tide gauge data", "tidal record" |

### Analysis and Output Terms

| Term | Definition | Do Not Use |
|------|-----------|------------|
| **RiskDelta** | The aggregate change in a specific risk metric (FloodHeightDelta, WaveEnergyDelta, ErosionRiskDelta, StormSurgeReduction) at the Asset attributable to a specific NbS intervention. Always expressed as a directional value with an UncertaintyRange. | "risk change", "risk reduction" |
| **ConfidenceScore** | A categorical assessment (Low / Medium / High) of the reliability of a RiskDelta or any other model output, based on the spatial resolution, recency, and completeness of the underlying data sources. Every output MUST carry a ConfidenceScore. | "reliability", "certainty level" |
| **UncertaintyRange** | A quantitative interval expressing the variability of a model output, e.g., "12% ± 3%". Computed from source data resolution and model parameter sensitivity. | "error range", "margin of error" |
| **DataSource** | A reference to a specific external UK government dataset or API used in a calculation, including name, version or update date, and URL. | "source", "reference" |
| **DataUnavailableError** | A domain event raised when a required external API call fails or returns no data for the requested location. The WASM physics engine and LLM advisory layer must never substitute estimated values; they must surface this error to the user. | "API error", "no data" |
| **PreFeasibilityReport** | The primary output document of a completed analysis session. Contains: user inputs, DataSources, RiskDelta results, ConfidenceScores with UncertaintyRanges, inline citations, a mandatory engineering disclaimer, and (in Phase 3) AvoidedLossCost estimates. Formatted for export as a PDF suitable for Board-level investment memos. | "report", "output document", "analysis" |
| **ConfidenceAssessment** | The entity that aggregates the ConfidenceScore, UncertaintyRange, and DataSource citations for a specific section of a PreFeasibilityReport. | "confidence section", "reliability section" |
| **NbS** | Nature-based Solution. The umbrella term for any intervention that works with natural processes to reduce climate risk. In this domain, NbS includes both WatershedInterventions and CoastalInterventions. | "nature-based solution" (acronym only in code) |
| **BNG** | Biodiversity Net Gain. A regulatory metric (mandated by the UK Environment Act 2021) expressing the improvement in habitat value attributable to an NbS intervention, measured in biodiversity units. Used in Phase 3 financial calculations. | "biodiversity gain" (acronym only in code) |
| **AvoidedLossCost** | Phase 3 only. The estimated GBP monetary value of climate-related asset damage prevented by an NbS intervention over a defined horizon, derived from insurance loss benchmarks. | "financial benefit", "ROI value" |
| **InvestmentMemo** | Phase 3 only. A structured section of the PreFeasibilityReport containing AvoidedLossCost estimates, BNG unit valuations, and a recommended capital allocation range. Explicitly marked as NOT regulated financial advice. | "business case", "financial analysis" |

### Advisory and Interaction Terms

| Term | Definition | Do Not Use |
|------|-----------|------------|
| **AnalysisMode** | The operating mode of a session: `InlandMode` (triggered when input coordinates are not in a coastal zone) or `CoastalMode` (triggered when coordinates are in a coastal zone) or `MixedMode` (both). Mode is determined automatically by the ModeRouter domain service and may be overridden by the user. | "mode", "type", "scenario type" |
| **AdvisorySession** | The aggregate that represents a single user interaction session, tracking the sequence of user inputs, tool calls, domain events, and generated outputs. | "session", "user session", "chat session" |
| **SpatialValidation** | The process of checking whether an InterventionPolygon is suitable for the proposed NbS type given the SoilProfile, LandCoverZone, and BathymetryProfile at that location. Produces a ValidationResult. | "spatial check", "location validation" |
| **ValidationResult** | A value object returned by SpatialValidation: either `Valid`, `InvalidWithSuggestion` (includes an alternative NbS type), or `Insufficient` (polygon too small, with minimum viable area suggestion). | "validation outcome", "check result" |
| **ScaleWarning** | A domain event raised when an InterventionPolygon is too small to produce a statistically significant RiskDelta, accompanied by the minimum viable area for the proposed NbS type. | "size warning", "area warning" |
| **RoutingDecision** | The output of the ModeRouter domain service: which AnalysisMode and which toolchain (Inland, Coastal, or Mixed) to invoke for a given set of user inputs. | "routing result", "mode selection" |
| **ActionStream** | The ordered, real-time log of tool calls and intermediate results displayed in the chat pane as a collapsing checklist during an active analysis. Not a domain concept but a UI projection of domain events. | "activity log", "progress log" |

---

## 2. Bounded Contexts

### 2a. Geospatial Context

**Responsibility:** All coordinate system management, raw spatial data ingestion, terrain analysis, catchment delineation, flow path computation, and bathymetry processing. This context owns the canonical representations of geographic space. All other contexts depend on Geospatial, never the reverse.

**Key External APIs consumed:**
- EA LIDAR Composite (1m/2m resolution digital elevation models)
- OS Data Hub (Terrain 50/5, Open Rivers, MasterMap vector tiles)
- UKHO ADMIRALTY Marine Data Portal (bathymetry grids)

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `Location` | `LocationId` (UUID) | A named geographic point — either an AssetPin or a derived reference point. Holds Coordinates and a display label. |
| `Catchment` | `CatchmentId` (EA identifier + computed hash) | A delineated drainage basin defined by its CatchmentBoundary polygon, outlet point, and area (ha). |
| `FlowPath` | `FlowPathId` (UUID) | A directed polyline from an upstream source to a downstream outlet, with elevation profile and slope values at each vertex. |
| `BathymetryProfile` | `BathymetryProfileId` (UUID + bounding box hash) | An indexed grid of depth soundings and seabed classification codes for a coastal area. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `Coordinates` | `longitude: float`, `latitude: float` | WGS-84, 6 d.p. Immutable. |
| `BritishNationalGridRef` | `easting: int`, `northing: int` | Used internally for OS data ingestion; converted to Coordinates at context boundary. |
| `ElevationProfile` | `points: Array<{distance: float, elevationMAOD: float}>` | Distance in metres from transect origin. |
| `WaterSlope` | `gradient: float`, `aspectDegrees: float` | Dimensionless gradient (rise/run); aspect in degrees clockwise from north. |
| `BoundingBox` | `west: float, east: float, south: float, north: float` | WGS-84 degrees. Used for all API queries. |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `CatchmentTracer` | Given an AssetPin Coordinates, calls EA Catchment Data Explorer and OS Open Rivers to delineate the upstream CatchmentBoundary and identify the outlet FlowPath. |
| `FlowPathValidator` | Validates that an InterventionPolygon's centroid falls within a specified Catchment and that at least one FlowPath connects it to the target Location. Returns `HydrologicalConnection`. |
| `LIDARDataFetcher` | Queries the EA LIDAR API for the 1m resolution DEM tiles covering a given BoundingBox. Returns an ElevationProfile grid. |
| `BathymetryFetcher` | Queries the UKHO ADMIRALTY API for depth soundings and seabed classification within a given BoundingBox. Returns a BathymetryProfile. |
| `CoordinateTransformer` | Converts between WGS-84 and BritishNationalGrid. Used at all OS API boundaries. |

---

### 2b. Hydrological Context

**Responsibility:** All inland flood risk calculations. Takes geospatial primitives from the Geospatial Context (via Anti-Corruption Layer) and applies physics-based hydrological modelling to compute PeakFlowAttenuation, FloodHeightDelta, and RetentionDelta for WatershedInterventions. All quantitative calculations execute in the deterministic WASM physics engine — never in the LLM advisory layer.

**Key External APIs consumed:**
- BGS Soilscapes API (soil permeability and organic content by grid reference)
- UKCEH Land Cover Map (land cover classification)
- EA RoFRS API (baseline flood risk polygons and return period estimates)
- Met Office Weather DataHub / UKCP18 (rainfall depth-duration-frequency and future climate scenarios)

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `WatershedIntervention` | `InterventionId` (UUID) | A proposed inland NbS with a type (TreePlanting, PeatRestoration, LeakyDam, FloodplainReconnection, WetlandCreation), an InterventionPolygon, area (ha), and computed RetentionDelta. |
| `SoilProfile` | `SoilProfileId` (BGS reference + grid tile) | Soil characteristics at a location. Sourced from BGS Soilscapes. |
| `LandCoverZone` | `LandCoverZoneId` (UKCEH polygon ID) | A land parcel with a UKCEH classification. Used to derive baseline evapotranspiration and runoff coefficients. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `RetentionDelta` | `volumeM3PerHectare: float`, `percentageChange: float` | Positive value = increased retention. |
| `PeakFlowReduction` | `absoluteM3PerSec: float`, `percentageChange: float`, `uncertaintyRange: UncertaintyRange` | Always paired with UncertaintyRange. |
| `FloodHeightDelta` | `metresReduction: float`, `uncertaintyRange: UncertaintyRange` | Positive = reduced flood depth. Derived via stage-discharge lookup. |
| `FloodPeakDelay` | `additionalHours: float` | Time by which the intervention delays peak flow arrival. |
| `RainfallScenario` | `returnPeriodYears: int`, `depth24hMM: float`, `ukcp18ScenarioRCP: string` | E.g., 1-in-100-year under RCP 4.5. |
| `BaselineFloodRisk` | `returnPeriod: int`, `probabilityPercentPA: float`, `sourceDate: date` | Sourced from EA RoFRS. |
| `ManningsN` | `value: float`, `landCoverType: string` | Manning's roughness coefficient used for channel flow calculations. |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `HydrologicalSimulator` | Orchestrates the full inland calculation: applies RetentionDelta to the catchment water balance, runs a rainfall-runoff model using the WASM engine, returns PeakFlowReduction and FloodHeightDelta. |
| `InterventionScorer` | Scores multiple WatershedInterventions against a target Asset by descending RiskDelta, producing a ranked list of UpstreamOpportunityZones. |
| `SoilDataFetcher` | Queries BGS Soilscapes for a SoilProfile at given Coordinates. |
| `LandCoverFetcher` | Queries UKCEH Land Cover Map for the LandCoverZone containing given Coordinates. |
| `BaselineRiskFetcher` | Queries EA RoFRS for BaselineFloodRisk at an Asset location. |
| `RainfallDataFetcher` | Queries Met Office Weather DataHub for depth-duration-frequency data and UKCP18 delta factors at a location. |

---

### 2c. Marine Context

**Responsibility:** All coastal risk calculations. Takes bathymetric and tidal primitives from the Geospatial Context and applies coastal physics to compute WaveEnergyDelta, StormSurgeReduction, ErosionRiskDelta, and SedimentAccretionRate for CoastalInterventions. All quantitative calculations execute in the deterministic WASM physics engine.

**Key External APIs consumed:**
- Cefas/EA Saltmarsh Extents (existing habitat baseline)
- NTSLF tidal gauge network (storm surge observations and return level estimates)
- Met Office Coastal Models (wave height and period data)
- EA NCERM (National Coastal Erosion Risk Mapping)
- UKCP18 (sea-level rise scenarios)

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `CoastalIntervention` | `InterventionId` (UUID) | A proposed offshore or intertidal NbS with a type (OysterReef, SeagrassMeadow, Saltmarsh, Mangrove, CoralRestoration), an InterventionPolygon, area (ha), and computed WaveEnergyDelta. |
| `MarineHabitat` | `HabitatId` (Cefas polygon ID or UUID) | An existing mapped habitat with type, area, and mean canopy height (for wave drag coefficient derivation). |
| `ErosionZone` | `ErosionZoneId` (NCERM polygon ID) | A coastal parcel with current erosion rate (m/year), NCERM risk category, and 25-year projected shoreline position. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `WaveEnergyDelta` | `percentageReduction: float`, `uncertaintyRange: UncertaintyRange` | Percentage reduction in wave energy flux. |
| `StormSurgeReduction` | `metresReduction: float`, `returnPeriodYears: int`, `uncertaintyRange: UncertaintyRange` | At specific return period. |
| `ErosionRiskDelta` | `annualRateChangeMPerYear: float`, `horizonYears: int`, `uncertaintyRange: UncertaintyRange` | Negative = reduced erosion. |
| `SedimentAccretionRate` | `mmPerYear: float` | Net vertical sediment accretion rate within intervention area. |
| `WaveParameters` | `significantHeightM: float`, `peakPeriodSec: float`, `dominantDirectionDeg: float` | Sourced from Met Office Coastal Models. |
| `TidalRange` | `meanHighWaterM: float`, `meanLowWaterM: float`, `datumODN: string` | Ordnance Datum Newlyn. |
| `SeaLevelRiseScenario` | `rcpScenario: "RCP2.6" | "RCP4.5" | "RCP8.5"`, `riseByYear: Record<int, float>` | UKCP18 probabilistic estimates. |
| `DragCoefficient` | `value: float`, `habitatType: string` | Wave drag coefficient specific to NbS type, used in WASM attenuation model. |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `WaveAttenuationCalculator` | Applies a parametric wave energy dissipation model to a CoastalIntervention, using BathymetryProfile, WaveParameters, and habitat-specific DragCoefficients. Returns WaveEnergyDelta via WASM engine. |
| `ErosionRiskAnalyser` | Combines NCERM baseline ErosionZone data with SedimentAccretionRate to compute ErosionRiskDelta over a 25-year horizon with UKCP18 sea-level rise. |
| `StormSurgeFetcher` | Queries NTSLF and EA NCERM for storm surge return levels at a coastal location. |
| `CoastalHabitatFetcher` | Queries Cefas Saltmarsh Extents and equivalent datasets for existing MarineHabitat polygons in a BoundingBox. |
| `WaveDataFetcher` | Queries Met Office Coastal Models for WaveParameters at a location. |

---

### 2d. Asset Context

**Responsibility:** The corporate asset registry, risk profiling, and opportunity zone ranking. This context defines what the user is protecting, aggregates the RiskDelta outputs from Hydrological and Marine contexts, and produces the ranked UpstreamOpportunityZone list for the Asset Manager user flow and the beneficiary asset list for the Project Developer user flow.

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `Asset` | `AssetId` (UUID) | A corporate or infrastructure asset at a known Location. Has an AssetType, a current BaselineFloodRisk or coastal risk score, and a ProtectionScore computed after analysis. |
| `AssetRiskProfile` | `AssetId` (same as Asset, 1:1) | Aggregates all current and post-intervention risk scores for an Asset: BaselineFloodRisk, predicted FloodHeightDelta, WaveEnergyDelta, etc. Updated as analysis results arrive via domain events. |
| `ProtectionScore` | Embedded in AssetRiskProfile | Derived value: the aggregate RiskDelta across all applicable dimensions (flood height, wave energy, erosion), normalised to a 0–100 scale, with ConfidenceScore. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `AssetType` | `category: "Industrial" | "Transport" | "Energy" | "Residential" | "Agricultural" | "Other"` | Drives default risk weighting in Phase 3. |
| `RiskLevel` | `band: "VeryLow" | "Low" | "Medium" | "High" | "VeryHigh"`, `source: string` | Categorical risk band sourced from EA RoFRS or NCERM. |
| `ProtectionDelta` | `beforeRiskLevel: RiskLevel`, `afterRiskLevel: RiskLevel`, `absoluteRiskDelta: float` | Comparison for display in Risk Delta dial widget. |
| `OpportunityZoneRanking` | `zones: Array<{zone: UpstreamOpportunityZone, rank: int, predictedRiskDelta: float, confidence: ConfidenceScore}>` | The ranked output for Asset Manager mode. |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `AssetRiskScorer` | Populates an AssetRiskProfile by combining BaselineFloodRisk/coastal risk with RiskDelta results from Hydrological and Marine contexts. |
| `OpportunityZoneRanker` | Given an Asset and a set of validated WatershedInterventions or CoastalInterventions within the relevant catchment or coastal zone, returns an OpportunityZoneRanking ordered by predicted RiskDelta descending. |
| `BeneficiaryAssetIdentifier` | For Project Developer mode: given a WatershedIntervention or CoastalIntervention polygon, identifies all Assets within the downstream or onshore protection envelope and computes their ProtectionDelta. |

---

### 2e. Report Context

**Responsibility:** Report composition, confidence scoring, source citation management, and PDF export. This context assembles outputs from all other contexts into a coherent PreFeasibilityReport with mandatory disclaimers, ConfidenceAssessments, and inline citations.

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `PreFeasibilityReport` | `ReportId` (UUID) | The root aggregate of this context. Contains all sections: inputs, data sources, results, confidence assessments, disclaimer text, and (Phase 3) InvestmentMemo. |
| `ConfidenceAssessment` | `AssessmentId` (UUID, 1 per report section) | Holds the ConfidenceLevel, UncertaintyRange, and list of DataSources for a specific result section of the report. |
| `DataSource` | `DataSourceId` (URL + version hash) | A cited external data source: name, publisher, API endpoint or dataset URL, data resolution, and last updated date. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `ConfidenceLevel` | `band: "Low" | "Medium" | "High"`, `rationale: string` | "Low" when data resolution > 5m or data older than 2 years; "High" when 1m LIDAR and current-year data used. |
| `UncertaintyRange` | `centralEstimate: float`, `lowerBound: float`, `upperBound: float`, `unit: string` | e.g., `{ centralEstimate: 12, lowerBound: 9, upperBound: 15, unit: "%" }` |
| `Citation` | `dataSourceId: DataSourceId`, `fieldCited: string`, `retrievalDate: date` | Inline reference in a report paragraph. |
| `Disclaimer` | `text: string`, `mandatory: true` | Immutable. Applied to every PreFeasibilityReport. Text: "These results are proxy models for directional pre-feasibility decisions only. They are not a substitute for a certified Flood Risk Assessment (FRA), structural engineering survey, or regulated environmental impact assessment." |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `ReportComposer` | Assembles PreFeasibilityReport sections from the outputs of Hydrological, Marine, and Asset contexts. Applies mandatory Disclaimer. |
| `ConfidenceCalculator` | Computes ConfidenceLevel for each section based on the resolutions and dates of all DataSources used in that section. |
| `CitationFormatter` | Formats DataSource references into inline Citation value objects following the agreed citation format. |
| `PDFExporter` | Serialises a completed PreFeasibilityReport to a PDF binary using the browser's print or canvas API. No server involvement. |

---

### 2f. Advisory Context (LLM)

**Responsibility:** All natural language interaction, spatial validation, scale checking, mode routing, and narrative generation. This is the only context that interacts with the LLM. It never performs physics calculations; it delegates all quantitative work to the Hydrological and Marine contexts. It enforces guardrails (DataUnavailableError, ScaleWarning, spatial mismatch detection).

**Key integration:** The Advisory Context is the sole entry point for user queries. It interprets intent, validates spatial inputs, routes to the correct analysis context, and translates results into natural language for display in the chat pane.

**Entities:**

| Entity | Identity | Description |
|--------|----------|-------------|
| `AdvisorySession` | `SessionId` (UUID) | The aggregate root for a user interaction session. Tracks AnalysisMode, all user inputs, all RoutingDecisions, raised ScaleWarnings and DataUnavailableErrors, and a reference to the generated PreFeasibilityReport. |
| `SpatialValidation` | `ValidationId` (UUID, per InterventionPolygon) | Records the outcome of checking an InterventionPolygon against SoilProfile and LandCoverZone (inland) or BathymetryProfile and MarineHabitat (coastal). |
| `ScaleWarning` | `WarningId` (UUID) | Raised when the InterventionPolygon area is below the minimum viable area for the proposed NbS type. Contains the actual area, the minimum area threshold, and a suggested alternative polygon. |

**Value Objects:**

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `ValidationResult` | `status: "Valid" | "InvalidWithSuggestion" | "Insufficient"`, `message: string`, `suggestedAlternative?: string` | Never null. |
| `WarningLevel` | `severity: "Advisory" | "Warning" | "BlockingError"` | `BlockingError` prevents report generation; `Advisory` and `Warning` are surfaced but do not block. |
| `RoutingDecision` | `analysisMode: AnalysisMode`, `inlandTools: boolean`, `coastalTools: boolean`, `rationale: string` | Immutable once set for a session step. |
| `NarrativeSection` | `heading: string`, `body: string`, `citations: Citation[]` | A paragraph of natural language text generated by the LLM, populated with citations from the Report Context. |

**Domain Services:**

| Service | Responsibility |
|---------|---------------|
| `ModeRouter` | Determines AnalysisMode from user-supplied Coordinates by testing proximity to the UK coastline polygon (OS boundary data). Accuracy target > 99%. |
| `SpatialValidator` | Checks InterventionPolygon suitability by querying Geospatial Context (SoilProfile, LandCoverZone, BathymetryProfile) and applying NbS-type compatibility rules. Returns ValidationResult. |
| `ScaleChecker` | Computes whether InterventionPolygon.area >= minimumViableArea(NbSType) and raises ScaleWarning if not. |
| `NarrativeGenerator` | Takes structured RiskDelta results and ConfidenceAssessments and generates human-readable NarrativeSections for the chat pane, inserting inline Citations. Delegates to LLM with strict output schema; LLM never performs arithmetic. |
| `DataAvailabilityGuard` | Wraps all external API calls; raises DataUnavailableError if a required API returns no data; prevents the physics engine from receiving null inputs; surfaces the error to the user with the affected DataSource identified. |

---

## 3. Context Map

### Relationship Table

| Upstream Context | Downstream Context | Pattern | Description |
|-----------------|-------------------|---------|-------------|
| Geospatial | Hydrological | Customer/Supplier | Hydrological Context is the Customer; it defines its data needs (ElevationProfile, CatchmentBoundary, SoilProfile). Geospatial is the Supplier and must not change its outputs without notifying Hydrological. |
| Geospatial | Marine | Customer/Supplier | Same pattern as above for coastal BathymetryProfile and WaterSlope. |
| Hydrological | Asset | Published Language | Hydrological publishes domain events (HydrologicalSimulationCompleted) carrying RiskDelta. Asset Context subscribes and updates AssetRiskProfile. |
| Marine | Asset | Published Language | Marine publishes WaveAttenuationCalculated events. Asset Context subscribes. |
| Asset | Report | Customer/Supplier | Report Context is Customer; it consumes OpportunityZoneRanking, ProtectionDelta, and AssetRiskProfile from Asset Context. |
| Hydrological | Report | Published Language | Report Context subscribes to HydrologicalSimulationCompleted and CatchmentTraced events to populate DataSource citations. |
| Marine | Report | Published Language | Report Context subscribes to WaveAttenuationCalculated and ErosionAnalysisCompleted events. |
| Advisory | Geospatial | Anti-Corruption Layer | Advisory Context never calls Geospatial models directly. A GeospatialACL translates between LLM-produced coordinate strings and domain-typed Coordinates/BoundingBox value objects, validating ranges and formats. |
| Advisory | Hydrological | Anti-Corruption Layer | AdvisoryACL translates validated user inputs into typed WatershedIntervention commands before passing to Hydrological Context. Ensures the LLM cannot inject unchecked values into the physics engine. |
| Advisory | Marine | Anti-Corruption Layer | AdvisoryACL does the same for CoastalIntervention commands. |
| Advisory | Report | Customer/Supplier | Advisory Context triggers report generation by issuing a GenerateReport command to the Report Context. It then embeds NarrativeSections into the PreFeasibilityReport. |
| All Contexts | IndexedDB (external) | Conformist | All contexts conform to the IndexedDB key-value schema for caching API responses. Cache TTL is 24 hours. Context-specific serialisers handle mapping. |

### ASCII Context Map

```
                          NATURE RISK — BOUNDED CONTEXT MAP
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                                                                              │
 │  ┌───────────────────────┐                                                   │
 │  │   GEOSPATIAL CONTEXT  │  ◄── EA LIDAR, OS OpenRivers, UKHO, OS Terrain   │
 │  │  (Supplier)           │                                                   │
 │  │  - Location           │                                                   │
 │  │  - Catchment          │                                                   │
 │  │  - FlowPath           │                                                   │
 │  │  - BathymetryProfile  │                                                   │
 │  └─────────┬─────────────┘                                                   │
 │            │ Customer/Supplier (typed geospatial primitives)                 │
 │       ┌────▼──────────────┐    ┌────────────────────────┐                   │
 │       │  HYDROLOGICAL     │    │   MARINE CONTEXT        │                   │
 │       │  CONTEXT          │    │   (Customer)            │                   │
 │       │  (Customer)       │    │  - CoastalIntervention  │                   │
 │       │  - WatershedInt.  │    │  - MarineHabitat        │                   │
 │       │  - SoilProfile    │    │  - ErosionZone          │                   │
 │       │  - LandCoverZone  │    │  - WaveEnergyDelta      │                   │
 │       └─────────┬─────────┘    └──────────┬─────────────┘                   │
 │                 │ Published Language         │ Published Language             │
 │                 │ (HydrologicalSimulation    │ (WaveAttenuation               │
 │                 │  Completed events)         │  Calculated events)            │
 │                 └──────────────┬─────────────┘                               │
 │                                │                                              │
 │                    ┌───────────▼──────────┐                                  │
 │                    │   ASSET CONTEXT       │                                  │
 │                    │  - Asset              │                                  │
 │                    │  - AssetRiskProfile   │                                  │
 │                    │  - ProtectionScore    │                                  │
 │                    └───────────┬───────────┘                                 │
 │                                │ Customer/Supplier                            │
 │                    ┌───────────▼──────────┐                                  │
 │                    │   REPORT CONTEXT      │                                  │
 │                    │  - PreFeasReport      │                                  │
 │                    │  - ConfidenceAssessmt │                                  │
 │                    │  - DataSource         │                                  │
 │                    └───────────┬───────────┘                                 │
 │                                │ NarrativeSection injection                   │
 │  ┌─────────────────────────────▼───────────────────────────────┐             │
 │  │              ADVISORY CONTEXT (LLM)                         │             │
 │  │  - AdvisorySession   - SpatialValidation   - ScaleWarning   │             │
 │  │  ACL  ──►  Geospatial, Hydrological, Marine contexts        │             │
 │  └─────────────────────────────────────────────────────────────┘             │
 │                                                                              │
 │  ══════════════  SHARED KERNEL  ══════════════                               │
 │  Coordinates, ConfidenceLevel, UncertaintyRange, DataUnavailableError,       │
 │  Citation, Disclaimer — shared immutable types across all contexts           │
 │                                                                              │
 └──────────────────────────────────────────────────────────────────────────────┘
```

### Shared Kernel

The following value objects and error types are shared across all contexts without translation (Shared Kernel pattern):

```typescript
// Shared Kernel — types that must not diverge between contexts
export type Coordinates = { readonly longitude: number; readonly latitude: number };
export type BoundingBox = { readonly west: number; readonly east: number; readonly south: number; readonly north: number };
export type ConfidenceLevel = { readonly band: "Low" | "Medium" | "High"; readonly rationale: string };
export type UncertaintyRange = { readonly centralEstimate: number; readonly lowerBound: number; readonly upperBound: number; readonly unit: string };
export type Citation = { readonly dataSourceId: string; readonly fieldCited: string; readonly retrievalDate: Date };
export type AnalysisMode = "InlandMode" | "CoastalMode" | "MixedMode";

export class DataUnavailableError extends Error {
  constructor(
    public readonly dataSourceName: string,
    public readonly location: Coordinates,
    public readonly reason: string
  ) { super(`DATA_UNAVAILABLE: ${dataSourceName} returned no data at (${location.longitude}, ${location.latitude}): ${reason}`); }
}
```

---

## 4. Aggregates

### 4a. Geospatial Context Aggregates

#### Aggregate Root: `Catchment`

**Invariants:**
- A Catchment must have exactly one outlet FlowPath.
- CatchmentBoundary area must be > 0 ha.
- All FlowPaths within the Catchment must form a directed acyclic graph terminating at the outlet.
- A Catchment cannot be persisted without a validated EA Catchment Data Explorer identifier or a computed boundary hash.

```typescript
class Catchment {
  readonly id: CatchmentId;
  readonly boundary: GeoPolygon;         // WGS-84 polygon
  readonly areaHectares: number;
  readonly outletFlowPath: FlowPath;
  private flowPaths: FlowPath[];

  addFlowPath(fp: FlowPath): void;       // validates DAG invariant
  containsCoordinates(c: Coordinates): boolean;
  raise(event: CatchmentTraced): void;
}
```

#### Aggregate Root: `BathymetryProfile`

**Invariants:**
- A BathymetryProfile must cover a BoundingBox of at least 0.1 km x 0.1 km.
- All depth soundings must be negative (below chart datum) or zero; positive values indicate data errors and must be rejected.
- BathymetryProfile is immutable once created from a UKHO query result.

---

### 4b. Hydrological Context Aggregates

#### Aggregate Root: `WatershedIntervention`

**Invariants:**
- Area must be >= 0.5 ha (minimum viable area).
- InterventionPolygon must fall within a validated Catchment (HydrologicalConnection = true).
- A WatershedIntervention cannot have a RetentionDelta computed without a valid SoilProfile for its centroid.
- NbS type must be one of the five valid inland types; no other types are accepted.
- RetentionDelta must be >= 0 (interventions cannot reduce retention).

```typescript
class WatershedIntervention {
  readonly id: InterventionId;
  readonly polygon: GeoPolygon;
  readonly areaHectares: number;
  readonly nbsType: "TreePlanting" | "PeatRestoration" | "LeakyDam" | "FloodplainReconnection" | "WetlandCreation";
  private soilProfile: SoilProfile | null;
  private landCoverZone: LandCoverZone | null;
  private retentionDelta: RetentionDelta | null;

  attachSoilProfile(sp: SoilProfile): void;
  attachLandCoverZone(lc: LandCoverZone): void;
  computeRetentionDelta(): RetentionDelta;   // delegates to WASM
  raise(event: SoilDataAttached | RetentionDeltaComputed): void;
}
```

#### Aggregate Root: `HydrologicalSimulation`

**Invariants:**
- A Simulation requires at least one WatershedIntervention.
- A RainfallScenario must be specified before a Simulation can run.
- PeakFlowReduction result must not exceed 80% (physical upper bound for natural interventions per the literature; values above this trigger a DataUnavailableError with a recommendation to flag for expert review).
- All calculations delegate to the WASM engine; no arithmetic in application logic.

```typescript
class HydrologicalSimulation {
  readonly id: SimulationId;
  readonly catchmentId: CatchmentId;
  readonly targetAssetId: AssetId;
  readonly rainfallScenario: RainfallScenario;
  private interventions: WatershedIntervention[];
  private result: HydrologicalSimulationResult | null;

  addIntervention(wi: WatershedIntervention): void;
  run(wasmEngine: WASMPhysicsEngine): HydrologicalSimulationResult;
  raise(event: HydrologicalSimulationCompleted | SimulationFailed): void;
}
```

---

### 4c. Marine Context Aggregates

#### Aggregate Root: `CoastalIntervention`

**Invariants:**
- Area must be >= 0.5 ha.
- InterventionPolygon must overlap with or be adjacent to the BathymetryProfile for the target coastal area (offshore connectivity check).
- NbS type must be one of the five valid coastal types.
- A CoastalIntervention cannot produce a WaveEnergyDelta without a validated BathymetryProfile and WaveParameters.
- SeaLevelRiseScenario must be specified; RCP 4.5 is the required default.

```typescript
class CoastalIntervention {
  readonly id: InterventionId;
  readonly polygon: GeoPolygon;
  readonly areaHectares: number;
  readonly nbsType: "OysterReef" | "SeagrassMeadow" | "Saltmarsh" | "Mangrove" | "CoralRestoration";
  readonly seaLevelRiseScenario: SeaLevelRiseScenario;
  private bathymetryProfile: BathymetryProfile | null;
  private waveParameters: WaveParameters | null;
  private dragCoefficient: DragCoefficient;
  private waveEnergyDelta: WaveEnergyDelta | null;

  attachBathymetry(bp: BathymetryProfile): void;
  attachWaveParameters(wp: WaveParameters): void;
  computeWaveEnergyDelta(): WaveEnergyDelta;   // delegates to WASM
  raise(event: WaveAttenuationCalculated | InterventionInvalidated): void;
}
```

---

### 4d. Asset Context Aggregates

#### Aggregate Root: `Asset`

**Invariants:**
- An Asset must have a Location (Coordinates are required; display label is optional).
- BaselineFloodRisk or a coastal equivalent RiskLevel must be attached before a ProtectionScore can be computed.
- A single Asset can have at most one AssetRiskProfile (1:1 relationship enforced).
- ProtectionScore is a read-only derived value; it cannot be set directly — it must be recomputed when RiskDelta results arrive.

```typescript
class Asset {
  readonly id: AssetId;
  readonly location: Location;
  readonly assetType: AssetType;
  private riskProfile: AssetRiskProfile;

  attachBaselineRisk(risk: BaselineFloodRisk | RiskLevel): void;
  applyRiskDelta(delta: RiskDelta, source: "Hydrological" | "Marine"): void;
  getProtectionScore(): ProtectionScore;
  raise(event: AssetRiskProfileUpdated | ProtectionScoreComputed): void;
}
```

---

### 4e. Report Context Aggregates

#### Aggregate Root: `PreFeasibilityReport`

**Invariants:**
- A PreFeasibilityReport must always contain the immutable Disclaimer.
- Every numeric result section must reference a ConfidenceAssessment.
- A report cannot be exported to PDF in `Incomplete` state; all result sections must have a status of `Complete` or `DataUnavailable`.
- DataUnavailable sections must include the DataUnavailableError details and must not substitute estimated values.
- Reports are immutable once exported (state transitions: Draft → Complete → Exported).

```typescript
class PreFeasibilityReport {
  readonly id: ReportId;
  readonly sessionId: SessionId;
  readonly disclaimer: Disclaimer;   // always applied at construction
  private sections: ReportSection[];
  private status: "Draft" | "Complete" | "Exported";

  addSection(section: ReportSection, assessment: ConfidenceAssessment): void;
  markDataUnavailable(sectionId: string, error: DataUnavailableError): void;
  complete(): void;                  // transitions to Complete; validates all sections present
  exportToPDF(): ArrayBuffer;        // delegates to PDFExporter
  raise(event: ReportGenerated | ReportExported): void;
}
```

---

### 4f. Advisory Context Aggregates

#### Aggregate Root: `AdvisorySession`

**Invariants:**
- An AdvisorySession must have exactly one RoutingDecision per analysis step; it cannot proceed to data fetching without a confirmed RoutingDecision.
- Any DataUnavailableError must be stored on the session and surfaced to the user before the session can continue to report generation.
- A session with unresolved `BlockingError` ScaleWarnings or `BlockingError` ValidationResults cannot transition to `ReportGenerated` state.
- The LLM is never called with raw numeric data for arithmetic; all arithmetic results are provided to the LLM as pre-computed strings.

```typescript
class AdvisorySession {
  readonly id: SessionId;
  private analysisMode: AnalysisMode;
  private routingDecision: RoutingDecision | null;
  private validations: SpatialValidation[];
  private scaleWarnings: ScaleWarning[];
  private dataUnavailableErrors: DataUnavailableError[];
  private reportId: ReportId | null;
  private status: "Active" | "AwaitingData" | "ReportGenerated" | "Abandoned";

  setRoutingDecision(rd: RoutingDecision): void;
  recordValidation(v: SpatialValidation): void;
  raiseScaleWarning(w: ScaleWarning): void;
  recordDataUnavailable(e: DataUnavailableError): void;
  attachReport(reportId: ReportId): void;
  raise(event: SessionStarted | ModeRouted | ScaleWarningRaised | DataUnavailableRaised | SessionCompleted): void;
}
```

---

## 5. Domain Events

Domain events are named in past tense and are immutable once raised. They are used for cross-context communication via the in-browser event bus and are persisted in IndexedDB for session replay.

### 5a. Geospatial Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `CatchmentTraced` | `{ catchmentId, boundaryPolygon, areaHectares, outletCoordinates, dataSource: DataSource, timestamp }` | `CatchmentTracer` |
| `FlowPathComputed` | `{ flowPathId, catchmentId, path: Coordinates[], elevationProfile: ElevationProfile, timestamp }` | `CatchmentTracer` |
| `HydrologicalConnectionValidated` | `{ interventionId, assetId, connected: boolean, flowPathId, timestamp }` | `FlowPathValidator` |
| `HydrologicalConnectionFailed` | `{ interventionId, assetId, reason: string, timestamp }` | `FlowPathValidator` |
| `BathymetryDataFetched` | `{ profileId, boundingBox, soundingsCount, dataSource: DataSource, timestamp }` | `BathymetryFetcher` |
| `LIDARDataFetched` | `{ boundingBox, resolutionM: number, dataSource: DataSource, timestamp }` | `LIDARDataFetcher` |
| `DataUnavailableRaised` | `{ dataSourceName, location: Coordinates, reason: string, sessionId, timestamp }` | `DataAvailabilityGuard` |

### 5b. Hydrological Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `SoilDataAttached` | `{ interventionId, soilProfileId, permeabilityClass, organicMatterPercent, dataSource: DataSource, timestamp }` | `WatershedIntervention` |
| `LandCoverClassified` | `{ interventionId, landCoverClass, baselineRunoffCoefficient, dataSource: DataSource, timestamp }` | `WatershedIntervention` |
| `RetentionDeltaComputed` | `{ interventionId, retentionDelta: RetentionDelta, timestamp }` | `WatershedIntervention` |
| `InterventionValidated` | `{ interventionId, nbsType, areaHectares, validationResult: ValidationResult, timestamp }` | `SpatialValidator` |
| `HydrologicalSimulationCompleted` | `{ simulationId, catchmentId, targetAssetId, peakFlowReduction: PeakFlowReduction, floodHeightDelta: FloodHeightDelta, floodPeakDelay: FloodPeakDelay, rainfallScenario: RainfallScenario, dataSources: DataSource[], timestamp }` | `HydrologicalSimulation` |
| `SimulationFailed` | `{ simulationId, reason: string, missingDataSources: string[], timestamp }` | `HydrologicalSimulation` |
| `BaselineRiskFetched` | `{ assetId, baselineFloodRisk: BaselineFloodRisk, dataSource: DataSource, timestamp }` | `BaselineRiskFetcher` |

### 5c. Marine Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `CoastalInterventionInitialised` | `{ interventionId, nbsType, areaHectares, seaLevelRiseScenario, timestamp }` | `CoastalIntervention` |
| `WaveParametersFetched` | `{ interventionId, waveParameters: WaveParameters, dataSource: DataSource, timestamp }` | `WaveDataFetcher` |
| `WaveAttenuationCalculated` | `{ interventionId, assetId, waveEnergyDelta: WaveEnergyDelta, stormSurgeReduction: StormSurgeReduction, dataSources: DataSource[], timestamp }` | `CoastalIntervention` |
| `ErosionAnalysisCompleted` | `{ erosionZoneId, interventionId, erosionRiskDelta: ErosionRiskDelta, sedimentAccretionRate: SedimentAccretionRate, horizonYears: 25, dataSources: DataSource[], timestamp }` | `ErosionRiskAnalyser` |
| `MarineHabitatMapped` | `{ habitatId, habitatType, areaHectares, dataSource: DataSource, timestamp }` | `CoastalHabitatFetcher` |
| `DynamicMorphologyWarningRaised` | `{ interventionId, message: string, maturationYears: number, timestamp }` | `CoastalIntervention` |

### 5d. Asset Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `AssetRegistered` | `{ assetId, assetType, coordinates: Coordinates, label: string, timestamp }` | `Asset` |
| `AssetRiskProfileUpdated` | `{ assetId, riskSource: "Hydrological" | "Marine", riskDelta: RiskDelta, timestamp }` | `Asset` |
| `ProtectionScoreComputed` | `{ assetId, protectionScore: ProtectionScore, protectionDelta: ProtectionDelta, timestamp }` | `Asset` |
| `OpportunityZoneRankingProduced` | `{ assetId, ranking: OpportunityZoneRanking, timestamp }` | `OpportunityZoneRanker` |
| `BeneficiaryAssetsIdentified` | `{ interventionId, assetIds: AssetId[], protectionDeltas: Record<AssetId, ProtectionDelta>, timestamp }` | `BeneficiaryAssetIdentifier` |

### 5e. Report Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `ReportDraftStarted` | `{ reportId, sessionId, analysisMode: AnalysisMode, timestamp }` | `ReportComposer` |
| `ConfidenceScoreAssigned` | `{ reportId, sectionId, confidenceLevel: ConfidenceLevel, uncertaintyRange: UncertaintyRange, dataSources: DataSource[], timestamp }` | `ConfidenceCalculator` |
| `ReportSectionAdded` | `{ reportId, sectionId, sectionType, status: "Complete" | "DataUnavailable", timestamp }` | `PreFeasibilityReport` |
| `ReportGenerated` | `{ reportId, sessionId, sectionCount: number, confidenceSummary: ConfidenceLevel, timestamp }` | `PreFeasibilityReport` |
| `ReportExported` | `{ reportId, exportFormat: "PDF", fileSizeBytes: number, timestamp }` | `PreFeasibilityReport` |

### 5f. Advisory Events

| Event | Payload | Raised By |
|-------|---------|-----------|
| `SessionStarted` | `{ sessionId, userMode: "AssetManager" | "ProjectDeveloper", timestamp }` | `AdvisorySession` |
| `ModeRouted` | `{ sessionId, routingDecision: RoutingDecision, timestamp }` | `ModeRouter` |
| `ScaleWarningRaised` | `{ sessionId, interventionId, actualAreaHa: number, minimumViableAreaHa: number, warningLevel: WarningLevel, timestamp }` | `ScaleChecker` |
| `SpatialValidationCompleted` | `{ sessionId, interventionId, validationResult: ValidationResult, timestamp }` | `SpatialValidator` |
| `NarrativeGenerated` | `{ sessionId, sectionId, wordCount: number, citationCount: number, timestamp }` | `NarrativeGenerator` |
| `SessionCompleted` | `{ sessionId, reportId, scenarioCount: number, totalDurationMs: number, timestamp }` | `AdvisorySession` |
| `SessionAbandoned` | `{ sessionId, reason: string, lastEventType: string, timestamp }` | `AdvisorySession` |

---

## 6. Repository Interfaces

All repositories target the browser's IndexedDB, accessed via the static site's data layer. There is no server-side persistence in Phase 1 or Phase 2. The repository interfaces are defined here for testability (mock implementations in tests) and potential Phase 3 server-side persistence migration.

Cache TTL: 24 hours for all API-derived data. UI displays a staleness warning when cached data is older than 7 days.

### 6a. Geospatial Repositories

```typescript
interface ICatchmentRepository {
  findByCoordinates(coords: Coordinates): Promise<Catchment | null>;
  findById(id: CatchmentId): Promise<Catchment | null>;
  save(catchment: Catchment): Promise<void>;
  // IndexedDB object store: "catchments"
}

interface IFlowPathRepository {
  findByCatchmentId(catchmentId: CatchmentId): Promise<FlowPath[]>;
  findById(id: FlowPathId): Promise<FlowPath | null>;
  save(flowPath: FlowPath): Promise<void>;
  // IndexedDB object store: "flowPaths"
}

interface IBathymetryRepository {
  findByBoundingBox(bbox: BoundingBox): Promise<BathymetryProfile | null>;
  save(profile: BathymetryProfile, ttlMs?: number): Promise<void>;
  evictExpired(): Promise<void>;
  // IndexedDB object store: "bathymetry"
}
```

### 6b. Hydrological Repositories

```typescript
interface IWatershedInterventionRepository {
  findBySessionId(sessionId: SessionId): Promise<WatershedIntervention[]>;
  findById(id: InterventionId): Promise<WatershedIntervention | null>;
  save(intervention: WatershedIntervention): Promise<void>;
  // IndexedDB object store: "watershedInterventions"
}

interface ISoilProfileRepository {
  findByCoordinates(coords: Coordinates): Promise<SoilProfile | null>;
  save(profile: SoilProfile, ttlMs?: number): Promise<void>;
  evictExpired(): Promise<void>;
  // IndexedDB object store: "soilProfiles"; cached from BGS API
}

interface IHydrologicalSimulationRepository {
  findBySessionId(sessionId: SessionId): Promise<HydrologicalSimulation[]>;
  findById(id: SimulationId): Promise<HydrologicalSimulation | null>;
  save(simulation: HydrologicalSimulation): Promise<void>;
  // IndexedDB object store: "hydrologicalSimulations"
}
```

### 6c. Marine Repositories

```typescript
interface ICoastalInterventionRepository {
  findBySessionId(sessionId: SessionId): Promise<CoastalIntervention[]>;
  findById(id: InterventionId): Promise<CoastalIntervention | null>;
  save(intervention: CoastalIntervention): Promise<void>;
  // IndexedDB object store: "coastalInterventions"
}

interface IMarineHabitatRepository {
  findByBoundingBox(bbox: BoundingBox): Promise<MarineHabitat[]>;
  save(habitat: MarineHabitat, ttlMs?: number): Promise<void>;
  evictExpired(): Promise<void>;
  // IndexedDB object store: "marineHabitats"; cached from Cefas API
}

interface IErosionZoneRepository {
  findByBoundingBox(bbox: BoundingBox): Promise<ErosionZone[]>;
  save(zone: ErosionZone, ttlMs?: number): Promise<void>;
  // IndexedDB object store: "erosionZones"; cached from NCERM
}
```

### 6d. Asset Repository

```typescript
interface IAssetRepository {
  findById(id: AssetId): Promise<Asset | null>;
  findBySessionId(sessionId: SessionId): Promise<Asset[]>;
  findByBoundingBox(bbox: BoundingBox): Promise<Asset[]>;
  save(asset: Asset): Promise<void>;
  // IndexedDB object store: "assets"
}
```

### 6e. Report Repository

```typescript
interface IPreFeasibilityReportRepository {
  findById(id: ReportId): Promise<PreFeasibilityReport | null>;
  findBySessionId(sessionId: SessionId): Promise<PreFeasibilityReport | null>;
  save(report: PreFeasibilityReport): Promise<void>;
  // IndexedDB object store: "reports"
}
```

### 6f. Advisory Repository

```typescript
interface IAdvisorySessionRepository {
  findById(id: SessionId): Promise<AdvisorySession | null>;
  findActive(): Promise<AdvisorySession | null>;
  save(session: AdvisorySession): Promise<void>;
  listAll(): Promise<AdvisorySession[]>;
  // IndexedDB object store: "advisorySessions"
}

interface IDomainEventRepository {
  // Ordered log of all domain events for session replay / undo
  appendEvent(event: DomainEvent): Promise<void>;
  findEventsBySessionId(sessionId: SessionId): Promise<DomainEvent[]>;
  findEventsByType(eventType: string): Promise<DomainEvent[]>;
  // IndexedDB object store: "domainEvents"
}
```

---

## 7. Application Services

Application services orchestrate domain flows across bounded contexts. They do not contain business logic — business logic lives in aggregates and domain services. Application services handle: transaction boundaries (IndexedDB write batches), event dispatch, context coordination, and error propagation.

### 7a. InlandRiskAnalysisService

**Orchestrates the full inland (Asset Manager or Project Developer) analysis flow.**

```typescript
class InlandRiskAnalysisService {
  constructor(
    private readonly catchmentTracer: CatchmentTracer,
    private readonly flowPathValidator: FlowPathValidator,
    private readonly soilDataFetcher: SoilDataFetcher,
    private readonly landCoverFetcher: LandCoverFetcher,
    private readonly baselineRiskFetcher: BaselineRiskFetcher,
    private readonly rainfallDataFetcher: RainfallDataFetcher,
    private readonly hydrologicalSimulator: HydrologicalSimulator,
    private readonly interventionScorer: InterventionScorer,
    private readonly dataAvailabilityGuard: DataAvailabilityGuard,
    private readonly catchmentRepo: ICatchmentRepository,
    private readonly interventionRepo: IWatershedInterventionRepository,
    private readonly assetRepo: IAssetRepository,
    private readonly eventRepo: IDomainEventRepository
  ) {}

  /**
   * Asset Manager flow: given an asset pin, identify and rank upstream
   * opportunity zones by predicted RiskDelta.
   */
  async analyseAssetManagerInland(
    assetCoords: Coordinates,
    assetLabel: string,
    rainfallScenario: RainfallScenario,
    sessionId: SessionId
  ): Promise<{
    asset: Asset;
    catchment: Catchment;
    opportunityZoneRanking: OpportunityZoneRanking;
    simulation: HydrologicalSimulation;
  }> {
    // Step 1: Register Asset
    const asset = new Asset(newAssetId(), new Location(assetCoords, assetLabel), AssetType.Unknown);

    // Step 2: Trace Catchment
    const catchment = await this.catchmentTracer.trace(assetCoords);
    await this.catchmentRepo.save(catchment);
    await this.eventRepo.appendEvent(new CatchmentTraced(catchment));

    // Step 3: Fetch baseline risk for Asset
    const baselineRisk = await this.dataAvailabilityGuard.fetch(
      () => this.baselineRiskFetcher.fetch(assetCoords),
      "EA RoFRS", assetCoords
    );
    asset.attachBaselineRisk(baselineRisk);

    // Step 4: Enumerate candidate UpstreamOpportunityZones within Catchment
    // (spatial analysis of land cover, soil type, existing interventions)
    const candidateZones = await this.interventionScorer.enumerateCandidates(catchment);

    // Step 5: For each candidate, fetch soil and land cover, compute RetentionDelta
    const interventions: WatershedIntervention[] = [];
    for (const zone of candidateZones) {
      const soilProfile = await this.dataAvailabilityGuard.fetch(
        () => this.soilDataFetcher.fetch(zone.centroid),
        "BGS Soilscapes", zone.centroid
      );
      const landCover = await this.dataAvailabilityGuard.fetch(
        () => this.landCoverFetcher.fetch(zone.centroid),
        "UKCEH Land Cover", zone.centroid
      );
      const intervention = WatershedIntervention.create(zone);
      intervention.attachSoilProfile(soilProfile);
      intervention.attachLandCoverZone(landCover);
      intervention.computeRetentionDelta();
      await this.interventionRepo.save(intervention);
      interventions.push(intervention);
    }

    // Step 6: Run hydrological simulation
    const rainfall = await this.dataAvailabilityGuard.fetch(
      () => this.rainfallDataFetcher.fetch(assetCoords, rainfallScenario),
      "Met Office UKCP18", assetCoords
    );
    const simulation = await this.hydrologicalSimulator.simulate(
      catchment, asset, interventions, rainfallScenario
    );
    await this.eventRepo.appendEvent(new HydrologicalSimulationCompleted(simulation));

    // Step 7: Score and rank opportunity zones
    const ranking = await this.interventionScorer.rank(interventions, simulation);
    asset.applyRiskDelta(simulation.result.peakFlowReduction, "Hydrological");
    await this.assetRepo.save(asset);

    await this.eventRepo.appendEvent(new OpportunityZoneRankingProduced(asset.id, ranking));
    return { asset, catchment, opportunityZoneRanking: ranking, simulation };
  }

  /**
   * Project Developer flow: given a WatershedIntervention polygon, identify
   * downstream assets and compute their ProtectionDelta.
   */
  async analyseProjectDeveloperInland(
    interventionPolygon: GeoPolygon,
    nbsType: WatershedInterventionType,
    rainfallScenario: RainfallScenario,
    sessionId: SessionId
  ): Promise<{
    intervention: WatershedIntervention;
    catchment: Catchment;
    beneficiaryAssets: Array<{ asset: Asset; protectionDelta: ProtectionDelta }>;
  }> {
    // Step 1: Validate polygon and determine catchment
    const catchment = await this.catchmentTracer.traceFromPolygon(interventionPolygon);

    // Step 2: Validate spatial suitability
    const soilProfile = await this.dataAvailabilityGuard.fetch(
      () => this.soilDataFetcher.fetch(interventionPolygon.centroid),
      "BGS Soilscapes", interventionPolygon.centroid
    );

    // Step 3: Create and simulate intervention
    const intervention = WatershedIntervention.create({ polygon: interventionPolygon, nbsType });
    intervention.attachSoilProfile(soilProfile);
    intervention.computeRetentionDelta();

    // Step 4: Identify downstream assets and compute their ProtectionDelta
    const simulation = await this.hydrologicalSimulator.simulate(
      catchment, null, [intervention], rainfallScenario
    );

    const downstreamAssets = await this.interventionScorer.findDownstreamAssets(catchment, intervention);
    const beneficiaryAssets = downstreamAssets.map(a => ({
      asset: a,
      protectionDelta: this.computeProtectionDelta(a, simulation)
    }));

    await this.eventRepo.appendEvent(new BeneficiaryAssetsIdentified(intervention.id, beneficiaryAssets));
    return { intervention, catchment, beneficiaryAssets };
  }

  private computeProtectionDelta(asset: Asset, simulation: HydrologicalSimulation): ProtectionDelta {
    // pure function: no external calls
    return {
      beforeRiskLevel: asset.riskProfile.baselineRiskLevel,
      afterRiskLevel: deriveRiskLevel(simulation.result.floodHeightDelta),
      absoluteRiskDelta: simulation.result.peakFlowReduction.percentageChange
    };
  }
}
```

---

### 7b. CoastalRiskAnalysisService

**Orchestrates the full coastal analysis flow.**

```typescript
class CoastalRiskAnalysisService {
  constructor(
    private readonly bathymetryFetcher: BathymetryFetcher,
    private readonly waveDataFetcher: WaveDataFetcher,
    private readonly coastalHabitatFetcher: CoastalHabitatFetcher,
    private readonly stormSurgeFetcher: StormSurgeFetcher,
    private readonly waveAttenuationCalculator: WaveAttenuationCalculator,
    private readonly erosionRiskAnalyser: ErosionRiskAnalyser,
    private readonly dataAvailabilityGuard: DataAvailabilityGuard,
    private readonly coastalInterventionRepo: ICoastalInterventionRepository,
    private readonly assetRepo: IAssetRepository,
    private readonly eventRepo: IDomainEventRepository
  ) {}

  /**
   * Asset Manager flow: given a coastal asset pin, identify and rank offshore
   * opportunity zones by predicted WaveEnergyDelta and StormSurgeReduction.
   */
  async analyseAssetManagerCoastal(
    assetCoords: Coordinates,
    assetLabel: string,
    seaLevelRiseScenario: SeaLevelRiseScenario,
    sessionId: SessionId
  ): Promise<{
    asset: Asset;
    opportunityZones: CoastalIntervention[];
    waveEnergyDeltas: WaveEnergyDelta[];
    stormSurgeReductions: StormSurgeReduction[];
  }> {
    const asset = new Asset(newAssetId(), new Location(assetCoords, assetLabel), AssetType.Unknown);

    // Step 1: Fetch bathymetry for coastal zone
    const bbox = expandBoundingBox(assetCoords, 5_000); // 5 km radius
    const bathymetry = await this.dataAvailabilityGuard.fetch(
      () => this.bathymetryFetcher.fetch(bbox),
      "UKHO ADMIRALTY", assetCoords
    );

    // Step 2: Fetch wave climate
    const waveParameters = await this.dataAvailabilityGuard.fetch(
      () => this.waveDataFetcher.fetch(assetCoords),
      "Met Office Coastal Models", assetCoords
    );

    // Step 3: Fetch existing marine habitats (to avoid duplicating existing NbS)
    const existingHabitats = await this.dataAvailabilityGuard.fetch(
      () => this.coastalHabitatFetcher.fetch(bbox),
      "Cefas Saltmarsh / Seagrass", assetCoords
    );

    // Step 4: Enumerate candidate coastal opportunity zones
    const candidateZones = this.enumerateCandidateCoastalZones(bathymetry, existingHabitats);

    // Step 5: Compute WaveEnergyDelta for each candidate
    const results = await Promise.all(candidateZones.map(async zone => {
      const intervention = CoastalIntervention.create(zone, seaLevelRiseScenario);
      intervention.attachBathymetry(bathymetry);
      intervention.attachWaveParameters(waveParameters);
      const waveEnergyDelta = intervention.computeWaveEnergyDelta();
      await this.coastalInterventionRepo.save(intervention);
      await this.eventRepo.appendEvent(new WaveAttenuationCalculated(intervention, asset.id, waveEnergyDelta));
      return { intervention, waveEnergyDelta };
    }));

    // Step 6: Fetch storm surge and compute StormSurgeReduction
    const stormSurgeBaseline = await this.dataAvailabilityGuard.fetch(
      () => this.stormSurgeFetcher.fetch(assetCoords),
      "NTSLF / EA NCERM", assetCoords
    );
    const stormSurgeReductions = results.map(r =>
      this.waveAttenuationCalculator.deriveStormSurgeReduction(r.waveEnergyDelta, stormSurgeBaseline)
    );

    asset.applyRiskDelta(results[0].waveEnergyDelta, "Marine");
    await this.assetRepo.save(asset);

    return {
      asset,
      opportunityZones: results.map(r => r.intervention),
      waveEnergyDeltas: results.map(r => r.waveEnergyDelta),
      stormSurgeReductions
    };
  }

  /**
   * Project Developer flow: given a CoastalIntervention polygon, identify
   * onshore assets protected and compute their ProtectionDelta.
   */
  async analyseProjectDeveloperCoastal(
    interventionPolygon: GeoPolygon,
    nbsType: CoastalInterventionType,
    seaLevelRiseScenario: SeaLevelRiseScenario,
    sessionId: SessionId
  ): Promise<{
    intervention: CoastalIntervention;
    beneficiaryAssets: Array<{ asset: Asset; protectionDelta: ProtectionDelta }>;
    erosionRiskDelta: ErosionRiskDelta;
  }> {
    const bbox = polygonBoundingBox(interventionPolygon);
    const bathymetry = await this.dataAvailabilityGuard.fetch(
      () => this.bathymetryFetcher.fetch(bbox),
      "UKHO ADMIRALTY", interventionPolygon.centroid
    );
    const waveParameters = await this.dataAvailabilityGuard.fetch(
      () => this.waveDataFetcher.fetch(interventionPolygon.centroid),
      "Met Office Coastal Models", interventionPolygon.centroid
    );

    const intervention = CoastalIntervention.create(
      { polygon: interventionPolygon, nbsType },
      seaLevelRiseScenario
    );
    intervention.attachBathymetry(bathymetry);
    intervention.attachWaveParameters(waveParameters);
    const waveEnergyDelta = intervention.computeWaveEnergyDelta();

    // Erosion analysis
    const erosionRiskDelta = await this.erosionRiskAnalyser.analyse(
      interventionPolygon, waveEnergyDelta, seaLevelRiseScenario
    );
    await this.eventRepo.appendEvent(new ErosionAnalysisCompleted(intervention, erosionRiskDelta));

    // Identify onshore beneficiary assets
    const onshoreAssets = await this.assetRepo.findByBoundingBox(
      expandBoundingBox(interventionPolygon.centroid, 10_000)
    );
    const beneficiaryAssets = onshoreAssets.map(a => ({
      asset: a,
      protectionDelta: this.computeCoastalProtectionDelta(a, waveEnergyDelta, erosionRiskDelta)
    }));

    return { intervention, beneficiaryAssets, erosionRiskDelta };
  }

  private computeCoastalProtectionDelta(
    asset: Asset,
    waveEnergyDelta: WaveEnergyDelta,
    erosionRiskDelta: ErosionRiskDelta
  ): ProtectionDelta {
    // pure function: no external calls
    return {
      beforeRiskLevel: asset.riskProfile.baselineRiskLevel,
      afterRiskLevel: deriveCoastalRiskLevel(waveEnergyDelta, erosionRiskDelta),
      absoluteRiskDelta: waveEnergyDelta.percentageReduction
    };
  }

  private enumerateCandidateCoastalZones(
    bathymetry: BathymetryProfile,
    existingHabitats: MarineHabitat[]
  ): Array<{ polygon: GeoPolygon; nbsType: CoastalInterventionType }> {
    // Identifies areas of suitable bathymetry (depth, substrate) for each NbS type
    // that are not already occupied by existing habitats
    // Returns candidate zones sorted by area (descending)
    return []; // implementation detail for the Hydrological Simulator
  }
}
```

---

### 7c. ReportGenerationService

**Assembles the PreFeasibilityReport from analysis results and triggers PDF export.**

```typescript
class ReportGenerationService {
  constructor(
    private readonly reportComposer: ReportComposer,
    private readonly confidenceCalculator: ConfidenceCalculator,
    private readonly citationFormatter: CitationFormatter,
    private readonly narrativeGenerator: NarrativeGenerator,
    private readonly pdfExporter: PDFExporter,
    private readonly reportRepo: IPreFeasibilityReportRepository,
    private readonly eventRepo: IDomainEventRepository
  ) {}

  /**
   * Composes a PreFeasibilityReport from the results of an inland or coastal
   * analysis. Assigns confidence scores, formats citations, and generates
   * LLM-authored narrative sections.
   */
  async generateReport(
    sessionId: SessionId,
    analysisMode: AnalysisMode,
    inlandResults?: InlandAnalysisResults,
    coastalResults?: CoastalAnalysisResults
  ): Promise<PreFeasibilityReport> {
    const report = new PreFeasibilityReport(newReportId(), sessionId);
    // Disclaimer is applied in the PreFeasibilityReport constructor — always present.

    // Step 1: Compose sections from analysis results
    if (inlandResults) {
      const inlandSection = this.reportComposer.composeInlandSection(inlandResults);
      const confidence = this.confidenceCalculator.calculate(inlandResults.dataSources);
      const citations = this.citationFormatter.format(inlandResults.dataSources);
      report.addSection(inlandSection, new ConfidenceAssessment(confidence, citations));
      await this.eventRepo.appendEvent(new ConfidenceScoreAssigned(report.id, inlandSection.id, confidence));
    }

    if (coastalResults) {
      const coastalSection = this.reportComposer.composeCoastalSection(coastalResults);
      const confidence = this.confidenceCalculator.calculate(coastalResults.dataSources);
      const citations = this.citationFormatter.format(coastalResults.dataSources);
      report.addSection(coastalSection, new ConfidenceAssessment(confidence, citations));
      await this.eventRepo.appendEvent(new ConfidenceScoreAssigned(report.id, coastalSection.id, confidence));
    }

    // Step 2: Generate LLM narrative (narrative only; no arithmetic in LLM)
    const narrativeSections = await this.narrativeGenerator.generate(report);
    narrativeSections.forEach(ns => report.addNarrativeSection(ns));
    await this.eventRepo.appendEvent(new NarrativeGenerated(sessionId, narrativeSections.length));

    // Step 3: Mark report complete and persist
    report.complete();
    await this.reportRepo.save(report);
    await this.eventRepo.appendEvent(new ReportGenerated(report));

    return report;
  }

  /**
   * Exports a completed PreFeasibilityReport to PDF.
   * Only callable on reports in Complete or Exported state.
   * Never callable if any section contains unresolved DataUnavailableErrors.
   */
  async exportToPDF(reportId: ReportId): Promise<ArrayBuffer> {
    const report = await this.reportRepo.findById(reportId);
    if (!report) throw new Error(`PreFeasibilityReport ${reportId} not found`);

    const pdfBuffer = report.exportToPDF();
    await this.reportRepo.save(report);   // persists Exported status
    await this.eventRepo.appendEvent(new ReportExported(reportId, pdfBuffer.byteLength));

    return pdfBuffer;
  }
}
```

---

## Appendix A: WASM Physics Engine Interface

The deterministic WASM physics engine is a black-box from the DDD perspective. It is called by domain services (never by application services or aggregates directly) via a typed interface. The engine must never be called from the Advisory Context or from any LLM-adjacent code.

```typescript
interface WASMPhysicsEngine {
  // Inland calculations
  computePeakFlowAttenuation(
    catchmentAreaHa: number,
    interventions: Array<{ retentionDeltaM3PerHa: number; areaHa: number }>,
    rainfallDepth24hMM: number,
    baselinePeakFlowM3PerSec: number
  ): { peakFlowReductionPercent: number; peakFlowReductionM3PerSec: number; uncertaintyPercent: number };

  computeFloodHeightDelta(
    peakFlowReductionM3PerSec: number,
    channelWidthM: number,
    manningsN: number,
    channelSlopeM_M: number
  ): { floodHeightReductionM: number; uncertaintyM: number };

  // Coastal calculations
  computeWaveAttenuation(
    incidentWaveHeightM: number,
    habitatWidthM: number,
    dragCoefficient: number,
    waterDepthM: number,
    wavePeriodSec: number
  ): { waveEnergyReductionPercent: number; transmittedWaveHeightM: number; uncertaintyPercent: number };

  computeErosionDelta(
    currentErosionRateM_year: number,
    sedimentAccretionRateMM_year: number,
    seaLevelRiseMM_year: number,
    horizonYears: number
  ): { erosionRateChangeMPerYear: number; netChangeM: number; uncertaintyPercent: number };
}
```

---

## Appendix B: Phase Roadmap Impact on Domain Model

| Domain Area | Phase 1 (Inland MVP) | Phase 2 (Coastal) | Phase 3 (Financial) |
|-------------|---------------------|-------------------|---------------------|
| Geospatial | CatchmentTracer, FlowPathValidator, LIDAR | + BathymetryFetcher, CoordinateTransformer for coastal | No change |
| Hydrological | Full implementation | No change | No change |
| Marine | Not implemented | Full implementation | No change |
| Asset | AssetType, BaselineFloodRisk, ProtectionScore | + coastal RiskLevel integration | + AvoidedLossCost, financial weighting |
| Report | Inland sections, ConfidenceAssessment, PDF | + coastal sections, DynamicMorphologyWarning | + InvestmentMemo, BNG unit valuation |
| Advisory | ModeRouter (inland only), SpatialValidator | + coastal routing, SeaLevelRiseScenario selection | + FCA compliance guardrail for financial advice |

---

*This document is the authoritative domain model for the Nature Risk project. All code, tests, and documentation must use the ubiquitous language defined herein. Changes to aggregate invariants, bounded context responsibilities, or shared kernel types require a corresponding update to this document and a new ADR.*
