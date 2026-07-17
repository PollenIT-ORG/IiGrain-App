import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, presets, spacing } from '../../constants';
import AppText from '../AppText/AppText';

export interface AccountSectionProps {
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const AccountSection: React.FC<AccountSectionProps> = ({
  title,
  subtitle,
  style,
  children,
}) => (
  <View style={[styles.section, style]}>
    {title ? <AppText style={styles.title}>{title}</AppText> : null}
    {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
    {children}
  </View>
);

export default React.memo(AccountSection);

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing[6],
  },
  title: {
    ...presets.overline,
    color: COLORS.gray700,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  subtitle: {
    ...presets.bodySM,
    color: COLORS.gray600,
    marginBottom: spacing[3],
    marginLeft: spacing[1],
  },
});
