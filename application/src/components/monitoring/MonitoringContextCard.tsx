import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppGradient from '../AppGradient/AppGradient';
import { COLORS, borderRadius, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export interface MonitoringContextCardProps {
  title: string;
  subtitle?: string;
  caption?: string;
  icon?: string;
  meta?: string;
}

const MonitoringContextCard: React.FC<MonitoringContextCardProps> = ({
  title,
  subtitle,
  caption,
  icon,
  meta,
}) => (
  <AppGradient variant="header" borderRadius={borderRadius['2xl']} style={styles.card}>
    <View style={styles.glowLarge} pointerEvents="none" />
    <View style={styles.glowSmall} pointerEvents="none" />

    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconTile}>
          <AppIcon name={icon} size={moderateScale(20)} color={COLORS.white} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>

    {caption || meta ? (
      <View style={styles.footer}>
        {caption ? (
          <View style={styles.captionPill}>
            <AppIcon
              name="school-outline"
              size={moderateScale(13)}
              color={addAlpha(COLORS.white, 0.9)}
            />
            <AppText style={styles.captionText} numberOfLines={1}>
              {caption}
            </AppText>
          </View>
        ) : null}
        {meta ? (
          <AppText style={styles.metaText} numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
    ) : null}
  </AppGradient>
);

export default React.memo(MonitoringContextCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius['2xl'],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[3],
    overflow: 'hidden',
    ...shadows.md,
  },
  glowLarge: {
    position: 'absolute',
    top: -scale(46),
    right: -scale(30),
    width: scale(132),
    height: scale(132),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.white, 0.09),
  },
  glowSmall: {
    position: 'absolute',
    bottom: -scale(38),
    right: scale(52),
    width: scale(80),
    height: scale(80),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.white, 0.07),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconTile: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: addAlpha(COLORS.white, 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: addAlpha(COLORS.white, 0.3),
  },
  texts: {
    flex: 1,
    gap: scale(3),
  },
  title: {
    ...presets.headingMD,
    color: COLORS.white,
  },
  subtitle: {
    ...presets.bodyXS,
    color: addAlpha(COLORS.white, 0.82),
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: addAlpha(COLORS.white, 0.24),
  },
  captionPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(5),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.white, 0.16),
  },
  captionText: {
    ...presets.labelSM,
    color: COLORS.white,
    flexShrink: 1,
  },
  metaText: {
    ...presets.bodyXS,
    color: addAlpha(COLORS.white, 0.78),
  },
});
