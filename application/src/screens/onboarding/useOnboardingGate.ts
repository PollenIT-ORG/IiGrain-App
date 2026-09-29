import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  selectOnboardingSeen,
  selectRegisteredOnThisDevice,
} from '../../redux/slices/onboardingSlice';
import type { AppStackParamList } from '../../navigation/navigationTypes';

export const useOnboardingGate = (): void => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const user = useAppSelector(selectAuthUser);
  const userId = user?.id ?? '';
  const seen = useAppSelector(state => selectOnboardingSeen(state, userId));
  const registeredHere = useAppSelector(state =>
    selectRegisteredOnThisDevice(state, user?.email),
  );

  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !userId || seen || !registeredHere) {
      return;
    }
    fired.current = true;
    InteractionManager.runAfterInteractions(() => {
      navigation.navigate('OnboardingChecklist');
    });
  }, [navigation, registeredHere, seen, userId]);
};
