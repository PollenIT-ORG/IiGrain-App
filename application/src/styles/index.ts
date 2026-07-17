import { StyleSheet, Platform } from 'react-native';
import { COLORS } from '../constants/colors';
import { spacing, borderRadius, borderWidth } from '../constants/spacing';
import { shadows } from '../constants/shadows';
import { fonts, fontSizes, presets } from '../constants/typography';
import { scale } from '../utils';

const OVERLAY = 'rgba(0,0,0,0.5)';

const layout = StyleSheet.create({
  row:              { flexDirection: 'row' },
  rowReverse:       { flexDirection: 'row-reverse' },
  column:           { flexDirection: 'column' },
  columnReverse:    { flexDirection: 'column-reverse' },
  center:           { alignItems: 'center', justifyContent: 'center' },
  rowCenter:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rowBetween:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowAround:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  rowEvenly:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  rowStart:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  rowEnd:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  alignCenter:      { alignItems: 'center' },
  alignStart:       { alignItems: 'flex-start' },
  alignEnd:         { alignItems: 'flex-end' },
  justifyCenter:    { justifyContent: 'center' },
  justifyBetween:   { justifyContent: 'space-between' },
  justifyEnd:       { justifyContent: 'flex-end' },
  flex1:            { flex: 1 },
  flexGrow:         { flexGrow: 1 },
  flexShrink:       { flexShrink: 1 },
  flexWrap:         { flexWrap: 'wrap' },

  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  safeScreen: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[4],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  container: {
    paddingHorizontal: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },

  dividerH: {
    height: borderWidth.hairline,
    backgroundColor: COLORS.gray300,
    marginVertical: spacing[3],
  },
  dividerV: {
    width: borderWidth.hairline,
    backgroundColor: COLORS.gray300,
    marginHorizontal: spacing[3],
  },

  absolute:     { position: 'absolute' },
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overflow:     { overflow: 'hidden' },
});

const text = StyleSheet.create({
  displayLarge:  { ...presets.displayLarge,  color: COLORS.gray900 },
  displayMedium: { ...presets.displayMedium, color: COLORS.gray900 },
  displaySmall:  { ...presets.displaySmall,  color: COLORS.gray900 },
  headingXL:     { ...presets.headingXL,     color: COLORS.gray900 },
  headingLG:     { ...presets.headingLG,     color: COLORS.gray900 },
  headingMD:     { ...presets.headingMD,     color: COLORS.gray900 },
  headingSM:     { ...presets.headingSM,     color: COLORS.gray900 },
  headingXS:     { ...presets.headingXS,     color: COLORS.gray900 },
  bodyLG:        { ...presets.bodyLG,        color: COLORS.gray900 },
  bodyMD:        { ...presets.bodyMD,        color: COLORS.gray900 },
  bodySM:        { ...presets.bodySM,        color: COLORS.gray900 },
  labelLG:       { ...presets.labelLG,       color: COLORS.gray900 },
  labelMD:       { ...presets.labelMD,       color: COLORS.gray900 },
  labelSM:       { ...presets.labelSM,       color: COLORS.gray900 },
  caption:       { ...presets.caption,       color: COLORS.gray700 },
  overline:      { ...presets.overline,      color: COLORS.gray500, textTransform: 'uppercase' },
  code:          { ...presets.code,          color: COLORS.gray900, backgroundColor: COLORS.white, paddingHorizontal: spacing[2], borderRadius: borderRadius.sm },
  secondary:     { color: COLORS.gray700 },
  muted:         { color: COLORS.gray500 },
  disabled:      { color: COLORS.gray300 },
  inverse:       { color: COLORS.white },
  primary:       { color: COLORS.primary },
  danger:        { color: COLORS.danger },
  success:       { color: COLORS.success },
  warning:       { color: COLORS.warning },
  link:          { color: COLORS.primary, textDecorationLine: 'underline' },
  left:          { textAlign: 'left' },
  center:        { textAlign: 'center' },
  right:         { textAlign: 'right' },
});

const button = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  sm: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  md: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  lg: { paddingHorizontal: spacing[6], paddingVertical: spacing[4] },
  xl: { paddingHorizontal: spacing[8], paddingVertical: spacing[5] },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
    borderRadius: borderRadius.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
  },
  danger: {
    backgroundColor: COLORS.danger,
    borderRadius: borderRadius.md,
  },
  success: {
    backgroundColor: COLORS.success,
    borderRadius: borderRadius.md,
  },
  primaryText: {
    ...presets.labelMD,
    color: COLORS.white,
  },
  secondaryText: {
    ...presets.labelMD,
    color: COLORS.white,
  },
  outlineText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  ghostText: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  dangerText: {
    ...presets.labelMD,
    color: COLORS.white,
  },
  disabled: {
    opacity: 0.5,
  },
  rounded: { borderRadius: borderRadius.full },
  pill:    { borderRadius: borderRadius.full },
  icon:    { width: 44, height: 44, padding: 0, borderRadius: borderRadius.md },
  iconRounded: { width: 44, height: 44, padding: 0, borderRadius: borderRadius.full },
});

