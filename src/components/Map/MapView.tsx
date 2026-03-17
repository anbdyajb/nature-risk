// ─── MapView ────────────────────────────────────────────────────────────────
// MapLibre GL JS map with layer management, asset pin placement,
// GeoJSON sources for intervention polygons and opportunity zones.

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNatureRiskStore } from '@/store';
import { DrawControls } from '@/components/Map/DrawControls';
import { v4 as uuidv4 } from 'uuid';
import type { Coordinates, MapLayer } from '@/types';

const UK_CENTER: [number, number] = [-2.5, 54.5]; // [lng, lat]
const UK_ZOOM = 6;

/** Try MapTiler, fall back to OSM raster tiles */
function getMapStyle(): string | maplibregl.StyleSpecification {
  const key = (
    (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__MAPTILER_KEY__) ||
    import.meta.env.VITE_MAPTILER_KEY ||
    ''
  ) as string;

  if (key) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  }

  // OSM raster fallback
  return {
    version: 8,
    name: 'OSM Raster',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

export interface MapViewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getMap: () => maplibregl.Map | null;
}

export const MapView = forwardRef<MapViewHandle>(function MapView(_props, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const assetMarkerRef = useRef<maplibregl.Marker | null>(null);

  const assetPin = useNatureRiskStore((s) => s.assetPin);
  const interventionPolygon = useNatureRiskStore((s) => s.interventionPolygon);
  const opportunityZones = useNatureRiskStore((s) => s.opportunityZones);
  const activeLayers = useNatureRiskStore((s) => s.activeLayers);

  useImperativeHandle(
    ref,
    () => ({
      getCanvas: () => mapRef.current?.getCanvas() ?? null,
      getMap: () => mapRef.current,
    }),
    [],
  );

  // Initialise map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(),
      center: UK_CENTER,
      zoom: UK_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on('load', () => {
      // Add empty GeoJSON sources for dynamic layers
      map.addSource('intervention-polygon', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('asset-pin', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('opportunity-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('flood-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('catchment-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('flow-network', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Intervention polygon layer (green fill)
      map.addLayer({
        id: 'intervention-fill',
        type: 'fill',
        source: 'intervention-polygon',
        paint: {
          'fill-color': '#34d399',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'intervention-outline',
        type: 'line',
        source: 'intervention-polygon',
        paint: {
          'line-color': '#34d399',
          'line-width': 2,
        },
      });

      // Opportunity zones layer
      map.addLayer({
        id: 'opportunity-fill',
        type: 'fill',
        source: 'opportunity-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'rank'],
            1, '#34d399',
            2, '#3b82f6',
            3, '#06b6d4',
            '#34d399',
          ],
          'fill-opacity': 0.2,
        },
      });

      map.addLayer({
        id: 'opportunity-outline',
        type: 'line',
        source: 'opportunity-zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'rank'],
            1, '#34d399',
            2, '#3b82f6',
            3, '#06b6d4',
            '#34d399',
          ],
          'line-width': 1.5,
        },
      });

      // Flood zones layer
      map.addLayer({
        id: 'flood-zones-fill',
        type: 'fill',
        source: 'flood-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'floodZone'],
            '3', 'rgba(59,130,246,0.55)',
            '3b', 'rgba(59,130,246,0.55)',
            '2', 'rgba(99,179,237,0.45)',
            '1', 'rgba(52,211,153,0.25)',
            'rgba(52,211,153,0.15)',
          ],
          'fill-opacity': 0.6,
        },
        layout: { visibility: 'none' },
      });

      // Catchment boundary layer
      map.addLayer({
        id: 'catchment-outline',
        type: 'line',
        source: 'catchment-boundary',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [4, 2],
        },
        layout: { visibility: 'none' },
      });

      // Flow network layer
      map.addLayer({
        id: 'flow-lines',
        type: 'line',
        source: 'flow-network',
        paint: {
          'line-color': '#06b6d4',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
        layout: { visibility: 'none' },
      });
    });

    // Click to place asset pin in asset_manager mode
    map.on('click', (e) => {
      const store = useNatureRiskStore.getState();
      if (store.userIntent !== 'asset_manager') return;

      const coords: Coordinates = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      };

      store.placeAssetPin({
        location: coords,
        asset: {
          id: uuidv4(),
          type: 'other',
          label: `Asset at ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
          location: coords,
          description: 'User-placed asset pin',
        },
        placedAt: new Date().toISOString(),
      });
    });

    // Popup on opportunity zone click
    map.on('click', 'opportunity-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      const props = e.features[0].properties;
      if (!props) return;

      new maplibregl.Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-family:var(--font);">
            <strong style="color:var(--green);">${props.label ?? 'Opportunity Zone'}</strong>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">
              ${props.interventionType ? `Type: ${String(props.interventionType).replace(/_/g, ' ')}` : ''}
            </div>
          </div>`,
        )
        .addTo(map);
    });

    map.on('mouseenter', 'opportunity-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'opportunity-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update asset marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (assetMarkerRef.current) {
      assetMarkerRef.current.remove();
      assetMarkerRef.current = null;
    }

    if (assetPin) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px; height: 18px;
        background: linear-gradient(135deg, #3b82f6, #06b6d4);
        border: 2px solid #f1f5f9;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(59,130,246,0.5);
      `;
      el.title = assetPin.asset.label;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([assetPin.location.lng, assetPin.location.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setHTML(
            `<div>
              <strong>${assetPin.asset.label}</strong>
              <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">
                ${assetPin.asset.type.replace(/_/g, ' ')} &bull;
                ${assetPin.location.lat.toFixed(5)}, ${assetPin.location.lng.toFixed(5)}
              </div>
            </div>`,
          ),
        )
        .addTo(map);

      assetMarkerRef.current = marker;
    }
  }, [assetPin]);

  // Update intervention polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('intervention-polygon') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (interventionPolygon) {
      source.setData({
        type: 'Feature',
        geometry: interventionPolygon.geometry,
        properties: {
          id: interventionPolygon.id,
          areaHa: interventionPolygon.areaHa,
          interventionType: interventionPolygon.interventionType,
        },
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [interventionPolygon]);

  // Update opportunity zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('opportunity-zones') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (opportunityZones.length > 0) {
      source.setData({
        type: 'FeatureCollection',
        features: opportunityZones.map((zone) => ({
          type: 'Feature' as const,
          geometry: zone.geometry,
          properties: {
            id: zone.id,
            rank: zone.rank,
            label: zone.label,
            interventionType: zone.interventionType,
          },
        })),
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [opportunityZones]);

  // Update layer visibility based on store's activeLayers (Set<MapLayer>)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const layerMapping: Record<string, string[]> = {
      flood_zones: ['flood-zones-fill'],
      catchment_boundary: ['catchment-outline'],
      flow_network: ['flow-lines'],
      opportunity_zones: ['opportunity-fill', 'opportunity-outline'],
      intervention: ['intervention-fill', 'intervention-outline'],
    };

    for (const [layerKey, layerIds] of Object.entries(layerMapping)) {
      const visible = activeLayers.has(layerKey as MapLayer);
      for (const id of layerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
    }
  }, [activeLayers]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
        role="application"
        aria-label="MapLibre interactive map -- draw polygons or place markers to define your area of interest"
      />

      <DrawControls mapRef={mapRef} />
      <MapLayerControls />
      <MapInfoBar />
    </div>
  );
});

// ─── Map Layer Controls ─────────────────────────────────────────────────────

function MapLayerControls() {
  const activeLayers = useNatureRiskStore((s) => s.activeLayers);
  const toggleLayer = useNatureRiskStore((s) => s.toggleLayer);

  const layers: { key: MapLayer; label: string; icon: string }[] = [
    { key: 'flood_zones', label: 'Flood Zones', icon: '\u2602' },
    { key: 'catchment_boundary', label: 'Catchment', icon: '\u26C8' },
    { key: 'flow_network', label: 'Flow Network', icon: '\u2248' },
  ];

  return (
    <div
      role="group"
      aria-label="Map layer controls"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {layers.map(({ key, label, icon }) => {
        const active = activeLayers.has(key);
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            aria-pressed={active}
            aria-label={`Toggle ${label} layer`}
            style={{
              padding: '7px 14px',
              background: active
                ? 'rgba(52,211,153,0.08)'
                : 'rgba(15,32,53,0.92)',
              border: `1px solid ${active ? 'var(--border-glow)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              color: active ? 'var(--green)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {icon} {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Map Info Bar ───────────────────────────────────────────────────────────

function MapInfoBar() {
  const assetPin = useNatureRiskStore((s) => s.assetPin);
  const userIntent = useNatureRiskStore((s) => s.userIntent);

  const hint =
    userIntent === 'asset_manager'
      ? 'Click map to place asset pin \u2022 Use draw toolbar to mark intervention area'
      : 'Draw a polygon on the map to mark your proposed intervention area';

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        bottom: 30,
        left: 12,
        zIndex: 1000,
        background: 'rgba(15,32,53,0.92)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(8px)',
        maxWidth: 280,
      }}
    >
      <div>{hint}</div>
      {assetPin && (
        <div
          style={{
            fontFamily: 'var(--mono)',
            color: 'var(--green)',
            fontSize: '0.7rem',
            marginTop: 2,
          }}
        >
          Asset: {assetPin.location.lat.toFixed(5)},{' '}
          {assetPin.location.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
