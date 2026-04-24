import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useColors } from '../../constants/colors';

const KL_REGION = {
  latitude: 3.139,
  longitude: 101.6869,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapBackground({ children, radius }: { children?: React.ReactNode; radius?: number }) {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = React.useState<Location.LocationObject | null>(null);
  const colors = useColors();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);
    })();
  }, []);

  // Smart Zoom: Adjust map zoom when radius changes
  useEffect(() => {
    if (location && radius && mapRef.current) {
      // 1 degree is roughly 111km. 
      // We want to show the full diameter (radius * 2) plus a 25% margin.
      const delta = (radius / 111) * 2.5;
      
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }, 600);
    } else if (location && mapRef.current) {
      // Default zoom if no radius is selected yet
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 600);
    }
  }, [radius, location]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={KL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {location && radius && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={radius * 1000} // Convert km to meters
            fillColor={colors.accent + '20'}
            strokeColor={colors.accent + '60'}
            strokeWidth={2}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
