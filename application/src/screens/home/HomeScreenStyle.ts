import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    flexGrow: 1,
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  loaderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[6],
    height: '100%',
    width:"100%",
  },
  loaderScene: {
    width: '100%',
  },
  loaderText: {
    ...presets.labelLG,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  greeting: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flexShrink: 1,
    marginRight: spacing[2],
  },
  recommendationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingLeft: spacing[1],
    paddingRight: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    ...shadows.sm,
  },
  recommendationsIcon: {
    width: scale(22),
    height: scale(22),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationsText: {
    ...presets.labelSM,
    color: COLORS.gray900,
  },
  morningRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  farmName: {
    ...presets.labelLG,
    color: COLORS.primary,
    flexShrink: 1,
  },
  visitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.lightPrimary,
    backgroundColor: COLORS.lightPrimaryBg,
    ...shadows.sm,
  },
  visitBannerIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitBannerTexts: { flex: 1, gap: spacing[0.5] },
  visitBannerTitle: { ...presets.labelLG, color: COLORS.gray900 },
  visitBannerSub: { ...presets.caption, color: COLORS.gray600 },
  visitBannerCta: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5] },
  visitBannerCtaText: { ...presets.labelSM, color: COLORS.primary },
  section: {
    marginTop: spacing[5],
  },
  upcomingList: {
    gap: spacing[3],
  },
  sectionTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginBottom: spacing[3],
  },

  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingTop: spacing[16],
    paddingHorizontal: spacing[6],
  },
  stateTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  stateMsg: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  retry: {
    minWidth: scale(160),
    marginTop: spacing[2],
  },
});
