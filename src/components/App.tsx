// ─── Nature Risk — Root Application Component ──────────────────────────────
// Renders the SplitScreen layout, demo banner, and persistent disclaimer.
// Initialises WASM physics engine on mount.

import { useEffect, useState } from 'react';
import { SplitScreen } from '@/components/Layout/SplitScreen';
import { useNatureRiskStore } from '@/store';
import { DISCLAIMER_TEXT } from '@/types';
import { initPhysics } from '@/services/physicsLoader';
import './App.css';

export function App() {
  const advisorMode = useNatureRiskStore((s) => s.advisorMode);
  const [wasmError, setWasmError] = useState<string | null>(null);

  // Initialise WASM physics engine on mount
  useEffect(() => {
    let cancelled = false;
    initPhysics().catch((err: unknown) => {
      if (!cancelled) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setWasmError(message);
        console.warn('WASM physics engine failed to load:', message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDemoMode = advisorMode === 'demo';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Demo banner */}
      {isDemoMode && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: 'relative',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background:
              'linear-gradient(90deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))',
            borderBottom: '1px solid rgba(245,158,11,0.4)',
            padding: '8px 20px',
            fontSize: '0.78rem',
            color: 'var(--amber)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <strong style={{ fontWeight: 600 }}>Demo Mode</strong> — No API key
          configured. Results are simulated using mock data.{' '}
          <a
            href="https://github.com/ruvnet/nature-risk"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--amber)', textDecoration: 'underline' }}
          >
            Configure API key
          </a>
        </div>
      )}

      {/* WASM status — only show error */}
      {wasmError && (
        <div
          role="status"
          style={{
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.3)',
            padding: '6px 20px',
            fontSize: '0.75rem',
            color: 'var(--red)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          Physics engine unavailable: {wasmError}. Falling back to JS
          calculations.
        </div>
      )}

      {/* Main layout */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <SplitScreen />
      </div>

      {/* Persistent disclaimer banner — PRD 9.1 */}
      <div
        role="contentinfo"
        aria-label="Legal disclaimer"
        style={{
          flexShrink: 0,
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(10, 22, 40, 0.6)',
          textAlign: 'center',
        }}
      >
        {DISCLAIMER_TEXT}
      </div>
    </div>
  );
}
