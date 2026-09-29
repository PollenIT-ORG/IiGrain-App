import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICON_SIZE, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import type { BadgeTone } from '../../types/farm';
import {
  COLORS,
  LIST_PERF,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';
import SearchBar from '../list/SearchBar';
import ListFooterLoader from '../list/ListFooterLoader';
import {
  BACKDROP_IN_TIMING,
  BACKDROP_OUT_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_VELOCITY,
  SHEET_SPRING,
} from '../account/animations';
import type { DashboardProgram, ProgramStatus } from '../../types/dashboard';

export interface ProgramSelectorSheetProps {
  visible: boolean;
  programs: DashboardProgram[];
  selectedProgramId: string | null;
  defaultProgramId?: string | null;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  total?: number;
  onLoadMore?: () => void;
  onSelect: (programId: string) => void;
  onClose: () => void;
}

const STATUS_BADGE: Record<ProgramStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Separator: React.FC = () => <View style={styles.separator} />;

const ProgramSelectorSheet: React.FC<ProgramSelectorSheetProps> = ({
  visible,
  programs,
  selectedProgramId,
  loading = false,
  loadingMore = false,
  hasMore = false,
  total,
  onLoadMore,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.5);

  const [mounted, setMounted] = useState(visible);
  const [query, setQuery] = useState('');
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = height;
      backdrop.value = 0;
      setMounted(true);
    } else if (mounted) {
      setQuery('');
      backdrop.value = withTiming(0, BACKDROP_OUT_TIMING);
      translateY.value = withTiming(height, SHEET_CLOSE_TIMING, finished => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (mounted && visible) {
      backdrop.value = withTiming(1, BACKDROP_IN_TIMING);
      translateY.value = withSpring(0, SHEET_SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd(e => {
      const shouldClose =
        e.translationY > SHEET_DISMISS_DISTANCE || e.velocityY > SHEET_DISMISS_VELOCITY;
      if (shouldClose) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SHEET_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const keyExtractor = useCallback((item: DashboardProgram) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: DashboardProgram }) => {
      const selected = item.id === selectedProgramId;
      const badge = STATUS_BADGE[item.status] ?? null;
      return (
        <Pressable
          onPress={() => onSelect(item.id)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={item.name}
          style={[styles.row, selected && styles.rowSelected]}>
          <View style={[styles.rowIcon, selected && styles.rowIconSelected]}>
            <AppIcon name={ICONS.PROGRAM} size={ICON_SIZE.sm} color={COLORS.primary} />
          </View>
          <View style={styles.rowTexts}>
            <View style={styles.rowNameLine}>
              <AppText
                style={[styles.rowName, selected && styles.rowNameSelected]}
                numberOfLines={1}>
                {item.name}
              </AppText>
              {badge ? <AppStatusBadge label={badge.label} tone={badge.tone} size="sm" /> : null}
            </View>
            <AppText style={styles.rowMeta} numberOfLines={1}>
              {item.fieldsEnrolled} {item.fieldsEnrolled === 1 ? 'field' : 'fields'} ·{' '}
              {item.assessmentsCompleted}/{item.fieldsEnrolled} assessed
            </AppText>
          </View>
          {selected ? (
            <AppIcon name={ICONS.CHECK} size={scale(20)} color={COLORS.primary} />
          ) : null}
        </Pressable>
      );
    },
    [onSelect, selectedProgramId],
  );

  const visiblePrograms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? programs.filter(p => p.name.toLowerCase().includes(q)) : programs;
  }, [programs, query]);

  if (!mounted) {
    return null;
  }

  const showSpinner = loading && programs.length === 0;
  const showEmpty = !loading && programs.length === 0;
  const showSearch = programs.length > 8 || hasMore;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[styles.backdrop, backdropStyle]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <AppText style={styles.title}>Select Program</AppText>
                  {programs.length > 0 ? (
                    <AppText style={styles.subtitle}>
                      {total ?? programs.length}{' '}
                      {(total ?? programs.length) === 1 ? 'program' : 'programs'}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </GestureDetector>

            {showSearch ? (
              <View style={styles.searchWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search programs"
                />
              </View>
            ) : null}

            {showSpinner ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : showEmpty ? (
              <View style={styles.center}>
                <AppIcon name={ICONS.PROGRAM} size={scale(40)} color={COLORS.gray500} />
                <AppText style={styles.stateText}>No programs yet</AppText>
              </View>
            ) : (
              <FlatList
                data={visiblePrograms}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={Separator}
                {...LIST_PERF}
                onEndReached={onLoadMore}
                onEndReachedThreshold={0.4}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + spacing[20] },
                ]}
                ListFooterComponent={
                  <ListFooterLoader
                    loading={loadingMore}
                    hasMore={hasMore}
                    loadedCount={visiblePrograms.length}
                    total={total}
                    endLabel="programs"
                  />
                }
                ListEmptyComponent={
                  <View style={styles.center}>
                    <AppIcon name="magnify" size={scale(40)} color={COLORS.gray500} />
                    <AppText style={styles.stateText}>
                      {`No programs match "${query.trim()}"`}
                    </AppText>
                  </View>
                }
              />
            )}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default React.memo(ProgramSelectorSheet);

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    overflow: 'hidden',
    ...shadows['2xl'],
  },
  header: {
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[5],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },
  list: {
    flex: 1,
    paddingBottom: 190,
  },
  searchWrap: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  separator: {
    height: spacing[1.5],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderColor: COLORS.gray200,
    borderWidth: 0.5,
    marginBottom: spacing[2],
  },
  rowSelected: {
    backgroundColor: COLORS.lightPrimary,
  },
  rowIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconSelected: {
    backgroundColor: COLORS.white,
  },
  rowTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  rowName: {
    ...presets.labelLG,
    color: COLORS.gray900,
    flexShrink: 1,
  },
  rowNameSelected: {
    color: COLORS.primaryDark,
  },
  rowMeta: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  stateText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
