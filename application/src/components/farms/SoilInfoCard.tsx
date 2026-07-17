import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { formatDate, moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFieldSoilRecordThunk,
  setSoilField,
  selectSoilRecord,
  selectSoilLoading,
  selectSoilFieldId,
} from '../../redux/slices/soilSlice';
import type { SoilRecord } from '../../types/fieldDetails';

interface SoilRow {
  label: string;
  value: string;
}

const buildRows = (r: SoilRecord): SoilRow[] => {
  const rows: SoilRow[] = [];
  if (r.ph !== null) rows.push({ label: 'Soil pH', value: String(r.ph) });
  if (r.organicMatter !== null)
    rows.push({ label: 'Organic Matter', value: `${r.organicMatter}%` });
  if (r.nitrogen !== null) rows.push({ label: 'Nitrogen (N)', value: String(r.nitrogen) });
  if (r.phosphorus !== null) rows.push({ label: 'Phosphorus (P)', value: String(r.phosphorus) });
  if (r.potassium !== null) rows.push({ label: 'Potassium (K)', value: String(r.potassium) });
  if (r.moisture !== null) rows.push({ label: 'Moisture', value: `${r.moisture}%` });
  if (r.texture) rows.push({ label: 'Texture', value: r.texture });
  return rows;
};

export interface SoilInfoCardProps {
  fieldId: string;
}

const SoilInfoCard: React.FC<SoilInfoCardProps> = ({ fieldId }) => {
  const dispatch = useAppDispatch();
  const record = useAppSelector(selectSoilRecord);
  const loading = useAppSelector(selectSoilLoading);
  const soilFieldId = useAppSelector(selectSoilFieldId);

  useEffect(() => {
    dispatch(setSoilField(fieldId));
    dispatch(fetchFieldSoilRecordThunk(fieldId));
  }, [dispatch, fieldId]);

  const mine = soilFieldId === fieldId ? record : null;
  const rows = mine ? buildRows(mine) : [];

  if (loading && !mine) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!mine || (rows.length === 0 && !mine.notes && !mine.testedOnISO)) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon name={ICONS.SOIL} size={moderateScale(18)} color={COLORS.primary} />
        <AppText style={styles.title}>Soil Information</AppText>
      </View>

      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[styles.row, index < rows.length - 1 && styles.rowDivider]}>
          <AppText style={styles.rowLabel}>{row.label}</AppText>
          <AppText style={styles.rowValue}>{row.value}</AppText>
        </View>
      ))}

      {mine.testedOnISO ? (
        <AppText style={styles.foot}>Tested on {formatDate(mine.testedOnISO)}</AppText>
      ) : null}
      {mine.notes ? <AppText style={styles.notes}>{mine.notes}</AppText> : null}
    </View>
  );
};

export default React.memo(SoilInfoCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    padding: spacing[4],
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  rowDivider: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: COLORS.gray200,
  },
  rowLabel: {
    ...presets.bodySM,
    color: COLORS.gray600,
  },
  rowValue: {
    ...presets.labelSM,
    color: COLORS.gray900,
  },
  foot: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[2],
  },
  notes: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[1],
  },
});
