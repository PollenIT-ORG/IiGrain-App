import { useEffect, useRef } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectAuthUser } from '../../redux/slices/authSlice';
import {
  markOnboardingSeen,
  selectOnboardingSeen,
  selectRegisteredOnThisDevice,
} from '../../redux/slices/onboardingSlice';
import type { AppStackParamList } from '../../navigation/navigationTypes';

export const useOnboardingGate = (): void => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
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
    dispatch(markOnboardingSeen(userId));
    navigation.navigate('OnboardingWelcome');
  }, [dispatch, navigation, registeredHere, seen, userId]);
};
