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
  fonts,
  presets,
  shadows,
  spacing,
} from '../../../constants';
import { addAlpha, moderateScale, scale } from '../../../utils';
import BoundaryStats from './BoundaryStats';
import type { AreaUnit } from '../../utils/geo';
import type { BoundaryMode } from '../types';

export type BoundaryStatusTone = 'info' | 'danger';

export interface BoundaryToolbarProps {
  mode: BoundaryMode;
  hasBoundary: boolean;
  hasSelection: boolean;
  status: string;
  statusTone: BoundaryStatusTone;
  areaSqM: number;
  perimeterM: number;
  vertexCount: number;
  unit: AreaUnit;
  canUndo: boolean;
  canRedo: boolean;
  canClose: boolean;
  canDelete: boolean;
  canAddPoint: boolean;
  canSave: boolean;
  saving: boolean;
  saveLabel?: string;

  onCycleUnit: (next: AreaUnit) => void;
  onStartDraw: () => void;
  onStartEdit: () => void;
  onDeleteBoundary: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPoint: () => void;
  onDeleteVertex: () => void;
  onClose: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const QuickAction: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}> = ({ icon, label, onPress, disabled, tone = 'neutral' }) => {
  const color = disabled
    ? COLORS.gray300
    : tone === 'danger'
      ? COLORS.danger
      : COLORS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.action,
        tone === 'danger' && !disabled && styles.actionDanger,
        pressed && !disabled && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}>
      <AppIcon name={icon} size={moderateScale(18)} color={color} />
      <AppText style={[styles.actionLabel, { color }]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
};

const BoundaryToolbar: React.FC<BoundaryToolbarProps> = props => {
  const insets = useSafeAreaInsets();
  const wrap: ViewStyle = { paddingBottom: insets.bottom + spacing[3] };

  if (props.mode === 'view') {
    return (
      <View style={[styles.bar, wrap]}>
        {props.hasBoundary ? (
          <BoundaryStats
            vertexCount={props.vertexCount}
            areaSqM={props.areaSqM}
            perimeterM={props.perimeterM}
            unit={props.unit}
            onCycleUnit={props.onCycleUnit}
          />
        ) : null}
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

  const danger = props.statusTone === 'danger';

  return (
    <View style={[styles.bar, wrap]}>
      <View style={[styles.status, danger && styles.statusDanger]}>
        <AppIcon
          name={danger ? 'alert-circle-outline' : 'gesture-tap'}
          size={moderateScale(15)}
          color={danger ? COLORS.danger : COLORS.primary}
        />
        <AppText
          style={[styles.statusText, danger && styles.statusTextDanger]}
          numberOfLines={2}>
          {props.status}
        </AppText>
      </View>

      <View style={styles.actions}>
        <QuickAction
          icon="undo-variant"
          label="Undo"
          onPress={props.onUndo}
          disabled={!props.canUndo}
        />
        <QuickAction
          icon="redo-variant"
          label="Redo"
          onPress={props.onRedo}
          disabled={!props.canRedo}
        />
        {props.mode === 'edit' ? (
          <>
            <QuickAction
              icon="plus-circle-outline"
              label="Add point"
              onPress={props.onAddPoint}
              disabled={!props.canAddPoint}
            />
            <QuickAction
              icon="delete-outline"
              label="Delete"
              tone="danger"
              onPress={props.onDeleteVertex}
              disabled={!props.hasSelection || !props.canDelete}
            />
          </>
        ) : null}
      </View>

      <BoundaryStats
        vertexCount={props.vertexCount}
        areaSqM={props.areaSqM}
        perimeterM={props.perimeterM}
        unit={props.unit}
        onCycleUnit={props.onCycleUnit}
      />

      <View style={styles.row}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={props.onCancel}
          style={styles.flexBtn}
        />
        {props.mode === 'draw' ? (
          <Button
            title="Finish drawing"
            onPress={props.onClose}
            disabled={!props.canClose}
            style={styles.flexBtn}
          />
        ) : (
          <Button
            title={props.saveLabel ?? 'Save'}
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
    gap: spacing[2],
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flexBtn: { flex: 1 },

  actions: { flexDirection: 'row', alignItems: 'stretch', gap: spacing[2] },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(3),
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
  },
  actionPressed: { backgroundColor: COLORS.lightPrimary },
  actionDanger: { borderColor: addAlpha(COLORS.danger, 0.35) },
  actionDisabled: { backgroundColor: COLORS.gray100, borderColor: COLORS.gray100 },
  actionLabel: { ...presets.caption, fontFamily: fonts.semibold },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
  },
  statusDanger: { backgroundColor: addAlpha(COLORS.danger, 0.1) },
  statusText: { ...presets.caption, color: COLORS.primaryDark, flex: 1 },
  statusTextDanger: { color: COLORS.danger },

  viewDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  viewDeleteText: { ...presets.labelMD, color: COLORS.danger },
});
