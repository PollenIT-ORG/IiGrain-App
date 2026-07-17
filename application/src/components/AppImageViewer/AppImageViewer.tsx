import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS, presets } from '../../constants';
import { addAlpha } from '../../utils';
import AppText from '../AppText/AppText';

export interface AppImageSource {
  uri: string;
}

export interface AppImageViewerProps {
  images: AppImageSource[];
  imageIndex?: number;
  visible: boolean;
  onRequestClose: () => void;
}

const MAX_SCALE = 4;

const ZoomableImage: React.FC<{
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}> = ({ uri, width, height, onZoomChange }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const applyZoom = useCallback(
    (z: boolean) => {
      setZoomed(z);
      onZoomChange(z);
    },
    [onZoomChange],
  );

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(applyZoom)(false);
      } else {
        runOnJS(applyZoom)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate(e => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
        runOnJS(applyZoom)(false);
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(applyZoom)(true);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.page, { width, height }]} collapsable={false}>
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={[{ width, height }, animStyle]}
        />
      </View>
    </GestureDetector>
  );
};

const AppImageViewer: React.FC<AppImageViewerProps> = ({
  images,
  imageIndex = 0,
  visible,
  onRequestClose,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const startIndex =
    images.length > 0 ? Math.min(Math.max(imageIndex, 0), images.length - 1) : 0;
  const [current, setCurrent] = useState(startIndex);
  const [pagerEnabled, setPagerEnabled] = useState(true);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setCurrent(Math.round(e.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  if (images.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait']}
      onRequestClose={onRequestClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

          <FlatList
            data={images}
            horizontal
            pagingEnabled
            scrollEnabled={pagerEnabled}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            keyExtractor={(item, i) => `${item.uri}-${i}`}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item }) => (
              <ZoomableImage
                uri={item.uri}
                width={width}
                height={height}
                onZoomChange={z => setPagerEnabled(!z)}
              />
            )}
          />

          {images.length > 1 ? (
            <View style={[styles.counter, { top: insets.top + 10 }]}>
              <AppText style={styles.counterText}>
                {current + 1} / {images.length}
              </AppText>
            </View>
          ) : null}

          <Pressable
            onPress={onRequestClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
            style={[styles.close, { top: insets.top + 8 }]}>
            <AppIcon name={ICONS.CLOSE} size={26} color={COLORS.white} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default React.memo(AppImageViewer);

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: COLORS.black },
  page: { alignItems: 'center', justifyContent: 'center' },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: addAlpha(COLORS.black, 0.5),
  },
  counterText: { ...presets.labelSM, color: COLORS.white },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: addAlpha(COLORS.black, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
