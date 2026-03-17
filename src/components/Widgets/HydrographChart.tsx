// ─── HydrographChart ────────────────────────────────────────────────────────
// Simple SVG line chart showing peak flow over time.
// Two curves: "Before intervention" (red) and "After intervention" (green).
// Highlights peak reduction and delay.

import { useMemo } from 'react';

interface HydrographChartProps {
  /** Before-intervention peak flow (relative or absolute) */
  beforePeak: number;
  /** After-intervention peak flow */
  afterPeak: number;
  /** Delay in hours to the after-intervention peak */
  peakDelay: number;
  /** Total duration in hours for the X axis */
  duration: number;
}

const SVG_WIDTH = 320;
const SVG_HEIGHT = 100;
const PADDING = { top: 10, right: 10, bottom: 20, left: 35 };

const CHART_W = SVG_WIDTH - PADDING.left - PADDING.right;
const CHART_H = SVG_HEIGHT - PADDING.top - PADDING.bottom;

/**
 * Generate a simple bell-curve hydrograph.
 * peakTime is in hours, peak is the max flow value.
 */
function generateHydrograph(
  peak: number,
  peakTime: number,
  duration: number,
  points: number = 50,
): [number, number][] {
  const sigma = duration / 6; // controls the width of the bell
  const result: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const t = (i / points) * duration;
    const flow =
      peak * Math.exp(-0.5 * Math.pow((t - peakTime) / sigma, 2));
    result.push([t, flow]);
  }

  return result;
}

function toSvgPath(
  data: [number, number][],
  xScale: (t: number) => number,
  yScale: (v: number) => number,
): string {
  return data
    .map(([t, v], i) => {
      const x = xScale(t);
      const y = yScale(v);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function HydrographChart({
  beforePeak,
  afterPeak,
  peakDelay,
  duration,
}: HydrographChartProps) {
  const beforePeakTime = duration * 0.35;
  const afterPeakTime = beforePeakTime + peakDelay;

  const { beforePath, afterPath, xTicks, yMax } = useMemo(() => {
    const beforeData = generateHydrograph(
      beforePeak,
      beforePeakTime,
      duration,
    );
    const afterData = generateHydrograph(afterPeak, afterPeakTime, duration);

    const maxVal = Math.max(beforePeak, afterPeak) * 1.1;

    const xScale = (t: number) => PADDING.left + (t / duration) * CHART_W;
    const yScale = (v: number) =>
      PADDING.top + CHART_H - (v / maxVal) * CHART_H;

    const ticks: number[] = [];
    const step = duration / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round(i * step));
    }

    return {
      beforePath: toSvgPath(beforeData, xScale, yScale),
      afterPath: toSvgPath(afterData, xScale, yScale),
      xTicks: ticks,
      yMax: maxVal,
    };
  }, [beforePeak, afterPeak, beforePeakTime, afterPeakTime, duration]);

  const xScale = (t: number) => PADDING.left + (t / duration) * CHART_W;
  const yScale = (v: number) =>
    PADDING.top + CHART_H - (v / yMax) * CHART_H;

  const reduction = beforePeak - afterPeak;
  const reductionPct =
    beforePeak > 0 ? ((reduction / beforePeak) * 100).toFixed(0) : '0';

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(10,22,40,0.5)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height={SVG_HEIGHT}
        role="img"
        aria-label={`Hydrograph showing ${reductionPct}% peak flow reduction with ${peakDelay}h delay`}
        style={{ display: 'block' }}
      >
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = PADDING.top + CHART_H * (1 - frac);
          return (
            <line
              key={frac}
              x1={PADDING.left}
              y1={y}
              x2={SVG_WIDTH - PADDING.right}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* X-axis labels */}
        {xTicks.map((t) => (
          <text
            key={t}
            x={xScale(t)}
            y={SVG_HEIGHT - 4}
            textAnchor="middle"
            fill="#475569"
            fontSize="7"
            fontFamily="var(--mono)"
          >
            {t}h
          </text>
        ))}

        {/* Y-axis label */}
        <text
          x={4}
          y={PADDING.top + CHART_H / 2}
          textAnchor="middle"
          fill="#475569"
          fontSize="6"
          fontFamily="var(--mono)"
          transform={`rotate(-90 4 ${PADDING.top + CHART_H / 2})`}
        >
          m&sup3;/s
        </text>

        {/* Before curve (red) */}
        <path
          d={beforePath}
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* After curve (green) */}
        <path
          d={afterPath}
          fill="none"
          stroke="#34d399"
          strokeWidth="1.5"
        />

        {/* Peak markers */}
        <circle
          cx={xScale(beforePeakTime)}
          cy={yScale(beforePeak)}
          r="2.5"
          fill="#ef4444"
        />
        <circle
          cx={xScale(afterPeakTime)}
          cy={yScale(afterPeak)}
          r="2.5"
          fill="#34d399"
        />

        {/* Peak delay annotation */}
        <line
          x1={xScale(beforePeakTime)}
          y1={yScale(beforePeak) - 4}
          x2={xScale(afterPeakTime)}
          y2={yScale(afterPeak) - 4}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      </svg>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          display: 'flex',
          gap: 10,
          fontSize: '0.65rem',
          fontFamily: 'var(--mono)',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 2,
              borderRadius: 1,
              background: '#ef4444',
              display: 'inline-block',
            }}
          />
          Before
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-muted)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 2,
              borderRadius: 1,
              background: '#34d399',
              display: 'inline-block',
            }}
          />
          After
        </span>
      </div>
    </div>
  );
}
