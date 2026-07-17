import { StyleSheet } from 'react-native';
import {
  borderRadius,
  COLORS,
  presets,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  tabBar: {
    backgroundColor: COLORS.white,
    marginTop: spacing[4],
  },
  tabRow: {
    flexDirection: 'row',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  tabLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelOverlay: {
    position: 'absolute',
  },
  tabLabelInactive: {
    ...presets.labelLG,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  tabLabelActive: {
    ...presets.labelLG,
    color: COLORS.primary,
    textAlign: 'center',
  },
  tabDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray300,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: spacing.px * 3,
    backgroundColor: COLORS.primary,
  },
  farmsWrap: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing[4],
    flexGrow: 1,
  },
  floating: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: scale(44),
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.gray100,
  },
  searchInput: {
    flex: 1,
    ...presets.bodySM,
    color: COLORS.gray900,
    padding: 0,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    height: scale(44),
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  sortText: {
    ...presets.labelSM,
    color: COLORS.primary,
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
});
