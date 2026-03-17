# ADR-007: State Management

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Architecture Team

## Context and Problem Statement

Nature Risk maintains complex, interconnected UI and domain state:

- **Map state:** viewport (center, zoom, bearing), active base layer, drawn polygons, asset pin location
- **Analysis state:** current mode (Asset Manager / Project Developer), selected intervention types, physics calculation results, confidence scores
- **Co-Pilot state:** conversation history, intent triage results, spatial validation warnings
- **Report state:** generated report metadata, download status
- **Cache state:** IndexedDB cache hit/miss status per dataset

The product requires:
- **Scenario comparison:** users can run analysis under different UKCP18 climate scenarios (RCP 4.5 vs 8.5) and compare results side-by-side — this requires undo/redo or snapshot history
- **Audit trail:** every state change that affects a physics calculation must be logged for reproducibility and for inclusion in the PDF report
- **Event sourcing:** the PRD and project architecture mandate event sourcing for state changes

The app is a static SPA with no backend persistence for Phase 1; all state lives in memory (with IndexedDB for API cache, not application state).

## Decision Drivers

- Lightweight bundle: the state library must not dominate the JS bundle
- Undo/redo for scenario comparison: users must be able to step back through analysis states
- Event log for audit trail: every state mutation must be recordable with a timestamp and cause
- TypeScript-first: full type inference without boilerplate
- React integration: the UI is built in React; the store must integrate cleanly with hooks
- Devtools support: time-travel debugging aids development

## Considered Options

| Option | Pros | Cons |
|--------|------|------|
| **Zustand with event-sourcing middleware** | 1 KB gzipped, React hooks API, middleware composable, TypeScript inference, devtools support, undo/redo via `zundo` | Less mature ecosystem than Redux; event-sourcing middleware is custom (not off-the-shelf) |
| **Redux Toolkit** | Mature, RTK Query for async, Redux DevTools, large community | 11 KB gzipped; boilerplate even with RTK; overkill for a single-screen SPA; event sourcing requires additional library |
| **Vanilla JS (no library)** | Zero bundle cost | No devtools, no undo/redo, manual React integration, high maintenance cost |
| **XState (statecharts)** | Formal state machine semantics, visual debugger, event sourcing natural fit | Steep learning curve; 22 KB gzipped; statechart modelling for a GIS app requires significant upfront design |
| **Jotai (atomic state)** | Atomic model, minimal boilerplate | Event sourcing and audit trail require significant custom work; no built-in history |

## Decision Outcome

**Chosen option:** Zustand with event-sourcing middleware

The Zustand store is structured around domain slices mirroring the bounded contexts:

```typescript
// src/store/index.ts
interface NatureRiskStore {
  // Map slice
  map: MapState;
  setViewport: (viewport: Viewport) => void;
  setDrawnPolygon: (polygon: GeoJSON.Polygon | null) => void;

  // Analysis slice
  analysis: AnalysisState;
  setMode: (mode: AnalysisMode) => void;
  setPhysicsResult: (result: PhysicsResult) => void;

  // CoPilot slice
  copilot: CoPilotState;
  appendMessage: (message: ChatMessage) => void;

  // Event log (append-only)
  eventLog: DomainEvent[];
}
```

Event-sourcing middleware wraps every state mutation and appends a `DomainEvent` to the `eventLog`:

```typescript
interface DomainEvent {
  id: string;           // UUID
  type: string;         // e.g. 'PhysicsResultSet'
  payload: unknown;     // serialisable delta
  timestamp: string;    // ISO 8601
  causationId?: string; // ID of the event that caused this one
}
```

Undo/redo for scenario comparison is implemented via `zundo` (a Zustand undo middleware). Users can snapshot the full analysis state before changing the climate scenario, run the new analysis, and step back to compare.

The `eventLog` slice is append-only and is included in full in the PDF report (ADR-006) as an audit trail, with human-readable descriptions generated from event types.

### Consequences

**Good:**
- 1 KB Zustand bundle keeps total JS bundle size competitive
- Event log satisfies the audit trail and reproducibility requirements of the PRD
- `zundo` undo/redo enables scenario comparison without complex diff logic
- TypeScript inference is excellent — no need for `as` casts in store consumers
- Zustand DevTools integration works with the Redux DevTools browser extension for time-travel debugging
- The event-sourcing pattern aligns with the project architecture mandate and the domain event model in the bounded context map

**Bad:**
- The event-sourcing middleware is custom code (~80 lines); it must be maintained and tested
- `zundo` snapshots the entire store state on every mutation — for large physics result sets this may consume significant memory; a selective snapshot strategy targeting only `analysis` slice is needed
- Zustand does not enforce immutability at the type level; developers must use the `immer` middleware or be disciplined about not mutating state directly

## Links

- Related ADRs: ADR-004 (Physics Engine), ADR-006 (Report Generation)
- Zustand: https://github.com/pmndrs/zustand
- zundo (undo/redo middleware): https://github.com/charkour/zundo
- Zustand with immer: https://github.com/pmndrs/zustand#using-immer-middleware
