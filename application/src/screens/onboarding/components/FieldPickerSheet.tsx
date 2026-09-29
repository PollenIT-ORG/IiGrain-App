import React, { useMemo } from 'react';
import { formatAcres } from '../../../maps/utils/fieldAcres';
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
import type { FieldRef } from '../useOnboardingData';

export interface FieldPickerSheetProps {
  visible: boolean;
  fields: FieldRef[];
  loading?: boolean;
  onSelect: (field: FieldRef) => void;
  onAddField: () => void;
  onClose: () => void;
}

const metaLine = (field: FieldRef): string =>
  [field.farmName, field.crop, field.areaAcres > 0 ? `${formatAcres(field.areaAcres)} ac` : '']
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ');

const FieldPickerSheet: React.FC<FieldPickerSheetProps> = ({
  visible,
  fields,
  loading = false,
  onSelect,
  onAddField,
  onClose,
}) => {
  const ordered = useMemo(
    () =>
      [...fields].sort((a, b) => {
        if (a.hasBoundary !== b.hasBoundary) {
          return a.hasBoundary ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      }),
    [fields],
  );

  const remaining = useMemo(
    () => ordered.filter(f => !f.hasBoundary).length,
    [ordered],
  );

  const hint =
    ordered.length === 0
      ? 'Boundaries are drawn per field.'
      : remaining === 0
        ? 'Every field already has a boundary.'
        : `${remaining} of ${ordered.length} still need a boundary.`;

  return (
    <PickerSheet
      visible={visible}
      title="Choose a field to map"
      hint={hint}
      onClose={onClose}>
      {loading && ordered.length === 0 ? (
        <PickerSheetLoading message="Loading your fields…" />
      ) : ordered.length === 0 ? (
        <View style={pickerStyles.empty}>
          <View style={pickerStyles.emptyIcon}>
            <AppIcon name={ICONS.FIELD} size={moderateScale(26)} color={COLORS.primary} />
          </View>
          <AppText style={pickerStyles.emptyTitle}>No fields yet</AppText>
          <AppText style={pickerStyles.emptyText}>
            Add a field first, then come back here to draw its boundary on the map.
          </AppText>
          <Button
            title="Add a field"
            onPress={onAddField}
            style={pickerStyles.emptyAction}
          />
        </View>
      ) : (
        <ScrollView
          style={pickerStyles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {ordered.map(field => (
            <PickerRow
              key={field.id}
              title={field.name}
              meta={metaLine(field)}
              icon={field.hasBoundary ? ICONS.MAP_CHECK : 'vector-polygon'}
              done={field.hasBoundary}
              badge={{
                label: field.hasBoundary ? 'Boundary drawn' : 'Not drawn yet',
                tone: field.hasBoundary ? 'done' : 'todo',
              }}
              disabled={field.hasBoundary}
              accessibilityLabel={
                field.hasBoundary
                  ? `${field.name}. Boundary drawn`
                  : `Draw boundary for ${field.name}`
              }
              onPress={() => onSelect(field)}
            />
          ))}
        </ScrollView>
      )}
    </PickerSheet>
  );
};

export default React.memo(FieldPickerSheet);
