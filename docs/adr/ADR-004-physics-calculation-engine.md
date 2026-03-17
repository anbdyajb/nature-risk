# ADR-004: Physics/Calculation Engine

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk quantifies the reduction in climate risk to UK corporate assets that results from natural capital interventions (e.g., floodplain restoration, saltmarsh reinstatement, riparian buffer planting). These calculations include:

- Flood attenuation volume from restored floodplain (Manning's equation, storage-discharge curves)
- Peak flow reduction from upstream interventions (unit hydrograph convolution)
- Coastal wave energy dissipation by saltmarsh (Dalrymple et al. formula)
- Soil erosion reduction from buffer strips (RUSLE adaptation)
- Return period exceedance probability under UKCP18 climate scenarios (extreme value statistics)
- Asset damage function evaluation (depth-damage curves from JBA/Fathom methodology)

The PRD explicitly prohibits LLM arithmetic: "physics calculations must use a deterministic engine, not LLM". The outputs must carry confidence scores and uncertainty ranges (e.g., ±15% on peak flow reduction) derived from parameter sensitivity analysis, not from LLM confidence tokens.

## Decision Drivers

- PRD hard guardrail: zero tolerance for hallucinated quantitative outputs
- Reproducibility: identical inputs must always produce identical outputs (deterministic)
- Auditability: calculation steps must be inspectable and citable
- Performance: calculations must run synchronously in the browser without blocking the UI thread
- TypeScript integration: the engine must interoperate with the Zustand state store and the report generator
- Long-term: the engine may be exposed as an MCP tool for agent-driven scenario modelling

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Deterministic TypeScript physics module compiled to WASM via AssemblyScript** | Byte-for-byte reproducible, runs off main thread in Web Worker, near-native speed, TypeScript source for readability, WASM binary is auditable | AssemblyScript is a subset of TypeScript; some TS idioms not supported; build step required |
| **Pure TypeScript module (no WASM)** | Simpler build, same determinism guarantee, easier debugging | Runs on main thread unless manually moved to Web Worker; JS floating-point may differ across V8 versions |
| **Python/SciPy via Pyodide (WASM Python)** | Rich scientific library ecosystem | 8–10 MB Pyodide runtime download; slow startup; poor TypeScript interop |
| **LLM for calculations** | No code to write | Non-deterministic; violates PRD guardrail; unacceptable for quantitative risk outputs |
| **Server-side calculation API** | No browser constraints | Violates static site architecture (ADR-001); introduces latency and server cost |

## Decision Outcome

**Chosen option:** Deterministic TypeScript physics module (compiled to WASM via AssemblyScript)

The physics engine lives in `/src/physics/` as AssemblyScript source (`.ts` files using the AssemblyScript standard library). It is compiled to a `.wasm` binary at build time via `asc` (AssemblyScript compiler) and loaded in a Web Worker to avoid blocking the UI thread.

The module exposes a typed interface:

```typescript
// src/physics/types.ts (shared between AS source and TS consumer)
export interface FloodAttenuationInput {
  catchmentAreaHa: f64;
  restoredFloodplainHa: f64;
  soilType: SoilType;          // enum: CLAY | LOAM | SAND | PEAT
  rainfallReturnPeriodYears: f64;
  ukcp18ScenarioRcp: f64;      // e.g. 4.5 or 8.5
}

export interface FloodAttenuationResult {
  peakFlowReductionM3s: f64;
  volumeAttenuatedM3: f64;
  confidenceScorePct: f64;     // 0–100, derived from parameter sensitivity
  uncertaintyRangePct: f64;    // e.g. 15.0 = ±15%
  citationKeys: string[];      // e.g. ["EA_FLOOD_ESTIM_2022", "IPCC_AR6"]
}
```

Each exported function includes a `citationKeys` field listing the peer-reviewed or government methodologies used (e.g., Flood Estimation Handbook, EA Flood Risk Assessment Guidance). Uncertainty ranges are computed via Monte Carlo perturbation of key parameters (±1 standard deviation from published coefficient ranges).

### Consequences

**Good:**
- Deterministic WASM guarantees reproducibility across browsers and over time
- Web Worker execution keeps the UI responsive during computation
- AssemblyScript source is readable TypeScript — reviewable by domain experts without WASM knowledge
- Confidence scores and uncertainty ranges are derived from the physics model, not from LLM output, satisfying the PRD guardrail
- The WASM binary can be exposed as an MCP tool in Phase 3 for agent-driven scenario modelling
- Citation keys enable automatic source attribution in generated reports (ADR-006)

**Bad:**
- AssemblyScript is a strict subset of TypeScript; complex generic types and some runtime features are unavailable
- A separate build step (`asc`) must run before the TypeScript compiler; CI pipeline must be updated (ADR-008)
- AssemblyScript floating-point follows IEEE 754 strictly, which may produce minor differences from pure JS arithmetic in edge cases — these must be documented

## Links

- Related ADRs: ADR-001 (Static Site Architecture), ADR-005 (LLM Integration), ADR-006 (Report Generation)
- AssemblyScript: https://www.assemblyscript.org/
- Flood Estimation Handbook: https://www.ceh.ac.uk/services/flood-estimation-handbook
- EA Flood Risk Assessment Guidance: https://www.gov.uk/guidance/flood-risk-assessment-standing-advice
- JBA Depth-Damage Functions: https://www.jbaconsulting.com/
