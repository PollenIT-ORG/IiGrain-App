import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
  type MapType,
  type MarkerDragStartEndEvent,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import AppText from '../../components/AppText/AppText';

const STROKE = '#136F3F';
const FILL = 'rgba(19,111,63,0.25)';
const STROKE_WIDTH = 4;

interface LL {
  latitude: number;
  longitude: number;
}

const CENTER: LL = { latitude: 20.5937, longitude: 78.9629 };
const INITIAL_POLYGON: LL[] = [
  { latitude: 20.596, longitude: 78.961 },
  { latitude: 20.5915, longitude: 78.966 },
];

const INITIAL_REGION: Region = {
  latitude: CENTER.latitude,
  longitude: CENTER.longitude,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const TEST_LINE = [
  {
    latitude: CENTER.latitude - 0.0002,
    longitude: CENTER.longitude,
  },
  {
    latitude: CENTER.latitude + 0.0002,
    longitude: CENTER.longitude,
  },
];

const EARTH_R = 6378137;
const rad = (d: number): number => (d * Math.PI) / 180;

const areaSqM = (ring: LL[]): number => {
  if (ring.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % ring.length];
    sum +=
      rad(p2.longitude - p1.longitude) *
      (2 + Math.sin(rad(p1.latitude)) + Math.sin(rad(p2.latitude)));
  }
  return Math.abs((sum * EARTH_R * EARTH_R) / 2);
};

const toAcres = (sqm: number): number => sqm / 4046.8564224;
const toHectares = (sqm: number): number => sqm / 10000;

interface HistoryState {
  present: LL[];
  past: LL[][];
  future: LL[][];
}

const MAP_TYPES: ReadonlyArray<{ value: MapType; label: string }> = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'standard', label: 'Map' },
];

const PolygonDebugScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [{ present: coordinates, past, future }, setHistory] = useState<HistoryState>(() => ({
    present: INITIAL_POLYGON,
    past: [],
    future: [],
  }));
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [selected, setSelected] = useState<number | null>(null);

  const commit = useCallback((next: LL[]) => {
    setHistory(s => ({ present: next, past: [...s.past, s.present].slice(-30), future: [] }));
  }, []);

  const undo = useCallback(() => {
    setHistory(s =>
      s.past.length === 0
        ? s
        : {
            present: s.past[s.past.length - 1],
            past: s.past.slice(0, -1),
            future: [s.present, ...s.future],
          },
    );
  }, []);

  const redo = useCallback(() => {
    setHistory(s =>
      s.future.length === 0
        ? s
        : { present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1) },
    );
  }, []);

  const onMapPress = useCallback(
    (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      commit([...coordinates, { latitude, longitude }]);
      setSelected(null);
    },
    [coordinates, commit],
  );

  const onVertexDragEnd = useCallback(
    (index: number, e: MarkerDragStartEndEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      commit(coordinates.map((p, i) => (i === index ? { latitude, longitude } : p)));
    },
    [coordinates, commit],
  );

  const deleteVertex = useCallback(
    (index: number) => {
      commit(coordinates.filter((_, i) => i !== index));
      setSelected(null);
    },
    [coordinates, commit],
  );

  const clearAll = useCallback(() => {
    commit([]);
    setSelected(null);
  }, [commit]);

  const resetPolygon = useCallback(() => {
    commit(INITIAL_POLYGON);
    setSelected(null);
    mapRef.current?.animateToRegion(INITIAL_REGION, 500);
  }, [commit]);

  const save = useCallback(() => {
    console.log('[PolygonDebug] SAVE (local only)', JSON.stringify(coordinates));
    Alert.alert('Saved (local)', `${coordinates.length} vertices, ${toAcres(areaSqM(coordinates)).toFixed(3)} acres`);
  }, [coordinates]);

  const goToMyLocation = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }
      }
      Geolocation.getCurrentPosition(
        pos => {
          mapRef.current?.animateToRegion(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500,
          );
        },
        () => Alert.alert('Location', 'Could not get current location.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch {
    }
  }, []);

  const area = useMemo(() => areaSqM(coordinates), [coordinates]);

  console.log('[PolygonDebug] render', {
    vertices: coordinates.length,
    willRenderPolyline: coordinates.length >= 2,
    willRenderPolygon: coordinates.length >= 3,
    markers: coordinates.length,
    first: coordinates[0],
    coordinates,
  });

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        initialRegion={INITIAL_REGION}
        onPress={onMapPress}>
        <Polyline coordinates={TEST_LINE} strokeColor="#FF00FF" strokeWidth={8} />
