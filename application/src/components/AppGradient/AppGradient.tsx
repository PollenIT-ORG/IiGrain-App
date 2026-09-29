import React from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { GRADIENTS, type GradientVariant } from '../../constants/gradients';

export interface AppGradientProps {
  variant?: GradientVariant;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

let gradientSeq = 0;

// A pill radius in this app is 9999. Handing that straight to <Rect rx> gives a
// corner far larger than the box, the shape degenerates, and nothing is painted --
// leaving only the flat fallback colour. SVG clamps rx to half the box; so do we.
export const clampCornerRadius = (
  radius: number,
  width: number,
  height: number,
): number => {
  if (!(radius > 0) || !(width > 0) || !(height > 0)) {
    return 0;
  }
  return Math.min(radius, width / 2, height / 2);
};

const AppGradient: React.FC<AppGradientProps> = ({
  variant,
  colors: customColors,
  start: customStart,
  end: customEnd,
  locations: customLocations,
  borderRadius: customBorderRadius,
  style,
  children,
}) => {
  const config = variant ? GRADIENTS[variant] : null;

  const resolvedColors = customColors ?? config?.colors ?? GRADIENTS.primary.colors;
  const resolvedStart  = customStart  ?? config?.start  ?? GRADIENTS.primary.start;
  const resolvedEnd    = customEnd    ?? config?.end    ?? GRADIENTS.primary.end;
  const resolvedLocs   = customLocations ?? config?.locations;

  const idRef = React.useRef<string>('');
  if (!idRef.current) {
    idRef.current = `appGradient${gradientSeq++}`;
  }
  const gradientId = idRef.current;

  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const radius =
    customBorderRadius ??
    (typeof flat.borderRadius === 'number' ? flat.borderRadius : 0);

  const count = resolvedColors.length;
  const fallbackColor = resolvedColors[count - 1];

  const cornerRadius = clampCornerRadius(radius, size.width, size.height);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.fill,
        { backgroundColor: fallbackColor },
        customBorderRadius != null ? { borderRadius: customBorderRadius } : null,
        style,
      ]}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
          pointerEvents="none">
          <Defs>
            <SvgLinearGradient
              id={gradientId}
              x1={resolvedStart.x}
              y1={resolvedStart.y}
              x2={resolvedEnd.x}
              y2={resolvedEnd.y}>
              {resolvedColors.map((color, i) => (
                <Stop
                  key={i}
                  offset={resolvedLocs?.[i] ?? (count > 1 ? i / (count - 1) : 0)}
                  stopColor={color}
                  stopOpacity={1}
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            rx={cornerRadius || undefined}
            ry={cornerRadius || undefined}
            fill={`url(#${gradientId})`}
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );
};

export default React.memo(AppGradient);

const styles = StyleSheet.create({
  fill: {
    flexShrink: 0,
  },
});
