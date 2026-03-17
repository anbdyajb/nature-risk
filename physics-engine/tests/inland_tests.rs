//! Integration tests for inland hydrology calculations.

use nature_risk_physics::inland::calculate_inland;
use nature_risk_physics::types::{
    ConfidenceLevel, InlandPhysicsInput, InterventionType, SoilType, Ukcp18Scenario,
};

fn make_input(
    intervention: InterventionType,
    area_ha: f64,
    catchment_ha: f64,
    soil: SoilType,
    scenario: Ukcp18Scenario,
) -> InlandPhysicsInput {
    InlandPhysicsInput {
        intervention_type: intervention,
        intervention_area_ha: area_ha,
        catchment_area_ha: catchment_ha,
        slope_gradient: 0.05,
        soil_type: soil,
        rainfall_return_period_years: 100.0,
        rainfall_intensity_mm_hr: 30.0,
        channel_width_m: 5.0,
        base_mannings_n: 0.035,
        ukcp18_scenario: scenario,
    }
}

#[test]
fn tree_planting_clay_rcp45_deterministic() {
    let input = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let r1 = calculate_inland(&input);
    let r2 = calculate_inland(&input);

    assert_eq!(r1.peak_flow_reduction_pct, r2.peak_flow_reduction_pct);
    assert_eq!(r1.flood_height_reduction_m, r2.flood_height_reduction_m);
    assert_eq!(r1.peak_delay_hrs, r2.peak_delay_hrs);
    assert_eq!(r1.volume_attenuated_m3, r2.volume_attenuated_m3);
}

#[test]
fn tree_planting_produces_reasonable_reduction() {
    let input = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_inland(&input);

    // 10 ha out of 100 ha catchment = 10% area fraction
    // Manning's delta_n for tree_planting/clay = 0.040
    // friction_delta = 0.040 / (0.035 + 0.040) = 0.5333
    // raw reduction = 0.5333 * 0.1 = 0.05333 = 5.3%
    assert!(
        result.peak_flow_reduction_pct > 4.0 && result.peak_flow_reduction_pct < 7.0,
        "Expected ~5.3% reduction, got {}",
        result.peak_flow_reduction_pct
    );
}

