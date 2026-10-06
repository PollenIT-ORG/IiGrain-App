import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
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

const MAP_PROVIDER = PROVIDER_GOOGLE;

export type MapStyleVariant = 'default' | 'preview';

export interface AppMapViewProps {
  initialRegion?: MapRegion;
  initialCenter?: LatLng | null;
  initialZoom?: number;

  mapKind?: MapKind;
  styleVariant?: MapStyleVariant;

  interactive?: boolean;

  showsUserLocation?: boolean;

  onReady?: () => void;

  onCameraMoveStart?: () => void;

  onCenterChange?: (center: LatLng, region: MapRegion, isGesture: boolean) => void;

  onRegionChange?: (region: MapRegion) => void;

  onPress?: (coordinate: LatLng) => void;

  style?: StyleProp<ViewStyle>;
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
      onRegionChange,
      onPress,
      style,
      children,
      testID,
    },
    ref,
  ) => {
    const mapRef = useRef<MapView>(null);
    const movingRef = useRef(false);

    const resolvedInitialRegion = useMemo<MapRegion>(() => {
      if (initialRegion) {
        return initialRegion;
      }
      if (initialCenter) {
        return regionFromZoom(initialCenter, initialZoom);
      }
      return DEFAULT_MAP_REGION;
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

    const handleRegionChange = useCallback(
      (region: Region) => {
        onRegionChange?.(region as MapRegion);
        if (movingRef.current) {
          return;
        }
        movingRef.current = true;
        onCameraMoveStart?.();
      },
      [onRegionChange, onCameraMoveStart],
    );

    const handleRegionChangeComplete = useCallback(
      (region: Region, details: Details) => {
        movingRef.current = false;
        onCenterChange?.(
          {
            latitude: roundCoordinate(region.latitude, COORDINATE_PRECISION),
            longitude: roundCoordinate(region.longitude, COORDINATE_PRECISION),
          },
          region,
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
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
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
  map: { ...StyleSheet.absoluteFillObject },
});
