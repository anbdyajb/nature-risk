// ─── RiskDeltaDial ──────────────────────────────────────────────────────────
// SVG gauge showing before/after risk value.
// Animated arc from 0-100%, colour-coded by improvement level.

import { useState, useMemo } from 'react';

interface RiskDeltaDialProps {
  beforeValue: number;
  afterValue: number;
  unit: string;
  label: string;
}

const RADIUS = 40;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const VIEWBOX_SIZE = 100;
const CENTER = VIEWBOX_SIZE / 2;

function getColour(delta: number): string {
  if (delta >= 10) return 'var(--green)';
  if (delta >= 5) return 'var(--amber)';
  return 'var(--red)';
}

function getColourRaw(delta: number): string {
  if (delta >= 10) return '#34d399';
  if (delta >= 5) return '#f59e0b';
  return '#ef4444';
}

export function RiskDeltaDial({
  beforeValue,
  afterValue,
  unit,
  label,
}: RiskDeltaDialProps) {
  const [hovered, setHovered] = useState(false);

  const delta = beforeValue - afterValue;
  const deltaPct = beforeValue > 0 ? (delta / beforeValue) * 100 : 0;
  const afterPct = beforeValue > 0 ? (afterValue / beforeValue) * 100 : 0;

  // Arc length for the "after" value
  const arcLength = (afterPct / 100) * CIRCUMFERENCE;
  const dashoffset = CIRCUMFERENCE - arcLength;

  const colour = useMemo(() => getColour(deltaPct), [deltaPct]);
  const colourRaw = useMemo(() => getColourRaw(deltaPct), [deltaPct]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(10,22,40,0.5)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
        position: 'relative',
        textAlign: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        width="80"
        height="80"
        style={{ display: 'block', margin: '0 auto' }}
        role="img"
        aria-label={`${label}: ${delta.toFixed(1)}${unit} reduction`}
      >
        {/* Background track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE_WIDTH}
        />

        {/* Animated arc */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={colourRaw}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{
            transition: 'stroke-dashoffset 1s ease',
          }}
        />

        {/* Center text */}
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill={colourRaw}
          fontSize="16"
          fontWeight="700"
          fontFamily="var(--mono)"
        >
          {delta > 0 ? '-' : ''}
          {Math.abs(delta).toFixed(1)}
        </text>
        <text
          x={CENTER}
          y={CENTER + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize="8"
          fontFamily="var(--mono)"
        >
          {unit}
        </text>
      </svg>

      {/* Label */}
      <div
        style={{
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          marginTop: 4,
        }}
      >
        {label}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '6px 10px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div>
            Before:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
              {beforeValue.toFixed(1)}
              {unit}
            </span>
          </div>
          <div>
            After:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: colour }}>
              {afterValue.toFixed(1)}
              {unit}
            </span>
          </div>
          <div>
            Reduction:{' '}
            <span style={{ fontFamily: 'var(--mono)', color: colour }}>
              {deltaPct.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
