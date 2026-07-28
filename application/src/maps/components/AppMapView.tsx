/**
 * src/maps/components/AppMapView.tsx — THE map component.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This is the project's only sanctioned entry point to `react-native-maps`.
 * Nothing outside `src/maps/` may import that package (see docs/maps/ARCHITECTURE.md
 * → "The one-import rule"). Every map in the app is this component plus children.
 *
 * WHAT IT GUARANTEES SO CALL SITES DON'T HAVE TO
 *   1. PROVIDER — pinned to Google on BOTH platforms. Left to its default, iOS
 *      renders Apple MapKit, which ignores `customMapStyle`, has a different
 *      marker anchor model and different gesture inertia. Two renderers means
 *      every visual bug has to be reproduced twice. One provider, one behaviour.
 *   2. STYLE — the branded style array is applied here, not per screen, so a
 *      style change lands everywhere at once.
 *   3. CAMERA — exposed imperatively through a small typed handle
 *      (`AppMapHandle`) rather than as a controlled `region` prop. A controlled
 *      region fights the user: every pan emits a region change, the parent
 *      re-renders with the old region, and the map snaps back.
 *   4. EVENTS — the native events are normalised into app vocabulary
 *      (`onCenterChange` with a rounded `LatLng`), so screens never deal with
 *      `NativeSyntheticEvent`.
 *   5. CHROME — Google's Android "toolbar" (the two buttons that deep-link into
 *      the Google Maps app on marker press) is disabled. It navigates the user
 *      out of our app mid-flow.
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type Details,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { Env } from '../../config/env';
import { AGRI_MAP_STYLE, AGRI_MAP_STYLE_PREVIEW } from '../config/mapStyle';
import {
  COORDINATE_PRECISION,
  DEFAULT_FIT_PADDING,
  DEFAULT_MAP_REGION,
  MAP_ANIMATION,
  MAP_ZOOM,
} from '../config/mapDefaults';
import type { AppMapHandle, LatLng, MapEdgePadding, MapKind, MapRegion } from '../types';
import { regionFromZoom, roundCoordinate } from '../utils/geo';

/**
 * Google is pinned (guarantee 1) — but only where the native SDK is actually
 * keyed. On iOS `GMSMapView` raises an ObjC exception and *aborts the process*
 * if `GMSServices` was never given a key, so an unkeyed build would crash the
 * moment any map mounts rather than render blank. AppDelegate's
 * `configureGoogleMaps()` makes the same call: a missing key must not block
 * non-map work. Android reads its key from the manifest and degrades to an
 * empty grid instead of crashing, so it stays on Google.
 *
 * The guarantees above (customMapStyle, marker anchoring, gesture inertia) do
 * NOT hold on the Apple MapKit fallback. It is a developer convenience for
 * machines without Maps Platform access — never a shipping configuration.
 */
const MAPS_KEYED = Env.MAPS_API_KEY.length > 0;
const MAP_PROVIDER =
  Platform.OS === 'ios' && !MAPS_KEYED ? undefined : PROVIDER_GOOGLE;

if (__DEV__ && !MAPS_KEYED) {
  console.warn(
    '[maps] MAPS_API_KEY is empty. ' +
      (Platform.OS === 'ios'
        ? 'Falling back to Apple MapKit — branded styling is disabled. '
        : 'Google tiles will render blank. ') +
      'Set MAPS_API_KEY in application/.env, then re-run `pod install`.',
  );
}

/** Which style array to apply. Kept as a token, not a raw array, so screens
 *  cannot invent their own one-off map styling. */
export type MapStyleVariant = 'default' | 'preview';

export interface AppMapViewProps {
  /** Opening viewport. Ignored after mount — move the camera through the ref. */
  initialRegion?: MapRegion;
  /** Convenience alternative to `initialRegion`: a point plus a zoom level. */
  initialCenter?: LatLng | null;
  initialZoom?: number;

  /** Base map rendering. Defaults to the road map. */
  mapKind?: MapKind;
  styleVariant?: MapStyleVariant;

  /**
   * `false` disables pan/zoom/rotate — for preview maps embedded in a scrolling
   * page, where the map would otherwise swallow the page's scroll gesture.
   */
  interactive?: boolean;

  /** Draws the blue "you are here" dot. Requires an already-granted location
   *  permission; the component does NOT request one (that is the screen's
   *  decision, so the prompt appears at a moment the user understands). */
  showsUserLocation?: boolean;

  /** Fired once, when the native map surface is ready to accept camera calls.
   *  Camera methods invoked before this are silently dropped by the SDK. */
  onReady?: () => void;

  /** Fired when a camera movement STARTS (gesture or animation). */
  onCameraMoveStart?: () => void;

  /**
   * Fired when the camera settles. `center` is rounded to storage precision,
   * so a value handed straight to the API matches what the user saw.
   */
  onCenterChange?: (center: LatLng, region: MapRegion, isGesture: boolean) => void;

  /** Fired on a tap on the base map (not on a marker). */
  onPress?: (coordinate: LatLng) => void;

