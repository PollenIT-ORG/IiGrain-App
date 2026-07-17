import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { COLORS, borderRadius, presets, spacing } from '../../constants';
import { formatDate, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { ActivityEntry } from '../../types/farm';

export interface TimelineProps {
  items: ActivityEntry[];
}

const Timeline: React.FC<TimelineProps> = ({ items }) => (
  <View>
    {items.map((item, index) => {
      const isLast = index === items.length - 1;
      return (
        <View key={item.id} style={styles.row}>
          <View style={styles.rail}>
            <View style={styles.node}>
              <AppIcon name={item.icon} size={moderateScale(16)} color={COLORS.primary} />
            </View>
            {!isLast ? <View style={styles.line} /> : null}
          </View>

          <View style={[styles.content, !isLast && styles.contentSpacing]}>
            <AppText style={styles.title} numberOfLines={1}>
              {item.title}
            </AppText>
            <AppText style={styles.description}>{item.description}</AppText>
            <AppText style={styles.date}>{formatDate(item.dateISO)}</AppText>
          </View>
        </View>
      );
    })}
  </View>
);

export default React.memo(Timeline);

const NODE_SIZE = scale(34);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  rail: {
    alignItems: 'center',
    width: NODE_SIZE,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    width: scale(2),
    backgroundColor: COLORS.gray300,
    marginVertical: spacing[1],
  },
  content: {
    flex: 1,
    paddingTop: spacing[1],
  },
  contentSpacing: {
    paddingBottom: spacing[5],
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  description: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[0.5],
  },
  date: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[1],
  },
});
