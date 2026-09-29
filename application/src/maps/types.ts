export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

export interface MapRegion extends LatLng {
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

export type MapKind = 'standard' | 'satellite' | 'hybrid' | 'terrain';

export interface MapEdgePadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface AppMapHandle {
  animateToRegion: (region: MapRegion, durationMs?: number) => void;
  animateToCoordinate: (coordinate: LatLng, zoom?: number, durationMs?: number) => void;
  setCoordinate: (coordinate: LatLng, zoom?: number) => void;
  fitToCoordinates: (coordinates: readonly LatLng[], padding?: MapEdgePadding) => void;
}

export interface MapEntity<TData = unknown> {
  readonly id: string;
  readonly coordinate: LatLng;
  readonly title: string;
  readonly subtitle?: string;
  readonly meta?: string;
  readonly pinColor?: string;
  readonly searchText?: string;
  readonly data?: TData;
}

export interface MapRoute {
  readonly path: readonly LatLng[];
  readonly distanceMeters: number;
  readonly durationSeconds: number;
}

export interface MapFocusHandle {
  focus: () => void;
}
