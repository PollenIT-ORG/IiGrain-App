import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, AppText, Button } from '../../components';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { FadeSlideIn } from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { selectEnrollmentIdFor } from '../../redux/slices/onboardingSlice';
import ProgramSummaryCard from './components/ProgramSummaryCard';
import { useOnboardingData } from './useOnboardingData';
import { styles } from './OnboardingWelcomeScreenStyle';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const OnboardingWelcomeScreen: React.FC<AppScreenProps<'OnboardingWelcome'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectAuthUser);
  const enrollmentId = useAppSelector(state => selectEnrollmentIdFor(state, user?.email));
  const { snapshot, initialLoading } = useOnboardingData();

  const firstName = (user?.fullName ?? '').trim().split(' ')[0];
  const program = snapshot.program;

  const openChecklist = useCallback(
    () => navigation.navigate('OnboardingChecklist'),
    [navigation],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" bgColor onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <View style={styles.hero}>
            <View style={styles.celebration}>
              <AppIcon
                name={ICONS.CELEBRATE}
                size={moderateScale(44)}
                color={COLORS.primary}
              />
            </View>

            <AppText style={styles.title} align="center">
              Welcome to iiGrain!
            </AppText>
            <AppText style={styles.subtitle} align="center">
              {program?.alreadyEnrolled
                ? 'You are enrolled in the following program.'
                : 'Your Enrollment ID is confirmed for the following program.'}
            </AppText>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <ProgramSummaryCard
            program={program}
            enrollmentId={enrollmentId}
            enrolledAcres={snapshot.enrolledAcres}
            loading={initialLoading}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={160}>
          <View style={styles.tip}>
            <AppIcon
              name={ICONS.LEAF}
              size={moderateScale(20)}
              color={COLORS.primary}
              style={styles.tipIcon}
            />
            <View style={styles.tipBody}>
              <AppText style={styles.tipTitle}>
                {firstName ? `You're almost ready, ${firstName}!` : "You're almost ready!"}
              </AppText>
              <AppText style={styles.tipText}>
                Let's complete a few steps to set up your farms and fields.
              </AppText>
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + moderateScale(12) }]}>
        <Button title="Let's Get Started" onPress={openChecklist} />
      </View>
    </View>
  );
};

export default OnboardingWelcomeScreen;
