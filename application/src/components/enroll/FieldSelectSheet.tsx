import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
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
import Button from '../Button/Button';
import SearchBar from '../list/SearchBar';
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
  BACKDROP_IN_TIMING,
  BACKDROP_OUT_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_DISTANCE,
  SHEET_DISMISS_VELOCITY,
  SHEET_SPRING,
} from '../account/animations';

/** Shape shared by the per-program field list and the flat fallback list. */
export interface SelectableField {
  id: string;
  name: string;
  crop: string;
  farmName: string;
  enrolled: boolean;
}

export interface FieldSelectSheetProps {
  visible: boolean;
  programName: string;
  /** True when the user is adding fields to a program they already joined. */
  alreadyEnrolled: boolean;
  fields: SelectableField[];
  selectedIds: string[];
  loading?: boolean;
  enrolling?: boolean;
  /** Field currently being removed, so its row can show a spinner. */
  unenrollingFieldId?: string | null;
  errorMessage?: string | null;
  /**
   * Rendered on top of the sheet, inside the SAME native modal — confirmation
   * dialogs must go here rather than beside the sheet, because iOS does not
   * reliably present two sibling modals at once.
   */
  overlay?: React.ReactNode;
  onRetry?: () => void;
  onToggle: (fieldId: string) => void;
  onRemove: (field: SelectableField) => void;
  onEnroll: () => void;
  onGoToFarms?: () => void;
  onClose: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SEARCH_THRESHOLD = 8;

const FieldSelectSheet: React.FC<FieldSelectSheetProps> = ({
  visible,
  programName,
  alreadyEnrolled,
  fields,
  selectedIds,
  loading = false,
  enrolling = false,
  unenrollingFieldId,
  errorMessage,
  overlay,
  onRetry,
  onToggle,
  onRemove,
  onEnroll,
  onGoToFarms,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  // Only used to park the sheet off-screen before it animates in. The sheet's
  // own height is a percentage of the modal container (see styles.sheet) so it
  // can never exceed the window and clip its own header.
  const { height } = useWindowDimensions();

  // Bottom clearance differs by platform and must not be guessed:
  //   iOS      - the modal always covers the full screen, so the home indicator
  //              has to be cleared here via the inset.
  //   Android  - this Modal deliberately omits statusBarTranslucent, so its
  //              window already stops above the navigation bar. Adding the app
  //              window's inset on top would either double-pad (edge-to-edge on
  //              Android 15+) or, worse, read as 0 on older versions and leave
  //              the Enroll button sitting under the nav buttons.
  const bottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

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

  // Dragging is disabled mid-request so the sheet cannot vanish under a
  // half-finished enrollment.
  const pan = Gesture.Pan()
    .enabled(!enrolling)
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

  const handleBackdropPress = useCallback(() => {
    if (!enrolling) {
      onClose();
    }
  }, [enrolling, onClose]);

  const selectableCount = useMemo(
    () => fields.filter(f => !f.enrolled).length,
    [fields],
  );
  const selectedCount = selectedIds.length;
  const enrolledCount = fields.length - selectableCount;

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return fields;
    }
    return fields.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.crop.toLowerCase().includes(q) ||
        f.farmName.toLowerCase().includes(q),
    );
  }, [fields, query]);

  const renderItem = useCallback(
    ({ item }: { item: SelectableField }) => {
      const checked = item.enrolled || selectedIds.includes(item.id);
      const removing = unenrollingFieldId === item.id;

      return (
        <Pressable
          onPress={() => onToggle(item.id)}
          disabled={item.enrolled || enrolling}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled: item.enrolled }}
          accessibilityLabel={item.name}
          style={({ pressed }) => [
            styles.row,
            item.enrolled
              ? styles.rowEnrolled
              : checked
              ? styles.rowSelected
              : null,
            pressed && !item.enrolled && styles.rowPressed,
          ]}>
          <AppIcon
            name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={moderateScale(22)}
            color={
              item.enrolled ? COLORS.gray500 : checked ? COLORS.primary : COLORS.gray500
            }
          />

          <View style={styles.rowIcon}>
            <AppIcon name={ICONS.FIELD} size={ICON_SIZE.sm} color={COLORS.primary} />
          </View>

          <View style={styles.rowTexts}>
            <AppText style={styles.rowName} numberOfLines={1}>
              {item.name}
            </AppText>
            <AppText style={styles.rowMeta} numberOfLines={1}>
              {item.crop || '—'} · {item.farmName}
            </AppText>
          </View>

          {item.enrolled ? (
            <View style={styles.rowActions}>
              <View style={styles.enrolledChip}>
                <AppText style={styles.enrolledChipText}>Enrolled</AppText>
              </View>
              {removing ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Pressable
                  onPress={() => onRemove(item)}
                  disabled={!!unenrollingFieldId || enrolling}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from this program`}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}>
                  <AppIcon
                    name={ICONS.CLOSE}
                    size={moderateScale(15)}
                    color={COLORS.danger}
                  />
                </Pressable>
              )}
            </View>
          ) : null}
        </Pressable>
      );
    },
    [selectedIds, unenrollingFieldId, enrolling, onToggle, onRemove],
  );

  if (!mounted) {
    return null;
  }

  const showSpinner = loading && fields.length === 0;
  const showError = !loading && !!errorMessage && fields.length === 0;
  const showSearch = fields.length > SEARCH_THRESHOLD;

  const hint = !selectableCount
    ? 'All your fields are already in this program'
    : selectedCount === 0
    ? alreadyEnrolled
      ? 'Select the fields you want to add'
      : 'Select at least one field'
    : `${selectedCount} field${selectedCount === 1 ? '' : 's'} selected`;

  const renderContent = () => {
    if (showSpinner) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }
    if (showError) {
      return (
        <View style={styles.center}>
          <AppIcon name={ICONS.ERROR} size={scale(40)} color={COLORS.gray500} />
          <AppText style={styles.stateText}>{errorMessage}</AppText>
          {onRetry ? (
            <Button
              title="Retry"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={onRetry}
              style={styles.retryBtn}
            />
          ) : null}
        </View>
      );
    }
    if (fields.length === 0) {
      return (
        <View style={styles.center}>
          <AppIcon name={ICONS.FIELD} size={scale(40)} color={COLORS.gray500} />
          <AppText style={styles.stateText}>
            You don't have any fields yet. Add a field to one of your farms to
            join this program.
          </AppText>
          {onGoToFarms ? (
            <Button
              title="Go to Farms"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={onGoToFarms}
              style={styles.retryBtn}
            />
          ) : null}
        </View>
      );
    }

    return (
      <FlatList
        data={visibleFields}
        keyExtractor={f => f.id}
        renderItem={renderItem}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <AppIcon name="magnify" size={scale(40)} color={COLORS.gray500} />
            <AppText style={styles.stateText}>
              {`No fields match "${query.trim()}"`}
            </AppText>
          </View>
        }
      />
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      // No statusBarTranslucent/navigationBarTranslucent on purpose — letting
      // the Android window respect the system bars is what keeps the footer
      // clear of the navigation buttons. See `bottomInset` above.
      onRequestClose={handleBackdropPress}>
      <GestureHandlerRootView style={styles.root}>
        <AnimatedPressable
          style={[styles.backdrop, backdropStyle]}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />

        <View style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            style={[styles.sheet, { paddingBottom: bottomInset }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <View style={styles.headerTexts}>
                    <AppText style={styles.title}>
                      {alreadyEnrolled ? 'Add Fields' : 'Select Fields'}
                    </AppText>
                    <AppText style={styles.subtitle} numberOfLines={1}>
                      {programName}
                    </AppText>
                  </View>
                  {selectedCount > 0 ? (
                    <View style={styles.countChip}>
                      <AppText style={styles.countChipText}>{selectedCount}</AppText>
                    </View>
                  ) : null}
                </View>

                {enrolledCount > 0 ? (
                  <AppText style={styles.headerNote}>
                    {enrolledCount} field{enrolledCount === 1 ? '' : 's'} already enrolled
                  </AppText>
                ) : null}
              </View>
            </GestureDetector>

            {showSearch ? (
              <View style={styles.searchWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search fields"
                />
              </View>
            ) : null}

            {renderContent()}

            <View style={styles.footer}>
              <AppText style={styles.footerHint} numberOfLines={1}>
                {hint}
              </AppText>
              <Button
                title={alreadyEnrolled ? 'Add Fields' : 'Enroll Now'}
                onPress={onEnroll}
                loading={enrolling}
                disabled={selectedCount === 0 || enrolling}
                leftIcon={
                  <AppIcon
                    name={ICONS.SUCCESS}
                    size={moderateScale(20)}
                    color={COLORS.white}
                  />
                }
              />
            </View>
          </Animated.View>
        </View>

        {overlay}
      </GestureHandlerRootView>
    </Modal>
  );
};

export default React.memo(FieldSelectSheet);

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    // Relative to the modal container, so it adapts to whatever height the
    // window actually has on each platform.
    height: '82%',
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
    gap: spacing[3],
  },
  headerTexts: { flex: 1, gap: spacing[0.5] },
  title: { ...presets.headingSM, color: COLORS.gray900 },
  subtitle: { ...presets.bodyXS, color: COLORS.gray500 },
  countChip: {
    minWidth: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  countChipText: { ...presets.labelSM, color: COLORS.white },
  headerNote: {
    ...presets.caption,
    color: COLORS.gray600,
    marginTop: spacing[2],
  },
  searchWrap: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    marginBottom: spacing[2],
  },
  rowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPrimaryBg,
  },
  rowEnrolled: { backgroundColor: COLORS.gray100 },
  rowPressed: { opacity: 0.85 },
  rowIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: { flex: 1, gap: spacing[0.5] },
  rowName: { ...presets.labelLG, color: COLORS.gray900 },
  rowMeta: { ...presets.bodyXS, color: COLORS.gray500 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  enrolledChip: {
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.success, 0.14),
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  enrolledChipText: { ...presets.caption, color: COLORS.success },
  removeBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: addAlpha(COLORS.danger, 0.1),
  },
  pressed: { opacity: 0.7 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  stateText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  retryBtn: { minWidth: moderateScale(140) },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    gap: spacing[2],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  footerHint: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
