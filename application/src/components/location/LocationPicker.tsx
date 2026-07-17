import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppTextInput from '../AppTextInput/AppTextInput';
import Button from '../Button/Button';
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
import { getCurrentLocation } from '../../services/currentLocation';
import { showToast } from '../../services/toastService';
import { MAP_HTML } from './mapHtml';

const MAP_SOURCE = { html: MAP_HTML } as const;
const ORIGIN_WHITELIST = ['*'];

interface MapWebViewProps {
  mapRef: React.RefObject<WebView<unknown> | null>;
  onMessage: (e: WebViewMessageEvent) => void;
}

const MapWebView = React.memo<MapWebViewProps>(({ mapRef, onMessage }) => (
  <WebView<unknown>
    ref={mapRef}
    source={MAP_SOURCE}
    originWhitelist={ORIGIN_WHITELIST}
    onMessage={onMessage}
    javaScriptEnabled
    domStorageEnabled
    cacheEnabled
    startInLoadingState
    onLoadEnd={() => console.log('[LocationPicker] WebView loaded (once)')}
    onError={ev => console.log('[LocationPicker] WebView error:', ev.nativeEvent)}
    onHttpError={ev =>
      console.log('[LocationPicker] WebView HTTP error:', ev.nativeEvent.statusCode, ev.nativeEvent.url)
    }
    renderLoading={() => (
      <View style={styles.mapLoading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )}
    style={styles.web}
  />
));
MapWebView.displayName = 'MapWebView';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface LocationPickerProps {
  initial?: { latitude: number; longitude: number } | null;
  onConfirm?: (location: PickedLocation) => void;
  onClose?: () => void;
  hideConfirm?: boolean;
  confirmLabel?: string;
  style?: ViewStyle;
}

interface Selected {
  latitude: number;
  longitude: number;
}

const SEARCH_DEBOUNCE = 500;
const REVERSE_DEBOUNCE = 600;
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
  const webRef = useRef<WebView<unknown>>(null);

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(initial);
  const [address, setAddress] = useState<AddressResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const flyTo = useCallback((lat: number, lng: number, zoom = 16) => {
    console.log('[LocationPicker] flyTo →', lat, lng, 'zoom', zoom);
    webRef.current?.injectJavaScript(
      `window.MAP && window.MAP.flyTo(${lat}, ${lng}, ${zoom}); true;`,
    );
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === 'log') {
          console.log('[map]', `${msg.level ?? 'info'}:`, msg.message);
          return;
        }
        console.log('[LocationPicker] webview →', msg);
        if (msg.type === 'ready') {
          setReady(true);
          if (initial) {
            flyTo(initial.latitude, initial.longitude);
          }
        } else if (msg.type === 'move') {
          setSelected(prev =>
            prev && prev.latitude === msg.latitude && prev.longitude === msg.longitude
              ? prev
              : { latitude: msg.latitude, longitude: msg.longitude },
          );
        }
      } catch (err) {
        console.log('[LocationPicker] bad webview message:', e.nativeEvent.data, err);
      }
    },
    [initial, flyTo],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(() => {
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
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const controller = new AbortController();
    setAddressLoading(true);
    const t = setTimeout(() => {
      reverseGeocode(selected.latitude, selected.longitude, controller.signal)
        .then(result => {
          if (!controller.signal.aborted) {
            setAddress(result);
            console.log('[LocationPicker] selected name →', result.title, '·', result.subtitle);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAddress(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setAddressLoading(false);
          }
        });
    }, REVERSE_DEBOUNCE);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [selected]);

  const pickResult = useCallback(
    (place: Place) => {
      Keyboard.dismiss();
      setQuery('');
      setResults([]);
      const parts = place.label.split(',').map(s => s.trim());
      setAddress({
        title: parts[0] || place.label,
        subtitle: parts.slice(1, 3).join(', '),
        full: place.label,
      });
      flyTo(place.latitude, place.longitude);
    },
    [flyTo],
  );

  const useMyLocation = useCallback(async () => {
    console.log('[LocationPicker] "Use my location" tapped · locating =', locating);
    if (locating) {
      return;
    }
    setLocating(true);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      console.log('[LocationPicker] got current location:', latitude, longitude);
      flyTo(latitude, longitude, 17);
    } catch (err) {
      const code = (err as Error).message;
      console.log('[LocationPicker] current location failed · code =', code);
      if (code === 'permission_blocked') {
        Alert.alert(
          'Location permission needed',
          'Turn on Location access for iiGrain in Settings to use your current location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      } else if (code === 'permission_denied') {
        showToast('Location permission needed. Tap "Use my location" again to allow.', {
          type: 'error',
        });
      } else {
        showToast('Could not get your location. Move the map to pick manually.', {
          type: 'error',
        });
      }
    } finally {
      setLocating(false);
    }
  }, [locating, flyTo]);

  const clearQuery = useCallback(() => setQuery(''), []);

  const confirm = useCallback(() => {
    if (!selected) {
      return;
    }
    const addressText = address
      ? address.full || [address.title, address.subtitle].filter(Boolean).join(', ')
      : '';
    onConfirm?.({
      latitude: selected.latitude,
      longitude: selected.longitude,
      address: addressText,
    });
  }, [selected, address, onConfirm]);

  return (
    <View style={[styles.root, style]}>
      <View style={styles.mapWrap}>
        <MapWebView mapRef={webRef} onMessage={onMessage} />

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
            {addressLoading ? (
              <AppText style={styles.footerAddress}>Finding address…</AppText>
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
          <Button title={confirmLabel} onPress={confirm} disabled={!selected || !ready} />
        ) : null}
      </View>
    </View>
  );
};

export default LocationPicker;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  mapWrap: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  footerCoord: { ...presets.caption, color: COLORS.gray500 },
});
