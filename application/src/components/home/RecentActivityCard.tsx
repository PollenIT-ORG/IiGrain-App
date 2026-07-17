import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export interface ActivityItem {
  key: string;
  icon: string;
  title: string;
  date: string;
}

interface RecentActivityCardProps {
  items: ActivityItem[];
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({ items }) => (
  <View style={styles.card}>
    {items.map((it, i) => (
      <View
        key={it.key}
        style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
        <View style={styles.iconCircle}>
          <AppIcon name={it.icon} size={moderateScale(20)} color={COLORS.success} />
        </View>
        <View style={styles.texts}>
          <AppText style={styles.title} numberOfLines={1}>
            {it.title}
          </AppText>
          <AppText style={styles.date} numberOfLines={1}>
            {it.date}
          </AppText>
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[4],
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  rowBorder: { borderBottomWidth: borderWidth.hairline, borderBottomColor: COLORS.gray200 },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: spacing[0.5] },
  title: { ...presets.labelMD, color: COLORS.gray900 },
  date: { ...presets.bodyXS, color: COLORS.gray500 },
});

export default RecentActivityCard;
