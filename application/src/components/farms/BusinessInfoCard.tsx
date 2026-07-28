import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import InfoRow from './InfoRow';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export interface BusinessInfoCardProps {
  businessEntity?: string | null;
  orgName?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  /** Opens the farm editor so the missing details can be filled in. */
  onEdit?: () => void;
}

const EDIT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const hasText = (value?: string | null): boolean => !!value && value.trim().length > 0;

/**
 * Business side of a farm — the legal entity it trades as and who it belongs to.
 * These come from the farm editor and are frequently left blank, so the card
 * leads with a proper empty state rather than showing four "Not added" rows.
 */
const BusinessInfoCard: React.FC<BusinessInfoCardProps> = ({
  businessEntity,
  orgName,
  ownerName,
  ownerEmail,
  onEdit,
}) => {
  // Owner is always populated on a farm, so it cannot decide this. The empty
  // state keys off the business identity itself — the part users actually leave
  // blank — and the owner rows still render underneath it.
  const hasEntity = hasText(businessEntity) || hasText(orgName);
  const isEmpty = useMemo(
    () => ![businessEntity, orgName, ownerName, ownerEmail].some(hasText),
    [businessEntity, orgName, ownerName, ownerEmail],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon
            name={ICONS.BUSINESS}
            size={moderateScale(20)}
            color={COLORS.primary}
          />
        </View>
        <View style={styles.headerTexts}>
          <AppText style={styles.title}>Business Details</AppText>
          <AppText style={styles.subtitle} numberOfLines={1}>
            {hasEntity ? 'Entity and ownership' : 'Nothing added yet'}
          </AppText>
        </View>
        {onEdit && hasEntity ? (
          <Pressable
            onPress={onEdit}
            hitSlop={EDIT_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Edit business details"
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
            <AppIcon
              name={ICONS.EDIT}
              size={moderateScale(16)}
              color={COLORS.primary}
            />
          </Pressable>
        ) : null}
      </View>

      {hasEntity ? null : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <AppIcon
              name={ICONS.BUSINESS}
              size={moderateScale(26)}
              color={COLORS.gray500}
            />
          </View>
          <AppText style={styles.emptyTitle}>No business details yet</AppText>
          <AppText style={styles.emptyText}>
            Add the entity this farm trades as so reports and assessments carry
            the right details.
          </AppText>
          {onEdit ? (
            <Button
              title="Add Business Details"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={onEdit}
              style={styles.emptyBtn}
              leftIcon={
                <AppIcon
                  name={ICONS.PLUS}
                  size={moderateScale(16)}
                  color={COLORS.primary}
                />
              }
            />
          ) : null}
        </View>
      )}

      {isEmpty ? null : (
        <View style={[styles.rows, !hasEntity && styles.rowsDivided]}>
          {hasEntity ? (
            <>
              <InfoRow
                icon={ICONS.BUSINESS}
                label="Business Entity"
                value={businessEntity}
                placeholder="Not added"
              />
              <InfoRow
                icon={ICONS.ORGANIZATION}
                label="Organization"
                value={orgName}
                placeholder="Not linked"
              />
            </>
          ) : null}
          <InfoRow
            icon={ICONS.USER}
            label="Owner"
            value={ownerName}
            placeholder="Not added"
          />
          <InfoRow
            icon={ICONS.EMAIL}
            label="Owner Email"
            value={ownerEmail}
            placeholder="Not added"
            last
          />
        </View>
      )}
    </View>
  );
};

export default React.memo(BusinessInfoCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1, gap: spacing[0.5] },
  title: { ...presets.headingSM, color: COLORS.gray900 },
  subtitle: { ...presets.bodyXS, color: COLORS.gray500 },
  editBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: addAlpha(COLORS.primary, 0.1),
  },
  pressed: { opacity: 0.7 },
  rows: { marginTop: spacing[2] },
  rowsDivided: {
    marginTop: spacing[4],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray200,
    paddingTop: spacing[1],
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[2],
  },
  emptyIcon: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  emptyTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  emptyText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: spacing[1.5],
  },
  emptyBtn: {
    marginTop: spacing[4],
    minWidth: moderateScale(200),
  },
});
