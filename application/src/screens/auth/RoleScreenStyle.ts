import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: scale(24),
    paddingVertical: spacing[8],
  },

  grid: {
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },

  card: {
    minHeight: scale(132),
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: COLORS.gray300,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  cardHalf: {
    flex: 1,
  },
  cardFull: {
    width: '100%',
  },
  cardActive: {
    borderColor: COLORS.primary,
    borderWidth: borderWidth.medium,
    backgroundColor: COLORS.white,
    ...shadows.md,
  },

  checkBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: scale(22),
    height: scale(22),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconCircle: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  iconCircleActive: {
    backgroundColor: COLORS.lightPrimaryBg,
  },
    iconCircleInActive: {
    backgroundColor: COLORS.lightPrimaryBg,
  },

  cardLabel: {
    ...presets.headingXS,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  cardLabelActive: {
    color: COLORS.primary,
  },
  cardDescription: {
    ...presets.bodyXS,
    marginTop: spacing[1],
    color: COLORS.gray700,
    textAlign: 'center',
  },

  errorBanner: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.danger,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    marginTop: spacing[4],
  },
  errorText: {
    ...presets.bodyXS,
    color: COLORS.danger,
  },

  submit: {
    marginTop: spacing[6],
  },

  backRow: {
    alignSelf: 'center',
    marginTop: spacing[5],
  },
  backText: {
    ...presets.linkText,
    color: COLORS.primary,
  },
});
