/**
 * First-time coach mark for DRAW mode: a looping demo — a ghost fingertip taps
 * three points, the same white line the real map draws grows between them,
 * and the shape closes and fills — using the exact visuals (dot styling, line
 * colour/width, hint copy) the real drawing flow uses, so the demo teaches the
 * real thing rather than a stand-in illustration.
 *
 * Points are laid out as percentages of the measured overlay, so the shape
 * scales the same way on a small phone and a tablet. The scrim intercepts all
 * touches — the toolbar underneath is real but inert while this plays, so a
 * first-time tap can't land on the real map and create a stray point.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Polygon as SvgPolygon } from 'react-native-svg';
import AppText from '../../../components/AppText/AppText';
import Button from '../../../components/Button/Button';
import { COLORS, borderRadius, presets, shadows, spacing } from '../../../constants';
import { addAlpha, scale } from '../../../utils';
import { BOUNDARY_HINTS } from '../engine/boundaryMessages';

export interface BoundaryDrawTutorialProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

// Percent-of-overlay layout for the three demo corners — a triangle that
// reads clearly without sitting under the search bar or the toolbar.
const LAYOUT = [
  { xPct: 0.27, yPct: 0.36 },
  { xPct: 0.74, yPct: 0.3 },
  { xPct: 0.56, yPct: 0.64 },
] as const;

const DOT = scale(26);
const HAND_SIZE = scale(34);
const LINE_WIDTH = 3;
const STEP_MS = 620; // hand glide
const PRESS_MS = 140;
const CAPTION_FADE_MS = 160;
const HOLD_AFTER_CLOSE_MS = 1400;
const LOOP_GAP_MS = 900;

const driven = (toValue: number, duration: number, easing = Easing.out(Easing.quad)) => ({
  toValue,
  duration,
  easing,
  useNativeDriver: true,
});

/** A ripple that expands and fades under a freshly-placed point. */
const Ripple: React.FC<{ point: Pt; progress: Animated.Value }> = ({ point, progress }) => (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.ripple,
      {
        left: point.x - RIPPLE_MAX / 2,
        top: point.y - RIPPLE_MAX / 2,
        opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0] }),
        transform: [
          {
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
          },
        ],
      },
    ]}
  />
);

const RIPPLE_MAX = scale(64);

/** A numbered dot, styled like the real VertexMarker. */
const DemoDot: React.FC<{ point: Pt; index: number; scaleAnim: Animated.Value }> = ({
  point,
  index,
  scaleAnim,
}) => (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.dot,
      index === 0 && styles.dotFirst,
      {
        left: point.x - DOT / 2,
        top: point.y - DOT / 2,
        transform: [{ scale: scaleAnim }],
      },
    ]}>
    <AppText style={styles.dotLabel}>{index + 1}</AppText>
  </Animated.View>
);

/**
 * A line from `from` to `to` that grows on demand. Rotating a hairline box
 * that is centred exactly on `from` avoids needing `transformOrigin`: the box
 * spins around its own centre, which *is* the start point, so the segment
 * growing inside it always reads from `from` toward `to`.
 */
const GrowLine: React.FC<{ from: Pt; to: Pt; progress: Animated.Value }> = ({
  from,
  to,
  progress,
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.lineHinge,
        {
          left: from.x - LINE_WIDTH / 2,
          top: from.y - LINE_WIDTH / 2,
          transform: [{ rotate: `${angleDeg}deg` }],
        },
      ]}>
      <Animated.View
        style={[
          styles.lineSegment,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }),
          },
        ]}
      />
    </View>
  );
};

const CAPTIONS = [
  BOUNDARY_HINTS.drawEmpty,
  BOUNDARY_HINTS.drawOne,
  BOUNDARY_HINTS.drawTwo,
  BOUNDARY_HINTS.drawReady,
  "That's it — now try it yourself.",
];

