import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { formatDateOnly } from '../../utils/monitoringValues';
import type { MonitoringProgram } from '../../types/monitoring';

export interface ProgramPickerProps {
  programs: MonitoringProgram[];
  selectedId: string | null;
  onSelect: (programId: string) => void;
}

const ProgramPicker: React.FC<ProgramPickerProps> = ({
  programs,
  selectedId,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = programs.find(p => p.programId === selectedId) ?? programs[0] ?? null;
  const switchable = programs.length > 1;

  const choose = useCallback(
    (programId: string) => {
      setOpen(false);
      if (programId !== selectedId) {
        onSelect(programId);
      }
    },
    [onSelect, selectedId],
  );

  if (!selected) {
    return null;
  }

  return (
    <>
      <Pressable
        disabled={!switchable}
        onPress={() => setOpen(true)}
        accessibilityRole={switchable ? 'button' : 'text'}
        accessibilityLabel={`Program ${selected.programName}`}
        style={({ pressed }) => [styles.row, pressed && switchable && styles.rowPressed]}>
        <View style={styles.iconTile}>
          <AppIcon name="school-outline" size={moderateScale(18)} color={COLORS.primary} />
        </View>

        <View style={styles.texts}>
          <AppText style={styles.label}>RECORDING AGAINST</AppText>
          <AppText style={styles.value} numberOfLines={1}>
            {selected.programName}
          </AppText>
        </View>

        {switchable ? (
          <View style={styles.changeChip}>
            <AppText style={styles.changeText}>Change</AppText>
            <AppIcon
              name={ICONS.CHEVRON_DOWN}
              size={moderateScale(14)}
              color={COLORS.primary}
            />
          </View>
        ) : (
          <View style={styles.lockChip}>
            <AppIcon name={ICONS.CHECK} size={moderateScale(14)} color={COLORS.primary} />
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
                <View style={styles.grabber} />

                <View style={styles.sheetHead}>
                  <View style={styles.sheetHeadTexts}>
                    <AppText style={styles.sheetTitle}>Choose a program</AppText>
                    <AppText style={styles.sheetHint}>
                      This field keeps a separate set of records in each program it
                      is enrolled in.
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => setOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.closeButton,
                      pressed && styles.closePressed,
                    ]}>
                    <AppIcon
                      name={ICONS.CLOSE}
                      size={moderateScale(18)}
                      color={COLORS.gray700}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.sheetList}
                  showsVerticalScrollIndicator={false}
                  bounces={false}>
                  {programs.map(program => {
                    const active = program.programId === selected.programId;
                    const started = formatDateOnly(program.startDateISO);
                    return (
                      <Pressable
                        key={program.programId}
                        onPress={() => choose(program.programId)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [
                          styles.option,
                          active && styles.optionActive,
                          pressed && styles.optionPressed,
                        ]}>
                        <View
                          style={[styles.optionIcon, active && styles.optionIconActive]}>
                          <AppIcon
                            name="school-outline"
                            size={moderateScale(16)}
                            color={active ? COLORS.white : COLORS.gray600}
                          />
                        </View>
                        <View style={styles.optionTexts}>
                          <AppText
                            style={[styles.optionText, active && styles.optionTextActive]}
                            numberOfLines={2}>
                            {program.programName}
                          </AppText>
                          {started ? (
                            <AppText style={styles.optionMeta}>Started {started}</AppText>
                          ) : null}
                        </View>
                        {active ? (
                          <AppIcon
                            name="check-circle"
                            size={moderateScale(20)}
                            color={COLORS.primary}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.cancelPressed,
                  ]}>
                  <AppText style={styles.cancelText}>Cancel</AppText>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default React.memo(ProgramPicker);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.primary, 0.18),
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  rowPressed: {
    backgroundColor: addAlpha(COLORS.primary, 0.14),
  },
  iconTile: {
    width: scale(36),
    height: scale(36),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  texts: {
    flex: 1,
    gap: scale(2),
  },
  label: {
    ...presets.labelSM,
    fontSize: moderateScale(10),
    letterSpacing: 0.8,
    color: COLORS.primary,
  },
  value: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(5),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
  },
  changeText: {
    ...presets.labelSM,
    color: COLORS.primary,
  },
  lockChip: {
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },

  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2.5],
    gap: spacing[3],
    maxHeight: '80%',
    ...shadows.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  sheetHeadTexts: {
    flex: 1,
    gap: scale(3),
  },
  sheetTitle: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  sheetHint: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  closeButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  closePressed: {
    backgroundColor: COLORS.gray200,
  },
  sheetList: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginBottom: spacing[2],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  optionActive: {
    backgroundColor: COLORS.lightPrimaryBg,
    borderColor: COLORS.primaryLighter,
  },
  optionPressed: {
    backgroundColor: COLORS.gray100,
  },
  optionIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  optionIconActive: {
    backgroundColor: COLORS.primary,
  },
  optionTexts: {
    flex: 1,
    gap: scale(2),
  },
  optionText: {
    ...presets.bodyMD,
    color: COLORS.gray900,
  },
  optionTextActive: {
    ...presets.labelLG,
    color: COLORS.primary,
  },
  optionMeta: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  cancelPressed: {
    backgroundColor: COLORS.gray100,
  },
  cancelText: {
    ...presets.buttonLG,
    color: COLORS.gray700,
  },
});
