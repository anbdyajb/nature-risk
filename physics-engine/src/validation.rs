//! Spatial validation for intervention polygons.
//!
//! Checks UK boundary, minimum area, soil suitability, and bathymetric depth.
//! Ported from `docs/app/physics.js` `validateIntervention`.

use crate::types::{
    CoastalHabitatType, InterventionType, PhysicsSoilKey, SoilType, ValidationInput,
    ValidationResult,
};

// ─── UK Boundary Constants ──────────────────────────────────────────────────

const UK_LAT_MIN: f64 = 49.8;
const UK_LAT_MAX: f64 = 60.9;
const UK_LNG_MIN: f64 = -8.2;
const UK_LNG_MAX: f64 = 2.0;

/// Minimum intervention area (ha) — hard minimum.
const MIN_AREA_HA: f64 = 0.5;

/// Recommended minimum area (ha) — soft warning threshold.
const RECOMMENDED_MIN_AREA_HA: f64 = 2.0;

// ─── Coastal Depth Requirements ─────────────────────────────────────────────

fn min_water_depth(habitat: CoastalHabitatType) -> f64 {
    match habitat {
        CoastalHabitatType::OysterReef => 0.5,
        CoastalHabitatType::Seagrass => 0.3,
        CoastalHabitatType::Saltmarsh => 0.0,
        CoastalHabitatType::Combined => 0.3,
    }
}

// ─── Mode Classification ────────────────────────────────────────────────────

/// Classify analysis mode based on coordinates.
///
/// Simplified heuristic: locations within 5 km of the coast (approximated
/// by proximity to UK coastline bounds) are classified as coastal. Interior
/// points are inland. Points near boundaries are mixed.
///
/// Uses the MHWS buffer of 5 km from the TypeScript constants.
pub fn classify_mode(lat: f64, lng: f64) -> &'static str {
    // Simple heuristic: coastal if near edges of UK landmass
    // In production this would use a proper coastline polygon.
    let near_coast = lng < -5.0
        || lng > 1.0
        || lat > 58.0
        || lat < 50.5
        || (lat < 52.0 && lng > 0.5); // East Anglia bulge

    let deep_inland = lat > 51.5
        && lat < 55.0
        && lng > -3.0
        && lng < -0.5;

    if deep_inland {
        "inland"
    } else if near_coast {
        "coastal"
    } else {
        "mixed"
    }
}

// ─── Soil Suitability ───────────────────────────────────────────────────────

