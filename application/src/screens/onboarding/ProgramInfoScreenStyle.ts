import { StyleSheet } from 'react-native';
import {
  COLORS,
  borderRadius,
  borderWidth,
  fonts,
  presets,
  spacing,
} from '../../constants';
import { scale } from '../../utils';

const LIST_ICON = scale(32);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  body: {
    padding: spacing[5],
    paddingBottom: spacing[12],
    gap: spacing[5],
  },
  sectionTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginBottom: spacing[2],
  },
  paragraph: {
    ...presets.bodyMD,
    color: COLORS.gray700,
  },
  list: {
    gap: spacing[4],
  },
  listRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  listIcon: {
    width: LIST_ICON,
    height: LIST_ICON,
    borderRadius: LIST_ICON / 2,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBody: {
    flex: 1,
  },
  listTitle: {
    ...presets.bodyMD,
    fontFamily: fonts.semibold,
    color: COLORS.gray900,
  },
  listText: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginTop: spacing[0.5],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    backgroundColor: COLORS.lightPrimary,
    borderRadius: borderRadius.full,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.primaryLighter,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    maxWidth: '100%',
  },
  chipText: {
    ...presets.labelSM,
    color: COLORS.primary,
  },
  surveyButton: {
    marginTop: spacing[2],
  },
});
