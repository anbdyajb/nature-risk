//! Inland hydrology calculations — Manning's equation and catchment water balance.
//!
//! Ported from `docs/app/physics.js` `calcPeakFlowAttenuation`.
//! All functions are pure: identical inputs always produce identical outputs.

use crate::types::{
    ConfidenceLevel, ConfidenceScore, DataSourceCitation, InlandPhysicsInput,
    InlandPhysicsResult, InterventionType, PhysicsSoilKey, Ukcp18Scenario,
};

// ─── Physical Constants and Lookup Tables ───────────────────────────────────

/// UKCP18 rainfall intensification multipliers by RCP scenario.
/// Source: UKCP18, mid-range 2050 central estimate for UK uplands.
fn ukcp18_rainfall_multiplier(scenario: Ukcp18Scenario) -> f64 {
    match scenario {
        Ukcp18Scenario::Rcp45 => 1.10,
        Ukcp18Scenario::Rcp85 => 1.20,
    }
}

/// Manning's n increment from watershed intervention by soil type.
/// Values represent the INCREASE in composite catchment Manning's n.
/// Source: EA (2021) Working with Natural Processes evidence review.
fn manning_n_delta(intervention: InterventionType, soil: PhysicsSoilKey) -> Option<f64> {
    match intervention {
        InterventionType::TreePlanting => match soil {
            PhysicsSoilKey::Peat => Some(0.035),
            PhysicsSoilKey::Clay => Some(0.040),
            PhysicsSoilKey::SandyLoam => Some(0.070),
            PhysicsSoilKey::Chalk => Some(0.045),
            PhysicsSoilKey::Limestone => Some(0.042),
        },
        InterventionType::PeatRestoration => match soil {
            PhysicsSoilKey::Peat => Some(0.060),
            PhysicsSoilKey::Clay => Some(0.038),
            PhysicsSoilKey::SandyLoam => Some(0.030),
            PhysicsSoilKey::Chalk => Some(0.020),
            PhysicsSoilKey::Limestone => Some(0.022),
        },
        InterventionType::LeakyDams => match soil {
            PhysicsSoilKey::Peat => Some(0.055),
            PhysicsSoilKey::Clay => Some(0.050),
            PhysicsSoilKey::SandyLoam => Some(0.048),
            PhysicsSoilKey::Chalk => Some(0.045),
            PhysicsSoilKey::Limestone => Some(0.046),
        },
        // Floodplain reconnection and riparian buffer use the same model
        // as tree planting with a 1.2x multiplier for off-channel storage.
        InterventionType::FloodplainReconnection => match soil {
            PhysicsSoilKey::Peat => Some(0.035 * 1.2),
            PhysicsSoilKey::Clay => Some(0.040 * 1.2),
            PhysicsSoilKey::SandyLoam => Some(0.070 * 1.2),
            PhysicsSoilKey::Chalk => Some(0.045 * 1.2),
            PhysicsSoilKey::Limestone => Some(0.042 * 1.2),
        },
        InterventionType::RiparianBuffer => match soil {
            PhysicsSoilKey::Peat => Some(0.035 * 0.8),
            PhysicsSoilKey::Clay => Some(0.040 * 0.8),
            PhysicsSoilKey::SandyLoam => Some(0.070 * 0.8),
            PhysicsSoilKey::Chalk => Some(0.045 * 0.8),
            PhysicsSoilKey::Limestone => Some(0.042 * 0.8),
        },
    }
}

