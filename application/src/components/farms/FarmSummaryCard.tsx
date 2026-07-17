import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { formatNumber, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import StatusBadge from './StatusBadge';
import InfoRow from './InfoRow';
import { FARM_STATUS_META, type Farm } from '../../types/farm';

export interface FarmSummaryCardProps {
  farm: Farm;
  fieldsCount?: number;
}

const FarmSummaryCard: React.FC<FarmSummaryCardProps> = ({ farm, fieldsCount }) => {
  const statusMeta = FARM_STATUS_META[farm.status];
  const resolved = fieldsCount ?? (farm.fieldsCount || undefined);
  const fieldsValue = resolved === undefined ? '-' : `${resolved}`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <AppIcon name={ICONS.FARM} size={moderateScale(26)} color={COLORS.primary} />
        </View>
        <View style={styles.identity}>
          <AppText style={styles.name} numberOfLines={1}>
            {farm.name}
          </AppText>
          <AppText style={styles.owner} numberOfLines={1}>
            Owned by {farm.ownerName}
          </AppText>
        </View>
        <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
      </View>

      <View style={styles.info}>
        <InfoRow icon="map-marker-outline" label="Location" value={farm.location} />
        <InfoRow
          icon="vector-square"
          label="Total Area"
          value={`${formatNumber(farm.areaAcres)} acres`}
        />
        <InfoRow
          icon="view-grid-outline"
          label="Fields"
          value={fieldsValue}
        />
      </View>
    </View>
  );
};

export default React.memo(FarmSummaryCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    gap: spacing[0.5],
  },
  name: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  owner: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  info: {
    marginTop: spacing[2],
  },
});
