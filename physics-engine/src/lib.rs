//! Nature Risk Physics Engine — Deterministic WASM Module
//!
//! This crate provides the scientific core of the Nature Risk platform:
//!   1. Inland flood attenuation (Manning's equation, catchment water balance)
//!   2. Coastal wave attenuation (linear vegetation drag, Dalrymple et al.)
//!   3. Spatial validation (UK bounds, area, soil, depth checks)
//!
//! All exported functions are pure and deterministic: identical inputs always
//! produce identical outputs. No side effects, no randomness, no I/O.
//!
//! Compiled to wasm32-unknown-unknown via wasm-pack for browser use.

pub mod coastal;
pub mod inland;
pub mod types;
pub mod validation;

use types::{
    CoastalPhysicsInput, CoastalPhysicsResult, InlandPhysicsInput, InlandPhysicsResult,
    ValidationInput, ValidationResult,
};
use wasm_bindgen::prelude::*;

/// Calculate inland flood attenuation from a watershed intervention.
///
/// Takes a JS object conforming to `InlandPhysicsInput` and returns
/// a JS object conforming to `InlandPhysicsResult`.
#[wasm_bindgen(js_name = "calculateInland")]
pub fn calculate_inland(input: JsValue) -> Result<JsValue, JsError> {
    let parsed: InlandPhysicsInput = serde_wasm_bindgen::from_value(input)
        .map_err(|e| JsError::new(&format!("Invalid InlandPhysicsInput: {}", e)))?;
    let result: InlandPhysicsResult = inland::calculate_inland(&parsed);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&format!("Serialisation error: {}", e)))
}

/// Calculate coastal wave energy and storm surge attenuation.
///
/// Takes a JS object conforming to `CoastalPhysicsInput` and returns
/// a JS object conforming to `CoastalPhysicsResult`.
#[wasm_bindgen(js_name = "calculateCoastal")]
pub fn calculate_coastal(input: JsValue) -> Result<JsValue, JsError> {
    let parsed: CoastalPhysicsInput = serde_wasm_bindgen::from_value(input)
        .map_err(|e| JsError::new(&format!("Invalid CoastalPhysicsInput: {}", e)))?;
    let result: CoastalPhysicsResult = coastal::calculate_coastal(&parsed);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&format!("Serialisation error: {}", e)))
}

/// Validate an intervention's spatial and physical suitability.
///
/// Takes a JS object conforming to `ValidationInput` and returns
/// a JS object conforming to `ValidationResult`.
#[wasm_bindgen(js_name = "validateIntervention")]
pub fn validate_intervention(input: JsValue) -> Result<JsValue, JsError> {
    let parsed: ValidationInput = serde_wasm_bindgen::from_value(input)
        .map_err(|e| JsError::new(&format!("Invalid ValidationInput: {}", e)))?;
    let result: ValidationResult = validation::validate_intervention(&parsed);
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&format!("Serialisation error: {}", e)))
}

/// Classify analysis mode based on coordinates.
///
/// Returns "inland", "coastal", or "mixed".
#[wasm_bindgen(js_name = "classifyMode")]
pub fn classify_mode(lat: f64, lng: f64) -> String {
    validation::classify_mode(lat, lng).to_string()
}
