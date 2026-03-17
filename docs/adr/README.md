# Architecture Decision Records — Nature Risk

This directory contains Architecture Decision Records (ADRs) for the Nature Risk project. ADRs follow the [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records) format.

Nature Risk is a static GitHub Pages geospatial engine that quantifies how natural capital interventions reduce climate risks to UK corporate assets. It operates in two modes: **Asset Manager** (pin an asset, receive ranked restoration sites) and **Project Developer** (draw a restoration polygon, see which assets are protected).

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](ADR-001-static-site-architecture.md) | Static Site Architecture (GH Pages) | Accepted | 2026-03-17 |
| [ADR-002](ADR-002-mapping-library.md) | Mapping Library | Accepted | 2026-03-17 |
| [ADR-003](ADR-003-uk-data-api-strategy.md) | UK Data API Strategy | Accepted | 2026-03-17 |
| [ADR-004](ADR-004-physics-calculation-engine.md) | Physics/Calculation Engine | Accepted | 2026-03-17 |
| [ADR-005](ADR-005-ai-llm-integration.md) | AI/LLM Integration | Accepted | 2026-03-17 |
| [ADR-006](ADR-006-report-generation.md) | Report Generation | Accepted | 2026-03-17 |
| [ADR-007](ADR-007-state-management.md) | State Management | Accepted | 2026-03-17 |
| [ADR-008](ADR-008-deployment-pipeline.md) | Deployment Pipeline | Accepted | 2026-03-17 |

## Bounded Context Summary

The ADRs collectively define a bounded context architecture with the following separation of concerns:

| Concern | Decision | ADR |
|---------|----------|-----|
| Hosting | Static GH Pages + Cloudflare Workers CORS proxy | ADR-001 |
| GIS rendering | Mapbox GL JS (MapLibre fallback) | ADR-002 |
| Data ingestion | CF Worker proxy + IndexedDB TTL cache | ADR-003 |
| Quantitative physics | Deterministic WASM (AssemblyScript) | ADR-004 |
| Natural language | Claude API (claude-sonnet-4-6) via CF Worker | ADR-005 |
| PDF export | Client-side jsPDF + html2canvas | ADR-006 |
| Application state | Zustand + event-sourcing middleware + zundo | ADR-007 |
| CI/CD | GitHub Actions → GitHub Pages | ADR-008 |

## Key Architectural Guardrails

The following constraints are non-negotiable and enforced across all ADRs:

1. **No LLM arithmetic** — All quantitative outputs (flood attenuation, damage probabilities, confidence scores) are computed by the deterministic WASM physics engine (ADR-004). The LLM (ADR-005) narrates results but never computes them.

2. **No API keys in client JS** — All API keys (Anthropic, OS Data Hub, Mapbox) are stored as Cloudflare Worker secrets and never shipped in the browser bundle (ADR-003, ADR-005).

3. **Static site only** — No server-side rendering, no persistent backend, no database for Phase 1. All computation is client-side or via the CF Worker proxy (ADR-001).

4. **Event sourcing for audit** — Every state mutation that affects a physics calculation is logged as a domain event with a timestamp and causation chain, included in the exported PDF report (ADR-007).

## Dependency Graph

```
ADR-008 (CI/CD)
    └── builds → ADR-004 (WASM physics engine)
                     └── consumed by → ADR-005 (LLM wraps physics outputs)
                     └── consumed by → ADR-006 (report includes physics results)
                     └── consumed by → ADR-007 (state store holds physics results)

ADR-001 (Static site)
    └── requires → ADR-003 (CORS proxy for UK APIs)
    └── served by → ADR-008 (CI/CD deploys)

ADR-002 (Mapping)
    └── consumes → ADR-003 (tile data from UK APIs)
    └── state managed by → ADR-007

ADR-006 (Report)
    └── consumes → ADR-004 (physics results)
    └── consumes → ADR-005 (narrative text)
    └── consumes → ADR-002 (map snapshot)
```

## How to Add a New ADR

1. Copy the template below into a new file named `ADR-NNN-short-title.md`
2. Increment the ADR number sequentially
3. Add an entry to the table in this README
4. Submit as a pull request for review

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Deciders:** Architecture Team

## Context and Problem Statement
...

## Decision Drivers
- ...

## Considered Options
| Option | Pros | Cons |
|--------|------|------|

## Decision Outcome
**Chosen option:** ...

### Consequences
**Good:** ...
**Bad:** ...

## Links
- Related ADRs: ...
```
