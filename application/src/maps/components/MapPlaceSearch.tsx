import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import AppTextInput from '../../components/AppTextInput/AppTextInput';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import { searchPlaces, type Place } from '../../services/geocoding';

export interface MapPlaceSearchProps {
  onPick: (place: Place) => void;
  placeholder?: string;
  leftAccessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}

const SEARCH_DEBOUNCE = 500;
const MIN_QUERY_LENGTH = 3;
const HIT = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const MapPlaceSearch: React.FC<MapPlaceSearchProps> = ({
  onPick,
  placeholder = 'Search a place, city, area…',
  leftAccessory,
  style,
  autoFocus,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

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

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  const pick = useCallback(
    (place: Place) => {
      Keyboard.dismiss();
      clear();
      onPick(place);
    },
    [clear, onPick],
  );

  return (
    <View style={style}>
      <View style={styles.row}>
        {leftAccessory}
        <View style={styles.box}>
          <AppIcon name="magnify" size={moderateScale(18)} color={COLORS.gray500} />
          <AppTextInput
            style={styles.input}
            placeholder={placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus={autoFocus}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : query.length > 0 ? (
            <Pressable onPress={clear} hitSlop={HIT} accessibilityLabel="Clear search">
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
                onPress={() => pick(item)}
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
  );
};

export default React.memo(MapPlaceSearch);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  box: {
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
  input: {
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
});
