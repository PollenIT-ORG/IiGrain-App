import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import AppMapView from '../../maps/components/AppMapView';
import MapKindSwitch from '../../maps/components/MapKindSwitch';
import { MapMarker } from '../../maps/components/MapPrimitives';
import { BoundaryPolygon } from '../../maps/boundary';
import { useMapCamera } from '../../maps/hooks/useMapCamera';
import type { LatLng, MapKind } from '../../maps/types';

export interface SamplePoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  sampled: boolean;
}

export interface SamplePointsMapProps {
  points: SamplePoint[];
  ring: readonly LatLng[] | null;
  fallbackCenter: LatLng | null;
  totalPoints: number;
  onPressPoint?: (id: string) => void;
  height?: number;
}

const SETTLE_MS = 600;
const FIT_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

const markerLabel = (label: string, index: number): string => {
  const digits = label.match(/(\d+)(?!.*\d)/);
  if (digits) {
    return digits[1].slice(0, 3);
  }
  const letters = label.replace(/[^A-Za-z0-9]/g, '');
  return letters ? letters.slice(0, 2).toUpperCase() : String(index + 1);
};

const PointMarker: React.FC<{
  point: SamplePoint;
  index: number;
  onPress?: (id: string) => void;
}> = ({ point, index, onPress }) => {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const timer = setTimeout(() => setTracks(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [point.sampled, point.label, index]);

  return (
    <MapMarker
      coordinate={{ latitude: point.latitude, longitude: point.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={() => onPress?.(point.id)}
      zIndex={5}>
      <View style={styles.markerBox}>
        <View style={[styles.marker, point.sampled ? styles.markerDone : styles.markerTodo]}>
          <AppText style={styles.markerText}>
            {markerLabel(point.label, index)}
          </AppText>
        </View>
      </View>
    </MapMarker>
  );
};

const SamplePointsMap: React.FC<SamplePointsMapProps> = ({
  points,
  ring,
  fallbackCenter,
  totalPoints,
  onPressPoint,
  height,
}) => {
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();
  const [mapKind, setMapKind] = useState<MapKind>('hybrid');
  const [expanded, setExpanded] = useState(false);

  const hasRing = !!ring && ring.length >= 3;

  const coordinates = useMemo<LatLng[]>(
    () => [
      ...(hasRing ? ring!.map(p => ({ latitude: p.latitude, longitude: p.longitude })) : []),
      ...points.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
    ],
    [hasRing, ring, points],
  );

  const center = coordinates[0] ?? fallbackCenter;

  const fitKey = coordinates
    .map(c => `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`)
    .join('|');
  const lastFit = useRef<string>('');
  useEffect(() => {
    if (!isReady || coordinates.length === 0 || lastFit.current === fitKey) {
      return;
    }
    lastFit.current = fitKey;
    if (coordinates.length === 1) {
      camera.animateToCoordinate(coordinates[0], 17);
      return;
    }
    camera.fitToCoordinates(coordinates, FIT_PADDING);
  }, [isReady, fitKey, coordinates, camera]);

  const recenter = useCallback(() => {
    if (coordinates.length === 0) {
      return;
    }
    if (coordinates.length === 1) {
      camera.animateToCoordinate(coordinates[0], 17);
      return;
    }
    camera.fitToCoordinates(coordinates, FIT_PADDING);
  }, [coordinates, camera]);

  const missing = totalPoints - points.length;

  if (!center) {
    return (
      <View style={styles.emptyCard}>
        <AppIcon name="map-marker-off-outline" size={moderateScale(24)} color={COLORS.gray500} />
        <AppText style={styles.emptyText}>
          No coordinates yet. Add a record and this field’s surveyed points appear here.
        </AppText>
      </View>
    );
  }

  const boxHeight = height ?? (expanded ? scale(340) : scale(200));

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapBox, { height: boxHeight }]}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          mapKind={mapKind}
          initialCenter={center}
          initialZoom={16}
          style={StyleSheet.absoluteFill}>
          {hasRing ? <BoundaryPolygon ring={ring!} strokeWidth={3} /> : null}
          {points.map((point, index) => (
            <PointMarker
              key={point.id}
              point={point}
              index={index}
              onPress={onPressPoint}
            />
          ))}
        </AppMapView>

        <MapKindSwitch value={mapKind} onChange={setMapKind} style={styles.kindSwitch} />

        <Pressable
          onPress={recenter}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Fit all points">
          <AppIcon name="fit-to-page-outline" size={moderateScale(18)} color={COLORS.gray900} />
        </Pressable>

        <Pressable
          onPress={() => setExpanded(v => !v)}
          style={[styles.iconBtn, styles.iconBtnLower]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Shrink the map' : 'Enlarge the map'}>
          <AppIcon
            name={expanded ? 'arrow-collapse' : 'arrow-expand'}
            size={moderateScale(18)}
            color={COLORS.gray900}
          />
        </Pressable>

        {!hasRing ? (
          <View style={styles.noRingPill}>
            <AppIcon name="vector-polygon" size={moderateScale(13)} color={COLORS.white} />
            <AppText style={styles.noRingText}>Field not drawn yet</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.markerDone]} />
          <AppText style={styles.legendText}>
            {points.filter(p => p.sampled).length} sampled
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.markerTodo]} />
          <AppText style={styles.legendText}>
            {points.filter(p => !p.sampled).length} not sampled
          </AppText>
        </View>
        {missing > 0 ? (
          <AppText style={styles.legendMuted}>
            {missing} without coordinates
          </AppText>
        ) : null}
      </View>
    </View>
  );
};

export default React.memo(SamplePointsMap);

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[2],
  },
  mapBox: {
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.primaryDark,
    overflow: 'hidden',
    ...shadows.sm,
  },
  kindSwitch: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },
  iconBtn: {
    position: 'absolute',
    left: spacing[2],
    top: spacing[2],
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  iconBtnLower: {
    top: spacing[2] + scale(42),
  },
  noRingPill: {
    position: 'absolute',
    left: spacing[2],
    bottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.gray900, 0.6),
  },
  noRingText: {
    ...presets.caption,
    color: COLORS.white,
  },

  markerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(6),
  },
  marker: {
    minWidth: scale(24),
    height: scale(24),
    paddingHorizontal: scale(4),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.medium,
    borderColor: COLORS.white,
  },
  markerDone: {
    backgroundColor: COLORS.primary,
  },
  markerTodo: {
    backgroundColor: COLORS.gray600,
  },
  markerText: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.white,
  },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  legendDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: borderRadius.full,
  },
  legendText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  legendMuted: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.gray100,
  },
  emptyText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flex: 1,
  },
});
