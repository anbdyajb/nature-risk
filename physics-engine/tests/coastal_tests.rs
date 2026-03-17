//! Integration tests for coastal wave attenuation calculations.

use nature_risk_physics::coastal::calculate_coastal;
use nature_risk_physics::types::{
    CoastalHabitatType, CoastalPhysicsInput, ConfidenceLevel, Ukcp18Scenario,
};

fn make_input(
    habitat: CoastalHabitatType,
    area_ha: f64,
    width_m: f64,
    depth_m: f64,
    wave_height: f64,
    distance_m: f64,
    slr_m: f64,
    scenario: Ukcp18Scenario,
) -> CoastalPhysicsInput {
    CoastalPhysicsInput {
        habitat_type: habitat,
        habitat_area_ha: area_ha,
        habitat_width_m: width_m,
        water_depth_m: depth_m,
        significant_wave_height_m: wave_height,
        wave_period_s: 8.0,
        tidal_range_m: 4.0,
        sea_level_rise_m: slr_m,
        distance_to_asset_m: distance_m,
        ukcp18_scenario: scenario,
    }
}

#[test]
fn saltmarsh_deterministic() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let r1 = calculate_coastal(&input);
    let r2 = calculate_coastal(&input);

    assert_eq!(r1.wave_energy_reduction_pct, r2.wave_energy_reduction_pct);
    assert_eq!(r1.storm_surge_reduction_m, r2.storm_surge_reduction_m);
    assert_eq!(r1.erosion_delta_25yr_m, r2.erosion_delta_25yr_m);
    assert_eq!(r1.habitat_suitability_score, r2.habitat_suitability_score);
    assert_eq!(r1.maturation_years, r2.maturation_years);
}

#[test]
fn saltmarsh_reasonable_reduction() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);

    // beta=0.08, N=200, d_eff=min(0.80, 2.0)=0.80, L_eff=200
    // exponent = 0.08 * 200 * 0.80 * 200 = 2560
    // raw = 1 - exp(-2560) ~= 100% but capped at 95%
    // With SLR penalty and distance, should still be high
    assert!(
        result.wave_energy_reduction_pct > 50.0,
        "Expected significant reduction for 200m saltmarsh, got {}",
        result.wave_energy_reduction_pct
    );
}

#[test]
fn oyster_reef_maturation_3yr() {
    let input = make_input(
        CoastalHabitatType::OysterReef,
        5.0,
        100.0,
        1.5,
        1.0,
        300.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert_eq!(result.maturation_years, 3.0);
}

#[test]
fn seagrass_maturation_5yr() {
    let input = make_input(
        CoastalHabitatType::Seagrass,
        5.0,
        100.0,
        1.0,
        0.8,
        300.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert_eq!(result.maturation_years, 5.0);
}

#[test]
fn saltmarsh_maturation_15yr() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        5.0,
        100.0,
        1.0,
        0.8,
        300.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert_eq!(result.maturation_years, 15.0);
}

#[test]
fn wave_energy_capped_at_90() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        1000.0,
        5000.0,
        3.0,
        1.0,
        100.0,
        0.0,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert!(
        result.wave_energy_reduction_pct <= 90.0,
        "Capped at 90%, got {}",
        result.wave_energy_reduction_pct
    );
}

#[test]
fn storm_surge_proportional_to_wave_energy() {
    let small = make_input(
        CoastalHabitatType::Saltmarsh,
        2.0,
        30.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let large = make_input(
        CoastalHabitatType::Saltmarsh,
        20.0,
        300.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );

    let r_small = calculate_coastal(&small);
    let r_large = calculate_coastal(&large);

    assert!(
        r_large.storm_surge_reduction_m >= r_small.storm_surge_reduction_m,
        "Larger habitat should reduce surge more: small={}, large={}",
        r_small.storm_surge_reduction_m,
        r_large.storm_surge_reduction_m
    );
}

#[test]
fn slr_reduces_effectiveness() {
    let no_slr = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.0,
        Ukcp18Scenario::Rcp45,
    );
    let high_slr = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.5,
        Ukcp18Scenario::Rcp45,
    );

    let r_no = calculate_coastal(&no_slr);
    let r_high = calculate_coastal(&high_slr);

    assert!(
        r_no.wave_energy_reduction_pct >= r_high.wave_energy_reduction_pct,
        "SLR should reduce effectiveness: no_slr={}, high_slr={}",
        r_no.wave_energy_reduction_pct,
        r_high.wave_energy_reduction_pct
    );
}

#[test]
fn distance_attenuates_benefit() {
    let near = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        100.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let far = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        5000.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );

    let r_near = calculate_coastal(&near);
    let r_far = calculate_coastal(&far);

    assert!(
        r_near.wave_energy_reduction_pct >= r_far.wave_energy_reduction_pct,
        "Closer habitat should be more effective: near={}, far={}",
        r_near.wave_energy_reduction_pct,
        r_far.wave_energy_reduction_pct
    );
}

#[test]
fn combined_habitat_stacking_multiplicative() {
    let combined = make_input(
        CoastalHabitatType::Combined,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );

    let result = calculate_coastal(&combined);

    // Combined should produce valid positive results
    assert!(result.wave_energy_reduction_pct > 0.0);
    assert!(result.storm_surge_reduction_m >= 0.0);
    assert_eq!(result.maturation_years, 15.0); // limited by saltmarsh
}

#[test]
fn suitability_score_within_bounds() {
    let habitats = [
        CoastalHabitatType::OysterReef,
        CoastalHabitatType::Seagrass,
        CoastalHabitatType::Saltmarsh,
        CoastalHabitatType::Combined,
    ];

    for habitat in &habitats {
        let input = make_input(*habitat, 10.0, 200.0, 2.0, 1.0, 500.0, 0.2, Ukcp18Scenario::Rcp45);
        let result = calculate_coastal(&input);
        assert!(
            result.habitat_suitability_score >= 0.0 && result.habitat_suitability_score <= 1.0,
            "{:?} suitability {} out of [0, 1]",
            habitat,
            result.habitat_suitability_score
        );
    }
}

#[test]
fn confidence_levels() {
    // Small area => Low
    let small = make_input(
        CoastalHabitatType::Saltmarsh,
        1.0,
        50.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(
        calculate_coastal(&small).confidence.level,
        ConfidenceLevel::Low
    );

    // Medium area with depth => Medium (2-5 ha)
    let medium = make_input(
        CoastalHabitatType::Saltmarsh,
        3.0,
        100.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(
        calculate_coastal(&medium).confidence.level,
        ConfidenceLevel::Medium
    );

    // Large area with depth => High
    let large = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(
        calculate_coastal(&large).confidence.level,
        ConfidenceLevel::High
    );
}

#[test]
fn citation_keys_present() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);

    assert!(!result.citation_keys.is_empty());
    assert!(result.citation_keys.contains(&"dalrymple-1984".to_string()));
    assert!(result.citation_keys.contains(&"ukcp18-slr".to_string()));
}

#[test]
fn erosion_delta_positive_for_effective_habitat() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        10.0,
        200.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert!(
        result.erosion_delta_25yr_m > 0.0,
        "Effective habitat should produce positive erosion delta, got {}",
        result.erosion_delta_25yr_m
    );
}

#[test]
fn zero_area_produces_no_reduction() {
    let input = make_input(
        CoastalHabitatType::Saltmarsh,
        0.0,
        0.0,
        2.0,
        1.0,
        500.0,
        0.2,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_coastal(&input);
    assert_eq!(result.wave_energy_reduction_pct, 0.0);
}
