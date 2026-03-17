// ─── DrawControls ───────────────────────────────────────────────────────────
// Polygon draw tool for intervention areas.
// Calculates area in hectares, validates minimum area, stores in state.

import { useState, useCallback, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import { useNatureRiskStore } from '@/store';
import { MIN_INTERVENTION_AREA_HA } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { GeoJSONPolygon } from '@/types';

interface DrawControlsProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

type DrawMode = 'idle' | 'drawing';

// Calculate polygon area in hectares from [lng, lat] coordinates
function calculateAreaHa(coordinates: number[][]): number {
  if (coordinates.length < 3) return 0;

  const centroidLat =
    coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const latRad = (centroidLat * Math.PI) / 180;
  const mPerDegLng = 111320 * Math.cos(latRad);
  const mPerDegLat = 110540;

  const projected = coordinates.map((c) => [
    c[0] * mPerDegLng,
    c[1] * mPerDegLat,
  ]);

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i][0] * projected[j][1];
    area -= projected[j][0] * projected[i][1];
  }
  area = Math.abs(area) / 2;

  return area / 10000;
}

export function DrawControls({ mapRef }: DrawControlsProps) {
  const [drawMode, setDrawMode] = useState<DrawMode>('idle');
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const drawSourceReady = useRef(false);
  const verticesRef = useRef<[number, number][]>([]);

  // Keep a ref in sync for use in event handlers
  useEffect(() => {
    verticesRef.current = vertices;
  }, [vertices]);

  const drawInterventionPolygon = useNatureRiskStore((s) => s.drawInterventionPolygon);
  const resetAnalysis = useNatureRiskStore((s) => s.resetAnalysis);
  const interventionPolygon = useNatureRiskStore((s) => s.interventionPolygon);

  // Setup draw source/layer on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function setup() {
      if (!map!.getSource('draw-preview')) {
        map!.addSource('draw-preview', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map!.addLayer({
          id: 'draw-preview-fill',
          type: 'fill',
          source: 'draw-preview',
          paint: {
            'fill-color': '#34d399',
            'fill-opacity': 0.1,
          },
        });

        map!.addLayer({
          id: 'draw-preview-line',
          type: 'line',
          source: 'draw-preview',
          paint: {
            'line-color': '#34d399',
            'line-width': 2,
            'line-dasharray': [4, 2],
          },
        });
      }
      drawSourceReady.current = true;
    }

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.on('load', setup);
    }
  }, [mapRef]);

  // Update preview polygon on map as vertices change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawSourceReady.current) return;

    const source = map.getSource('draw-preview') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (vertices.length >= 2) {
      const ring = [...vertices, vertices[0]];
      source.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {},
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [vertices, mapRef]);

  // Start drawing
  const startDrawing = useCallback(() => {
    setDrawMode('drawing');
    setVertices([]);
    setWarning(null);

    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = 'crosshair';
    }
  }, [mapRef]);

  // Finish drawing and validate
  const finishDrawing = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = '';
    }

    setDrawMode('idle');

    // Clean up vertex markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear preview
    if (map && drawSourceReady.current) {
      const source = map.getSource('draw-preview') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    const currentVertices = verticesRef.current;

    if (currentVertices.length < 3) {
      setWarning('A polygon requires at least 3 points.');
      return;
    }

    const ring = [...currentVertices, currentVertices[0]];
    const areaHa = calculateAreaHa(ring);

    if (areaHa < MIN_INTERVENTION_AREA_HA) {
      setWarning(
        `Area too small (${areaHa.toFixed(2)} ha). Minimum is ${MIN_INTERVENTION_AREA_HA} ha.`,
      );
    } else {
      setWarning(null);
    }

    const geometry: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [ring],
    };

    drawInterventionPolygon({
      id: uuidv4(),
      geometry,
      interventionType: 'tree_planting', // Default; user can change via CoPilot
      areaHa: Math.round(areaHa * 100) / 100,
      drawnAt: new Date().toISOString(),
    });
  }, [mapRef, drawInterventionPolygon]);

  // Handle map clicks during drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || drawMode !== 'drawing') return;

    function handleClick(e: maplibregl.MapMouseEvent) {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setVertices((prev) => [...prev, lngLat]);

      const el = document.createElement('div');
      el.style.cssText =
        'width:8px;height:8px;background:#34d399;border:2px solid #f1f5f9;border-radius:50%;';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map!);
      markersRef.current.push(marker);
    }

    function handleDblClick(e: maplibregl.MapMouseEvent) {
      e.preventDefault();
      // finishDrawing will be called via the button or dblclick
    }

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
    };
  }, [drawMode, mapRef]);

  // Clear / reset
  const handleClear = useCallback(() => {
    setDrawMode('idle');
    setVertices([]);
    setWarning(null);

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = mapRef.current;
    if (map && drawSourceReady.current) {
      const source = map.getSource('draw-preview') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    if (map) {
      map.getCanvas().style.cursor = '';
    }

    resetAnalysis();
  }, [mapRef, resetAnalysis]);

  const isDrawing = drawMode === 'drawing';
  const hasPolygon = interventionPolygon !== null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 56,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {!isDrawing ? (
        <button
          onClick={startDrawing}
          aria-label="Draw intervention polygon"
          style={{
            padding: '7px 14px',
            background: 'rgba(15,32,53,0.92)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--green)',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 17l4-4 4 4 4-8 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Draw Polygon
        </button>
      ) : (
        <button
          onClick={finishDrawing}
          disabled={vertices.length < 3}
          aria-label="Finish drawing polygon"
          style={{
            padding: '7px 14px',
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--green)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: vertices.length < 3 ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
            opacity: vertices.length < 3 ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          Finish ({vertices.length} pts) &mdash; double-click to close
        </button>
      )}

      {(hasPolygon || isDrawing) && (
        <button
          onClick={handleClear}
          aria-label="Clear drawn polygon"
          style={{
            padding: '7px 14px',
            background: 'rgba(15,32,53,0.92)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--red)',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          Clear
        </button>
      )}

      {hasPolygon && (
        <div
          style={{
            padding: '6px 12px',
            background: 'rgba(15,32,53,0.92)',
            border: `1px solid ${
              interventionPolygon!.areaHa < MIN_INTERVENTION_AREA_HA
                ? 'rgba(245,158,11,0.4)'
                : 'var(--border-glow)'
            }`,
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.72rem',
            fontFamily: 'var(--mono)',
            color:
              interventionPolygon!.areaHa < MIN_INTERVENTION_AREA_HA
                ? 'var(--amber)'
                : 'var(--green)',
            backdropFilter: 'blur(8px)',
          }}
        >
          Area: {interventionPolygon!.areaHa.toFixed(2)} ha
        </div>
      )}

      {warning && (
        <div
          role="alert"
          style={{
            padding: '6px 12px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.72rem',
            color: 'var(--amber)',
            maxWidth: 220,
            backdropFilter: 'blur(8px)',
          }}
        >
          {warning}
        </div>
      )}
    </div>
  );
}
