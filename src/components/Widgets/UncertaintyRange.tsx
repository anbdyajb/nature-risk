// ─── UncertaintyRange ───────────────────────────────────────────────────────
// Inline display: "Peak flow reduction: 12% +/- 3%"
// With tooltip explaining uncertainty basis.

import { useState } from 'react';

interface UncertaintyRangeProps {
  value: number;
  uncertainty: number;
  unit: string;
  label: string;
}

export function UncertaintyRange({
  value,
  uncertainty,
  unit,
  label,
}: UncertaintyRangeProps) {
  const [hovered, setHovered] = useState(false);

  const lower = Math.max(0, value - uncertainty);
  const upper = value + uncertainty;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <span
        style={{
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        {label}:{' '}
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontWeight: 600,
            color: 'var(--green)',
          }}
        >
          {value.toFixed(1)}
          {unit}
        </span>{' '}
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          &plusmn;{uncertainty}
          {unit}
        </span>
      </span>

      {/* Tooltip */}
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div>
            Range:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>
              {lower.toFixed(1)}
              {unit} &ndash; {upper.toFixed(1)}
              {unit}
            </span>
          </div>
          <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
            Uncertainty based on model resolution, input data quality, and
            parameter sensitivity analysis.
          </div>
        </div>
      )}
    </div>
  );
}
