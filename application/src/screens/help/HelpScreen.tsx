import React, { useCallback } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText } from '../../components';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './HelpScreenStyle';

type HelpTarget = Extract<keyof AppStackParamList, 'FieldMap' | 'SimpleMap' | 'AndroidLines'>;

interface HelpItem {
  icon: string;
  label: string;
  hint: string;
  target: HelpTarget;
}

const HELP_ITEMS: HelpItem[] = [
  {
    icon: ICONS.MAP,
    label: 'Field Map',
    hint: 'See all your farms on one map, with satellite view',
    target: 'FieldMap',
  },
  {
    icon: 'vector-polyline',
    label: 'Android Map + Lines',
    hint: 'Many locations, spokes and a boundary — works on Android (SVG overlay)',
    target: 'AndroidLines',
  },
  {
    icon: 'vector-line',
    label: 'Simple Map + Line',
    hint: 'Normal map with one polyline from A to B (debug)',
    target: 'SimpleMap',
  },
];

const HelpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();

  const openTarget = useCallback(
    (target: HelpTarget) => {
      navigation.navigate(target);
    },
    [navigation],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Help" />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <AppText style={styles.intro}>
          Tools and guides to help you get the most out of iiGrain.
        </AppText>

        <AppText style={styles.sectionTitle}>Tools</AppText>
        <View style={styles.card}>
          {HELP_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.7}
              onPress={() => openTarget(item.target)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[styles.row, index < HELP_ITEMS.length - 1 && styles.rowBorder]}>
              <View style={styles.rowIcon}>
                <AppIcon name={item.icon} size={moderateScale(20)} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <AppText style={styles.rowLabel}>{item.label}</AppText>
                <AppText style={styles.rowHint} numberOfLines={2}>
                  {item.hint}
                </AppText>
              </View>
              <AppIcon
                name={ICONS.CHEVRON_RIGHT}
                size={moderateScale(22)}
                color={COLORS.gray500}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default HelpScreen;
