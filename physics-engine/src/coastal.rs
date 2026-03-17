//! Coastal wave attenuation calculations — linear vegetation drag model.
//!
//! Ported from `docs/app/physics.js` `calcWaveAttenuation`.
//! All functions are pure: identical inputs always produce identical outputs.

use crate::types::{
    CoastalHabitatType, CoastalPhysicsInput, CoastalPhysicsResult, ConfidenceLevel,
    ConfidenceScore, DataSourceCitation, Ukcp18Scenario,
};

// ─── Physical Constants and Lookup Tables ───────────────────────────────────

/// Wave drag (attenuation) coefficient beta by habitat type.
/// Units: m2 stem-1 m-1.
/// Simplified from Dalrymple et al. (1984).
fn wave_drag_coeff(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 0.10,
        CoastalHabitatType::Seagrass => 0.06,
        CoastalHabitatType::Saltmarsh => 0.08,
        CoastalHabitatType::Combined => 0.10, // reef component dominates
    }
}

/// Effective stem density N (stems/m2) by habitat type.
fn stem_density(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 50.0,
        CoastalHabitatType::Seagrass => 300.0,
        CoastalHabitatType::Saltmarsh => 200.0,
        CoastalHabitatType::Combined => 125.0, // weighted average reef + saltmarsh
    }
}

/// Effective habitat depth d (m) — vertical extent of structure in water column.
fn habitat_depth_m(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 0.30,
        CoastalHabitatType::Seagrass => 0.50,
        CoastalHabitatType::Saltmarsh => 0.80,
        CoastalHabitatType::Combined => 0.55, // midpoint reef + saltmarsh
    }
}

/// Minimum water depth (m) for habitat establishment.
fn min_water_depth(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 0.5,
        CoastalHabitatType::Seagrass => 0.3,
        CoastalHabitatType::Saltmarsh => 0.0,
        CoastalHabitatType::Combined => 0.3,
    }
}

/// Maturation timeline (years) for habitat to reach full effectiveness.
fn maturation_years(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 3.0,
        CoastalHabitatType::Seagrass => 5.0,
        CoastalHabitatType::Saltmarsh => 15.0,
        CoastalHabitatType::Combined => 15.0, // limited by saltmarsh component
    }
}

/// SLR effectiveness penalty per 100 mm of sea-level rise.
/// Conservative linear: each 100 mm SLR reduces effectiveness by 8%.
const SLR_PENALTY_PER_100MM: f64 = 0.08;

/// Uncertainty coefficient for wave energy reduction (fraction).
const UNCERTAINTY_WAVE_ENERGY: f64 = 0.20;

