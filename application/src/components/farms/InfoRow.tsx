import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { COLORS, borderWidth, presets, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';

export interface InfoRowProps {
  label: string;
  value: string;
  icon?: string;
  last?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon, last = false }) => (
  <View style={[styles.row, !last && styles.divider]}>
    <View style={styles.left}>
      {icon ? (
        <AppIcon name={icon} size={moderateScale(18)} color={COLORS.gray500} />
      ) : null}
      <AppText style={styles.label} numberOfLines={1}>
        {label}
      </AppText>
    </View>
    <AppText style={styles.value} numberOfLines={1}>
      {value}
    </AppText>
  </View>
);

export default React.memo(InfoRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  divider: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 1,
  },
  label: {
    ...presets.bodySM,
    color: COLORS.gray700,
    flexShrink: 1,
  },
  value: {
    ...presets.labelMD,
    color: COLORS.gray900,
    maxWidth: scale(180),
    textAlign: 'right',
  },
});
