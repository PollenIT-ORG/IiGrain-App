import React, { useCallback, useEffect, useState } from 'react';
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
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';
import {
  BACKDROP_IN_TIMING,
  BACKDROP_OUT_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_VELOCITY,
  SHEET_SPRING,
} from '../account/animations';
import type { DashboardFarm } from '../../types/dashboard';

export interface FarmSelectorSheetProps {
  visible: boolean;
  farms: DashboardFarm[];
  selectedFarmId: string | null;
  loading?: boolean;
  onSelect: (farmId: string) => void;
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Separator: React.FC = () => <View style={styles.separator} />;

const FarmSelectorSheet: React.FC<FarmSelectorSheetProps> = ({
  visible,
  farms,
  selectedFarmId,
  loading = false,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * 0.5);

  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = height;
      backdrop.value = 0;
      setMounted(true);
    } else if (mounted) {
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

  const renderItem = useCallback(
    ({ item }: { item: DashboardFarm }) => {
      const selected = item.id === selectedFarmId;
      return (
        <Pressable
          onPress={() => onSelect(item.id)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={item.name}
          style={[styles.row, selected && styles.rowSelected]}>
          <View style={[styles.rowIcon, selected && styles.rowIconSelected]}>
            <AppIcon name={ICONS.FARM} size={ICON_SIZE.sm} color={COLORS.primary} />
          </View>
          <View style={styles.rowTexts}>
            <AppText
              style={[styles.rowName, selected && styles.rowNameSelected]}
              numberOfLines={1}>
              {item.name}
            </AppText>
            <AppText style={styles.rowMeta} numberOfLines={1}>
              {item.fieldCount} {item.fieldCount === 1 ? 'field' : 'fields'}
            </AppText>
          </View>
          {selected ? (
            <AppIcon name={ICONS.CHECK} size={scale(20)} color={COLORS.primary} />
          ) : null}
        </Pressable>
      );
    },
    [onSelect, selectedFarmId],
  );

  if (!mounted) {
    return null;
  }

  const showSpinner = loading && farms.length === 0;
  const showEmpty = !loading && farms.length === 0;

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
                  <AppText style={styles.title}>Select Farm</AppText>
                  {farms.length > 0 ? (
                    <AppText style={styles.subtitle}>
                      {farms.length} {farms.length === 1 ? 'farm' : 'farms'}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </GestureDetector>

            {showSpinner ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : showEmpty ? (
              <View style={styles.center}>
                <AppIcon name={ICONS.FARM} size={scale(40)} color={COLORS.gray500} />
                <AppText style={styles.stateText}>No farms yet</AppText>
              </View>
            ) : (
              <FlatList
                data={farms}
                keyExtractor={f => f.id}
                renderItem={renderItem}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={Separator}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + spacing[20] },
                ]}
              />
            )}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default React.memo(FarmSelectorSheet);

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
    paddingBottom:190,
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
       borderColor:COLORS.gray200,
    borderWidth:0.5,
    marginBottom:spacing[2]
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
  },
  rowNameSelected: {
    color: COLORS.primaryDark,
  },
  rowMeta: {
    ...presets.bodyXS,
    color: COLORS.gray500,
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