const card = StyleSheet.create({
  base: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bordered: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  flat: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
  },
  padded: {
    padding: spacing[4],
  },
  paddedSM: {
    padding: spacing[3],
  },
  paddedLG: {
    padding: spacing[6],
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: COLORS.gray300,
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: borderWidth.hairline,
    borderTopColor: COLORS.gray300,
  },
});

const input = StyleSheet.create({
  base: {
    ...presets.bodyMD,
    color: COLORS.gray900,
    backgroundColor: COLORS.white,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: Platform.OS === 'ios' ? spacing[3] : spacing[2],
    height: 48,
  },
  sm: {
    height: 36,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    fontSize: fontSizes.sm,
    borderRadius: borderRadius.sm,
  },
  lg: {
    height: 56,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    fontSize: fontSizes.lg,
    borderRadius: borderRadius.lg,
  },
  focused: {
    borderColor: COLORS.primary,
    borderWidth: borderWidth.medium,
  },
  error: {
    borderColor: COLORS.danger,
    borderWidth: borderWidth.medium,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: COLORS.white,
  },
  multiline: {
    height: 'auto',
    minHeight: 96,
    paddingTop: spacing[3],
    textAlignVertical: 'top',
  },
  label: {
    ...presets.labelSM,
    color: COLORS.gray700,
    marginBottom: spacing[1],
  },
  labelFocused: {
    color: COLORS.primary,
  },
  labelError: {
    color: COLORS.danger,
  },
  helper: {
    ...presets.caption,
    color: COLORS.gray500,
    marginTop: spacing[1],
  },
  helperError: {
    color: COLORS.danger,
  },
  group: {
    marginBottom: spacing[4],
  },
});

const shadow = StyleSheet.create({
  none: { ...shadows.none },
  xs:   { ...shadows.xs },
  sm:   { ...shadows.sm },
  md:   { ...shadows.md },
  lg:   { ...shadows.lg },
  xl:   { ...shadows.xl },
  '2xl':{ ...shadows['2xl'] },
});

const badge = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  sm: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: 2,
  },
  lg: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  default:  { backgroundColor: COLORS.white },
  primary:  { backgroundColor: COLORS.white },
  success:  { backgroundColor: COLORS.white },
  warning:  { backgroundColor: COLORS.white },
  danger:   { backgroundColor: COLORS.white },
  defaultText:  { ...presets.labelSM, color: COLORS.gray700 },
  primaryText:  { ...presets.labelSM, color: COLORS.primary },
  successText:  { ...presets.labelSM, color: COLORS.success },
  warningText:  { ...presets.labelSM, color: COLORS.warning },
  dangerText:   { ...presets.labelSM, color: COLORS.danger },
});

const avatar = StyleSheet.create({
  xs: { width: 24, height: 24, borderRadius: 12 },
  sm: { width: 32, height: 32, borderRadius: 16 },
  md: { width: 40, height: 40, borderRadius: 20 },
  lg: { width: 48, height: 48, borderRadius: 24 },
  xl: { width: 64, height: 64, borderRadius: 32 },
  '2xl': { width: 80, height: 80, borderRadius: 40 },
  base: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  bordered: {
    borderWidth: 2,
    borderColor: COLORS.white,
  },
});

const modal = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[3],
    ...shadows['2xl'],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray300,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  centered: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    marginHorizontal: spacing[5],
    ...shadows['2xl'],
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const emptyState = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    ...presets.bodyMD,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
});

const loading = StyleSheet.create({
  spinnerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBase: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  skeletonText: {
    height: 14,
    borderRadius: borderRadius.xs,
    backgroundColor: COLORS.white,
    marginBottom: spacing[2],
  },
  skeletonCircle: {
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
  },
});

const listItem = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: COLORS.white,
    gap: spacing[3],
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: COLORS.white,
    gap: spacing[3],
  },
  separator: {
    height: borderWidth.hairline,
    backgroundColor: COLORS.gray300,
    marginLeft: spacing[4],
  },
  content: {
    flex: 1,
    gap: spacing[0.5],
  },
});

const imgStyle = StyleSheet.create({
  logoXs: {
    width: scale(100),
    height: scale(50),
  },

  logoSm: {
    width: scale(130),
    height: scale(60),
  },

  logoMd: {
    width: scale(170),
    height: scale(80),
  },

  logoLg: {
    width: scale(196),
    height: scale(96),
  },

  logoXl: {
    width: scale(240),
    height: scale(120),
  },

  avatarSm: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
  },

  avatarMd: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
  },

  avatarLg: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
  },
});

export const styles = {
  layout,
  text,
  button,
  card,
  input,
  shadow,
  badge,
  avatar,
  modal,
  emptyState,
  loading,
  listItem,
  imgStyle
};

export const useStyles = () => styles;