/// Check soil suitability for inland interventions.
/// Returns (errors, warnings) tuple.
fn check_soil_suitability(
    intervention: InterventionType,
    soil: SoilType,
) -> (Vec<String>, Vec<String>) {
    let soil_key = soil.to_physics_key();
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if intervention == InterventionType::PeatRestoration {
        if soil_key == PhysicsSoilKey::Chalk || soil_key == PhysicsSoilKey::Limestone {
            errors.push(format!(
                "Peat restoration on {:?} is physically incompatible. \
                 Peat does not naturally form on free-draining calcareous geology. \
                 Consider tree planting or leaky dams instead.",
                soil
            ));
        }
        if soil_key == PhysicsSoilKey::SandyLoam {
            warnings.push(
                "Peat restoration on sandy loam yields limited benefit (low peat-forming \
                 potential). A feasibility survey is strongly recommended."
                    .into(),
            );
        }
    }

    (errors, warnings)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/// Validate an intervention's spatial and physical suitability.
///
/// Checks performed:
///   1. UK boundary (lat 49.8-60.9, lng -8.2 to 2.0)
///   2. Minimum area (>= 0.5 ha hard; >= 2 ha soft recommendation)
///   3. Soil suitability for inland interventions
///   4. Bathymetric depth for coastal habitats
///   5. Scale warnings for undersized interventions
///
/// Pure function.
pub fn validate_intervention(input: &ValidationInput) -> ValidationResult {
    let mut suggestions = Vec::new();
    let mut scale_warnings = Vec::new();
    let mut errors = Vec::new();

    // 1. UK boundary check
    if input.lat < UK_LAT_MIN
        || input.lat > UK_LAT_MAX
        || input.lng < UK_LNG_MIN
        || input.lng > UK_LNG_MAX
    {
        errors.push(format!(
            "Location ({:.4}, {:.4}) is outside UK bounds \
             (lat {}-{}, lng {} to {}). \
             Nature Risk currently supports UK locations only.",
            input.lat, input.lng, UK_LAT_MIN, UK_LAT_MAX, UK_LNG_MIN, UK_LNG_MAX
        ));
    }

    // 2. Area checks
    if input.area_ha < MIN_AREA_HA {
        errors.push(format!(
            "Intervention area ({:.2} ha) is below the minimum of {} ha. \
             The InterventionPolygon must be at least {} ha.",
            input.area_ha, MIN_AREA_HA, MIN_AREA_HA
        ));
    } else if input.area_ha < RECOMMENDED_MIN_AREA_HA {
        scale_warnings.push(format!(
            "Intervention area ({:.2} ha) is below the recommended {} ha. \
             Results will have Low confidence. \
             The minimum viable area for reliable modelling is {} ha.",
            input.area_ha, RECOMMENDED_MIN_AREA_HA, RECOMMENDED_MIN_AREA_HA
        ));
    }

    // 3. Inland — soil suitability
    if let Some(intervention) = input.intervention_type {
        if let Some(soil) = input.soil_type {
            let (soil_errors, soil_warnings) = check_soil_suitability(intervention, soil);
            errors.extend(soil_errors);
            scale_warnings.extend(soil_warnings);
        }

        // Suggest optimal intervention types
        if intervention == InterventionType::PeatRestoration {
            if let Some(soil) = input.soil_type {
                let key = soil.to_physics_key();
                if key == PhysicsSoilKey::Chalk || key == PhysicsSoilKey::Limestone {
                    suggestions.push("Consider tree planting or leaky dams for this geology.".into());
                }
            }
        }
    }

    // 4. Coastal — depth suitability
    if let Some(habitat) = input.habitat_type {
        if let Some(depth) = input.water_depth_m {
            let min_depth = min_water_depth(habitat);
            if depth < min_depth {
                errors.push(format!(
                    "{:?} requires a minimum water depth of {} m. \
                     Supplied: {:.1} m. Habitat cannot establish at this depth.",
                    habitat, min_depth, depth
                ));
            }
        } else {
            scale_warnings.push(
                "Water depth not supplied. The calculation will use the default habitat \
                 canopy depth. Supplying actual bathymetry data will improve accuracy."
                    .into(),
            );
        }

        // Scale warning for small coastal habitats
        if input.area_ha >= MIN_AREA_HA && input.area_ha < RECOMMENDED_MIN_AREA_HA {
            suggestions.push(
                "Increasing habitat area to at least 2 ha will significantly improve \
                 wave attenuation effectiveness and result confidence."
                    .into(),
            );
        }
    }

    // 5. Neither inland nor coastal specified
    if input.intervention_type.is_none() && input.habitat_type.is_none() {
        errors.push(
            "Either interventionType (inland) or habitatType (coastal) must be supplied.".into(),
        );
    }

    let valid = errors.is_empty();
    let message = if valid {
        "Validation passed. Intervention is suitable for physics calculation.".into()
    } else {
        errors.join(" | ")
    };

    ValidationResult {
        valid,
        message,
        suggestions,
        scale_warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inland_input() -> ValidationInput {
        ValidationInput {
            intervention_type: Some(InterventionType::TreePlanting),
            habitat_type: None,
            area_ha: 10.0,
            lat: 52.0,
            lng: -1.5,
            soil_type: Some(SoilType::Clay),
            water_depth_m: None,
        }
    }

    fn coastal_input() -> ValidationInput {
        ValidationInput {
            intervention_type: None,
            habitat_type: Some(CoastalHabitatType::Saltmarsh),
            area_ha: 10.0,
            lat: 50.7,
            lng: -1.3,
            soil_type: None,
            water_depth_m: Some(2.0),
        }
    }

    #[test]
    fn valid_inland_passes() {
        let result = validate_intervention(&inland_input());
        assert!(result.valid, "Expected valid, got: {}", result.message);
    }

    #[test]
    fn valid_coastal_passes() {
        let result = validate_intervention(&coastal_input());
        assert!(result.valid, "Expected valid, got: {}", result.message);
    }

    #[test]
    fn outside_uk_fails() {
        let mut input = inland_input();
        input.lat = 45.0; // Paris
        input.lng = 2.5;
        let result = validate_intervention(&input);
        assert!(!result.valid);
        assert!(result.message.contains("outside UK bounds"));
    }

    #[test]
    fn below_min_area_fails() {
        let mut input = inland_input();
        input.area_ha = 0.1;
        let result = validate_intervention(&input);
        assert!(!result.valid);
        assert!(result.message.contains("below the minimum"));
    }

    #[test]
    fn soft_area_warning() {
        let mut input = inland_input();
        input.area_ha = 1.0;
        let result = validate_intervention(&input);
        assert!(result.valid); // soft warning, not blocking
        assert!(!result.scale_warnings.is_empty());
    }

    #[test]
    fn peat_on_chalk_fails() {
        let mut input = inland_input();
        input.intervention_type = Some(InterventionType::PeatRestoration);
        input.soil_type = Some(SoilType::Chalk);
        let result = validate_intervention(&input);
        assert!(!result.valid);
        assert!(result.message.contains("physically incompatible"));
    }

    #[test]
    fn shallow_oyster_reef_fails() {
        let mut input = coastal_input();
        input.habitat_type = Some(CoastalHabitatType::OysterReef);
        input.water_depth_m = Some(0.2); // below 0.5m minimum
        let result = validate_intervention(&input);
        assert!(!result.valid);
        assert!(result.message.contains("minimum water depth"));
    }

    #[test]
    fn no_type_specified_fails() {
        let input = ValidationInput {
            intervention_type: None,
            habitat_type: None,
            area_ha: 10.0,
            lat: 52.0,
            lng: -1.5,
            soil_type: None,
            water_depth_m: None,
        };
        let result = validate_intervention(&input);
        assert!(!result.valid);
    }

    #[test]
    fn classify_mode_inland() {
        let mode = classify_mode(52.5, -1.5);
        assert_eq!(mode, "inland");
    }

    #[test]
    fn classify_mode_coastal() {
        let mode = classify_mode(50.3, -5.5);
        assert_eq!(mode, "coastal");
    }

    #[test]
    fn classify_mode_mixed() {
        // A point that is neither deep inland nor strongly coastal
        let mode = classify_mode(53.0, -0.3);
        assert_eq!(mode, "mixed");
    }
}