const BoundaryDrawTutorial: React.FC<BoundaryDrawTutorialProps> = ({
  visible,
  onDismiss,
}) => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [showCta, setShowCta] = useState(false);
  const stoppedRef = useRef(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const captionOpacity = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(scale(12))).current;

  const handX = useRef(new Animated.Value(0)).current;
  const handY = useRef(new Animated.Value(0)).current;
  const handOpacity = useRef(new Animated.Value(0)).current;
  const handScale = useRef(new Animated.Value(1)).current;

  const dotScales = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const ripples = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const lineProgress = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;

  const points = useMemo<Pt[] | null>(() => {
    if (!size) {
      return null;
    }
    return LAYOUT.map(p => ({ x: p.xPct * size.width, y: p.yPct * size.height }));
  }, [size]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(previous =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  const setCaption = useCallback(
    (index: number) =>
      new Promise<void>(resolve => {
        Animated.timing(captionOpacity, driven(0, CAPTION_FADE_MS)).start(() => {
          setCaptionIndex(index);
          Animated.timing(captionOpacity, driven(1, CAPTION_FADE_MS)).start(() => resolve());
        });
      }),
    [captionOpacity],
  );

  const wait = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

  const moveHandTo = useCallback(
    (point: Pt, first: boolean) =>
      new Promise<void>(resolve => {
        if (first) {
          handX.setValue(point.x - HAND_SIZE * 0.15);
          handY.setValue(point.y - HAND_SIZE * 0.15);
          Animated.parallel([
            Animated.timing(handOpacity, driven(1, 260)),
            Animated.timing(handX, driven(point.x, STEP_MS)),
            Animated.timing(handY, driven(point.y, STEP_MS)),
          ]).start(() => resolve());
          return;
        }
        Animated.parallel([
          Animated.timing(handX, driven(point.x, STEP_MS)),
          Animated.timing(handY, driven(point.y, STEP_MS)),
        ]).start(() => resolve());
      }),
    [handX, handY, handOpacity],
  );

  const tap = useCallback(
    (dotIndex: number) =>
      new Promise<void>(resolve => {
        Animated.sequence([
          Animated.timing(handScale, driven(0.78, PRESS_MS, Easing.out(Easing.cubic))),
          Animated.timing(handScale, driven(1, PRESS_MS, Easing.out(Easing.back(2)))),
        ]).start();
        ripples[dotIndex].setValue(0);
        Animated.timing(ripples[dotIndex], driven(1, 480, Easing.out(Easing.quad))).start();
        Animated.spring(dotScales[dotIndex], {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }).start(() => resolve());
      }),
    [dotScales, handScale, ripples],
  );

  const drawLine = useCallback(
    (lineIndex: number) =>
      new Promise<void>(resolve => {
        // Layout-driven width, so this one step runs on the JS thread — a
        // single ~500ms tween, not a per-frame cost.
        Animated.timing(lineProgress[lineIndex], {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => resolve());
      }),
    [lineProgress],
  );

  const resetSequence = useCallback(() => {
    handOpacity.setValue(0);
    handScale.setValue(1);
    fillOpacity.setValue(0);
    dotScales.forEach(v => v.setValue(0));
    ripples.forEach(v => v.setValue(0));
    lineProgress.forEach(v => v.setValue(0));
    ctaOpacity.setValue(0);
    ctaTranslateY.setValue(scale(12));
    setShowCta(false);
    setCaptionIndex(0);
    captionOpacity.setValue(1);
  }, [
    handOpacity,
    handScale,
    fillOpacity,
    dotScales,
    ripples,
    lineProgress,
    ctaOpacity,
    ctaTranslateY,
    captionOpacity,
  ]);

  useEffect(() => {
    if (!visible) {
      stoppedRef.current = true;
      return;
    }
    stoppedRef.current = false;

    let cancelled = false;
    const bail = () => cancelled || stoppedRef.current;

    const run = async () => {
      while (!bail()) {
        resetSequence();
        if (!points) {
          return;
        }

        await moveHandTo(points[0], true);
        if (bail()) return;
        await tap(0);
        if (bail()) return;

        await setCaption(1);
        if (bail()) return;
        await moveHandTo(points[1], false);
        if (bail()) return;
        await Promise.all([tap(1), drawLine(0)]);
        if (bail()) return;

        await setCaption(2);
        if (bail()) return;
        await moveHandTo(points[2], false);
        if (bail()) return;
        await Promise.all([tap(2), drawLine(1)]);
        if (bail()) return;

        await setCaption(3);
        if (bail()) return;
        await moveHandTo(points[0], false);
        if (bail()) return;
        await drawLine(2);
        if (bail()) return;

        Animated.parallel([
          Animated.timing(fillOpacity, driven(1, 320)),
          Animated.timing(handOpacity, driven(0, 220)),
        ]).start();

        await setCaption(4);
        if (bail()) return;
        setShowCta(true);
        Animated.parallel([
          Animated.timing(ctaOpacity, driven(1, 280)),
          Animated.timing(ctaTranslateY, driven(0, 280, Easing.out(Easing.cubic))),
        ]).start();

        await wait(HOLD_AFTER_CLOSE_MS);
        if (bail()) return;
        await wait(LOOP_GAP_MS);
      }
    };

    Animated.timing(overlayOpacity, driven(1, 260)).start();
    run();

    return () => {
      cancelled = true;
    };
  }, [
    visible,
    points,
    moveHandTo,
    tap,
    drawLine,
    setCaption,
    resetSequence,
    overlayOpacity,
    fillOpacity,
    handOpacity,
    ctaOpacity,
    ctaTranslateY,
  ]);

  const dismiss = useCallback(() => {
    stoppedRef.current = true;
    Animated.timing(overlayOpacity, driven(0, 200)).start(() => onDismiss());
  }, [overlayOpacity, onDismiss]);

  if (!visible) {
    return null;
  }

  const fillPoints =
    points && points.length === 3
      ? `${points[0].x},${points[0].y} ${points[1].x},${points[1].y} ${points[2].x},${points[2].y}`
      : null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      onLayout={onLayout}
      accessibilityViewIsModal
      accessibilityLabel="How to draw a field boundary">
      <Pressable style={StyleSheet.absoluteFill} onPress={() => undefined} />

      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.captionCard}>
          <Animated.View style={{ opacity: captionOpacity }}>
            <AppText style={styles.captionText}>{CAPTIONS[captionIndex]}</AppText>
          </Animated.View>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip the tutorial">
          <AppText style={styles.skipText}>Skip</AppText>
        </Pressable>
      </View>

      {points ? (
        <>
          {fillPoints ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.fillWrap, { opacity: fillOpacity }]}>
              <Svg style={StyleSheet.absoluteFill}>
                <SvgPolygon
                  points={fillPoints}
                  fill={addAlpha(COLORS.white, 0.16)}
                  stroke="none"
                />
              </Svg>
            </Animated.View>
          ) : null}

          <GrowLine from={points[0]} to={points[1]} progress={lineProgress[0]} />
          <GrowLine from={points[1]} to={points[2]} progress={lineProgress[1]} />
          <GrowLine from={points[2]} to={points[0]} progress={lineProgress[2]} />

          {points.map((point, index) => (
            <Ripple key={`ripple-${index}`} point={point} progress={ripples[index]} />
          ))}
          {points.map((point, index) => (
            <DemoDot
              key={`dot-${index}`}
              point={point}
              index={index}
              scaleAnim={dotScales[index]}
            />
          ))}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.hand,
              {
                opacity: handOpacity,
                transform: [
                  { translateX: handX },
                  { translateY: handY },
                  { scale: handScale },
                ],
              },
            ]}>
            <View style={styles.handGlyph}>
              <AppText style={styles.handEmoji}>👆</AppText>
            </View>
          </Animated.View>
        </>
      ) : null}

      {showCta ? (
        <Animated.View
          style={[
            styles.ctaWrap,
            { opacity: ctaOpacity, transform: [{ translateY: ctaTranslateY }] },
          ]}>
          <Button title="Got it — let's draw" onPress={dismiss} size="sm" fullWidth={false} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

export default React.memo(BoundaryDrawTutorial);

const styles = StyleSheet.create({
  lineHinge: {
    position: 'absolute',
    width: LINE_WIDTH,
    height: LINE_WIDTH,
  },
  lineSegment: {
    position: 'absolute',
    left: LINE_WIDTH / 2,
    top: 0,
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: COLORS.white,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    zIndex: 50,
  },
  topRow: {
    position: 'absolute',
    top: scale(64),
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  captionCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...shadows.lg,
  },
  captionText: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  skipText: {
    ...presets.labelMD,
    color: COLORS.white,
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  dotFirst: {
    backgroundColor: COLORS.primaryDark,
  },
  dotLabel: {
    fontSize: scale(11),
    lineHeight: scale(14),
    fontWeight: '700',
    color: COLORS.white,
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE_MAX,
    height: RIPPLE_MAX,
    borderRadius: RIPPLE_MAX / 2,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.white,
    zIndex: 2,
  },
  hand: {
    position: 'absolute',
    width: HAND_SIZE,
    height: HAND_SIZE,
    marginLeft: -HAND_SIZE * 0.28,
    marginTop: -HAND_SIZE * 0.1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  handGlyph: {
    width: HAND_SIZE,
    height: HAND_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handEmoji: {
    fontSize: HAND_SIZE * 0.8,
  },
  fillWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  ctaWrap: {
    position: 'absolute',
    bottom: scale(120),
    alignSelf: 'center',
  },
});
