import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, MIN_TAP, radius, spacing } from '../../theme';

export default function HomeHeader({ area, query, onQueryChange }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.sage, colors.sageLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      {/* Faint leaf line decoration */}
      <Feather name="feather" size={120} color={colors.primary} style={styles.leaf} />

      <View style={styles.topRow}>
        <Pressable
          style={styles.locationPill}
          onPress={() => router.push('/location')}
          accessibilityRole="button"
          accessibilityLabel={`Area: ${area.name}, ${area.city}. Change area`}
        >
          <Feather name="map-pin" size={16} color={colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {area.name}, {area.city}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={styles.avatar}
          onPress={() => router.navigate('/account')}
          accessibilityRole="button"
          accessibilityLabel="Account"
        >
          <Feather name="user" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.greeting}>What do you need fixed today?</Text>

      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search for a service"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => onQueryChange('')} hitSlop={12} accessibilityLabel="Clear search">
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  leaf: {
    position: 'absolute',
    right: -20,
    top: 10,
    opacity: 0.07,
    transform: [{ rotate: '-20deg' }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TAP,
    paddingHorizontal: 14,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  locationText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flexShrink: 1 },
  avatar: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: radius.box,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.box,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.box,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
});
