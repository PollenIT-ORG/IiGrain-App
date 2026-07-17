import { StyleSheet } from 'react-native';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
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
    flexGrow: 1,
    padding: spacing[4],
    paddingBottom: spacing[10],
  },

  heroIcon: {
    alignSelf: 'center',
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },

  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    marginTop: spacing[1],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.white,
  },
  mapBtnPressed: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.primary,
  },
  mapBtnIcon: {
    width: scale(42),
    height: scale(42),
    borderRadius: borderRadius.md,
    backgroundColor: addAlpha(COLORS.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnTexts: {
    flex: 1,
    gap: spacing[0.5],
  },
  mapBtnTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  mapBtnSub: {
    ...presets.caption,
    color: COLORS.gray500,
  },

  submit: {
    marginTop: spacing[4],
  },
});
