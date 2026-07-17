import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  filterBar: {
    borderRadius: borderRadius.lg,
    padding: scale(4),
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    padding: spacing[1],
    marginTop: spacing[5],
    marginBottom: spacing[5],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabLabel: {
    ...presets.labelSM,
    color: COLORS.gray700,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
  tabContent: {
    minHeight: scale(120),
    marginTop:20
  },

  statRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  gap: {
    height: spacing[3],
  },

  card: {
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
    ...shadows.sm,
  },
  muted: {
    ...presets.bodySM,
    color: COLORS.gray500,
    paddingVertical: spacing[4],
  },

  soilGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  soilCell: {
    width: '47.5%',
    flexGrow: 1,
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  docDivider: {
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
  },
  docIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
    gap: spacing[0.5],
  },
  docName: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  docMeta: {
    ...presets.bodyXS,
    color: COLORS.gray500,
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
  retryBtn: {
    minWidth: moderateScale(160),
  },

  fieldsLoader: {
    paddingVertical: spacing[6],
  },

  fieldsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  fieldsHeaderTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  addFieldBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
