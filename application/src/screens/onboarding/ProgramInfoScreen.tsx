import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { AppHeader, AppText, Button } from '../../components';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { FadeSlideIn } from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { openExternalUrl } from '../../utils/openExternalUrl';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  markProgramInfoSeen,
  selectEnrollmentIdFor,
} from '../../redux/slices/onboardingSlice';
import ProgramSummaryCard from './components/ProgramSummaryCard';
import { useOnboardingData } from './useOnboardingData';
import { styles } from './ProgramInfoScreenStyle';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const NEXT_STEPS: ReadonlyArray<{ icon: string; title: string; text: string }> = [
  {
    icon: ICONS.FIELD,
    title: 'Enroll your fields',
    text: 'Choose which of your fields take part in this program.',
  },
  {
    icon: ICONS.ASSESSMENT,
    title: 'Complete the assessment',
    text: 'Answer the program questions field by field, with photos where asked.',
  },
  {
    icon: ICONS.SOIL,
    title: 'Record monitoring data',
    text: 'Log soil, crop and input activity through the season.',
  },
  {
    icon: ICONS.SCORE_ARC,
    title: 'Track your score',
    text: 'Watch your Regen Health Index build up on the dashboard.',
  },
];

const ProgramInfoScreen: React.FC<AppScreenProps<'OnboardingProgramInfo'>> = ({
  navigation,
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const userId = user?.id ?? '';
  const enrollmentId = useAppSelector(state => selectEnrollmentIdFor(state, user?.email));
  const { snapshot, initialLoading } = useOnboardingData();
  const program = snapshot.program;

  useEffect(() => {
    if (userId) {
      dispatch(markProgramInfoSeen(userId));
    }
  }, [dispatch, userId]);

  const enrolledFields = useMemo(
    () => (program?.fields ?? []).filter(field => field.enrolled),
    [program],
  );

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        bgColor
        title="Program Information"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <ProgramSummaryCard
            program={program}
            enrollmentId={enrollmentId}
            enrolledAcres={snapshot.enrolledAcres}
            loading={initialLoading}
          />
        </FadeSlideIn>

        {program?.description?.trim() ? (
          <FadeSlideIn delay={80}>
            <AppText style={styles.sectionTitle}>About this program</AppText>
            <AppText style={styles.paragraph}>{program.description.trim()}</AppText>
          </FadeSlideIn>
        ) : null}

        <FadeSlideIn delay={120}>
          <AppText style={styles.sectionTitle}>What happens next</AppText>
          <View style={styles.list}>
            {NEXT_STEPS.map(item => (
              <View key={item.title} style={styles.listRow}>
                <View style={styles.listIcon}>
                  <AppIcon
                    name={item.icon}
                    size={moderateScale(18)}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.listBody}>
                  <AppText style={styles.listTitle}>{item.title}</AppText>
                  <AppText style={styles.listText}>{item.text}</AppText>
                </View>
              </View>
            ))}
          </View>
        </FadeSlideIn>

        {enrolledFields.length > 0 ? (
          <FadeSlideIn delay={160}>
            <AppText style={styles.sectionTitle}>
              Fields in this program ({enrolledFields.length})
            </AppText>
            <View style={styles.chips}>
              {enrolledFields.map(field => (
                <View key={field.id} style={styles.chip}>
                  <AppText style={styles.chipText} numberOfLines={1}>
                    {field.farmName ? `${field.name} · ${field.farmName}` : field.name}
                  </AppText>
                </View>
              ))}
            </View>
          </FadeSlideIn>
        ) : null}

        {program?.surveyUrl ? (
          <FadeSlideIn delay={200}>
            <Button
              title="Open program survey"
              variant="outline"
              onPress={() => openExternalUrl(program.surveyUrl)}
              style={styles.surveyButton}
            />
          </FadeSlideIn>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default ProgramInfoScreen;
