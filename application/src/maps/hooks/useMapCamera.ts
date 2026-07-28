/**
 * src/maps/hooks/useMapCamera.ts — a camera controller that is safe to call
 * before the map exists.
 *
 * THE BUG THIS HOOK EXISTS TO PREVENT
 * -----------------------------------
 * `MapView`'s camera methods are no-ops until the native surface has finished
 * initialising (`onMapReady`). That is invisible in development on a fast
 * device — the map is ready long before a GPS fix arrives — and reliably broken
 * on a cold start, a slow device, or when the screen already knows the
 * coordinate at mount. The symptom is a map that opens on the country-level
 * default and never moves, with no error anywhere.
 *
 * So: every camera call made before readiness is stored, and the LAST one is
 * replayed the moment the map reports ready. Only the last, because the
 * intermediate camera positions of a movement the user never saw are not worth
 * animating through.
 */

import { useCallback, useRef, useState } from 'react';
import type { AppMapHandle, LatLng, MapEdgePadding, MapRegion } from '../types';

/** A camera command captured while the map was not yet ready. */
type PendingCommand =
  | { kind: 'region'; region: MapRegion; durationMs?: number }
  | { kind: 'coordinate'; coordinate: LatLng; zoom?: number; durationMs?: number }
  | { kind: 'set'; coordinate: LatLng; zoom?: number }
  | { kind: 'fit'; coordinates: readonly LatLng[]; padding?: MapEdgePadding };

export interface UseMapCamera {
  /** Attach to `<AppMapView ref={...}>`. */
  mapRef: React.RefObject<AppMapHandle | null>;
  /** Attach to `<AppMapView onReady={...}>`. */
  onMapReady: () => void;
  /** `true` once the native surface can accept camera commands. */
  isReady: boolean;
  /** Same surface as `AppMapHandle`, but buffered until ready. */
  camera: AppMapHandle;
}

export const useMapCamera = (): UseMapCamera => {
  const mapRef = useRef<AppMapHandle | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
  // Mirrored in state as well as a ref: the ref drives the imperative logic
  // without stale-closure risk, the state lets screens render "map loading".
  const [isReady, setIsReady] = useState(false);

  const run = useCallback((command: PendingCommand) => {
    const handle = mapRef.current;
    if (!readyRef.current || !handle) {
      pendingRef.current = command;
      return;
    }
    switch (command.kind) {
      case 'region':
        handle.animateToRegion(command.region, command.durationMs);
        break;
      case 'coordinate':
        handle.animateToCoordinate(command.coordinate, command.zoom, command.durationMs);
        break;
      case 'set':
        handle.setCoordinate(command.coordinate, command.zoom);
        break;
      case 'fit':
        handle.fitToCoordinates(command.coordinates, command.padding);
        break;
    }
  }, []);

  const onMapReady = useCallback(() => {
    readyRef.current = true;
    setIsReady(true);

    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      run(pending);
    }
  }, [run]);

  const camera = useRef<AppMapHandle>({
    animateToRegion: (region, durationMs) => run({ kind: 'region', region, durationMs }),
    animateToCoordinate: (coordinate, zoom, durationMs) =>
      run({ kind: 'coordinate', coordinate, zoom, durationMs }),
    setCoordinate: (coordinate, zoom) => run({ kind: 'set', coordinate, zoom }),
    fitToCoordinates: (coordinates, padding) =>
      run({ kind: 'fit', coordinates, padding }),
  }).current;

  return { mapRef, onMapReady, isReady, camera };
};
