import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
import type { BadgeTone } from '../../types/farm';
import type { ModuleKey, ModuleSummary } from '../../types/monitoring';
import type { MonitoringModuleDef } from '../../config/monitoringModules';

export interface ModuleRowProps {
  def: MonitoringModuleDef;
  summary: ModuleSummary;
  locked?: boolean;
  onPress: (module: ModuleKey) => void;
}

const TONE_COLOR: Record<BadgeTone, string> = {
  success: COLORS.primary,
  warning: COLORS.accent,
  danger: COLORS.danger,
  info: COLORS.infoBlue,
  neutral: COLORS.gray600,
};

const RING_SIZE = scale(46);
const RING_STROKE = scale(4);

const ProgressRing: React.FC<{ ratio: number; color: string; label: string }> = ({
  ratio,
  color,
  label,
}) => {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, ratio));
  const center = RING_SIZE / 2;

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={COLORS.gray200}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {dash > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={[dash, circumference - dash]}
            transform={'rotate(-90 ' + center + ' ' + center + ')'}
            fill="none"
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <AppText style={[styles.ringText, { color }]} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
};

const ModuleRow: React.FC<ModuleRowProps> = ({
  def,
  summary,
  locked = false,
  onPress,
}) => {
  const color = locked ? COLORS.gray500 : TONE_COLOR[def.tone];
  const { total, completed, documents } = summary;
  const ratio = total > 0 ? completed / total : 0;
  const done = total > 0 && completed === total;
  const untouched = total === 0;

  const state = useMemo(() => {
    if (locked) {
      return { label: 'Locked', tint: COLORS.gray600, icon: 'lock-outline' };
    }
    if (untouched) {
      return { label: 'Not started', tint: COLORS.gray600, icon: 'circle-outline' };
    }
    if (done) {
      return { label: 'Complete', tint: COLORS.primary, icon: ICONS.CHECK };
    }
    return {
      label: `${total - completed} open`,
      tint: COLORS.accent,
      icon: ICONS.IN_PROGRESS,
    };
  }, [locked, untouched, done, total, completed]);

  const handlePress = useCallback(() => onPress(summary.module), [onPress, summary.module]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `${summary.label}, locked until the field boundary is drawn`
          : `${summary.label}, ${completed} of ${total} completed`
      }
      style={({ pressed }) => [
        styles.card,
        locked && styles.cardLocked,
        pressed && styles.cardPressed,
      ]}>
      <View style={[styles.accent, { backgroundColor: color }]} pointerEvents="none" />

      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: addAlpha(color, 0.12) }]}>
          <AppIcon name={def.icon} size={moderateScale(22)} color={color} />
        </View>

        <View style={styles.texts}>
          <AppText style={styles.title} numberOfLines={1}>
            {summary.label}
          </AppText>
          <AppText style={styles.subtitle} numberOfLines={2}>
            {def.description}
          </AppText>
        </View>

        {locked ? (
          <View style={styles.lockTile}>
            <AppIcon
              name="lock-outline"
              size={moderateScale(20)}
              color={COLORS.gray600}
            />
          </View>
        ) : (
          <ProgressRing
            ratio={ratio}
            color={untouched ? COLORS.gray500 : color}
            label={untouched ? '—' : `${completed}/${total}`}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: addAlpha(state.tint, 0.1) }]}>
            <AppIcon name={state.icon} size={moderateScale(12)} color={state.tint} />
            <AppText style={[styles.chipText, { color: state.tint }]}>
              {state.label}
            </AppText>
          </View>

          {documents > 0 ? (
            <View style={styles.docChip}>
              <AppIcon
                name={ICONS.EVIDENCE}
                size={moderateScale(12)}
                color={COLORS.gray600}
              />
              <AppText style={styles.docText}>
                {documents} {documents === 1 ? 'file' : 'files'}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.open}>
          <AppText style={[styles.openText, locked && styles.openTextLocked]}>
            {locked ? 'Why?' : 'Open'}
          </AppText>
          <AppIcon
            name={locked ? 'information-outline' : ICONS.CHEVRON_RIGHT}
            size={moderateScale(16)}
            color={locked ? COLORS.gray600 : COLORS.primary}
          />
        </View>
      </View>
    </Pressable>
  );
};

export default React.memo(ModuleRow);

const styles = StyleSheet.create({
  cardLocked: {
    backgroundColor: COLORS.gray100,
  },
  lockTile: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray200,
  },
  openTextLocked: {
    color: COLORS.gray600,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[3.5],
    paddingLeft: spacing[4],
    paddingRight: spacing[3.5],
    gap: spacing[3],
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardPressed: {
    backgroundColor: COLORS.lightPrimaryBg,
    borderColor: COLORS.primaryLighter,
    transform: [{ scale: 0.995 }],
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: scale(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconTile: {
    width: scale(46),
    height: scale(46),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: scale(3),
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
  },
  chipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
  },
  docText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.gray600,
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  openText: {
    ...presets.labelSM,
    color: COLORS.primary,
  },
});