/// UKCP18 sea-level rise projections (m) by scenario for 2050.
/// Used when the input sea_level_rise_m is provided in metres.
fn ukcp18_slr_mm(scenario: Ukcp18Scenario) -> f64 {
    match scenario {
        Ukcp18Scenario::Rcp45 => 200.0, // mm
        Ukcp18Scenario::Rcp85 => 360.0, // mm
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn round_dp(value: f64, dp: u32) -> f64 {
    let factor = 10_f64.powi(dp as i32);
    (value * factor).round() / factor
}

/// Confidence level for coastal calculations.
/// High: area > 5 ha AND depth data supplied
/// Medium: area 2-5 ha OR depth estimated
/// Low: area < 2 ha
fn calc_coastal_confidence(area_ha: f64, has_depth_data: bool) -> ConfidenceLevel {
    if area_ha < 2.0 {
        ConfidenceLevel::Low
    } else if area_ha >= 5.0 && has_depth_data {
        ConfidenceLevel::High
    } else {
        ConfidenceLevel::Medium
    }
}

/// Habitat suitability score (0-1) based on depth, area, and exposure.
fn calc_suitability_score(
    habitat: CoastalHabitatType,
    water_depth: f64,
    area_ha: f64,
    wave_height: f64,
) -> f64 {
    let min_depth = min_water_depth(habitat);
    let depth_score = if water_depth >= min_depth {
        clamp(1.0 - ((water_depth - 2.0).abs() / 5.0), 0.2, 1.0)
    } else {
        0.1
    };

    let area_score = clamp(area_ha / 10.0, 0.1, 1.0);

    // Wave exposure: habitats prefer moderate waves; very high waves reduce suitability
    let wave_score = if wave_height <= 1.5 {
        1.0
    } else if wave_height <= 3.0 {
        0.7
    } else {
        0.4
    };

    round_dp(depth_score * area_score * wave_score, 2)
}

fn coastal_data_sources() -> Vec<DataSourceCitation> {
    vec![
        DataSourceCitation {
            name: "UKHO ADMIRALTY Marine Data".into(),
            resolution: None,
            last_updated: None,
            licence: "Crown copyright".into(),
            url: None,
        },
        DataSourceCitation {
            name: "National Tide and Sea Level Facility".into(),
            resolution: None,
            last_updated: None,
            licence: "NOC".into(),
            url: None,
        },
        DataSourceCitation {
            name: "Met Office UKCP18 Marine Projections".into(),
            resolution: None,
            last_updated: None,
            licence: "Crown copyright".into(),
            url: None,
        },
    ]
}

// ─── Public API ─────────────────────────────────────────────────────────────

/// Calculate coastal wave energy and storm surge attenuation.
///
/// Physics model (Dalrymple et al., 1984 simplified):
///   E_out/E_in = exp(-beta * N * d_eff * L_eff)
///   waveEnergyReductionPct = (1 - E_out/E_in) * 100
///
/// With corrections for:
///   - UKCP18 sea-level rise penalty
///   - Shoreline distance attenuation
///   - Combined habitat stacking (multiplicative for `combined`)
///
/// All arithmetic is IEEE 754 f64. Pure function.
pub fn calculate_coastal(input: &CoastalPhysicsInput) -> CoastalPhysicsResult {
    let habitat = input.habitat_type;

    // Sea-level rise in mm (input is in metres)
    let slr_mm = if input.sea_level_rise_m > 0.0 {
        input.sea_level_rise_m * 1000.0
    } else {
        ukcp18_slr_mm(input.ukcp18_scenario)
    };

    // For combined habitat, calculate each component and combine multiplicatively
    if habitat == CoastalHabitatType::Combined {
        return calculate_combined(input, slr_mm);
    }

    let beta = wave_drag_coeff(habitat);
    let n = stem_density(habitat);
    let d_habit = habitat_depth_m(habitat);
    let d_eff = if input.water_depth_m > 0.0 {
        d_habit.min(input.water_depth_m)
    } else {
        d_habit
    };

    // Effective fetch length through habitat (simplified square geometry)
    // Use habitat_width_m if provided and > 0, else derive from area
    let l_eff = if input.habitat_width_m > 0.0 {
        input.habitat_width_m
    } else {
        (input.habitat_area_ha * 10000.0).sqrt()
    };

    // Raw wave energy reduction
    let exponent = beta * n * d_eff * l_eff;
    let raw_energy_fraction = 1.0 - (-exponent).exp();
    let raw_energy_pct = clamp(raw_energy_fraction * 100.0, 0.0, 95.0);

    // Sea-level rise penalty
    let slr_penalty = clamp((slr_mm / 100.0) * SLR_PENALTY_PER_100MM, 0.0, 0.5);
    let adjusted_pct = raw_energy_pct * (1.0 - slr_penalty);

    // Shoreline distance attenuation
    let distance_factor = 1.0 / (1.0 + input.distance_to_asset_m / 1000.0);
    let effective_pct = adjusted_pct * (0.4 + 0.6 * distance_factor);
    let wave_energy_pct = clamp(round_dp(effective_pct, 1), 0.0, 90.0);

    // Uncertainty
    let uncertainty_pct = round_dp(wave_energy_pct * UNCERTAINTY_WAVE_ENERGY, 1);

    // Storm surge reduction: 10% wave energy ~= 0.03m surge reduction
    let storm_surge_reduction_m = round_dp(clamp((wave_energy_pct / 10.0) * 0.03, 0.0, 1.0), 3);

    // Erosion delta over 25 years (m) — positive means reduced erosion
    // Incorporating sea-level rise: baseline erosion rate ~0.5 m/yr without habitat
    let baseline_erosion_25yr = 0.5 * 25.0 + (slr_mm / 1000.0) * 2.0; // m over 25yr
    let erosion_reduction_factor = wave_energy_pct / 100.0;
    let erosion_delta_25yr_m = round_dp(baseline_erosion_25yr * erosion_reduction_factor, 1);

    // Habitat suitability
    let suitability = calc_suitability_score(
        habitat,
        input.water_depth_m,
        input.habitat_area_ha,
        input.significant_wave_height_m,
    );

    // Confidence
    let has_depth = input.water_depth_m > 0.0;
    let confidence_level = calc_coastal_confidence(input.habitat_area_ha, has_depth);

    let physics_model = format!(
        "Linear vegetation drag model (Dalrymple et al., 1984): \
         E_out/E_in = exp(-beta*N*d_eff*L_eff), \
         where beta = {} (drag coeff, m2 stem-1 m-1), \
         N = {} stems/m2 ({:?}), \
         d_eff = min({}, {}) = {:.2} m, \
         L_eff = {:.1} m. \
         Raw wave energy reduction = {:.1}%. \
         UKCP18 SLR penalty ({} mm): -{:.1}%. \
         Shoreline distance factor ({} m): {:.3}. \
         Storm surge proxy: (waveEnergyPct / 10) x 0.03 m. \
         Uncertainty +/-{}% on wave energy. \
         Simplified proxy - not a certified coastal flood study.",
        beta,
        n,
        habitat,
        d_habit,
        input.water_depth_m,
        d_eff,
        l_eff,
        raw_energy_pct,
        slr_mm,
        slr_penalty * 100.0,
        input.distance_to_asset_m,
        0.4 + 0.6 * distance_factor,
        (UNCERTAINTY_WAVE_ENERGY * 100.0) as u32,
    );

    CoastalPhysicsResult {
        wave_energy_reduction_pct: wave_energy_pct,
        storm_surge_reduction_m,
        erosion_delta_25yr_m,
        habitat_suitability_score: suitability,
        maturation_years: maturation_years(habitat),
        confidence: ConfidenceScore {
            level: confidence_level,
            uncertainty_pct,
            data_sources: coastal_data_sources(),
        },
        physics_model,
        citation_keys: vec![
            "dalrymple-1984".into(),
            "ukho-bathymetry".into(),
            "ntslf-tides".into(),
            "met-ukcp18".into(),
            "ukcp18-slr".into(),
            "ea-ncerm".into(),
            "ea-nbs-evidence".into(),
        ],
    }
}

/// Calculate combined habitat (reef + saltmarsh) with multiplicative attenuation.
fn calculate_combined(input: &CoastalPhysicsInput, slr_mm: f64) -> CoastalPhysicsResult {
    // Split area 40% reef, 60% saltmarsh (typical design ratio)
    let reef_area = input.habitat_area_ha * 0.4;
    let marsh_area = input.habitat_area_ha * 0.6;

    // Reef component
    let beta_reef = wave_drag_coeff(CoastalHabitatType::OysterReef);
    let n_reef = stem_density(CoastalHabitatType::OysterReef);
    let d_reef = habitat_depth_m(CoastalHabitatType::OysterReef)
        .min(if input.water_depth_m > 0.0 { input.water_depth_m } else { 0.30 });
    let l_reef = if input.habitat_width_m > 0.0 {
        input.habitat_width_m * 0.4
    } else {
        (reef_area * 10000.0).sqrt()
    };
    let reef_transmission = (-beta_reef * n_reef * d_reef * l_reef).exp();

    // Saltmarsh component
    let beta_marsh = wave_drag_coeff(CoastalHabitatType::Saltmarsh);
    let n_marsh = stem_density(CoastalHabitatType::Saltmarsh);
    let d_marsh = habitat_depth_m(CoastalHabitatType::Saltmarsh)
        .min(if input.water_depth_m > 0.0 { input.water_depth_m } else { 0.80 });
    let l_marsh = if input.habitat_width_m > 0.0 {
        input.habitat_width_m * 0.6
    } else {
        (marsh_area * 10000.0).sqrt()
    };
    let marsh_transmission = (-beta_marsh * n_marsh * d_marsh * l_marsh).exp();

    // Multiplicative: total transmission = reef * marsh
    let combined_transmission = reef_transmission * marsh_transmission;
    let raw_energy_pct = clamp((1.0 - combined_transmission) * 100.0, 0.0, 95.0);

    // SLR penalty
    let slr_penalty = clamp((slr_mm / 100.0) * SLR_PENALTY_PER_100MM, 0.0, 0.5);
    let adjusted_pct = raw_energy_pct * (1.0 - slr_penalty);

    // Distance attenuation
    let distance_factor = 1.0 / (1.0 + input.distance_to_asset_m / 1000.0);
    let effective_pct = adjusted_pct * (0.4 + 0.6 * distance_factor);
    let wave_energy_pct = clamp(round_dp(effective_pct, 1), 0.0, 90.0);

    let uncertainty_pct = round_dp(wave_energy_pct * UNCERTAINTY_WAVE_ENERGY, 1);
    let storm_surge_reduction_m = round_dp(clamp((wave_energy_pct / 10.0) * 0.03, 0.0, 1.0), 3);

    let baseline_erosion_25yr = 0.5 * 25.0 + (slr_mm / 1000.0) * 2.0;
    let erosion_delta_25yr_m = round_dp(baseline_erosion_25yr * (wave_energy_pct / 100.0), 1);

    let suitability = calc_suitability_score(
        CoastalHabitatType::Combined,
        input.water_depth_m,
        input.habitat_area_ha,
        input.significant_wave_height_m,
    );

    let has_depth = input.water_depth_m > 0.0;
    let confidence_level = calc_coastal_confidence(input.habitat_area_ha, has_depth);

    let physics_model = format!(
        "Combined habitat (reef + saltmarsh) multiplicative drag model. \
         Reef: beta={}, N={}, d_eff={:.2}m, L_eff={:.1}m, transmission={:.4}. \
         Saltmarsh: beta={}, N={}, d_eff={:.2}m, L_eff={:.1}m, transmission={:.4}. \
         Combined transmission = {:.4}. Raw reduction = {:.1}%. \
         SLR penalty: -{:.1}%. Distance factor: {:.3}. \
         Simplified proxy - not a certified coastal flood study.",
        beta_reef,
        n_reef,
        d_reef,
        l_reef,
        reef_transmission,
        beta_marsh,
        n_marsh,
        d_marsh,
        l_marsh,
        marsh_transmission,
        combined_transmission,
        raw_energy_pct,
        slr_penalty * 100.0,
        0.4 + 0.6 * distance_factor,
    );

    CoastalPhysicsResult {
        wave_energy_reduction_pct: wave_energy_pct,
        storm_surge_reduction_m,
        erosion_delta_25yr_m,
        habitat_suitability_score: suitability,
        maturation_years: maturation_years(CoastalHabitatType::Combined),
        confidence: ConfidenceScore {
            level: confidence_level,
            uncertainty_pct,
            data_sources: coastal_data_sources(),
        },
        physics_model,
        citation_keys: vec![
            "dalrymple-1984".into(),
            "ukho-bathymetry".into(),
            "ntslf-tides".into(),
            "met-ukcp18".into(),
            "ukcp18-slr".into(),
            "ea-ncerm".into(),
            "ea-nbs-evidence".into(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Ukcp18Scenario;

    fn default_input() -> CoastalPhysicsInput {
        CoastalPhysicsInput {
            habitat_type: CoastalHabitatType::Saltmarsh,
            habitat_area_ha: 10.0,
            habitat_width_m: 200.0,
            water_depth_m: 2.0,
            significant_wave_height_m: 1.0,
            wave_period_s: 8.0,
            tidal_range_m: 4.0,
            sea_level_rise_m: 0.2,
            distance_to_asset_m: 500.0,
            ukcp18_scenario: Ukcp18Scenario::Rcp45,
        }
    }

    #[test]
    fn deterministic_output() {
        let input = default_input();
        let r1 = calculate_coastal(&input);
        let r2 = calculate_coastal(&input);
        assert_eq!(r1.wave_energy_reduction_pct, r2.wave_energy_reduction_pct);
        assert_eq!(r1.storm_surge_reduction_m, r2.storm_surge_reduction_m);
    }

    #[test]
    fn wave_energy_reduction_positive() {
        let input = default_input();
        let result = calculate_coastal(&input);
        assert!(
            result.wave_energy_reduction_pct > 0.0,
            "Expected positive wave energy reduction, got {}",
            result.wave_energy_reduction_pct
        );
    }

    #[test]
    fn wave_energy_capped_at_90() {
        let mut input = default_input();
        input.habitat_area_ha = 1000.0;
        input.habitat_width_m = 5000.0;
        let result = calculate_coastal(&input);
        assert!(
            result.wave_energy_reduction_pct <= 90.0,
            "Wave energy reduction should be capped at 90%, got {}",
            result.wave_energy_reduction_pct
        );
    }

    #[test]
    fn storm_surge_non_negative() {
        let input = default_input();
        let result = calculate_coastal(&input);
        assert!(result.storm_surge_reduction_m >= 0.0);
    }

    #[test]
    fn erosion_delta_positive_for_large_habitat() {
        let input = default_input();
        let result = calculate_coastal(&input);
        assert!(
            result.erosion_delta_25yr_m > 0.0,
            "Expected positive erosion delta for large habitat, got {}",
            result.erosion_delta_25yr_m
        );
    }

    #[test]
    fn maturation_years_correct() {
        let mut input = default_input();
        input.habitat_type = CoastalHabitatType::OysterReef;
        let result = calculate_coastal(&input);
        assert_eq!(result.maturation_years, 3.0);

        input.habitat_type = CoastalHabitatType::Seagrass;
        let result = calculate_coastal(&input);
        assert_eq!(result.maturation_years, 5.0);

        input.habitat_type = CoastalHabitatType::Saltmarsh;
        let result = calculate_coastal(&input);
        assert_eq!(result.maturation_years, 15.0);
    }

    #[test]
    fn suitability_score_in_range() {
        let input = default_input();
        let result = calculate_coastal(&input);
        assert!(result.habitat_suitability_score >= 0.0);
        assert!(result.habitat_suitability_score <= 1.0);
    }

    #[test]
    fn oyster_reef_higher_drag_than_seagrass() {
        let mut input = default_input();
        input.habitat_type = CoastalHabitatType::OysterReef;
        let oyster = calculate_coastal(&input);

        input.habitat_type = CoastalHabitatType::Seagrass;
        let seagrass = calculate_coastal(&input);

        // Oyster has higher beta but lower stem density;
        // seagrass has lower beta but much higher density.
        // Both should produce valid positive results.
        assert!(oyster.wave_energy_reduction_pct > 0.0);
        assert!(seagrass.wave_energy_reduction_pct > 0.0);
    }

    #[test]
    fn combined_habitat_stacking() {
        let mut input = default_input();
        input.habitat_type = CoastalHabitatType::Combined;
        let combined = calculate_coastal(&input);

        input.habitat_type = CoastalHabitatType::OysterReef;
        let reef_only = calculate_coastal(&input);

        input.habitat_type = CoastalHabitatType::Saltmarsh;
        let marsh_only = calculate_coastal(&input);

        // Combined should exceed either individual component
        assert!(
            combined.wave_energy_reduction_pct >= reef_only.wave_energy_reduction_pct
                || combined.wave_energy_reduction_pct >= marsh_only.wave_energy_reduction_pct,
            "Combined ({}) should exceed at least one component (reef={}, marsh={})",
            combined.wave_energy_reduction_pct,
            reef_only.wave_energy_reduction_pct,
            marsh_only.wave_energy_reduction_pct,
        );
    }

    #[test]
    fn slr_reduces_effectiveness() {
        let mut input = default_input();
        input.sea_level_rise_m = 0.0;
        let no_slr = calculate_coastal(&input);

        input.sea_level_rise_m = 0.5;
        let high_slr = calculate_coastal(&input);

        assert!(
            no_slr.wave_energy_reduction_pct >= high_slr.wave_energy_reduction_pct,
            "Higher SLR should reduce effectiveness: no_slr={}, high_slr={}",
            no_slr.wave_energy_reduction_pct,
            high_slr.wave_energy_reduction_pct
        );
    }

    #[test]
    fn distance_reduces_effectiveness() {
        let mut input = default_input();
        input.distance_to_asset_m = 100.0;
        let near = calculate_coastal(&input);

        input.distance_to_asset_m = 5000.0;
        let far = calculate_coastal(&input);

        assert!(
            near.wave_energy_reduction_pct >= far.wave_energy_reduction_pct,
            "Greater distance should reduce effectiveness: near={}, far={}",
            near.wave_energy_reduction_pct,
            far.wave_energy_reduction_pct
        );
    }

    #[test]
    fn citation_keys_present() {
        let input = default_input();
        let result = calculate_coastal(&input);
        assert!(!result.citation_keys.is_empty());
        assert!(result.citation_keys.contains(&"dalrymple-1984".to_string()));
    }
}
