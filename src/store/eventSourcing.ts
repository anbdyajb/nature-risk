// ─── Event-Sourcing Middleware for Zustand ──────────────────────────────────
// Wraps every state mutation, appending an append-only DomainEvent to the
// eventLog. Events are included in PDF reports as an audit trail.
//
// Referenced decisions: ADR-004 (deterministic engine), PRD §10 (audit trail)

import { v4 as uuidv4 } from 'uuid';
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import type { DomainEvent, DomainEventType } from '@/types';

// ─── Event Dispatcher ───────────────────────────────────────────────────────

/** Tracks the current causation chain for nested mutations. */
let _currentCausationId: string | undefined;

/**
 * Create a DomainEvent with a unique ID, timestamp, and optional causation link.
 */
export function createDomainEvent(
  type: DomainEventType,
  payload: Record<string, unknown>,
  causationId?: string,
): DomainEvent {
  return {
    id: uuidv4(),
    type,
    payload,
    timestamp: new Date().toISOString(),
    causationId: causationId ?? _currentCausationId,
  };
}

// ─── Middleware Type ─────────────────────────────────────────────────────────

type EventSourcingMiddleware = <
  T extends { eventLog: DomainEvent[] },
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

// ─── Middleware Implementation ──────────────────────────────────────────────

/**
 * Creates the event-sourcing middleware that intercepts setState calls.
 *
 * Usage in the store:
 * ```ts
 * const useStore = create<NatureRiskStore>()(
 *   eventSourcing(
 *     immer((set, get) => ({ ... }))
 *   )
 * );
 * ```
 *
 * Any action that calls `emitEvent(set, get, eventType, payload)` will
 * append to the append-only eventLog.
 */
export const createEventSourcingMiddleware: EventSourcingMiddleware =
  (initializer) => (set, get, api) => {
    return initializer(set, get, api);
  };

/**
 * Emit a domain event and append it to the eventLog.
 * This is the primary function used by store actions to record events.
 *
 * @param set - Zustand set function (immer-compatible)
 * @param get - Zustand get function
 * @param type - The domain event type
 * @param payload - Event payload data
 * @param causationId - Optional causation ID for event chains
 */
export function emitEvent(
  appendToLog: (event: DomainEvent) => void,
  type: DomainEventType,
  payload: Record<string, unknown>,
  causationId?: string,
): DomainEvent {
  const event = createDomainEvent(type, payload, causationId);
  _currentCausationId = event.id;
  appendToLog(event);
  return event;
}

/**
 * Set the causation ID for the current operation chain.
 * Use this when a top-level user action triggers multiple sub-events.
 */
export function setCausationId(id: string): void {
  _currentCausationId = id;
}

/**
 * Clear the current causation chain.
 */
export function clearCausationId(): void {
  _currentCausationId = undefined;
}

/**
 * Serialize the event log to a JSON string suitable for export.
 */
export function serializeEventLog(events: DomainEvent[]): string {
  return JSON.stringify(events, null, 2);
}

/**
 * Filter events by type for selective audit trail rendering.
 */
export function filterEventsByType(
  events: DomainEvent[],
  types: DomainEventType[],
): DomainEvent[] {
  const typeSet = new Set<string>(types);
  return events.filter((e) => typeSet.has(e.type));
}
