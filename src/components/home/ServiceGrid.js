import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, MIN_NEPALI_SIZE, radius } from '../../theme';
import PhotoSlot from '../PhotoSlot';

export default function ServiceGrid({ services, onPress }) {
  return (
    <View style={styles.grid}>
      {services.map((service) => (
        <Pressable
          key={service.id}
          style={({ pressed }) => [styles.card, service.isOther && styles.otherCard, pressed && styles.pressed]}
          onPress={() => onPress?.(service)}
          accessibilityRole="button"
          accessibilityLabel={service.name}
        >
          {service.isOther ? (
            <View style={styles.otherIcon}>
              <Feather name="grid" size={32} color={colors.primary} />
            </View>
          ) : (
            <PhotoSlot image={service.image} fallbackImage={service.fallbackImage} icon={service.icon} style={styles.photo} />
          )}
          <View style={styles.label}>
            <Text style={styles.name} numberOfLines={2}>
              {service.name}
            </Text>
            <Text style={styles.nameNe} numberOfLines={2}>
              {service.nameNe}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  otherCard: { backgroundColor: colors.sageLight },
  pressed: { opacity: 0.85 },
  photo: { height: 110 },
  otherIcon: { height: 110, alignItems: 'center', justifyContent: 'center' },
  label: { paddingHorizontal: 10, paddingVertical: 8, minHeight: 80 },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  nameNe: { fontFamily: fonts.nepali, fontSize: MIN_NEPALI_SIZE, color: colors.textSecondary },
});
