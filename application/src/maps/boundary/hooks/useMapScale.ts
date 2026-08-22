import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { MapRegion } from '../../types';
import {
  NUDGE_FRACTION_OF_SPAN,
  NUDGE_MAX_METERS,
  NUDGE_MIN_METERS,
  SNAP_MAX_METERS,
  SNAP_MIN_METERS,
  TOUCH_RADIUS_PT,
} from '../engine/boundaryConfig';

const METERS_PER_DEGREE_LAT = 111_320;

const DEFAULT_VIEW_HEIGHT = 640;

export interface UseMapScale {
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly onRegionChange: (region: MapRegion) => void;
  readonly snapMeters: () => number;
  readonly nudgeMeters: () => number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const useMapScale = (): UseMapScale => {
  const heightRef = useRef(DEFAULT_VIEW_HEIGHT);
  const spanRef = useRef(0);
  const [, force] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - heightRef.current) > 1) {
      heightRef.current = next;
      force(v => v + 1);
    }
  }, []);

  const onRegionChange = useCallback((region: MapRegion) => {
    spanRef.current = region.latitudeDelta * METERS_PER_DEGREE_LAT;
  }, []);

  const snapMeters = useCallback(() => {
    const span = spanRef.current;
    if (span <= 0) {
      return SNAP_MIN_METERS;
    }
    const perPoint = span / heightRef.current;
    return clamp(perPoint * TOUCH_RADIUS_PT, SNAP_MIN_METERS, SNAP_MAX_METERS);
  }, []);

  const nudgeMeters = useCallback(() => {
    const span = spanRef.current;
    if (span <= 0) {
      return NUDGE_MIN_METERS;
    }
    return clamp(span * NUDGE_FRACTION_OF_SPAN, NUDGE_MIN_METERS, NUDGE_MAX_METERS);
  }, []);

  return { onLayout, onRegionChange, snapMeters, nudgeMeters };
};
