import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { moduleDef } from '../../config/monitoringModules';
import type { ModuleKey, MonitoringRecord } from '../../types/monitoring';
import {
  formatCoords,
  hasValue,
  recordCoords,
  recordDate,
  recordTitle,
  summaryLine,
} from '../../utils/monitoringValues';

export interface RecordRowProps {
  module: ModuleKey;
  record: MonitoringRecord;
  onPress: () => void;
}

const RecordRow: React.FC<RecordRowProps> = ({ module, record, onPress }) => {
  const def = moduleDef(module);

  const title = useMemo(() => recordTitle(module, record), [module, record]);
  const summary = useMemo(() => summaryLine(module, record), [module, record]);
  const dated = useMemo(() => recordDate(module, record), [module, record]);
  const coords = useMemo(() => recordCoords(module, record), [module, record]);

  const presence = def.presence;
  const filled = presence ? hasValue(record.values[presence.key]) : false;

  const done = presence ? filled : record.status === 'completed';
  const accent = done ? COLORS.primary : COLORS.gray500;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.accent, { backgroundColor: accent }]} pointerEvents="none" />

      <View style={styles.top}>
        <View
          style={[
            styles.leading,
            { backgroundColor: addAlpha(accent, done ? 0.12 : 0.08) },
          ]}>
          <AppIcon
            name={presence ? ICONS.LOCATION : def.icon}
            size={moderateScale(18)}
            color={accent}
          />
        </View>

        <View style={styles.headTexts}>
          <AppText style={styles.title} numberOfLines={1}>
            {title}
          </AppText>
          {dated ? (
            <AppText style={styles.date} numberOfLines={1}>
              {presence ? `Sampled on ${dated}` : dated}
            </AppText>
          ) : null}
        </View>

        <View style={styles.tail}>
          {presence ? (
            <AppStatusBadge
              size="sm"
              label={filled ? presence.present : presence.absent}
              tone={filled ? 'success' : 'neutral'}
            />
          ) : (
            <AppStatusBadge size="sm" status={record.status} />
          )}
          <AppIcon
            name={ICONS.CHEVRON_RIGHT}
            size={moderateScale(16)}
            color={COLORS.gray500}
          />
        </View>
      </View>

      {summary ? (
        <AppText style={styles.summary} numberOfLines={2}>
          {summary}
        </AppText>
      ) : null}

      {coords || presence || record.documentCount > 0 ? (
        <View style={styles.chips}>
          {coords ? (
            <View style={styles.chip}>
              <AppIcon
                name={ICONS.LOCATION}
                size={moderateScale(12)}
                color={COLORS.gray600}
              />
              <AppText style={styles.chipText} numberOfLines={1}>
                {formatCoords(coords.latitude, coords.longitude)}
              </AppText>
            </View>
          ) : presence ? (
            <View style={[styles.chip, styles.chipMuted]}>
              <AppIcon
                name="map-marker-off-outline"
                size={moderateScale(12)}
                color={COLORS.gray500}
              />
              <AppText style={[styles.chipText, styles.chipTextMuted]}>
                No position
              </AppText>
            </View>
          ) : null}

          {record.documentCount > 0 ? (
            <View style={styles.chip}>
              <AppIcon
                name={ICONS.EVIDENCE}
                size={moderateScale(12)}
                color={COLORS.gray600}
              />
              <AppText style={styles.chipText}>
                {record.documentCount} {record.documentCount === 1 ? 'file' : 'files'}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
};

export default React.memo(RecordRow);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingVertical: spacing[3.5],
    paddingLeft: spacing[4],
    paddingRight: spacing[3.5],
    gap: spacing[2.5],
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  leading: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTexts: {
    flex: 1,
    gap: scale(2),
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  date: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  tail: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  summary: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
    maxWidth: '100%',
  },
  chipMuted: {
    backgroundColor: 'transparent',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  chipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.gray600,
    flexShrink: 1,
  },
  chipTextMuted: {
    color: COLORS.gray500,
  },
});
