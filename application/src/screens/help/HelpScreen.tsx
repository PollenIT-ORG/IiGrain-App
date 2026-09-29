import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button, NoticeCard } from '../../components';
import { AppShimmerList, AppShimmerText } from '../../components/Shimmer';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  selectFaqs,
  selectFaqsError,
  selectFaqsLoaded,
  selectFaqsLoading,
} from '../../redux/slices/supportSlice';
import { fetchFaqsThunk } from '../../redux/thunks/supportThunks';
import type { Faq } from '../../types/support';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { styles } from './HelpScreenStyle';

type DevTarget = Extract<
  keyof AppStackParamList,
  'FieldMap' | 'SimpleMap' | 'AndroidLines'
>;

interface DevTool {
  icon: string;
  label: string;
  hint: string;
  target: DevTarget;
}

const DEV_TOOLS: DevTool[] = [
  {
    icon: ICONS.MAP,
    label: 'Field Map',
    hint: 'See all your farms on one map, with satellite view',
    target: 'FieldMap',
  },
  {
    icon: 'vector-polyline',
    label: 'Android Map + Lines',
    hint: 'Many locations, spokes and a boundary (SVG overlay)',
    target: 'AndroidLines',
  },
  {
    icon: 'vector-line',
    label: 'Simple Map + Line',
    hint: 'Normal map with one polyline from A to B',
    target: 'SimpleMap',
  },
];

const COLLAPSED_ANSWER_LINES = 2;

interface FaqRowProps {
  faq: Faq;
  expanded: boolean;
  last: boolean;
  onToggle: (id: string) => void;
}

const FaqRow: React.FC<FaqRowProps> = ({ faq, expanded, last, onToggle }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => onToggle(faq.id)}
    accessibilityRole="button"
    accessibilityState={{ expanded }}
    accessibilityLabel={faq.question}
    style={[styles.faqRow, !last && styles.rowBorder]}>
    <View style={styles.faqHead}>
      <AppText style={[styles.faqQuestion, expanded && styles.faqQuestionOpen]}>
        {faq.question}
      </AppText>
      <AppIcon
        name={expanded ? ICONS.CHEVRON_UP : ICONS.CHEVRON_DOWN}
        size={moderateScale(22)}
        color={expanded ? COLORS.primary : COLORS.gray500}
      />
    </View>
    <AppText
      style={[styles.faqAnswer, !expanded && styles.faqAnswerCollapsed]}
      numberOfLines={expanded ? undefined : COLLAPSED_ANSWER_LINES}>
      {faq.answer}
    </AppText>
  </TouchableOpacity>
);

const HelpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();

  const faqs = useAppSelector(selectFaqs);
  const loaded = useAppSelector(selectFaqsLoaded);
  const loading = useAppSelector(selectFaqsLoading);
  const error = useAppSelector(selectFaqsError);
  const user = useAppSelector(selectAuthUser);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchFaqsThunk());
  }, [dispatch]);

  const refresh = useCallback(() => {
    dispatch(fetchFaqsThunk());
  }, [dispatch]);

  const toggle = useCallback((id: string) => {
    setExpandedId(current => (current === id ? null : id));
  }, []);

  const openContact = useCallback(() => {
    navigation.navigate('ContactUs', {
      email: user?.email,
    });
  }, [navigation, user]);

  const openDevTool = useCallback(
    (target: DevTarget) => {
      navigation.navigate(target);
    },
    [navigation],
  );

  const showDevTools = __DEV__ && user?.role === 'farmer';
  const hasFaqs = faqs.length > 0;
  const firstLoad = !loaded && loading && !hasFaqs;
  const failedWithNothing = Boolean(error) && !hasFaqs && !loading;

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Help" />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && hasFaqs}
            onRefresh={refresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>


 <View style={styles.contactCard}>
          <AppText style={styles.contactTitle}>Still need help?</AppText>
          <AppText style={styles.contactText}>
            Send us the details and our team will reply by email.
          </AppText>
          <Button title="Contact Us" onPress={openContact} />
        </View>

        <AppText style={styles.intro}>
          Answers to the questions we hear most. Still stuck? Send us a message.
        </AppText>

        <AppText style={styles.sectionTitle}>Frequently asked questions</AppText>

        {firstLoad ? (
          <View style={[styles.card, styles.shimmerCard]}>
            <AppShimmerList count={5} renderItem={() => <AppShimmerText count={2} />} />
          </View>
        ) : failedWithNothing ? (
          <NoticeCard
            tone="warning"
            icon={ICONS.OFFLINE}
            title="Could not load help topics"
            message={error ?? undefined}
            primaryAction={{ label: 'Try again', onPress: refresh, loading }}
            style={styles.notice}
          />
        ) : hasFaqs ? (
          <View style={styles.card}>
            {faqs.map((faq, index) => (
              <FaqRow
                key={faq.id}
                faq={faq}
                expanded={expandedId === faq.id}
                last={index === faqs.length - 1}
                onToggle={toggle}
              />
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <AppText style={styles.empty}>
              There are no help topics yet. Please check back soon.
            </AppText>
          </View>
        )}

       

        {showDevTools ? (
          <>
            <AppText style={styles.sectionTitle}>Developer tools</AppText>
            <View style={styles.card}>
              {DEV_TOOLS.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  activeOpacity={0.7}
                  onPress={() => openDevTool(item.target)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={[styles.row, index < DEV_TOOLS.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowIcon}>
                    <AppIcon
                      name={item.icon}
                      size={moderateScale(20)}
                      color={COLORS.primary}
                    />
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
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default HelpScreen;
