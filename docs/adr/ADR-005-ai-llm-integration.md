# ADR-005: AI/LLM Integration

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk includes a Co-Pilot panel (left half of the split-screen UI) that provides conversational guidance to users. The PRD specifies several capabilities that require natural language generation:

1. **Triage advisor**: Interprets user intent ("I want to protect this warehouse from flooding") and maps it to the correct analysis mode, data layers, and intervention types
2. **Spatial validation**: Warns the user when a proposed intervention site is spatially implausible (e.g., saltmarsh restoration inland, floodplain restoration on hard urban land)
3. **Scale warnings**: Flags when restoration area is disproportionate to catchment size or physically impossible
4. **Narrative report**: Generates a plain-English executive summary of the risk analysis results, citing physics outputs and data sources

Physics calculations (flood attenuation, wave dissipation, damage function evaluation) are handled entirely by the deterministic WASM engine (ADR-004). The LLM must never perform or modify numerical calculations.

## Decision Drivers

- The Co-Pilot requires natural language understanding and generation — a rules engine alone is insufficient
- Physics outputs must remain deterministic; LLM must only wrap and narrate them
- The Claude API is available and the project is already in the Anthropic ecosystem
- The LLM must be instructed to refuse arithmetic and redirect to physics engine outputs
- API key must not be exposed in client-side JavaScript (static site constraint)
- Streaming responses improve perceived latency for report generation

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Claude API (claude-sonnet-4-6) via Cloudflare Worker** | Best-in-class instruction following, structured output, tool use for spatial validation, existing CF Worker infrastructure (ADR-003), streaming support | API key managed in CF Worker secrets; cost per token |
| **OpenAI GPT-4o** | Strong general capability, function calling | Less instruction-following compliance for refusal guardrails; separate API key management |
| **Local LLM via WebLLM (browser WASM)** | No API key, fully offline, no cost per call | 4–8 GB model download; slow inference on CPU; insufficient capability for nuanced spatial reasoning |
| **No LLM — rule-based Co-Pilot only** | Deterministic, no API cost | Cannot handle free-text user intent; poor UX for non-expert users; cannot generate narrative reports |

## Decision Outcome

**Chosen option:** Claude API (claude-sonnet-4-6) for triage/advisor logic and report generation only

The Claude API is called exclusively through the existing Cloudflare Worker (ADR-003), which:
1. Stores the Anthropic API key as a CF Worker secret (never in client JS)
2. Enforces a system prompt that prohibits arithmetic and mandates citation of physics engine outputs
3. Passes the structured physics results as a JSON context block in the user message
4. Streams the response back to the browser via Server-Sent Events

The LLM integration covers exactly three responsibilities:

**1. Intent triage:** The Co-Pilot parses the user's natural language input and emits a structured `UserIntent` object (asset manager mode vs. project developer mode, intervention type, geographic hint). This is passed to the map and physics engine — the LLM does not compute any values.

**2. Spatial validation:** Given the proposed intervention polygon and asset location, the LLM checks for logical inconsistencies (e.g., proposing saltmarsh restoration 50 km inland) using tool-use to query a spatial context lookup table. It returns a `ValidationWarning[]` array.

**3. Narrative report generation:** After physics calculations complete, the LLM receives the structured `AnalysisResult` object (all values from the WASM engine) and generates a plain-English executive summary. It is explicitly instructed: "Use only the values provided in the JSON context. Do not compute, estimate, or modify any numbers."

The system prompt includes:
```
You are a nature-based solutions advisor. Your role is to explain results,
validate spatial logic, and guide users. You MUST NOT perform arithmetic.
All quantitative values are provided to you by the physics engine and must
be quoted verbatim. If asked to calculate anything, respond:
"That calculation is handled by the physics engine."
```

### Consequences

**Good:**
- Natural language triage dramatically lowers the barrier for non-GIS users
- Spatial validation catches physically implausible scenarios before expensive API calls are made
- Narrative report generation produces professional-quality text grounded in verified physics outputs
- The CF Worker layer means the Anthropic API key is never exposed to the browser
- Streaming responses make report generation feel responsive even for long outputs
- The guardrail system prompt satisfies the PRD requirement for zero LLM arithmetic

**Bad:**
- API cost: claude-sonnet-4-6 at ~$3/M input tokens; a complex report with full physics context may use 4,000–8,000 tokens per generation
- The CF Worker becomes the critical path for both API proxying (ADR-003) and LLM calls; it must handle concurrent requests reliably
- Prompt injection via user-supplied asset names or site descriptions must be sanitised before inclusion in the LLM context

## Links

- Related ADRs: ADR-003 (UK Data API Strategy), ADR-004 (Physics Engine), ADR-006 (Report Generation)
- Anthropic Claude API: https://docs.anthropic.com/
- Claude claude-sonnet-4-6 model card: https://www.anthropic.com/claude
- Cloudflare Workers AI Gateway: https://developers.cloudflare.com/ai-gateway/
