import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import Button from '../../components/Button/Button';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import {
  reverseGeocode,
  type Place,
  type AddressResult,
} from '../../services/geocoding';
import {
  getCurrentLocation,
  openAppSettings,
  openLocationSettings,
  type LocationErrorCode,
} from '../../services/currentLocation';
import AppMapView from './AppMapView';
import MapCenterPin from './MapCenterPin';
import MapKindSwitch from './MapKindSwitch';
import MapPlaceSearch from './MapPlaceSearch';
import BoundaryPolygon from '../boundary/components/BoundaryPolygon';
import { useMapCamera } from '../hooks/useMapCamera';
import { MAP_ZOOM, SAME_SPOT_EPSILON } from '../config/mapDefaults';
import type { LatLng, MapKind } from '../types';
import { isPointInPolygon, isSameSpot } from '../utils/geo';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface LocationPickerProps {
  initial?: LatLng | null;
  onConfirm?: (location: PickedLocation) => void;
  onClose?: () => void;
  hideConfirm?: boolean;
  confirmLabel?: string | undefined;
  style?: ViewStyle;
  ring?: readonly LatLng[] | null;
  warnOutsideRing?: boolean;
  searchPlaceholder?: string;
}

const REVERSE_DEBOUNCE = 600;
const HIT = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const LocationPicker: React.FC<LocationPickerProps> = ({
  initial = null,
  onConfirm,
  onClose,
  hideConfirm = false,
  confirmLabel,
  style,
  ring = null,
  warnOutsideRing = false,
  searchPlaceholder,
}) => {
  const insets = useSafeAreaInsets();
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();

  const [moving, setMoving] = useState(false);
  const [mapKind, setMapKind] = useState<MapKind>('hybrid');
  const [selected, setSelected] = useState<LatLng | null>(initial);
  const [address, setAddress] = useState<AddressResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoNonce, setGeoNonce] = useState(0);

  const lastGeocodedRef = useRef<LatLng | null>(null);

  const handleCameraMoveStart = useCallback(() => setMoving(true), []);

  const handleCenterChange = useCallback((center: LatLng) => {
    setMoving(false);
    setSelected(prev =>
      prev && isSameSpot(prev, center, SAME_SPOT_EPSILON) ? prev : center,
    );
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const last = lastGeocodedRef.current;
    if (last && isSameSpot(last, selected, SAME_SPOT_EPSILON)) {
      return;
    }
    const controller = new AbortController();
    setAddressError(false);
    setAddressLoading(true);
    const timer = setTimeout(() => {
      reverseGeocode(selected.latitude, selected.longitude, controller.signal)
        .then(result => {
          if (!controller.signal.aborted) {
            setAddress(result);
            setAddressError(false);
            lastGeocodedRef.current = selected;
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAddress(null);
            setAddressError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setAddressLoading(false);
          }
        });
    }, REVERSE_DEBOUNCE);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selected, geoNonce]);

  const pickResult = useCallback(
    (place: Place) => {
      lastGeocodedRef.current = null;
      camera.animateToCoordinate(
        { latitude: place.latitude, longitude: place.longitude },
        MAP_ZOOM.PLACE,
      );
    },
    [camera],
  );

  const showLocationError = useCallback((code: LocationErrorCode) => {
    switch (code) {
      case 'permission_blocked':
        Alert.alert(
          'Location permission needed',
          'Turn on Location access for iiGrain in Settings to use your current location.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: openAppSettings },
          ],
        );
        break;
      case 'permission_denied':
        Alert.alert(
          'Location permission needed',
          'Allow location access to center the map on where you are. You can also pick a spot manually.',
        );
        break;
      case 'location_services_disabled':
        Alert.alert(
          'Turn on device location',
          'Your device location (GPS) is off. Turn it on to use your current location.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openLocationSettings().catch(() => {}) },
          ],
        );
        break;
      case 'timeout':
        Alert.alert(
          'Couldn’t find your location',
          'We couldn’t get a location fix. Move to an open area and try again, or pick a spot on the map.',
        );
        break;
      default:
        Alert.alert(
          'Couldn’t find your location',
          'Something went wrong getting your location. You can pick a spot on the map instead.',
        );
    }
  }, []);

  const pendingRetryRef = useRef(false);

  const runLocate = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setLocating(true);
      try {
        const { latitude, longitude } = await getCurrentLocation();
        lastGeocodedRef.current = null;
        camera.animateToCoordinate({ latitude, longitude }, MAP_ZOOM.PRECISE);
      } catch (err) {
        const code = (err as { code?: LocationErrorCode }).code ?? 'position_unavailable';
        if (code === 'permission_blocked' || code === 'location_services_disabled') {
          pendingRetryRef.current = true;
        }
        if (!silent) {
          showLocationError(code);
        }
      } finally {
        setLocating(false);
      }
    },
    [camera, showLocationError],
  );

  const useMyLocation = useCallback(() => {
    if (locating) {
      return;
    }
    runLocate().catch(() => {});
  }, [locating, runLocate]);

  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (!isReady || initial || autoLocatedRef.current) {
      return;
    }
    autoLocatedRef.current = true;
    runLocate({ silent: true }).catch(() => {});
  }, [isReady, initial, runLocate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && pendingRetryRef.current) {
        pendingRetryRef.current = false;
        runLocate({ silent: true }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [runLocate]);

  const retryAddress = useCallback(() => {
    lastGeocodedRef.current = null;
    setGeoNonce(n => n + 1);
  }, []);

  const confirm = useCallback(() => {
    if (!selected || !address) {
      return;
    }
    const addressText =
      address.full || [address.title, address.subtitle].filter(Boolean).join(', ');
    onConfirm?.({
      latitude: selected.latitude,
      longitude: selected.longitude,
      address: addressText,
    });
  }, [selected, address, onConfirm]);

  const canConfirm = !!selected && !!address && !addressLoading && isReady;
  const showRetry = !!selected && addressError && !addressLoading;

  const hasRing = !!ring && ring.length >= 3;

  const outsideRing =
    warnOutsideRing && hasRing && !!selected && !isPointInPolygon(selected, ring!);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.mapWrap}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          initialCenter={initial}
          initialZoom={MAP_ZOOM.PLACE}
          mapKind={mapKind}
          onCameraMoveStart={handleCameraMoveStart}
          onCenterChange={handleCenterChange}
          style={styles.map}>
          {hasRing ? <BoundaryPolygon ring={ring!} strokeWidth={3} /> : null}
        </AppMapView>
        <MapCenterPin lifted={moving} />

        <MapKindSwitch
          value={mapKind}
          onChange={setMapKind}
          style={[styles.kindSwitch, { top: insets.top + scale(64) }]}
        />

        <MapPlaceSearch
          onPick={pickResult}
          placeholder={searchPlaceholder}
          style={[styles.searchWrap, { top: insets.top + spacing[2] }]}
          leftAccessory={
            onClose ? (
              <Pressable
                onPress={onClose}
                style={styles.backBtn}
                hitSlop={HIT}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <AppIcon name="arrow-left" size={moderateScale(22)} color={COLORS.gray900} />
              </Pressable>
            ) : null
          }
        />

        <Pressable
          onPress={useMyLocation}
          style={styles.gpsBtn}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my location">
          {locating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <AppIcon name="crosshairs-gps" size={moderateScale(22)} color={COLORS.primary} />
          )}
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.footerInfo}>
          <View style={styles.footerIcon}>
            <AppIcon name="map-marker" size={moderateScale(20)} color={COLORS.primary} />
          </View>
          <View style={styles.footerTexts}>
            <AppText style={styles.footerTitle}>Selected location</AppText>
            {locating ? (
              <AppText style={styles.footerAddress}>Locating…</AppText>
            ) : addressLoading ? (
              <AppText style={styles.footerAddress}>Fetching location details…</AppText>
            ) : address ? (
              <>
                <AppText style={styles.footerAddress} numberOfLines={1}>
                  {address.title}
                </AppText>
                {address.subtitle ? (
                  <AppText style={styles.footerSubtitle} numberOfLines={2}>
                    {address.subtitle}
                  </AppText>
                ) : null}
              </>
            ) : addressError ? (
              <AppText style={styles.footerError} numberOfLines={2}>
                Unable to fetch address. Tap Retry.
              </AppText>
            ) : (
              <AppText style={styles.footerAddress} numberOfLines={2}>
                Move the map to place the pin
              </AppText>
            )}
            {selected ? (
              <AppText style={styles.footerCoord}>
                {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
              </AppText>
            ) : null}
          </View>
        </View>

        {outsideRing ? (
          <View style={styles.outsideNote}>
            <AppIcon name="alert-outline" size={moderateScale(16)} color={COLORS.validation} />
            <AppText style={styles.outsideNoteText}>
              This point sits outside the field's drawn boundary. You can still save it.
            </AppText>
          </View>
        ) : null}

        {!hideConfirm ? (
          showRetry ? (
            <Button title="Retry" variant="outline" onPress={retryAddress} />
          ) : (
            <Button
              title={
                addressLoading
                  ? 'Fetching location details…'
                  : confirmLabel ?? 'Confirm location'
              }
              onPress={confirm}
              loading={addressLoading}
              disabled={!canConfirm}
            />
          )
        ) : null}
      </View>
    </View>
  );
};

export default LocationPicker;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  mapWrap: { flex: 1 },
  map: { flex: 1 },

  kindSwitch: {
    position: 'absolute',
    right: spacing[3],
  },

  searchWrap: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
  },
  backBtn: {
    width: scale(46),
    height: scale(46),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.md,
  },
  gpsBtn: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: scale(48),
    height: scale(48),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.lg,
  },

  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  footerInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  footerIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerTexts: { flex: 1, gap: spacing[0.5] },
  footerTitle: { ...presets.labelSM, color: COLORS.gray500 },
  footerAddress: { ...presets.bodyMD, color: COLORS.gray900 },
  footerSubtitle: { ...presets.bodySM, color: COLORS.gray600 },
  footerError: { ...presets.bodySM, color: COLORS.danger },
  footerCoord: { ...presets.caption, color: COLORS.gray500 },

  outsideNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.validation, 0.1),
  },
  outsideNoteText: { ...presets.bodyXS, color: COLORS.gray900, flex: 1 },
});
