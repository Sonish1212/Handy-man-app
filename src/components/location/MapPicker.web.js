import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme';

export const toRegion = (point) => ({ latitude: point.lat, longitude: point.lng });

// The map only runs in the phone app (react-native-maps has no web version).
// In the browser preview the pin stays at the centre of the chosen area.
export default function MapPicker({ style }) {
  return (
    <View style={[styles.wrap, style]}>
      <Feather name="map" size={36} color={colors.primary} />
      <Text style={styles.text}>The map opens in the phone app. Here the pin is set to the middle of the area.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: colors.sageLight,
  },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
});