<Polyline
  coordinates={TEST_LINE}
  strokeColor="#FF00FF"
  strokeWidth={8}
/>

        {coordinates.length >= 2 ? (
          <Polyline coordinates={coordinates} strokeColor={STROKE} strokeWidth={STROKE_WIDTH} />
        ) : null}

        {coordinates.length >= 3 ? (
          <Polygon
            coordinates={coordinates}
            strokeColor={STROKE}
            fillColor={FILL}
            strokeWidth={STROKE_WIDTH}
          />
        ) : null}

        {coordinates.map((c, index) => (
          <Marker
            key={`vertex-${index}`}
            coordinate={c}
            anchor={{ x: 0.5, y: 0.5 }}
            draggable
            tracksViewChanges={false}
            onPress={() => setSelected(index)}
            onDragEnd={e => onVertexDragEnd(index, e)}>
            <Pressable
              onLongPress={() => deleteVertex(index)}
              style={[styles.vertex, selected === index && styles.vertexSelected]}
            />
          </Marker>
        ))}
      </MapView>

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

      <View style={[styles.info, { top: insets.top + 60 }]}>
        <AppText style={styles.infoText}>Vertices: {coordinates.length}</AppText>
        <AppText style={styles.infoText}>Area: {toAcres(area).toFixed(3)} ac</AppText>
        <AppText style={styles.infoSub}>
          {toHectares(area).toFixed(3)} ha · {Math.round(area)} m²
        </AppText>
      </View>

      <View style={[styles.side, { top: insets.top + 60 }]}>
        <Pressable style={styles.sideBtn} onPress={goToMyLocation}>
          <AppText style={styles.sideBtnText}>📍</AppText>
        </Pressable>
        <Pressable style={[styles.sideBtn, past.length === 0 && styles.disabled]} onPress={undo}>
          <AppText style={styles.sideBtnText}>↶</AppText>
        </Pressable>
        <Pressable style={[styles.sideBtn, future.length === 0 && styles.disabled]} onPress={redo}>
          <AppText style={styles.sideBtnText}>↷</AppText>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.actionBtn} onPress={resetPolygon}>
          <AppText style={styles.actionText}>Reset</AppText>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={clearAll}>
          <AppText style={styles.actionText}>Clear</AppText>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={save}>
          <AppText style={[styles.actionText, styles.actionPrimaryText]}>Save</AppText>
        </Pressable>
      </View>
    </View>
  );
};

export default PolygonDebugScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  vertex: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: STROKE,
  },
  vertexSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: STROKE,
  },

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
  typeBtnActive: { backgroundColor: STROKE },
  typeText: { color: '#333', fontWeight: '600' },
  typeTextActive: { color: '#fff' },

  info: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    padding: 10,
    minWidth: 140,
    elevation: 4,
  },
  infoText: { color: '#111', fontWeight: '700', fontSize: 14 },
  infoSub: { color: '#555', fontSize: 12, marginTop: 2 },

  side: { position: 'absolute', right: 12, gap: 10 },
  sideBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  sideBtnText: { fontSize: 20 },
  disabled: { opacity: 0.4 },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STROKE,
    alignItems: 'center',
  },
  actionText: { color: STROKE, fontWeight: '700' },
  actionPrimary: { backgroundColor: STROKE, borderColor: STROKE },
  actionPrimaryText: { color: '#fff' },
});

