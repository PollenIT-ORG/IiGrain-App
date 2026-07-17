import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import { AnimatedTabBar, AppText } from '../../components';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, formatNumber, moderateScale, scale } from '../../utils';
import EmptyState from './EmptyState';
import type { Field } from '../../types/farm';
import { FieldChips } from './FieldChips';

export interface FieldMapViewProps {
  farmName: string;
  fields: Field[];
  onOpenField: (fieldId: string) => void;
}

type FieldMapTab = 'selector' | 'parcels';

interface DecoratedField {
  field: Field;
  color: string;
  fill: ViewStyle;
  marker: ViewStyle;
}

const PALETTE = [COLORS.accent, COLORS.info, COLORS.secondary, COLORS.primary];

const MAP_TABS: { key: FieldMapTab; label: string }[] = [
  { key: 'selector', label: 'Fields' },
  { key: 'parcels', label: 'Parcels' },
];

const MAP_HEIGHT = scale(330);
const MARKER_SIZE = scale(28);
const CARD_ACTION_HIT_SLOP = {
  top: spacing[2],
  right: spacing[2],
  bottom: spacing[2],
  left: spacing[2],
} as const;

const POSITIONS: ViewStyle[] = [
  { top: '6%', left: '5%', width: '44%', height: '50%' },
  { top: '9%', left: '52%', width: '43%', height: '40%' },
  { top: '58%', left: '6%', width: '41%', height: '36%' },
  { top: '45%', left: '50%', width: '45%', height: '49%' },
];

const FieldMapView: React.FC<FieldMapViewProps> = ({ farmName, fields, onOpenField }) => {
  const [selectedId, setSelectedId] = useState(fields[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<FieldMapTab>('selector');

  const decorated = useMemo<DecoratedField[]>(
    () =>
      fields.map((field, index) => {
        const color = PALETTE[index % PALETTE.length];

        return {
          field,
          color,
          fill: {
            backgroundColor: addAlpha(color, 0.32),
            borderColor: color,
          },
          marker: { borderColor: color },
        };
      }),
    [fields],
  );
  const selectedField = useMemo(
    () => fields.find(field => field.id === selectedId) ?? fields[0],
    [fields, selectedId],
  );

  const handleSelect = useCallback((fieldId: string) => {
    setSelectedId(fieldId);
  }, []);

  const handleOpen = useCallback(
    (fieldId: string) => {
      setSelectedId(fieldId);
      onOpenField(fieldId);
    },
    [onOpenField],
  );

  if (fields.length === 0) {
    return (
      <EmptyState
        icon="map-outline"
        title="No fields to map"
        message="Add fields to this farm to see them on the map."
      />
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}>
      <View style={styles.farmRow}>
        <AppIcon name={ICONS.FARM} size={moderateScale(18)} color={COLORS.primary} />
        <AppText style={styles.farmName} numberOfLines={1}>
          {farmName}
        </AppText>
        <AppText style={styles.fieldCount}>{fields.length} fields</AppText>
      </View>

      <View style={styles.map}>
        <View style={styles.backdrop}>
          <View style={styles.blobA} />
          <View style={styles.blobB} />
          <View style={styles.roadA} />
          <View style={styles.roadB} />
        </View>

        {decorated.map((item, index) => {
          const selected = item.field.id === selectedId;

          return (
            <Pressable
              key={item.field.id}
              onPress={() => handleOpen(item.field.id)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.field.name}`}
              style={({ pressed }) => [
                styles.parcel,
                POSITIONS[index % POSITIONS.length],
                item.fill,
                selected && styles.parcelSelected,
                pressed && styles.parcelPressed,
              ]}>
              <View style={[styles.marker, item.marker]}>
                <AppText style={styles.markerText} color={item.color}>
                  {index + 1}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedField ? (
        <View style={styles.selectedFieldCard}>
          <AppText style={styles.selectedFieldTitle} numberOfLines={1}>
            {selectedField.name}
          </AppText>
          <AppText style={styles.selectedFieldMeta} numberOfLines={1}>
            {formatNumber(selectedField.areaAcres)} acres | {selectedField.crop}
          </AppText>
          <AppText style={styles.selectedFieldFarm} numberOfLines={1}>
            {farmName}
          </AppText>
        </View>
      ) : null}

        <FieldChips
          fields={fields}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
    </ScrollView>
  );
};

export default React.memo(FieldMapView);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  farmName: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  fieldCount: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  map: {
    height: MAP_HEIGHT,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.primaryDark,
    overflow: 'hidden',
    ...shadows.sm,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primaryDark,
  },
  blobA: {
    position: 'absolute',
    top: -scale(40),
    right: -scale(30),
    width: scale(200),
    height: scale(200),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.secondary, 0.35),
  },
  blobB: {
    position: 'absolute',
    bottom: -scale(50),
    left: -scale(40),
    width: scale(220),
    height: scale(220),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.45),
  },
  roadA: {
    position: 'absolute',
    top: '46%',
    left: -scale(20),
    right: -scale(20),
    height: scale(3),
    backgroundColor: addAlpha(COLORS.white, 0.3),
  },
  roadB: {
    position: 'absolute',
    top: -scale(20),
    bottom: -scale(20),
    left: '49%',
    width: scale(3),
    backgroundColor: addAlpha(COLORS.white, 0.25),
  },
  parcel: {
    position: 'absolute',
    borderRadius: borderRadius.md,
    borderWidth: borderWidth.thick,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelSelected: {
    borderWidth: scale(3),
  },
  parcelPressed: {
    opacity: 0.82,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.medium,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  markerText: {
    ...presets.labelMD,
  },
  hint: {
    ...presets.bodyXS,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  tabBar: {
    marginTop: 0,
  },
  selectedFieldCard: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    marginTop: spacing[3],
    ...shadows.sm,
  },
  selectedFieldTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  selectedFieldMeta: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[0.5],
  },
  selectedFieldFarm: {
    ...presets.bodySM,
    color: COLORS.primary,
    marginTop: spacing[0.5],
  },
  parcelList: {
    gap: spacing[3],
    paddingTop: spacing[3],
  },
  parcelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[3],
    ...shadows.sm,
  },
  parcelCardSelected: {
    borderWidth: borderWidth.medium,
    backgroundColor: COLORS.gray100,
  },
  parcelCardPressed: {
    opacity: 0.94,
  },
  parcelBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcelBadgeText: {
    ...presets.labelMD,
    color: COLORS.white,
  },
  parcelCardBody: {
    flex: 1,
    gap: spacing[0.5],
  },
  parcelCardTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  parcelCardMeta: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  openButton: {
    width: scale(32),
    height: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