#[test]
fn peat_restoration_on_peat_high_effectiveness() {
    let input = make_input(
        InterventionType::PeatRestoration,
        20.0,
        100.0,
        SoilType::Peat,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_inland(&input);

    // delta_n = 0.060, friction_delta = 0.060 / 0.095 = 0.6316
    // area_fraction = 0.2
    // raw = 0.6316 * 0.2 = 12.6%
    assert!(
        result.peak_flow_reduction_pct > 10.0,
        "Expected > 10% for peat restoration on peat, got {}",
        result.peak_flow_reduction_pct
    );
}

#[test]
fn leaky_dams_add_extra_storage() {
    let dams = make_input(
        InterventionType::LeakyDams,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let trees = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );

    let dam_result = calculate_inland(&dams);
    let tree_result = calculate_inland(&trees);

    assert!(
        dam_result.volume_attenuated_m3 > tree_result.volume_attenuated_m3,
        "Leaky dams ({} m3) should store more than tree planting ({} m3)",
        dam_result.volume_attenuated_m3,
        tree_result.volume_attenuated_m3
    );
}

#[test]
fn area_fraction_capped_at_50_pct() {
    let input = make_input(
        InterventionType::TreePlanting,
        150.0, // > 50% of catchment
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_inland(&input);
    assert!(result.peak_flow_reduction_pct <= 50.0);
}

#[test]
fn rcp85_higher_design_storm_different_height_reduction() {
    // Use a larger catchment (5000 ha) so that Q_base is large enough to
    // produce non-zero flood height reduction after rounding to 2 dp.
    let rcp45 = make_input(
        InterventionType::TreePlanting,
        500.0,
        5000.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let rcp85 = make_input(
        InterventionType::TreePlanting,
        500.0,
        5000.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp85,
    );

    let r45 = calculate_inland(&rcp45);
    let r85 = calculate_inland(&rcp85);

    // RCP8.5 has higher rainfall multiplier (1.20 vs 1.10), so higher Q_base.
    // Same reduction %, so higher absolute flood height reduction.
    assert!(
        r85.flood_height_reduction_m >= r45.flood_height_reduction_m,
        "RCP8.5 ({}) should give >= height reduction than RCP4.5 ({})",
        r85.flood_height_reduction_m,
        r45.flood_height_reduction_m
    );
    // Also verify peak flow reduction is identical (same intervention geometry)
    assert_eq!(
        r45.peak_flow_reduction_pct, r85.peak_flow_reduction_pct,
        "Peak flow reduction % should be the same for both scenarios"
    );
}

#[test]
fn unknown_soil_defaults_to_clay() {
    let unknown = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Unknown,
        Ukcp18Scenario::Rcp45,
    );
    let clay = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );

    let r_unknown = calculate_inland(&unknown);
    let r_clay = calculate_inland(&clay);

    assert_eq!(
        r_unknown.peak_flow_reduction_pct, r_clay.peak_flow_reduction_pct,
        "Unknown soil should map to clay"
    );
}

#[test]
fn confidence_levels() {
    // Small area => Low
    let small = make_input(
        InterventionType::TreePlanting,
        1.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(calculate_inland(&small).confidence.level, ConfidenceLevel::Low);

    // Medium area => Medium
    let medium = make_input(
        InterventionType::TreePlanting,
        3.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(
        calculate_inland(&medium).confidence.level,
        ConfidenceLevel::Medium
    );

    // Large area with known soil => High
    let large = make_input(
        InterventionType::TreePlanting,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    assert_eq!(
        calculate_inland(&large).confidence.level,
        ConfidenceLevel::High
    );
}

#[test]
fn floodplain_reconnection_works() {
    let input = make_input(
        InterventionType::FloodplainReconnection,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_inland(&input);
    assert!(result.peak_flow_reduction_pct > 0.0);
    assert!(result.volume_attenuated_m3 > 0.0);
}

#[test]
fn riparian_buffer_works() {
    let input = make_input(
        InterventionType::RiparianBuffer,
        10.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let result = calculate_inland(&input);
    assert!(result.peak_flow_reduction_pct > 0.0);
    assert!(result.volume_attenuated_m3 > 0.0);
}

#[test]
fn all_soil_types_produce_results() {
    let soils = [
        SoilType::Clay,
        SoilType::Loam,
        SoilType::Sand,
        SoilType::Peat,
        SoilType::Chalk,
        SoilType::Unknown,
    ];

    for soil in &soils {
        let input = make_input(
            InterventionType::TreePlanting,
            10.0,
            100.0,
            *soil,
            Ukcp18Scenario::Rcp45,
        );
        let result = calculate_inland(&input);
        assert!(
            result.peak_flow_reduction_pct > 0.0,
            "Soil {:?} should produce positive reduction",
            soil
        );
    }
}

#[test]
fn peak_delay_scales_with_area() {
    let small = make_input(
        InterventionType::TreePlanting,
        5.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let large = make_input(
        InterventionType::TreePlanting,
        50.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );

    let r_small = calculate_inland(&small);
    let r_large = calculate_inland(&large);

    assert!(
        r_large.peak_delay_hrs > r_small.peak_delay_hrs,
        "Larger area should give longer delay: small={}, large={}",
        r_small.peak_delay_hrs,
        r_large.peak_delay_hrs
    );
}

#[test]
fn uncertainty_proportional_to_reduction() {
    let small = make_input(
        InterventionType::TreePlanting,
        2.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );
    let large = make_input(
        InterventionType::TreePlanting,
        40.0,
        100.0,
        SoilType::Clay,
        Ukcp18Scenario::Rcp45,
    );

    let r_small = calculate_inland(&small);
    let r_large = calculate_inland(&large);

    assert!(
        r_large.confidence.uncertainty_pct > r_small.confidence.uncertainty_pct,
        "Larger reduction should have larger absolute uncertainty"
    );
}
