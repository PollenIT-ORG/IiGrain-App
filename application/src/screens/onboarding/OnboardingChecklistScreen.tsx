import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppProgressBar,
  AppStatusBar,
  AppText,
  Button,
  NoticeCard,
} from '../../components';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { FadeSlideIn } from '../../components/home';
import { COLORS } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import { selectHasAnyBoundary } from '../../redux/slices/boundarySlice';
import { markOnboardingSeen } from '../../redux/slices/onboardingSlice';
import { persistor } from '../../redux/store';
import { selectProfile } from '../../redux/slices/userSlice';
import ChecklistRow from './components/ChecklistRow';
import FarmPickerSheet from './components/FarmPickerSheet';
import FieldPickerSheet from './components/FieldPickerSheet';
import {
  addFieldTarget,
  buildSteps,
  canOpenStep,
  completedCount,
  type OnboardingStep,
} from './onboardingSteps';
import {
  useOnboardingData,
  type FarmRef,
  type FieldRef,
} from './useOnboardingData';
import { styles } from './OnboardingChecklistScreenStyle';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const SKIP_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const OnboardingChecklistScreen: React.FC<AppScreenProps<'OnboardingChecklist'>> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectAuthUser);
  const userId = user?.id ?? '';
  const profile = useAppSelector(selectProfile) ?? user;
  const hasLocalBoundary = useAppSelector(selectHasAnyBoundary);
  const { snapshot, loading, initialLoading, error, refresh } = useOnboardingData({
    withProgram: false,
  });

  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [farmPickerOpen, setFarmPickerOpen] = useState(false);

  const steps = useMemo(
    () => buildSteps({ profile, snapshot, hasLocalBoundary }),
    [profile, snapshot, hasLocalBoundary],
  );
  const done = completedCount(steps);
  const total = steps.length;
  const allDone = done === total;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const finishOnboarding = useCallback(() => {
    if (!userId) {
      return;
    }
    dispatch(markOnboardingSeen(userId));
    persistor.flush().catch(() => undefined);
  }, [dispatch, userId]);

  useEffect(() => {
    if (allDone && !initialLoading) {
      finishOnboarding();
    }
  }, [allDone, initialLoading, finishOnboarding]);

  const nextIndex = useMemo(() => steps.findIndex(step => !step.done), [steps]);

  const addFieldTo = useCallback(
    (farm: FarmRef) => {
      setFarmPickerOpen(false);
      navigation.navigate('AddField', { farmId: farm.id, farmName: farm.name });
    },
    [navigation],
  );

  const startAddField = useCallback(() => {
    const target = addFieldTarget(snapshot.farms);
    if (target.kind === 'addFarm') {
      navigation.navigate('AddFarm');
      return;
    }
    if (target.kind === 'addField') {
      addFieldTo(target.farm);
      return;
    }
    setFarmPickerOpen(true);
  }, [navigation, snapshot.farms, addFieldTo]);

  const openStep = useCallback(
    (step: OnboardingStep) => {
      if (initialLoading || !canOpenStep(step)) {
        return;
      }
      switch (step.key) {
        case 'profile':
          navigation.navigate('EditProfile');
          return;
        case 'farms':
          navigation.navigate('AddFarm');
          return;
        case 'fields':
          startAddField();
          return;
        case 'boundaries':
          setFieldPickerOpen(true);
      }
    },
    [initialLoading, navigation, startAddField],
  );

  const addFieldFromPicker = useCallback(() => {
    setFieldPickerOpen(false);
    startAddField();
  }, [startAddField]);

  const addFarmFromPicker = useCallback(() => {
    setFarmPickerOpen(false);
    navigation.navigate('AddFarm');
  }, [navigation]);

  const drawBoundary = useCallback(
    (field: FieldRef) => {
      if (field.hasBoundary) {
        return;
      }
      setFieldPickerOpen(false);
      navigation.navigate('BoundaryEditor', {
        farmId: field.farmId,
        fieldId: field.id,
        fieldName: field.name,
        latitude: field.latitude,
        longitude: field.longitude,
      });
    },
    [navigation],
  );

  const goToDashboard = useCallback(() => {
    finishOnboarding();
    navigation.navigate(
      'Shell',
      { screen: 'MainTabs', params: { screen: 'Home' } },
      { pop: true },
    );
  }, [finishOnboarding, navigation]);

  return (
    <View style={styles.safe}>
      <AppStatusBar />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + moderateScale(58) },
        ]}
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

          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <View style={styles.progressTexts}>
                <AppText style={styles.progressTitle}>
                  {allDone ? 'Setup complete' : 'Your setup'}
                </AppText>
                <AppText style={styles.progressText}>
                  {allDone
                    ? `All ${total} steps done — you are all set.`
                    : `${done} of ${total} complete · ${total - done} to go`}
                </AppText>
              </View>

              <View style={[styles.percentPill, allDone && styles.percentPillDone]}>
                <AppText
                  style={[styles.percentText, allDone && styles.percentTextDone]}>
                  {percent}%
                </AppText>
              </View>
            </View>

            <AppProgressBar percent={percent} height={scale(8)} />
          </View>
        </FadeSlideIn>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <FadeSlideIn key={step.key} delay={60 + index * 60}>
              <ChecklistRow
                step={step}
                index={index}
                isNext={index === nextIndex}
                disabled={initialLoading}
                onPress={() => openStep(step)}
              />
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

      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={SKIP_HIT_SLOP}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + moderateScale(8) },
          pressed && styles.backPressed,
        ]}>
        <AppIcon
          name={ICONS.CHEVRON_LEFT}
          size={moderateScale(24)}
          color={COLORS.gray900}
        />
      </Pressable>

      <FieldPickerSheet
        visible={fieldPickerOpen}
        fields={snapshot.fields}
        loading={loading}
        onSelect={drawBoundary}
        onAddField={addFieldFromPicker}
        onClose={() => setFieldPickerOpen(false)}
      />

      <FarmPickerSheet
        visible={farmPickerOpen}
        farms={snapshot.farms}
        loading={loading}
        onSelect={addFieldTo}
        onAddFarm={addFarmFromPicker}
        onClose={() => setFarmPickerOpen(false)}
      />

      <View
        style={[
          styles.footer,
          allDone && styles.footerSolid,
          { paddingBottom: insets.bottom + moderateScale(12) },
        ]}>
        {allDone ? (
          <>
            <View style={styles.readyRow}>
              <AppIcon
                name={ICONS.CHECK_CIRCLE}
                size={moderateScale(18)}
                color={COLORS.primary}
              />
              <AppText style={styles.readyText}>
                Everything is set up. You can start collecting data.
              </AppText>
            </View>
            <Button title="Go to Dashboard" onPress={goToDashboard} />
          </>
        ) : (
          <View style={styles.skipRow}>
            <Pressable
              onPress={goToDashboard}
              accessibilityRole="button"
              accessibilityLabel="Skip setup for now"
              hitSlop={SKIP_HIT_SLOP}
              style={({ pressed }) => [styles.skipButton, pressed && styles.skipPressed]}>
              <AppText style={styles.skipText}>Skip for now</AppText>
              <AppIcon
                name={ICONS.CHEVRON_RIGHT}
                size={moderateScale(14)}
                color={COLORS.gray600}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

export default OnboardingChecklistScreen;
