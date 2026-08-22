import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS, presets, shadows } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { useAppSelector } from '../../redux/hooks';
import { selectActiveVisit, selectIncomingVisit } from '../../redux/slices/visitSlice';
import { navigationRef } from '../../services/navigationRef';

const HIDDEN_ROUTES = new Set<string>([
  'AssessorQuestion',
  'AssessmentQuestionDetail',
  'AssessorVisit',
  'FarmerVisitTracking',
]);

interface NavRef {
  isReady: () => boolean;
  getCurrentRoute: () => { name: string } | undefined;
  addListener: (type: 'state', cb: () => void) => () => void;
  navigate: (name: string, params?: object) => void;
}
const nav = navigationRef as unknown as NavRef;

const CORE = scale(54);
const RING_MAX = 2.4;

const VisitTrackingFab: React.FC = () => {
  const insets = useSafeAreaInsets();
  const activeVisit = useAppSelector(selectActiveVisit);
  const incomingVisit = useAppSelector(selectIncomingVisit);
  const visit = activeVisit ?? incomingVisit;

  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const sync = () => setRouteName(nav.getCurrentRoute()?.name);
    const attach = (): boolean => {
      if (!nav.isReady()) {
        return false;
      }
      sync();
      unsub = nav.addListener('state', sync);
      return true;
    };
    if (attach()) {
      return () => unsub?.();
    }
    const id = setInterval(() => {
      if (attach()) {
        clearInterval(id);
      }
    }, 300);
    return () => {
      clearInterval(id);
      unsub?.();
    };
  }, []);

  const arrived = visit?.status === 'arrived';

  const visible = Boolean(visit) && !HIDDEN_ROUTES.has(routeName ?? '');

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    ring1.setValue(0);
    ring2.setValue(0);

    const mk = (v: Animated.Value) =>
      Animated.loop(
        Animated.timing(v, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
    const l1 = mk(ring1);
    const l2 = mk(ring2);
    l1.start();
    const t = setTimeout(() => l2.start(), 1000);

    return () => {
      clearTimeout(t);
      l1.stop();
      l2.stop();
    };
  }, [visible, ring1, ring2]);

  const openMap = useCallback(() => {
    if (!nav.isReady()) {
      return;
    }
    if (activeVisit) {
      nav.navigate('AssessorVisit', { visitId: activeVisit.id });
    } else if (incomingVisit) {
      nav.navigate('FarmerVisitTracking', { visitId: incomingVisit.id });
    }
  }, [activeVisit, incomingVisit]);

  if (!visible) {
    return null;
  }

  const label = arrived ? 'Arrived' : 'Live';

  const ringStyle = (v: Animated.Value) => ({
    transform: [
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, RING_MAX] }) },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + moderateScale(84) }]}>
      <Pressable
        onPress={openMap}
        accessibilityRole="button"
        accessibilityLabel="Open live visit tracking"
        style={styles.press}>
        <Animated.View style={[styles.ring, ringStyle(ring1)]} />
        <Animated.View style={[styles.ring, ringStyle(ring2)]} />
        <View style={styles.core}>
          <AppIcon name="navigation-variant" size={moderateScale(22)} color={COLORS.white} />
          <AppText style={styles.label} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      </Pressable>
    </View>
  );
};

export default VisitTrackingFab;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: moderateScale(16),
    width: CORE,
    height: CORE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  press: {
    width: CORE,
    height: CORE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: COLORS.primary,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: scale(2),
    borderColor: COLORS.white,
    ...shadows.lg,
  },
  label: {
    ...presets.overline,
    color: COLORS.white,
    fontSize: moderateScale(8),
    marginTop: scale(1),
    letterSpacing: 0.4,
  },
});