  style?: StyleProp<ViewStyle>;
  /** Markers, polylines, polygons — see MapPrimitives.ts. */
  children?: React.ReactNode;
  testID?: string;
}

const AppMapView = forwardRef<AppMapHandle, AppMapViewProps>(
  (
    {
      initialRegion,
      initialCenter = null,
      initialZoom = MAP_ZOOM.PLACE,
      mapKind = 'standard',
      styleVariant = 'default',
      interactive = true,
      showsUserLocation = false,
      onReady,
      onCameraMoveStart,
      onCenterChange,
      onPress,
      style,
      children,
      testID,
    },
    ref,
  ) => {
    const mapRef = useRef<MapView>(null);
    // Guards `onCameraMoveStart` so it fires once per movement rather than on
    // every one of the ~60 region-change events a single pan emits.
    const movingRef = useRef(false);

    const resolvedInitialRegion = useMemo<MapRegion>(() => {
      if (initialRegion) {
        return initialRegion;
      }
      if (initialCenter) {
        return regionFromZoom(initialCenter, initialZoom);
      }
      return DEFAULT_MAP_REGION;
      // Intentionally mount-only: this prop is `initialRegion`, and recomputing
      // it later would have no effect on the native view anyway.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      (): AppMapHandle => ({
        animateToRegion: (region, durationMs = MAP_ANIMATION.DEFAULT_MS) => {
          mapRef.current?.animateToRegion(region as Region, durationMs);
        },
        animateToCoordinate: (
          coordinate,
          zoom = MAP_ZOOM.PLACE,
          durationMs = MAP_ANIMATION.DEFAULT_MS,
        ) => {
          mapRef.current?.animateToRegion(
            regionFromZoom(coordinate, zoom) as Region,
            durationMs,
          );
        },
        setCoordinate: (coordinate, zoom = MAP_ZOOM.PLACE) => {
          // Duration 0 = jump. Used for first paint, where animating in from the
          // country-level default reads as a glitch rather than as motion.
          mapRef.current?.animateToRegion(regionFromZoom(coordinate, zoom) as Region, 0);
        },
        fitToCoordinates: (coordinates, padding: MapEdgePadding = DEFAULT_FIT_PADDING) => {
          if (coordinates.length === 0) {
            return;
          }
          mapRef.current?.fitToCoordinates([...coordinates], {
            edgePadding: padding,
            animated: true,
          });
        },
      }),
      [],
    );

    const handleRegionChange = useCallback(() => {
      if (movingRef.current) {
        return;
      }
      movingRef.current = true;
      onCameraMoveStart?.();
    }, [onCameraMoveStart]);

    const handleRegionChangeComplete = useCallback(
      (region: Region, details: Details) => {
        movingRef.current = false;
        onCenterChange?.(
          {
            latitude: roundCoordinate(region.latitude, COORDINATE_PRECISION),
            longitude: roundCoordinate(region.longitude, COORDINATE_PRECISION),
          },
          region,
          // `isGesture` is Google-only and absent on the first programmatic
          // settle; treat "unknown" as "not a gesture".
          details?.isGesture ?? false,
        );
      },
      [onCenterChange],
    );

    const handlePress = useCallback(
      (event: MapPressEvent) => {
        const { coordinate } = event.nativeEvent;
        onPress?.({
          latitude: roundCoordinate(coordinate.latitude, COORDINATE_PRECISION),
          longitude: roundCoordinate(coordinate.longitude, COORDINATE_PRECISION),
        });
      },
      [onPress],
    );

    return (
      <View style={[styles.container, style]} testID={testID}>
        <MapView
          ref={mapRef}
          // Pinned, never a prop: see the header comment and MAP_PROVIDER.
          provider={MAP_PROVIDER}
          style={styles.map}
          initialRegion={resolvedInitialRegion as Region}
          mapType={mapKind}
          customMapStyle={
            styleVariant === 'preview' ? AGRI_MAP_STYLE_PREVIEW : AGRI_MAP_STYLE
          }
          onMapReady={onReady}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          onPress={onPress ? handlePress : undefined}
          showsUserLocation={showsUserLocation}
          // We render our own recentre control where one is needed, so that it
          // matches the app's button styling and sits above our own overlays.
          showsMyLocationButton={false}
          // Android-only Google chrome that deep-links out of the app.
          toolbarEnabled={false}
          // No 3D/tilt requirement anywhere in the product, and both gestures
          // are easy to trigger accidentally while placing a pin.
          rotateEnabled={false}
          pitchEnabled={false}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          // Nothing renders indoor floor plans in this app; the control is dead
          // chrome that overlaps our footer.
          showsIndoorLevelPicker={false}
          loadingEnabled
        >
          {children}
        </MapView>
      </View>
    );
  },
);

AppMapView.displayName = 'AppMapView';

export default React.memo(AppMapView);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  // The native view must fill its container absolutely: a bare `flex: 1` leaves
  // the Google surface unsized until the first layout pass, which shows as a
  // grey flash on Android.
  map: { ...StyleSheet.absoluteFillObject },
});
