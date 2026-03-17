// ─── SplitScreen Layout ─────────────────────────────────────────────────────
// Flexbox 40/60 split with draggable resize handle.
// Responsive: collapses to stacked on tablet, single column on mobile.

import { useRef, useState, useCallback, useEffect } from 'react';
import { CoPilotPane } from '@/components/CoPilot/CoPilotPane';
import { MapView } from '@/components/Map/MapView';

const MIN_LEFT_PX = 320;
const MIN_RIGHT_PX = 400;
const HANDLE_WIDTH = 6;

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

function getLayoutMode(width: number): LayoutMode {
  if (width >= 1280) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function SplitScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    getLayoutMode(window.innerWidth),
  );

  // Track window size for responsive layout
  useEffect(() => {
    function handleResize() {
      setLayoutMode(getLayoutMode(window.innerWidth));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handler for the resize handle
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (layoutMode !== 'desktop') return;
      e.preventDefault();
      setIsDragging(true);
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
    },
    [layoutMode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const containerW = rect.width;

      const clampedX = Math.max(
        MIN_LEFT_PX,
        Math.min(x, containerW - MIN_RIGHT_PX),
      );
      const pct = (clampedX / containerW) * 100;
      setLeftPct(pct);
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Desktop: side-by-side with draggable handle
  if (layoutMode === 'desktop') {
    return (
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Left pane: Co-Pilot */}
        <aside
          aria-label="Nature Risk Co-Pilot panel"
          style={{
            width: `${leftPct}%`,
            minWidth: MIN_LEFT_PX,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <CoPilotPane />
        </aside>

        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          aria-valuenow={Math.round(leftPct)}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setLeftPct((p) => Math.max((MIN_LEFT_PX / (containerRef.current?.getBoundingClientRect().width ?? 1000)) * 100, p - 2));
            } else if (e.key === 'ArrowRight') {
              setLeftPct((p) => Math.min(100 - (MIN_RIGHT_PX / (containerRef.current?.getBoundingClientRect().width ?? 1000)) * 100, p + 2));
            }
          }}
          style={{
            width: HANDLE_WIDTH,
            cursor: 'col-resize',
            background: isDragging ? 'var(--green)' : 'transparent',
            transition: isDragging ? 'none' : 'background 0.2s',
            zIndex: 20,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 2,
              height: 40,
              borderRadius: 1,
              background: isDragging
                ? 'var(--green)'
                : 'rgba(255,255,255,0.15)',
              transition: 'background 0.2s',
            }}
          />
        </div>

        {/* Right pane: Map */}
        <section
          aria-label="Interactive map"
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        >
          <MapView />
        </section>
      </div>
    );
  }

  // Tablet: stacked layout
  if (layoutMode === 'tablet') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <aside
          aria-label="Nature Risk Co-Pilot panel"
          style={{
            height: '50%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          <CoPilotPane />
        </aside>
        <section
          aria-label="Interactive map"
          style={{ height: '50%', position: 'relative', overflow: 'hidden' }}
        >
          <MapView />
        </section>
      </div>
    );
  }

  // Mobile: single column
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <aside
        aria-label="Nature Risk Co-Pilot panel"
        style={{
          height: '60%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        <CoPilotPane />
      </aside>
      <section
        aria-label="Interactive map"
        style={{ height: '40%', position: 'relative', overflow: 'hidden' }}
      >
        <MapView />
      </section>
    </div>
  );
}
