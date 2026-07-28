import React, { memo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { styles } from './EntityDangerZoneStyle';

export interface EntityDangerZoneProps {
  /** Singular noun used in the copy, e.g. "farm" or "field". */
  entity: string;
  onReset: () => void;
  onDelete: () => void;
  resetting?: boolean;
  deleting?: boolean;
  /** Overrides the delete row's description when the guards differ. */
  deleteHint?: string;
}

interface ActionRowProps {
  icon: string;
  title: string;
  description: string;
  tone: 'neutral' | 'danger';
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

const HIT_SLOP = { top: 6, right: 6, bottom: 6, left: 6 } as const;

const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  title,
  description,
  tone,
  loading,
  disabled,
  onPress,
}) => {
  const isDanger = tone === 'danger';
  const accent = isDanger ? COLORS.danger : COLORS.gray700;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        (disabled || loading) && styles.rowDisabled,
      ]}>
      <View style={[styles.rowIcon, isDanger && styles.rowIconDanger]}>
        <AppIcon name={icon} size={moderateScale(18)} color={accent} />
      </View>

      <View style={styles.rowTexts}>
        <AppText style={[styles.rowTitle, isDanger && styles.rowTitleDanger]}>
          {title}
        </AppText>
        <AppText style={styles.rowDescription}>{description}</AppText>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(18)} color={accent} />
      )}
    </Pressable>
  );
};

const EntityDangerZone: React.FC<EntityDangerZoneProps> = ({
  entity,
  onReset,
  onDelete,
  resetting = false,
  deleting = false,
  deleteHint,
}) => (
  <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <AppIcon name="shield-alert-outline" size={moderateScale(16)} color={COLORS.danger} />
      </View>
      <View style={styles.headerTexts}>
        <AppText style={styles.title}>Danger Zone</AppText>
        <AppText style={styles.subtitle}>
          {`These actions change or remove this ${entity}.`}
        </AppText>
      </View>
    </View>

    <View style={styles.rows}>
      <ActionRow
        icon="restore"
        title={`Reset ${entity}`}
        description={`Clears the details but keeps the name. Assessments and soil records stay untouched.`}
        tone="neutral"
        loading={resetting}
        disabled={deleting}
        onPress={onReset}
      />

      <View style={styles.divider} />

      <ActionRow
        icon={ICONS.DELETE}
        title={`Delete ${entity}`}
        description={
          deleteHint ??
          `Removes this ${entity}. Blocked once it has a submitted assessment or is enrolled in a program.`
        }
        tone="danger"
        loading={deleting}
        disabled={resetting}
        onPress={onDelete}
      />
    </View>
  </View>
);

export default memo(EntityDangerZone);
