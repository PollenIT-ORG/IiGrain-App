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
import { addAlpha, scale } from '../../utils';
import { AppIcon, ICON_SIZE, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import DangerButton from './DangerButton';
import WarningList from './WarningList';

export interface DangerZoneCardProps {
  items: string[];
  onDelete: () => void;
  title?: string;
  description?: string;
  buttonLabel?: string;
}

const DangerZoneCard: React.FC<DangerZoneCardProps> = ({
  items,
  onDelete,
  title = 'Delete Account',
  description = 'Permanently remove your iiGrain account. Once deleted, the following can never be recovered:',
  buttonLabel = 'Delete Account',
}) => (
  <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.iconCircle}>
        <AppIcon name={ICONS.WARNING} size={ICON_SIZE.md} color={COLORS.danger} />
      </View>
      <AppText style={styles.title}>{title}</AppText>
    </View>

    <AppText style={styles.description}>{description}</AppText>

    <WarningList items={items} style={styles.list} />

    <View style={styles.noteRow}>
      <AppIcon name={ICONS.ERROR} size={ICON_SIZE.xs} color={COLORS.danger} />
      <AppText style={styles.note}>This action cannot be undone.</AppText>
    </View>

    <DangerButton title={buttonLabel} onPress={onDelete} style={styles.button} />
  </View>
);

export default React.memo(DangerZoneCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: addAlpha(COLORS.danger, 0.05),
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.danger, 0.22),
    padding: spacing[5],
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.danger, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  description: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginBottom: spacing[4],
  },
  list: {
    marginBottom: spacing[4],
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[5],
  },
  note: {
    ...presets.labelMD,
    color: COLORS.danger,
  },
  button: {
    width: '100%',
  },
});
