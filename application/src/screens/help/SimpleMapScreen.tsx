/**
 * SimpleMapScreen — the most minimal map + polyline possible.
 *
 * ⚠️ DEBUG ONLY. Normal Google map, two points, one polyline A → B. No state,
 * no hooks, no wrappers, no engine, no redux. Just proves a plain line renders.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

// Point A → Point B
const POINT_A = { latitude: 20.596, longitude: 78.961 };
const POINT_B = { latitude: 20.5915, longitude: 78.966 };

const SimpleMapScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}>
        {/* Two endpoints */}
        <Marker coordinate={POINT_A} title="Point A" />
        <Marker coordinate={POINT_B} title="Point B" />

        {/* One line from A to B */}
        <Polyline
          coordinates={[POINT_A, POINT_B]}
          strokeColor="#136F3F"
          strokeWidth={6}
        />
      </MapView>
    </View>
  );
};

export default SimpleMapScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
