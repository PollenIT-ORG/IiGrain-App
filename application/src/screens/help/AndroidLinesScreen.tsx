import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
  type MapType,
  type Region,
} from 'react-native-maps';
import Svg, {
  Circle,
  Line as SvgLine,
  Polygon as SvgPolygon,
  Polyline as SvgPolyline,
} from 'react-native-svg';
import AppText from '../../components/AppText/AppText';

interface LL {
  latitude: number;
  longitude: number;
}
interface XY {
  x: number;
  y: number;
}

const HUB: LL = { latitude: 20.5937, longitude: 78.9629 };
const RING: LL[] = [
  { latitude: 20.5997, longitude: 78.9629 },
  { latitude: 20.598, longitude: 78.9672 },
  { latitude: 20.5937, longitude: 78.9689 },
  { latitude: 20.5894, longitude: 78.9672 },
  { latitude: 20.5877, longitude: 78.9629 },
  { latitude: 20.5894, longitude: 78.9586 },
  { latitude: 20.5937, longitude: 78.9569 },
  { latitude: 20.598, longitude: 78.9586 },
];
const ALL: LL[] = [HUB, ...RING];

const LABELS = ['Hub', 'North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

const INITIAL_REGION: Region = {
  latitude: HUB.latitude,
  longitude: HUB.longitude,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const MAP_TYPES: ReadonlyArray<{ value: MapType; label: string }> = [
  { value: 'standard', label: 'Map' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
];

const COLORS = {
  spoke: '#1565C0',
  ring: '#136F3F',
  fill: 'rgba(19,111,63,0.22)',
  vertex: '#136F3F',
  hub: '#E5484D',
};

const AndroidLinesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [points, setPoints] = useState<XY[]>([]);
  const [moving, setMoving] = useState(false);
  const [showSvg, setShowSvg] = useState(true);
  const [showNative, setShowNative] = useState(false);

  const projectToken = useRef(0);

  const reproject = useCallback(async () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const token = ++projectToken.current;
    try {
      const projected = await Promise.all(ALL.map(c => map.pointForCoordinate(c)));
      if (token === projectToken.current) {
        setPoints(projected);
      }
    } catch {
    }
  }, []);

  const onRegionChangeComplete = useCallback(() => {
    setMoving(false);
    reproject();
  }, [reproject]);

  const onRegionChange = useCallback(() => {
    setMoving(prev => (prev ? prev : true));
  }, []);

  const onMapReady = useCallback(() => {
    reproject();
    setTimeout(reproject, 300);
    setTimeout(reproject, 800);
  }, [reproject]);

  useEffect(() => {
    reproject();
  }, [mapType, reproject]);

  const hasPoints = points.length === ALL.length;
  const hubPt = hasPoints ? points[0] : null;
  const ringPts = hasPoints ? points.slice(1) : [];
  const ringPointsStr = ringPts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        initialRegion={INITIAL_REGION}
        onMapReady={onMapReady}
        onLayout={reproject}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}>
        {showNative ? (
          <>
            <Polygon
              coordinates={RING}
              strokeColor={COLORS.ring}
              fillColor={COLORS.fill}
              strokeWidth={4}
            />
            {RING.map((c, i) => (
              <Polyline
                key={`nat-${i}`}
                coordinates={[HUB, c]}
                strokeColor={COLORS.spoke}
                strokeWidth={4}
              />
            ))}
          </>
        ) : null}

        {ALL.map((c, i) => (
          <Marker
            key={`m-${i}`}
            coordinate={c}
            title={LABELS[i]}
            pinColor={i === 0 ? COLORS.hub : COLORS.ring}
          />
        ))}
      </MapView>

      {showSvg && hasPoints && !moving ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgPolygon
            points={ringPointsStr}
            fill={COLORS.fill}
            stroke={COLORS.ring}
            strokeWidth={3}
          />
          <SvgPolyline
            points={`${ringPointsStr} ${ringPts[0]?.x},${ringPts[0]?.y}`}
            fill="none"
            stroke={COLORS.ring}
            strokeWidth={3}
          />
          {hubPt
            ? ringPts.map((p, i) => (
                <SvgLine
                  key={`spoke-${i}`}
                  x1={hubPt.x}
                  y1={hubPt.y}
                  x2={p.x}
                  y2={p.y}
                  stroke={COLORS.spoke}
                  strokeWidth={3}
                />
              ))
            : null}
          {points.map((p, i) => (
            <Circle
              key={`v-${i}`}
              cx={p.x}
              cy={p.y}
              r={i === 0 ? 7 : 5}
              fill={i === 0 ? COLORS.hub : '#fff'}
              stroke={i === 0 ? '#fff' : COLORS.vertex}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}

      <View style={[styles.typeRow, { top: insets.top + 12 }]}>
        {MAP_TYPES.map(t => {
          const active = t.value === mapType;
          return (
            <Pressable
              key={t.value}
              onPress={() => setMapType(t.value)}
              style={[styles.typeBtn, active && styles.typeBtnActive]}>
              <AppText style={[styles.typeText, active && styles.typeTextActive]}>
                {t.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.legend, { top: insets.top + 60 }]}>
        <AppText style={styles.legendTitle}>{ALL.length} locations · {RING.length} lines</AppText>
        <AppText style={styles.legendSub}>SVG overlay (works on Android)</AppText>
      </View>

      <View style={[styles.toggles, { bottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => setShowSvg(v => !v)}
          style={[styles.toggle, showSvg && styles.toggleOn]}>
          <AppText style={[styles.toggleText, showSvg && styles.toggleTextOn]}>
            SVG lines {showSvg ? 'ON' : 'OFF'}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setShowNative(v => !v)}
          style={[styles.toggle, showNative && styles.toggleOn]}>
          <AppText style={[styles.toggleText, showNative && styles.toggleTextOn]}>
            Native lines {showNative ? 'ON' : 'OFF'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
};

export default AndroidLinesScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  typeRow: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 4,
  },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  typeBtnActive: { backgroundColor: COLORS.ring },
  typeText: { color: '#333', fontWeight: '600' },
  typeTextActive: { color: '#fff' },

  legend: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    padding: 10,
    elevation: 4,
  },
  legendTitle: { color: '#111', fontWeight: '700', fontSize: 14 },
  legendSub: { color: '#136F3F', fontSize: 12, marginTop: 2, fontWeight: '600' },

  toggles: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 10,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.ring,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleOn: { backgroundColor: COLORS.ring },
  toggleText: { color: COLORS.ring, fontWeight: '700' },
  toggleTextOn: { color: '#fff' },
});
