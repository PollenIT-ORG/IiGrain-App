import React from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const A1 = { latitude: 20.598, longitude: 78.9585 };
const A2 = { latitude: 20.598, longitude: 78.9675 };

const B1 = { latitude: 20.5895, longitude: 78.9585 };
const B2 = { latitude: 20.5895, longitude: 78.9675 };

const NUMERIC_GREEN = processColor('#00FF00') as unknown as string;

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
        <Marker coordinate={A1} title="A1" />
        <Marker coordinate={A2} title="A2" />
        <Polyline coordinates={[A1, A2]} strokeColor="#FF00FF" strokeWidth={8} />

        <Marker coordinate={B1} title="B1" />
        <Marker coordinate={B2} title="B2" />
        <Polyline coordinates={[B1, B2]} strokeColor={NUMERIC_GREEN} strokeWidth={8} />
      </MapView>
    </View>
  );
};

export default SimpleMapScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
