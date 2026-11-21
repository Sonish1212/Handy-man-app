import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors } from '../../theme';

// About two or three streets across: close enough to find a house.
const ZOOM = { latitudeDelta: 0.006, longitudeDelta: 0.006 };

export const toRegion = (point) => ({ latitude: point.lat, longitude: point.lng, ...ZOOM });

// A map with a pin that stays in the middle: the customer moves the map
// until the pin sits on their house (the way Foodmandu and Pathao do it),
// or taps a spot to bring it to the pin. Reports the point under the pin
// whenever the map stops moving. `ref` reaches the MapView, so the screen
// can fly to a new place with animateToRegion().
//
// The pin is a map marker, part of the map itself. A view laid over the map
// does not show reliably on iPhone, where the map is a native Apple view.
export default function MapPicker({ ref, initial, onCenterChange, style }) {
  const mapRef = useRef(null);
  const [pin, setPin] = useState({ latitude: initial.lat, longitude: initial.lng });

  // Share the map with the screen as well as using it here.
  const attach = useCallback(
    (node) => {
      mapRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={attach}
        style={StyleSheet.absoluteFill}
        initialRegion={toRegion(initial)}
        onRegionChange={(region) => setPin({ latitude: region.latitude, longitude: region.longitude })}
        onRegionChangeComplete={(region) => {
          setPin({ latitude: region.latitude, longitude: region.longitude });
          onCenterChange({ lat: region.latitude, lng: region.longitude });
        }}
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          mapRef.current?.animateToRegion({ latitude, longitude, ...ZOOM }, 300);
        }}
        showsUserLocation
        showsPointsOfInterest
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={pin} pinColor={colors.terracotta} tracksViewChanges={false} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.photoPlaceholder },
});
