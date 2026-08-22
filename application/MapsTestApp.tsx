import React, { useState } from 'react';
import { View, Switch, Text, ScrollView, StyleSheet } from 'react-native';

import MapView, {
  PROVIDER_GOOGLE,
  Marker,
  Polyline,
  Polygon,
  Circle,
} from 'react-native-maps';

const coordinates = [
  { latitude: 28.6139, longitude: 77.209 },
  { latitude: 28.6205, longitude: 77.215 },
  { latitude: 28.6275, longitude: 77.225 },
  { latitude: 28.6345, longitude: 77.235 },
  { latitude: 28.64, longitude: 77.245 },
];

export default function MapsTestApp() {
  const [showMarker, setShowMarker] = useState(true);
  const [showPolyline, setShowPolyline] = useState(true);
  const [showMultiplePolyline, setShowMultiplePolyline] = useState(true);
  const [showPolygon, setShowPolygon] = useState(true);
  const [showCircle, setShowCircle] = useState(true);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <ScrollView horizontal>
          <View style={styles.item}>
            <Text>Marker</Text>
            <Switch value={showMarker} onValueChange={setShowMarker} />
          </View>

          <View style={styles.item}>
            <Text>Polyline</Text>
            <Switch value={showPolyline} onValueChange={setShowPolyline} />
          </View>

          <View style={styles.item}>
            <Text>Multi Line</Text>
            <Switch
              value={showMultiplePolyline}
              onValueChange={setShowMultiplePolyline}
            />
          </View>

          <View style={styles.item}>
            <Text>Polygon</Text>
            <Switch value={showPolygon} onValueChange={setShowPolygon} />
          </View>

          <View style={styles.item}>
            <Text>Circle</Text>
            <Switch value={showCircle} onValueChange={setShowCircle} />
          </View>
        </ScrollView>
      </View>

      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        googleRenderer="LATEST"
        initialRegion={{
          latitude: 28.6275,
          longitude: 77.225,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}>
        {showMarker &&
          coordinates.map((item, index) => (
            <Marker
              key={index}
              coordinate={item}
              title={`Marker ${index + 1}`}
              zIndex={100}
            />
          ))}

        {showPolyline && (
          <Polyline
            coordinates={coordinates}
            strokeColor="red"
            strokeWidth={6}
            geodesic
            lineCap="round"
            lineJoin="round"
            tappable
            zIndex={999}
          />
        )}

        {showMultiplePolyline &&
          coordinates.slice(0, -1).map((_, index) => (
            <Polyline
              key={index}
              coordinates={[coordinates[index], coordinates[index + 1]]}
              strokeColor="blue"
              strokeWidth={5}
            />
          ))}

        {showPolygon && (
          <Polygon
            coordinates={coordinates}
            strokeColor="green"
            fillColor="rgba(0,255,0,0.25)"
            strokeWidth={3}
          />
        )}

        {showCircle &&
          coordinates.map((item, index) => (
            <Circle
              key={index}
              center={item}
              radius={120}
              strokeColor="#FF9800"
              fillColor="rgba(255,152,0,0.25)"
              strokeWidth={2}
            />
          ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingBottom: 10,
    elevation: 5,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
});
