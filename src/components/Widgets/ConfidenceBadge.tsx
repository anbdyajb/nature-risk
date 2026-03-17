// ─── ConfidenceBadge ────────────────────────────────────────────────────────
// Coloured badge: High=green, Medium=amber, Low=red.
// Shows uncertainty range and expandable data-source tooltip.

import { useState, useRef, useEffect } from 'react';
import type { ConfidenceScore } from '@/types';

interface ConfidenceBadgeProps {
  confidence: ConfidenceScore;
}

const LEVEL_COLOURS: Record<
  ConfidenceScore['level'],
  { bg: string; border: string; color: string }
> = {
  High: {
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.3)',
    color: 'var(--green)',
  },
  Medium: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    color: 'var(--amber)',
  },
  Low: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    color: 'var(--red)',
  },
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const colours = LEVEL_COLOURS[confidence.level];

  // Close tooltip on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        position: 'relative',
      }}
    >
      {/* Badge */}
      <button
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-label={`Confidence: ${confidence.level}. Click for details.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '5px 12px',
          borderRadius: 99,
          fontFamily: 'var(--mono)',
          background: colours.bg,
          border: `1px solid ${colours.border}`,
          color: colours.color,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {/* Dot */}
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'currentColor',
          }}
        />
        {confidence.level}
      </button>

      {/* Uncertainty range */}
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        &plusmn;{confidence.uncertaintyPct}%
      </span>

      {/* Expandable tooltip */}
      {expanded && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            zIndex: 100,
            minWidth: 240,
            maxWidth: 320,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
              fontSize: '0.75rem',
            }}
          >
            Data Sources
          </div>

          {confidence.dataSources.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              No data sources listed
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {confidence.dataSources.map((ds, i) => (
                <div
                  key={i}
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      color: 'var(--blue)',
                      fontSize: '0.72rem',
                    }}
                  >
                    {ds.name}
                  </div>
                  {ds.resolution && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Resolution: {ds.resolution}
                    </div>
                  )}
                  {ds.lastUpdated && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Updated: {ds.lastUpdated}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    {ds.licence}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
