/**
 * src/maps/boundary/components/BoundaryToolbar.tsx — the mode-driven bottom bar.
 *
 * Contents change with the editor mode (docs/maps/FarmBoundary/UX.md §7). Pure
 * presentation: it renders buttons and calls back; it holds no boundary state.
 * The area chip is always present while drawing/editing.
 */

import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../../components/AppIcon';
import AppText from '../../../components/AppText/AppText';
import Button from '../../../components/Button/Button';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';
import AreaReadout from './AreaReadout';
import type { AreaUnit } from '../../utils/geo';
import type { BoundaryMode } from '../types';

export interface BoundaryToolbarProps {
  mode: BoundaryMode;
  hasBoundary: boolean;
  selectedVertex: number | null;
  insertMode: boolean;
  areaSqM: number;
  vertexCount: number;
  unit: AreaUnit;
  canUndo: boolean;
  canRedo: boolean;
  canClose: boolean;
  canSave: boolean;
  saving: boolean;
  /** First failing validation reason, shown when Save is disabled. */
  invalidReason: string | null;

  onCycleUnit: (next: AreaUnit) => void;
  onStartDraw: () => void;
  onStartEdit: () => void;
  onDeleteBoundary: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleInsert: () => void;
  onDeleteVertex: () => void;
  onDeselect: () => void;
  onClose: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/** A small circular icon button used for undo/redo/insert. */
const RoundButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}> = ({ icon, label, onPress, disabled, active }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.round, active && styles.roundActive, disabled && styles.roundDisabled]}>
    <AppIcon
      name={icon}
      size={moderateScale(20)}
      color={active ? COLORS.white : disabled ? COLORS.gray300 : COLORS.primary}
    />
  </Pressable>
);

const BoundaryToolbar: React.FC<BoundaryToolbarProps> = props => {
  const insets = useSafeAreaInsets();
  const wrap: ViewStyle = {
    paddingBottom: insets.bottom + spacing[3],
  };

  // ── VIEW ──
  if (props.mode === 'view') {
    return (
      <View style={[styles.bar, wrap]}>
        <Button
          title={props.hasBoundary ? 'Edit boundary' : 'Draw field boundary'}
          onPress={props.hasBoundary ? props.onStartEdit : props.onStartDraw}
        />
        {props.hasBoundary ? (
          <Pressable
            onPress={props.onDeleteBoundary}
            style={styles.viewDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete boundary">
            <AppIcon name="delete-outline" size={moderateScale(20)} color={COLORS.danger} />
            <AppText style={styles.viewDeleteText}>Delete boundary</AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const selected = props.selectedVertex !== null;

  // ── DRAW / EDIT (+ selected sub-state) ──
  return (
    <View style={[styles.bar, wrap]}>
      {props.invalidReason && props.mode === 'edit' ? (
        <View style={styles.reason}>
          <AppIcon name="alert-circle-outline" size={moderateScale(15)} color={COLORS.danger} />
          <AppText style={styles.reasonText}>{props.invalidReason}</AppText>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.leftGroup}>
          <RoundButton icon="undo-variant" label="Undo" onPress={props.onUndo} disabled={!props.canUndo} />
          <RoundButton icon="redo-variant" label="Redo" onPress={props.onRedo} disabled={!props.canRedo} />

          {props.mode === 'edit' && !selected ? (
            <RoundButton
              icon="map-marker-plus-outline"
              label="Insert points"
              onPress={props.onToggleInsert}
              active={props.insertMode}
            />
          ) : null}
          {props.mode === 'edit' && selected ? (
            <RoundButton icon="delete-outline" label="Delete point" onPress={props.onDeleteVertex} />
          ) : null}
        </View>

        <AreaReadout
          areaSqM={props.areaSqM}
          unit={props.unit}
          onCycleUnit={props.onCycleUnit}
          vertexCount={props.vertexCount}
        />
      </View>

      <View style={styles.row}>
        <Button title="Cancel" variant="outline" onPress={props.onCancel} style={styles.flexBtn} />
        {props.mode === 'draw' ? (
          <Button
            title="Close shape"
            onPress={props.onClose}
            disabled={!props.canClose}
            style={styles.flexBtn}
          />
        ) : selected ? (
          <Button title="Deselect" variant="outline" onPress={props.onDeselect} style={styles.flexBtn} />
        ) : (
          <Button
            title="Save"
            onPress={props.onSave}
            disabled={!props.canSave}
            loading={props.saving}
            style={styles.flexBtn}
          />
        )}
      </View>
    </View>
  );
};

export default React.memo(BoundaryToolbar);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  flexBtn: { flex: 1 },

  round: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  roundActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roundDisabled: { backgroundColor: COLORS.gray100, borderColor: COLORS.gray100 },

  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.danger, 0.08),
  },
  reasonText: { ...presets.caption, color: COLORS.danger, flex: 1 },

  viewDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  viewDeleteText: { ...presets.labelMD, color: COLORS.danger },
});
