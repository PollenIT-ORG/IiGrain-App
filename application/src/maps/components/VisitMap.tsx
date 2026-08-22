import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppMapView from './AppMapView';
import MapKindSwitch from './MapKindSwitch';
import { MapMarker, MapPolygon, MapPolyline } from './MapPrimitives';
import { useMapCamera } from '../hooks/useMapCamera';
import { useRouteToDestination } from '../hooks/useRouteToDestination';
import { DEFAULT_FIT_PADDING, MAP_ZOOM } from '../config/mapDefaults';
import type { LatLng, MapKind } from '../types';
import {
  distanceMeters,
  formatDistance,
  formatDuration,
  isValidLatLng,
  polygonCentroid,
} from '../utils/geo';

export type { LatLng };

export interface VisitMapProps {
  assessor: LatLng | null;
  destination: LatLng | null;
  trail?: readonly LatLng[];
  boundary?: readonly LatLng[];
  fieldName?: string;
  lastSeenISO?: string | null;
  style?: ViewStyle;
}

const FOLLOW_DISTANCE_M = 150;

const ROUTE_WIDTH = 5;
const FALLBACK_WIDTH = 3;
const BOUNDARY_STROKE = COLORS.accent;
const BOUNDARY_FILL = 'rgba(255,152,0,0.18)';

const DEFAULT_MAP_KIND: MapKind = 'hybrid';

const MIN_RING_POINTS = 3;

const STALE_AFTER_MS = 90_000;

const AGE_TICK_MS = 15_000;

const useNow = (enabled: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
};

const useSettledMarker = (): boolean => {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
  }, []);
  return tracks;
};

