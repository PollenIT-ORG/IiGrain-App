import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon as SvgPolygon, Polyline as SvgPolyline } from 'react-native-svg';
import { COLORS } from '../../../constants';
import { addAlpha } from '../../../utils';
import type { LatLng, MapRegion } from '../../types';
import { pointsToSvg, projectRing, type ViewSize } from '../../utils/projection';

export interface BoundaryVectorOverlayHandle {
  setRegion: (region: MapRegion) => void;
}

export interface BoundaryVectorOverlayProps {
  ring: readonly LatLng[];
  initialRegion: MapRegion;
  size: ViewSize | null;
  invalid?: boolean;
  color?: string;
  strokeWidth?: number;
  showVertices?: boolean;
}

const BoundaryVectorOverlay = forwardRef<
  BoundaryVectorOverlayHandle,
  BoundaryVectorOverlayProps
>(({ ring, initialRegion, size, invalid = false, color, strokeWidth = 3, showVertices = false }, ref) => {
  const [region, setRegion] = useState<MapRegion>(initialRegion);
  useImperativeHandle(ref, () => ({ setRegion }), []);

  const stroke = invalid ? COLORS.danger : color ?? COLORS.white;

  const points = useMemo(() => {
    if (!size || size.width === 0 || ring.length === 0) {
      return [];
    }
    return projectRing(ring, region, size);
  }, [ring, region, size]);

  if (points.length === 0) {
    return null;
  }

  const outline = pointsToSvg(points);
  const closed = points.length >= 3 ? `${outline} ${points[0].x},${points[0].y}` : outline;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        {points.length >= 3 ? (
          <SvgPolygon points={outline} fill={addAlpha(stroke, 0.18)} stroke="none" />
        ) : null}
        {points.length >= 2 ? (
          <>
            <SvgPolyline
              points={closed}
              fill="none"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={strokeWidth + 2}
            />
            <SvgPolyline points={closed} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
          </>
        ) : null}
        {showVertices
          ? points.map((p, i) => (
              <Circle
                key={`sv-${i}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill={COLORS.white}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={1.5}
              />
            ))
          : null}
      </Svg>
    </View>
  );
});

BoundaryVectorOverlay.displayName = 'BoundaryVectorOverlay';

export default React.memo(BoundaryVectorOverlay);
