import { StyleSheet } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import { scale } from '../../utils';
import { styles as commonStyles } from '../../styles/index';



export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logo: {
    ...commonStyles.imgStyle.logoLg,
    marginBottom: spacing[4],
  },
  title: {
    ...presets.headingXL,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    ...presets.bodyMD,
    color: COLORS.gray700,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
});
