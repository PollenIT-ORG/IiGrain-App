import React, { useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, AppText, Button, NoticeCard } from '../../components';
import { ICONS } from '../../components/AppIcon';
import { FadeSlideIn } from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { selectHasAnyBoundary } from '../../redux/slices/boundarySlice';
import { selectProgramInfoSeen } from '../../redux/slices/onboardingSlice';
import { selectProfile } from '../../redux/slices/userSlice';
import ChecklistRow from './components/ChecklistRow';
import { buildSteps, completedCount, type OnboardingStepKey } from './onboardingSteps';
import { useOnboardingData } from './useOnboardingData';
import { styles } from './OnboardingChecklistScreenStyle';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const OnboardingChecklistScreen: React.FC<AppScreenProps<'OnboardingChecklist'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectAuthUser);
  const userId = user?.id ?? '';
  const profile = useAppSelector(selectProfile) ?? user;
  const hasLocalBoundary = useAppSelector(selectHasAnyBoundary);
  const programInfoSeen = useAppSelector(state => selectProgramInfoSeen(state, userId));
  const { snapshot, loading, initialLoading, error, refresh } = useOnboardingData();

  const steps = useMemo(
    () => buildSteps({ profile, snapshot, hasLocalBoundary, programInfoSeen }),
    [profile, snapshot, hasLocalBoundary, programInfoSeen],
  );
  const done = completedCount(steps);

  const openStep = useCallback(
    (key: OnboardingStepKey) => {
      const { firstFarm, firstField } = snapshot;
      switch (key) {
        case 'profile':
          navigation.navigate('EditProfile');
          return;
        case 'farms':
          navigation.navigate('AddFarm');
          return;
        case 'fields':
          if (firstFarm) {
            navigation.navigate('AddField', {
              farmId: firstFarm.id,
              farmName: firstFarm.name,
            });
          } else {
            navigation.navigate('AddFarm');
          }
          return;
        case 'boundaries':
          if (firstField) {
            navigation.navigate('BoundaryEditor', {
              farmId: firstField.farmId,
              fieldId: firstField.id,
              fieldName: firstField.name,
            });
          } else if (firstFarm) {
            navigation.navigate('AddField', {
              farmId: firstFarm.id,
              farmName: firstFarm.name,
            });
          } else {
            navigation.navigate('AddFarm');
          }
          return;
        case 'program':
          navigation.navigate('OnboardingProgramInfo');
      }
    },
    [navigation, snapshot],
  );

  const goToDashboard = useCallback(
    () =>
      navigation.navigate(
        'Shell',
        { screen: 'MainTabs', params: { screen: 'Home' } },
        { pop: true },
      ),
    [navigation],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" bgColor onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && !initialLoading}
            onRefresh={refresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <FadeSlideIn>
          <AppText style={styles.title}>Let's Get Started</AppText>
          <AppText style={styles.subtitle}>
            Complete these steps to start collecting program data.
          </AppText>

          <View style={styles.progress}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(done / steps.length) * 100}%` },
                ]}
              />
            </View>
            <AppText style={styles.progressText}>
              {done === steps.length
                ? `All ${steps.length} steps complete - you are all set!`
                : `${done} of ${steps.length} complete`}
            </AppText>
          </View>
        </FadeSlideIn>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <FadeSlideIn key={step.key} delay={60 + index * 60}>
              <ChecklistRow step={step} onPress={() => openStep(step.key)} />
            </FadeSlideIn>
          ))}
        </View>

        {initialLoading ? (
          <AppText style={styles.loadingNote}>Checking your setup...</AppText>
        ) : null}

        {error ? (
          <NoticeCard
            tone="warning"
            icon={ICONS.OFFLINE}
            title="We could not check your setup"
            message={error}
            primaryAction={{ label: 'Try again', onPress: refresh, loading }}
            style={styles.notice}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + moderateScale(12) }]}>
        <Button title="Go to Dashboard" onPress={goToDashboard} />

        <View style={styles.skipRow}>
          <TouchableOpacity
            onPress={goToDashboard}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Skip setup for now">
            <AppText style={styles.skipText}>Skip for now</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default OnboardingChecklistScreen;
