import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { styles } from './FarmSelectorCardStyle';

export interface FarmSelectorCardProps {
  farmName: string;
  fieldCount?: number;
  farmCount: number;
  loading?: boolean;
  onPress: () => void;
}

const FarmSelectorCard: React.FC<FarmSelectorCardProps> = ({
  farmName,
  fieldCount,
  farmCount,
  loading = false,
  onPress,
}) => {
  const switchable = farmCount > 1 && !loading;

  const meta = loading
    ? 'Loading your farms…'
    : [
        fieldCount !== undefined
          ? `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`
          : null,
        switchable ? `Tap to switch · ${farmCount} farms` : 'Your only farm',
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!switchable}
      accessibilityRole="button"
      accessibilityLabel={
        switchable ? `Viewing ${farmName}. Tap to switch farm.` : `Viewing ${farmName}`
      }
      accessibilityState={{ disabled: !switchable }}
      style={({ pressed }) => [styles.card, pressed && switchable && styles.pressed]}>
      <View style={styles.iconTile}>
        <AppIcon name={ICONS.FARM} size={moderateScale(22)} color={COLORS.primary} />
      </View>

      <View style={styles.texts}>
        <AppText style={styles.overline}>VIEWING FARM</AppText>
        <AppText style={styles.name} numberOfLines={1}>
          {farmName}
        </AppText>
        <AppText style={styles.meta} numberOfLines={1}>
          {meta}
        </AppText>
      </View>

      {switchable ? (
        <View style={styles.chevron}>
          <AppIcon
            name={ICONS.CHEVRON_DOWN}
            size={moderateScale(18)}
            color={COLORS.primary}
          />
        </View>
      ) : null}
    </Pressable>
  );
};

export default memo(FarmSelectorCard);
