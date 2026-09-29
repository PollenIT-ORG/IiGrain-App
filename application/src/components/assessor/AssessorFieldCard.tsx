import React, { memo, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import AssessmentProgressBar from '../assessment/AssessmentProgressBar';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, capitalize, moderateScale } from '../../utils';
import { formatAcres } from '../../maps/utils/fieldAcres';
import type { AssessorFieldEntry } from '../../types/assessor';

export type AssessorVisitPhase = 'en_route' | 'arrived';

export const VISIT_PHASE = {
  en_route: {
    icon: 'navigation-variant',
    color: COLORS.accent,
    title: 'On the way',
    hint: 'You have not reached this field yet',
    action: 'Live tracking',
  },
  arrived: {
    icon: 'map-marker-check',
    color: COLORS.success,
    title: 'On field',
    hint: 'Marked as arrived — you are at this field',
    action: 'Open visit',
  },
} as const;

const HEALTH: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: COLORS.success },
  monitor: { label: 'Monitor', color: COLORS.warning },
  critical: { label: 'Critical', color: COLORS.danger },
};

interface ProgressCopy {
  icon: string;
  color: string;
  text: string;
}

const progressCopy = (
  a: AssessorFieldEntry['assessment'],
  onField: boolean,
): ProgressCopy => {
  if (a.completed) {
    return { icon: 'check-decagram', color: COLORS.success, text: 'Assessed by you' };
  }
  if (!onField) {
    return {
      icon: ICONS.LOCK,
      color: COLORS.gray500,
      text:
        a.answered > 0
          ? 'In progress — locked until you reach the field'
          : 'Locked — reach the field to assess',
    };
  }
  if (a.percentage > 0 || a.answered > 0) {
    return { icon: 'progress-clock', color: COLORS.accent, text: 'In progress' };
  }
  return {
    icon: 'clipboard-text-outline',
    color: COLORS.gray500,
    text: 'On field — tap to assess',
  };
};

interface MetaChip {
  key: string;
  icon: string;
  label: string;
}

export interface AssessorFieldCardProps {
  entry: AssessorFieldEntry;
  phase: AssessorVisitPhase | null;
  starting: boolean;
  onOpen: () => void;
  onStartVisit: () => void;
}

