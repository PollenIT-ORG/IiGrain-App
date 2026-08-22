import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import AppTextInput from '../../components/AppTextInput/AppTextInput';
import Button from '../../components/Button/Button';
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
import { useDebouncedValue } from '../../hooks';
import { searchPlaces, type Place } from '../../services/geocoding';
import { getCurrentLocation } from '../../services/currentLocation';
import { showToast } from '../../services/toastService';
import AppMapView from './AppMapView';
import MapKindSwitch from './MapKindSwitch';
import { MapMarker } from './MapPrimitives';
import { useMapCamera } from '../hooks/useMapCamera';
import { MAP_ZOOM } from '../config/mapDefaults';
import type { LatLng, MapEntity, MapKind } from '../types';
import { isValidLatLng } from '../utils/geo';

const MIN_PLACE_QUERY = 3;

const PLACE_DEBOUNCE_MS = 450;

const MAX_LOCAL_RESULTS = 8;

const HIT = { top: 8, bottom: 8, left: 8, right: 8 } as const;

interface IndexedEntity<TData> {
  entity: MapEntity<TData>;
  haystack: string;
  titleLower: string;
}

type ResultRow<TData> =
  | { type: 'header'; id: string; label: string }
  | { type: 'entity'; id: string; title: string; subtitle: string; entity: MapEntity<TData> }
  | { type: 'place'; id: string; title: string; subtitle: string; coordinate: LatLng };

interface ResultItemProps {
  row: ResultRow<unknown>;
  onSelect: (row: ResultRow<unknown>) => void;
}

