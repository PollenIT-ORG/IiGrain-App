/**
 * src/maps/components/VisitMap.tsx — live assessor-to-field tracking map.
 *
 * Migrated from `src/components/location/VisitMap.tsx`, which drew the same
 * scene in Leaflet inside a WebView and routed through the public OSRM demo
 * server. Same props (`assessor`, `destination`, `style`), so both tracking
 * screens changed only their import.
 *
 * WHAT THIS SCREEN HAS TO GET RIGHT
 * ---------------------------------
 * 1. POSITION UPDATES ARE FREQUENT AND THE USER IS WATCHING. Anything that
 *    re-rasterises a marker or refetches a route per tick is both a battery
 *    cost and a visible stutter. Hence `tracksViewChanges={false}` on settled
 *    markers and the throttling inside `useRouteToDestination`.
 * 2. THE ROUTE MAY NOT EXIST. Farm tracks are frequently absent from Google's
 *    road graph, and rural coverage drops out. A dashed straight line and a
 *    crow-flies distance is a correct, useful answer — not an error state.
 * 3. THE CAMERA MUST NOT FIGHT THE USER. It frames both points once, then
 *    follows only when the assessor has genuinely moved on (FOLLOW_DISTANCE_M).
 *    Everything else is the explicit recentre button.
 *
 * WHY THE PULSING ASSESSOR HALO FROM THE LEAFLET VERSION IS GONE
 * A continuously animated marker child forces `tracksViewChanges` to stay true,
 * which re-uploads the marker bitmap to the GPU every frame. On Android that
 * measurably drops the map's frame rate for the entire session. The live-ness
 * is now conveyed by the marker actually moving plus the "· min away" badge.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppMapView from './AppMapView';
import { MapMarker, MapPolyline } from './MapPrimitives';
import { useMapCamera } from '../hooks/useMapCamera';
import { useRouteToDestination } from '../hooks/useRouteToDestination';
import { DEFAULT_FIT_PADDING, MAP_ZOOM } from '../config/mapDefaults';
import type { LatLng } from '../types';
import { distanceMeters, formatDistance, formatDuration, isValidLatLng } from '../utils/geo';

export type { LatLng };

export interface VisitMapProps {
  /** Live assessor position, streamed over the visit socket. */
  assessor: LatLng | null;
  /** The field being visited. Fixed for the life of the screen. */
  destination: LatLng | null;
  style?: ViewStyle;
}

/**
 * How far the assessor must travel before the camera re-frames.
 *
 * Small enough that the marker never walks off screen unnoticed, large enough
 * that ordinary GPS noise (5–20 m) never triggers a camera animation.
 */
const FOLLOW_DISTANCE_M = 150;

/** Route line weight, in points. Thicker than the fallback so the real road
 *  reads as the confident answer. */
const ROUTE_WIDTH = 5;
const FALLBACK_WIDTH = 3;

/**
 * Markers start with `tracksViewChanges` on so their custom child view gets
 * rasterised at least once, then switch it off permanently. Without the initial
 * `true` the marker renders as an empty square on Android; without the switch to
 * `false` every frame re-uploads the bitmap.
 */
const useSettledMarker = (): boolean => {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    // One frame is not always enough for the icon font to have laid out; a
    // short timeout is the pragmatic, widely-used fix.
    const timer = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(timer);
  }, []);
  return tracks;
};

const VisitMap: React.FC<VisitMapProps> = ({ assessor, destination, style }) => {
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();
  const { route, path, isFallback, directDistanceMeters } = useRouteToDestination(
    assessor,
    destination,
  );
  const tracksViewChanges = useSettledMarker();

  const hasAssessor = isValidLatLng(assessor);
  const hasDestination = isValidLatLng(destination);

  // Where the camera was last framed from — drives the follow threshold.
  const lastFramedRef = useRef<LatLng | null>(null);
  const framedOnceRef = useRef(false);

  const frameBoth = useCallback(() => {
    const points: LatLng[] = [];
    if (assessor && hasAssessor) {
      points.push(assessor);
    }
    if (destination && hasDestination) {
      points.push(destination);
    }

    if (points.length >= 2) {
      camera.fitToCoordinates(points, DEFAULT_FIT_PADDING);
    } else if (points.length === 1) {
      camera.animateToCoordinate(points[0], MAP_ZOOM.CITY);
    }

    lastFramedRef.current = assessor ?? destination ?? null;
  }, [assessor, destination, hasAssessor, hasDestination, camera]);

  // First framing: as soon as the map is ready and we know at least one point.
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

  // Follow: re-frame only once the assessor has genuinely moved on.
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
        initialCenter={destination ?? assessor}
        initialZoom={MAP_ZOOM.CITY}
        style={styles.map}>
        {path.length >= 2 ? (
          <MapPolyline
            coordinates={[...path]}
            strokeColor={COLORS.primary}
            strokeWidth={isFallback ? FALLBACK_WIDTH : ROUTE_WIDTH}
            // Dashes say "we don't know the road, this is as the crow flies".
            lineDashPattern={isFallback ? [6, 10] : undefined}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {hasDestination && destination ? (
          <MapMarker
            coordinate={destination}
            // Anchor the tip of our custom pin at the coordinate. The SDK
            // default (0.5, 1) assumes a bottom-centred bitmap, which ours is.
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={tracksViewChanges}
            title="Field">
            <View style={styles.destPin}>
              <AppIcon name="home-outline" size={moderateScale(16)} color={COLORS.white} />
            </View>
          </MapMarker>
        ) : null}

        {hasAssessor && assessor ? (
          <MapMarker
            coordinate={assessor}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges}
            // Keep the live marker above the destination when they overlap.
            zIndex={2}
            title="Assessor">
            <View style={styles.assessorBadge}>
              <AppIcon name="account" size={moderateScale(16)} color={COLORS.white} />
            </View>
          </MapMarker>
        ) : null}
      </AppMapView>

      {badge ? (
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

  badge: {
    position: 'absolute',
    top: spacing[3],
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