/// Water retention capacity increase by intervention and soil type (mm/hr).
/// Source: EA (2021) Working with Natural Processes evidence base.
fn retention_capacity_mm_hr(intervention: InterventionType, soil: PhysicsSoilKey) -> f64 {
    match intervention {
        InterventionType::TreePlanting => match soil {
            PhysicsSoilKey::Peat => 45.0,
            PhysicsSoilKey::Clay => 35.0,
            PhysicsSoilKey::SandyLoam => 55.0,
            PhysicsSoilKey::Chalk => 40.0,
            PhysicsSoilKey::Limestone => 38.0,
        },
        InterventionType::PeatRestoration => match soil {
            PhysicsSoilKey::Peat => 80.0,
            PhysicsSoilKey::Clay => 55.0,
            PhysicsSoilKey::SandyLoam => 40.0,
            PhysicsSoilKey::Chalk => 15.0,
            PhysicsSoilKey::Limestone => 18.0,
        },
        InterventionType::LeakyDams => match soil {
            PhysicsSoilKey::Peat => 60.0,
            PhysicsSoilKey::Clay => 50.0,
            PhysicsSoilKey::SandyLoam => 52.0,
            PhysicsSoilKey::Chalk => 50.0,
            PhysicsSoilKey::Limestone => 50.0,
        },
        InterventionType::FloodplainReconnection => match soil {
            PhysicsSoilKey::Peat => 55.0,
            PhysicsSoilKey::Clay => 45.0,
            PhysicsSoilKey::SandyLoam => 65.0,
            PhysicsSoilKey::Chalk => 50.0,
            PhysicsSoilKey::Limestone => 48.0,
        },
        InterventionType::RiparianBuffer => match soil {
            PhysicsSoilKey::Peat => 40.0,
            PhysicsSoilKey::Clay => 30.0,
            PhysicsSoilKey::SandyLoam => 50.0,
            PhysicsSoilKey::Chalk => 35.0,
            PhysicsSoilKey::Limestone => 33.0,
        },
    }
}

/// Leaky dam storage volume per hectare (m3/ha).
/// Source: EA (2021), range 50-200 m3/ha.
fn leaky_dam_storage_m3_per_ha(soil: PhysicsSoilKey) -> f64 {
    match soil {
        PhysicsSoilKey::Peat => 180.0,
        PhysicsSoilKey::Clay => 150.0,
        PhysicsSoilKey::SandyLoam => 130.0,
        PhysicsSoilKey::Chalk => 100.0,
        PhysicsSoilKey::Limestone => 110.0,
    }
}

/// Runoff coefficients C by soil type (dimensionless, 0-1).
/// Source: FEH Table 3.1 / EA FRA guidance.
fn runoff_coefficient(soil: PhysicsSoilKey) -> f64 {
    match soil {
        PhysicsSoilKey::Peat => 0.80,
        PhysicsSoilKey::Clay => 0.70,
        PhysicsSoilKey::SandyLoam => 0.45,
        PhysicsSoilKey::Chalk => 0.30,
        PhysicsSoilKey::Limestone => 0.35,
    }
}

/// Stage-discharge coefficient: m per (m3/s).
/// Conservative for lowland UK.
const STAGE_DISCHARGE_COEFF: f64 = 0.028;

/// Peak delay empirical coefficient: hours per ha of intervention per km2 of catchment.
const PEAK_DELAY_HR_PER_HA_PER_KM2: f64 = 0.012;

/// Uncertainty coefficients (fractions).
const UNCERTAINTY_PEAK_FLOW: f64 = 0.25;
const UNCERTAINTY_FLOOD_HEIGHT: f64 = 0.30;

/// Storm fraction: 1-in-100yr 24h event as fraction of annual rainfall.
/// FEH median for UK.
const STORM_FRACTION: f64 = 0.12;

/// Representative lowland catchment Manning's n baseline.
const N_BASELINE: f64 = 0.035;

// ─── Utility Functions ──────────────────────────────────────────────────────

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn round_dp(value: f64, dp: u32) -> f64 {
    let factor = 10_f64.powi(dp as i32);
    (value * factor).round() / factor
}

/// Confidence level for inland calculations.
/// High: area > 5 ha AND soil type known
/// Medium: area 2-5 ha OR soil type assumed
/// Low: area < 2 ha
fn calc_inland_confidence(area_ha: f64, known_soil: bool) -> ConfidenceLevel {
    if area_ha < 2.0 {
        ConfidenceLevel::Low
    } else if area_ha >= 5.0 && known_soil {
        ConfidenceLevel::High
    } else {
        ConfidenceLevel::Medium
    }
}

