import { StyleSheet } from 'react-native';
import { spacing } from '../../../constants';
import { scale } from '../../../utils';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  submit: {
    marginTop: spacing[2],
  },
});
