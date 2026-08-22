import React from 'react';
import { COLORS } from '../../../constants';
import { addAlpha } from '../../../utils';
import { MapPolygon } from '../../components/MapPrimitives';
import type { LatLng } from '../../types';

export interface BoundaryPolygonProps {
  ring: readonly LatLng[];
  invalid?: boolean;
  color?: string;
  strokeWidth?: number;
  tappable?: boolean;
  onPress?: () => void;
}

const BoundaryPolygon: React.FC<BoundaryPolygonProps> = ({
  ring,
  invalid = false,
  color,
  strokeWidth = 2,
  tappable = false,
  onPress,
}) => {
  if (ring.length < 3) {
    return null;
  }

  const stroke = invalid ? COLORS.danger : color ?? COLORS.white;
  const fill = addAlpha(stroke, 0.18);

  return (
    <MapPolygon
      coordinates={ring.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
      strokeColor={stroke}
      strokeWidth={strokeWidth}
      fillColor={fill}
      tappable={tappable}
      onPress={onPress}
      geodesic={false}
    />
  );
};

export default React.memo(BoundaryPolygon);