const AssessorFieldCard: React.FC<AssessorFieldCardProps> = ({
  entry,
  phase,
  starting,
  onOpen,
  onStartVisit,
}) => {
  const { field, farm, farmer, program, assessment } = entry;
  const visit = phase ? VISIT_PHASE[phase] : null;
  const health = HEALTH[field.status];
  const copy = progressCopy(assessment, phase === 'arrived');

  const chips = useMemo<MetaChip[]>(() => {
    const out: MetaChip[] = [];
    if (field.crop) {
      out.push({ key: 'crop', icon: ICONS.CROP, label: capitalize(field.crop) });
    }
    if (field.areaAcres !== null) {
      out.push({
        key: 'area',
        icon: ICONS.AREA,
        label: `${formatAcres(field.areaAcres)} acres`,
      });
    }
    if (field.location) {
      out.push({ key: 'location', icon: ICONS.LOCATION, label: field.location });
    }
    return out;
  }, [field.crop, field.areaAcres, field.location]);

  const subtitle = [farm.name, farmer.name].filter(Boolean).join('  ·  ');

  return (
    <View
      style={[
        styles.card,
        visit ? { borderColor: visit.color, borderWidth: borderWidth.medium } : null,
      ]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.iconTile}>
            <AppIcon name={ICONS.FIELD} size={moderateScale(20)} color={COLORS.primary} />
          </View>

          <View style={styles.headTexts}>
            <View style={styles.titleRow}>
              <AppText style={styles.name} numberOfLines={1}>
                {field.name || 'Untitled field'}
              </AppText>
              {health ? (
                <View style={[styles.healthDot, { backgroundColor: health.color }]} />
              ) : null}
            </View>
            {subtitle ? (
              <AppText style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>

          <AppIcon
            name={ICONS.CHEVRON_RIGHT}
            size={moderateScale(22)}
            color={COLORS.gray500}
          />
        </View>

        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map(chip => (
              <View key={chip.key} style={styles.chip}>
                <AppIcon
                  name={chip.icon}
                  size={moderateScale(13)}
                  color={COLORS.primary}
                />
                <AppText style={styles.chipText} numberOfLines={1}>
                  {chip.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {program.name ? (
          <View style={styles.programBand}>
            <AppIcon
              name={ICONS.ASSESSMENT}
              size={moderateScale(14)}
              color={COLORS.primary}
            />
            <AppText style={styles.programText} numberOfLines={1}>
              {program.name}
            </AppText>
          </View>
        ) : null}

        <View style={styles.progressBlock}>
          <View style={styles.progressHead}>
            <AppText style={styles.progressLabel}>Assessment</AppText>
            <AppText style={styles.progressCount}>
              {assessment.answered}/{assessment.totalQuestions}
              <AppText style={styles.progressPercent}>
                {'  ·  '}
                {Math.round(assessment.percentage)}%
              </AppText>
            </AppText>
          </View>

          <AssessmentProgressBar
            progress={assessment.percentage}
            colorByPercent
            height={moderateScale(6)}
            showPercent={false}
          />

          <View style={styles.statusLine}>
            <AppIcon name={copy.icon} size={moderateScale(14)} color={copy.color} />
            <AppText style={[styles.statusText, { color: copy.color }]} numberOfLines={1}>
              {copy.text}
            </AppText>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.footer}>
        {visit ? (
          <View
            style={[
              styles.visitStrip,
              { borderColor: visit.color, backgroundColor: addAlpha(visit.color, 0.12) },
            ]}>
            <AppIcon name={visit.icon} size={moderateScale(15)} color={visit.color} />
            <View style={styles.visitTexts}>
              <AppText style={[styles.visitTitle, { color: visit.color }]} numberOfLines={1}>
                {visit.title}
              </AppText>
              <AppText style={styles.visitHint} numberOfLines={1}>
                {visit.hint}
              </AppText>
            </View>
          </View>
        ) : null}

        <Button
          title={visit ? visit.action : 'Start visit'}
          onPress={onStartVisit}
          loading={starting}
          variant="primary"
          size="sm"
          leftIcon={
            <AppIcon
              name={visit ? visit.icon : 'navigation-variant'}
              size={moderateScale(16)}
              color={COLORS.white}
            />
          }
          style={styles.visitBtn}
        />
      </View>
    </View>
  );
};

export default memo(AssessorFieldCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  body: { gap: spacing[3] },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconTile: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTexts: { flex: 1, gap: spacing[0.5] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { ...presets.labelLG, color: COLORS.gray900, flexShrink: 1 },
  healthDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: borderRadius.full,
  },
  subtitle: { ...presets.caption, color: COLORS.gray600 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimaryBg,
    borderWidth: borderWidth.hairline,
    borderColor: COLORS.lightPrimary,
    maxWidth: '100%',
  },
  chipText: { ...presets.caption, color: COLORS.gray700, flexShrink: 1 },

  programBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.surface,
  },
  programText: {
    ...presets.labelSM,
    color: COLORS.gray900,
    fontFamily: fonts.semibold,
    flexShrink: 1,
  },

  progressBlock: { gap: spacing[2] },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  progressLabel: { ...presets.caption, color: COLORS.gray600 },
  progressCount: {
    ...presets.labelSM,
    color: COLORS.gray900,
    fontFamily: fonts.semibold,
  },
  progressPercent: { ...presets.caption, color: COLORS.gray600 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  statusText: { ...presets.caption, fontFamily: fonts.semibold, flexShrink: 1 },

  footer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    gap: spacing[2.5],
  },
  visitStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
  },
  visitTexts: { flex: 1, gap: spacing[0.5] },
  visitTitle: { ...presets.labelSM, fontFamily: fonts.semibold },
  visitHint: { ...presets.caption, color: COLORS.gray600 },
  visitBtn: { alignSelf: 'stretch' },
});