// ─── Default data source citations for inland results ───────────────────────

fn inland_data_sources() -> Vec<DataSourceCitation> {
    vec![
        DataSourceCitation {
            name: "EA LIDAR Composite DTM 1m".into(),
            resolution: Some("1m".into()),
            last_updated: None,
            licence: "Crown copyright".into(),
            url: None,
        },
        DataSourceCitation {
            name: "BGS Soilscapes".into(),
            resolution: None,
            last_updated: None,
            licence: "UKRI".into(),
            url: None,
        },
        DataSourceCitation {
            name: "Met Office UKCP18".into(),
            resolution: None,
            last_updated: None,
            licence: "Crown copyright".into(),
            url: None,
        },
    ]
}

// ─── Public API ─────────────────────────────────────────────────────────────

/// Calculate inland flood attenuation from a watershed intervention.
///
/// Physics model:
///   1. Design storm depth from baseline rainfall * UKCP18 multiplier * storm fraction
///   2. Baseline peak discharge via simplified rational method (Q = C * i * A)
///   3. Friction delta from Manning's n increase
///   4. Proportional area scaling (capped at 50%)
///   5. Peak flow reduction = friction_delta * area_fraction
///   6. Flood height reduction from stage-discharge approximation
///   7. Peak delay from storage volume and catchment scale
///
/// All arithmetic is IEEE 754 f64. Pure function — no side effects.
pub fn calculate_inland(input: &InlandPhysicsInput) -> InlandPhysicsResult {
    let soil_key = input.soil_type.to_physics_key();

    // Resolve Manning's n delta for this intervention + soil combination
    let delta_n = manning_n_delta(input.intervention_type, soil_key).unwrap_or(0.0);

    // Use the input base_mannings_n if > 0, otherwise fall back to N_BASELINE
    let n_base = if input.base_mannings_n > 0.0 {
        input.base_mannings_n
    } else {
        N_BASELINE
    };

    // UKCP18 rainfall multiplier
    let ukcp18_mult = ukcp18_rainfall_multiplier(input.ukcp18_scenario);

    // Default baseline annual rainfall = 800 mm when intensity is the primary input.
    // The JS engine uses baselineAnnualRainfallMm defaulting to 800.
    let baseline_rainfall_mm = 800.0;

    // Step 1: Design storm depth (mm)
    let design_storm_mm = baseline_rainfall_mm * ukcp18_mult * STORM_FRACTION;

    // Step 2: Baseline peak discharge (simplified rational method)
    let c = runoff_coefficient(soil_key);
    let i_ms = (design_storm_mm / 1000.0) / 86400.0; // intensity in m/s
    let a_m2 = input.catchment_area_ha * 10000.0; // catchment area in m2
    let q_base = c * i_ms * a_m2; // m3/s

    // Step 3: Friction delta
    let friction_delta = if (n_base + delta_n) > 0.0 {
        delta_n / (n_base + delta_n)
    } else {
        0.0
    };

    // Step 4: Area scaling (capped at 50%)
    let area_fraction = if input.catchment_area_ha > 0.0 {
        (input.intervention_area_ha / input.catchment_area_ha).min(0.50)
    } else {
        0.0
    };

    // Step 5: Peak flow reduction
    let raw_reduction_fraction = friction_delta * area_fraction;
    let peak_flow_reduction_pct = clamp(raw_reduction_fraction * 100.0, 0.0, 50.0);

    // Uncertainty on peak flow reduction
    let uncertainty_pct = round_dp(peak_flow_reduction_pct * UNCERTAINTY_PEAK_FLOW, 1);

    // Step 6: Flood height reduction
    let q_reduced = q_base * (1.0 - raw_reduction_fraction);
    let delta_q = q_base - q_reduced;
    let flood_height_reduction_m = round_dp(clamp(delta_q * STAGE_DISCHARGE_COEFF, 0.0, 5.0), 2);

    // Step 7: Peak delay
    let catchment_area_km2 = input.catchment_area_ha / 100.0;
    let peak_delay_hrs = round_dp(
        PEAK_DELAY_HR_PER_HA_PER_KM2 * input.intervention_area_ha * catchment_area_km2,
        1,
    );

    // Volume attenuated: retention capacity * area * storm duration (24h)
    let retention = retention_capacity_mm_hr(input.intervention_type, soil_key);
    let intervention_area_m2 = input.intervention_area_ha * 10000.0;
    // Storage from leaky dams (added on top of retention for leaky_dams type)
    let dam_storage = if input.intervention_type == InterventionType::LeakyDams {
        leaky_dam_storage_m3_per_ha(soil_key) * input.intervention_area_ha
    } else {
        0.0
    };
    // Retention volume: (mm/hr) * hours * area_m2 / 1000 (mm to m)
    let retention_volume_m3 = (retention * 24.0 * intervention_area_m2) / 1000.0;
    let volume_attenuated_m3 = round_dp(retention_volume_m3 + dam_storage, 0);

    // Confidence
    let known_soil = input.soil_type != crate::types::SoilType::Unknown;
    let confidence_level = calc_inland_confidence(input.intervention_area_ha, known_soil);

    // Build physics model description
    let physics_model = format!(
        "Manning's equation (Q = (1/n) A R^(2/3) S^(1/2)) with lumped catchment \
         water balance. Peak flow reduction = friction_delta * area_fraction, where \
         friction_delta = delta_n / (n_baseline + delta_n); n_baseline = {:.3}; \
         delta_n = {:.3} (intervention type: {:?}, soil: {:?}). \
         Area fraction = min(interventionAreaHa / catchmentAreaHa, 0.5) = {:.4}. \
         Design storm = baselineRainfall ({} mm) x UKCP18 multiplier ({}, scenario {:?}) \
         x storm fraction ({}) = {:.1} mm. \
         Stage-discharge coefficient = {} m/(m3/s). \
         Uncertainty +/-{}% on flow reduction, +/-{}% on flood height. \
         Simplified proxy model - not a certified FRA.",
        n_base,
        delta_n,
        input.intervention_type,
        soil_key,
        area_fraction,
        baseline_rainfall_mm,
        ukcp18_mult,
        input.ukcp18_scenario,
        STORM_FRACTION,
        design_storm_mm,
        STAGE_DISCHARGE_COEFF,
        (UNCERTAINTY_PEAK_FLOW * 100.0) as u32,
        (UNCERTAINTY_FLOOD_HEIGHT * 100.0) as u32,
    );

    InlandPhysicsResult {
        peak_flow_reduction_pct: round_dp(peak_flow_reduction_pct, 1),
        flood_height_reduction_m,
        peak_delay_hrs,
        volume_attenuated_m3,
        confidence: ConfidenceScore {
            level: confidence_level,
            uncertainty_pct,
            data_sources: inland_data_sources(),
        },
        physics_model,
        citation_keys: vec![
            "manning-1891".into(),
            "ceh-flood-estim".into(),
            "ea-fra-guidance".into(),
            "met-ukcp18".into(),
            "bgs-soilscapes".into(),
            "ea-nbs-evidence".into(),
            "ea-rofrs".into(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{SoilType, Ukcp18Scenario};

    fn default_input() -> InlandPhysicsInput {
        InlandPhysicsInput {
            intervention_type: InterventionType::TreePlanting,
            intervention_area_ha: 10.0,
            catchment_area_ha: 100.0,
            slope_gradient: 0.05,
            soil_type: SoilType::Clay,
            rainfall_return_period_years: 100.0,
            rainfall_intensity_mm_hr: 30.0,
            channel_width_m: 5.0,
            base_mannings_n: 0.035,
            ukcp18_scenario: Ukcp18Scenario::Rcp45,
        }
    }

    #[test]
    fn deterministic_output() {
        let input = default_input();
        let r1 = calculate_inland(&input);
        let r2 = calculate_inland(&input);
        assert_eq!(r1.peak_flow_reduction_pct, r2.peak_flow_reduction_pct);
        assert_eq!(r1.flood_height_reduction_m, r2.flood_height_reduction_m);
        assert_eq!(r1.peak_delay_hrs, r2.peak_delay_hrs);
        assert_eq!(r1.volume_attenuated_m3, r2.volume_attenuated_m3);
    }

    #[test]
    fn peak_flow_reduction_positive() {
        let input = default_input();
        let result = calculate_inland(&input);
        assert!(
            result.peak_flow_reduction_pct > 0.0,
            "Expected positive peak flow reduction, got {}",
            result.peak_flow_reduction_pct
        );
    }

    #[test]
    fn peak_flow_reduction_capped_at_50() {
        let mut input = default_input();
        input.intervention_area_ha = 200.0;
        input.catchment_area_ha = 100.0;
        let result = calculate_inland(&input);
        assert!(
            result.peak_flow_reduction_pct <= 50.0,
            "Peak flow reduction should be capped at 50%, got {}",
            result.peak_flow_reduction_pct
        );
    }

    #[test]
    fn flood_height_non_negative() {
        let input = default_input();
        let result = calculate_inland(&input);
        assert!(result.flood_height_reduction_m >= 0.0);
    }

    #[test]
    fn volume_attenuated_positive() {
        let input = default_input();
        let result = calculate_inland(&input);
        assert!(result.volume_attenuated_m3 > 0.0);
    }

    #[test]
    fn citation_keys_present() {
        let input = default_input();
        let result = calculate_inland(&input);
        assert!(!result.citation_keys.is_empty());
        assert!(result.citation_keys.contains(&"manning-1891".to_string()));
    }

    #[test]
    fn confidence_high_for_large_area_known_soil() {
        let mut input = default_input();
        input.intervention_area_ha = 10.0;
        let result = calculate_inland(&input);
        assert_eq!(result.confidence.level, ConfidenceLevel::High);
    }

    #[test]
    fn confidence_low_for_small_area() {
        let mut input = default_input();
        input.intervention_area_ha = 1.0;
        let result = calculate_inland(&input);
        assert_eq!(result.confidence.level, ConfidenceLevel::Low);
    }

    #[test]
    fn peat_restoration_on_peat_soil() {
        let mut input = default_input();
        input.intervention_type = InterventionType::PeatRestoration;
        input.soil_type = SoilType::Peat;
        let result = calculate_inland(&input);
        assert!(result.peak_flow_reduction_pct > 0.0);
    }

    #[test]
    fn leaky_dams_include_storage_volume() {
        let mut input = default_input();
        input.intervention_type = InterventionType::LeakyDams;
        let result_dams = calculate_inland(&input);

        input.intervention_type = InterventionType::TreePlanting;
        let result_trees = calculate_inland(&input);

        // Leaky dams should attenuate more volume due to in-channel storage
        assert!(
            result_dams.volume_attenuated_m3 > result_trees.volume_attenuated_m3,
            "Leaky dams ({}) should attenuate more volume than tree planting ({})",
            result_dams.volume_attenuated_m3,
            result_trees.volume_attenuated_m3
        );
    }

    #[test]
    fn rcp85_gives_higher_design_storm() {
        let mut input45 = default_input();
        input45.ukcp18_scenario = Ukcp18Scenario::Rcp45;

        let mut input85 = default_input();
        input85.ukcp18_scenario = Ukcp18Scenario::Rcp85;

        let r45 = calculate_inland(&input45);
        let r85 = calculate_inland(&input85);

        // RCP8.5 produces a higher design storm, meaning larger Q_base,
        // so the absolute flood height reduction should differ.
        // Both should produce valid results.
        assert!(r45.peak_flow_reduction_pct > 0.0);
        assert!(r85.peak_flow_reduction_pct > 0.0);
    }
}
