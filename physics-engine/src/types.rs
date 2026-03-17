//! Shared domain types for the Nature Risk physics engine.
//!
//! These mirror the TypeScript types in `src/types/index.ts` and are
//! serialised to/from JS via `serde` + `serde-wasm-bindgen`.

use serde::{Deserialize, Serialize};

// ─── Enums ──────────────────────────────────────────────────────────────────

/// Inland intervention types supported by the physics engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InterventionType {
    TreePlanting,
    PeatRestoration,
    LeakyDams,
    FloodplainReconnection,
    RiparianBuffer,
}

/// Coastal habitat types supported by the wave attenuation model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CoastalHabitatType {
    OysterReef,
    Seagrass,
    Saltmarsh,
    Combined,
}

/// Soil type classification (UK geology).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SoilType {
    Clay,
    Loam,
    Sand,
    Peat,
    Chalk,
    Unknown,
}

/// UKCP18 climate scenario.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Ukcp18Scenario {
    Rcp45,
    Rcp85,
}

/// Confidence level for physics outputs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConfidenceLevel {
    Low,
    Medium,
    High,
}

// ─── Data Source Citation ───────────────────────────────────────────────────

/// Citation reference for a data source used in the calculation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceCitation {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,
    pub licence: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

// ─── Confidence Score ───────────────────────────────────────────────────────

/// Composite confidence score attached to every physics result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfidenceScore {
    pub level: ConfidenceLevel,
    pub uncertainty_pct: f64,
    pub data_sources: Vec<DataSourceCitation>,
}

// ─── Inland Physics ─────────────────────────────────────────────────────────

/// Input parameters for inland hydrology calculations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlandPhysicsInput {
    pub intervention_type: InterventionType,
    pub intervention_area_ha: f64,
    pub catchment_area_ha: f64,
    pub slope_gradient: f64,
    pub soil_type: SoilType,
    pub rainfall_return_period_years: f64,
    pub rainfall_intensity_mm_hr: f64,
    pub channel_width_m: f64,
    pub base_mannings_n: f64,
    pub ukcp18_scenario: Ukcp18Scenario,
}

/// Result of inland hydrology calculations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlandPhysicsResult {
    pub peak_flow_reduction_pct: f64,
    pub flood_height_reduction_m: f64,
    pub peak_delay_hrs: f64,
    pub volume_attenuated_m3: f64,
    pub confidence: ConfidenceScore,
    pub physics_model: String,
    pub citation_keys: Vec<String>,
}

// ─── Coastal Physics ────────────────────────────────────────────────────────

/// Input parameters for coastal wave attenuation calculations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoastalPhysicsInput {
    pub habitat_type: CoastalHabitatType,
    pub habitat_area_ha: f64,
    pub habitat_width_m: f64,
    pub water_depth_m: f64,
    pub significant_wave_height_m: f64,
    pub wave_period_s: f64,
    pub tidal_range_m: f64,
    pub sea_level_rise_m: f64,
    pub distance_to_asset_m: f64,
    pub ukcp18_scenario: Ukcp18Scenario,
}

/// Result of coastal wave attenuation calculations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoastalPhysicsResult {
    pub wave_energy_reduction_pct: f64,
    pub storm_surge_reduction_m: f64,
    pub erosion_delta_25yr_m: f64,
    pub habitat_suitability_score: f64,
    pub maturation_years: f64,
    pub confidence: ConfidenceScore,
    pub physics_model: String,
    pub citation_keys: Vec<String>,
}

// ─── Validation ─────────────────────────────────────────────────────────────

/// Input parameters for intervention validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intervention_type: Option<InterventionType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub habitat_type: Option<CoastalHabitatType>,
    pub area_ha: f64,
    pub lat: f64,
    pub lng: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub soil_type: Option<SoilType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub water_depth_m: Option<f64>,
}

/// Result of intervention validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub message: String,
    pub suggestions: Vec<String>,
    pub scale_warnings: Vec<String>,
}

// ─── Internal soil mapping ──────────────────────────────────────────────────

/// Maps the DDD `SoilType` enum to the physics-engine internal soil key
/// used for coefficient lookup tables. The JS engine uses strings like
/// "peat", "clay", "sandy_loam", "chalk", "limestone".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PhysicsSoilKey {
    Peat,
    Clay,
    SandyLoam,
    Chalk,
    Limestone,
}

impl SoilType {
    /// Convert to the physics-engine internal soil key.
    /// `LOAM` maps to `SandyLoam`, `SAND` maps to `SandyLoam`,
    /// `UNKNOWN` maps to `Clay` (conservative default).
    pub fn to_physics_key(self) -> PhysicsSoilKey {
        match self {
            SoilType::Peat => PhysicsSoilKey::Peat,
            SoilType::Clay => PhysicsSoilKey::Clay,
            SoilType::Loam | SoilType::Sand => PhysicsSoilKey::SandyLoam,
            SoilType::Chalk => PhysicsSoilKey::Chalk,
            SoilType::Unknown => PhysicsSoilKey::Clay,
        }
    }
}
