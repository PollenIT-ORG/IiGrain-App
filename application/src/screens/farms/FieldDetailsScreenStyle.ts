import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { addAlpha, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[10],
  },

  mapContainer: {
    backgroundColor: COLORS.white,
    padding: spacing[4],
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: COLORS.gray200,
  },
  mapBox: {
    height: scale(240),
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.primaryDark,
    overflow: 'hidden',
    ...shadows.sm,
  },
  mapEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  mapEmptyText: {
    ...presets.bodySM,
    color: COLORS.gray300,
  },

  chipScroll: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[2.5],
  },

  filterBar: {
    borderRadius: borderRadius.lg,
    padding: scale(4),
    marginBottom: spacing[4],
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    ...shadows.sm,
  },
  filterText: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  filterTextActive: {
    color: COLORS.white,
  },

  tabBodyContainer: {
    paddingHorizontal: spacing[4],
  },
  tabAnimateWrap: {
    gap: spacing[4],
  },
  overviewHero: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  heroTitle: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  heroSub: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: scale(2),
  },
  heroCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: spacing[3],
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  heroCoordsText: {
    ...presets.bodyXS,
    color: COLORS.gray500,
    width: '96%',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statsCell: {
    width: '47.5%',
    flexGrow: 1,
  },

  card: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.sm,
  },
  emptyText: {
    ...presets.bodySM,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },

  docsList: {
    gap: spacing[3],
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  docDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  docIconBox: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    gap: scale(2),
  },
  docTitle: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  docMeta: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },

  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray300,
  },

  stateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  stateTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginTop: spacing[4],
    textAlign: 'center',
  },
  stateMessage: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginTop: spacing[2],
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  stateRetry: {
    minWidth: scale(160),
  },

  tabLoadingBox: {
    paddingVertical: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabErrorBox: {
    paddingVertical: spacing[8],
    alignItems: 'center',
    gap: spacing[2],
  },
  tabErrorText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  retryText: {
    ...presets.labelMD,
    color: COLORS.primary,
    marginTop: spacing[1],
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
  },
  infoDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  infoLabel: {
    ...presets.bodySM,
    color: COLORS.gray700,
  },
  infoValue: {
    ...presets.labelMD,
    color: COLORS.gray900,
    flexShrink: 1,
    textAlign: 'right',
  },

  soilFootnote: {
    marginTop: spacing[1],
    gap: spacing[1.5],
  },
  soilLockCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.warning, 0.3),
    backgroundColor: addAlpha(COLORS.warning, 0.08),
  },
  soilLockIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  soilLockTexts: {
    flex: 1,
    gap: spacing[1],
  },
  soilLockTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  soilLockText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
  },
  soilNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  soilNoteText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flexShrink: 1,
  },

  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docActionBtn: {
    padding: spacing[2],
  },

  mapFab: {
    position: 'absolute',
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    ...shadows.md,
  },
  mapFabAdd: {
    backgroundColor: addAlpha(COLORS.gray900, 0.5),
    borderColor: addAlpha(COLORS.white, 0.35),
  },
  mapFabEdit: {
    backgroundColor: addAlpha(COLORS.primary, 0.88),
    borderColor: addAlpha(COLORS.white, 0.35),
  },
  mapFabText: { ...presets.labelSM, color: COLORS.white },
});
