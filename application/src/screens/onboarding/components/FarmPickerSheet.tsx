import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { AppText, Button } from '../../../components';
import { AppIcon, ICONS } from '../../../components/AppIcon';
import { COLORS } from '../../../constants';
import { moderateScale } from '../../../utils';
import PickerSheet, {
  PickerRow,
  PickerSheetLoading,
  pickerStyles,
} from './PickerSheet';
import type { FarmRef } from '../useOnboardingData';

export interface FarmPickerSheetProps {
  visible: boolean;
  farms: FarmRef[];
  loading?: boolean;
  onSelect: (farm: FarmRef) => void;
  onAddFarm: () => void;
  onClose: () => void;
}

const metaLine = (farm: FarmRef): string =>
  [farm.location, farm.fieldCount === 1 ? '1 field' : `${farm.fieldCount} fields`]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ');

const FarmPickerSheet: React.FC<FarmPickerSheetProps> = ({
  visible,
  farms,
  loading = false,
  onSelect,
  onAddFarm,
  onClose,
}) => {
  const ordered = useMemo(
    () => [...farms].sort((a, b) => a.name.localeCompare(b.name)),
    [farms],
  );

  const empty = useMemo(
    () => ordered.filter(f => f.fieldCount === 0).length,
    [ordered],
  );

  const hint =
    ordered.length === 0
      ? 'Fields are added inside a farm.'
      : empty === 0
        ? 'Every farm has fields. Tap one to add another.'
        : `${empty} of ${ordered.length} have no fields yet.`;

  return (
    <PickerSheet
      visible={visible}
      title="Which farm is this field in?"
      hint={hint}
      onClose={onClose}>
      {loading && ordered.length === 0 ? (
        <PickerSheetLoading message="Loading your farms…" />
      ) : ordered.length === 0 ? (
        <View style={pickerStyles.empty}>
          <View style={pickerStyles.emptyIcon}>
            <AppIcon name={ICONS.FARM} size={moderateScale(26)} color={COLORS.primary} />
          </View>
          <AppText style={pickerStyles.emptyTitle}>No farms yet</AppText>
          <AppText style={pickerStyles.emptyText}>
            Add a farm first. Fields are always recorded inside one of your farms.
          </AppText>
          <Button
            title="Add a farm"
            onPress={onAddFarm}
            style={pickerStyles.emptyAction}
          />
        </View>
      ) : (
        <ScrollView
          style={pickerStyles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {ordered.map(farm => (
            <PickerRow
              key={farm.id}
              title={farm.name}
              meta={metaLine(farm)}
              icon={ICONS.FARM}
              done={farm.fieldCount > 0}
              badge={
                farm.fieldCount === 0
                  ? { label: 'No fields yet', tone: 'todo' }
                  : undefined
              }
              accessibilityLabel={`Add a field to ${farm.name}`}
              onPress={() => onSelect(farm)}
            />
          ))}
        </ScrollView>
      )}
    </PickerSheet>
  );
};

export default React.memo(FarmPickerSheet);
