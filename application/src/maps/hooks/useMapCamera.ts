import { useCallback, useRef, useState } from 'react';
import type { AppMapHandle, LatLng, MapEdgePadding, MapRegion } from '../types';

type PendingCommand =
  | { kind: 'region'; region: MapRegion; durationMs?: number }
  | { kind: 'coordinate'; coordinate: LatLng; zoom?: number; durationMs?: number }
  | { kind: 'set'; coordinate: LatLng; zoom?: number }
  | { kind: 'fit'; coordinates: readonly LatLng[]; padding?: MapEdgePadding };

export interface UseMapCamera {
  mapRef: React.RefObject<AppMapHandle | null>;
  onMapReady: () => void;
  isReady: boolean;
  camera: AppMapHandle;
}

export const useMapCamera = (): UseMapCamera => {
  const mapRef = useRef<AppMapHandle | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
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
