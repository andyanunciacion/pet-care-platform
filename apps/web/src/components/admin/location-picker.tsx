'use client';

import { isInPhilippines, parseLatLng, type LngLat } from '@paw/domain';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { describedBy } from './form-field';

// Free vector tiles from OpenFreeMap: no account or API key (ARCHITECTURE D7).
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
// Angeles City, where PAW launches.
const DEFAULT_CENTER: LngLat = { lng: 120.5887, lat: 15.145 };

/** 6 decimals ≈ 10 cm: more precision than a pin needs, and stable to compare. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const format = ({ lng, lat }: LngLat) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

interface Props {
  value: LngLat | null;
  onChange: (value: LngLat) => void;
  error?: string | undefined;
}

/**
 * The branch's map pin: click the map to place it, drag to adjust, or paste coordinates
 * (the keyboard-friendly way). MapLibre is loaded on first use, so only pages with a map
 * download it.
 */
export function LocationPicker({ value, onChange, error }: Props) {
  const t = useTranslations('AdminForms');
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [text, setText] = useState(value === null ? '' : format(value));
  const [textError, setTextError] = useState<string | null>(null);

  // The map's event handlers are attached once; this keeps them calling the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const initialValue = useRef(value);

  useEffect(() => {
    let cancelled = false;

    async function setUp() {
      const { Map, Marker, NavigationControl, setWorkerUrl } = await import('maplibre-gl');
      if (cancelled || container.current === null) return;
      // MapLibre v6 looks for its web worker next to its own file, which isn't where the
      // bundler puts it. `new URL(…, import.meta.url)` makes Next ship the worker file as an
      // asset and gives its final URL.
      setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

      const start = initialValue.current;
      const instance = new Map({
        container: container.current,
        style: MAP_STYLE,
        center: start ?? DEFAULT_CENTER,
        zoom: start === null ? 13 : 17,
      });
      instance.addControl(new NavigationControl({ showCompass: false }));
      const pin = new Marker({ draggable: true });
      map.current = instance;
      marker.current = pin;

      const place = (lngLat: LngLat) => {
        const rounded = { lng: round(lngLat.lng), lat: round(lngLat.lat) };
        pin.setLngLat(rounded).addTo(instance);
        setText(format(rounded));
        setTextError(null);
        onChangeRef.current(rounded);
      };
      if (start !== null) pin.setLngLat(start).addTo(instance);
      instance.on('click', (event) => {
        place(event.lngLat);
      });
      pin.on('dragend', () => {
        place(pin.getLngLat());
      });
      instance.on('error', () => {
        // Tiles failing (offline, provider down) shouldn't block the form.
        if (!instance.loaded()) setMapFailed(true);
      });
    }

    setUp().catch(() => {
      if (!cancelled) setMapFailed(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  function onPaste(next: string) {
    setText(next);
    if (next.trim() === '') {
      setTextError(null);
      return;
    }
    const parsed = parseLatLng(next);
    if (parsed === null) {
      setTextError(t('coordinatesInvalid'));
      return;
    }
    if (!isInPhilippines(parsed)) {
      setTextError(t('coordinatesOutside'));
      return;
    }
    setTextError(null);
    const rounded = { lng: round(parsed.lng), lat: round(parsed.lat) };
    onChange(rounded);
    if (map.current !== null && marker.current !== null) {
      marker.current.setLngLat(rounded).addTo(map.current);
      map.current.jumpTo({ center: rounded, zoom: Math.max(map.current.getZoom(), 16) });
    }
  }

  const shownError = textError ?? error;
  return (
    <div className="flex flex-col gap-2">
      {mapFailed ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {t('mapFailed')}
        </p>
      ) : (
        <div
          ref={container}
          role="region"
          aria-label={t('mapLabel')}
          className="h-96 w-full overflow-hidden rounded-lg border"
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="coordinates" className="text-sm font-medium">
          {t('pasteCoordinates')}
        </label>
        <Input
          id="coordinates"
          value={text}
          inputMode="decimal"
          placeholder="15.145000, 120.588700"
          className="max-w-sm font-mono"
          aria-invalid={shownError !== undefined}
          aria-describedby={describedBy('coordinates', undefined, shownError)}
          onChange={(event) => {
            onPaste(event.target.value);
          }}
        />
        {shownError !== undefined && (
          <p id="coordinates-error" className="text-sm text-destructive">
            {shownError}
          </p>
        )}
      </div>
    </div>
  );
}
