/**
 * src/maps/components/LocationPicker.tsx — full-screen "drop a pin" picker.
 *
 * MIGRATION NOTE (see docs/maps/CHANGELOG.md)
 * ------------------------------------------
 * This replaces the Leaflet-in-WebView picker that previously lived at
 * `src/components/location/LocationPicker.tsx`. The PUBLIC API is unchanged —
 * same props, same `PickedLocation` payload — so the migration was an import
 * swap at the call sites. What changed underneath:
 *
 *   - Tiles are rendered by the native Google Maps SDK instead of a WebView
 *     loading Leaflet + OSM tiles from unpkg/openstreetmap.org over the public
 *     internet. That removes a hard dependency on two third-party CDNs being
 *     reachable, removes the JS-bridge round trip on every pan, and gives the
 *     picker the platform's own gesture inertia.
 *   - `injectJavaScript` + `postMessage` string plumbing is gone; camera moves
 *     are typed method calls (`camera.animateToCoordinate`).
 *
 * WHAT DELIBERATELY DID NOT CHANGE
 *   - Nominatim (OpenStreetMap) still does search + reverse geocoding. It is
 *     free, it is already integrated, and swapping it for Google Places is a
 *     separate, separately-billed decision. See docs/maps/FUTURE_SCOPE.md.
 *   - Save stays gated on a RESOLVED ADDRESS, never coordinates alone.
 *   - Errors are shown with `Alert`, not the global toast: this component
 *     renders inside a native `<Modal>`, and the root-level toast renders
 *     behind it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import AppTextInput from '../../components/AppTextInput/AppTextInput';
import Button from '../../components/Button/Button';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import {
  searchPlaces,
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
import { useMapCamera } from '../hooks/useMapCamera';
import { MAP_ZOOM, SAME_SPOT_EPSILON } from '../config/mapDefaults';
import type { LatLng } from '../types';
import { isSameSpot } from '../utils/geo';

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
  confirmLabel?: string;
  style?: ViewStyle;
}

const SEARCH_DEBOUNCE = 500;
const REVERSE_DEBOUNCE = 600;
const MIN_QUERY_LENGTH = 3;
const HIT = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const LocationPicker: React.FC<LocationPickerProps> = ({
  initial = null,
  onConfirm,
  onClose,
  hideConfirm = false,
  confirmLabel = 'Confirm location',
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();

  const [moving, setMoving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LatLng | null>(initial);
  const [address, setAddress] = useState<AddressResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const [locating, setLocating] = useState(false);
  // Bumped to force a reverse-geocode retry after a failure.
  const [geoNonce, setGeoNonce] = useState(0);

  // Last coordinate we successfully reverse-geocoded — used to skip redundant
  // lookups when the camera only settles by a sub-metre amount.
  const lastGeocodedRef = useRef<LatLng | null>(null);

  const handleCameraMoveStart = useCallback(() => setMoving(true), []);

  const handleCenterChange = useCallback((center: LatLng) => {
    setMoving(false);
    // Keep the previous object identity when the centre is unchanged so the
    // reverse-geocode effect below does not re-run on settle jitter.
    setSelected(prev =>
      prev && isSameSpot(prev, center, SAME_SPOT_EPSILON) ? prev : center,
    );
  }, []);

  // Place search (typed query → suggestions).
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal)
        .then(list => {
          if (!controller.signal.aborted) {
            setResults(list);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Reverse geocode the selected pin. Skips lookups when the pin barely moved so
  // there is no repeated "Fetching location details…" flicker while the map
  // settles.
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
      Keyboard.dismiss();
      setQuery('');
      setResults([]);
      // Let the reverse geocoder produce the canonical address for the new pin
      // (the camera move triggers it); clear any stale result meanwhile.
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

  // When the user leaves to fix a permission / GPS problem, retry automatically
  // as soon as they return to the app (see the AppState listener below).
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
        // For actionable problems, remember to retry when the user comes back
        // from Settings — even on the silent auto-locate.
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

  // Auto-acquire the current location the first time the map is ready and no
  // starting point was supplied. Silent: on failure the user just picks manually
  // (they can tap the GPS button for the full, actionable error flow).
  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (!isReady || initial || autoLocatedRef.current) {
      return;
    }
    autoLocatedRef.current = true;
    runLocate({ silent: true }).catch(() => {});
  }, [isReady, initial, runLocate]);

  // Resume the flow after the user returns from Location / App settings.
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

  const clearQuery = useCallback(() => setQuery(''), []);

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

  // Save is allowed only with a pin AND a resolved, readable address — never
  // coordinates alone.
  const canConfirm = !!selected && !!address && !addressLoading && isReady;
  const showRetry = !!selected && addressError && !addressLoading;

  return (
    <View style={[styles.root, style]}>
      <View style={styles.mapWrap}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          initialCenter={initial}
          initialZoom={MAP_ZOOM.PLACE}
          onCameraMoveStart={handleCameraMoveStart}
          onCenterChange={handleCenterChange}
          style={styles.map}
        />
        {/* Sibling of the map, not a child: the pin stays screen-centred while
            the map moves underneath it. */}
        <MapCenterPin lifted={moving} />

        <View style={[styles.searchWrap, { top: insets.top + spacing[2] }]}>
          <View style={styles.searchRow}>
            {onClose ? (
              <Pressable
                onPress={onClose}
                style={styles.backBtn}
                hitSlop={HIT}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <AppIcon name="arrow-left" size={moderateScale(22)} color={COLORS.gray900} />
              </Pressable>
            ) : null}
            <View style={styles.searchBox}>
              <AppIcon name="magnify" size={moderateScale(18)} color={COLORS.gray500} />
              <AppTextInput
                style={styles.searchInput}
                placeholder="Search a place, city, area…"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : query.length > 0 ? (
                <Pressable onPress={clearQuery} hitSlop={HIT} accessibilityLabel="Clear search">
                  <AppIcon name="close-circle" size={moderateScale(18)} color={COLORS.gray500} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {results.length > 0 ? (
            <View style={styles.results}>
              <FlatList
                data={results}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => pickResult(item)}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}>
                    <AppIcon
                      name="map-marker-outline"
                      size={moderateScale(18)}
                      color={COLORS.primary}
                    />
                    <View style={styles.resultTexts}>
                      <AppText style={styles.resultLabel} numberOfLines={2}>
                        {item.label}
                      </AppText>
                      <AppText style={styles.resultCoord}>
                        {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                      </AppText>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          ) : null}
        </View>

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

        {!hideConfirm ? (
          showRetry ? (
            <Button title="Retry" variant="outline" onPress={retryAddress} />
          ) : (
            <Button
              title={addressLoading ? 'Fetching location details…' : confirmLabel}
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

  searchWrap: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: scale(46),
    paddingHorizontal: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.md,
  },
  searchInput: {
    flex: 1,
    ...presets.bodySM,
    color: COLORS.gray900,
    padding: 0,
  },
  results: {
    marginTop: spacing[2],
    maxHeight: scale(260),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    ...shadows.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray100,
  },
  resultRowPressed: { backgroundColor: COLORS.gray100 },
  resultTexts: { flex: 1, gap: spacing[0.5] },
  resultLabel: { ...presets.bodySM, color: COLORS.gray900 },
  resultCoord: { ...presets.caption, color: COLORS.gray500 },

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
});
