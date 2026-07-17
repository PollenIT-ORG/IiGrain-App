import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { scale } from '../../utils';
import { AppIcon, ICON_SIZE } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppStatusBadge from '../AppStatusBadge/AppStatusBadge';
import type { AccountInfoItem } from './types';

export interface AccountInfoCardProps {
  items: AccountInfoItem[];
}

const AccountInfoRow: React.FC<{ item: AccountInfoItem; showBorder: boolean }> = ({
  item,
  showBorder,
}) => (
  <View style={[styles.row, showBorder && styles.rowBorder]}>
    <View style={styles.iconTile}>
      <AppIcon name={item.icon} size={ICON_SIZE.sm} color={COLORS.primary} />
    </View>

    <View style={styles.textWrap}>
      <AppText style={styles.label}>{item.label}</AppText>
      {item.badge ? (
        <AppStatusBadge
          status={item.badge.status}
          label={item.badge.label}
          size="sm"
          style={styles.badge}
        />
      ) : (
        <AppText
          style={[styles.value, item.muted && styles.valueMuted]}
          numberOfLines={1}>
          {item.value ?? '-'}
        </AppText>
      )}
    </View>
  </View>
);

const AccountInfoCard: React.FC<AccountInfoCardProps> = ({ items }) => (
  <View style={styles.card}>
    {items.map((item, index) => (
      <AccountInfoRow
        key={item.id}
        item={item}
        showBorder={index < items.length - 1}
      />
    ))}
  </View>
);

export default React.memo(AccountInfoCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    overflow: 'hidden',
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  rowBorder: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray200,
  },
  iconTile: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    marginBottom: spacing[0.5],
  },
  value: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  valueMuted: {
    color: COLORS.gray500,
  },
  badge: {
    marginTop: spacing[0.5],
  },
});