const VisitMap: React.FC<VisitMapProps> = ({
  assessor,
  destination,
  boundary,
  fieldName,
  lastSeenISO,
  style,
}) => {
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();
  const tracksViewChanges = useSettledMarker();
  const [mapKind, setMapKind] = useState<MapKind>(DEFAULT_MAP_KIND);

  const now = useNow(!!lastSeenISO);
  const staleness = useMemo(() => {
    if (!lastSeenISO) {
      return null;
    }
    const seenAt = Date.parse(lastSeenISO);
    if (!Number.isFinite(seenAt)) {
      return null;
    }
    const ageMs = Math.max(now - seenAt, 0);
    return ageMs < STALE_AFTER_MS
      ? null
      : { label: `Last seen ${formatDuration(ageMs / 1000)} ago` };
  }, [lastSeenISO, now]);

  const boundaryRing = useMemo(
    () => (boundary ?? []).filter(isValidLatLng),
    [boundary],
  );
  const hasBoundary = boundaryRing.length >= MIN_RING_POINTS;

  const target = useMemo<LatLng | null>(() => {
    if (isValidLatLng(destination)) {
      return destination;
    }
    return hasBoundary ? polygonCentroid(boundaryRing) : null;
  }, [destination, hasBoundary, boundaryRing]);

  const { route, path, isFallback, directDistanceMeters } = useRouteToDestination(
    assessor,
    target,
  );

  const hasAssessor = isValidLatLng(assessor);
  const hasDestination = target !== null;

  const lastFramedRef = useRef<LatLng | null>(null);
  const framedOnceRef = useRef(false);

  const frameBoth = useCallback(() => {
    const points: LatLng[] = [];
    if (assessor && hasAssessor) {
      points.push(assessor);
    }
    if (target) {
      points.push(target);
    }
    points.push(...boundaryRing);

    if (points.length >= 2) {
      camera.fitToCoordinates(points, DEFAULT_FIT_PADDING);
    } else if (points.length === 1) {
      camera.animateToCoordinate(points[0], MAP_ZOOM.CITY);
    }

    lastFramedRef.current = assessor ?? target ?? null;
  }, [assessor, target, hasAssessor, boundaryRing, camera]);

  useEffect(() => {
    if (!isReady || framedOnceRef.current) {
      return;
    }
    if (!hasAssessor && !hasDestination) {
      return;
    }
    framedOnceRef.current = true;
    frameBoth();
  }, [isReady, hasAssessor, hasDestination, frameBoth]);

  const framedBoundaryRef = useRef(false);
  useEffect(() => {
    if (!isReady || !hasBoundary || framedBoundaryRef.current) {
      return;
    }
    framedBoundaryRef.current = true;
    frameBoth();
  }, [isReady, hasBoundary, frameBoth]);

  useEffect(() => {
    if (!isReady || !framedOnceRef.current || !hasAssessor || !assessor) {
      return;
    }
    const previous = lastFramedRef.current;
    if (previous && distanceMeters(previous, assessor) < FOLLOW_DISTANCE_M) {
      return;
    }
    frameBoth();
  }, [isReady, hasAssessor, assessor, frameBoth]);

  const badge = (() => {
    if (route) {
      return `${formatDistance(route.distanceMeters)} · ${formatDuration(
        route.durationSeconds,
      )} away`;
    }
    if (directDistanceMeters !== null) {
      return `${formatDistance(directDistanceMeters)} away`;
    }
    return null;
  })();

  return (
    <View style={[styles.wrap, style]}>
      <AppMapView
        ref={mapRef}
        onReady={onMapReady}
        initialCenter={target ?? assessor}
        initialZoom={MAP_ZOOM.CITY}
        mapKind={mapKind}
        style={styles.map}>
        {hasBoundary ? (
          <MapPolygon
            coordinates={[...boundaryRing]}
            strokeColor={BOUNDARY_STROKE}
            fillColor={BOUNDARY_FILL}
            strokeWidth={2}
            zIndex={0}
          />
        ) : null}

        {path.length >= 2 ? (
          <MapPolyline
            coordinates={[...path]}
            strokeColor={COLORS.primary}
            strokeWidth={isFallback ? FALLBACK_WIDTH : ROUTE_WIDTH}
            lineDashPattern={isFallback ? [6, 10] : undefined}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        ) : null}

        {target ? (
          <MapMarker
            coordinate={target}
            anchor={hasBoundary ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
            tracksViewChanges={tracksViewChanges}
            zIndex={3}
            title={fieldName || 'Field'}
            description={hasBoundary ? undefined : 'Location marker — no boundary drawn yet'}>
            <View style={hasBoundary ? styles.fieldDot : styles.destPin}>
              <AppIcon
                name={hasBoundary ? ICONS.BOUNDARY : ICONS.MAP_MARKER}
                size={moderateScale(hasBoundary ? 13 : 16)}
                color={COLORS.white}
              />
            </View>
          </MapMarker>
        ) : null}

        {hasAssessor && assessor ? (
          <MapMarker
            coordinate={assessor}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges}
            zIndex={4}
            title="Assessor"
            description={staleness?.label}>
            <View style={[styles.assessorBadge, staleness && styles.assessorStale]}>
              <AppIcon name="account" size={moderateScale(16)} color={COLORS.white} />
            </View>
          </MapMarker>
        ) : null}
      </AppMapView>

      <MapKindSwitch value={mapKind} onChange={setMapKind} style={styles.kindSwitch} />

      {staleness ? (
        <View style={[styles.badge, styles.staleBadge]} pointerEvents="none">
          <View style={[styles.badgeDot, styles.staleDot]} />
          <AppText style={styles.badgeText}>{staleness.label}</AppText>
        </View>
      ) : badge ? (
        <View style={styles.badge} pointerEvents="none">
          <View style={styles.badgeDot} />
          <AppText style={styles.badgeText}>{badge}</AppText>
        </View>
      ) : null}

      <Pressable
        onPress={frameBoth}
        style={styles.recenterBtn}
        accessibilityRole="button"
        accessibilityLabel="Recenter map">
        <AppIcon name="crosshairs-gps" size={moderateScale(22)} color={COLORS.primary} />
      </Pressable>
    </View>
  );
};

export default React.memo(VisitMap);

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  map: { flex: 1 },

  destPin: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thick,
    borderColor: COLORS.white,
    ...shadows.md,
  },
  fieldDot: {
    width: scale(26),
    height: scale(26),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thick,
    borderColor: COLORS.white,
    ...shadows.md,
  },
  assessorBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thick,
    borderColor: COLORS.white,
    ...shadows.md,
  },

  kindSwitch: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
  },

  badge: {
    position: 'absolute',
    top: scale(58),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    ...shadows.md,
  },
  badgeDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
  },
  assessorStale: { backgroundColor: COLORS.gray500 },
  staleBadge: { borderWidth: borderWidth.thin, borderColor: COLORS.gray300 },
  staleDot: { backgroundColor: COLORS.gray500 },
  badgeText: { ...presets.labelSM, color: COLORS.gray900 },

  recenterBtn: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.lg,
  },
});
