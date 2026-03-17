// ─── ActionStream ───────────────────────────────────────────────────────────
// Live checklist of analysis steps with status indicators.
// Collapsible: expands to show all steps, collapses to one-line summary.

import { useState, useMemo } from 'react';
import { useNatureRiskStore } from '@/store';
import type { ActionStreamEntry } from '@/types';

export function ActionStream() {
  const actionStream = useNatureRiskStore((s) => s.actionStream);
  const [expanded, setExpanded] = useState(true);

  const hasRunning = actionStream.some((s) => s.status === 'running');
  const doneCount = actionStream.filter((s) => s.status === 'done').length;
  const totalCount = actionStream.length;

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'No analysis steps';
    if (hasRunning) return `Running... (${doneCount}/${totalCount} complete)`;
    const hasError = actionStream.some((s) => s.status === 'error');
    if (hasError) return `Complete with errors (${doneCount}/${totalCount})`;
    return `All ${totalCount} steps complete`;
  }, [actionStream, hasRunning, doneCount, totalCount]);

  if (totalCount === 0) return null;

  return (
    <section
      aria-label="Analysis progress stream"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls="action-stream-steps"
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((p) => !p);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {hasRunning && (
            <div
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '2px solid rgba(52,211,153,0.2)',
                borderTopColor: 'var(--green)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          Agent Steps
        </div>
        <span
          aria-hidden="true"
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
        >
          &#9660;
        </span>
      </div>

      {expanded && (
        <div
          id="action-stream-steps"
          role="list"
          style={{
            padding: '0 14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {actionStream.map((step, i) => (
            <StreamStep key={step.id} step={step} index={i} />
          ))}
        </div>
      )}

      {!expanded && (
        <div
          aria-live="polite"
          style={{
            fontSize: '0.78rem',
            color: 'var(--green)',
            padding: '4px 14px 10px',
          }}
        >
          {summaryText}
        </div>
      )}
    </section>
  );
}

function StreamStep({
  step,
  index,
}: {
  step: ActionStreamEntry;
  index: number;
}) {
  const time = (step.completedAt ?? step.startedAt)
    ? new Date(step.completedAt ?? step.startedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <div
      role="listitem"
      className="fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '0.78rem',
        color:
          step.status === 'running'
            ? 'var(--green)'
            : step.status === 'done'
              ? 'var(--text-secondary)'
              : step.status === 'error'
                ? 'var(--red)'
                : 'var(--text-muted)',
        padding: '4px 0',
        animationDelay: `${index * 60}ms`,
      }}
    >
      <StepIcon status={step.status} />
      <span style={{ flex: 1 }}>{step.label}</span>
      <span
        style={{
          fontSize: '0.65rem',
          fontFamily: 'var(--mono)',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        {time}
      </span>
    </div>
  );
}

function StepIcon({ status }: { status: ActionStreamEntry['status'] }) {
  const base: React.CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    flexShrink: 0,
  };

  if (status === 'running') {
    return (
      <div
        aria-label="Running"
        style={{
          ...base,
          background: 'rgba(52,211,153,0.15)',
          border: '1.5px solid var(--green)',
          color: 'var(--green)',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            border: '1.5px solid transparent',
            borderTopColor: 'var(--green)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div
        aria-label="Complete"
        style={{ ...base, background: 'rgba(52,211,153,0.15)', color: 'var(--green)' }}
      >
        &#10003;
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        aria-label="Error"
        style={{ ...base, background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }}
      >
        &#10005;
      </div>
    );
  }

  return (
    <div
      aria-label="Pending"
      style={{ ...base, background: 'rgba(71,85,105,0.4)', color: 'var(--text-muted)' }}
    >
      &#8226;
    </div>
  );
}