const ResultItem = React.memo<ResultItemProps>(({ row, onSelect }) => {
  if (row.type === 'header') {
    return (
      <View style={styles.resultHeader}>
        <AppText style={styles.resultHeaderText}>{row.label}</AppText>
      </View>
    );
  }

  const isEntity = row.type === 'entity';

  return (
    <Pressable
      onPress={() => onSelect(row)}
      accessibilityRole="button"
      accessibilityLabel={row.title}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}>
      <View style={[styles.resultIcon, isEntity && styles.resultIconEntity]}>
        <AppIcon
          name={isEntity ? ICONS.MAP_CHECK : ICONS.MAP_MARKER}
          size={moderateScale(16)}
          color={isEntity ? COLORS.primary : COLORS.gray600}
        />
      </View>
      <View style={styles.resultTexts}>
        <AppText style={styles.resultTitle} numberOfLines={1}>
          {row.title}
        </AppText>
        {row.subtitle ? (
          <AppText style={styles.resultSubtitle} numberOfLines={isEntity ? 1 : 2}>
            {row.subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
});
ResultItem.displayName = 'ResultItem';

export interface MapExplorerProps<TData = unknown> {
  entities: readonly MapEntity<TData>[];
  loading?: boolean;

  focusEntityId?: string;

  searchEnabled?: boolean;
  searchPlaceholder?: string;
  searchGroupLabel?: string;
  placeSearchEnabled?: boolean;

  mapKindSwitchEnabled?: boolean;
  initialMapKind?: MapKind;
  showFitAllControl?: boolean;
  showMyLocationControl?: boolean;
  formatCountLabel?: ((count: number) => string) | null;

  onSelectEntity?: (entity: MapEntity<TData> | null) => void;
  actionLabel?: string;
  onAction?: (entity: MapEntity<TData>) => void;
  renderDetail?: (entity: MapEntity<TData>, dismiss: () => void) => React.ReactNode;

  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  renderEmpty?: () => React.ReactNode;

  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function MapExplorer<TData = unknown>({
  entities,
  loading = false,
  focusEntityId,

  searchEnabled = true,
  searchPlaceholder = 'Search…',
  searchGroupLabel = 'Results',
  placeSearchEnabled = true,

  mapKindSwitchEnabled = true,
  initialMapKind = 'standard',
  showFitAllControl = true,
  showMyLocationControl = true,
  formatCountLabel = null,

  onSelectEntity,
  actionLabel,
  onAction,
  renderDetail,

  emptyIcon = ICONS.MAP_MARKER,
  emptyTitle = 'Nothing to show yet',
  emptyMessage = 'There are no mapped locations to display.',
  emptyActionLabel,
  onEmptyAction,
  renderEmpty,

  style,
  testID,
}: MapExplorerProps<TData>): React.ReactElement {
  const { mapRef, onMapReady, isReady, camera } = useMapCamera();

  const [mapKind, setMapKind] = useState<MapKind>(initialMapKind);
  const [selectedId, setSelectedId] = useState<string | null>(focusEntityId ?? null);
  const [locating, setLocating] = useState(false);

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placePin, setPlacePin] = useState<{ coordinate: LatLng; label: string } | null>(null);

  const debouncedQuery = useDebouncedValue(query, PLACE_DEBOUNCE_MS);

  const indexed = useMemo<IndexedEntity<TData>[]>(
    () =>
      entities
        .filter(entity => isValidLatLng(entity.coordinate))
        .map(entity => {
          const title = entity.title ?? '';
          return {
            entity,
            haystack: `${title} ${entity.subtitle ?? ''} ${entity.searchText ?? ''}`
              .trim()
              .toLowerCase(),
            titleLower: title.toLowerCase(),
          };
        }),
    [entities],
  );

  const selected = useMemo(
    () => indexed.find(item => item.entity.id === selectedId)?.entity ?? null,
    [indexed, selectedId],
  );

  const localMatches = useMemo<IndexedEntity<TData>[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    return indexed
      .filter(item => item.haystack.includes(needle))
      .sort((a, b) => {
        const aPrefix = a.titleLower.startsWith(needle) ? 0 : 1;
        const bPrefix = b.titleLower.startsWith(needle) ? 0 : 1;
        return aPrefix - bPrefix || a.titleLower.localeCompare(b.titleLower);
      })
      .slice(0, MAX_LOCAL_RESULTS);
  }, [indexed, query]);

  useEffect(() => {
    if (!searchEnabled || !placeSearchEnabled) {
      return;
    }
    const q = debouncedQuery.trim();
    if (q.length < MIN_PLACE_QUERY) {
      setPlaces([]);
      setSearchingPlaces(false);
      return;
    }

    const controller = new AbortController();
    setSearchingPlaces(true);

    searchPlaces(q, controller.signal)
      .then(list => {
        if (!controller.signal.aborted) {
          setPlaces(list);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlaces([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearchingPlaces(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, searchEnabled, placeSearchEnabled]);

  const rows = useMemo<ResultRow<TData>[]>(() => {
    if (!query.trim()) {
      return [];
    }

    const out: ResultRow<TData>[] = [];

    if (localMatches.length > 0) {
      out.push({ type: 'header', id: 'h-local', label: searchGroupLabel });
      for (const item of localMatches) {
        out.push({
          type: 'entity',
          id: `entity-${item.entity.id}`,
          title: item.entity.title,
          subtitle: item.entity.subtitle ?? '',
          entity: item.entity,
        });
      }
    }

    if (places.length > 0) {
      out.push({ type: 'header', id: 'h-places', label: 'Places' });
      for (const place of places) {
        const [head, ...rest] = place.label.split(',').map(part => part.trim());
        out.push({
          type: 'place',
          id: `place-${place.id}`,
          title: head || place.label,
          subtitle: rest.join(', '),
          coordinate: { latitude: place.latitude, longitude: place.longitude },
        });
      }
    }

    return out;
  }, [query, localMatches, places, searchGroupLabel]);

  const showResults = searchEnabled && searchFocused && query.trim().length > 0;
  const noMatches =
    showResults && rows.length === 0 && !searchingPlaces && debouncedQuery === query;

  const fitAll = useCallback(() => {
    if (indexed.length === 0) {
      return;
    }
    if (indexed.length === 1) {
      camera.animateToCoordinate(indexed[0].entity.coordinate, MAP_ZOOM.PLACE);
      return;
    }
    camera.fitToCoordinates(indexed.map(item => item.entity.coordinate));
  }, [indexed, camera]);

  const framedRef = useRef(false);
  useEffect(() => {
    if (!isReady || framedRef.current || indexed.length === 0) {
      return;
    }
    framedRef.current = true;

    const focus = focusEntityId
      ? indexed.find(item => item.entity.id === focusEntityId)
      : undefined;

    if (focus) {
      camera.animateToCoordinate(focus.entity.coordinate, MAP_ZOOM.PLACE);
    } else {
      fitAll();
    }
  }, [isReady, indexed, focusEntityId, camera, fitAll]);

  const selectEntity = useCallback(
    (entity: MapEntity<TData>) => {
      setSelectedId(entity.id);
      setPlacePin(null);
      camera.animateToCoordinate(entity.coordinate, MAP_ZOOM.PLACE);
      onSelectEntity?.(entity);
    },
    [camera, onSelectEntity],
  );

  const dismissSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchFocused(false);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setPlaces([]);
  }, []);

  const dismissDetail = useCallback(() => {
    setSelectedId(null);
    onSelectEntity?.(null);
  }, [onSelectEntity]);

  const handleSelectRow = useCallback(
    (row: ResultRow<unknown>) => {
      if (row.type === 'header') {
        return;
      }
      dismissSearch();
      setQuery('');
      setPlaces([]);

      if (row.type === 'entity') {
        selectEntity(row.entity as MapEntity<TData>);
        return;
      }

      setSelectedId(null);
      onSelectEntity?.(null);
      setPlacePin({ coordinate: row.coordinate, label: row.title });
      camera.animateToCoordinate(row.coordinate, MAP_ZOOM.CITY);
    },
    [dismissSearch, selectEntity, camera, onSelectEntity],
  );

  const handleMapPress = useCallback(() => {
    dismissDetail();
    if (searchFocused) {
      dismissSearch();
    }
  }, [dismissDetail, searchFocused, dismissSearch]);

  const goToMyLocation = useCallback(async () => {
    if (locating) {
      return;
    }
    setLocating(true);
    try {
      const fix = await getCurrentLocation();
      camera.animateToCoordinate(fix, MAP_ZOOM.PRECISE);
    } catch {
      showToast('Could not get your current location.', { type: 'error' });
    } finally {
      setLocating(false);
    }
  }, [locating, camera]);

  const handleAction = useCallback(() => {
    if (selected) {
      onAction?.(selected);
    }
  }, [selected, onAction]);

  const markerNodes = useMemo(
    () => (
      <>
        {indexed.map(({ entity }) => (
          <MapMarker
            key={entity.id}
            coordinate={entity.coordinate}
            title={entity.title}
            description={entity.subtitle}
            pinColor={entity.pinColor ?? COLORS.primary}
            tracksViewChanges={false}
            onPress={() => selectEntity(entity)}
          />
        ))}
        {placePin ? (
          <MapMarker
            key="__search_result__"
            coordinate={placePin.coordinate}
            title={placePin.label}
            pinColor={COLORS.secondary}
            tracksViewChanges={false}
            zIndex={3}
          />
        ) : null}
      </>
    ),
    [indexed, placePin, selectEntity],
  );

  const renderRow = useCallback(
    ({ item }: { item: ResultRow<TData> }) => (
      <ResultItem row={item as ResultRow<unknown>} onSelect={handleSelectRow} />
    ),
    [handleSelectRow],
  );

  const keyExtractor = useCallback((item: ResultRow<TData>) => item.id, []);

  const hasEntities = indexed.length > 0;
  const showEmpty = !loading && !hasEntities;
  const showChrome = hasEntities && !showResults;

  return (
    <View style={[styles.root, style]} testID={testID}>
      <AppMapView
        ref={mapRef}
        onReady={onMapReady}
        mapKind={mapKind}
        onPress={handleMapPress}
        style={styles.map}>
        {markerNodes}
      </AppMapView>

      {searchEnabled && hasEntities ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <AppIcon name={ICONS.SEARCH} size={moderateScale(18)} color={COLORS.gray500} />
            <AppTextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={dismissSearch}
            />
            {searchingPlaces ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : query.length > 0 ? (
              <Pressable
                onPress={clearQuery}
                hitSlop={HIT}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <AppIcon name="close-circle" size={moderateScale(18)} color={COLORS.gray500} />
              </Pressable>
            ) : null}
          </View>

          {showResults ? (
            <View style={styles.results}>
              {noMatches ? (
                <View style={styles.noMatch}>
                  <AppText style={styles.noMatchText}>
                    Nothing matches “{query.trim()}”.
                  </AppText>
                </View>
              ) : (
                <FlatList
                  data={rows}
                  keyExtractor={keyExtractor}
                  renderItem={renderRow}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {showChrome && mapKindSwitchEnabled ? (
        <MapKindSwitch
          value={mapKind}
          onChange={setMapKind}
          style={[styles.kindSwitch, !searchEnabled && styles.chromeTopBare]}
        />
      ) : null}

      {showChrome && formatCountLabel ? (
        <View
          style={[styles.countPill, !searchEnabled && styles.chromeTopBare]}
          pointerEvents="none">
          <AppIcon name={ICONS.MAP_MARKER} size={moderateScale(14)} color={COLORS.primary} />
          <AppText style={styles.countText}>{formatCountLabel(indexed.length)}</AppText>
        </View>
      ) : null}

      {showChrome && (showFitAllControl || showMyLocationControl) ? (
        <View style={styles.controls}>
          {showFitAllControl ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={fitAll}
              style={styles.controlBtn}
              accessibilityRole="button"
              accessibilityLabel="Show all">
              <AppIcon
                name="fit-to-screen-outline"
                size={moderateScale(22)}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          ) : null}

          {showMyLocationControl ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goToMyLocation}
              disabled={locating}
              style={styles.controlBtn}
              accessibilityRole="button"
              accessibilityLabel="Go to my location">
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <AppIcon
                  name="crosshairs-gps"
                  size={moderateScale(22)}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {selected && !showResults
        ? renderDetail?.(selected, dismissDetail) ?? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}>
                  <AppIcon
                    name={ICONS.MAP_MARKER}
                    size={moderateScale(20)}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.cardTexts}>
                  <AppText style={styles.cardTitle} numberOfLines={1}>
                    {selected.title}
                  </AppText>
                  {selected.subtitle ? (
                    <AppText style={styles.cardSub} numberOfLines={2}>
                      {selected.subtitle}
                    </AppText>
                  ) : null}
                  {selected.meta ? (
                    <AppText style={styles.cardMeta}>{selected.meta}</AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={dismissDetail}
                  hitSlop={HIT}
                  style={styles.cardClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close">
                  <AppIcon name={ICONS.CLOSE} size={moderateScale(20)} color={COLORS.gray500} />
                </Pressable>
              </View>
              {actionLabel && onAction ? (
                <Button title={actionLabel} size="sm" onPress={handleAction} />
              ) : null}
            </View>
          )
        : null}

      {loading && !hasEntities ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.emptyWrap}>
          {renderEmpty?.() ?? (
            <>
              <View style={styles.emptyIcon}>
                <AppIcon name={emptyIcon} size={moderateScale(44)} color={COLORS.primary} />
              </View>
              <AppText style={styles.emptyTitle}>{emptyTitle}</AppText>
              <AppText style={styles.emptyMessage}>{emptyMessage}</AppText>
              {emptyActionLabel && onEmptyAction ? (
                <Button
                  title={emptyActionLabel}
                  onPress={onEmptyAction}
                  fullWidth={false}
                  style={styles.emptyAction}
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default MapExplorer;

const SEARCH_HEIGHT = scale(46);
const CHROME_TOP = SEARCH_HEIGHT + spacing[3] * 2;

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  map: { flex: 1 },

  searchWrap: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: SEARCH_HEIGHT,
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
    maxHeight: scale(280),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    ...shadows.md,
  },
  resultHeader: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
    backgroundColor: COLORS.white,
  },
  resultHeaderText: {
    ...presets.caption,
    fontFamily: fonts.semibold,
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  resultRowPressed: { backgroundColor: COLORS.gray100 },
  resultIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconEntity: { backgroundColor: addAlpha(COLORS.primary, 0.12) },
  resultTexts: { flex: 1, gap: spacing[0.5] },
  resultTitle: { ...presets.bodySM, fontFamily: fonts.medium, color: COLORS.gray900 },
  resultSubtitle: { ...presets.caption, color: COLORS.gray600 },
  noMatch: { paddingHorizontal: spacing[4], paddingVertical: spacing[4] },
  noMatchText: { ...presets.bodySM, color: COLORS.gray600 },

  chromeTopBare: { top: spacing[3] },
  kindSwitch: {
    position: 'absolute',
    top: CHROME_TOP,
    right: spacing[3],
  },

  countPill: {
    position: 'absolute',
    top: CHROME_TOP,
    left: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    ...shadows.md,
  },
  countText: { ...presets.caption, fontFamily: fonts.semibold, color: COLORS.gray900 },

  controls: { position: 'absolute', right: spacing[3], bottom: spacing[3], gap: spacing[2] },
  controlBtn: {
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

  card: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  cardIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTexts: { flex: 1, gap: spacing[0.5] },
  cardTitle: { ...presets.labelLG, color: COLORS.gray900 },
  cardSub: { ...presets.bodySM, color: COLORS.gray600 },
  cardMeta: { ...presets.caption, color: COLORS.gray500 },
  cardClose: { padding: spacing[1] },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    backgroundColor: COLORS.white,
  },
  emptyIcon: {
    width: scale(88),
    height: scale(88),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: { ...presets.headingSM, color: COLORS.gray900, textAlign: 'center' },
  emptyMessage: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  emptyAction: { marginTop: spacing[5] },
});
